/* SingBoxHub Stage44 ephemeral sing-box binary check. Rhino ES5 only. */
SBH.versions.candidateConfigPreflight = 2;

(function () {
    "use strict";

    var P = Packages;
    var URI = P.java.net.URI;
    var URLDecoder = P.java.net.URLDecoder;
    var Base64 = P.android.util.Base64;
    var JavaString = P.java.lang.String;
    var MessageDigest = P.java.security.MessageDigest;
    var Thread = P.java.lang.Thread;
    var Runnable = P.java.lang.Runnable;
    var File = P.java.io.File;
    var FOS = P.java.io.FileOutputStream;
    var BAOS = P.java.io.ByteArrayOutputStream;
    var ReflectArray = P.java.lang.reflect.Array;
    var JavaByte = P.java.lang.Byte;
    var ArrayList = P.java.util.ArrayList;
    var TimeUnit = P.java.util.concurrent.TimeUnit;
    var vault = SBH.credentialVault;
    var coverageAudit = SBH.credentialCoverageAudit;
    var originalStart = SBH.app.start;

    var CREDENTIAL_PURPOSE =
        "subscription_node_credential_v1";
    var MAX_RECORDS = 2000;
    var MAX_ERROR_DETAILS = 100;
    var BINARY_CHECK_TIMEOUT_MS = 30000;
    var MAX_BINARY_OUTPUT_BYTES = 256 * 1024;
    var EPHEMERAL_DIR_NAME = "ephemeral-config-check";
    var SUPPORTED_TYPES = {
        shadowsocks: true,
        vmess: true,
        vless: true,
        trojan: true,
        hysteria: true,
        hysteria2: true,
        tuic: true,
        wireguard: true,
        socks: true,
        http: true
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

    function lower(value) {
        return trim(value).toLowerCase();
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

    function decodeComponent(value) {
        try {
            return String(
                URLDecoder.decode(String(value || ""), "UTF-8")
            );
        } catch (ignored) {
            return String(value || "");
        }
    }

    function decodeBase64Text(value) {
        var compact = String(value || "")
            .replace(/\s+/g, "")
            .replace(/-/g, "+")
            .replace(/_/g, "/");
        var remainder = compact.length % 4;
        var bytes;

        if (remainder === 2) {
            compact += "==";
        } else if (remainder === 3) {
            compact += "=";
        } else if (remainder === 1) {
            throw new Error("Base64 长度无效");
        }

        bytes = Base64.decode(compact, Base64.DEFAULT);
        return String(new JavaString(bytes, "UTF-8"));
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
            output.push(
                part.length === 1 ? "0" + part : part
            );
        }
        return output.join("");
    }

    function sha256Text(value) {
        var digest = MessageDigest.getInstance("SHA-256");
        var bytes = new JavaString(
            String(value)
        ).getBytes("UTF-8");
        return hex(digest.digest(bytes));
    }

    function bool(value) {
        var normalized = lower(value);
        return value === true ||
            normalized === "true" ||
            normalized === "1" ||
            normalized === "yes";
    }

    function numberOrNull(value) {
        var parsed = Number(value);
        if (!isFinite(parsed) || parsed <= 0) {
            return null;
        }
        return Math.floor(parsed);
    }

    function normalizeType(value) {
        var type = lower(value);
        if (type === "ss") {
            return "shadowsocks";
        }
        if (type === "socks5") {
            return "socks";
        }
        if (type === "hy2") {
            return "hysteria2";
        }
        return type;
    }

    function queryMap(uri) {
        var raw = String(uri.getRawQuery() || "");
        var output = {};
        var parts;
        var index;
        var item;
        var position;
        var key;
        var value;

        if (!raw) {
            return output;
        }

        parts = raw.split("&");
        for (index = 0; index < parts.length; index += 1) {
            item = parts[index];
            position = item.indexOf("=");
            key = lower(
                decodeComponent(
                    position >= 0 ?
                        item.substring(0, position) :
                        item
                )
            );
            value = decodeComponent(
                position >= 0 ?
                    item.substring(position + 1) :
                    ""
            );
            if (key) {
                output[key] = value;
            }
        }
        return output;
    }

    function splitUserInfo(value) {
        var raw = decodeComponent(value || "");
        var position = raw.indexOf(":");
        return {
            first: position >= 0 ?
                raw.substring(0, position) : raw,
            second: position >= 0 ?
                raw.substring(position + 1) : ""
        };
    }

    function tlsFromQuery(query, node) {
        var security = lower(
            query.security || query.tls || ""
        );
        var enabled =
            node.tls === true ||
            security === "tls" ||
            security === "reality" ||
            bool(query.tls);
        var tls;

        if (!enabled) {
            return null;
        }

        tls = {
            enabled: true
        };

        if (query.sni || query.servername ||
                query.server_name) {
            tls.server_name = String(
                query.sni ||
                query.servername ||
                query.server_name
            );
        }
        if (bool(
                query.allowinsecure ||
                query.insecure ||
                query.skipcertverify
            )) {
            tls.insecure = true;
        }
        if (query.alpn) {
            tls.alpn = String(query.alpn).split(",");
        }
        if (security === "reality") {
            tls.reality = {
                enabled: true
            };
            if (query.pbk || query.publickey) {
                tls.reality.public_key = String(
                    query.pbk || query.publickey
                );
            }
            if (query.sid || query.shortid) {
                tls.reality.short_id = String(
                    query.sid || query.shortid
                );
            }
        }
        return tls;
    }

    function transportFromQuery(query, node) {
        var type = lower(
            query.type ||
            query.network ||
            node.transport ||
            ""
        );
        var transport;

        if (!type || type === "tcp") {
            return null;
        }

        if (type === "ws" || type === "websocket") {
            transport = {
                type: "ws"
            };
            if (query.path) {
                transport.path = String(query.path);
            }
            if (query.host) {
                transport.headers = {
                    Host: String(query.host)
                };
            }
            return transport;
        }

        if (type === "grpc") {
            transport = {
                type: "grpc"
            };
            if (query.servicename ||
                    query.service_name) {
                transport.service_name = String(
                    query.servicename ||
                    query.service_name
                );
            }
            return transport;
        }

        if (type === "http" || type === "h2") {
            transport = {
                type: "http"
            };
            if (query.path) {
                transport.path = String(query.path);
            }
            if (query.host) {
                transport.host = [
                    String(query.host)
                ];
            }
            return transport;
        }

        if (type === "httpupgrade") {
            transport = {
                type: "httpupgrade"
            };
            if (query.path) {
                transport.path = String(query.path);
            }
            if (query.host) {
                transport.host = String(query.host);
            }
            return transport;
        }

        return {
            type: type
        };
    }

    function baseCandidate(node, type) {
        return {
            type: normalizeType(type || node.protocol),
            tag: trim(node.name) ||
                normalizeType(type || node.protocol) +
                "-" + String(node.fingerprint).substring(0, 8),
            server: trim(node.server),
            server_port: numberOrNull(node.port)
        };
    }

    function parseVmessUri(line, node) {
        var body = trim(line).replace(/^vmess:\/\//i, "");
        var value = JSON.parse(decodeBase64Text(body));
        var candidate = baseCandidate(node, "vmess");
        var query = {};

        candidate.server = trim(
            value.add || value.server || node.server
        );
        candidate.server_port = numberOrNull(
            value.port || value.server_port || node.port
        );
        candidate.uuid = trim(
            value.id || value.uuid || ""
        );
        if (value.security || value.scy) {
            candidate.security = String(
                value.security || value.scy
            );
        }
        if (value.a !== undefined &&
                Number(value.a) > 0) {
            candidate.alter_id = Number(value.a);
        }
        query.security = value.tls || value.security;
        query.sni = value.sni;
        query.type = value.net;
        query.path = value.path;
        query.host = value.host;
        query.servicename =
            value.serviceName || value.service_name;

        candidate.tls = tlsFromQuery(query, node);
        candidate.transport =
            transportFromQuery(query, node);
        return candidate;
    }

    function parseShadowsocksUri(line, node) {
        var raw = trim(line);
        var hashPosition = raw.indexOf("#");
        var main = hashPosition >= 0 ?
            raw.substring(0, hashPosition) : raw;
        var queryPosition = main.indexOf("?");
        var queryText = queryPosition >= 0 ?
            main.substring(queryPosition + 1) : "";
        var core = (
            queryPosition >= 0 ?
                main.substring(0, queryPosition) :
                main
        ).replace(/^ss:\/\//i, "");
        var at = core.lastIndexOf("@");
        var userInfo;
        var authority;
        var decoded;
        var user;
        var hostPort;
        var colon;
        var query = {};
        var candidate = baseCandidate(
            node,
            "shadowsocks"
        );

        if (at < 0) {
            decoded = decodeBase64Text(core);
            at = decoded.lastIndexOf("@");
            if (at < 0) {
                throw new Error(
                    "Shadowsocks URI 缺少服务器"
                );
            }
            userInfo = decoded.substring(0, at);
            authority = decoded.substring(at + 1);
        } else {
            userInfo = core.substring(0, at);
            authority = core.substring(at + 1);
            if (userInfo.indexOf(":") < 0) {
                userInfo = decodeBase64Text(userInfo);
            } else {
                userInfo = decodeComponent(userInfo);
            }
        }

        user = splitUserInfo(userInfo);
        colon = authority.lastIndexOf(":");
        if (colon < 0) {
            throw new Error(
                "Shadowsocks URI 缺少端口"
            );
        }
        hostPort = {
            host: authority.substring(0, colon)
                .replace(/^\[|\]$/g, ""),
            port: authority.substring(colon + 1)
        };

        if (queryText) {
            query = queryMap(
                new URI(
                    "https://example.invalid/?" +
                    queryText
                )
            );
        }

        candidate.server = trim(
            hostPort.host || node.server
        );
        candidate.server_port = numberOrNull(
            hostPort.port || node.port
        );
        candidate.method = trim(user.first);
        candidate.password = String(user.second);
        if (query.plugin) {
            candidate.plugin = String(query.plugin);
        }
        return candidate;
    }

    function parseGenericUri(line, node) {
        var uri = new URI(trim(line));
        var scheme = normalizeType(uri.getScheme());
        var query = queryMap(uri);
        var candidate = baseCandidate(node, scheme);
        var user = splitUserInfo(uri.getRawUserInfo());
        var tls;
        var transport;

        candidate.server = trim(
            uri.getHost() || node.server
        );
        candidate.server_port = numberOrNull(
            uri.getPort() >= 0 ?
                uri.getPort() : node.port
        );

        if (scheme === "vless" ||
                scheme === "vmess") {
            candidate.uuid = trim(user.first);
            if (query.flow) {
                candidate.flow = String(query.flow);
            }
        } else if (scheme === "trojan") {
            candidate.password = String(user.first);
        } else if (scheme === "hysteria") {
            candidate.auth_str = String(
                user.first ||
                query.auth ||
                query.auth_str ||
                ""
            );
            if (query.upmbps || query.up_mbps) {
                candidate.up_mbps = Number(
                    query.upmbps || query.up_mbps
                );
            }
            if (query.downmbps || query.down_mbps) {
                candidate.down_mbps = Number(
                    query.downmbps || query.down_mbps
                );
            }
        } else if (scheme === "hysteria2") {
            candidate.password = String(
                user.first ||
                query.password ||
                query.auth ||
                ""
            );
        } else if (scheme === "tuic") {
            candidate.uuid = String(user.first);
            candidate.password = String(user.second);
            if (query.congestion_control) {
                candidate.congestion_control =
                    String(query.congestion_control);
            }
        } else if (scheme === "socks" ||
                scheme === "http") {
            if (user.first) {
                candidate.username = String(user.first);
            }
            if (user.second) {
                candidate.password = String(user.second);
            }
        } else if (scheme === "wireguard") {
            candidate.private_key = String(
                query.private_key ||
                query.privatekey ||
                user.first ||
                ""
            );
            candidate.peer_public_key = String(
                query.public_key ||
                query.publickey ||
                query.peer_public_key ||
                ""
            );
            if (query.pre_shared_key ||
                    query.presharedkey) {
                candidate.pre_shared_key = String(
                    query.pre_shared_key ||
                    query.presharedkey
                );
            }
            if (query.local_address ||
                    query.address) {
                candidate.local_address = String(
                    query.local_address ||
                    query.address
                ).split(",");
            }
        }

        tls = tlsFromQuery(query, node);
        transport = transportFromQuery(query, node);
        if (tls !== null) {
            candidate.tls = tls;
        }
        if (transport !== null) {
            candidate.transport = transport;
        }
        return candidate;
    }

    function convertClashProxy(proxy, node) {
        var type = normalizeType(
            proxy.type || node.protocol
        );
        var candidate = baseCandidate(node, type);
        var query = {};
        var tls;
        var transport;

        candidate.server = trim(
            proxy.server || node.server
        );
        candidate.server_port = numberOrNull(
            proxy.port || node.port
        );

        if (type === "shadowsocks") {
            candidate.method = String(
                proxy.cipher || proxy.method || ""
            );
            candidate.password = String(
                proxy.password || ""
            );
            if (proxy.plugin) {
                candidate.plugin = String(proxy.plugin);
            }
        } else if (type === "vmess") {
            candidate.uuid = String(proxy.uuid || "");
            if (proxy.cipher) {
                candidate.security = String(proxy.cipher);
            }
            if (Number(proxy.alterId || proxy.alter_id) > 0) {
                candidate.alter_id = Number(
                    proxy.alterId || proxy.alter_id
                );
            }
        } else if (type === "vless") {
            candidate.uuid = String(proxy.uuid || "");
            if (proxy.flow) {
                candidate.flow = String(proxy.flow);
            }
        } else if (type === "trojan") {
            candidate.password = String(
                proxy.password || ""
            );
        } else if (type === "hysteria") {
            candidate.auth_str = String(
                proxy.auth_str ||
                proxy.auth ||
                proxy.password ||
                ""
            );
            if (proxy.up) {
                candidate.up = String(proxy.up);
            }
            if (proxy.down) {
                candidate.down = String(proxy.down);
            }
        } else if (type === "hysteria2") {
            candidate.password = String(
                proxy.password ||
                proxy.auth ||
                ""
            );
        } else if (type === "tuic") {
            candidate.uuid = String(proxy.uuid || "");
            candidate.password = String(
                proxy.password || ""
            );
            if (proxy.congestion_controller) {
                candidate.congestion_control =
                    String(proxy.congestion_controller);
            }
        } else if (type === "wireguard") {
            candidate.private_key = String(
                proxy.private_key ||
                proxy["private-key"] ||
                ""
            );
            candidate.peer_public_key = String(
                proxy.public_key ||
                proxy["public-key"] ||
                ""
            );
            if (proxy.pre_shared_key ||
                    proxy["pre-shared-key"]) {
                candidate.pre_shared_key = String(
                    proxy.pre_shared_key ||
                    proxy["pre-shared-key"]
                );
            }
        } else if (type === "socks" ||
                type === "http") {
            if (proxy.username) {
                candidate.username = String(
                    proxy.username
                );
            }
            if (proxy.password) {
                candidate.password = String(
                    proxy.password
                );
            }
        }

        query.security =
            proxy.security ||
            (bool(proxy.tls) ? "tls" : "");
        query.sni =
            proxy.sni ||
            proxy.servername ||
            proxy.server_name;
        query.insecure =
            proxy.skip_cert_verify ||
            proxy["skip-cert-verify"];
        query.type =
            proxy.network ||
            proxy.transport;
        query.path =
            proxy.path ||
            (proxy["ws-opts"] &&
                proxy["ws-opts"].path);
        query.host =
            proxy.host ||
            (proxy["ws-opts"] &&
                proxy["ws-opts"].headers &&
                proxy["ws-opts"].headers.Host);
        query.servicename =
            proxy.service_name ||
            (proxy["grpc-opts"] &&
                proxy["grpc-opts"]["grpc-service-name"]);

        tls = tlsFromQuery(query, node);
        transport = transportFromQuery(query, node);
        if (tls !== null) {
            candidate.tls = tls;
        }
        if (transport !== null) {
            candidate.transport = transport;
        }
        return candidate;
    }

    function candidateFromEnvelope(envelope, node) {
        var format = lower(envelope.format);
        var payload = envelope.payload || {};
        var outbound;

        if (format === "singbox_outbound") {
            outbound = payload.outbound;
            if (!outbound ||
                    typeof outbound !== "object") {
                throw new Error(
                    "sing-box outbound 结构缺失"
                );
            }
            return JSON.parse(
                JSON.stringify(outbound)
            );
        }

        if (format === "clash_proxy") {
            return convertClashProxy(
                payload.proxy || {},
                node
            );
        }

        if (format === "vmess_uri") {
            return parseVmessUri(
                payload.uri,
                node
            );
        }

        if (format === "ss_uri") {
            return parseShadowsocksUri(
                payload.uri,
                node
            );
        }

        if (format === "generic_uri") {
            return parseGenericUri(
                payload.uri,
                node
            );
        }

        if (format === "ssr_uri") {
            return {
                type: "ssr",
                tag: node.name,
                server: node.server,
                server_port: node.port
            };
        }

        throw new Error(
            "不支持的凭据来源格式：" + format
        );
    }

    function requiredFields(type) {
        if (type === "shadowsocks") {
            return ["method", "password"];
        }
        if (type === "vmess" ||
                type === "vless") {
            return ["uuid"];
        }
        if (type === "trojan" ||
                type === "hysteria2") {
            return ["password"];
        }
        if (type === "hysteria") {
            return ["auth_str|auth"];
        }
        if (type === "tuic") {
            return ["uuid", "password"];
        }
        if (type === "wireguard") {
            return [
                "private_key",
                "peer_public_key"
            ];
        }
        return [];
    }

    function validateCandidate(candidate) {
        var type = normalizeType(candidate.type);
        var missing = [];
        var required = requiredFields(type);
        var index;
        var key;
        var alternatives;
        var alternativeIndex;
        var found;

        if (!SUPPORTED_TYPES[type]) {
            return {
                supported: false,
                valid: false,
                type: type || "unknown",
                missingFields: [],
                reason: "unsupported_outbound_type"
            };
        }

        candidate.type = type;

        if (!trim(candidate.server)) {
            missing.push("server");
        }
        if (numberOrNull(candidate.server_port) === null) {
            missing.push("server_port");
        }

        for (index = 0; index < required.length; index += 1) {
            key = required[index];
            if (key.indexOf("|") >= 0) {
                alternatives = key.split("|");
                found = false;
                for (
                    alternativeIndex = 0;
                    alternativeIndex < alternatives.length;
                    alternativeIndex += 1
                ) {
                    if (trim(
                            candidate[
                                alternatives[alternativeIndex]
                            ]
                        )) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    missing.push(key);
                }
            } else if (!trim(candidate[key])) {
                missing.push(key);
            }
        }

        return {
            supported: true,
            valid: missing.length === 0,
            type: type,
            missingFields: missing,
            reason: missing.length === 0 ?
                null : "required_field_missing"
        };
    }

    function loadRecords() {
        var cursor = null;
        var rows = [];
        try {
            cursor = SBH.database.open().rawQuery(
                "SELECT n.subscription_id,s.name,n.fingerprint," +
                "n.name,n.protocol,n.server,n.port,n.tls," +
                "n.transport,c.record_key,c.source_format " +
                "FROM subscription_nodes n " +
                "JOIN subscription_node_credentials c " +
                "ON c.subscription_id=n.subscription_id " +
                "AND c.fingerprint=n.fingerprint " +
                "LEFT JOIN subscriptions s " +
                "ON s.id=n.subscription_id " +
                "ORDER BY n.subscription_id,n.protocol,n.name " +
                "LIMIT " + String(MAX_RECORDS),
                []
            );
            while (cursor.moveToNext()) {
                rows.push({
                    subscriptionId:
                        Number(cursor.getLong(0)),
                    subscriptionName:
                        String(cursor.getString(1) || ""),
                    fingerprint:
                        String(cursor.getString(2) || ""),
                    name:
                        String(cursor.getString(3) || ""),
                    protocol:
                        String(cursor.getString(4) || ""),
                    server:
                        String(cursor.getString(5) || ""),
                    port: cursor.isNull(6) ?
                        null : Number(cursor.getLong(6)),
                    tls:
                        Number(cursor.getInt(7)) === 1,
                    transport:
                        String(cursor.getString(8) || ""),
                    recordKey:
                        String(cursor.getString(9) || ""),
                    sourceFormat:
                        String(cursor.getString(10) || "")
                });
            }
            return rows;
        } finally {
            closeQuietly(cursor);
        }
    }

    function preflight() {
        var startedAt = now();
        var coverage = coverageAudit.audit();
        var rows = loadRecords();
        var byType = {};
        var errors = [];
        var digestParts = [];
        var decrypted = 0;
        var built = 0;
        var valid = 0;
        var unsupported = 0;
        var invalid = 0;
        var index;
        var row;
        var plaintext = null;
        var envelope = null;
        var candidate = null;
        var validation;
        var candidateJson;
        var candidateHash;
        var type;

        if (!coverage.coverageComplete) {
            throw new Error(
                "凭据覆盖率未达到 100%，禁止候选配置预检"
            );
        }

        try {
            for (index = 0; index < rows.length; index += 1) {
                row = rows[index];
                plaintext = null;
                envelope = null;
                candidate = null;
                validation = null;
                candidateJson = null;

                try {
                    plaintext = vault.getText(
                        row.recordKey,
                        CREDENTIAL_PURPOSE
                    );
                    if (plaintext === null) {
                        throw new Error(
                            "保险库密文记录不存在"
                        );
                    }
                    decrypted += 1;
                    envelope = JSON.parse(plaintext);
                    candidate = candidateFromEnvelope(
                        envelope,
                        row
                    );
                    built += 1;
                    validation = validateCandidate(
                        candidate
                    );
                    type = validation.type;
                    byType[type] = Number(
                        byType[type] || 0
                    ) + 1;

                    if (!validation.supported) {
                        unsupported += 1;
                    } else if (!validation.valid) {
                        invalid += 1;
                    } else {
                        valid += 1;
                        candidateJson = JSON.stringify(
                            candidate
                        );
                        candidateHash = sha256Text(
                            candidateJson
                        );
                        digestParts.push(
                            row.fingerprint +
                            ":" +
                            candidateHash
                        );
                    }

                    if ((!validation.supported ||
                            !validation.valid) &&
                            errors.length < MAX_ERROR_DETAILS) {
                        errors.push({
                            subscriptionId:
                                row.subscriptionId,
                            subscriptionName:
                                row.subscriptionName,
                            nodeName: row.name,
                            protocol: row.protocol,
                            sourceFormat:
                                row.sourceFormat,
                            reason:
                                validation.reason,
                            missingFields:
                                validation.missingFields
                        });
                    }
                } catch (recordError) {
                    invalid += 1;
                    type = normalizeType(row.protocol) ||
                        "unknown";
                    byType[type] = Number(
                        byType[type] || 0
                    ) + 1;
                    if (errors.length < MAX_ERROR_DETAILS) {
                        errors.push({
                            subscriptionId:
                                row.subscriptionId,
                            subscriptionName:
                                row.subscriptionName,
                            nodeName: row.name,
                            protocol: row.protocol,
                            sourceFormat:
                                row.sourceFormat,
                            reason:
                                "candidate_build_error",
                            errorCode:
                                "CANDIDATE_BUILD_FAILED"
                        });
                    }
                } finally {
                    plaintext = null;
                    envelope = null;
                    candidate = null;
                    validation = null;
                    candidateJson = null;
                    candidateHash = null;
                }
            }
        } finally {
            row = null;
            rows = [];
        }

        digestParts.sort();

        return {
            ok: true,
            stage:
                "credential_stage43_candidate_config_preflight",
            coverageComplete:
                coverage.coverageComplete,
            inputNodeCount:
                coverage.totalNodeCount,
            credentialLinkCount:
                coverage.linkedCredentialCount,
            decryptedCredentialCount:
                decrypted,
            candidateBuiltCount:
                built,
            structurallyValidCount:
                valid,
            unsupportedTypeCount:
                unsupported,
            invalidCandidateCount:
                invalid,
            candidateTypeCounts:
                byType,
            issueCount:
                errors.length,
            issues:
                errors,
            candidateSetSha256:
                sha256Text(digestParts.join("\n")),
            candidateObjectsReturned: false,
            candidateConfigPersisted: false,
            plaintextCredentialReturned: false,
            plaintextCredentialPersisted: false,
            secretReferencesClearedBestEffort: true,
            memoryZeroizationGuaranteed: false,
            preflightOnly: true,
            singBoxBinaryCheckInvoked: false,
            runtimeUsable: false,
            networkAccessed: false,
            clientDatabaseModified: false,
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

    function pruneValue(value) {
        var output;
        var key;
        var item;
        var index;

        if (value === null || value === undefined) {
            return undefined;
        }
        if (typeof value !== "object") {
            return value;
        }
        if (typeof value.length === "number" &&
                !(value instanceof JavaString)) {
            output = [];
            for (index = 0; index < value.length; index += 1) {
                item = pruneValue(value[index]);
                if (item !== undefined) {
                    output.push(item);
                }
            }
            return output;
        }

        output = {};
        for (key in value) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                item = pruneValue(value[key]);
                if (item !== undefined) {
                    output[key] = item;
                }
            }
        }
        return output;
    }

    function addSensitiveValue(values, value) {
        var item = trim(value);
        if (item.length >= 4) {
            values[item] = true;
        }
    }

    function collectSensitiveValues(candidate, values) {
        addSensitiveValue(values, candidate.tag);
        addSensitiveValue(values, candidate.server);
        addSensitiveValue(values, candidate.uuid);
        addSensitiveValue(values, candidate.password);
        addSensitiveValue(values, candidate.username);
        addSensitiveValue(values, candidate.private_key);
        addSensitiveValue(values, candidate.peer_public_key);
        addSensitiveValue(values, candidate.pre_shared_key);
        addSensitiveValue(values, candidate.auth_str);
        addSensitiveValue(values, candidate.auth);
        try {
            if (candidate.tls) {
                addSensitiveValue(
                    values,
                    candidate.tls.server_name
                );
                if (candidate.tls.reality) {
                    addSensitiveValue(
                        values,
                        candidate.tls.reality.public_key
                    );
                    addSensitiveValue(
                        values,
                        candidate.tls.reality.short_id
                    );
                }
            }
        } catch (ignoredTls) {}
    }

    function buildCandidateSetForBinaryCheck() {
        var coverage = coverageAudit.audit();
        var rows = loadRecords();
        var candidates = [];
        var sensitiveValues = {};
        var typeCounts = {};
        var digestParts = [];
        var index;
        var row;
        var plaintext = null;
        var envelope = null;
        var candidate = null;
        var validation;
        var candidateJson;
        var fingerprint;

        if (!coverage.coverageComplete) {
            throw new Error(
                "凭据覆盖率未达到 100%，禁止二进制检查"
            );
        }

        try {
            for (index = 0; index < rows.length; index += 1) {
                row = rows[index];
                plaintext = null;
                envelope = null;
                candidate = null;
                validation = null;
                candidateJson = null;

                plaintext = vault.getText(
                    row.recordKey,
                    CREDENTIAL_PURPOSE
                );
                if (plaintext === null) {
                    throw new Error(
                        "保险库密文记录不存在"
                    );
                }

                envelope = JSON.parse(plaintext);
                candidate = candidateFromEnvelope(
                    envelope,
                    row
                );
                validation = validateCandidate(candidate);
                if (!validation.supported ||
                        !validation.valid) {
                    throw new Error(
                        "候选配置结构门禁未通过：" +
                        String(row.protocol)
                    );
                }

                fingerprint = String(row.fingerprint || "");
                candidate.tag =
                    "node-s" + String(row.subscriptionId) +
                    "-" + fingerprint.substring(0, 16);
                candidate = pruneValue(candidate);
                collectSensitiveValues(
                    candidate,
                    sensitiveValues
                );

                candidateJson = JSON.stringify(candidate);
                digestParts.push(
                    fingerprint + ":" +
                    sha256Text(candidateJson)
                );
                typeCounts[candidate.type] = Number(
                    typeCounts[candidate.type] || 0
                ) + 1;
                candidates.push(candidate);
            }
        } finally {
            plaintext = null;
            envelope = null;
            candidate = null;
            validation = null;
            candidateJson = null;
            row = null;
            rows = [];
        }

        digestParts.sort();

        return {
            candidates: candidates,
            sensitiveValues: sensitiveValues,
            typeCounts: typeCounts,
            candidateSetSha256:
                sha256Text(digestParts.join("\n")),
            candidateCount: candidates.length
        };
    }

    function writeUtf8Sync(file, value) {
        var output = null;
        var bytes = new JavaString(
            String(value)
        ).getBytes("UTF-8");

        try {
            SBH.files.ensureDir(file.getParentFile());
            output = new FOS(file, false);
            output.write(bytes);
            output.flush();
            output.getFD().sync();
        } finally {
            closeQuietly(output);
        }
        return Number(bytes.length);
    }

    function bestEffortWipeDelete(file, byteCount) {
        var output = null;
        var buffer = ReflectArray.newInstance(
            JavaByte.TYPE,
            8192
        );
        var remaining = Math.max(0, Number(byteCount || 0));
        var count;
        var overwriteSucceeded = false;
        var deleted = false;

        try {
            if (file.exists() && remaining > 0) {
                output = new FOS(file, false);
                while (remaining > 0) {
                    count = Math.min(
                        remaining,
                        buffer.length
                    );
                    output.write(buffer, 0, count);
                    remaining -= count;
                }
                output.flush();
                try {
                    output.getFD().sync();
                } catch (ignoredSync) {}
                overwriteSucceeded = true;
            }
        } catch (ignoredOverwrite) {
            overwriteSucceeded = false;
        } finally {
            closeQuietly(output);
        }

        try {
            deleted = !file.exists() || file.delete();
        } catch (ignoredDelete) {
            deleted = false;
        }

        return {
            overwriteAttempted: byteCount > 0,
            overwriteSucceeded: overwriteSucceeded,
            deleted: deleted,
            secureEraseGuaranteed: false
        };
    }

    function readProcessOutputBounded(stream) {
        var output = new BAOS();
        var buffer = ReflectArray.newInstance(
            JavaByte.TYPE,
            8192
        );
        var count;
        var total = 0;

        try {
            while ((count = stream.read(buffer)) >= 0) {
                if (count <= 0) {
                    continue;
                }
                total += Number(count);
                if (total > MAX_BINARY_OUTPUT_BYTES) {
                    throw new Error(
                        "sing-box 检查输出超过限制"
                    );
                }
                output.write(buffer, 0, count);
            }
            return {
                text: String(
                    new JavaString(
                        output.toByteArray(),
                        "UTF-8"
                    )
                ),
                byteCount: total
            };
        } finally {
            closeQuietly(stream);
            closeQuietly(output);
        }
    }

    function replaceAllLiteral(value, needle, replacement) {
        return String(value).split(String(needle))
            .join(String(replacement));
    }

    function sanitizeBinaryOutput(
        value,
        tempPath,
        sensitiveValues
    ) {
        var output = String(value || "");
        var keys = [];
        var key;
        var index;

        output = replaceAllLiteral(
            output,
            tempPath,
            "<ephemeral-config>"
        );

        for (key in sensitiveValues) {
            if (Object.prototype.hasOwnProperty.call(
                    sensitiveValues,
                    key
                )) {
                keys.push(String(key));
            }
        }
        keys.sort(function (left, right) {
            return right.length - left.length;
        });

        for (index = 0; index < keys.length; index += 1) {
            output = replaceAllLiteral(
                output,
                keys[index],
                "<redacted>"
            );
        }

        output = output.replace(
            /[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}/g,
            "<redacted-uuid>"
        );
        return output.substring(0, 4000);
    }

    function runtimeBinary() {
        var root;

        if (typeof shortx === "undefined" ||
                shortx === null ||
                typeof shortx.getShortXDir !== "function") {
            throw new Error(
                "shortx.getShortXDir() 不可用"
            );
        }

        root = new File(
            String(shortx.getShortXDir()),
            "SingBoxHub"
        );
        return new File(
            new File(root, "bin"),
            "sing-box"
        );
    }

    function runBinaryCheck(binary, configFile) {
        var command = new ArrayList();
        var builder;
        var process = null;
        var finished;
        var output;
        var exitCode = null;
        var timedOut = false;

        command.add(binary.getAbsolutePath());
        command.add("check");
        command.add("-c");
        command.add(configFile.getAbsolutePath());

        builder = new P.java.lang.ProcessBuilder(command);
        builder.redirectErrorStream(true);
        builder.directory(configFile.getParentFile());

        try {
            process = builder.start();
            finished = process.waitFor(
                BINARY_CHECK_TIMEOUT_MS,
                TimeUnit.MILLISECONDS
            );
            if (!finished) {
                timedOut = true;
                try {
                    process.destroy();
                } catch (ignoredDestroy) {}
                try {
                    process.destroyForcibly();
                } catch (ignoredForce) {}
            } else {
                exitCode = Number(process.exitValue());
            }

            output = readProcessOutputBounded(
                process.getInputStream()
            );
            return {
                finished: finished,
                timedOut: timedOut,
                exitCode: exitCode,
                outputText: output.text,
                outputByteCount: output.byteCount
            };
        } finally {
            try {
                if (process !== null) {
                    closeQuietly(process.getInputStream());
                    closeQuietly(process.getErrorStream());
                    closeQuietly(process.getOutputStream());
                }
            } catch (ignoredStreams) {}
        }
    }

    function binaryCheck() {
        var startedAt = now();
        var built = buildCandidateSetForBinaryCheck();
        var config = {
            outbounds: built.candidates
        };
        var configText = JSON.stringify(config, null, 2) + "\n";
        var configSha256 = sha256Text(configText);
        var binary = runtimeBinary();
        var tempDir = new File(
            SBH.paths.cacheDir,
            EPHEMERAL_DIR_NAME
        );
        var tempFile = new File(
            tempDir,
            "candidate-" +
            String(SBH.util.randomToken()) +
            ".json"
        );
        var byteCount = 0;
        var processResult = null;
        var cleanup = null;
        var sanitizedDiagnostic = "";
        var checkPassed = false;

        if (!binary.isFile()) {
            throw new Error(
                "sing-box 二进制文件不存在"
            );
        }
        if (!binary.canExecute()) {
            throw new Error(
                "sing-box 二进制不可执行"
            );
        }

        SBH.files.ensureDir(tempDir);

        try {
            try {
                tempFile.setReadable(false, false);
                tempFile.setWritable(false, false);
                tempFile.setExecutable(false, false);
            } catch (ignoredModeClear) {}

            byteCount = writeUtf8Sync(
                tempFile,
                configText
            );

            try {
                tempFile.setReadable(true, true);
                tempFile.setWritable(true, true);
                tempFile.setExecutable(false, false);
            } catch (ignoredModeSet) {}

            processResult = runBinaryCheck(
                binary,
                tempFile
            );
            checkPassed =
                processResult.finished === true &&
                processResult.timedOut === false &&
                processResult.exitCode === 0;

            if (!checkPassed) {
                sanitizedDiagnostic = sanitizeBinaryOutput(
                    processResult.outputText,
                    tempFile.getAbsolutePath(),
                    built.sensitiveValues
                );
            }
        } finally {
            cleanup = bestEffortWipeDelete(
                tempFile,
                byteCount
            );
            try {
                if (tempDir.isDirectory()) {
                    tempDir.delete();
                }
            } catch (ignoredDirDelete) {}

            configText = null;
            config = null;
            built.candidates = [];
            built.sensitiveValues = {};
        }

        return {
            ok:
                checkPassed &&
                cleanup !== null &&
                cleanup.deleted === true,
            stage:
                "credential_stage44_ephemeral_binary_check",
            candidateCount:
                built.candidateCount,
            candidateTypeCounts:
                built.typeCounts,
            candidateSetSha256:
                built.candidateSetSha256,
            temporaryConfigSha256:
                configSha256,
            temporaryConfigByteCount:
                byteCount,
            temporaryConfigWritten:
                byteCount > 0,
            temporaryConfigLocation:
                "client_cache_ephemeral",
            temporaryConfigPathReturned:
                false,
            temporaryConfigPersisted:
                cleanup === null ||
                cleanup.deleted !== true,
            temporaryConfigOverwriteAttempted:
                cleanup !== null &&
                cleanup.overwriteAttempted,
            temporaryConfigOverwriteSucceeded:
                cleanup !== null &&
                cleanup.overwriteSucceeded,
            temporaryConfigDeleted:
                cleanup !== null &&
                cleanup.deleted,
            temporaryConfigSecureEraseGuaranteed:
                false,
            singBoxBinaryValidated: true,
            singBoxBinaryPathReturned: false,
            singBoxBinaryCheckInvoked: true,
            singBoxCheckFinished:
                processResult !== null &&
                processResult.finished,
            singBoxCheckTimedOut:
                processResult !== null &&
                processResult.timedOut,
            singBoxExitCode:
                processResult === null ?
                    null : processResult.exitCode,
            singBoxCheckPassed:
                checkPassed,
            singBoxOutputByteCount:
                processResult === null ?
                    0 : processResult.outputByteCount,
            singBoxOutputSha256:
                processResult === null ?
                    null :
                    sha256Text(processResult.outputText),
            sanitizedDiagnostic:
                checkPassed ?
                    null : sanitizedDiagnostic,
            candidateObjectsReturned: false,
            plaintextCredentialReturned: false,
            plaintextCredentialPersisted: false,
            productionConfigModified: false,
            runtimeFilesModified: false,
            configModified: false,
            coreStartInvoked: false,
            coreStopInvoked: false,
            tunCreated: false,
            routeModified: false,
            networkAccessed: false,
            destructiveOperations: false,
            durationMs: now() - startedAt,
            timestamp: now()
        };
    }

    function binaryCheckAsync(callback) {
        if (typeof callback !== "function") {
            throw new Error(
                "二进制检查回调不可用"
            );
        }

        new Thread(
            new JavaAdapter(Runnable, {
                run: function () {
                    var result;
                    try {
                        result = binaryCheck();
                    } catch (error) {
                        result = {
                            ok: false,
                            stage:
                                "credential_stage44_ephemeral_binary_check",
                            errorCode:
                                "EPHEMERAL_BINARY_CHECK_FAILED",
                            error:
                                errorText(error)
                                    .substring(0, 300),
                            temporaryConfigPathReturned: false,
                            temporaryConfigPersisted: false,
                            singBoxBinaryCheckInvoked: false,
                            candidateObjectsReturned: false,
                            plaintextCredentialReturned: false,
                            plaintextCredentialPersisted: false,
                            productionConfigModified: false,
                            runtimeFilesModified: false,
                            configModified: false,
                            coreStartInvoked: false,
                            coreStopInvoked: false,
                            tunCreated: false,
                            routeModified: false,
                            networkAccessed: false,
                            destructiveOperations: false,
                            timestamp: now()
                        };
                    }
                    postCallback(callback, result);
                }
            }),
            "SingBoxHub-EphemeralBinaryCheck"
        ).start();

        return {
            accepted: true,
            manualOnly: true,
            temporaryConfigOnly: true,
            productionConfigModified: false,
            coreStartEnabled: false
        };
    }

    function postCallback(callback, result) {
        SBH.handler.post(new JavaAdapter(Runnable, {
            run: function () {
                callback(result);
            }
        }));
    }

    function preflightAsync(callback) {
        if (typeof callback !== "function") {
            throw new Error(
                "候选配置预检回调不可用"
            );
        }

        new Thread(
            new JavaAdapter(Runnable, {
                run: function () {
                    var result;
                    try {
                        result = preflight();
                    } catch (error) {
                        result = {
                            ok: false,
                            stage:
                                "credential_stage43_candidate_config_preflight",
                            error:
                                errorText(error)
                                    .substring(0, 500),
                            candidateObjectsReturned: false,
                            candidateConfigPersisted: false,
                            plaintextCredentialReturned: false,
                            plaintextCredentialPersisted: false,
                            preflightOnly: true,
                            singBoxBinaryCheckInvoked: false,
                            runtimeUsable: false,
                            networkAccessed: false,
                            clientDatabaseModified: false,
                            runtimeFilesModified: false,
                            configModified: false,
                            coreStartInvoked: false,
                            tunCreated: false,
                            routeModified: false,
                            destructiveOperations: false,
                            timestamp: now()
                        };
                    }
                    postCallback(callback, result);
                }
            }),
            "SingBoxHub-CandidateConfigPreflight"
        ).start();

        return {
            accepted: true,
            manualOnly: true,
            preflightOnly: true,
            plaintextReturned: false,
            configPersisted: false,
            runtimeWriteEnabled: false
        };
    }

    if (!vault ||
            typeof vault.getText !== "function") {
        throw new Error(
            "Credential vault unavailable"
        );
    }
    if (!coverageAudit ||
            typeof coverageAudit.audit !== "function") {
        throw new Error(
            "Credential coverage audit unavailable"
        );
    }

    SBH.candidateConfigPreflight = {
        version: 2,
        preflightAsync: preflightAsync,
        binaryCheckAsync: binaryCheckAsync,
        manualOnly: true,
        preflightOnly: true,
        candidateConfigPersisted: false,
        plaintextCredentialReturned: false,
        runtimeWriteEnabled: false
    };

    if (typeof originalStart !== "function") {
        throw new Error("Original app.start unavailable");
    }

    SBH.app.start = function () {
        var output = originalStart();

        output.candidateConfigPreflightVersion = 2;
        output.candidateConfigPreflightReady = true;
        output.candidateConfigPreflightManualOnly = true;
        output.candidateConfigPreflightOnly = true;
        output.candidateConfigPreflightMaxRecords =
            MAX_RECORDS;
        output.candidateConfigPreflightPlaintextReturned =
            false;
        output.candidateConfigPreflightConfigPersisted =
            false;
        output.candidateConfigPreflightBinaryCheckInvoked =
            false;
        output.candidateBinaryCheckReady = true;
        output.candidateBinaryCheckManualOnly = true;
        output.candidateBinaryCheckTemporaryConfigOnly = true;
        output.candidateBinaryCheckTimeoutMs =
            BINARY_CHECK_TIMEOUT_MS;
        output.candidateBinaryCheckProductionConfigModified =
            false;
        output.candidateConfigPreflightRuntimeUsable =
            false;
        output.subscriptionRuntimeConfigModified = false;
        output.subscriptionCoreInvoked = false;
        output.subscriptionTunCreated = false;
        output.subscriptionRouteModified = false;
        output.writeOperationsLocked = true;
        output.destructiveOperations = false;
        return output;
    };
}());
