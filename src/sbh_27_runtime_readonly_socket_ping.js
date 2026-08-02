/* SingBoxHub stage27 retry3: shell-built-in PID identity parsing and one-shot read-only PING. Rhino ES5 only. */
SBH.versions.runtimeReadonlySocketPing = 4;

(function () {
    var P = Packages;
    var File = P.java.io.File;
    var LocalSocket = P.android.net.LocalSocket;
    var LocalSocketAddress = P.android.net.LocalSocketAddress;
    var BufferedWriter = P.java.io.BufferedWriter;
    var OutputStreamWriter = P.java.io.OutputStreamWriter;
    var BufferedReader = P.java.io.BufferedReader;
    var InputStreamReader = P.java.io.InputStreamReader;
    var SecureRandom = P.java.security.SecureRandom;
    var ReflectArray = P.java.lang.reflect.Array;
    var JavaByte = P.java.lang.Byte;
    var JavaString = P.java.lang.String;
    var Base64 = P.android.util.Base64;
    var ShellCommand =
        P.tornaco.apps.shortx.core.proto.action.ShellCommand;

    var AUTHORIZATION_ID =
        "stage27-retry3-user-authorized-20260802";
    var SCHEMA_VERSION = 4;
    var MAX_ENDPOINT_BYTES = 65536;
    var ENDPOINT_PROBE_MAX_AGE_MS = 120000;
    var CONNECT_TIMEOUT_MS = 1500;
    var READ_TIMEOUT_MS = 2000;
    var TOTAL_BUDGET_MS = 15000;
    var cacheFile = new File(
        SBH.paths.cacheDir,
        "runtime_readonly_socket_ping.json"
    );
    var cached = SBH.files.readJson(cacheFile, null);

    function now() {
        return Number(SBH.util.now());
    }

    function closeQuietly(value) {
        try {
            if (value !== null && value !== undefined) {
                value.close();
                return true;
            }
        } catch (ignored) {}
        return false;
    }

    function shellQuote(value) {
        return "'" + String(value).replace(/'/g, "'\\''") + "'";
    }

    function contextValue(data, key) {
        var value = data.get(String(key));
        return value === null || value === undefined ?
            "" : String(value);
    }

    /*
     * Follows the verified ShortX ShellCommand contract:
     * ShellCommand.newBuilder(), setCommand(), setSingleShot(true),
     * setId(), shortx.executeAction(), then contextData shellOut,
     * shellErr and shellCode.
     */
    function executeShell(command, id) {
        var action = ShellCommand.newBuilder()
            .setCommand(String(command))
            .setSingleShot(true)
            .setId(String(id))
            .build();
        var result = shortx.executeAction(action);
        var data;

        if (result === null || result === undefined) {
            throw new Error("SHORTX_SHELL_RESULT_NULL");
        }
        data = result.contextData;
        if (data === null || data === undefined) {
            throw new Error("SHORTX_SHELL_CONTEXT_UNAVAILABLE");
        }
        return {
            out: contextValue(data, "shellOut"),
            err: contextValue(data, "shellErr"),
            code: Number(data.get("shellCode"))
        };
    }

    function parseMap(text) {
        var output = {};
        var lines = String(text || "").split(/\r?\n/);
        var i;
        var fields;
        for (i = 0; i < lines.length; i += 1) {
            fields = lines[i].split("\t");
            if (fields.length >= 2) {
                output[String(fields[0])] =
                    String(fields.slice(1).join("\t"));
            }
        }
        return output;
    }

    function blank(state) {
        return {
            schemaVersion: SCHEMA_VERSION,
            state: state || "not_started",
            authorizationId: AUTHORIZATION_ID,
            authorizationConsumed: false,
            automaticExecution: true,
            automaticRetryAllowed: false,
            reusedCachedResult: false,
            source: "stage27_retry3",
            commandAllowlist: ["PING"],
            command: "PING",

            endpointProbeAvailable: false,
            endpointProbeRefreshed: false,
            endpointProbeSource: null,
            endpointProbeAgeMs: null,
            endpointRefreshElapsedMs: null,
            endpointProbeShellExitCode: null,
            endpointProbeShellErrorPresent: false,

            endpointFileExists: false,
            endpointFileCanonical: false,
            endpointModeValidated: false,
            endpointSchemaValidated: false,
            endpointOwnerValidated: false,
            endpointIdentityStable: false,
            endpointContractReady: false,
            endpointIdentity: null,

            runtimeProcessIdentityChecked: false,
            runtimeProcessExists: false,
            runtimeProcessIdentityValidated: false,
            runtimeProcessIdentity: null,
            runtimeCommandIdentityChecked: false,
            runtimeCommandIdentityValidated: false,
            runtimeCommandIdentityBasis: null,
            processIdentityParseMethod:
                "android_sh_builtin_read_case",
            processIdentityElapsedMs: null,
            processIdentityShellExitCode: null,
            processIdentityShellErrorPresent: false,

            endpointValueRead: false,
            tokenValueRead: false,
            tokenValueUsed: false,
            tokenValueExposed: false,
            socketNameValueRead: false,
            socketNameValueUsed: false,
            socketNameValueExposed: false,
            correlationGenerated: false,
            correlationLength: 0,
            correlationExposed: false,

            requestConstructedInMemory: false,
            requestSerialized: false,
            requestSent: false,
            requestCount: 0,
            responseRead: false,
            responseLineCount: 0,
            responseStatus: null,
            responseStatusMatched: false,
            correlationMatched: false,

            socketConnectionAttempted: false,
            socketConnected: false,
            socketClosed: false,
            connectTimeoutMs: CONNECT_TIMEOUT_MS,
            readTimeoutMs: READ_TIMEOUT_MS,
            totalBudgetMs: TOTAL_BUDGET_MS,
            attemptStartedAt: 0,
            attemptCompletedAt: 0,
            connectElapsedMs: null,
            totalElapsedMs: null,

            sensitiveReferencesCleared: false,
            adapterImplementationAllowed: false,
            adapterInvocationEnabled: false,
            readOnlyStatusAdapterReady: false,
            coreStartInvoked: false,
            coreStopInvoked: false,
            runtimeStopInvoked: false,
            unknownCommandInvoked: false,
            coreClientMainInvoked: false,
            markerFileCreated: false,
            runtimeFilesModified: false,
            writeOperationsLocked: true,
            destructiveOperations: false,
            safeFailure: true,
            errorCode: null,
            error: null,
            checkedAt: now()
        };
    }

    function endpointFile() {
        if (typeof shortx === "undefined" || shortx === null ||
                typeof shortx.getShortXDir !== "function") {
            throw new Error("SHORTX_DIR_UNAVAILABLE");
        }
        return new File(
            new File(String(shortx.getShortXDir()), "SingBoxHub"),
            "runtime/control/control_endpoint.json"
        );
    }

    function expectedEndpointPath() {
        return String(endpointFile().getCanonicalPath());
    }

    function probeAgeMs(probe) {
        var capturedAt = Number(
            probe && probe.capturedAt ? probe.capturedAt : 0
        );
        var shellNow = Number(probe && probe.now ? probe.now : 0);
        if (capturedAt > 0) {
            return Math.max(0, now() - capturedAt);
        }
        if (shellNow > 0) {
            return Math.max(
                0,
                (Math.floor(now() / 1000) - shellNow) * 1000
            );
        }
        return null;
    }

    function currentEndpointProbe() {
        try {
            if (SBH.runtime &&
                    typeof SBH.runtime.endpointProbe === "function") {
                return SBH.runtime.endpointProbe();
            }
        } catch (ignored) {}
        return null;
    }

    function probeUsable(probe) {
        var age;
        if (!probe || probe.exists !== true ||
                probe.error || !probe.data) {
            return false;
        }
        age = probeAgeMs(probe);
        return age === null ||
            age <= ENDPOINT_PROBE_MAX_AGE_MS;
    }

    function buildEndpointProbeCommand() {
        var lines = [
            "T=/system/bin/toybox",
            "printf 'su\\t%s\\n' \"$($T id -u)\"",
            "E=" + shellQuote(expectedEndpointPath()),
            "if [ -f \"$E\" ]; then",
            "  printf 'x\\t1\\n'",
            "  printf 'u\\t%s\\n' \"$($T stat -c '%u' \"$E\")\"",
            "  printf 'g\\t%s\\n' \"$($T stat -c '%g' \"$E\")\"",
            "  printf 'm\\t%s\\n' \"$($T stat -c '%a' \"$E\")\"",
            "  printf 's\\t%s\\n' \"$($T stat -c '%s' \"$E\")\"",
            "  printf 't\\t%s\\n' \"$($T stat -c '%Y' \"$E\")\"",
            "  printf 'r\\t%s\\n' \"$($T readlink -f \"$E\")\"",
            "  SIZE_VALUE=\"$($T stat -c '%s' \"$E\")\"",
            "  if [ -n \"$SIZE_VALUE\" ] && " +
                "[ \"$SIZE_VALUE\" -gt 0 ] && " +
                "[ \"$SIZE_VALUE\" -le " +
                MAX_ENDPOINT_BYTES + " ]; then",
            "    DATA_VALUE=\"$($T base64 \"$E\" 2>/dev/null | " +
                "$T tr -d '\\r\\n')\"",
            "    printf 'd\\t%s\\n' \"$DATA_VALUE\"",
            "  fi",
            "else",
            "  printf 'x\\t0\\n'",
            "fi",
            "printf 'n\\t%s\\n' \"$($T date +%s)\""
        ];
        return "/system/bin/toybox timeout 5 /system/bin/sh -c " +
            shellQuote(lines.join("\n"));
    }

    function refreshEndpointProbe(output) {
        var startedAt = now();
        var shell = executeShell(
            buildEndpointProbeCommand(),
            "JS#SBHReadonlyPingRetry3Endpoint"
        );
        var values = parseMap(shell.out);
        var probe;

        output.endpointProbeShellExitCode = shell.code;
        output.endpointProbeShellErrorPresent =
            String(shell.err || "").length > 0;

        if (String(values.su || "") !== "0") {
            throw new Error("ROOT_SHELL_REQUIRED");
        }

        probe = {
            exists: String(values.x || "0") === "1",
            uid: String(values.u || ""),
            gid: String(values.g || ""),
            mode: String(values.m || ""),
            size: String(values.s || ""),
            mtime: String(values.t || ""),
            real: String(values.r || ""),
            data: String(values.d || ""),
            now: String(values.n || ""),
            capturedAt: now(),
            error: shell.code === 0 ?
                null : "ENDPOINT_PROBE_SHELL_FAILED"
        };

        output.endpointProbeAvailable = true;
        output.endpointProbeRefreshed = true;
        output.endpointProbeSource =
            "direct_endpoint_only_refresh";
        output.endpointProbeAgeMs = probeAgeMs(probe);
        output.endpointRefreshElapsedMs =
            now() - startedAt;
        return probe;
    }

    function loadEndpointProbe(output) {
        var probe = currentEndpointProbe();
        if (probeUsable(probe)) {
            output.endpointProbeAvailable = true;
            output.endpointProbeSource =
                "runtime_client_cache";
            output.endpointProbeAgeMs =
                probeAgeMs(probe);
            return probe;
        }
        return refreshEndpointProbe(output);
    }

    function parseEndpoint(probe) {
        var decoded = null;
        var text = null;
        if (probe.exists !== true) {
            throw new Error("ENDPOINT_FILE_NOT_FOUND");
        }
        if (probe.error) {
            throw new Error("ENDPOINT_PROBE_ERROR");
        }
        if (!probe.data) {
            throw new Error("ENDPOINT_PROBE_DATA_MISSING");
        }
        try {
            decoded = Base64.decode(
                String(probe.data),
                Base64.DEFAULT
            );
            text = String(new JavaString(decoded, "UTF-8"));
            return JSON.parse(text);
        } catch (error) {
            if (String(error).indexOf("ENDPOINT_") >= 0) {
                throw error;
            }
            throw new Error("ENDPOINT_JSON_PARSE_FAILED");
        } finally {
            decoded = null;
            text = null;
        }
    }

    function digits(value) {
        return /^\d+$/.test(String(value || ""));
    }

    function validateEndpointMetadata(probe, endpoint, output) {
        var size = String(probe.size || "");
        var uid = String(probe.uid || "");
        var gid = String(probe.gid || "");
        var runtimePid;

        if (String(probe.real || "") !==
                expectedEndpointPath()) {
            throw new Error(
                "ENDPOINT_CANONICAL_PATH_MISMATCH"
            );
        }
        output.endpointFileExists = true;
        output.endpointFileCanonical = true;

        if (String(probe.mode || "") !== "600") {
            throw new Error("ENDPOINT_MODE_INVALID");
        }
        output.endpointModeValidated = true;

        if (!digits(size) || !digits(uid) ||
                !digits(gid) || !digits(probe.mtime)) {
            throw new Error("ENDPOINT_METADATA_INVALID");
        }
        if (Number(size) <= 0 ||
                Number(size) > MAX_ENDPOINT_BYTES) {
            throw new Error("ENDPOINT_FILE_SIZE_INVALID");
        }
        if (!endpoint || typeof endpoint !== "object" ||
                Number(endpoint.schemaVersion || 0) !== 1) {
            throw new Error("ENDPOINT_SCHEMA_INVALID");
        }
        output.endpointSchemaValidated = true;

        if (!digits(endpoint.runtimePid)) {
            throw new Error("ENDPOINT_RUNTIME_PID_INVALID");
        }
        runtimePid = Number(endpoint.runtimePid);
        if (runtimePid <= 1 ||
                runtimePid > 2147483647) {
            throw new Error("ENDPOINT_RUNTIME_PID_INVALID");
        }

        output.endpointIdentity = {
            schemaVersion: 1,
            runtimePid: runtimePid,
            createdAt: Number(endpoint.createdAt || 0),
            uid: Number(uid),
            gid: Number(gid),
            mode: String(probe.mode),
            size: Number(size),
            mtimeEpochSeconds: Number(probe.mtime)
        };
        return output.endpointIdentity;
    }

    function buildProcessIdentityCommand(identity, endpoint) {
        var serverClass = String(
            endpoint.serverClass || ""
        );
        var runtimeJar = String(
            endpoint.runtimeJar || ""
        );
        var lines = [
            "T=/system/bin/toybox",
            "printf 'su\\t%s\\n' \"$($T id -u)\"",
            "P=" + shellQuote(String(identity.runtimePid)),
            "E=" + shellQuote(expectedEndpointPath()),
            "STATUS=\"/proc/$P/status\"",
            "CMDLINE=\"/proc/$P/cmdline\"",
            "if [ -d \"/proc/$P\" ]; then",
            "  printf 'x\\t1\\n'",
            "else",
            "  printf 'x\\t0\\n'",
            "  exit 0",
            "fi",
            "if [ -r \"$STATUS\" ]; then",
            "  printf 'q\\t1\\n'",
            "else",
            "  printf 'q\\t0\\n'",
            "  exit 0",
            "fi",
            "UR=; UE=; US=; UF=; GR=; GE=; GS=; GF=",
            "while read KEY A B C D REST; do",
            "  case \"$KEY\" in",
            "    Uid:)",
            "      UR=\"$A\"; UE=\"$B\"; US=\"$C\"; UF=\"$D\"",
            "      ;;",
            "    Gid:)",
            "      GR=\"$A\"; GE=\"$B\"; GS=\"$C\"; GF=\"$D\"",
            "      ;;",
            "  esac",
            "done < \"$STATUS\"",
            "printf 'ur\\t%s\\n' \"$UR\"",
            "printf 'ue\\t%s\\n' \"$UE\"",
            "printf 'us\\t%s\\n' \"$US\"",
            "printf 'uf\\t%s\\n' \"$UF\"",
            "printf 'gr\\t%s\\n' \"$GR\"",
            "printf 'ge\\t%s\\n' \"$GE\"",
            "printf 'gs\\t%s\\n' \"$GS\"",
            "printf 'gf\\t%s\\n' \"$GF\"",
            "CMD_MATCH=0",
            "CMD_BASIS=none",
            "if [ -r \"$CMDLINE\" ]; then",
            "  CMD_VALUE=\"$($T tr '\\000' ' ' < " +
                "\"$CMDLINE\" 2>/dev/null)\"",
            "  case \"$CMD_VALUE\" in",
            "    *" + shellQuote(serverClass) + "*)",
            "      CMD_MATCH=1; CMD_BASIS=serverClass",
            "      ;;",
            "    *" + shellQuote(runtimeJar) + "*)",
            "      CMD_MATCH=1; CMD_BASIS=runtimeJar",
            "      ;;",
            "  esac",
            "fi",
            "printf 'cm\\t%s\\n' \"$CMD_MATCH\"",
            "printf 'cb\\t%s\\n' \"$CMD_BASIS\"",
            "printf 'eu\\t%s\\n' \"$($T stat -c '%u' \"$E\")\"",
            "printf 'eg\\t%s\\n' \"$($T stat -c '%g' \"$E\")\"",
            "printf 'em\\t%s\\n' \"$($T stat -c '%a' \"$E\")\"",
            "printf 'es\\t%s\\n' \"$($T stat -c '%s' \"$E\")\"",
            "printf 'et\\t%s\\n' \"$($T stat -c '%Y' \"$E\")\"",
            "printf 'er\\t%s\\n' \"$($T readlink -f \"$E\")\""
        ];

        return "/system/bin/toybox timeout 5 /system/bin/sh -c " +
            shellQuote(lines.join("\n"));
    }

    function requiredNumber(values, key, code) {
        if (!digits(values[key])) {
            throw new Error(code);
        }
        return Number(values[key]);
    }

    function validateProcessIdentity(
            identity, endpoint, output) {
        var startedAt = now();
        var shell = executeShell(
            buildProcessIdentityCommand(identity, endpoint),
            "JS#SBHReadonlyPingRetry3Process"
        );
        var values = parseMap(shell.out);
        var processIdentity;
        var stable;
        var uidMatched;
        var gidMatched;

        output.processIdentityElapsedMs =
            now() - startedAt;
        output.processIdentityShellExitCode =
            shell.code;
        output.processIdentityShellErrorPresent =
            String(shell.err || "").length > 0;
        output.runtimeProcessIdentityChecked = true;

        if (String(values.su || "") !== "0") {
            throw new Error("ROOT_SHELL_REQUIRED");
        }
        if (String(values.x || "0") !== "1") {
            throw new Error("RUNTIME_PROCESS_NOT_FOUND");
        }
        output.runtimeProcessExists = true;

        if (String(values.q || "0") !== "1") {
            throw new Error(
                "RUNTIME_PROCESS_STATUS_UNAVAILABLE"
            );
        }

        processIdentity = {
            runtimePid: identity.runtimePid,
            uidReal: requiredNumber(
                values,
                "ur",
                "RUNTIME_PROCESS_UID_INVALID"
            ),
            uidEffective: requiredNumber(
                values,
                "ue",
                "RUNTIME_PROCESS_UID_INVALID"
            ),
            uidSaved: requiredNumber(
                values,
                "us",
                "RUNTIME_PROCESS_UID_INVALID"
            ),
            uidFs: requiredNumber(
                values,
                "uf",
                "RUNTIME_PROCESS_UID_INVALID"
            ),
            gidReal: requiredNumber(
                values,
                "gr",
                "RUNTIME_PROCESS_GID_INVALID"
            ),
            gidEffective: requiredNumber(
                values,
                "ge",
                "RUNTIME_PROCESS_GID_INVALID"
            ),
            gidSaved: requiredNumber(
                values,
                "gs",
                "RUNTIME_PROCESS_GID_INVALID"
            ),
            gidFs: requiredNumber(
                values,
                "gf",
                "RUNTIME_PROCESS_GID_INVALID"
            )
        };

        output.runtimeCommandIdentityChecked = true;
        output.runtimeCommandIdentityValidated =
            String(values.cm || "0") === "1";
        output.runtimeCommandIdentityBasis =
            output.runtimeCommandIdentityValidated ?
                String(values.cb || "unknown") : "none";

        if (!output.runtimeCommandIdentityValidated) {
            throw new Error(
                "RUNTIME_PROCESS_COMMAND_MISMATCH"
            );
        }

        stable =
            requiredNumber(
                values,
                "eu",
                "ENDPOINT_IDENTITY_CHANGED"
            ) === identity.uid &&
            requiredNumber(
                values,
                "eg",
                "ENDPOINT_IDENTITY_CHANGED"
            ) === identity.gid &&
            String(values.em || "") === identity.mode &&
            requiredNumber(
                values,
                "es",
                "ENDPOINT_IDENTITY_CHANGED"
            ) === identity.size &&
            requiredNumber(
                values,
                "et",
                "ENDPOINT_IDENTITY_CHANGED"
            ) === identity.mtimeEpochSeconds &&
            String(values.er || "") ===
                expectedEndpointPath();

        if (!stable) {
            throw new Error("ENDPOINT_IDENTITY_CHANGED");
        }
        output.endpointIdentityStable = true;

        uidMatched =
            identity.uid === processIdentity.uidEffective ||
            identity.uid === processIdentity.uidFs;
        gidMatched =
            identity.gid === processIdentity.gidEffective ||
            identity.gid === processIdentity.gidFs;

        processIdentity.endpointUid = identity.uid;
        processIdentity.endpointGid = identity.gid;
        processIdentity.uidMatchBasis =
            identity.uid === processIdentity.uidEffective ?
                "effective" :
                (identity.uid === processIdentity.uidFs ?
                    "fs" : "none");
        processIdentity.gidMatchBasis =
            identity.gid === processIdentity.gidEffective ?
                "effective" :
                (identity.gid === processIdentity.gidFs ?
                    "fs" : "none");
        processIdentity.ownerMatched =
            uidMatched && gidMatched;
        processIdentity.commandIdentityMatched =
            output.runtimeCommandIdentityValidated;
        processIdentity.commandIdentityBasis =
            output.runtimeCommandIdentityBasis;

        output.runtimeProcessIdentity =
            processIdentity;

        if (!processIdentity.ownerMatched) {
            throw new Error(
                "ENDPOINT_RUNTIME_OWNER_MISMATCH"
            );
        }

        output.runtimeProcessIdentityValidated = true;
        output.endpointOwnerValidated = true;
    }

    function extractSecrets(endpoint) {
        var socketName = String(endpoint.socketName || "");
        var token = String(endpoint.token || "");

        if (socketName.length < 1 ||
                socketName.length > 128 ||
                /[\r\n\u0000]/.test(socketName)) {
            throw new Error(
                "ENDPOINT_SOCKET_NAME_INVALID"
            );
        }
        if (token.length < 16 ||
                token.length > 256 ||
                /[\r\n\u0000]/.test(token)) {
            throw new Error("ENDPOINT_TOKEN_INVALID");
        }
        return {
            socketName: socketName,
            token: token
        };
    }

    function randomCorrelation() {
        var random = new SecureRandom();
        var bytes = ReflectArray.newInstance(
            JavaByte.TYPE,
            12
        );
        var value = "sbh-ping-" + now() + "-";
        var i;
        var currentValue;

        random.nextBytes(bytes);
        for (i = 0; i < bytes.length; i += 1) {
            currentValue = Number(bytes[i]);
            if (currentValue < 0) {
                currentValue += 256;
            }
            if (currentValue < 16) {
                value += "0";
            }
            value += currentValue.toString(16);
        }
        return value;
    }

    function errorCodeOf(error) {
        var text = SBH.util.errorText(error);
        var known = [
            "SHORTX_DIR_UNAVAILABLE",
            "SHORTX_SHELL_RESULT_NULL",
            "SHORTX_SHELL_CONTEXT_UNAVAILABLE",
            "ROOT_SHELL_REQUIRED",
            "ENDPOINT_FILE_NOT_FOUND",
            "ENDPOINT_PROBE_ERROR",
            "ENDPOINT_PROBE_DATA_MISSING",
            "ENDPOINT_JSON_PARSE_FAILED",
            "ENDPOINT_CANONICAL_PATH_MISMATCH",
            "ENDPOINT_MODE_INVALID",
            "ENDPOINT_METADATA_INVALID",
            "ENDPOINT_FILE_SIZE_INVALID",
            "ENDPOINT_SCHEMA_INVALID",
            "ENDPOINT_RUNTIME_PID_INVALID",
            "ENDPOINT_IDENTITY_CHANGED",
            "ENDPOINT_RUNTIME_OWNER_MISMATCH",
            "ENDPOINT_SOCKET_NAME_INVALID",
            "ENDPOINT_TOKEN_INVALID",
            "RUNTIME_PROCESS_NOT_FOUND",
            "RUNTIME_PROCESS_STATUS_UNAVAILABLE",
            "RUNTIME_PROCESS_UID_INVALID",
            "RUNTIME_PROCESS_GID_INVALID",
            "RUNTIME_PROCESS_COMMAND_MISMATCH",
            "TOTAL_EXECUTION_BUDGET_EXCEEDED",
            "UNEXPECTED_RESPONSE_STATUS",
            "CORRELATION_ECHO_MISMATCH"
        ];
        var i;

        for (i = 0; i < known.length; i += 1) {
            if (text.indexOf(known[i]) >= 0) {
                return known[i];
            }
        }
        return "READONLY_SOCKET_PING_RETRY3_FAILED";
    }

    function sanitizeError(error, socketName, token) {
        var text = SBH.util.errorText(error);
        if (socketName) {
            text = text.split(String(socketName)).join(
                "<SOCKET_NAME_REDACTED>"
            );
        }
        if (token) {
            text = text.split(String(token)).join(
                "<TOKEN_REDACTED>"
            );
        }
        if (text.length > 512) {
            text = text.substring(0, 512);
        }
        return text;
    }

    function staticGateReady(status) {
        var transaction =
            status ? status.runtimeTransactionContract : null;
        var preview =
            status ? status.runtimeSanitizedDryRunPreview : null;
        var plan =
            status ? status.protocolAdapterPlan : null;
        var blockers =
            plan && plan.blockers ? plan.blockers : [];

        return !!transaction &&
            transaction.readOnlyPingContractReady === true &&
            transaction.pingSideEffectFree === true &&
            !!preview &&
            String(preview.state || "") ===
                "sanitized_dry_run_preview_ready" &&
            preview.planNormalized === true &&
            preview.realSocketDryRunAllowed === false &&
            !!plan &&
            String(plan.state || "") ===
                "sanitized_preview_ready" &&
            plan.adapterImplementationAllowed === true &&
            plan.adapterInvocationEnabled === false &&
            blockers.length === 0;
    }

    function save(result) {
        cached = result;
        try {
            SBH.files.writeJson(cacheFile, result);
        } catch (error) {
            SBH.log.warn(
                "runtime.readonly.ping.retry3.cache",
                SBH.util.errorText(error)
            );
        }
    }

    function cachedAuthorizedResult() {
        if (!cached ||
                Number(cached.schemaVersion || 0) !==
                    SCHEMA_VERSION ||
                String(cached.authorizationId || "") !==
                    AUTHORIZATION_ID ||
                cached.authorizationConsumed !== true) {
            return null;
        }
        cached.reusedCachedResult = true;
        cached.automaticExecution = false;
        cached.source = "persisted_one_shot_result";
        cached.checkedAt = now();
        return cached;
    }

    function executeOneShot(status) {
        var existing = cachedAuthorizedResult();
        var output = blank(
            "readonly_socket_ping_retry3_blocked"
        );
        var startedAt = now();
        var probe = null;
        var endpoint = null;
        var identity = null;
        var secrets = null;
        var socketName = null;
        var token = null;
        var correlation = null;
        var socket = null;
        var address = null;
        var writer = null;
        var reader = null;
        var responseStatus = null;
        var responseCorrelation = null;
        var connectStartedAt = 0;

        if (existing !== null) {
            return existing;
        }

        output.attemptStartedAt = startedAt;

        if (!staticGateReady(status)) {
            output.state =
                "readonly_socket_ping_retry3_waiting_for_gate";
            output.errorCode = "STATIC_GATE_NOT_READY";
            output.error =
                "Static read-only PING gate is not ready";
            output.attemptCompletedAt = now();
            output.totalElapsedMs =
                output.attemptCompletedAt - startedAt;
            return output;
        }

        output.authorizationConsumed = true;

        try {
            probe = loadEndpointProbe(output);
            endpoint = parseEndpoint(probe);
            output.endpointValueRead = true;

            identity = validateEndpointMetadata(
                probe,
                endpoint,
                output
            );
            validateProcessIdentity(
                identity,
                endpoint,
                output
            );

            if (now() - startedAt >
                    TOTAL_BUDGET_MS) {
                throw new Error(
                    "TOTAL_EXECUTION_BUDGET_EXCEEDED"
                );
            }

            secrets = extractSecrets(endpoint);
            socketName = secrets.socketName;
            token = secrets.token;
            secrets.socketName = null;
            secrets.token = null;
            endpoint = null;
            probe = null;

            output.socketNameValueRead = true;
            output.socketNameValueUsed = true;
            output.tokenValueRead = true;
            output.tokenValueUsed = true;
            output.endpointContractReady = true;

            correlation = randomCorrelation();
            output.correlationGenerated = true;
            output.correlationLength =
                correlation.length;
            output.requestConstructedInMemory = true;

            socket = new LocalSocket();
            socket.setSoTimeout(READ_TIMEOUT_MS);
            address = new LocalSocketAddress(
                socketName,
                LocalSocketAddress.Namespace.ABSTRACT
            );

            output.socketConnectionAttempted = true;
            connectStartedAt = now();
            socket.connect(address, CONNECT_TIMEOUT_MS);
            output.connectElapsedMs =
                now() - connectStartedAt;
            output.socketConnected = true;

            writer = new BufferedWriter(
                new OutputStreamWriter(
                    socket.getOutputStream(),
                    "UTF-8"
                )
            );
            writer.write(token);
            writer.newLine();
            writer.write(correlation);
            writer.newLine();
            writer.write("PING");
            writer.newLine();
            output.requestSerialized = true;
            writer.flush();
            output.requestSent = true;
            output.requestCount = 1;

            reader = new BufferedReader(
                new InputStreamReader(
                    socket.getInputStream(),
                    "UTF-8"
                )
            );
            responseStatus = reader.readLine();
            responseCorrelation = reader.readLine();
            output.responseRead = true;
            output.responseLineCount = 2;
            output.responseStatus =
                responseStatus === null ?
                    null : String(responseStatus);
            output.responseStatusMatched =
                String(responseStatus || "") === "PONG";
            output.correlationMatched =
                String(responseCorrelation || "") ===
                    correlation;

            if (now() - startedAt >
                    TOTAL_BUDGET_MS) {
                throw new Error(
                    "TOTAL_EXECUTION_BUDGET_EXCEEDED"
                );
            }
            if (!output.responseStatusMatched) {
                throw new Error(
                    "UNEXPECTED_RESPONSE_STATUS"
                );
            }
            if (!output.correlationMatched) {
                throw new Error(
                    "CORRELATION_ECHO_MISMATCH"
                );
            }

            output.state =
                "readonly_socket_ping_verified";
            output.adapterImplementationAllowed = true;
            output.readOnlyStatusAdapterReady = true;
            output.safeFailure = false;
            output.errorCode = null;
            output.error = null;
        } catch (error) {
            output.state =
                "readonly_socket_ping_retry3_failed";
            output.errorCode = errorCodeOf(error);
            output.error = sanitizeError(
                error,
                socketName,
                token
            );
            output.adapterImplementationAllowed = false;
            output.readOnlyStatusAdapterReady = false;
            output.safeFailure = true;
        } finally {
            closeQuietly(reader);
            closeQuietly(writer);
            output.socketClosed =
                socket !== null ?
                    closeQuietly(socket) : false;

            socketName = null;
            token = null;
            correlation = null;
            responseCorrelation = null;
            responseStatus = null;
            address = null;
            endpoint = null;
            identity = null;
            secrets = null;
            probe = null;

            output.sensitiveReferencesCleared = true;
            output.tokenValueExposed = false;
            output.socketNameValueExposed = false;
            output.correlationExposed = false;
            output.coreStartInvoked = false;
            output.coreStopInvoked = false;
            output.runtimeStopInvoked = false;
            output.unknownCommandInvoked = false;
            output.coreClientMainInvoked = false;
            output.markerFileCreated = false;
            output.runtimeFilesModified = false;
            output.adapterInvocationEnabled = false;
            output.writeOperationsLocked = true;
            output.destructiveOperations = false;
            output.attemptCompletedAt = now();
            output.totalElapsedMs =
                output.attemptCompletedAt - startedAt;
            output.checkedAt =
                output.attemptCompletedAt;
        }

        save(output);
        return output;
    }

    function attach(status, result) {
        var plan;
        status = status || {};
        result = result || cached || blank("not_started");
        status.runtimeReadonlySocketPing = result;
        status.runtimeReadonlySocketPingRetry3 = result;
        plan = status.protocolAdapterPlan;

        if (plan) {
            plan.runtimeReadonlySocketPingState =
                String(result.state);
            plan.readOnlyPingVerified =
                result.state ===
                    "readonly_socket_ping_verified";
            plan.readOnlyStatusAdapterReady =
                result.readOnlyStatusAdapterReady === true;
            plan.adapterInvocationEnabled = false;
            plan.writeOperationsLocked = true;
            plan.destructiveOperations = false;

            if (plan.readOnlyPingVerified) {
                plan.state = "readonly_ping_verified";
                plan.adapterImplementationAllowed = true;
                plan.blockers = [];
                plan.permittedOperations = [
                    "read_verified_ping_result",
                    "build_readonly_status_adapter"
                ];
            } else if (
                    result.authorizationConsumed === true) {
                plan.state =
                    "readonly_ping_verification_failed";
                plan.adapterImplementationAllowed = false;
                plan.blockers = [
                    "READONLY_SOCKET_PING_NOT_VERIFIED"
                ];
                plan.permittedOperations = [
                    "read_ping_failure_result"
                ];
            }
            status.protocolAdapterPlanState =
                String(plan.state || "checking");
        }
        return status;
    }

    function install() {
        var runtime = SBH.runtime;
        var oldStatus = runtime.status;
        var oldRefresh = runtime.refresh;
        var oldRequest = runtime.request;
        var oldStart = SBH.app.start;

        runtime.status = function () {
            return attach(oldStatus(), cached);
        };

        runtime.refresh = function () {
            return attach(oldRefresh(), cached);
        };

        runtime.request = function (request) {
            var command =
                request && request.command ?
                    String(request.command) : "";
            var requestId =
                request && request.requestId ?
                    String(request.requestId) : "";
            var status;
            var response;

            if (command ===
                    "runtime.readonly_ping_status") {
                status = attach(oldStatus(), cached);
                return {
                    ok: !!cached &&
                        cached.state ===
                            "readonly_socket_ping_verified",
                    requestId: requestId,
                    code: "RUNTIME_READONLY_PING_STATUS",
                    stateBefore:
                        status.coreRunning ?
                            "running" : "stopped",
                    stateAfter:
                        status.coreRunning ?
                            "running" : "stopped",
                    message:
                        "Runtime 只读 Socket PING 重试 3 状态",
                    data:
                        cached || blank("not_started")
                };
            }

            response = oldRequest(request);
            try {
                if (response && response.data) {
                    response.data.runtimeReadonlySocketPing =
                        cached || blank("not_started");
                }
            } catch (ignored) {}
            return response;
        };

        SBH.app.start = function () {
            var output = oldStart();
            var status = oldStatus();
            var result;

            try {
                result = executeOneShot(status);
            } catch (error) {
                result = blank(
                    "readonly_socket_ping_retry3_status_unavailable"
                );
                result.authorizationConsumed = true;
                result.errorCode = errorCodeOf(error);
                result.error = sanitizeError(
                    error,
                    "",
                    ""
                );
                save(result);
            }

            status = attach(status, result);
            output.runtimeReadonlySocketPing =
                String(result.state);
            output.runtimeReadonlySocketPingDetails =
                result;
            output.runtimeReadonlySocketPingRetry3 =
                String(result.state);
            output.runtimeReadonlySocketPingRetry3Details =
                result;
            output.runtimeProtocolAdapterPlan =
                String(
                    status.protocolAdapterPlan ?
                        status.protocolAdapterPlan.state :
                        "checking"
                );
            output.runtimeProtocolAdapterPlanDetails =
                status.protocolAdapterPlan || null;
            output.protocolAdapterPlanState =
                output.runtimeProtocolAdapterPlan;

            if (output.runtimeWriteGateDetails) {
                output.runtimeWriteGateDetails
                    .protocolAdapterPlanState =
                    output.protocolAdapterPlanState;
                output.runtimeWriteGateDetails
                    .protocolAdapterPlan =
                    status.protocolAdapterPlan || null;
                output.runtimeWriteGateDetails
                    .runtimeReadonlySocketPing =
                    result;
                output.runtimeWriteGateDetails
                    .writeOperationsLocked = true;
                output.runtimeWriteGateDetails
                    .destructiveOperations = false;
            }

            output.writeOperationsLocked = true;
            output.destructiveOperations = false;
            return output;
        };
    }

    if (!cached ||
            Number(cached.schemaVersion || 0) !==
                SCHEMA_VERSION ||
            String(cached.authorizationId || "") !==
                AUTHORIZATION_ID) {
        cached = null;
    }

    install();
}());
