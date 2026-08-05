/* SingBoxHub Stage53 Runtime Core lifecycle integration probe. Rhino ES5 only. */
SBH.versions.runtimeCoreLifecycleIntegration = 1;

(function () {
    "use strict";

    var P = Packages;
    var Thread = P.java.lang.Thread;
    var Runnable = P.java.lang.Runnable;
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
    var originalFactory = SBH.navigation.pages[1];
    var originalStart = SBH.app.start;
    var W = SBH.widgets;
    var C = SBH.theme.colors;
    var busy = false;

    var AUTHORIZATION_ID =
        "stage53-runtime-core-lifecycle-integration-user-authorized-20260805";
    var SOURCE_RECOVERY_AUTHORIZATION_ID =
        "stage52-retry1-runtime-control-service-recovery-user-authorized-20260805";
    var SERVER_CLASS =
        "com.singboxhub.runtime.CoreRuntimeMain";
    var CLIENT_CLASS =
        "com.singboxhub.runtime.CoreClientMain";
    var SOCKET_READ_TIMEOUT_MS = 2500;
    var START_STABILIZATION_SECONDS = 4;
    var STOP_WAIT_SECONDS = 6;
    var CHECK_TIMEOUT_SECONDS = 30;

    function now() {
        return Number(P.java.lang.System.currentTimeMillis());
    }

    function quote(value) {
        return "'" + String(value).replace(/'/g, "'\\''") + "'";
    }

    function contextValue(data, key) {
        var value = data.get(String(key));
        return value === null || value === undefined ?
            "" : String(value);
    }

    function marker(raw, name) {
        var lines = String(raw || "").split(/\r?\n/);
        var prefix = "__SBH_" + String(name) + "__=";
        var index;
        var line;

        for (index = lines.length - 1; index >= 0; index -= 1) {
            line = String(lines[index]);
            if (line.indexOf(prefix) === 0) {
                return line.substring(prefix.length);
            }
        }
        return null;
    }

    function yes(raw, name) {
        return marker(raw, name) === "1";
    }

    function numberValue(raw, name) {
        var value = marker(raw, name);
        var parsed = Number(value);
        return value !== null && isFinite(parsed) ? parsed : null;
    }

    function executeShell(command, purpose) {
        var action = ShellCommand.newBuilder()
            .setCommand(String(command))
            .setSingleShot(true)
            .setId(
                "SingBoxHub#Stage53#" + String(purpose) + "#" +
                String(SBH.util.randomToken())
            )
            .build();
        var result = shortx.executeAction(action);
        var data = result.contextData;
        var stdout = contextValue(data, "shellOut");
        var stderr = contextValue(data, "shellErr");

        return {
            code: Number(data.get("shellCode")),
            output: stdout + (stderr ? "\n" + stderr : "")
        };
    }

    function runtimeRoot() {
        return String(shortx.getShortXDir()) + "/SingBoxHub";
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

    function randomHex(byteCount) {
        var random = new SecureRandom();
        var bytes = ReflectArray.newInstance(JavaByte.TYPE, byteCount);
        var output = [];
        var index;
        var value;
        var part;

        random.nextBytes(bytes);
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

    function decodeEndpoint(value) {
        var bytes = null;
        var text = null;
        try {
            bytes = Base64.decode(String(value), Base64.DEFAULT);
            text = String(new JavaString(bytes, "UTF-8"));
            return JSON.parse(text);
        } catch (error) {
            throw new Error("ENDPOINT_JSON_PARSE_FAILED");
        } finally {
            bytes = null;
            text = null;
        }
    }

    function errorCode(error) {
        var text;
        var match;
        try {
            text = String(SBH.util.errorText(error));
        } catch (ignored) {
            text = String(error);
        }
        match = text.match(/[A-Z][A-Z0-9_]{3,}/);
        return match ? String(match[0]) :
            "CORE_LIFECYCLE_INTEGRATION_FAILED";
    }

    function safeStatus(value) {
        value = String(value || "");
        value = value.replace(/[^A-Za-z0-9_.:-]/g, "_");
        return value.substring(0, 64);
    }

    function statusRejected(value) {
        var text = String(value || "").toUpperCase();
        return !text ||
            /ERROR|FAILED|FAILURE|INVALID|DENIED|UNAUTHORIZED|UNKNOWN_COMMAND/.test(text);
    }

    function resourceFunctions() {
        return [
            "rule4_count(){ ip -4 rule show 2>/dev/null | awk '" +
                "$1 ~ /^[0-9]+:$/ {p=$1; sub(/:$/,\"\",p); " +
                "if (p>=8800 && p<=8815) c++} END{print c+0}'; }",
            "rule6_count(){ ip -6 rule show 2>/dev/null | awk '" +
                "$1 ~ /^[0-9]+:$/ {p=$1; sub(/:$/,\"\",p); " +
                "if (p>=8800 && p<=8815) c++} END{print c+0}'; }",
            "route4_count(){ ip -4 route show table 20240 2>/dev/null | " +
                "awk 'NF{c++} END{print c+0}'; }",
            "route6_count(){ ip -6 route show table 20240 2>/dev/null | " +
                "awk 'NF{c++} END{print c+0}'; }"
        ];
    }

    function identityFunctions() {
        return [
            "match_core(){ " +
                "P=\"$1\"; [ -r \"/proc/$P/cmdline\" ] || return 1; " +
                "A0=$(tr '\\000' '\\n' < \"/proc/$P/cmdline\" 2>/dev/null | sed -n '1p'); " +
                "A1=$(tr '\\000' '\\n' < \"/proc/$P/cmdline\" 2>/dev/null | sed -n '2p'); " +
                "A2=$(tr '\\000' '\\n' < \"/proc/$P/cmdline\" 2>/dev/null | sed -n '3p'); " +
                "A3=$(tr '\\000' '\\n' < \"/proc/$P/cmdline\" 2>/dev/null | sed -n '4p'); " +
                "[ \"$A0\" = \"$BIN\" ] && [ \"$A1\" = run ] && " +
                "[ \"$A2\" = -c ] && [ \"$A3\" = \"$CFG\" ]; }",
            "core_snapshot(){ " +
                "COUNT=0; PID=0; " +
                "for X in /proc/[0-9]*/cmdline; do " +
                    "[ -r \"$X\" ] || continue; P=${X#/proc/}; P=${P%/cmdline}; " +
                    "if match_core \"$P\"; then COUNT=$((COUNT + 1)); PID=\"$P\"; fi; " +
                "done; }",
            "match_control(){ " +
                "P=\"$1\"; [ -r \"/proc/$P/cmdline\" ] || return 1; " +
                "V=$(tr '\\000' ' ' < \"/proc/$P/cmdline\" 2>/dev/null); " +
                "case \"$V\" in *\"$SERVER\"*\"$CFG\"*\"$WORK\"*) return 0;; " +
                "*) return 1;; esac; }"
        ];
    }

    function checkFunction() {
        return "check_config(){ " +
            "if command -v timeout >/dev/null 2>&1; then " +
                "timeout " + String(CHECK_TIMEOUT_SECONDS) +
                "s \"$BIN\" check -c \"$CFG\" >/dev/null 2>&1; " +
            "else \"$BIN\" check -c \"$CFG\" >/dev/null 2>&1; fi; }";
    }

    function pathSet() {
        var root = runtimeRoot();
        return {
            root: root,
            configDir: root + "/config",
            config: root + "/config/runtime-tun.json",
            binary: root + "/bin/sing-box",
            state: root + "/state",
            logs: root + "/logs",
            runtimeLog: root + "/logs/runtime-production.log",
            runtimeJar:
                root + "/runtime/core/SingBoxHubCoreRuntime.jar",
            work: root + "/runtime/core/work",
            control: root + "/runtime/control",
            endpoint:
                root + "/runtime/control/control_endpoint.json",
            recoveryAudit:
                root + "/state/control-service-last-recovery.json",
            lifecycleAudit:
                root + "/state/core-lifecycle-integration-last.json",
            lifecycleAuditTemp:
                root + "/state/.core-lifecycle-integration-" +
                randomHex(8) + ".tmp"
        };
    }

    function buildPreflightCommand(paths) {
        var lines = [
            "umask 077",
            "ROOT=" + quote(paths.root),
            "D=" + quote(paths.configDir),
            "CFG=" + quote(paths.config),
            "BIN=" + quote(paths.binary),
            "STATE=" + quote(paths.state),
            "LOGS=" + quote(paths.logs),
            "RUNTIME_LOG=" + quote(paths.runtimeLog),
            "JAR=" + quote(paths.runtimeJar),
            "WORK=" + quote(paths.work),
            "CTRL=" + quote(paths.control),
            "ENDPOINT=" + quote(paths.endpoint),
            "RECOVERY_AUDIT=" + quote(paths.recoveryAudit),
            "SERVER=" + quote(SERVER_CLASS),
            "GATE=none; CODE=0",
            "finish(){ printf '__SBH_GATE__=%s\\n' \"$GATE\"; printf '__SBH_CODE__=%s\\n' \"$CODE\"; printf '__SBH_PREFLIGHT_DONE__=1\\n'; exit 0; }",
            "fail(){ GATE=\"$1\"; CODE=\"$2\"; finish; }"
        ];

        lines = lines.concat(resourceFunctions());
        lines = lines.concat(identityFunctions());
        lines.push(checkFunction());
        lines = lines.concat([
            "UIDV=$(id -u 2>/dev/null)",
            "[ \"$UIDV\" = 0 ] || fail root_uid 701",
            "[ -d \"$ROOT\" ] && [ ! -L \"$ROOT\" ] || fail runtime_root 702",
            "[ -d \"$D\" ] && [ ! -L \"$D\" ] || fail config_directory 703",
            "[ -d \"$STATE\" ] && [ ! -L \"$STATE\" ] || fail state_directory 704",
            "[ \"$(stat -c %a \"$STATE\" 2>/dev/null)\" = 700 ] || fail state_mode 705",
            "[ \"$(stat -c %u \"$STATE\" 2>/dev/null)\" = 0 ] && [ \"$(stat -c %g \"$STATE\" 2>/dev/null)\" = 0 ] || fail state_owner 706",
            "[ -d \"$LOGS\" ] && [ ! -L \"$LOGS\" ] || fail logs_directory 707",
            "[ -d \"$CTRL\" ] && [ ! -L \"$CTRL\" ] || fail control_directory 708",
            "[ -d \"$WORK\" ] && [ ! -L \"$WORK\" ] || fail work_directory 709",
            "[ -f \"$JAR\" ] && [ ! -L \"$JAR\" ] || fail runtime_jar 710",
            "[ -f \"$BIN\" ] && [ -x \"$BIN\" ] && [ ! -L \"$BIN\" ] || fail singbox_binary 711",
            "[ -f \"$CFG\" ] && [ ! -L \"$CFG\" ] || fail production_config 712",
            "[ \"$(stat -c %a \"$CFG\" 2>/dev/null)\" = 600 ] && [ \"$(stat -c %u \"$CFG\" 2>/dev/null)\" = 0 ] && [ \"$(stat -c %g \"$CFG\" 2>/dev/null)\" = 0 ] || fail production_config_metadata 713",
            "SC=0; STAGE=''",
            "for F in \"$D\"/.runtime-tun.json.stage-*; do [ -e \"$F\" ] || continue; SC=$((SC + 1)); STAGE=\"$F\"; done",
            "[ \"$SC\" = 1 ] || fail staging_count 714",
            "[ -f \"$STAGE\" ] && [ ! -L \"$STAGE\" ] || fail staging_file 715",
            "CH=$(sha256sum \"$CFG\" 2>/dev/null | awk '{print $1}')",
            "CB=$(stat -c %s \"$CFG\" 2>/dev/null || echo -1)",
            "SH=$(sha256sum \"$STAGE\" 2>/dev/null | awk '{print $1}')",
            "SB=$(stat -c %s \"$STAGE\" 2>/dev/null || echo -1)",
            "[ -n \"$CH\" ] && [ \"$CH\" = \"$SH\" ] && [ \"$CB\" = \"$SB\" ] || fail production_staging_lineage 716",
            "check_config; CHECK=$?",
            "[ \"$CHECK\" = 0 ] || fail production_config_check 717",
            "[ -f \"$RECOVERY_AUDIT\" ] && [ ! -L \"$RECOVERY_AUDIT\" ] || fail recovery_audit_missing 718",
            "[ \"$(stat -c %a \"$RECOVERY_AUDIT\" 2>/dev/null)\" = 600 ] && [ \"$(stat -c %u \"$RECOVERY_AUDIT\" 2>/dev/null)\" = 0 ] && [ \"$(stat -c %g \"$RECOVERY_AUDIT\" 2>/dev/null)\" = 0 ] || fail recovery_audit_metadata 719",
            "[ -f \"$ENDPOINT\" ] && [ ! -L \"$ENDPOINT\" ] || fail endpoint_missing 720",
            "[ \"$(stat -c %a \"$ENDPOINT\" 2>/dev/null)\" = 600 ] && [ \"$(stat -c %u \"$ENDPOINT\" 2>/dev/null)\" = 0 ] && [ \"$(stat -c %g \"$ENDPOINT\" 2>/dev/null)\" = 0 ] || fail endpoint_metadata 721",
            "[ \"$(readlink -f \"$ENDPOINT\" 2>/dev/null)\" = \"$ENDPOINT\" ] || fail endpoint_canonical 722",
            "CPID=$(sed -n 's/.*\"runtimePid\"[[:space:]]*:[[:space:]]*\\([0-9][0-9]*\\).*/\\1/p' \"$ENDPOINT\" | sed -n '1p')",
            "case \"$CPID\" in ''|*[!0-9]*) fail endpoint_pid_invalid 723;; esac",
            "kill -0 \"$CPID\" 2>/dev/null || fail control_service_not_alive 724",
            "match_control \"$CPID\" || fail control_service_identity 725",
            "CUID=$(awk '/^Uid:/ {print $2; exit}' \"/proc/$CPID/status\" 2>/dev/null)",
            "CGID=$(awk '/^Gid:/ {print $2; exit}' \"/proc/$CPID/status\" 2>/dev/null)",
            "[ \"$CUID\" = 0 ] && [ \"$CGID\" = 0 ] || fail control_service_owner 726",
            "core_snapshot",
            "[ \"$COUNT\" = 0 ] || fail core_already_running 727",
            "TUN=0; [ -e /sys/class/net/sbh-tun0 ] && TUN=1",
            "R4=$(rule4_count); R6=$(rule6_count); RT4=$(route4_count); RT6=$(route6_count)",
            "[ \"$TUN\" = 0 ] && [ \"$R4\" = 0 ] && [ \"$R6\" = 0 ] && [ \"$RT4\" = 0 ] && [ \"$RT6\" = 0 ] || fail reserved_network_resources_present 728",
            "EP_DATA=$(toybox base64 \"$ENDPOINT\" 2>/dev/null | tr -d '\\r\\n')",
            "[ -n \"$EP_DATA\" ] || fail endpoint_read 729",
            "printf '__SBH_CH__=%s\\n' \"$CH\"",
            "printf '__SBH_CB__=%s\\n' \"$CB\"",
            "printf '__SBH_CHECK__=%s\\n' \"$CHECK\"",
            "printf '__SBH_CPID__=%s\\n' \"$CPID\"",
            "printf '__SBH_CUID__=%s\\n' \"$CUID\"",
            "printf '__SBH_CGID__=%s\\n' \"$CGID\"",
            "printf '__SBH_CORE_COUNT__=%s\\n' \"$COUNT\"",
            "printf '__SBH_TUN__=%s\\n' \"$TUN\"",
            "printf '__SBH_RULE4__=%s\\n' \"$R4\"",
            "printf '__SBH_RULE6__=%s\\n' \"$R6\"",
            "printf '__SBH_ROUTE4__=%s\\n' \"$RT4\"",
            "printf '__SBH_ROUTE6__=%s\\n' \"$RT6\"",
            "printf '__SBH_EP_DATA__=%s\\n' \"$EP_DATA\"",
            "printf '__SBH_PREFLIGHT_OK__=1\\n'",
            "finish"
        ]);
        return lines.join("; ");
    }

    function validateEndpoint(endpoint, paths, expectedPid) {
        if (!endpoint || Number(endpoint.schemaVersion) !== 1) {
            throw new Error("ENDPOINT_SCHEMA_INVALID");
        }
        if (Number(endpoint.runtimePid) !== Number(expectedPid) ||
                Number(endpoint.runtimePid) <= 1) {
            throw new Error("ENDPOINT_RUNTIME_PID_INVALID");
        }
        if (String(endpoint.serverClass || "") !== SERVER_CLASS ||
                String(endpoint.clientClass || "") !== CLIENT_CLASS) {
            throw new Error("ENDPOINT_CLASS_CONTRACT_INVALID");
        }
        if (String(endpoint.runtimeJar || "") !== paths.runtimeJar ||
                String(endpoint.binaryPath || "") !== paths.binary ||
                String(endpoint.configPath || "") !== paths.config ||
                String(endpoint.workingDirectory || "") !== paths.work) {
            throw new Error("ENDPOINT_PATH_CONTRACT_INVALID");
        }
        if (!endpoint.socketName ||
                String(endpoint.socketName).length > 128 ||
                /[\r\n\u0000]/.test(String(endpoint.socketName))) {
            throw new Error("ENDPOINT_SOCKET_NAME_INVALID");
        }
        if (!endpoint.token ||
                String(endpoint.token).length < 16 ||
                String(endpoint.token).length > 256 ||
                /[\r\n\u0000]/.test(String(endpoint.token))) {
            throw new Error("ENDPOINT_TOKEN_INVALID");
        }
        return endpoint;
    }

    function sendCommand(endpoint, command) {
        var socket = null;
        var writer = null;
        var reader = null;
        var correlation = "sbh53-" + now() + "-" + randomHex(12);
        var statusLine = null;
        var correlationLine = null;
        var socketClosed = false;

        try {
            socket = new LocalSocket();
            socket.connect(
                new LocalSocketAddress(
                    String(endpoint.socketName),
                    LocalSocketAddress.Namespace.ABSTRACT
                )
            );
            socket.setSoTimeout(SOCKET_READ_TIMEOUT_MS);
            writer = new BufferedWriter(
                new OutputStreamWriter(
                    socket.getOutputStream(),
                    "UTF-8"
                )
            );
            writer.write(String(endpoint.token));
            writer.newLine();
            writer.write(correlation);
            writer.newLine();
            writer.write(String(command));
            writer.newLine();
            writer.flush();
            reader = new BufferedReader(
                new InputStreamReader(
                    socket.getInputStream(),
                    "UTF-8"
                )
            );
            statusLine = reader.readLine();
            correlationLine = reader.readLine();
            if (String(correlationLine || "") !== correlation) {
                throw new Error(
                    String(command) + "_CORRELATION_ECHO_MISMATCH"
                );
            }
            if (statusRejected(statusLine)) {
                throw new Error(
                    String(command) + "_RESPONSE_REJECTED_" +
                    safeStatus(statusLine)
                );
            }
            return {
                ok: true,
                command: String(command),
                responseStatus: safeStatus(statusLine),
                responseStatusReturned:
                    statusLine !== null,
                correlationMatched: true,
                requestCount: 1
            };
        } finally {
            closeQuietly(reader);
            closeQuietly(writer);
            socketClosed = socket !== null ?
                closeQuietly(socket) : false;
            correlation = null;
            statusLine = null;
            correlationLine = null;
        }
    }

    function buildStartedObservationCommand(paths, controlPid) {
        var lines = [
            "umask 077",
            "CFG=" + quote(paths.config),
            "BIN=" + quote(paths.binary),
            "WORK=" + quote(paths.work),
            "SERVER=" + quote(SERVER_CLASS),
            "CPID=" + quote(String(controlPid))
        ];
        lines = lines.concat(resourceFunctions());
        lines = lines.concat(identityFunctions());
        lines = lines.concat([
            "I=0; COUNT=0; PID=0",
            "while [ \"$I\" -lt 6 ]; do core_snapshot; [ \"$COUNT\" = 1 ] && break; sleep 1; I=$((I + 1)); done",
            "START_VISIBLE=0; [ \"$COUNT\" = 1 ] && START_VISIBLE=1",
            "if [ \"$START_VISIBLE\" = 1 ]; then UIDV=$(awk '/^Uid:/ {print $2; exit}' \"/proc/$PID/status\" 2>/dev/null); STATEV=$(awk '/^State:/ {print $2; exit}' \"/proc/$PID/status\" 2>/dev/null); else UIDV=-1; STATEV=none; fi",
            "STABLE=0",
            "if [ \"$START_VISIBLE\" = 1 ]; then sleep " + String(START_STABILIZATION_SECONDS) + "; core_snapshot; if [ \"$COUNT\" = 1 ] && [ \"$PID\" != 0 ] && match_core \"$PID\" && [ \"$UIDV\" = 0 ] && [ \"$STATEV\" != Z ]; then STABLE=1; fi; fi",
            "CONTROL_ALIVE=0; if kill -0 \"$CPID\" 2>/dev/null && match_control \"$CPID\"; then CONTROL_ALIVE=1; fi",
            "TUN=0; [ -e /sys/class/net/sbh-tun0 ] && TUN=1",
            "R4=$(rule4_count); R6=$(rule6_count); RT4=$(route4_count); RT6=$(route6_count)",
            "printf '__SBH_STARTED_DONE__=1\\n'",
            "printf '__SBH_START_VISIBLE__=%s\\n' \"$START_VISIBLE\"",
            "printf '__SBH_PID__=%s\\n' \"$PID\"",
            "printf '__SBH_COUNT__=%s\\n' \"$COUNT\"",
            "printf '__SBH_UIDV__=%s\\n' \"$UIDV\"",
            "printf '__SBH_STATEV__=%s\\n' \"$STATEV\"",
            "printf '__SBH_STABLE__=%s\\n' \"$STABLE\"",
            "printf '__SBH_CONTROL_ALIVE__=%s\\n' \"$CONTROL_ALIVE\"",
            "printf '__SBH_TUN__=%s\\n' \"$TUN\"",
            "printf '__SBH_RULE4__=%s\\n' \"$R4\"",
            "printf '__SBH_RULE6__=%s\\n' \"$R6\"",
            "printf '__SBH_ROUTE4__=%s\\n' \"$RT4\"",
            "printf '__SBH_ROUTE6__=%s\\n' \"$RT6\"",
            "exit 0"
        ]);
        return lines.join("; ");
    }

    function buildStoppedObservationCommand(paths, controlPid) {
        var lines = [
            "umask 077",
            "CFG=" + quote(paths.config),
            "BIN=" + quote(paths.binary),
            "WORK=" + quote(paths.work),
            "SERVER=" + quote(SERVER_CLASS),
            "CPID=" + quote(String(controlPid))
        ];
        lines = lines.concat(resourceFunctions());
        lines = lines.concat(identityFunctions());
        lines = lines.concat([
            "I=0; core_snapshot",
            "while [ \"$I\" -lt " + String(STOP_WAIT_SECONDS) + " ] && [ \"$COUNT\" -ne 0 ]; do sleep 1; I=$((I + 1)); core_snapshot; done",
            "CONTROL_ALIVE=0; if kill -0 \"$CPID\" 2>/dev/null && match_control \"$CPID\"; then CONTROL_ALIVE=1; fi",
            "TUN=0; [ -e /sys/class/net/sbh-tun0 ] && TUN=1",
            "R4=$(rule4_count); R6=$(rule6_count); RT4=$(route4_count); RT6=$(route6_count)",
            "printf '__SBH_STOPPED_DONE__=1\\n'",
            "printf '__SBH_COUNT__=%s\\n' \"$COUNT\"",
            "printf '__SBH_PID__=%s\\n' \"$PID\"",
            "printf '__SBH_CONTROL_ALIVE__=%s\\n' \"$CONTROL_ALIVE\"",
            "printf '__SBH_TUN__=%s\\n' \"$TUN\"",
            "printf '__SBH_RULE4__=%s\\n' \"$R4\"",
            "printf '__SBH_RULE6__=%s\\n' \"$R6\"",
            "printf '__SBH_ROUTE4__=%s\\n' \"$RT4\"",
            "printf '__SBH_ROUTE6__=%s\\n' \"$RT6\"",
            "exit 0"
        ]);
        return lines.join("; ");
    }

    function buildRollbackCommand(paths, corePid) {
        var lines = [
            "umask 077",
            "CFG=" + quote(paths.config),
            "BIN=" + quote(paths.binary),
            "PID=" + quote(String(corePid)),
            "IDENTITY=0; TERM_SENT=0; KILL_SENT=0; STOPPED=0"
        ];
        lines = lines.concat(identityFunctions());
        lines = lines.concat([
            "if kill -0 \"$PID\" 2>/dev/null && match_core \"$PID\"; then IDENTITY=1; kill -TERM \"$PID\" 2>/dev/null && TERM_SENT=1; I=0; while [ \"$I\" -lt 3 ] && kill -0 \"$PID\" 2>/dev/null; do sleep 1; I=$((I + 1)); done; if kill -0 \"$PID\" 2>/dev/null && match_core \"$PID\"; then kill -KILL \"$PID\" 2>/dev/null && KILL_SENT=1; sleep 1; fi; fi",
            "if ! kill -0 \"$PID\" 2>/dev/null; then STOPPED=1; fi",
            "core_snapshot",
            "printf '__SBH_ROLLBACK_DONE__=1\\n'",
            "printf '__SBH_IDENTITY__=%s\\n' \"$IDENTITY\"",
            "printf '__SBH_TERM_SENT__=%s\\n' \"$TERM_SENT\"",
            "printf '__SBH_KILL_SENT__=%s\\n' \"$KILL_SENT\"",
            "printf '__SBH_STOPPED__=%s\\n' \"$STOPPED\"",
            "printf '__SBH_COUNT__=%s\\n' \"$COUNT\"",
            "exit 0"
        ]);
        return lines.join("; ");
    }

    function buildAuditCommand(
        paths,
        controlPid,
        corePid,
        startStatus,
        stopStatus,
        pingStatus
    ) {
        return [
            "umask 077",
            "AUDIT=" + quote(paths.lifecycleAudit),
            "TMP=" + quote(paths.lifecycleAuditTemp),
            "AUTH=" + quote(AUTHORIZATION_ID),
            "SOURCE=" + quote(SOURCE_RECOVERY_AUTHORIZATION_ID),
            "CPID=" + quote(String(controlPid)),
            "PID=" + quote(String(corePid)),
            "START_STATUS=" + quote(safeStatus(startStatus)),
            "STOP_STATUS=" + quote(safeStatus(stopStatus)),
            "PING_STATUS=" + quote(safeStatus(pingStatus)),
            "TS=$(date +%s 2>/dev/null || echo 0)",
            "printf '{\\\"schemaVersion\\\":1,\\\"stage\\\":53,\\\"authorizationId\\\":\\\"%s\\\",\\\"sourceRecoveryAuthorizationId\\\":\\\"%s\\\",\\\"runtimePid\\\":%s,\\\"corePid\\\":%s,\\\"startResponseStatus\\\":\\\"%s\\\",\\\"stopResponseStatus\\\":\\\"%s\\\",\\\"finalPingStatus\\\":\\\"%s\\\",\\\"finalCoreState\\\":\\\"stopped\\\",\\\"timestampSeconds\\\":%s}\\n' \"$AUTH\" \"$SOURCE\" \"$CPID\" \"$PID\" \"$START_STATUS\" \"$STOP_STATUS\" \"$PING_STATUS\" \"$TS\" > \"$TMP\" || exit 741",
            "chmod 600 \"$TMP\" || exit 742",
            "chown 0:0 \"$TMP\" >/dev/null 2>&1 || exit 743",
            "mv -f \"$TMP\" \"$AUDIT\" || exit 744",
            "[ -f \"$AUDIT\" ] && [ ! -L \"$AUDIT\" ] || exit 745",
            "[ \"$(stat -c %a \"$AUDIT\" 2>/dev/null)\" = 600 ] && [ \"$(stat -c %u \"$AUDIT\" 2>/dev/null)\" = 0 ] && [ \"$(stat -c %g \"$AUDIT\" 2>/dev/null)\" = 0 ] || exit 746",
            "printf '__SBH_AUDIT_DONE__=1\\n'",
            "printf '__SBH_AUDIT_BYTES__=%s\\n' \"$(stat -c %s \"$AUDIT\" 2>/dev/null || echo -1)\"",
            "exit 0"
        ].join("; ");
    }

    function runLifecycle() {
        var paths = pathSet();
        var preflight = null;
        var startCommand = null;
        var startedObservation = null;
        var stopCommand = null;
        var stoppedObservation = null;
        var finalPing = null;
        var audit = null;
        var rollback = null;
        var endpoint = null;
        var endpointData = null;
        var controlPid = null;
        var corePid = null;
        var coreStartInvoked = false;
        var coreStopInvoked = false;
        var rollbackInvoked = false;
        var rollbackStopped = false;
        var failureCode = null;
        var failureText = null;
        var startedAt = now();
        var success = false;

        try {
            preflight = executeShell(
                buildPreflightCommand(paths),
                "preflight"
            );
            if (!yes(preflight.output, "PREFLIGHT_DONE") ||
                    !yes(preflight.output, "PREFLIGHT_OK")) {
                throw new Error(
                    marker(preflight.output, "GATE") ||
                    "CORE_LIFECYCLE_PREFLIGHT_FAILED"
                );
            }
            controlPid = numberValue(
                preflight.output,
                "CPID"
            );
            endpointData = marker(
                preflight.output,
                "EP_DATA"
            );
            if (controlPid === null ||
                    endpointData === null ||
                    endpointData === "") {
                throw new Error("CONTROL_ENDPOINT_DATA_MISSING");
            }
            endpoint = validateEndpoint(
                decodeEndpoint(endpointData),
                paths,
                controlPid
            );

            startCommand = sendCommand(endpoint, "START");
            coreStartInvoked = true;

            startedObservation = executeShell(
                buildStartedObservationCommand(
                    paths,
                    controlPid
                ),
                "observe-started"
            );
            if (!yes(startedObservation.output, "STARTED_DONE") ||
                    !yes(startedObservation.output, "START_VISIBLE") ||
                    numberValue(startedObservation.output, "COUNT") !== 1 ||
                    numberValue(startedObservation.output, "UIDV") !== 0 ||
                    marker(startedObservation.output, "STATEV") === "Z" ||
                    !yes(startedObservation.output, "STABLE") ||
                    !yes(startedObservation.output, "CONTROL_ALIVE") ||
                    yes(startedObservation.output, "TUN") ||
                    numberValue(startedObservation.output, "RULE4") !== 0 ||
                    numberValue(startedObservation.output, "RULE6") !== 0 ||
                    numberValue(startedObservation.output, "ROUTE4") !== 0 ||
                    numberValue(startedObservation.output, "ROUTE6") !== 0) {
                corePid = numberValue(
                    startedObservation.output,
                    "PID"
                );
                throw new Error(
                    "CORE_START_RECONCILIATION_FAILED"
                );
            }
            corePid = numberValue(
                startedObservation.output,
                "PID"
            );
            if (corePid === null || corePid <= 1) {
                throw new Error("CORE_PID_INVALID");
            }

            stopCommand = sendCommand(
                endpoint,
                "STOP_CORE"
            );
            coreStopInvoked = true;

            stoppedObservation = executeShell(
                buildStoppedObservationCommand(
                    paths,
                    controlPid
                ),
                "observe-stopped"
            );
            if (!yes(stoppedObservation.output, "STOPPED_DONE") ||
                    numberValue(stoppedObservation.output, "COUNT") !== 0 ||
                    !yes(stoppedObservation.output, "CONTROL_ALIVE") ||
                    yes(stoppedObservation.output, "TUN") ||
                    numberValue(stoppedObservation.output, "RULE4") !== 0 ||
                    numberValue(stoppedObservation.output, "RULE6") !== 0 ||
                    numberValue(stoppedObservation.output, "ROUTE4") !== 0 ||
                    numberValue(stoppedObservation.output, "ROUTE6") !== 0) {
                throw new Error(
                    "CORE_STOP_RECONCILIATION_FAILED"
                );
            }

            finalPing = sendCommand(endpoint, "PING");
            if (String(finalPing.responseStatus) !== "PONG") {
                throw new Error("FINAL_PING_NOT_PONG");
            }

            audit = executeShell(
                buildAuditCommand(
                    paths,
                    controlPid,
                    corePid,
                    startCommand.responseStatus,
                    stopCommand.responseStatus,
                    finalPing.responseStatus
                ),
                "audit"
            );
            if (!yes(audit.output, "AUDIT_DONE")) {
                throw new Error(
                    "LIFECYCLE_AUDIT_WRITE_FAILED"
                );
            }
            success = true;
        } catch (error) {
            failureCode = errorCode(error);
            try {
                failureText = String(
                    SBH.util.errorText(error)
                );
            } catch (ignoredText) {
                failureText = String(error);
            }
            if (coreStartInvoked &&
                    corePid !== null &&
                    corePid > 1) {
                rollbackInvoked = true;
                try {
                    rollback = executeShell(
                        buildRollbackCommand(
                            paths,
                            corePid
                        ),
                        "rollback"
                    );
                    rollbackStopped =
                        yes(rollback.output, "ROLLBACK_DONE") &&
                        yes(rollback.output, "STOPPED") &&
                        numberValue(
                            rollback.output,
                            "COUNT"
                        ) === 0;
                } catch (ignoredRollback) {
                    rollbackStopped = false;
                }
            }
        } finally {
            endpoint = null;
            endpointData = null;
        }

        return {
            ok: success,
            stage:
                "production_stage53_runtime_core_lifecycle_integration",
            authorizationId: AUTHORIZATION_ID,
            sourceRecoveryAuthorizationId:
                SOURCE_RECOVERY_AUTHORIZATION_ID,
            authorizationConsumed: true,
            automaticRetryAllowed: false,
            manualOnly: true,
            lifecycleTransactionMode:
                "authenticated_start_exact_reconcile_stop_final_ping",
            preflightPassed:
                preflight !== null &&
                yes(preflight.output, "PREFLIGHT_DONE") &&
                yes(preflight.output, "PREFLIGHT_OK"),
            blockingGate:
                success || preflight === null ?
                    null : marker(preflight.output, "GATE"),
            preflightCode:
                preflight === null ?
                    null : numberValue(
                        preflight.output,
                        "CODE"
                    ),
            productionConfigSha256:
                preflight === null ?
                    null : marker(
                        preflight.output,
                        "CH"
                    ),
            productionConfigByteCount:
                preflight === null ?
                    null : numberValue(
                        preflight.output,
                        "CB"
                    ),
            productionConfigCheckPassed:
                preflight !== null &&
                numberValue(
                    preflight.output,
                    "CHECK"
                ) === 0,
            controlServicePid: controlPid,
            controlServiceProcessAliveBefore:
                preflight !== null &&
                controlPid !== null,
            controlServiceOwnerValidated:
                preflight !== null &&
                numberValue(
                    preflight.output,
                    "CUID"
                ) === 0 &&
                numberValue(
                    preflight.output,
                    "CGID"
                ) === 0,
            controlServiceRemainsRunning:
                success ||
                (
                    stoppedObservation !== null &&
                    yes(
                        stoppedObservation.output,
                        "CONTROL_ALIVE"
                    )
                ),
            existingMatchingCoreCountBefore:
                preflight === null ?
                    null : numberValue(
                        preflight.output,
                        "CORE_COUNT"
                    ),
            startCommandSent:
                startCommand !== null,
            startRequestCount:
                startCommand === null ?
                    0 : startCommand.requestCount,
            startResponseStatus:
                startCommand === null ?
                    null : startCommand.responseStatus,
            startCorrelationMatched:
                startCommand !== null &&
                startCommand.correlationMatched === true,
            coreStartInvoked: coreStartInvoked,
            corePid: corePid,
            coreProcessVisible:
                startedObservation !== null &&
                yes(
                    startedObservation.output,
                    "START_VISIBLE"
                ),
            coreProcessIdentityValidated:
                startedObservation !== null &&
                numberValue(
                    startedObservation.output,
                    "COUNT"
                ) === 1,
            coreProcessOwnerUid:
                startedObservation === null ?
                    null : numberValue(
                        startedObservation.output,
                        "UIDV"
                    ),
            coreProcessState:
                startedObservation === null ?
                    null : marker(
                        startedObservation.output,
                        "STATEV"
                    ),
            startStabilizationSeconds:
                START_STABILIZATION_SECONDS,
            startStabilizationPassed:
                startedObservation !== null &&
                yes(
                    startedObservation.output,
                    "STABLE"
                ),
            stopCommandSent:
                stopCommand !== null,
            stopRequestCount:
                stopCommand === null ?
                    0 : stopCommand.requestCount,
            stopResponseStatus:
                stopCommand === null ?
                    null : stopCommand.responseStatus,
            stopCorrelationMatched:
                stopCommand !== null &&
                stopCommand.correlationMatched === true,
            coreStopInvoked: coreStopInvoked,
            matchingCoreCountAfter:
                stoppedObservation === null ?
                    null : numberValue(
                        stoppedObservation.output,
                        "COUNT"
                    ),
            finalCoreState:
                success ? "stopped" :
                    (
                        rollbackStopped ?
                            "stopped_after_exact_rollback" :
                            "unknown"
                    ),
            finalPingSent:
                finalPing !== null,
            finalPingResponseStatus:
                finalPing === null ?
                    null : finalPing.responseStatus,
            finalPingCorrelationMatched:
                finalPing !== null &&
                finalPing.correlationMatched === true,
            lifecycleAuditCreated:
                audit !== null &&
                yes(audit.output, "AUDIT_DONE"),
            lifecycleAuditRelativePath:
                audit !== null &&
                yes(audit.output, "AUDIT_DONE") ?
                    "state/core-lifecycle-integration-last.json" :
                    null,
            lifecycleAuditByteCount:
                audit === null ?
                    null : numberValue(
                        audit.output,
                        "AUDIT_BYTES"
                    ),
            tunInterfacePresentBefore:
                preflight !== null &&
                yes(preflight.output, "TUN"),
            tunInterfacePresentDuring:
                startedObservation !== null &&
                yes(
                    startedObservation.output,
                    "TUN"
                ),
            tunInterfacePresentAfter:
                stoppedObservation !== null &&
                yes(
                    stoppedObservation.output,
                    "TUN"
                ),
            reservedIpv4RuleCountAfter:
                stoppedObservation === null ?
                    null : numberValue(
                        stoppedObservation.output,
                        "RULE4"
                    ),
            reservedIpv6RuleCountAfter:
                stoppedObservation === null ?
                    null : numberValue(
                        stoppedObservation.output,
                        "RULE6"
                    ),
            reservedIpv4RouteCountAfter:
                stoppedObservation === null ?
                    null : numberValue(
                        stoppedObservation.output,
                        "ROUTE4"
                    ),
            reservedIpv6RouteCountAfter:
                stoppedObservation === null ?
                    null : numberValue(
                        stoppedObservation.output,
                        "ROUTE6"
                    ),
            reservedNetworkResourcesUnchanged:
                success,
            rollbackInvoked: rollbackInvoked,
            rollbackStoppedExactProcess:
                rollbackStopped,
            rollbackTermSignalSent:
                rollback !== null &&
                yes(
                    rollback.output,
                    "TERM_SENT"
                ),
            rollbackKillSignalSent:
                rollback !== null &&
                yes(
                    rollback.output,
                    "KILL_SENT"
                ),
            runtimeFilesModified:
                audit !== null &&
                yes(audit.output, "AUDIT_DONE"),
            configModified: false,
            stagingModified: false,
            tunCreated: false,
            routeModified: false,
            dnsModified: false,
            firewallModified: false,
            networkConnectivityTestInvoked: false,
            networkTrafficGeneratedByProbe: false,
            sensitiveReferencesCleared: true,
            tokenValueExposed: false,
            socketNameValueExposed: false,
            destructiveOperations: false,
            readyForProductionLifecycleUi: success,
            nextAuthorizedOperation:
                success ?
                    "runtime_production_lifecycle_ui_promotion" :
                    (
                        rollbackInvoked &&
                        !rollbackStopped ?
                            "reconcile_core_lifecycle_probe_state" :
                            "resolve_runtime_core_lifecycle_integration_gate"
                    ),
            errorCode:
                success ? null : failureCode,
            error:
                success || failureText === null ?
                    null :
                    String(failureText).substring(
                        0,
                        256
                    ),
            preflightShellCode:
                preflight === null ?
                    null : preflight.code,
            startedObservationShellCode:
                startedObservation === null ?
                    null : startedObservation.code,
            stoppedObservationShellCode:
                stoppedObservation === null ?
                    null : stoppedObservation.code,
            auditShellCode:
                audit === null ?
                    null : audit.code,
            shellCodeAuthoritative: false,
            shellTransportCodeAnomalous:
                (
                    preflight !== null &&
                    preflight.code !== 0
                ) || (
                    startedObservation !== null &&
                    startedObservation.code !== 0
                ) || (
                    stoppedObservation !== null &&
                    stoppedObservation.code !== 0
                ) || (
                    audit !== null &&
                    audit.code !== 0
                ),
            durationMs: now() - startedAt,
            timestamp: now()
        };
    }

    function runLifecycleAsync(callback) {
        if (typeof callback !== "function") {
            throw new Error(
                "Stage53 callback unavailable"
            );
        }
        if (busy) {
            callback({
                ok: false,
                stage:
                    "production_stage53_runtime_core_lifecycle_integration",
                errorCode:
                    "CORE_LIFECYCLE_INTEGRATION_ALREADY_RUNNING",
                timestamp: now()
            });
            return {
                accepted: false,
                busy: true
            };
        }

        busy = true;
        new Thread(
            new JavaAdapter(Runnable, {
                run: function () {
                    var output;
                    try {
                        output = runLifecycle();
                    } catch (error) {
                        output = {
                            ok: false,
                            stage:
                                "production_stage53_runtime_core_lifecycle_integration",
                            errorCode:
                                "CORE_LIFECYCLE_INTEGRATION_FAILED",
                            authorizationId:
                                AUTHORIZATION_ID,
                            authorizationConsumed: true,
                            automaticRetryAllowed: false,
                            coreStartInvoked: false,
                            coreStopInvoked: false,
                            tunCreated: false,
                            routeModified: false,
                            destructiveOperations: false,
                            timestamp: now()
                        };
                    }
                    busy = false;
                    SBH.handler.post(
                        new JavaAdapter(Runnable, {
                            run: function () {
                                callback(output);
                            }
                        })
                    );
                }
            }),
            "SingBoxHub-Stage53CoreLifecycleIntegration"
        ).start();

        return {
            accepted: true,
            busy: false
        };
    }

    function buildCard() {
        var card = W.card(17);
        var title = W.text(
            "Stage 53：Runtime Core 启停闭环",
            17,
            C.navy,
            true
        );
        var note = W.text(
            "通过已认证 Runtime 控制服务依次发送 START 和 STOP_CORE，" +
            "每一步都用 root Shell 精确核验 sing-box PID、uid、稳定性及网络资源边界，" +
            "停止后再发送一次 PING 并写入生命周期审计。最终状态必须为 Core 已停止、" +
            "控制服务仍运行。本阶段不创建 TUN，不修改路由、DNS 或防火墙。",
            11.4,
            C.secondary,
            false
        );
        var resultText = W.text(
            JSON.stringify({
                ready: true,
                authorizationId:
                    AUTHORIZATION_ID,
                sourceRecoveryAuthorizationId:
                    SOURCE_RECOVERY_AUTHORIZATION_ID,
                lifecycleTransaction:
                    "START -> exact reconcile -> STOP_CORE -> exact reconcile -> PING",
                startRequestMaximum: 1,
                stopRequestMaximum: 1,
                finalPingMaximum: 1,
                finalCoreStateRequired:
                    "stopped",
                controlServiceStopEnabled: false,
                tunEnabled: false,
                routeWriteEnabled: false,
                automaticRetryAllowed: false
            }, null, 2),
            10.3,
            C.secondary,
            false
        );
        var button = W.button(
            "验证 Runtime Core 启停闭环",
            "shield",
            C.orange,
            C.orangeSoft,
            function () {
                resultText.setText(
                    "正在执行 START、精确核验、STOP_CORE 和最终 PING。"
                );
                SBH.util.toast(
                    "正在验证 Runtime Core 启停闭环"
                );
                runLifecycleAsync(function (result) {
                    resultText.setText(
                        JSON.stringify(
                            result,
                            null,
                            2
                        )
                    );
                    SBH.util.toast(
                        result.ok === true ?
                            "Runtime Core 启停闭环验证通过" :
                            "Stage 53 存在待处理项"
                    );
                });
            }
        );

        card.setPadding(
            SBH.util.dp(14),
            SBH.util.dp(14),
            SBH.util.dp(14),
            SBH.util.dp(14)
        );
        card.addView(title);
        note.setPadding(
            0,
            SBH.util.dp(7),
            0,
            SBH.util.dp(8)
        );
        card.addView(note);
        resultText.setTextIsSelectable(true);
        card.addView(resultText);
        card.addView(
            button,
            W.margins(
                W.lp(W.MATCH, SBH.util.dp(44)),
                0,
                12,
                0,
                0
            )
        );
        return card;
    }

    if (typeof originalFactory !== "function" ||
            typeof originalStart !== "function") {
        throw new Error(
            "Stage53 dependencies unavailable"
        );
    }

    SBH.runtimeCoreLifecycleIntegration = {
        version: 1,
        runAsync: runLifecycleAsync,
        authorizationId: AUTHORIZATION_ID,
        sourceRecoveryAuthorizationId:
            SOURCE_RECOVERY_AUTHORIZATION_ID,
        manualOnly: true,
        automaticRetryAllowed: false,
        startRequestMaximum: 1,
        stopRequestMaximum: 1,
        finalPingMaximum: 1,
        finalCoreStateRequired: "stopped",
        controlServiceStopEnabled: false,
        tunEnabled: false,
        routeWriteEnabled: false
    };

    SBH.navigation.register(1, function (controller) {
        var view = originalFactory(controller);
        var content = view.getChildAt(0);
        content.addView(
            buildCard(),
            W.margins(
                W.lp(W.MATCH, W.WRAP),
                0,
                16,
                0,
                12
            )
        );
        return view;
    });

    SBH.app.start = function () {
        var output = originalStart();

        output.runtimeCoreLifecycleIntegrationVersion = 1;
        output.runtimeCoreLifecycleIntegrationReady = true;
        output.runtimeCoreLifecycleIntegrationAuthorizationId =
            AUTHORIZATION_ID;
        output.runtimeCoreLifecycleIntegrationManualOnly = true;
        output.runtimeCoreLifecycleIntegrationAutomaticRetry = false;
        output.runtimeCoreLifecycleIntegrationStartMaximum = 1;
        output.runtimeCoreLifecycleIntegrationStopMaximum = 1;
        output.runtimeCoreLifecycleIntegrationFinalPingMaximum = 1;
        output.runtimeCoreLifecycleIntegrationFinalCoreState =
            "stopped";
        output.runtimeCoreLifecycleIntegrationTunEnabled = false;
        output.runtimeCoreLifecycleIntegrationRouteWriteEnabled = false;
        output.writeOperationsLocked = false;
        output.destructiveOperations = false;
        return output;
    };
}());
