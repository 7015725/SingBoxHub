/* SingBoxHub Stage44 Retry3 root-shell-only binary check. Rhino ES5 only. */
SBH.versions.rootShellOnlyBinaryCheck = 1;

(function () {
    "use strict";

    var P = Packages;
    var File = P.java.io.File;
    var FOS = P.java.io.FileOutputStream;
    var JavaString = P.java.lang.String;
    var URI = P.java.net.URI;
    var URLDecoder = P.java.net.URLDecoder;
    var MessageDigest = P.java.security.MessageDigest;
    var Thread = P.java.lang.Thread;
    var Runnable = P.java.lang.Runnable;
    var ReflectArray = P.java.lang.reflect.Array;
    var JavaByte = P.java.lang.Byte;
    var ShellCommand =
        P.tornaco.apps.shortx.core.proto.action.ShellCommand;

    var vault = SBH.credentialVault;
    var coverageAudit = SBH.credentialCoverageAudit;
    var service = SBH.candidateConfigPreflight;
    var originalStart = SBH.app.start;

    var CREDENTIAL_PURPOSE =
        "subscription_node_credential_v1";
    var TEMP_DIR_NAME = "ephemeral-root-shell-only";
    var MAX_RECORDS = 2000;
    var MAX_OUTPUT_CHARS = 4000;
    var CHECK_TIMEOUT_SECONDS = 30;

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

    function decode(value) {
        try {
            return String(
                URLDecoder.decode(String(value || ""), "UTF-8")
            );
        } catch (ignored) {
            return String(value || "");
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

    function sha256Text(value) {
        var digest = MessageDigest.getInstance("SHA-256");
        return hex(digest.digest(
            new JavaString(String(value)).getBytes("UTF-8")
        ));
    }

    function numberOrNull(value) {
        var parsed = Number(value);
        return isFinite(parsed) && parsed > 0 ?
            Math.floor(parsed) : null;
    }

    function bool(value) {
        var normalized = lower(value);
        return value === true ||
            normalized === "true" ||
            normalized === "1" ||
            normalized === "yes";
    }

    function normalizeType(value) {
        var type = lower(value);
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
            key = lower(decode(
                position >= 0 ?
                    item.substring(0, position) : item
            ));
            value = decode(
                position >= 0 ?
                    item.substring(position + 1) : ""
            );
            if (key) {
                output[key] = value;
            }
        }
        return output;
    }

    function splitUserInfo(value) {
        var raw = decode(value || "");
        var position = raw.indexOf(":");
        return {
            first: position >= 0 ?
                raw.substring(0, position) : raw,
            second: position >= 0 ?
                raw.substring(position + 1) : ""
        };
    }

    function stableTag(row) {
        return "node-s" + String(row.subscriptionId) + "-" +
            String(row.fingerprint).substring(0, 16);
    }

    function tlsObject(query, forceEnabled) {
        var security = lower(query.security || query.tls || "");
        var enabled = forceEnabled === true ||
            security === "tls" ||
            security === "reality" ||
            bool(query.tls);
        var tls;

        if (!enabled) {
            return null;
        }

        tls = { enabled: true };
        if (query.sni || query.servername || query.server_name) {
            tls.server_name = String(
                query.sni || query.servername || query.server_name
            );
        }
        if (bool(
                query.insecure ||
                query.allowinsecure ||
                query.skipcertverify ||
                query["skip-cert-verify"]
            )) {
            tls.insecure = true;
        }
        if (query.alpn) {
            tls.alpn = String(query.alpn).split(",");
        }
        if (security === "reality" ||
                query.pbk ||
                query.publickey) {
            tls.reality = { enabled: true };
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

    function transportObject(query, fallback) {
        var type = lower(
            query.type || query.network || fallback || ""
        );
        var transport;

        if (!type || type === "tcp") {
            return null;
        }
        if (type === "ws" || type === "websocket") {
            transport = { type: "ws" };
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
            transport = { type: "grpc" };
            if (query.servicename || query.service_name) {
                transport.service_name = String(
                    query.servicename || query.service_name
                );
            }
            return transport;
        }
        if (type === "http" || type === "h2") {
            transport = { type: "http" };
            if (query.path) {
                transport.path = String(query.path);
            }
            if (query.host) {
                transport.host = [String(query.host)];
            }
            return transport;
        }
        if (type === "httpupgrade") {
            transport = { type: "httpupgrade" };
            if (query.path) {
                transport.path = String(query.path);
            }
            if (query.host) {
                transport.host = String(query.host);
            }
            return transport;
        }
        return { type: type };
    }

    function fromGenericUri(uriText, row) {
        var uri = new URI(trim(uriText));
        var type = normalizeType(uri.getScheme());
        var query = queryMap(uri);
        var user = splitUserInfo(uri.getRawUserInfo());
        var candidate = {
            type: type,
            tag: stableTag(row),
            server: trim(uri.getHost() || row.server),
            server_port: numberOrNull(
                uri.getPort() >= 0 ?
                    uri.getPort() : row.port
            )
        };
        var tls;
        var transport;

        if (type === "vless") {
            candidate.uuid = String(user.first);
            if (query.flow) {
                candidate.flow = String(query.flow);
            }
            tls = tlsObject(query, false);
            transport = transportObject(
                query,
                row.transport
            );
            if (tls !== null) {
                candidate.tls = tls;
            }
            if (transport !== null) {
                candidate.transport = transport;
            }
            return candidate;
        }

        if (type === "hysteria2") {
            candidate.password = String(
                user.first ||
                query.password ||
                query.auth ||
                ""
            );
            candidate.tls = tlsObject(query, true);
            if (query.obfs) {
                candidate.obfs = {
                    type: String(query.obfs),
                    password: String(
                        query["obfs-password"] ||
                        query.obfspassword ||
                        ""
                    )
                };
            }
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
            return candidate;
        }

        throw new Error("UNSUPPORTED_PROTOCOL");
    }

    function fromClashProxy(proxy, row) {
        var type = normalizeType(
            proxy.type || row.protocol
        );
        var query = {};
        var candidate = {
            type: type,
            tag: stableTag(row),
            server: trim(proxy.server || row.server),
            server_port: numberOrNull(
                proxy.port || row.port
            )
        };
        var tls;
        var transport;

        query.security = proxy.security ||
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

        if (type === "vless") {
            candidate.uuid = String(proxy.uuid || "");
            if (proxy.flow) {
                candidate.flow = String(proxy.flow);
            }
            tls = tlsObject(query, false);
            transport = transportObject(
                query,
                row.transport
            );
            if (tls !== null) {
                candidate.tls = tls;
            }
            if (transport !== null) {
                candidate.transport = transport;
            }
            return candidate;
        }

        if (type === "hysteria2") {
            candidate.password = String(
                proxy.password ||
                proxy.auth ||
                ""
            );
            candidate.tls = tlsObject(query, true);
            if (proxy.obfs) {
                candidate.obfs = {
                    type: String(proxy.obfs),
                    password: String(
                        proxy["obfs-password"] ||
                        proxy.obfs_password ||
                        ""
                    )
                };
            }
            return candidate;
        }

        throw new Error("UNSUPPORTED_PROTOCOL");
    }

    function candidateFromEnvelope(envelope, row) {
        var format = lower(envelope.format);
        var payload = envelope.payload || {};
        var candidate;

        if (format === "generic_uri") {
            return fromGenericUri(payload.uri, row);
        }
        if (format === "clash_proxy") {
            return fromClashProxy(
                payload.proxy || {},
                row
            );
        }
        if (format === "singbox_outbound") {
            candidate = JSON.parse(JSON.stringify(
                payload.outbound || {}
            ));
            candidate.tag = stableTag(row);
            return candidate;
        }
        throw new Error("UNSUPPORTED_SOURCE_FORMAT");
    }

    function validateCandidate(candidate) {
        var type = normalizeType(candidate.type);

        if (type !== "vless" &&
                type !== "hysteria2") {
            throw new Error("UNSUPPORTED_PROTOCOL");
        }
        if (!trim(candidate.server) ||
                numberOrNull(candidate.server_port) === null) {
            throw new Error("SERVER_OR_PORT_MISSING");
        }
        if (type === "vless" &&
                !trim(candidate.uuid)) {
            throw new Error("UUID_MISSING");
        }
        if (type === "hysteria2" &&
                !trim(candidate.password)) {
            throw new Error("PASSWORD_MISSING");
        }
        candidate.type = type;
        return candidate;
    }

    function loadRows() {
        var cursor = null;
        var rows = [];

        try {
            cursor = SBH.database.open().rawQuery(
                "SELECT n.subscription_id,n.fingerprint," +
                "n.protocol,n.server,n.port,n.transport," +
                "c.record_key,c.source_format " +
                "FROM subscription_nodes n " +
                "JOIN subscription_node_credentials c " +
                "ON c.subscription_id=n.subscription_id " +
                "AND c.fingerprint=n.fingerprint " +
                "ORDER BY n.subscription_id,n.protocol,n.name " +
                "LIMIT " + String(MAX_RECORDS),
                []
            );
            while (cursor.moveToNext()) {
                rows.push({
                    subscriptionId:
                        Number(cursor.getLong(0)),
                    fingerprint:
                        String(cursor.getString(1) || ""),
                    protocol:
                        String(cursor.getString(2) || ""),
                    server:
                        String(cursor.getString(3) || ""),
                    port: cursor.isNull(4) ?
                        null : Number(cursor.getLong(4)),
                    transport:
                        String(cursor.getString(5) || ""),
                    recordKey:
                        String(cursor.getString(6) || ""),
                    sourceFormat:
                        String(cursor.getString(7) || "")
                });
            }
            return rows;
        } finally {
            closeQuietly(cursor);
        }
    }

    function addSensitive(map, value) {
        var item = trim(value);
        if (item.length >= 4) {
            map[item] = true;
        }
    }

    function collectSensitive(
        map,
        candidate,
        envelope
    ) {
        addSensitive(map, candidate.server);
        addSensitive(map, candidate.uuid);
        addSensitive(map, candidate.password);
        try {
            if (candidate.tls) {
                addSensitive(
                    map,
                    candidate.tls.server_name
                );
                if (candidate.tls.reality) {
                    addSensitive(
                        map,
                        candidate.tls.reality.public_key
                    );
                    addSensitive(
                        map,
                        candidate.tls.reality.short_id
                    );
                }
            }
            if (candidate.obfs) {
                addSensitive(
                    map,
                    candidate.obfs.password
                );
            }
            if (envelope && envelope.payload) {
                addSensitive(
                    map,
                    envelope.payload.uri
                );
            }
        } catch (ignored) {}
    }

    function buildConfig() {
        var coverage = coverageAudit.audit();
        var rows = loadRows();
        var candidates = [];
        var sensitive = {};
        var typeCounts = {};
        var digestParts = [];
        var index;
        var row;
        var plaintext = null;
        var envelope = null;
        var candidate = null;
        var candidateJson = null;

        if (!coverage.coverageComplete) {
            throw new Error("COVERAGE_NOT_COMPLETE");
        }
        if (rows.length !== coverage.totalNodeCount) {
            throw new Error("NODE_LINK_COUNT_MISMATCH");
        }

        try {
            for (
                index = 0;
                index < rows.length;
                index += 1
            ) {
                row = rows[index];
                plaintext = vault.getText(
                    row.recordKey,
                    CREDENTIAL_PURPOSE
                );
                if (plaintext === null) {
                    throw new Error(
                        "VAULT_RECORD_MISSING"
                    );
                }

                envelope = JSON.parse(plaintext);
                candidate = validateCandidate(
                    candidateFromEnvelope(
                        envelope,
                        row
                    )
                );
                collectSensitive(
                    sensitive,
                    candidate,
                    envelope
                );

                candidateJson = JSON.stringify(candidate);
                digestParts.push(
                    row.fingerprint + ":" +
                    sha256Text(candidateJson)
                );
                typeCounts[candidate.type] = Number(
                    typeCounts[candidate.type] || 0
                ) + 1;
                candidates.push(candidate);

                plaintext = null;
                envelope = null;
                candidate = null;
                candidateJson = null;
            }
        } finally {
            plaintext = null;
            envelope = null;
            candidate = null;
            candidateJson = null;
            row = null;
            rows = [];
        }

        digestParts.sort();
        return {
            config: {
                outbounds: candidates
            },
            candidateCount: candidates.length,
            typeCounts: typeCounts,
            sensitive: sensitive,
            candidateSetSha256:
                sha256Text(digestParts.join("\n"))
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

    function wipeDelete(file, byteCount) {
        var output = null;
        var zeros = ReflectArray.newInstance(
            JavaByte.TYPE,
            8192
        );
        var remaining = Number(byteCount || 0);
        var count;
        var overwriteSucceeded = false;
        var deleted = false;

        try {
            if (file.exists() && remaining > 0) {
                output = new FOS(file, false);
                while (remaining > 0) {
                    count = Math.min(
                        remaining,
                        zeros.length
                    );
                    output.write(zeros, 0, count);
                    remaining -= count;
                }
                output.flush();
                output.getFD().sync();
                overwriteSucceeded = true;
            }
        } catch (ignoredOverwrite) {
            overwriteSucceeded = false;
        } finally {
            closeQuietly(output);
        }

        try {
            deleted = !file.exists() ||
                file.delete();
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

    function shellQuote(value) {
        return "'" + String(value)
            .replace(/'/g, "'\\''") + "'";
    }

    function readContext(data, key) {
        var value = data.get(String(key));
        return value === null ||
            value === undefined ?
            "" : String(value);
    }

    function parseMarker(value, name) {
        var expression = new RegExp(
            "(?:^|\\n)__SBH_" + name +
            "__=([0-9]+)(?:\\n|$)"
        );
        var match = String(value || "")
            .match(expression);
        return match ? Number(match[1]) : null;
    }

    function stripMarkers(value) {
        return String(value || "")
            .replace(
                /(?:^|\n)__SBH_[A-Z_]+__=[0-9]+(?:\n|$)/g,
                "\n"
            )
            .replace(/^\s+|\s+$/g, "");
    }

    function runShell(binaryPath, configPath) {
        var binaryQuoted = shellQuote(binaryPath);
        var configQuoted = shellQuote(configPath);
        var command = [
            "umask 077",
            "printf '__SBH_UID__=%s\\n' " +
                "\"$(id -u 2>/dev/null)\"",
            "if [ -f " + binaryQuoted +
                " ]; then " +
                "printf '__SBH_BINARY_EXISTS__=1\\n'; " +
                "else " +
                "printf '__SBH_BINARY_EXISTS__=0\\n'; " +
                "exit 127; fi",
            "if [ -x " + binaryQuoted +
                " ]; then " +
                "printf '__SBH_BINARY_EXECUTABLE__=1\\n'; " +
                "else " +
                "printf '__SBH_BINARY_EXECUTABLE__=0\\n'; " +
                "exit 126; fi",
            "if [ -r " + configQuoted +
                " ]; then " +
                "printf '__SBH_CONFIG_READABLE__=1\\n'; " +
                "else " +
                "printf '__SBH_CONFIG_READABLE__=0\\n'; " +
                "exit 125; fi",
            "if command -v timeout >/dev/null 2>&1; " +
                "then " +
                "printf '__SBH_TIMEOUT_TOOL__=1\\n'; " +
                "timeout " +
                String(CHECK_TIMEOUT_SECONDS) +
                "s " + binaryQuoted +
                " check -c " + configQuoted +
                "; else " +
                "printf '__SBH_TIMEOUT_TOOL__=0\\n'; " +
                binaryQuoted +
                " check -c " + configQuoted +
                "; fi"
        ].join("; ");

        var action = ShellCommand.newBuilder()
            .setCommand(command)
            .setSingleShot(true)
            .setId(
                "SingBoxHub#Stage44Retry3#" +
                String(SBH.util.randomToken())
            )
            .build();
        var result = shortx.executeAction(action);
        var data = result.contextData;
        var stdout = readContext(data, "shellOut");
        var stderr = readContext(data, "shellErr");
        var combined = stdout +
            (stderr ? "\n" + stderr : "");

        return {
            code: Number(data.get("shellCode")),
            uid: parseMarker(combined, "UID"),
            binaryExists:
                parseMarker(
                    combined,
                    "BINARY_EXISTS"
                ) === 1,
            binaryExecutable:
                parseMarker(
                    combined,
                    "BINARY_EXECUTABLE"
                ) === 1,
            configReadable:
                parseMarker(
                    combined,
                    "CONFIG_READABLE"
                ) === 1,
            timeoutToolUsed:
                parseMarker(
                    combined,
                    "TIMEOUT_TOOL"
                ) === 1,
            output: stripMarkers(combined)
        };
    }

    function replaceLiteral(
        value,
        needle,
        replacement
    ) {
        return String(value)
            .split(String(needle))
            .join(String(replacement));
    }

    function sanitize(
        value,
        tempPath,
        sensitive
    ) {
        var output = replaceLiteral(
            String(value || ""),
            tempPath,
            "<ephemeral-config>"
        );
        var keys = [];
        var key;
        var index;

        for (key in sensitive) {
            if (Object.prototype.hasOwnProperty.call(
                    sensitive,
                    key
                )) {
                keys.push(String(key));
            }
        }
        keys.sort(function (left, right) {
            return right.length - left.length;
        });
        for (
            index = 0;
            index < keys.length;
            index += 1
        ) {
            output = replaceLiteral(
                output,
                keys[index],
                "<redacted>"
            );
        }
        output = output.replace(
            /[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}/g,
            "<redacted-uuid>"
        );
        return output.substring(
            0,
            MAX_OUTPUT_CHARS
        );
    }

    function runtimeBinaryPath() {
        if (typeof shortx === "undefined" ||
                shortx === null ||
                typeof shortx.getShortXDir !== "function") {
            throw new Error(
                "SHORTX_ROOT_UNAVAILABLE"
            );
        }
        return String(shortx.getShortXDir()) +
            "/SingBoxHub/bin/sing-box";
    }

    function executeCheck() {
        var startedAt = now();
        var built = null;
        var configText = null;
        var configSha256 = null;
        var binaryPath = null;
        var tempDir = new File(
            SBH.paths.cacheDir,
            TEMP_DIR_NAME
        );
        var tempFile = new File(
            tempDir,
            "candidate-" +
            String(SBH.util.randomToken()) +
            ".json"
        );
        var byteCount = 0;
        var shellResult = null;
        var cleanup = null;
        var failureStep = "build_candidates";
        var caught = false;
        var passed = false;
        var diagnostic = null;

        try {
            built = buildConfig();
            configText = JSON.stringify(
                built.config,
                null,
                2
            ) + "\n";
            configSha256 = sha256Text(configText);
            binaryPath = runtimeBinaryPath();

            failureStep = "write_temporary_config";
            SBH.files.ensureDir(tempDir);
            byteCount = writeUtf8Sync(
                tempFile,
                configText
            );
            try {
                tempFile.setReadable(true, true);
                tempFile.setWritable(true, true);
                tempFile.setExecutable(false, false);
            } catch (ignoredMode) {}

            failureStep = "execute_shortx_shell";
            shellResult = runShell(
                binaryPath,
                tempFile.getAbsolutePath()
            );
            passed = shellResult.code === 0;
            if (!passed) {
                diagnostic = sanitize(
                    shellResult.output,
                    tempFile.getAbsolutePath(),
                    built.sensitive
                );
            }
        } catch (ignoredError) {
            caught = true;
        } finally {
            cleanup = wipeDelete(
                tempFile,
                byteCount
            );
            try {
                if (tempDir.isDirectory()) {
                    tempDir.delete();
                }
            } catch (ignoredDir) {}

            configText = null;
            binaryPath = null;
            if (built !== null) {
                built.config = null;
                built.sensitive = {};
            }
        }

        if (caught) {
            return {
                ok: false,
                stage:
                    "credential_stage44_retry3_root_shell_only",
                errorCode:
                    "ROOT_SHELL_ONLY_CHECK_FAILED",
                failureStep: failureStep,
                errorDetailReturned: false,
                executionTransport:
                    "shortx_shell_action",
                shortxExecuteActionUsed:
                    failureStep ===
                    "execute_shortx_shell",
                javaBinaryPrecheckUsed: false,
                permissionBridgeUsed: false,
                javaProcessBuilderUsed: false,
                temporaryConfigWritten:
                    byteCount > 0,
                temporaryConfigPathReturned: false,
                temporaryConfigPersisted:
                    cleanup === null ||
                    cleanup.deleted !== true,
                temporaryConfigDeleted:
                    cleanup !== null &&
                    cleanup.deleted,
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

        return {
            ok:
                passed &&
                cleanup !== null &&
                cleanup.deleted === true,
            stage:
                "credential_stage44_retry3_root_shell_only",
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
            temporaryConfigPathReturned: false,
            temporaryConfigPersisted:
                cleanup.deleted !== true,
            temporaryConfigOverwriteAttempted:
                cleanup.overwriteAttempted,
            temporaryConfigOverwriteSucceeded:
                cleanup.overwriteSucceeded,
            temporaryConfigDeleted:
                cleanup.deleted,
            temporaryConfigSecureEraseGuaranteed:
                false,
            executionTransport:
                "shortx_shell_action",
            shortxExecuteActionUsed: true,
            javaBinaryPrecheckUsed: false,
            permissionBridgeUsed: false,
            javaProcessBuilderUsed: false,
            shellUid:
                shellResult.uid,
            shellBinaryExists:
                shellResult.binaryExists,
            shellBinaryExecutable:
                shellResult.binaryExecutable,
            shellConfigReadable:
                shellResult.configReadable,
            timeoutToolUsed:
                shellResult.timeoutToolUsed,
            singBoxBinaryCheckInvoked:
                shellResult.binaryExists &&
                shellResult.binaryExecutable &&
                shellResult.configReadable,
            singBoxCheckTimedOut:
                shellResult.code === 124,
            singBoxExitCode:
                shellResult.code,
            singBoxCheckPassed:
                passed,
            singBoxOutputSha256:
                sha256Text(shellResult.output),
            sanitizedDiagnostic:
                passed ? null : diagnostic,
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
            durationMs:
                now() - startedAt,
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

    function binaryCheckAsync(callback) {
        if (typeof callback !== "function") {
            throw new Error(
                "二进制检查回调不可用"
            );
        }

        new Thread(
            new JavaAdapter(Runnable, {
                run: function () {
                    postCallback(
                        callback,
                        executeCheck()
                    );
                }
            }),
            "SingBoxHub-RootShellOnlyCheck"
        ).start();

        return {
            accepted: true,
            manualOnly: true,
            executionTransport:
                "shortx_shell_action",
            javaBinaryPrecheckUsed: false,
            permissionBridgeUsed: false,
            javaProcessBuilderUsed: false,
            temporaryConfigOnly: true,
            productionConfigModified: false,
            coreStartEnabled: false
        };
    }

    if (!vault || !coverageAudit || !service) {
        throw new Error(
            "Stage44 Retry3 dependencies unavailable"
        );
    }

    service.binaryCheckAsync = binaryCheckAsync;
    service.executionTransport =
        "shortx_shell_action";
    service.javaBinaryPrecheckUsed = false;
    service.permissionBridgeUsed = false;
    service.javaProcessBuilderUsed = false;

    if (typeof originalStart !== "function") {
        throw new Error(
            "Original app.start unavailable"
        );
    }

    SBH.app.start = function () {
        var output = originalStart();

        output.rootShellOnlyBinaryCheckVersion = 1;
        output.rootShellOnlyBinaryCheckReady = true;
        output.candidateConfigPreflightVersion = 4;
        output.candidateBinaryCheckTransport =
            "shortx_shell_action";
        output.candidateBinaryCheckShortxExecuteActionUsed =
            true;
        output.candidateBinaryCheckJavaBinaryPrecheckUsed =
            false;
        output.candidateBinaryCheckPermissionBridgeUsed =
            false;
        output.candidateBinaryCheckJavaProcessBuilderUsed =
            false;
        output.ephemeralBinaryCheckOuterErrorReturned =
            false;
        output.ephemeralBinaryCheckSanitizedDiagnosticOnly =
            true;
        output.ephemeralBinaryCheckProductionConfigModified =
            false;
        output.writeOperationsLocked = true;
        output.destructiveOperations = false;
        return output;
    };
}());
