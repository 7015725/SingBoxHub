/* SingBoxHub Stage38 manual subscription fetch probe. Rhino ES5 only. */
SBH.versions.subscriptionFetchProbe = 1;

(function () {
    "use strict";

    var P = Packages;
    var URL = P.java.net.URL;
    var URI = P.java.net.URI;
    var InetAddress = P.java.net.InetAddress;
    var Thread = P.java.lang.Thread;
    var Runnable = P.java.lang.Runnable;
    var BAOS = P.java.io.ByteArrayOutputStream;
    var ReflectArray = P.java.lang.reflect.Array;
    var JavaByte = P.java.lang.Byte;
    var JavaString = P.java.lang.String;
    var MessageDigest = P.java.security.MessageDigest;
    var Base64 = P.android.util.Base64;
    var originalStart = SBH.app.start;
    var repository = SBH.subscriptionRepository;

    var CONNECT_TIMEOUT_MS = 12000;
    var READ_TIMEOUT_MS = 20000;
    var MAX_REDIRECTS = 3;
    var MAX_BODY_BYTES = 4 * 1024 * 1024;
    var USER_AGENT = "SingBoxHub-SubscriptionProbe/1";
    var ALLOWED_PROTOCOLS = {
        ss: true,
        ssr: true,
        vmess: true,
        vless: true,
        trojan: true,
        hysteria: true,
        hysteria2: true,
        tuic: true,
        wireguard: true,
        socks: true,
        socks5: true,
        http: true,
        https: true
    };

    function now() {
        return Number(P.java.lang.System.currentTimeMillis());
    }

    function text(value) {
        return String(
            value === null || value === undefined ?
                "" : value
        );
    }

    function trim(value) {
        return text(value).replace(/^\s+|\s+$/g, "");
    }

    function closeQuietly(value) {
        try {
            if (value !== null && value !== undefined) {
                value.close();
            }
        } catch (ignored) {}
    }

    function errorText(error) {
        try {
            return SBH.util.errorText(error);
        } catch (ignored) {
            return String(error);
        }
    }

    function hex(bytes) {
        var output = [];
        var index;
        var value;
        var part;

        for (index = 0; index < bytes.length; index += 1) {
            value = Number(bytes[index]);
            if (value < 0) {
                value += 256;
            }
            part = value.toString(16);
            output.push(part.length === 1 ? "0" + part : part);
        }
        return output.join("");
    }

    function sha256Bytes(bytes) {
        var digest = MessageDigest.getInstance("SHA-256");
        return hex(digest.digest(bytes));
    }

    function maskedSource(urlValue) {
        var uri = new URI(String(urlValue));
        var scheme = String(uri.getScheme() || "");
        var host = String(uri.getHost() || "");
        var port = Number(uri.getPort());
        var path = String(uri.getRawPath() || "/");
        var portText = port >= 0 ? ":" + port : "";
        var queryText = uri.getRawQuery() !== null ?
            "?<masked>" : "";

        return {
            scheme: scheme,
            host: host,
            port: port >= 0 ? port : null,
            path: path,
            queryPresent: uri.getRawQuery() !== null,
            queryMasked: uri.getRawQuery() !== null,
            displayUrl:
                scheme + "://" + host + portText +
                path + queryText
        };
    }

    function validateAddress(urlValue, previousScheme) {
        var uri = new URI(String(urlValue));
        var scheme = String(uri.getScheme() || "")
            .toLowerCase();
        var host = String(uri.getHost() || "");
        var addresses;
        var index;
        var address;

        if (scheme !== "https" && scheme !== "http") {
            throw new Error(
                "订阅抓取仅支持 HTTP 或 HTTPS"
            );
        }
        if (!host) {
            throw new Error("订阅地址缺少主机名");
        }
        if (uri.getUserInfo() !== null) {
            throw new Error(
                "订阅地址不能包含用户名或密码"
            );
        }
        if (previousScheme === "https" && scheme === "http") {
            throw new Error(
                "拒绝 HTTPS 降级跳转到 HTTP"
            );
        }
        if (/^(localhost|.+\.localhost|.+\.local)$/i.test(host)) {
            throw new Error("拒绝访问本机或局域网主机");
        }

        addresses = InetAddress.getAllByName(host);
        if (addresses === null || addresses.length === 0) {
            throw new Error("订阅主机无法解析");
        }

        for (index = 0; index < addresses.length; index += 1) {
            address = addresses[index];
            if (address.isAnyLocalAddress() ||
                    address.isLoopbackAddress() ||
                    address.isLinkLocalAddress() ||
                    address.isSiteLocalAddress() ||
                    address.isMulticastAddress()) {
                throw new Error(
                    "拒绝访问本机、私网、链路本地或组播地址"
                );
            }
        }

        return {
            url: new URL(String(urlValue)),
            scheme: scheme,
            host: host
        };
    }

    function readBounded(stream, declaredLength) {
        var output = new BAOS();
        var buffer = ReflectArray.newInstance(
            JavaByte.TYPE,
            8192
        );
        var count;
        var total = 0;

        if (declaredLength > MAX_BODY_BYTES) {
            throw new Error(
                "订阅响应超过 " +
                MAX_BODY_BYTES + " 字节限制"
            );
        }

        try {
            while ((count = stream.read(buffer)) >= 0) {
                if (count <= 0) {
                    continue;
                }
                total += Number(count);
                if (total > MAX_BODY_BYTES) {
                    throw new Error(
                        "订阅响应超过 " +
                        MAX_BODY_BYTES + " 字节限制"
                    );
                }
                output.write(buffer, 0, count);
            }
            return output.toByteArray();
        } finally {
            closeQuietly(stream);
            closeQuietly(output);
        }
    }

    function utf8(bytes) {
        var value = String(new JavaString(bytes, "UTF-8"));
        return value.replace(/^\uFEFF/, "");
    }

    function protocolOf(line) {
        var match = trim(line).match(
            /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//
        );
        var protocol;

        if (!match) {
            return null;
        }
        protocol = String(match[1]).toLowerCase();
        return ALLOWED_PROTOCOLS[protocol] === true ?
            protocol : null;
    }

    function countUriLines(value) {
        var lines = String(value).split(/\r?\n/);
        var counts = {};
        var count = 0;
        var invalid = 0;
        var index;
        var line;
        var protocol;

        for (index = 0; index < lines.length; index += 1) {
            line = trim(lines[index]);
            if (!line || line.charAt(0) === "#") {
                continue;
            }
            protocol = protocolOf(line);
            if (protocol !== null) {
                count += 1;
                counts[protocol] =
                    Number(counts[protocol] || 0) + 1;
            } else {
                invalid += 1;
            }
        }

        return {
            candidateNodeCount: count,
            protocolCounts: counts,
            invalidLineCount: invalid
        };
    }

    function inspectSingBoxJson(value) {
        var parsed;
        var outbounds;
        var counts = {};
        var count = 0;
        var index;
        var item;
        var type;

        try {
            parsed = JSON.parse(String(value));
        } catch (ignored) {
            return null;
        }

        outbounds = parsed && parsed.outbounds;
        if (!outbounds || typeof outbounds.length !== "number") {
            return null;
        }

        for (index = 0; index < outbounds.length; index += 1) {
            item = outbounds[index] || {};
            type = String(item.type || "").toLowerCase();
            if (!type ||
                    type === "direct" ||
                    type === "block" ||
                    type === "dns" ||
                    type === "selector" ||
                    type === "urltest") {
                continue;
            }
            count += 1;
            counts[type] = Number(counts[type] || 0) + 1;
        }

        return {
            format: "singbox_json",
            candidateNodeCount: count,
            protocolCounts: counts,
            invalidLineCount: 0
        };
    }

    function inspectClashYaml(value) {
        var lines = String(value).split(/\r?\n/);
        var counts = {};
        var count = 0;
        var inProxies = false;
        var baseIndent = -1;
        var index;
        var line;
        var trimmed;
        var indent;
        var typeMatch;
        var type;

        if (!/^\s*proxies\s*:/m.test(String(value))) {
            return null;
        }

        for (index = 0; index < lines.length; index += 1) {
            line = String(lines[index]);
            trimmed = trim(line);
            indent = line.length -
                line.replace(/^\s+/, "").length;

            if (/^proxies\s*:/.test(trimmed)) {
                inProxies = true;
                baseIndent = indent;
                continue;
            }

            if (inProxies &&
                    trimmed &&
                    indent <= baseIndent &&
                    !/^-\s/.test(trimmed)) {
                inProxies = false;
            }

            if (!inProxies) {
                continue;
            }

            typeMatch = trimmed.match(
                /(?:^|[,{]\s*)type\s*:\s*["']?([a-zA-Z0-9_-]+)/
            );
            if (typeMatch) {
                type = String(typeMatch[1]).toLowerCase();
                count += 1;
                counts[type] =
                    Number(counts[type] || 0) + 1;
            }
        }

        return {
            format: "clash_yaml",
            candidateNodeCount: count,
            protocolCounts: counts,
            invalidLineCount: 0
        };
    }

    function decodeBase64Candidate(value) {
        var compact = String(value).replace(/\s+/g, "");
        var bytes;
        var decoded;

        if (compact.length < 16 ||
                compact.length % 4 === 1 ||
                !/^[A-Za-z0-9+/_=-]+$/.test(compact)) {
            return null;
        }

        try {
            bytes = Base64.decode(
                compact,
                Base64.DEFAULT
            );
            decoded = utf8(bytes);
            return decoded;
        } catch (ignored) {
            return null;
        }
    }

    function classify(value) {
        var singBox = inspectSingBoxJson(value);
        var clash;
        var uriLines;
        var decoded;
        var decodedLines;

        if (singBox !== null) {
            return singBox;
        }

        clash = inspectClashYaml(value);
        if (clash !== null) {
            return clash;
        }

        uriLines = countUriLines(value);
        if (uriLines.candidateNodeCount > 0) {
            uriLines.format = "plain_uri_list";
            return uriLines;
        }

        decoded = decodeBase64Candidate(value);
        if (decoded !== null) {
            decodedLines = countUriLines(decoded);
            if (decodedLines.candidateNodeCount > 0) {
                decodedLines.format = "base64_uri_list";
                return decodedLines;
            }
        }

        return {
            format: "unknown_text",
            candidateNodeCount: 0,
            protocolCounts: {},
            invalidLineCount: 0
        };
    }

    function fetchOnce(row) {
        var startedAt = now();
        var current = validateAddress(row.url, null);
        var connection = null;
        var responseCode;
        var redirectCount = 0;
        var location;
        var nextUrl;
        var next;
        var contentLength;
        var contentType;
        var bytes;
        var body;
        var detected;

        while (true) {
            try {
                connection = current.url.openConnection();
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(
                    CONNECT_TIMEOUT_MS
                );
                connection.setReadTimeout(
                    READ_TIMEOUT_MS
                );
                connection.setUseCaches(false);
                connection.setRequestMethod("GET");
                connection.setRequestProperty(
                    "Accept",
                    "application/json,application/yaml," +
                    "text/yaml,text/plain,*/*;q=0.5"
                );
                connection.setRequestProperty(
                    "Accept-Encoding",
                    "identity"
                );
                connection.setRequestProperty(
                    "Cache-Control",
                    "no-cache"
                );
                connection.setRequestProperty(
                    "User-Agent",
                    USER_AGENT
                );

                responseCode = Number(
                    connection.getResponseCode()
                );

                if (responseCode === 301 ||
                        responseCode === 302 ||
                        responseCode === 303 ||
                        responseCode === 307 ||
                        responseCode === 308) {
                    if (redirectCount >= MAX_REDIRECTS) {
                        throw new Error(
                            "订阅跳转次数超过限制"
                        );
                    }
                    location = connection.getHeaderField(
                        "Location"
                    );
                    if (!location) {
                        throw new Error(
                            "订阅跳转缺少 Location"
                        );
                    }
                    nextUrl = new URL(
                        current.url,
                        String(location)
                    );
                    next = validateAddress(
                        nextUrl.toExternalForm(),
                        current.scheme
                    );
                    redirectCount += 1;
                    current = next;
                    try {
                        connection.disconnect();
                    } catch (ignoredRedirectDisconnect) {}
                    connection = null;
                    continue;
                }

                if (responseCode < 200 ||
                        responseCode >= 300) {
                    throw new Error(
                        "订阅服务器返回 HTTP " +
                        responseCode
                    );
                }

                contentLength = Number(
                    connection.getContentLengthLong()
                );
                contentType = String(
                    connection.getContentType() || ""
                );
                bytes = readBounded(
                    connection.getInputStream(),
                    contentLength
                );
                body = utf8(bytes);
                detected = classify(body);

                return {
                    ok: true,
                    stage:
                        "subscription_stage38_manual_fetch_probe",
                    subscriptionId: row.id,
                    subscriptionName: row.name,
                    source: maskedSource(
                        current.url.toExternalForm()
                    ),
                    responseCode: responseCode,
                    redirectCount: redirectCount,
                    contentType: contentType,
                    byteCount: Number(bytes.length),
                    bodySha256: sha256Bytes(bytes),
                    format: detected.format,
                    candidateNodeCount:
                        detected.candidateNodeCount,
                    protocolCounts:
                        detected.protocolCounts,
                    invalidLineCount:
                        detected.invalidLineCount,
                    rawBodyReturned: false,
                    rawBodyPersisted: false,
                    automaticRetry: false,
                    networkAccessed: true,
                    runtimeFilesModified: false,
                    configModified: false,
                    coreStartInvoked: false,
                    tunCreated: false,
                    routeModified: false,
                    destructiveOperations: false,
                    durationMs: now() - startedAt,
                    timestamp: now()
                };
            } finally {
                try {
                    if (connection !== null) {
                        connection.disconnect();
                    }
                } catch (ignoredDisconnect) {}
            }
        }
    }

    function failure(row, error, startedAt) {
        return {
            ok: false,
            stage:
                "subscription_stage38_manual_fetch_probe",
            subscriptionId: row ? row.id : null,
            subscriptionName: row ? row.name : null,
            source: row ? maskedSource(row.url) : null,
            error: errorText(error).substring(0, 400),
            rawBodyReturned: false,
            rawBodyPersisted: false,
            automaticRetry: false,
            networkAccessed: true,
            runtimeFilesModified: false,
            configModified: false,
            coreStartInvoked: false,
            tunCreated: false,
            routeModified: false,
            destructiveOperations: false,
            durationMs: now() - startedAt,
            timestamp: now()
        };
    }

    function postCallback(callback, result) {
        SBH.handler.post(new JavaAdapter(Runnable, {
            run: function () {
                callback(result);
            }
        }));
    }

    function probeAsync(id, callback) {
        var row = repository.get(id);

        if (typeof callback !== "function") {
            throw new Error("订阅抓取回调不可用");
        }
        if (row === null) {
            throw new Error("订阅记录不存在");
        }

        new Thread(
            new JavaAdapter(Runnable, {
                run: function () {
                    var startedAt = now();
                    var result;
                    try {
                        result = fetchOnce(row);
                    } catch (error) {
                        result = failure(
                            row,
                            error,
                            startedAt
                        );
                    }
                    postCallback(callback, result);
                }
            }),
            "SingBoxHub-SubscriptionProbe"
        ).start();

        return {
            accepted: true,
            subscriptionId: row.id,
            manualOnly: true,
            automaticRetry: false,
            networkAccessScheduled: true
        };
    }

    if (!repository) {
        throw new Error(
            "Subscription repository unavailable"
        );
    }

    SBH.subscriptionFetchProbe = {
        version: 1,
        probeAsync: probeAsync,
        limits: {
            connectTimeoutMs: CONNECT_TIMEOUT_MS,
            readTimeoutMs: READ_TIMEOUT_MS,
            maxRedirects: MAX_REDIRECTS,
            maxBodyBytes: MAX_BODY_BYTES
        },
        manualOnly: true,
        automaticRetry: false,
        rawBodyPersisted: false,
        runtimeWriteEnabled: false
    };

    if (typeof originalStart !== "function") {
        throw new Error("Original app.start unavailable");
    }

    SBH.app.start = function () {
        var output = originalStart();

        output.subscriptionFetchProbeVersion = 1;
        output.subscriptionFetchProbeReady = true;
        output.subscriptionFetchManualOnly = true;
        output.subscriptionFetchAutomaticRetry = false;
        output.subscriptionFetchRawBodyPersisted = false;
        output.subscriptionFetchConnectTimeoutMs =
            CONNECT_TIMEOUT_MS;
        output.subscriptionFetchReadTimeoutMs =
            READ_TIMEOUT_MS;
        output.subscriptionFetchMaxRedirects =
            MAX_REDIRECTS;
        output.subscriptionFetchMaxBodyBytes =
            MAX_BODY_BYTES;
        output.subscriptionFetchPrivateAddressBlocked = true;
        output.subscriptionFetchHttpsDowngradeBlocked = true;
        output.subscriptionRuntimeConfigModified = false;
        output.subscriptionCoreInvoked = false;
        output.subscriptionTunCreated = false;
        output.subscriptionRouteModified = false;
        output.writeOperationsLocked = true;
        output.destructiveOperations = false;
        return output;
    };
}());
