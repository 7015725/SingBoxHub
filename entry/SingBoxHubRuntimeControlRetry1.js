/*
 * SingBoxHub Stage 28 Retry 1
 * Start or reuse the Runtime control service, then send exactly one read-only PING.
 * ShortX / Rhino ES5.
 */
(function () {
    "use strict";

    var P = Packages;
    var File = P.java.io.File;
    var System = P.java.lang.System;
    var ShellCommand =
        P.tornaco.apps.shortx.core.proto.action.ShellCommand;
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

    var AUTHORIZATION_ID =
        "stage28-retry1-detached-launch-user-authorized-20260803";
    var SERVER_CLASS =
        "com.singboxhub.runtime.CoreRuntimeMain";

    function now() {
        return Number(System.currentTimeMillis());
    }

    function errorText(error) {
        try {
            if (error && error.javaException) {
                return String(
                    error.javaException.getClass().getName()
                ) + ": " + String(error);
            }
        } catch (ignored) {}
        return String(error);
    }

    function shellQuote(value) {
        return "'" + String(value).replace(/'/g, "'\\''") + "'";
    }

    function contextValue(data, key) {
        var value = data.get(String(key));
        return value === null || value === undefined ?
            "" : String(value);
    }

    function executeShell(command) {
        var action = ShellCommand.newBuilder()
            .setCommand(String(command))
            .setSingleShot(true)
            .setId("JS#SingBoxHubStage28Retry1")
            .build();
        var result = shortx.executeAction(action);
        var data;

        if (result === null || result === undefined) {
            throw new Error("SHORTX_SHELL_RESULT_NULL");
        }
        data = result.contextData;
        if (data === null || data === undefined) {
            throw new Error(
                "SHORTX_SHELL_CONTEXT_UNAVAILABLE"
            );
        }
        return {
            out: contextValue(data, "shellOut"),
            err: contextValue(data, "shellErr"),
            code: Number(data.get("shellCode"))
        };
    }

    function parseMap(text) {
        var result = {};
        var lines = String(text || "").split(/\r?\n/);
        var fields;
        var i;

        for (i = 0; i < lines.length; i += 1) {
            fields = lines[i].split("\t");
            if (fields.length >= 2) {
                result[String(fields[0])] =
                    String(fields.slice(1).join("\t"));
            }
        }
        return result;
    }

    function numberField(map, key, code) {
        var value = String(map[key] || "");
        if (!/^\d+$/.test(value)) {
            throw new Error(code);
        }
        return Number(value);
    }

    function runtimeRoot() {
        var root;
        if (typeof shortx === "undefined" ||
                shortx === null ||
                typeof shortx.getShortXDir !== "function") {
            throw new Error("SHORTX_DIR_UNAVAILABLE");
        }
        root = new File(
            String(shortx.getShortXDir()),
            "SingBoxHub"
        );
        return String(root.getCanonicalPath());
    }

    function buildCommand() {
        var root = runtimeRoot();
        var lines = [
            "T=/system/bin/toybox",
            "umask 077",
            "R=" + shellQuote(root),
            "J=\"$R/runtime/core/SingBoxHubCoreRuntime.jar\"",
            "B=\"$R/bin/sing-box\"",
            "C=\"$R/config/runtime-tun.json\"",
            "W=\"$R/runtime/core/work\"",
            "D=\"$R/runtime/control\"",
            "E=\"$D/control_endpoint.json\"",
            "L=\"$R/logs/runtime-production.log\"",
            "S=" + shellQuote(SERVER_CLASS),
            "A=/system/bin/app_process64",
            "[ -x \"$A\" ] || A=/system/bin/app_process",
            "printf 'shell_uid\\t%s\\n' \"$($T id -u 2>/dev/null)\"",
            "[ -f \"$J\" ] || { printf 'result\\tRUNTIME_JAR_MISSING\\n'; exit 31; }",
            "[ -x \"$B\" ] || { printf 'result\\tCORE_BINARY_INVALID\\n'; exit 32; }",
            "[ -f \"$C\" ] || { printf 'result\\tRUNTIME_CONFIG_MISSING\\n'; exit 33; }",
            "[ -d \"$W\" ] || { printf 'result\\tRUNTIME_WORKDIR_MISSING\\n'; exit 34; }",
            "[ -d \"$D\" ] || { printf 'result\\tCONTROL_DIR_MISSING\\n'; exit 35; }",
            "[ -d \"$R/logs\" ] || { printf 'result\\tLOG_DIR_MISSING\\n'; exit 36; }",
            "[ -x \"$A\" ] || { printf 'result\\tAPP_PROCESS_MISSING\\n'; exit 37; }",
            "OLD_ENDPOINT=0",
            "[ -f \"$E\" ] && OLD_ENDPOINT=1",
            "printf 'stale_endpoint_detected\\t%s\\n' \"$OLD_ENDPOINT\"",
            "CORE_FOUND=0",
            "for X in /proc/[0-9]*/exe; do",
            "  [ -L \"$X\" ] || continue",
            "  [ \"$($T readlink \"$X\" 2>/dev/null)\" = \"$B\" ] && { CORE_FOUND=1; break; }",
            "done",
            "printf 'core_process_present\\t%s\\n' \"$CORE_FOUND\"",
            "[ \"$CORE_FOUND\" = 0 ] || { printf 'result\\tCORE_PROCESS_PRESENT\\n'; exit 41; }",
            "ENDPOINT_PID=",
            "if [ -f \"$E\" ]; then",
            "  ENDPOINT_PID=\"$($T sed -n 's/.*\"runtimePid\":[[:space:]]*\\([0-9][0-9]*\\).*/\\1/p' \"$E\" 2>/dev/null | $T head -n 1)\"",
            "fi",
            "SERVICE_COUNT=0",
            "SERVICE_PID=",
            "for PROC in /proc/[0-9]*; do",
            "  [ -r \"$PROC/cmdline\" ] || continue",
            "  CMDLINE=\"$($T tr '\\000' ' ' <\"$PROC/cmdline\" 2>/dev/null)\"",
            "  case \"$CMDLINE\" in",
            "    *\"$S\"*\"$C\"*\"$W\"*)",
            "      SERVICE_COUNT=$((SERVICE_COUNT + 1))",
            "      SERVICE_PID=\"${PROC##*/}\"",
            "      ;;",
            "  esac",
            "done",
            "printf 'existing_service_count\\t%s\\n' \"$SERVICE_COUNT\"",
            "[ \"$SERVICE_COUNT\" -le 1 ] || { printf 'result\\tMULTIPLE_CONTROL_SERVICES_PRESENT\\n'; exit 42; }",
            "REUSED=0",
            "ORPHAN_CLEANED=0",
            "if [ \"$SERVICE_COUNT\" = 1 ]; then",
            "  if [ \"$ENDPOINT_PID\" = \"$SERVICE_PID\" ] && kill -0 \"$SERVICE_PID\" 2>/dev/null; then",
            "    REUSED=1",
            "    PID=\"$SERVICE_PID\"",
            "  else",
            "    printf 'orphan_service_detected\\t1\\n'",
            "    printf 'orphan_service_pid\\t%s\\n' \"$SERVICE_PID\"",
            "    printf 'orphan_cleanup_attempted\\t1\\n'",
            "    kill -TERM \"$SERVICE_PID\" 2>/dev/null",
            "    I=0",
            "    while kill -0 \"$SERVICE_PID\" 2>/dev/null && [ \"$I\" -lt 15 ]; do I=$((I + 1)); sleep .10; done",
            "    if kill -0 \"$SERVICE_PID\" 2>/dev/null; then kill -KILL \"$SERVICE_PID\" 2>/dev/null; sleep .10; fi",
            "    kill -0 \"$SERVICE_PID\" 2>/dev/null && { printf 'result\\tORPHAN_CONTROL_SERVICE_CLEANUP_FAILED\\n'; exit 43; }",
            "    ORPHAN_CLEANED=1",
            "    printf 'orphan_cleanup_succeeded\\t1\\n'",
            "  fi",
            "fi",
            "STARTED=0",
            "ROLLED_BACK=0",
            "if [ \"$REUSED\" = 0 ]; then",
            "  STAMP=\"$($T date +%s)000\"",
            "  TOKEN=\"$($T head -c 16 /dev/urandom 2>/dev/null | $T od -An -tx1 | $T tr -d ' \\n')\"",
            "  [ -n \"$TOKEN\" ] || TOKEN=\"${STAMP}$$\"",
            "  SOCKET_NAME=\"sbh_runtime_${STAMP}_$$\"",
            "  READY=\"$D/runtime.${STAMP}.$$.ready\"",
            "  PID_FILE=\"$D/runtime.${STAMP}.$$.pid\"",
            "  PID_TMP=\"${PID_FILE}.tmp\"",
            "  ENDPOINT_TMP=\"$D/.control_endpoint.${STAMP}.$$.tmp\"",
            "  rm -f \"$READY\" \"$PID_FILE\" \"$PID_TMP\" \"$ENDPOINT_TMP\" 2>/dev/null",
            "  CLASSPATH=\"$J\" $T nohup \"$A\" /system/bin \"$S\" \"$SOCKET_NAME\" \"$TOKEN\" \"$B\" \"$C\" \"$W\" \"$READY\" </dev/null >>\"$L\" 2>&1 &",
            "  PID=\"$!\"",
            "  printf '%s\\n' \"$PID\" >\"$PID_TMP\"",
            "  chmod 0600 \"$PID_TMP\"",
            "  mv -f \"$PID_TMP\" \"$PID_FILE\"",
            "  printf 'launcher_detached\\t1\\n'",
            "  I=0",
            "  while [ ! -f \"$READY\" ] && [ \"$I\" -lt 50 ]; do kill -0 \"$PID\" 2>/dev/null || break; I=$((I + 1)); sleep .10; done",
            "  rollback_startup() {",
            "    kill -TERM \"$PID\" 2>/dev/null",
            "    sleep .20",
            "    kill -0 \"$PID\" 2>/dev/null && kill -KILL \"$PID\" 2>/dev/null",
            "    rm -f \"$READY\" \"$PID_FILE\" \"$PID_TMP\" \"$ENDPOINT_TMP\"",
            "    ROLLED_BACK=1",
            "    printf 'startup_rollback_attempted\\t1\\n'",
            "  }",
            "  if [ ! -f \"$READY\" ] || ! kill -0 \"$PID\" 2>/dev/null; then rollback_startup; printf 'result\\tRUNTIME_READY_TIMEOUT\\n'; exit 44; fi",
            "  printf '{\"schemaVersion\":1,\"runtimePid\":%s,\"socketName\":\"%s\",\"token\":\"%s\",\"serverClass\":\"%s\",\"clientClass\":\"com.singboxhub.runtime.CoreClientMain\",\"runtimeJar\":\"%s\",\"binaryPath\":\"%s\",\"configPath\":\"%s\",\"workingDirectory\":\"%s\",\"createdAt\":%s}\\n' \"$PID\" \"$SOCKET_NAME\" \"$TOKEN\" \"$S\" \"$J\" \"$B\" \"$C\" \"$W\" \"$STAMP\" >\"$ENDPOINT_TMP\" || { rollback_startup; printf 'result\\tENDPOINT_WRITE_FAILED\\n'; exit 45; }",
            "  chmod 0600 \"$ENDPOINT_TMP\" || { rollback_startup; printf 'result\\tENDPOINT_CHMOD_FAILED\\n'; exit 46; }",
            "  mv -f \"$ENDPOINT_TMP\" \"$E\" || { rollback_startup; printf 'result\\tENDPOINT_REPLACE_FAILED\\n'; exit 47; }",
            "  rm -f \"$READY\" \"$PID_FILE\" \"$PID_TMP\"",
            "  STARTED=1",
            "else",
            "  printf 'launcher_detached\\t1\\n'",
            "fi",
            "kill -0 \"$PID\" 2>/dev/null || { printf 'result\\tCONTROL_SERVICE_NOT_ALIVE\\n'; exit 48; }",
            "UID_EFFECTIVE=; UID_FS=; GID_EFFECTIVE=; GID_FS=",
            "while read KEY A1 A2 A3 A4 REST; do",
            "  case \"$KEY\" in",
            "    Uid:) UID_EFFECTIVE=\"$A2\"; UID_FS=\"$A4\" ;;",
            "    Gid:) GID_EFFECTIVE=\"$A2\"; GID_FS=\"$A4\" ;;",
            "  esac",
            "done <\"/proc/$PID/status\"",
            "CMDLINE=\"$($T tr '\\000' ' ' <\"/proc/$PID/cmdline\" 2>/dev/null)\"",
            "COMMAND_MATCH=0",
            "case \"$CMDLINE\" in *\"$S\"*\"$C\"*\"$W\"*) COMMAND_MATCH=1 ;; esac",
            "ENDPOINT_SIZE=\"$($T stat -c '%s' \"$E\" 2>/dev/null)\"",
            "ENDPOINT_DATA=\"$($T base64 \"$E\" 2>/dev/null | $T tr -d '\\r\\n')\"",
            "printf 'result\\tREADY\\n'",
            "printf 'service_started\\t%s\\n' \"$STARTED\"",
            "printf 'service_reused\\t%s\\n' \"$REUSED\"",
            "printf 'orphan_cleaned\\t%s\\n' \"$ORPHAN_CLEANED\"",
            "printf 'pid\\t%s\\n' \"$PID\"",
            "printf 'uid\\t%s\\n' \"$($T stat -c '%u' \"$E\" 2>/dev/null)\"",
            "printf 'gid\\t%s\\n' \"$($T stat -c '%g' \"$E\" 2>/dev/null)\"",
            "printf 'mode\\t%s\\n' \"$($T stat -c '%a' \"$E\" 2>/dev/null)\"",
            "printf 'size\\t%s\\n' \"$ENDPOINT_SIZE\"",
            "printf 'real\\t%s\\n' \"$($T readlink -f \"$E\" 2>/dev/null)\"",
            "printf 'uid_effective\\t%s\\n' \"$UID_EFFECTIVE\"",
            "printf 'uid_fs\\t%s\\n' \"$UID_FS\"",
            "printf 'gid_effective\\t%s\\n' \"$GID_EFFECTIVE\"",
            "printf 'gid_fs\\t%s\\n' \"$GID_FS\"",
            "printf 'command_match\\t%s\\n' \"$COMMAND_MATCH\"",
            "printf 'data\\t%s\\n' \"$ENDPOINT_DATA\""
        ];

        return "/system/bin/toybox timeout 15 /system/bin/sh -c " +
            shellQuote(lines.join("\n"));
    }

    function decodeEndpoint(value) {
        var bytes = Base64.decode(
            String(value),
            Base64.DEFAULT
        );
        return JSON.parse(
            String(new JavaString(bytes, "UTF-8"))
        );
    }

    function correlationValue() {
        var random = new SecureRandom();
        var bytes = ReflectArray.newInstance(
            JavaByte.TYPE,
            12
        );
        var result = "sbh28r1-" + now() + "-";
        var value;
        var i;

        random.nextBytes(bytes);
        for (i = 0; i < bytes.length; i += 1) {
            value = Number(bytes[i]);
            if (value < 0) {
                value += 256;
            }
            result +=
                (value < 16 ? "0" : "") +
                value.toString(16);
        }
        return result;
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

    function run() {
        var startedAt = now();
        var shell = null;
        var values = null;
        var endpoint = null;
        var socket = null;
        var writer = null;
        var reader = null;
        var socketName = null;
        var token = null;
        var correlation = null;
        var responseStatus = null;
        var responseCorrelation = null;
        var pid = null;
        var endpointUid = null;
        var endpointGid = null;
        var uidEffective = null;
        var uidFs = null;
        var gidEffective = null;
        var gidFs = null;
        var result = {
            ok: false,
            project: "SingBoxHub",
            stage: "runtime_stage28_retry1",
            authorizationId: AUTHORIZATION_ID,
            authorizationConsumed: true,
            automaticRetryAllowed: false,
            launcherMode: "direct_no_wait_detached",
            launcherDetached: false,
            shellOutputComplete: false,
            staleEndpointDetected: false,
            existingServiceCount: 0,
            existingServiceReused: false,
            orphanServiceDetected: false,
            orphanServicePid: null,
            orphanCleanupAttempted: false,
            orphanCleanupSucceeded: false,
            startupRollbackAttempted: false,
            controlServiceStarted: false,
            controlServicePid: null,
            controlServiceProcessAlive: false,
            controlServiceCommandValidated: false,
            controlServiceOwnerValidated: false,
            controlServiceRemainsRunning: false,
            endpointFileCanonical: false,
            endpointModeValidated: false,
            endpointSchemaValidated: false,
            endpointContractReady: false,
            tokenValueRead: false,
            tokenValueExposed: false,
            socketNameValueRead: false,
            socketNameValueExposed: false,
            requestSent: false,
            requestCount: 0,
            responseStatus: null,
            responseStatusMatched: false,
            correlationMatched: false,
            socketConnectionAttempted: false,
            socketConnected: false,
            socketClosed: false,
            sensitiveReferencesCleared: false,
            coreProcessPresentBefore: false,
            coreStartInvoked: false,
            coreStopInvoked: false,
            tunCreated: false,
            routeModified: false,
            configModified: false,
            runtimeFilesModified: false,
            destructiveOperations: false,
            shellExitCode: null,
            shellErrorPresent: false,
            errorCode: null,
            error: null,
            durationMs: null,
            timestamp: null
        };

        try {
            shell = executeShell(buildCommand());
            values = parseMap(shell.out);
            result.shellExitCode = shell.code;
            result.shellErrorPresent =
                String(shell.err || "").length > 0;
            result.shellOutputComplete =
                String(values.result || "") === "READY";
            result.launcherDetached =
                String(values.launcher_detached || "0") === "1";
            result.staleEndpointDetected =
                String(
                    values.stale_endpoint_detected || "0"
                ) === "1";
            result.coreProcessPresentBefore =
                String(
                    values.core_process_present || "0"
                ) === "1";
            result.existingServiceCount =
                /^\d+$/.test(
                    String(values.existing_service_count || "")
                ) ?
                    Number(values.existing_service_count) : 0;
            result.existingServiceReused =
                String(values.service_reused || "0") === "1";
            result.orphanServiceDetected =
                String(
                    values.orphan_service_detected || "0"
                ) === "1";
            result.orphanServicePid =
                /^\d+$/.test(
                    String(values.orphan_service_pid || "")
                ) ?
                    Number(values.orphan_service_pid) : null;
            result.orphanCleanupAttempted =
                String(
                    values.orphan_cleanup_attempted || "0"
                ) === "1";
            result.orphanCleanupSucceeded =
                String(values.orphan_cleaned || "0") === "1" ||
                String(
                    values.orphan_cleanup_succeeded || "0"
                ) === "1";
            result.startupRollbackAttempted =
                String(
                    values.startup_rollback_attempted || "0"
                ) === "1";

            if (String(values.shell_uid || "") !== "0") {
                throw new Error("ROOT_SHELL_REQUIRED");
            }
            if (shell.code !== 0 ||
                    String(values.result || "") !== "READY") {
                throw new Error(
                    String(values.result || "") ||
                    "CONTROL_SERVICE_START_OUTPUT_INCOMPLETE"
                );
            }

            result.controlServiceStarted =
                String(values.service_started || "0") === "1";
            result.runtimeFilesModified =
                result.controlServiceStarted ||
                result.orphanCleanupAttempted;
            pid = numberField(
                values,
                "pid",
                "CONTROL_SERVICE_PID_INVALID"
            );
            result.controlServicePid = pid;
            result.controlServiceProcessAlive = true;

            if (String(values.mode || "") !== "600") {
                throw new Error("ENDPOINT_MODE_INVALID");
            }
            result.endpointModeValidated = true;

            if (String(values.real || "") !==
                    runtimeRoot() +
                    "/runtime/control/control_endpoint.json") {
                throw new Error(
                    "ENDPOINT_CANONICAL_PATH_MISMATCH"
                );
            }
            result.endpointFileCanonical = true;

            endpoint = decodeEndpoint(values.data);
            if (Number(endpoint.schemaVersion) !== 1 ||
                    Number(endpoint.runtimePid) !== pid ||
                    String(endpoint.serverClass || "") !==
                        SERVER_CLASS) {
                throw new Error("ENDPOINT_SCHEMA_INVALID");
            }
            result.endpointSchemaValidated = true;

            result.controlServiceCommandValidated =
                String(values.command_match || "0") === "1";
            if (!result.controlServiceCommandValidated) {
                throw new Error(
                    "RUNTIME_PROCESS_COMMAND_MISMATCH"
                );
            }

            endpointUid = numberField(
                values,
                "uid",
                "ENDPOINT_METADATA_INVALID"
            );
            endpointGid = numberField(
                values,
                "gid",
                "ENDPOINT_METADATA_INVALID"
            );
            uidEffective = numberField(
                values,
                "uid_effective",
                "RUNTIME_PROCESS_UID_INVALID"
            );
            uidFs = numberField(
                values,
                "uid_fs",
                "RUNTIME_PROCESS_UID_INVALID"
            );
            gidEffective = numberField(
                values,
                "gid_effective",
                "RUNTIME_PROCESS_GID_INVALID"
            );
            gidFs = numberField(
                values,
                "gid_fs",
                "RUNTIME_PROCESS_GID_INVALID"
            );

            result.controlServiceOwnerValidated =
                (endpointUid === uidEffective ||
                    endpointUid === uidFs) &&
                (endpointGid === gidEffective ||
                    endpointGid === gidFs);
            if (!result.controlServiceOwnerValidated) {
                throw new Error(
                    "ENDPOINT_RUNTIME_OWNER_MISMATCH"
                );
            }
            result.endpointContractReady = true;

            socketName = String(endpoint.socketName || "");
            token = String(endpoint.token || "");
            endpoint = null;

            if (!socketName || /[\r\n\0]/.test(socketName)) {
                throw new Error(
                    "ENDPOINT_SOCKET_NAME_INVALID"
                );
            }
            if (token.length < 16 || /[\r\n\0]/.test(token)) {
                throw new Error("ENDPOINT_TOKEN_INVALID");
            }

            result.socketNameValueRead = true;
            result.tokenValueRead = true;
            correlation = correlationValue();

            socket = new LocalSocket();
            socket.setSoTimeout(2000);
            result.socketConnectionAttempted = true;
            socket.connect(
                new LocalSocketAddress(
                    socketName,
                    LocalSocketAddress.Namespace.ABSTRACT
                ),
                1500
            );
            result.socketConnected = true;

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
            writer.flush();
            result.requestSent = true;
            result.requestCount = 1;

            reader = new BufferedReader(
                new InputStreamReader(
                    socket.getInputStream(),
                    "UTF-8"
                )
            );
            responseStatus = reader.readLine();
            responseCorrelation = reader.readLine();
            result.responseStatus =
                responseStatus === null ?
                    null : String(responseStatus);
            result.responseStatusMatched =
                String(responseStatus || "") === "PONG";
            result.correlationMatched =
                String(responseCorrelation || "") ===
                    correlation;

            if (!result.responseStatusMatched) {
                throw new Error(
                    "UNEXPECTED_RESPONSE_STATUS"
                );
            }
            if (!result.correlationMatched) {
                throw new Error(
                    "CORRELATION_ECHO_MISMATCH"
                );
            }

            result.controlServiceRemainsRunning = true;
            result.ok = true;
        } catch (failure) {
            result.error = errorText(failure).substring(0, 256);
            result.errorCode = (
                result.error.match(
                    /[A-Z][A-Z0-9_]{3,}/
                ) || [
                    "STAGE28_RETRY1_FAILED"
                ]
            )[0];
            result.controlServiceRemainsRunning =
                result.controlServiceProcessAlive &&
                !result.startupRollbackAttempted;
        } finally {
            closeQuietly(reader);
            closeQuietly(writer);
            result.socketClosed =
                socket !== null ?
                    closeQuietly(socket) : false;
            endpoint = null;
            socketName = null;
            token = null;
            correlation = null;
            responseStatus = null;
            responseCorrelation = null;
            result.sensitiveReferencesCleared = true;
            result.tokenValueExposed = false;
            result.socketNameValueExposed = false;
            result.coreStartInvoked = false;
            result.coreStopInvoked = false;
            result.tunCreated = false;
            result.routeModified = false;
            result.configModified = false;
            result.destructiveOperations = false;
            result.durationMs = now() - startedAt;
            result.timestamp = now();
        }
        return result;
    }

    try {
        return JSON.stringify(run());
    } catch (fatal) {
        return JSON.stringify({
            ok: false,
            project: "SingBoxHub",
            stage: "runtime_stage28_retry1",
            authorizationId: AUTHORIZATION_ID,
            authorizationConsumed: false,
            automaticRetryAllowed: false,
            coreStartInvoked: false,
            tunCreated: false,
            routeModified: false,
            configModified: false,
            destructiveOperations: false,
            errorCode: "STAGE28_RETRY1_FATAL",
            error: errorText(fatal),
            timestamp: now()
        });
    }
}());
