/* SingBoxHub Stage54 production lifecycle UI promotion. Rhino ES5 only. */
SBH.versions.runtimeProductionLifecycleUiPromotion = 1;

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
    var FrameLayout = P.android.widget.FrameLayout;
    var Gravity = P.android.view.Gravity;
    var originalHome = SBH.navigation.pages[0];
    var originalNodes = SBH.navigation.pages[1];
    var originalStart = SBH.app.start;
    var W = SBH.widgets;
    var C = SBH.theme.colors;
    var busy = false;
    var promoted = false;
    var lastSnapshot = null;

    var AUTHORIZATION_ID =
        "stage54-runtime-production-lifecycle-ui-promotion-user-authorized-20260805";
    var SOURCE_LIFECYCLE_AUTHORIZATION_ID =
        "stage53-retry4-runtime-core-lifecycle-controller-owned-user-authorized-20260805";
    var SERVER_CLASS =
        "com.singboxhub.runtime.CoreRuntimeMain";
    var CLIENT_CLASS =
        "com.singboxhub.runtime.CoreClientMain";
    var SOCKET_READ_TIMEOUT_MS = 2500;
    var START_DISCOVERY_SECONDS = 6;
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
                "SingBoxHub#Stage54#" + String(purpose) + "#" +
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
            "PRODUCTION_LIFECYCLE_UI_FAILED";
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

    function statusRunning(value) {
        value = String(value || "").toUpperCase();
        return value === "RUNNING" || value === "ALREADY_RUNNING";
    }

    function statusStopped(value) {
        value = String(value || "").toUpperCase();
        return value === "STOPPED" || value === "ALREADY_STOPPED";
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
            "match_control(){ " +
                "P=\"$1\"; [ -r \"/proc/$P/cmdline\" ] || return 1; " +
                "V=$(tr '\\000' ' ' < \"/proc/$P/cmdline\" 2>/dev/null); " +
                "case \"$V\" in *\"$SERVER\"*\"$CFG\"*\"$WORK\"*) return 0;; " +
                "*) return 1;; esac; }",
            "candidate_fields(){ " +
                "P=\"$1\"; X=\"/proc/$P/cmdline\"; " +
                "[ -r \"$X\" ] || return 1; " +
                "ARGS=$(tr '\\000' '\\n' < \"$X\" 2>/dev/null); " +
                "[ -n \"$ARGS\" ] || return 1; " +
                "A0=$(printf '%s\\n' \"$ARGS\" | sed -n '1p'); " +
                "BIDX=-1; CIDX=-1; IDX=0; " +
                "while IFS= read -r A; do " +
                    "[ \"$A\" = \"$BIN\" ] && [ \"$BIDX\" = -1 ] && BIDX=$IDX; " +
                    "[ \"$A\" = \"$CFG\" ] && [ \"$CIDX\" = -1 ] && CIDX=$IDX; " +
                    "IDX=$((IDX + 1)); " +
                "done <<EOA\n$ARGS\nEOA\n" +
                "PP=$(awk '/^PPid:/ {print $2; exit}' \"/proc/$P/status\" 2>/dev/null); " +
                "U=$(awk '/^Uid:/ {print $2; exit}' \"/proc/$P/status\" 2>/dev/null); " +
                "S=$(awk '/^State:/ {print $2; exit}' \"/proc/$P/status\" 2>/dev/null); " +
                "return 0; }",
            "match_loose_core(){ " +
                "P=\"$1\"; candidate_fields \"$P\" || return 1; " +
                "[ \"$P\" != \"$CPID\" ] && [ \"$U\" = 0 ] && " +
                "[ \"$S\" != Z ] && [ \"$A0\" = \"$BIN\" ] && " +
                "[ \"$BIDX\" = 0 ] && [ \"$CIDX\" -ge 1 ]; }",
            "match_core(){ " +
                "P=\"$1\"; candidate_fields \"$P\" || return 1; " +
                "[ \"$P\" != \"$CPID\" ] && [ \"$PP\" = \"$CPID\" ] && " +
                "[ \"$U\" = 0 ] && [ \"$S\" != Z ] && " +
                "[ \"$A0\" = \"$BIN\" ] && [ \"$BIDX\" = 0 ] && " +
                "[ \"$CIDX\" -ge 1 ]; }",
            "core_snapshot(){ " +
                "COUNT=0; LOOSE=0; PID=0; PICK_PPID=0; PICK_UID=-1; " +
                "PICK_STATE=none; PICK_ARGC=0; PICK_BIDX=-1; PICK_CIDX=-1; " +
                "for X in /proc/[0-9]*/cmdline; do " +
                    "[ -r \"$X\" ] || continue; P=${X#/proc/}; P=${P%/cmdline}; " +
                    "if match_loose_core \"$P\"; then LOOSE=$((LOOSE + 1)); fi; " +
                    "if match_core \"$P\"; then " +
                        "COUNT=$((COUNT + 1)); PID=\"$P\"; " +
                        "PICK_PPID=\"$PP\"; PICK_UID=\"$U\"; PICK_STATE=\"$S\"; " +
                        "PICK_ARGC=\"$IDX\"; PICK_BIDX=\"$BIDX\"; PICK_CIDX=\"$CIDX\"; " +
                    "fi; " +
                "done; }"
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
            promotionAudit:
                root + "/state/production-lifecycle-ui-promotion.json",
            promotionAuditTemp:
                root + "/state/.production-lifecycle-ui-promotion-" +
                randomHex(8) + ".tmp"
        };
    }

    function buildSnapshotCommand(paths) {
        var lines = [
            "umask 077",
            "ROOT=" + quote(paths.root),
            "D=" + quote(paths.configDir),
            "CFG=" + quote(paths.config),
            "BIN=" + quote(paths.binary),
            "STATE=" + quote(paths.state),
            "LOGS=" + quote(paths.logs),
            "JAR=" + quote(paths.runtimeJar),
            "WORK=" + quote(paths.work),
            "CTRL=" + quote(paths.control),
            "ENDPOINT=" + quote(paths.endpoint),
            "RECOVERY_AUDIT=" + quote(paths.recoveryAudit),
            "LIFECYCLE_AUDIT=" + quote(paths.lifecycleAudit),
            "SERVER=" + quote(SERVER_CLASS),
            "SOURCE_AUTH=" + quote(SOURCE_LIFECYCLE_AUTHORIZATION_ID),
            "GATE=none; CODE=0",
            "finish(){ printf '__SBH_GATE__=%s\\n' \"$GATE\"; printf '__SBH_CODE__=%s\\n' \"$CODE\"; printf '__SBH_SNAPSHOT_DONE__=1\\n'; exit 0; }",
            "fail(){ GATE=\"$1\"; CODE=\"$2\"; finish; }"
        ];

        lines = lines.concat(resourceFunctions());
        lines = lines.concat(identityFunctions());
        lines.push(checkFunction());
        lines = lines.concat([
            "UIDV=$(id -u 2>/dev/null)",
            "printf '__SBH_UID__=%s\\n' \"$UIDV\"",
            "[ \"$UIDV\" = 0 ] || fail root_uid 801",
            "[ -d \"$ROOT\" ] && [ ! -L \"$ROOT\" ] || fail runtime_root 802",
            "[ -d \"$D\" ] && [ ! -L \"$D\" ] || fail config_directory 803",
            "[ -d \"$STATE\" ] && [ ! -L \"$STATE\" ] || fail state_directory 804",
            "[ \"$(stat -c %a \"$STATE\" 2>/dev/null)\" = 700 ] || fail state_mode 805",
            "[ \"$(stat -c %u \"$STATE\" 2>/dev/null)\" = 0 ] && [ \"$(stat -c %g \"$STATE\" 2>/dev/null)\" = 0 ] || fail state_owner 806",
            "[ -d \"$LOGS\" ] && [ ! -L \"$LOGS\" ] || fail logs_directory 807",
            "[ -d \"$CTRL\" ] && [ ! -L \"$CTRL\" ] || fail control_directory 808",
            "[ -d \"$WORK\" ] && [ ! -L \"$WORK\" ] || fail work_directory 809",
            "[ -f \"$JAR\" ] && [ ! -L \"$JAR\" ] || fail runtime_jar 810",
            "[ -f \"$BIN\" ] && [ -x \"$BIN\" ] && [ ! -L \"$BIN\" ] || fail singbox_binary 811",
            "[ -f \"$CFG\" ] && [ ! -L \"$CFG\" ] || fail production_config 812",
            "[ \"$(stat -c %a \"$CFG\" 2>/dev/null)\" = 600 ] && [ \"$(stat -c %u \"$CFG\" 2>/dev/null)\" = 0 ] && [ \"$(stat -c %g \"$CFG\" 2>/dev/null)\" = 0 ] || fail production_config_metadata 813",
            "SC=0; STAGE=''",
            "for F in \"$D\"/.runtime-tun.json.stage-*; do [ -e \"$F\" ] || continue; SC=$((SC + 1)); STAGE=\"$F\"; done",
            "[ \"$SC\" = 1 ] || fail staging_count 814",
            "[ -f \"$STAGE\" ] && [ ! -L \"$STAGE\" ] || fail staging_file 815",
            "CH=$(sha256sum \"$CFG\" 2>/dev/null | awk '{print $1}')",
            "CB=$(stat -c %s \"$CFG\" 2>/dev/null || echo -1)",
            "SH=$(sha256sum \"$STAGE\" 2>/dev/null | awk '{print $1}')",
            "SB=$(stat -c %s \"$STAGE\" 2>/dev/null || echo -1)",
            "[ -n \"$CH\" ] && [ \"$CH\" = \"$SH\" ] && [ \"$CB\" = \"$SB\" ] || fail production_staging_lineage 816",
            "check_config; CHECK=$?",
            "[ \"$CHECK\" = 0 ] || fail production_config_check 817",
            "[ -f \"$RECOVERY_AUDIT\" ] && [ ! -L \"$RECOVERY_AUDIT\" ] || fail recovery_audit_missing 818",
            "[ \"$(stat -c %a \"$RECOVERY_AUDIT\" 2>/dev/null)\" = 600 ] && [ \"$(stat -c %u \"$RECOVERY_AUDIT\" 2>/dev/null)\" = 0 ] && [ \"$(stat -c %g \"$RECOVERY_AUDIT\" 2>/dev/null)\" = 0 ] || fail recovery_audit_metadata 819",
            "[ -f \"$LIFECYCLE_AUDIT\" ] && [ ! -L \"$LIFECYCLE_AUDIT\" ] || fail lifecycle_audit_missing 820",
            "[ \"$(stat -c %a \"$LIFECYCLE_AUDIT\" 2>/dev/null)\" = 600 ] && [ \"$(stat -c %u \"$LIFECYCLE_AUDIT\" 2>/dev/null)\" = 0 ] && [ \"$(stat -c %g \"$LIFECYCLE_AUDIT\" 2>/dev/null)\" = 0 ] || fail lifecycle_audit_metadata 821",
            "grep -F '\"authorizationId\":\"'\"$SOURCE_AUTH\"'\"' \"$LIFECYCLE_AUDIT\" >/dev/null 2>&1 || fail lifecycle_audit_authorization 822",
            "grep -F '\"finalCoreState\":\"stopped\"' \"$LIFECYCLE_AUDIT\" >/dev/null 2>&1 || fail lifecycle_audit_final_state 823",
            "[ -f \"$ENDPOINT\" ] && [ ! -L \"$ENDPOINT\" ] || fail endpoint_missing 824",
            "[ \"$(stat -c %a \"$ENDPOINT\" 2>/dev/null)\" = 600 ] && [ \"$(stat -c %u \"$ENDPOINT\" 2>/dev/null)\" = 0 ] && [ \"$(stat -c %g \"$ENDPOINT\" 2>/dev/null)\" = 0 ] || fail endpoint_metadata 825",
            "[ \"$(readlink -f \"$ENDPOINT\" 2>/dev/null)\" = \"$ENDPOINT\" ] || fail endpoint_canonical 826",
            "CPID=$(sed -n 's/.*\"runtimePid\"[[:space:]]*:[[:space:]]*\\([0-9][0-9]*\\).*/\\1/p' \"$ENDPOINT\" | sed -n '1p')",
            "case \"$CPID\" in ''|*[!0-9]*) fail endpoint_pid_invalid 827;; esac",
            "kill -0 \"$CPID\" 2>/dev/null || fail control_service_not_alive 828",
            "match_control \"$CPID\" || fail control_service_identity 829",
            "CUID=$(awk '/^Uid:/ {print $2; exit}' \"/proc/$CPID/status\" 2>/dev/null)",
            "CGID=$(awk '/^Gid:/ {print $2; exit}' \"/proc/$CPID/status\" 2>/dev/null)",
            "[ \"$CUID\" = 0 ] && [ \"$CGID\" = 0 ] || fail control_service_owner 830",
            "core_snapshot",
            "[ \"$COUNT\" -le 1 ] || fail multiple_controller_owned_cores 831",
            "[ \"$LOOSE\" = \"$COUNT\" ] || fail loose_core_candidate_divergence 832",
            "TUN=0; [ -e /sys/class/net/sbh-tun0 ] && TUN=1",
            "R4=$(rule4_count); R6=$(rule6_count); RT4=$(route4_count); RT6=$(route6_count)",
            "[ \"$TUN\" = 0 ] && [ \"$R4\" = 0 ] && [ \"$R6\" = 0 ] && [ \"$RT4\" = 0 ] && [ \"$RT6\" = 0 ] || fail reserved_network_resources_present 833",
            "EP_DATA=$(toybox base64 \"$ENDPOINT\" 2>/dev/null | tr -d '\\r\\n')",
            "[ -n \"$EP_DATA\" ] || fail endpoint_read 834",
            "printf '__SBH_CH__=%s\\n' \"$CH\"",
            "printf '__SBH_CB__=%s\\n' \"$CB\"",
            "printf '__SBH_CHECK__=%s\\n' \"$CHECK\"",
            "printf '__SBH_CPID__=%s\\n' \"$CPID\"",
            "printf '__SBH_CUID__=%s\\n' \"$CUID\"",
            "printf '__SBH_CGID__=%s\\n' \"$CGID\"",
            "printf '__SBH_COUNT__=%s\\n' \"$COUNT\"",
            "printf '__SBH_LOOSE__=%s\\n' \"$LOOSE\"",
            "printf '__SBH_PID__=%s\\n' \"$PID\"",
            "printf '__SBH_PPID__=%s\\n' \"$PICK_PPID\"",
            "printf '__SBH_CORE_UID__=%s\\n' \"$PICK_UID\"",
            "printf '__SBH_CORE_STATE__=%s\\n' \"$PICK_STATE\"",
            "printf '__SBH_ARGC__=%s\\n' \"$PICK_ARGC\"",
            "printf '__SBH_BIDX__=%s\\n' \"$PICK_BIDX\"",
            "printf '__SBH_CIDX__=%s\\n' \"$PICK_CIDX\"",
            "printf '__SBH_TUN__=%s\\n' \"$TUN\"",
            "printf '__SBH_RULE4__=%s\\n' \"$R4\"",
            "printf '__SBH_RULE6__=%s\\n' \"$R6\"",
            "printf '__SBH_ROUTE4__=%s\\n' \"$RT4\"",
            "printf '__SBH_ROUTE6__=%s\\n' \"$RT6\"",
            "printf '__SBH_EP_DATA__=%s\\n' \"$EP_DATA\"",
            "printf '__SBH_SNAPSHOT_OK__=1\\n'",
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
        var correlation = "sbh54-" + now() + "-" + randomHex(12);
        var statusLine = null;
        var correlationLine = null;
        var closed = false;

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
                correlationMatched: true,
                requestCount: 1
            };
        } finally {
            closeQuietly(reader);
            closeQuietly(writer);
            closed = socket !== null ? closeQuietly(socket) : false;
            correlation = null;
            statusLine = null;
            correlationLine = null;
        }
    }

    function snapshotFromShell(shell, endpoint, statusResult) {
        var raw = shell.output;
        var count = numberValue(raw, "COUNT");
        var loose = numberValue(raw, "LOOSE");
        var runtimeStatus = statusResult ?
            String(statusResult.responseStatus || "") : "";
        var state = "divergent";

        if (statusStopped(runtimeStatus) && count === 0 && loose === 0) {
            state = "stopped";
        } else if (statusRunning(runtimeStatus) && count === 1 && loose === 1) {
            state = "running";
        }

        return {
            ok: state !== "divergent",
            state: state,
            runtimeStatus: runtimeStatus,
            runtimeClaimsRunning: statusRunning(runtimeStatus),
            runtimeClaimsStopped: statusStopped(runtimeStatus),
            controlServicePid: numberValue(raw, "CPID"),
            controlServiceAlive: true,
            controllerOwnedCoreCount: count,
            looseCoreCandidateCount: loose,
            corePid: numberValue(raw, "PID"),
            coreParentPid: numberValue(raw, "PPID"),
            coreUid: numberValue(raw, "CORE_UID"),
            coreState: marker(raw, "CORE_STATE"),
            coreArgumentCount: numberValue(raw, "ARGC"),
            coreBinaryArgumentIndex: numberValue(raw, "BIDX"),
            coreConfigArgumentIndex: numberValue(raw, "CIDX"),
            productionConfigSha256: marker(raw, "CH"),
            productionConfigByteCount: numberValue(raw, "CB"),
            productionConfigCheckPassed:
                numberValue(raw, "CHECK") === 0,
            tunInterfacePresent: yes(raw, "TUN"),
            reservedIpv4RuleCount: numberValue(raw, "RULE4"),
            reservedIpv6RuleCount: numberValue(raw, "RULE6"),
            reservedIpv4RouteCount: numberValue(raw, "ROUTE4"),
            reservedIpv6RouteCount: numberValue(raw, "ROUTE6"),
            controllerOwnedProcessContract:
                "ppid_runtime_uid0_argv0_binary_config_any_index",
            endpointValidated: endpoint !== null,
            statusCorrelationMatched:
                statusResult && statusResult.correlationMatched === true,
            timestamp: now()
        };
    }

    function inspectInternal() {
        var paths = pathSet();
        var shell = executeShell(
            buildSnapshotCommand(paths),
            "snapshot"
        );
        var endpointData;
        var endpoint;
        var statusResult;
        var snapshot;

        if (!yes(shell.output, "SNAPSHOT_DONE") ||
                !yes(shell.output, "SNAPSHOT_OK")) {
            throw new Error(
                marker(shell.output, "GATE") ||
                "PRODUCTION_LIFECYCLE_SNAPSHOT_FAILED"
            );
        }
        endpointData = marker(shell.output, "EP_DATA");
        if (!endpointData) {
            throw new Error("CONTROL_ENDPOINT_DATA_MISSING");
        }
        endpoint = validateEndpoint(
            decodeEndpoint(endpointData),
            paths,
            numberValue(shell.output, "CPID")
        );
        statusResult = sendCommand(endpoint, "STATUS");
        snapshot = snapshotFromShell(shell, endpoint, statusResult);
        endpoint = null;
        endpointData = null;
        if (!snapshot.ok) {
            lastSnapshot = snapshot;
            throw new Error("RUNTIME_CORE_STATE_DIVERGENCE");
        }
        lastSnapshot = snapshot;
        return {
            snapshot: snapshot,
            shell: shell,
            status: statusResult,
            paths: paths
        };
    }

    function buildObserveStartedCommand(paths, controlPid) {
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
            "I=0; COUNT=0; LOOSE=0; PID=0",
            "while [ \"$I\" -lt " + String(START_DISCOVERY_SECONDS) + " ]; do core_snapshot; [ \"$COUNT\" = 1 ] && [ \"$LOOSE\" = 1 ] && break; sleep 1; I=$((I + 1)); done",
            "VISIBLE=0; [ \"$COUNT\" = 1 ] && [ \"$LOOSE\" = 1 ] && VISIBLE=1",
            "FIRST_PID=\"$PID\"; FIRST_PPID=\"$PICK_PPID\"; FIRST_UID=\"$PICK_UID\"; FIRST_STATE=\"$PICK_STATE\"; FIRST_ARGC=\"$PICK_ARGC\"; FIRST_BIDX=\"$PICK_BIDX\"; FIRST_CIDX=\"$PICK_CIDX\"",
            "STABLE=0",
            "if [ \"$VISIBLE\" = 1 ]; then sleep " + String(START_STABILIZATION_SECONDS) + "; core_snapshot; if [ \"$COUNT\" = 1 ] && [ \"$LOOSE\" = 1 ] && [ \"$PID\" = \"$FIRST_PID\" ] && [ \"$PICK_PPID\" = \"$CPID\" ] && [ \"$PICK_UID\" = 0 ] && [ \"$PICK_STATE\" != Z ] && [ \"$PICK_BIDX\" = 0 ] && [ \"$PICK_CIDX\" -ge 1 ]; then STABLE=1; fi; fi",
            "CONTROL_ALIVE=0; if kill -0 \"$CPID\" 2>/dev/null && match_control \"$CPID\"; then CONTROL_ALIVE=1; fi",
            "TUN=0; [ -e /sys/class/net/sbh-tun0 ] && TUN=1",
            "R4=$(rule4_count); R6=$(rule6_count); RT4=$(route4_count); RT6=$(route6_count)",
            "printf '__SBH_OBSERVE_START_DONE__=1\\n'",
            "printf '__SBH_VISIBLE__=%s\\n' \"$VISIBLE\"",
            "printf '__SBH_PID__=%s\\n' \"$FIRST_PID\"",
            "printf '__SBH_COUNT__=%s\\n' \"$COUNT\"",
            "printf '__SBH_LOOSE__=%s\\n' \"$LOOSE\"",
            "printf '__SBH_PPID__=%s\\n' \"$FIRST_PPID\"",
            "printf '__SBH_CORE_UID__=%s\\n' \"$FIRST_UID\"",
            "printf '__SBH_CORE_STATE__=%s\\n' \"$FIRST_STATE\"",
            "printf '__SBH_ARGC__=%s\\n' \"$FIRST_ARGC\"",
            "printf '__SBH_BIDX__=%s\\n' \"$FIRST_BIDX\"",
            "printf '__SBH_CIDX__=%s\\n' \"$FIRST_CIDX\"",
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

    function buildObserveStoppedCommand(paths, controlPid) {
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
            "while [ \"$I\" -lt " + String(STOP_WAIT_SECONDS) + " ] && { [ \"$COUNT\" -ne 0 ] || [ \"$LOOSE\" -ne 0 ]; }; do sleep 1; I=$((I + 1)); core_snapshot; done",
            "CONTROL_ALIVE=0; if kill -0 \"$CPID\" 2>/dev/null && match_control \"$CPID\"; then CONTROL_ALIVE=1; fi",
            "TUN=0; [ -e /sys/class/net/sbh-tun0 ] && TUN=1",
            "R4=$(rule4_count); R6=$(rule6_count); RT4=$(route4_count); RT6=$(route6_count)",
            "printf '__SBH_OBSERVE_STOP_DONE__=1\\n'",
            "printf '__SBH_COUNT__=%s\\n' \"$COUNT\"",
            "printf '__SBH_LOOSE__=%s\\n' \"$LOOSE\"",
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

    function resourcesClean(raw) {
        return !yes(raw, "TUN") &&
            numberValue(raw, "RULE4") === 0 &&
            numberValue(raw, "RULE6") === 0 &&
            numberValue(raw, "ROUTE4") === 0 &&
            numberValue(raw, "ROUTE6") === 0;
    }

    function makeRunningSnapshot(base, observation, responseStatus) {
        var raw = observation.output;
        return {
            ok: true,
            state: "running",
            runtimeStatus: responseStatus,
            runtimeClaimsRunning: true,
            runtimeClaimsStopped: false,
            controlServicePid: base.snapshot.controlServicePid,
            controlServiceAlive: yes(raw, "CONTROL_ALIVE"),
            controllerOwnedCoreCount: numberValue(raw, "COUNT"),
            looseCoreCandidateCount: numberValue(raw, "LOOSE"),
            corePid: numberValue(raw, "PID"),
            coreParentPid: numberValue(raw, "PPID"),
            coreUid: numberValue(raw, "CORE_UID"),
            coreState: marker(raw, "CORE_STATE"),
            coreArgumentCount: numberValue(raw, "ARGC"),
            coreBinaryArgumentIndex: numberValue(raw, "BIDX"),
            coreConfigArgumentIndex: numberValue(raw, "CIDX"),
            productionConfigSha256: base.snapshot.productionConfigSha256,
            productionConfigByteCount: base.snapshot.productionConfigByteCount,
            productionConfigCheckPassed: true,
            tunInterfacePresent: yes(raw, "TUN"),
            reservedIpv4RuleCount: numberValue(raw, "RULE4"),
            reservedIpv6RuleCount: numberValue(raw, "RULE6"),
            reservedIpv4RouteCount: numberValue(raw, "ROUTE4"),
            reservedIpv6RouteCount: numberValue(raw, "ROUTE6"),
            controllerOwnedProcessContract:
                "ppid_runtime_uid0_argv0_binary_config_any_index",
            endpointValidated: true,
            timestamp: now()
        };
    }

    function makeStoppedSnapshot(base, observation, responseStatus) {
        var raw = observation.output;
        return {
            ok: true,
            state: "stopped",
            runtimeStatus: responseStatus,
            runtimeClaimsRunning: false,
            runtimeClaimsStopped: true,
            controlServicePid: base.snapshot.controlServicePid,
            controlServiceAlive: yes(raw, "CONTROL_ALIVE"),
            controllerOwnedCoreCount: numberValue(raw, "COUNT"),
            looseCoreCandidateCount: numberValue(raw, "LOOSE"),
            corePid: null,
            coreParentPid: null,
            coreUid: null,
            coreState: null,
            coreArgumentCount: null,
            coreBinaryArgumentIndex: null,
            coreConfigArgumentIndex: null,
            productionConfigSha256: base.snapshot.productionConfigSha256,
            productionConfigByteCount: base.snapshot.productionConfigByteCount,
            productionConfigCheckPassed: true,
            tunInterfacePresent: yes(raw, "TUN"),
            reservedIpv4RuleCount: numberValue(raw, "RULE4"),
            reservedIpv6RuleCount: numberValue(raw, "RULE6"),
            reservedIpv4RouteCount: numberValue(raw, "ROUTE4"),
            reservedIpv6RouteCount: numberValue(raw, "ROUTE6"),
            controllerOwnedProcessContract:
                "ppid_runtime_uid0_argv0_binary_config_any_index",
            endpointValidated: true,
            timestamp: now()
        };
    }

    function startInternal() {
        var base;
        var endpointData;
        var endpoint;
        var startResult;
        var observation;
        var rollbackResult = null;
        var rollbackObservation = null;
        var startedAt = now();

        if (!promoted) {
            throw new Error("PRODUCTION_LIFECYCLE_UI_NOT_PROMOTED");
        }
        base = inspectInternal();
        if (base.snapshot.state !== "stopped" ||
                base.snapshot.controllerOwnedCoreCount !== 0 ||
                base.snapshot.looseCoreCandidateCount !== 0) {
            throw new Error("CORE_START_REQUIRES_CLEAN_STOPPED_STATE");
        }
        endpointData = marker(base.shell.output, "EP_DATA");
        endpoint = validateEndpoint(
            decodeEndpoint(endpointData),
            base.paths,
            base.snapshot.controlServicePid
        );
        startResult = sendCommand(endpoint, "START");
        observation = executeShell(
            buildObserveStartedCommand(
                base.paths,
                base.snapshot.controlServicePid
            ),
            "observe-started"
        );
        if (!yes(observation.output, "OBSERVE_START_DONE") ||
                !yes(observation.output, "VISIBLE") ||
                numberValue(observation.output, "COUNT") !== 1 ||
                numberValue(observation.output, "LOOSE") !== 1 ||
                !yes(observation.output, "STABLE") ||
                !yes(observation.output, "CONTROL_ALIVE") ||
                !resourcesClean(observation.output)) {
            if (numberValue(observation.output, "COUNT") === 1 &&
                    numberValue(observation.output, "LOOSE") === 1) {
                try {
                    rollbackResult = sendCommand(endpoint, "STOP_CORE");
                    rollbackObservation = executeShell(
                        buildObserveStoppedCommand(
                            base.paths,
                            base.snapshot.controlServicePid
                        ),
                        "start-rollback"
                    );
                } catch (ignoredRollback) {}
            }
            endpoint = null;
            endpointData = null;
            throw new Error("PRODUCTION_CORE_START_RECONCILIATION_FAILED");
        }
        lastSnapshot = makeRunningSnapshot(
            base,
            observation,
            startResult.responseStatus
        );
        endpoint = null;
        endpointData = null;
        return {
            ok: true,
            operation: "start",
            authorizationId: AUTHORIZATION_ID,
            promoted: promoted,
            requestCount: 1,
            responseStatus: startResult.responseStatus,
            correlationMatched: true,
            coreStarted: true,
            corePid: lastSnapshot.corePid,
            coreParentPid: lastSnapshot.coreParentPid,
            coreUid: lastSnapshot.coreUid,
            coreArgumentCount: lastSnapshot.coreArgumentCount,
            coreBinaryArgumentIndex:
                lastSnapshot.coreBinaryArgumentIndex,
            coreConfigArgumentIndex:
                lastSnapshot.coreConfigArgumentIndex,
            stabilizationSeconds:
                START_STABILIZATION_SECONDS,
            stabilizationPassed: true,
            controlServiceRemainsRunning: true,
            reservedNetworkResourcesUnchanged: true,
            directProcessSignalSent: false,
            rollbackStopCoreSent:
                rollbackResult !== null,
            rollbackControllerStopVerified:
                rollbackObservation !== null &&
                numberValue(rollbackObservation.output, "COUNT") === 0,
            snapshot: lastSnapshot,
            durationMs: now() - startedAt,
            nextAuthorizedOperation:
                "runtime_production_lifecycle_ui_stop_acceptance",
            timestamp: now()
        };
    }

    function stopInternal() {
        var base;
        var endpointData;
        var endpoint;
        var stopResult = null;
        var observation = null;
        var statusAfter;
        var pingResult;
        var startedAt = now();

        if (!promoted) {
            throw new Error("PRODUCTION_LIFECYCLE_UI_NOT_PROMOTED");
        }
        base = inspectInternal();
        endpointData = marker(base.shell.output, "EP_DATA");
        endpoint = validateEndpoint(
            decodeEndpoint(endpointData),
            base.paths,
            base.snapshot.controlServicePid
        );
        if (base.snapshot.state === "running") {
            stopResult = sendCommand(endpoint, "STOP_CORE");
            observation = executeShell(
                buildObserveStoppedCommand(
                    base.paths,
                    base.snapshot.controlServicePid
                ),
                "observe-stopped"
            );
            if (!yes(observation.output, "OBSERVE_STOP_DONE") ||
                    numberValue(observation.output, "COUNT") !== 0 ||
                    numberValue(observation.output, "LOOSE") !== 0 ||
                    !yes(observation.output, "CONTROL_ALIVE") ||
                    !resourcesClean(observation.output)) {
                endpoint = null;
                endpointData = null;
                throw new Error("PRODUCTION_CORE_STOP_RECONCILIATION_FAILED");
            }
        } else if (base.snapshot.state !== "stopped") {
            endpoint = null;
            endpointData = null;
            throw new Error("CORE_STOP_STATE_DIVERGENCE");
        }
        statusAfter = sendCommand(endpoint, "STATUS");
        if (!statusStopped(statusAfter.responseStatus)) {
            endpoint = null;
            endpointData = null;
            throw new Error("RUNTIME_STATUS_NOT_STOPPED_AFTER_STOP");
        }
        pingResult = sendCommand(endpoint, "PING");
        if (String(pingResult.responseStatus) !== "PONG") {
            endpoint = null;
            endpointData = null;
            throw new Error("FINAL_PING_NOT_PONG");
        }
        if (observation === null) {
            observation = {
                output:
                    "__SBH_COUNT__=0\n" +
                    "__SBH_LOOSE__=0\n" +
                    "__SBH_CONTROL_ALIVE__=1\n" +
                    "__SBH_TUN__=0\n" +
                    "__SBH_RULE4__=0\n" +
                    "__SBH_RULE6__=0\n" +
                    "__SBH_ROUTE4__=0\n" +
                    "__SBH_ROUTE6__=0\n"
            };
        }
        lastSnapshot = makeStoppedSnapshot(
            base,
            observation,
            statusAfter.responseStatus
        );
        endpoint = null;
        endpointData = null;
        return {
            ok: true,
            operation: "stop",
            authorizationId: AUTHORIZATION_ID,
            promoted: promoted,
            stopCommandSent: stopResult !== null,
            stopRequestCount: stopResult === null ? 0 : 1,
            stopResponseStatus:
                stopResult === null ?
                    "ALREADY_STOPPED" :
                    stopResult.responseStatus,
            stopCorrelationMatched:
                stopResult === null ||
                stopResult.correlationMatched === true,
            coreStopped: true,
            matchingCoreCountAfter: 0,
            finalCoreState: "stopped",
            statusAfterResponseStatus:
                statusAfter.responseStatus,
            finalPingResponseStatus:
                pingResult.responseStatus,
            finalPingCorrelationMatched: true,
            controlServiceRemainsRunning: true,
            reservedNetworkResourcesUnchanged: true,
            directProcessSignalSent: false,
            snapshot: lastSnapshot,
            durationMs: now() - startedAt,
            nextAuthorizedOperation:
                "runtime_production_lifecycle_ui_acceptance_complete",
            timestamp: now()
        };
    }

    function buildPromotionAuditCommand(paths, controlPid) {
        return [
            "umask 077",
            "AUDIT=" + quote(paths.promotionAudit),
            "TMP=" + quote(paths.promotionAuditTemp),
            "AUTH=" + quote(AUTHORIZATION_ID),
            "SOURCE=" + quote(SOURCE_LIFECYCLE_AUTHORIZATION_ID),
            "CPID=" + quote(String(controlPid)),
            "TS=$(date +%s 2>/dev/null || echo 0)",
            "printf '{\"schemaVersion\":1,\"stage\":54,\"authorizationId\":\"%s\",\"sourceLifecycleAuthorizationId\":\"%s\",\"runtimePid\":%s,\"productionUiActions\":[\"status\",\"start\",\"stop\"],\"automaticCoreAction\":false,\"promotedAtSeconds\":%s}\\n' \"$AUTH\" \"$SOURCE\" \"$CPID\" \"$TS\" > \"$TMP\" || exit 851",
            "chmod 600 \"$TMP\" || exit 852",
            "chown 0:0 \"$TMP\" >/dev/null 2>&1 || exit 853",
            "mv -f \"$TMP\" \"$AUDIT\" || exit 854",
            "[ -f \"$AUDIT\" ] && [ ! -L \"$AUDIT\" ] || exit 855",
            "[ \"$(stat -c %a \"$AUDIT\" 2>/dev/null)\" = 600 ] && [ \"$(stat -c %u \"$AUDIT\" 2>/dev/null)\" = 0 ] && [ \"$(stat -c %g \"$AUDIT\" 2>/dev/null)\" = 0 ] || exit 856",
            "printf '__SBH_PROMOTION_AUDIT_DONE__=1\\n'",
            "printf '__SBH_PROMOTION_AUDIT_BYTES__=%s\\n' \"$(stat -c %s \"$AUDIT\" 2>/dev/null || echo -1)\"",
            "exit 0"
        ].join("; ");
    }

    function promoteInternal() {
        var inspected = inspectInternal();
        var audit;
        var startedAt = now();

        if (inspected.snapshot.state !== "stopped" ||
                inspected.snapshot.controllerOwnedCoreCount !== 0 ||
                inspected.snapshot.looseCoreCandidateCount !== 0) {
            throw new Error("PROMOTION_REQUIRES_CLEAN_STOPPED_STATE");
        }
        audit = executeShell(
            buildPromotionAuditCommand(
                inspected.paths,
                inspected.snapshot.controlServicePid
            ),
            "promotion-audit"
        );
        if (!yes(audit.output, "PROMOTION_AUDIT_DONE")) {
            throw new Error("PRODUCTION_LIFECYCLE_UI_AUDIT_FAILED");
        }
        promoted = true;
        return {
            ok: true,
            stage:
                "production_stage54_runtime_production_lifecycle_ui_promotion",
            authorizationId: AUTHORIZATION_ID,
            sourceLifecycleAuthorizationId:
                SOURCE_LIFECYCLE_AUTHORIZATION_ID,
            authorizationConsumed: true,
            automaticRetryAllowed: false,
            manualOnly: true,
            preflightPassed: true,
            shellUid: numberValue(
                inspected.shell.output,
                "UID"
            ),
            productionConfigCheckPassed: true,
            lifecycleAuditVerified: true,
            lifecycleAuditFinalCoreState: "stopped",
            controlServicePid:
                inspected.snapshot.controlServicePid,
            controlServiceProcessAlive: true,
            controlServiceOwnerValidated: true,
            currentRuntimeStatus:
                inspected.snapshot.runtimeStatus,
            currentCoreState:
                inspected.snapshot.state,
            currentControllerOwnedCoreCount: 0,
            currentLooseCoreCandidateCount: 0,
            controllerOwnedProcessContract:
                "ppid_runtime_uid0_argv0_binary_config_any_index",
            productionLifecycleUiPromoted: true,
            statusActionInstalled: true,
            startActionInstalled: true,
            stopActionInstalled: true,
            actionSerializationEnabled: true,
            automaticCoreActionInvoked: false,
            coreStartInvoked: false,
            coreStopInvoked: false,
            directProcessSignalEnabled: false,
            promotionAuditCreated: true,
            promotionAuditRelativePath:
                "state/production-lifecycle-ui-promotion.json",
            promotionAuditByteCount:
                numberValue(audit.output, "PROMOTION_AUDIT_BYTES"),
            tunInterfacePresent: false,
            reservedNetworkResourcesUnchanged: true,
            configModified: false,
            stagingModified: false,
            tunCreated: false,
            routeModified: false,
            dnsModified: false,
            firewallModified: false,
            networkConnectivityTestInvoked: false,
            networkTrafficGeneratedByProbe: false,
            destructiveOperations: false,
            readyForProductionLifecycleUiAcceptance: true,
            nextAuthorizedOperation:
                "runtime_production_lifecycle_ui_acceptance",
            snapshot: inspected.snapshot,
            snapshotShellCode: inspected.shell.code,
            auditShellCode: audit.code,
            shellCodeAuthoritative: false,
            shellTransportCodeAnomalous:
                inspected.shell.code !== 0 || audit.code !== 0,
            durationMs: now() - startedAt,
            timestamp: now()
        };
    }

    function runAsync(operation, callback) {
        if (typeof callback !== "function") {
            throw new Error("Stage54 callback unavailable");
        }
        if (busy) {
            callback({
                ok: false,
                operation: operation,
                errorCode:
                    "PRODUCTION_LIFECYCLE_OPERATION_ALREADY_RUNNING",
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
                    var error;
                    try {
                        if (operation === "promote") {
                            output = promoteInternal();
                        } else if (operation === "status") {
                            output = inspectInternal().snapshot;
                            output.operation = "status";
                            output.promoted = promoted;
                        } else if (operation === "start") {
                            output = startInternal();
                        } else if (operation === "stop") {
                            output = stopInternal();
                        } else {
                            throw new Error(
                                "UNKNOWN_PRODUCTION_LIFECYCLE_OPERATION"
                            );
                        }
                    } catch (failure) {
                        error = failure;
                        output = {
                            ok: false,
                            stage:
                                "production_stage54_runtime_production_lifecycle_ui_promotion",
                            operation: operation,
                            authorizationId: AUTHORIZATION_ID,
                            promoted: promoted,
                            errorCode: errorCode(failure),
                            error:
                                String(
                                    SBH.util.errorText(failure)
                                ).substring(0, 256),
                            coreStartInvoked:
                                operation === "start",
                            coreStopInvoked:
                                operation === "stop",
                            directProcessSignalSent: false,
                            configModified: false,
                            stagingModified: false,
                            tunCreated: false,
                            routeModified: false,
                            dnsModified: false,
                            firewallModified: false,
                            destructiveOperations: false,
                            nextAuthorizedOperation:
                                "resolve_production_lifecycle_ui_gate",
                            snapshot: lastSnapshot,
                            timestamp: now()
                        };
                    }
                    busy = false;
                    SBH.handler.post(
                        new JavaAdapter(Runnable, {
                            run: function () {
                                callback(output, error);
                            }
                        })
                    );
                }
            }),
            "SingBoxHub-Stage54-" + String(operation)
        ).start();

        return {
            accepted: true,
            busy: false
        };
    }

    function refreshRuntimeUi(controller) {
        try {
            if (SBH.runtime &&
                    typeof SBH.runtime.refreshAsync === "function") {
                SBH.runtime.refreshAsync(function (runtime) {
                    try {
                        if (controller &&
                                typeof controller.applyRuntimeBadge ===
                                "function") {
                            controller.applyRuntimeBadge(runtime);
                        }
                    } catch (ignoredBadge) {}
                });
            }
        } catch (ignoredRefresh) {}
        try {
            if (controller &&
                    typeof controller.showPage === "function") {
                controller.showPage(controller.page);
            }
        } catch (ignoredPage) {}
    }

    function action(controller, operation) {
        if (busy) {
            SBH.util.toast("生命周期操作正在进行");
            return;
        }
        if (!promoted && operation !== "promote") {
            SBH.util.toast("请先在节点页面完成 Stage 54 门禁");
            return;
        }
        SBH.util.toast(
            operation === "start" ? "正在启动并核验 Core" :
                (operation === "stop" ? "正在停止并核验 Core" :
                    "正在刷新生产状态")
        );
        runAsync(operation, function (result) {
            SBH.util.toast(
                result.ok === true ?
                    (
                        operation === "start" ? "Core 已启动并核验" :
                            (operation === "stop" ? "Core 已停止并核验" :
                                "生产状态已刷新")
                    ) :
                    "生产生命周期操作存在待处理项"
            );
            refreshRuntimeUi(controller);
        });
    }

    function infoLine(iconName, title, value, accent) {
        var row = W.row();
        row.setPadding(0, SBH.util.dp(7), 0, SBH.util.dp(7));
        row.addView(W.icon(iconName, 24, C.secondary));
        row.addView(
            W.text(title, 12.5, C.secondary, false),
            W.lp(0, W.WRAP, 1)
        );
        row.addView(W.text(value, 13, accent || C.text, true));
        return row;
    }

    function presentation() {
        if (busy) {
            return {
                title: "生产生命周期操作中",
                description: "正在执行精确状态、进程与资源核验",
                accent: C.orange,
                soft: C.orangeSoft,
                stateText: "处理中"
            };
        }
        if (!promoted) {
            return {
                title: "生产生命周期待门禁",
                description: "先在节点页面完成 Stage 54 提升门禁",
                accent: C.orange,
                soft: C.orangeSoft,
                stateText: "未提升"
            };
        }
        if (lastSnapshot && lastSnapshot.state === "running") {
            return {
                title: "Core 运行中",
                description:
                    "控制器持有 Core PID " +
                    String(lastSnapshot.corePid),
                accent: C.green,
                soft: C.greenSoft,
                stateText: "运行中"
            };
        }
        if (lastSnapshot && lastSnapshot.state === "stopped") {
            return {
                title: "Core 已停止",
                description: "Runtime 控制服务保持运行，可安全启动",
                accent: C.blue,
                soft: C.blueSoft,
                stateText: "已停止"
            };
        }
        return {
            title: "生产生命周期已启用",
            description: "点击刷新读取 Runtime 与精确进程状态",
            accent: C.blue,
            soft: C.blueSoft,
            stateText: "待刷新"
        };
    }

    function buildProductionHero(controller) {
        var state = presentation();
        var shell = new FrameLayout(SBH.ctx);
        var body = W.column();
        var head = W.row();
        var circle = new FrameLayout(SBH.ctx);
        var statusBox = W.column();
        var statusRow = W.row();
        var dot = new P.android.view.View(SBH.ctx);
        var description;
        var actions = W.row();
        var actionShell = new FrameLayout(SBH.ctx);
        var coreValue = lastSnapshot ?
            (
                lastSnapshot.state === "running" ?
                    "PID " + String(lastSnapshot.corePid) :
                    "已停止"
            ) : "待刷新";
        var controlValue = lastSnapshot ?
            "PID " + String(lastSnapshot.controlServicePid) :
            "待刷新";

        shell.setBackground(
            SBH.theme.gradient(
                ["#F1FAF6", "#F4F7FB", "#FBF7F1"],
                24,
                "#E3EAE6"
            )
        );
        shell.addView(W.artView(false), W.fp(W.MATCH, W.MATCH));
        body.setPadding(
            SBH.util.dp(18),
            SBH.util.dp(18),
            SBH.util.dp(18),
            SBH.util.dp(16)
        );
        circle.setBackground(
            SBH.theme.rounded(state.soft, 50, state.soft, 1)
        );
        circle.addView(
            W.icon(
                lastSnapshot && lastSnapshot.state === "running" ?
                    "shield" : "box",
                54,
                state.accent
            ),
            W.fp(W.MATCH, W.MATCH, Gravity.CENTER)
        );
        head.addView(
            circle,
            W.lp(SBH.util.dp(74), SBH.util.dp(74))
        );
        statusBox.setPadding(SBH.util.dp(14), SBH.util.dp(4), 0, 0);
        dot.setBackground(
            SBH.theme.rounded(state.accent, 9, C.clear, 0)
        );
        statusRow.addView(
            dot,
            W.lp(SBH.util.dp(10), SBH.util.dp(10))
        );
        statusRow.addView(
            W.text(state.title, 21, state.accent, true),
            W.margins(W.lp(W.WRAP, W.WRAP), 8, 0, 0, 0)
        );
        statusBox.addView(statusRow);
        description = W.text(
            state.description,
            13,
            C.secondary,
            false
        );
        description.setPadding(0, SBH.util.dp(8), 0, 0);
        statusBox.addView(description);
        head.addView(statusBox, W.lp(0, W.WRAP, 1));
        head.addView(
            W.label(
                promoted ? "生产控制" : "等待门禁",
                state.accent,
                state.soft
            )
        );
        body.addView(head);
        body.addView(
            infoLine(
                "settings",
                "Runtime 控制服务",
                controlValue,
                lastSnapshot ? C.green : C.orange
            )
        );
        body.addView(
            infoLine(
                "box",
                "sing-box Core",
                coreValue,
                lastSnapshot && lastSnapshot.state === "running" ?
                    C.green : C.blue
            )
        );
        body.addView(
            infoLine(
                "shield",
                "进程身份契约",
                promoted ? "控制器持有" : "待提升",
                promoted ? C.green : C.orange
            )
        );
        body.addView(
            infoLine(
                "route",
                "网络资源边界",
                lastSnapshot ? "保持为空" : "待刷新",
                lastSnapshot ? C.green : C.orange
            )
        );

        actions.setGravity(Gravity.CENTER);
        actions.addView(
            W.button(
                "刷新",
                "reload",
                C.blue,
                C.blueSoft,
                function () { action(controller, "status"); }
            ),
            W.lp(0, SBH.util.dp(48), 1)
        );
        actions.addView(
            W.button(
                "启动",
                "play",
                C.green,
                C.greenSoft,
                function () { action(controller, "start"); }
            ),
            W.margins(W.lp(0, SBH.util.dp(48), 1), 8, 0, 8, 0)
        );
        actions.addView(
            W.button(
                "停止",
                "stop",
                C.coral,
                C.coralSoft,
                function () { action(controller, "stop"); }
            ),
            W.lp(0, SBH.util.dp(48), 1)
        );
        actionShell.setPadding(
            SBH.util.dp(5),
            SBH.util.dp(5),
            SBH.util.dp(5),
            SBH.util.dp(5)
        );
        actionShell.setBackground(
            SBH.theme.rounded("#F9FBFC", 17, "#E4E9EF", 1)
        );
        actionShell.addView(actions);
        body.addView(actionShell, W.lp(W.MATCH, SBH.util.dp(60)));
        shell.addView(body, W.fp(W.MATCH, W.MATCH));
        shell.setLayoutParams(W.lp(W.MATCH, SBH.util.dp(356)));
        return shell;
    }

    function buildHome(controller) {
        var page = originalHome(controller);
        var content;
        if (page !== null && page !== undefined &&
                page.getChildCount() > 0) {
            content = page.getChildAt(0);
            if (content !== null && content.getChildCount() > 0) {
                content.removeViewAt(0);
                content.addView(buildProductionHero(controller), 0);
            }
        }
        return page;
    }

    function buildPromotionCard(controller) {
        var card = W.card(17);
        var title = W.text(
            "Stage 54：生产生命周期 UI 提升",
            17,
            C.navy,
            true
        );
        var note = W.text(
            "重新校验 Stage 53 Retry 4 生命周期审计、生产配置、控制服务、" +
            "Core 停止状态及网络资源边界，然后启用首页的刷新、启动和停止控制。" +
            "提升本身不会启动或停止 Core；所有后续操作均串行并采用控制器持有进程契约。",
            11.4,
            C.secondary,
            false
        );
        var resultText = W.text(
            JSON.stringify({
                ready: true,
                authorizationId: AUTHORIZATION_ID,
                sourceLifecycleAuthorizationId:
                    SOURCE_LIFECYCLE_AUTHORIZATION_ID,
                productionLifecycleUiPromotionEnabled: true,
                statusActionInstalled: true,
                startActionInstalled: true,
                stopActionInstalled: true,
                automaticCoreActionInvoked: false,
                directProcessSignalEnabled: false,
                automaticRetryAllowed: false
            }, null, 2),
            10.3,
            C.secondary,
            false
        );
        var button = W.button(
            "校验并启用生产生命周期控制",
            "shield",
            C.orange,
            C.orangeSoft,
            function () {
                if (busy) {
                    SBH.util.toast("Stage 54 门禁正在执行");
                    return;
                }
                resultText.setText(
                    "正在校验生命周期审计、Runtime、Core 与网络资源边界。"
                );
                SBH.util.toast("正在执行 Stage 54 提升门禁");
                runAsync("promote", function (result) {
                    resultText.setText(
                        JSON.stringify(result, null, 2)
                    );
                    SBH.util.toast(
                        result.ok === true ?
                            "生产生命周期控制已启用" :
                            "Stage 54 提升存在待处理项"
                    );
                    refreshRuntimeUi(controller);
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
        note.setPadding(0, SBH.util.dp(7), 0, SBH.util.dp(8));
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

    function buildNodes(controller) {
        var page = originalNodes(controller);
        var content = page.getChildAt(0);
        content.addView(
            buildPromotionCard(controller),
            W.margins(
                W.lp(W.MATCH, W.WRAP),
                0,
                16,
                0,
                12
            )
        );
        return page;
    }

    if (typeof originalHome !== "function" ||
            typeof originalNodes !== "function" ||
            typeof originalStart !== "function") {
        throw new Error("Stage54 dependencies unavailable");
    }

    SBH.productionLifecycle = {
        version: 1,
        authorizationId: AUTHORIZATION_ID,
        sourceLifecycleAuthorizationId:
            SOURCE_LIFECYCLE_AUTHORIZATION_ID,
        isPromoted: function () {
            return promoted;
        },
        isBusy: function () {
            return busy;
        },
        snapshot: function () {
            return lastSnapshot;
        },
        promoteAsync: function (callback) {
            return runAsync("promote", callback);
        },
        statusAsync: function (callback) {
            return runAsync("status", callback);
        },
        startAsync: function (callback) {
            return runAsync("start", callback);
        },
        stopAsync: function (callback) {
            return runAsync("stop", callback);
        },
        controllerOwnedProcessContract:
            "ppid_runtime_uid0_argv0_binary_config_any_index",
        directProcessSignalEnabled: false,
        automaticCoreActionEnabled: false,
        automaticRetryAllowed: false
    };

    SBH.navigation.register(0, buildHome);
    SBH.navigation.register(1, buildNodes);

    SBH.app.start = function () {
        var output = originalStart();
        output.runtimeProductionLifecycleUiPromotionVersion = 1;
        output.runtimeProductionLifecycleUiPromotionReady = true;
        output.runtimeProductionLifecycleUiPromotionAuthorizationId =
            AUTHORIZATION_ID;
        output.runtimeProductionLifecycleUiPromotionSourceAuthorizationId =
            SOURCE_LIFECYCLE_AUTHORIZATION_ID;
        output.runtimeProductionLifecycleUiActionsInstalled = true;
        output.runtimeProductionLifecycleUiPromoted = promoted;
        output.runtimeProductionLifecycleUiAutomaticCoreAction = false;
        output.runtimeProductionLifecycleUiDirectProcessSignal = false;
        output.runtimeProductionLifecycleUiAutomaticRetry = false;
        output.runtimeProductionLifecycleUiControllerOwnedContract =
            "ppid_runtime_uid0_argv0_binary_config_any_index";
        output.runtimeProductionLifecycleUiStatusAction = true;
        output.runtimeProductionLifecycleUiStartAction = true;
        output.runtimeProductionLifecycleUiStopAction = true;
        output.writeOperationsLocked = false;
        output.destructiveOperations = false;
        return output;
    };
}());
