/* SingBoxHub Stage52 Retry1 Runtime control-service recovery marker fix. Rhino ES5 only. */
SBH.versions.runtimeControlServiceRecoveryRetry1 = 1;

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
        "stage52-retry1-runtime-control-service-recovery-user-authorized-20260805";
    var SOURCE_RECONCILE_AUTHORIZATION_ID =
        "stage51-retry1-stale-core-state-reconcile-user-authorized-20260804";
    var SERVER_CLASS =
        "com.singboxhub.runtime.CoreRuntimeMain";
    var CLIENT_CLASS =
        "com.singboxhub.runtime.CoreClientMain";
    var CHECK_TIMEOUT_SECONDS = 30;
    var START_WAIT_SECONDS = 8;
    var SOCKET_READ_TIMEOUT_MS = 2000;

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
                "SingBoxHub#Stage52Retry1#" + String(purpose) + "#" +
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
            "CONTROL_SERVICE_RECOVERY_FAILED";
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
            "core_count(){ " +
                "C=0; for X in /proc/[0-9]*/cmdline; do " +
                    "[ -r \"$X\" ] || continue; P=${X#/proc/}; P=${P%/cmdline}; " +
                    "if match_core \"$P\"; then C=$((C + 1)); fi; " +
                "done; printf '%s' \"$C\"; }",
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

    function createPathSet() {
        var root = runtimeRoot();
        var createdAt = now();
        var nameToken = randomHex(8);
        return {
            root: root,
            configDir: root + "/config",
            config: root + "/config/runtime-tun.json",
            binary: root + "/bin/sing-box",
            state: root + "/state",
            probe: root + "/state/core-probes",
            reconcileAudit:
                root + "/state/core-probe-last-reconcile.json",
            recoveryAudit:
                root + "/state/control-service-last-recovery.json",
            recoveryAuditTemp:
                root + "/state/.control-service-last-recovery." +
                nameToken + ".tmp",
            logs: root + "/logs",
            runtimeLog: root + "/logs/runtime-production.log",
            runtimeJar:
                root + "/runtime/core/SingBoxHubCoreRuntime.jar",
            work: root + "/runtime/core/work",
            control: root + "/runtime/control",
            endpoint:
                root + "/runtime/control/control_endpoint.json",
            endpointTemp:
                root + "/runtime/control/.control_endpoint." +
                nameToken + ".tmp",
            transactionPid:
                root + "/runtime/control/runtime." +
                createdAt + "." + nameToken + ".pid",
            ready:
                root + "/runtime/control/runtime." +
                createdAt + "." + nameToken + ".ready",
            createdAt: createdAt,
            socketName:
                "sbh_runtime_" + createdAt + "_" + randomHex(6),
            secret: randomHex(24)
        };
    }

    function buildPreflightCommand(pathSet) {
        var lines = [
            "umask 077",
            "ROOT=" + quote(pathSet.root),
            "D=" + quote(pathSet.configDir),
            "CFG=" + quote(pathSet.config),
            "BIN=" + quote(pathSet.binary),
            "STATE=" + quote(pathSet.state),
            "PROBE=" + quote(pathSet.probe),
            "RECONCILE_AUDIT=" + quote(pathSet.reconcileAudit),
            "LOGS=" + quote(pathSet.logs),
            "JAR=" + quote(pathSet.runtimeJar),
            "WORK=" + quote(pathSet.work),
            "CTRL=" + quote(pathSet.control),
            "ENDPOINT=" + quote(pathSet.endpoint),
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
            "[ \"$UIDV\" = 0 ] || fail root_uid 601",
            "[ -d \"$ROOT\" ] && [ ! -L \"$ROOT\" ] || fail runtime_root 602",
            "[ -d \"$D\" ] && [ ! -L \"$D\" ] || fail config_directory 603",
            "[ -d \"$STATE\" ] && [ ! -L \"$STATE\" ] || fail state_directory 604",
            "[ \"$(stat -c %a \"$STATE\" 2>/dev/null)\" = 700 ] || fail state_mode 605",
            "[ \"$(stat -c %u \"$STATE\" 2>/dev/null)\" = 0 ] && [ \"$(stat -c %g \"$STATE\" 2>/dev/null)\" = 0 ] || fail state_owner 606",
            "[ -d \"$PROBE\" ] && [ ! -L \"$PROBE\" ] || fail probe_directory 607",
            "[ -d \"$LOGS\" ] && [ ! -L \"$LOGS\" ] || fail logs_directory 608",
            "[ -d \"$CTRL\" ] && [ ! -L \"$CTRL\" ] || fail control_directory 609",
            "[ -d \"$WORK\" ] && [ ! -L \"$WORK\" ] || fail work_directory 610",
            "[ -f \"$JAR\" ] && [ ! -L \"$JAR\" ] || fail runtime_jar 611",
            "[ -f \"$BIN\" ] && [ -x \"$BIN\" ] && [ ! -L \"$BIN\" ] || fail singbox_binary 612",
            "[ -f \"$CFG\" ] && [ ! -L \"$CFG\" ] || fail production_config 613",
            "[ \"$(stat -c %a \"$CFG\" 2>/dev/null)\" = 600 ] && [ \"$(stat -c %u \"$CFG\" 2>/dev/null)\" = 0 ] && [ \"$(stat -c %g \"$CFG\" 2>/dev/null)\" = 0 ] || fail production_config_metadata 614",
            "SC=0; STAGE=''",
            "for F in \"$D\"/.runtime-tun.json.stage-*; do " +
                "[ -e \"$F\" ] || continue; SC=$((SC + 1)); STAGE=\"$F\"; done",
            "[ \"$SC\" = 1 ] || fail staging_count 615",
            "[ -f \"$STAGE\" ] && [ ! -L \"$STAGE\" ] || fail staging_file 616",
            "CH=$(sha256sum \"$CFG\" 2>/dev/null | awk '{print $1}')",
            "CB=$(stat -c %s \"$CFG\" 2>/dev/null || echo -1)",
            "SH=$(sha256sum \"$STAGE\" 2>/dev/null | awk '{print $1}')",
            "SB=$(stat -c %s \"$STAGE\" 2>/dev/null || echo -1)",
            "[ -n \"$CH\" ] && [ \"$CH\" = \"$SH\" ] && [ \"$CB\" = \"$SB\" ] || fail production_staging_lineage 617",
            "check_config; CHECK=$?",
            "[ \"$CHECK\" = 0 ] || fail production_config_check 618",
            "[ ! -e \"$STATE/core-probe-active.pid\" ] && [ ! -L \"$STATE/core-probe-active.pid\" ] || fail active_core_pid_present 619",
            "[ ! -e \"$STATE/core-probe-active.json\" ] && [ ! -L \"$STATE/core-probe-active.json\" ] || fail active_core_metadata_present 620",
            "TXN_CORE=0; for F in \"$PROBE\"/core-start-*.pid; do [ -e \"$F\" ] || continue; TXN_CORE=$((TXN_CORE + 1)); done",
            "[ \"$TXN_CORE\" = 0 ] || fail core_transaction_pid_present 621",
            "[ -f \"$RECONCILE_AUDIT\" ] && [ ! -L \"$RECONCILE_AUDIT\" ] || fail reconcile_audit_missing 622",
            "RAM=$(stat -c %a \"$RECONCILE_AUDIT\" 2>/dev/null || echo -1)",
            "RAU=$(stat -c %u \"$RECONCILE_AUDIT\" 2>/dev/null || echo -1)",
            "RAG=$(stat -c %g \"$RECONCILE_AUDIT\" 2>/dev/null || echo -1)",
            "[ \"$RAM\" = 600 ] && [ \"$RAU\" = 0 ] && [ \"$RAG\" = 0 ] || fail reconcile_audit_metadata 623",
            "CORE=$(core_count)",
            "[ \"$CORE\" = 0 ] || fail matching_core_present 624",
            "TUN=0; [ -e /sys/class/net/sbh-tun0 ] && TUN=1",
            "R4=$(rule4_count); R6=$(rule6_count)",
            "RT4=$(route4_count); RT6=$(route6_count)",
            "[ \"$TUN\" = 0 ] && [ \"$R4\" = 0 ] && [ \"$R6\" = 0 ] && [ \"$RT4\" = 0 ] && [ \"$RT6\" = 0 ] || fail reserved_network_resources_present 625",
            "EP_EXISTS=0; EP_STALE=0; EP_REUSABLE=0; EP_PID=0; EP_DATA=none",
            "if [ -e \"$ENDPOINT\" ] || [ -L \"$ENDPOINT\" ]; then " +
                "EP_EXISTS=1; " +
                "[ -f \"$ENDPOINT\" ] && [ ! -L \"$ENDPOINT\" ] || fail endpoint_type_conflict 626; " +
                "[ \"$(stat -c %a \"$ENDPOINT\" 2>/dev/null)\" = 600 ] || fail endpoint_mode 627; " +
                "[ \"$(stat -c %u \"$ENDPOINT\" 2>/dev/null)\" = 0 ] && [ \"$(stat -c %g \"$ENDPOINT\" 2>/dev/null)\" = 0 ] || fail endpoint_owner 628; " +
                "[ \"$(readlink -f \"$ENDPOINT\" 2>/dev/null)\" = \"$ENDPOINT\" ] || fail endpoint_canonical 629; " +
                "EP_PID=$(sed -n 's/.*\"runtimePid\"[[:space:]]*:[[:space:]]*\\([0-9][0-9]*\\).*/\\1/p' \"$ENDPOINT\" | sed -n '1p'); " +
                "case \"$EP_PID\" in ''|*[!0-9]*) EP_PID=0; EP_STALE=1;; " +
                "*) if kill -0 \"$EP_PID\" 2>/dev/null && match_control \"$EP_PID\"; then " +
                    "EP_REUSABLE=1; EP_DATA=$(toybox base64 \"$ENDPOINT\" 2>/dev/null | tr -d '\\r\\n'); " +
                    "[ -n \"$EP_DATA\" ] || fail endpoint_read 630; " +
                "else EP_STALE=1; fi;; esac; " +
            "fi",
            "LIVE_TXN=0",
            "if [ \"$EP_REUSABLE\" = 0 ]; then " +
                "for F in \"$CTRL\"/runtime.*.pid; do [ -e \"$F\" ] || continue; " +
                    "P=$(cat \"$F\" 2>/dev/null); case \"$P\" in ''|*[!0-9]*) continue;; esac; " +
                    "if kill -0 \"$P\" 2>/dev/null && match_control \"$P\"; then LIVE_TXN=$((LIVE_TXN + 1)); fi; done; " +
                "[ \"$LIVE_TXN\" = 0 ] || fail orphan_control_service_present 631; " +
            "fi",
            "printf '__SBH_CH__=%s\\n' \"$CH\"",
            "printf '__SBH_CB__=%s\\n' \"$CB\"",
            "printf '__SBH_CHECK__=%s\\n' \"$CHECK\"",
            "printf '__SBH_CORE__=%s\\n' \"$CORE\"",
            "printf '__SBH_TUN__=%s\\n' \"$TUN\"",
            "printf '__SBH_RULE4__=%s\\n' \"$R4\"",
            "printf '__SBH_RULE6__=%s\\n' \"$R6\"",
            "printf '__SBH_ROUTE4__=%s\\n' \"$RT4\"",
            "printf '__SBH_ROUTE6__=%s\\n' \"$RT6\"",
            "printf '__SBH_EP_EXISTS__=%s\\n' \"$EP_EXISTS\"",
            "printf '__SBH_EP_STALE__=%s\\n' \"$EP_STALE\"",
            "printf '__SBH_EP_REUSABLE__=%s\\n' \"$EP_REUSABLE\"",
            "printf '__SBH_EP_PID__=%s\\n' \"$EP_PID\"",
            "printf '__SBH_EP_DATA__=%s\\n' \"$EP_DATA\"",
            "printf '__SBH_LIVE_TXN__=%s\\n' \"$LIVE_TXN\"",
            "printf '__SBH_PREFLIGHT_OK__=1\\n'",
            "finish"
        ]);
        return lines.join("; ");
    }

    function buildDispatchCommand(pathSet) {
        var inner = [
            "umask 077",
            "TXN=" + quote(pathSet.transactionPid),
            "READY=" + quote(pathSet.ready),
            "LOG=" + quote(pathSet.runtimeLog),
            "JAR=" + quote(pathSet.runtimeJar),
            "BIN=" + quote(pathSet.binary),
            "CFG=" + quote(pathSet.config),
            "WORK=" + quote(pathSet.work),
            "SERVER=" + quote(SERVER_CLASS),
            "SOCKET=" + quote(pathSet.socketName),
            "SECRET=" + quote(pathSet.secret),
            "TMP=\"$TXN.tmp\"",
            "printf '%s\\n' \"$$\" > \"$TMP\" || exit 641",
            "chmod 600 \"$TMP\" || exit 642",
            "chown 0:0 \"$TMP\" >/dev/null 2>&1 || true",
            "mv -f \"$TMP\" \"$TXN\" || exit 643",
            "APP=/system/bin/app_process64",
            "[ -x \"$APP\" ] || APP=/system/bin/app_process",
            "[ -x \"$APP\" ] || exit 644",
            "export CLASSPATH=\"$JAR\"",
            "cd \"$WORK\" || exit 645",
            "exec \"$APP\" /system/bin \"$SERVER\" \"$SOCKET\" \"$SECRET\" \"$BIN\" \"$CFG\" \"$WORK\" \"$READY\" >>\"$LOG\" 2>&1 </dev/null"
        ].join("; ");

        return [
            "umask 077",
            "TXN=" + quote(pathSet.transactionPid),
            "READY=" + quote(pathSet.ready),
            "LOG=" + quote(pathSet.runtimeLog),
            "[ ! -e \"$TXN\" ] && [ ! -e \"$TXN.tmp\" ] && [ ! -e \"$READY\" ] || exit 646",
            "touch \"$LOG\" || exit 647",
            "chmod 600 \"$LOG\" || exit 648",
            "chown 0:0 \"$LOG\" >/dev/null 2>&1 || true",
            "toybox setsid toybox setsid -d /system/bin/sh -c " +
                quote(inner) + " >/dev/null 2>&1 </dev/null",
            "DISPATCH=$?",
            "printf '__SBH_DISPATCH__=%s\\n' \"$DISPATCH\"",
            "printf '__SBH_DISPATCH_DONE__=1\\n'",
            "exit 0"
        ].join("; ");
    }

    function buildReconcileCommand(pathSet) {
        var lines = [
            "umask 077",
            "ROOT=" + quote(pathSet.root),
            "CFG=" + quote(pathSet.config),
            "BIN=" + quote(pathSet.binary),
            "STATE=" + quote(pathSet.state),
            "JAR=" + quote(pathSet.runtimeJar),
            "WORK=" + quote(pathSet.work),
            "CTRL=" + quote(pathSet.control),
            "ENDPOINT=" + quote(pathSet.endpoint),
            "ENDPOINT_TMP=" + quote(pathSet.endpointTemp),
            "AUDIT=" + quote(pathSet.recoveryAudit),
            "AUDIT_TMP=" + quote(pathSet.recoveryAuditTemp),
            "TXN=" + quote(pathSet.transactionPid),
            "READY=" + quote(pathSet.ready),
            "LOG=" + quote(pathSet.runtimeLog),
            "SERVER=" + quote(SERVER_CLASS),
            "CLIENT=" + quote(CLIENT_CLASS),
            "SOCKET=" + quote(pathSet.socketName),
            "SECRET=" + quote(pathSet.secret),
            "CREATED=" + quote(String(pathSet.createdAt)),
            "AUTH=" + quote(AUTHORIZATION_ID),
            "PID=0; ROLLBACK=0; TERM_SENT=0; KILL_SENT=0; STOPPED=0; PUBLISHED=0; AUDIT_CREATED=0",
            "finish(){ " +
                "printf '__SBH_PID__=%s\\n' \"$PID\"; " +
                "printf '__SBH_ROLLBACK__=%s\\n' \"$ROLLBACK\"; " +
                "printf '__SBH_TERM_SENT__=%s\\n' \"$TERM_SENT\"; " +
                "printf '__SBH_KILL_SENT__=%s\\n' \"$KILL_SENT\"; " +
                "printf '__SBH_STOPPED__=%s\\n' \"$STOPPED\"; " +
                "printf '__SBH_PUBLISHED__=%s\\n' \"$PUBLISHED\"; " +
                "printf '__SBH_AUDIT_CREATED__=%s\\n' \"$AUDIT_CREATED\"; " +
                "printf '__SBH_RECONCILE_DONE__=1\\n'; exit 0; }"
        ];

        lines = lines.concat(resourceFunctions());
        lines = lines.concat(identityFunctions());
        lines = lines.concat([
            "rollback_exact(){ " +
                "ROLLBACK=1; " +
                "case \"$PID\" in ''|*[!0-9]*) ;; " +
                "*) if kill -0 \"$PID\" 2>/dev/null && match_control \"$PID\"; then " +
                    "kill -TERM \"$PID\" 2>/dev/null && TERM_SENT=1; " +
                    "I=0; while [ \"$I\" -lt 2 ] && kill -0 \"$PID\" 2>/dev/null; do sleep 1; I=$((I + 1)); done; " +
                    "if kill -0 \"$PID\" 2>/dev/null && match_control \"$PID\"; then kill -KILL \"$PID\" 2>/dev/null && KILL_SENT=1; sleep 1; fi; " +
                    "if ! kill -0 \"$PID\" 2>/dev/null; then STOPPED=1; fi; " +
                "fi;; esac; " +
                "if [ -f \"$ENDPOINT\" ]; then EP=$(sed -n 's/.*\"runtimePid\"[[:space:]]*:[[:space:]]*\\([0-9][0-9]*\\).*/\\1/p' \"$ENDPOINT\" | sed -n '1p'); [ \"$EP\" = \"$PID\" ] && rm -f \"$ENDPOINT\"; fi; " +
                "if [ -f \"$AUDIT\" ]; then AP=$(sed -n 's/.*\"runtimePid\"[[:space:]]*:[[:space:]]*\\([0-9][0-9]*\\).*/\\1/p' \"$AUDIT\" | sed -n '1p'); [ \"$AP\" = \"$PID\" ] && rm -f \"$AUDIT\"; fi; " +
                "rm -f \"$ENDPOINT_TMP\" \"$AUDIT_TMP\" \"$TXN\" \"$TXN.tmp\" \"$READY\"; }",
            "fail(){ CODE=\"$1\"; rollback_exact; printf '__SBH_FAILURE_CODE__=%s\\n' \"$CODE\"; printf '__SBH_FAILURE__=1\\n'; finish; }",
            "I=0; while [ \"$I\" -lt " + String(START_WAIT_SECONDS) + " ] && [ ! -f \"$TXN\" ]; do sleep 1; I=$((I + 1)); done",
            "[ -f \"$TXN\" ] && [ ! -L \"$TXN\" ] || fail 651",
            "PID=$(cat \"$TXN\" 2>/dev/null)",
            "case \"$PID\" in ''|*[!0-9]*) fail 652;; esac",
            "kill -0 \"$PID\" 2>/dev/null || fail 653",
            "match_control \"$PID\" || fail 654",
            "UIDV=$(awk '/^Uid:/ {print $2; exit}' \"/proc/$PID/status\" 2>/dev/null)",
            "GIDV=$(awk '/^Gid:/ {print $2; exit}' \"/proc/$PID/status\" 2>/dev/null)",
            "[ \"$UIDV\" = 0 ] && [ \"$GIDV\" = 0 ] || fail 655",
            "I=0; while [ \"$I\" -lt " + String(START_WAIT_SECONDS) + " ] && [ ! -f \"$READY\" ]; do sleep 1; kill -0 \"$PID\" 2>/dev/null || fail 656; I=$((I + 1)); done",
            "[ -f \"$READY\" ] && [ ! -L \"$READY\" ] || fail 657",
            "printf '{\"schemaVersion\":1,\"runtimePid\":%s,\"socketName\":\"%s\",\"token\":\"%s\",\"serverClass\":\"%s\",\"clientClass\":\"%s\",\"runtimeJar\":\"%s\",\"binaryPath\":\"%s\",\"configPath\":\"%s\",\"workingDirectory\":\"%s\",\"createdAt\":%s}\\n' " +
                "\"$PID\" \"$SOCKET\" \"$SECRET\" \"$SERVER\" \"$CLIENT\" \"$JAR\" \"$BIN\" \"$CFG\" \"$WORK\" \"$CREATED\" > \"$ENDPOINT_TMP\" || fail 658",
            "chmod 600 \"$ENDPOINT_TMP\" || fail 659",
            "chown 0:0 \"$ENDPOINT_TMP\" >/dev/null 2>&1 || fail 660",
            "mv -f \"$ENDPOINT_TMP\" \"$ENDPOINT\" || fail 661",
            "PUBLISHED=1",
            "[ -f \"$ENDPOINT\" ] && [ ! -L \"$ENDPOINT\" ] || fail 662",
            "ENDPOINT_MODE=$(stat -c %a \"$ENDPOINT\" 2>/dev/null || echo -1)",
            "ENDPOINT_UID=$(stat -c %u \"$ENDPOINT\" 2>/dev/null || echo -1)",
            "ENDPOINT_GID=$(stat -c %g \"$ENDPOINT\" 2>/dev/null || echo -1)",
            "ENDPOINT_BYTES=$(stat -c %s \"$ENDPOINT\" 2>/dev/null || echo -1)",
            "[ \"$ENDPOINT_MODE\" = 600 ] && [ \"$ENDPOINT_UID\" = 0 ] && [ \"$ENDPOINT_GID\" = 0 ] || fail 663",
            "EP_PID=$(sed -n 's/.*\"runtimePid\"[[:space:]]*:[[:space:]]*\\([0-9][0-9]*\\).*/\\1/p' \"$ENDPOINT\" | sed -n '1p')",
            "[ \"$EP_PID\" = \"$PID\" ] || fail 664",
            "printf '{\"schemaVersion\":1,\"stage\":52,\"authorizationId\":\"%s\",\"sourceReconcileAuthorizationId\":\"%s\",\"runtimePid\":%s,\"createdAt\":%s}\\n' " +
                "\"$AUTH\" " + quote(SOURCE_RECONCILE_AUTHORIZATION_ID) + " \"$PID\" \"$CREATED\" > \"$AUDIT_TMP\" || fail 665",
            "chmod 600 \"$AUDIT_TMP\" || fail 666",
            "chown 0:0 \"$AUDIT_TMP\" >/dev/null 2>&1 || fail 667",
            "mv -f \"$AUDIT_TMP\" \"$AUDIT\" || fail 668",
            "AUDIT_CREATED=1",
            "EP_DATA=$(toybox base64 \"$ENDPOINT\" 2>/dev/null | tr -d '\\r\\n')",
            "[ -n \"$EP_DATA\" ] || fail 669",
            "rm -f \"$TXN\" \"$TXN.tmp\" \"$READY\"",
            "printf '__SBH_UIDV__=%s\\n' \"$UIDV\"",
            "printf '__SBH_GIDV__=%s\\n' \"$GIDV\"",
            "printf '__SBH_ENDPOINT_MODE__=%s\\n' \"$ENDPOINT_MODE\"",
            "printf '__SBH_ENDPOINT_UID__=%s\\n' \"$ENDPOINT_UID\"",
            "printf '__SBH_ENDPOINT_GID__=%s\\n' \"$ENDPOINT_GID\"",
            "printf '__SBH_ENDPOINT_BYTES__=%s\\n' \"$ENDPOINT_BYTES\"",
            "printf '__SBH_EP_DATA__=%s\\n' \"$EP_DATA\"",
            "printf '__SBH_RECOVERY_OK__=1\\n'",
            "finish"
        ]);
        return lines.join("; ");
    }

    function buildRollbackCommand(pathSet, pid) {
        var lines = [
            "umask 077",
            "PID=" + quote(String(pid)),
            "CFG=" + quote(pathSet.config),
            "WORK=" + quote(pathSet.work),
            "SERVER=" + quote(SERVER_CLASS),
            "ENDPOINT=" + quote(pathSet.endpoint),
            "AUDIT=" + quote(pathSet.recoveryAudit),
            "TXN=" + quote(pathSet.transactionPid),
            "READY=" + quote(pathSet.ready),
            "IDENTITY=0; TERM_SENT=0; KILL_SENT=0; STOPPED=0",
            "match_control(){ " +
                "P=\"$1\"; [ -r \"/proc/$P/cmdline\" ] || return 1; " +
                "V=$(tr '\\000' ' ' < \"/proc/$P/cmdline\" 2>/dev/null); " +
                "case \"$V\" in *\"$SERVER\"*\"$CFG\"*\"$WORK\"*) return 0;; " +
                "*) return 1;; esac; }",
            "if kill -0 \"$PID\" 2>/dev/null && match_control \"$PID\"; then " +
                "IDENTITY=1; kill -TERM \"$PID\" 2>/dev/null && TERM_SENT=1; " +
                "I=0; while [ \"$I\" -lt 2 ] && kill -0 \"$PID\" 2>/dev/null; do sleep 1; I=$((I + 1)); done; " +
                "if kill -0 \"$PID\" 2>/dev/null && match_control \"$PID\"; then kill -KILL \"$PID\" 2>/dev/null && KILL_SENT=1; sleep 1; fi; " +
            "fi",
            "if ! kill -0 \"$PID\" 2>/dev/null; then STOPPED=1; fi",
            "if [ -f \"$ENDPOINT\" ]; then EP=$(sed -n 's/.*\"runtimePid\"[[:space:]]*:[[:space:]]*\\([0-9][0-9]*\\).*/\\1/p' \"$ENDPOINT\" | sed -n '1p'); [ \"$EP\" = \"$PID\" ] && rm -f \"$ENDPOINT\"; fi",
            "if [ -f \"$AUDIT\" ]; then AP=$(sed -n 's/.*\"runtimePid\"[[:space:]]*:[[:space:]]*\\([0-9][0-9]*\\).*/\\1/p' \"$AUDIT\" | sed -n '1p'); [ \"$AP\" = \"$PID\" ] && rm -f \"$AUDIT\"; fi",
            "rm -f \"$TXN\" \"$TXN.tmp\" \"$READY\"",
            "printf '__SBH_IDENTITY__=%s\\n' \"$IDENTITY\"",
            "printf '__SBH_TERM_SENT__=%s\\n' \"$TERM_SENT\"",
            "printf '__SBH_KILL_SENT__=%s\\n' \"$KILL_SENT\"",
            "printf '__SBH_STOPPED__=%s\\n' \"$STOPPED\"",
            "printf '__SBH_ROLLBACK_DONE__=1\\n'",
            "exit 0"
        ];
        return lines.join("; ");
    }

    function validateEndpoint(endpoint, expectedPid) {
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
        if (String(endpoint.runtimeJar || "") !==
                runtimeRoot() + "/runtime/core/SingBoxHubCoreRuntime.jar" ||
                String(endpoint.binaryPath || "") !==
                runtimeRoot() + "/bin/sing-box" ||
                String(endpoint.configPath || "") !==
                runtimeRoot() + "/config/runtime-tun.json" ||
                String(endpoint.workingDirectory || "") !==
                runtimeRoot() + "/runtime/core/work") {
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

    function recover() {
        var pathSet = createPathSet();
        var preflight = null;
        var dispatch = null;
        var reconcile = null;
        var rollback = null;
        var raw = "";
        var preflightRaw = "";
        var dispatchRaw = "";
        var reconcileRaw = "";
        var endpoint = null;
        var endpointData = null;
        var endpointDataObserved = false;
        var endpointDataSource = null;
        var socketName = null;
        var secret = null;
        var correlation = null;
        var socket = null;
        var socketWrapperCreated = false;
        var socketConnectionAttempted = false;
        var socketConnected = false;
        var socketReadTimeoutConfigured = false;
        var requestSent = false;
        var responseStatusMatched = false;
        var correlationMatched = false;
        var socketClosed = false;
        var writer = null;
        var reader = null;
        var statusLine = null;
        var correlationLine = null;
        var pid = null;
        var reused = false;
        var startedNew = false;
        var rollbackInvoked = false;
        var rollbackStopped = false;
        var startedAt = now();
        var success = false;
        var failureCode = null;
        var failureText = null;

        try {
            preflight = executeShell(
                buildPreflightCommand(pathSet),
                "preflight"
            );
            preflightRaw = preflight.output;
            raw = preflightRaw;
            if (!yes(preflightRaw, "PREFLIGHT_DONE") ||
                    !yes(preflightRaw, "PREFLIGHT_OK")) {
                throw new Error(
                    marker(preflightRaw, "GATE") ||
                    "CONTROL_SERVICE_RECOVERY_PREFLIGHT_FAILED"
                );
            }

            reused = yes(preflightRaw, "EP_REUSABLE");
            if (reused) {
                pid = numberValue(preflightRaw, "EP_PID");
                endpointData = marker(preflightRaw, "EP_DATA");
                endpointDataSource = "preflight_reused_endpoint";
            } else {
                dispatch = executeShell(
                    buildDispatchCommand(pathSet),
                    "dispatch"
                );
                dispatchRaw = dispatch.output;
                raw += "\n" + dispatchRaw;
                if (!yes(dispatchRaw, "DISPATCH_DONE") ||
                        numberValue(dispatchRaw, "DISPATCH") !== 0) {
                    throw new Error("CONTROL_SERVICE_DISPATCH_FAILED");
                }
                startedNew = true;
                reconcile = executeShell(
                    buildReconcileCommand(pathSet),
                    "reconcile"
                );
                reconcileRaw = reconcile.output;
                raw += "\n" + reconcileRaw;
                pid = numberValue(reconcileRaw, "PID");
                if (!yes(reconcileRaw, "RECONCILE_DONE") ||
                        !yes(reconcileRaw, "RECOVERY_OK") ||
                        yes(reconcileRaw, "FAILURE")) {
                    throw new Error(
                        "CONTROL_SERVICE_RECONCILE_FAILED_" +
                        String(marker(reconcileRaw, "FAILURE_CODE") || "UNKNOWN")
                    );
                }
                endpointData = marker(reconcileRaw, "EP_DATA");
                endpointDataSource = "reconcile_published_endpoint";
            }

            endpointDataObserved =
                endpointData !== null &&
                endpointData !== "" &&
                endpointData !== "none";
            if (pid === null || !endpointDataObserved) {
                throw new Error("CONTROL_SERVICE_ENDPOINT_DATA_MISSING");
            }
            endpoint = validateEndpoint(
                decodeEndpoint(endpointData),
                pid
            );
            socketName = String(endpoint.socketName);
            secret = String(endpoint.token);
            endpoint = null;
            correlation =
                "sbh52-" + now() + "-" + randomHex(12);
            socket = new LocalSocket();
            socketWrapperCreated = true;
            socketConnectionAttempted = true;
            socket.connect(
                new LocalSocketAddress(
                    socketName,
                    LocalSocketAddress.Namespace.ABSTRACT
                )
            );
            socketConnected = true;
            socket.setSoTimeout(SOCKET_READ_TIMEOUT_MS);
            socketReadTimeoutConfigured = true;
            writer = new BufferedWriter(
                new OutputStreamWriter(
                    socket.getOutputStream(),
                    "UTF-8"
                )
            );
            writer.write(secret);
            writer.newLine();
            writer.write(correlation);
            writer.newLine();
            writer.write("PING");
            writer.newLine();
            writer.flush();
            requestSent = true;
            reader = new BufferedReader(
                new InputStreamReader(
                    socket.getInputStream(),
                    "UTF-8"
                )
            );
            statusLine = reader.readLine();
            correlationLine = reader.readLine();
            responseStatusMatched =
                String(statusLine || "") === "PONG";
            correlationMatched =
                String(correlationLine || "") === correlation;
            if (!responseStatusMatched) {
                throw new Error("UNEXPECTED_RESPONSE_STATUS");
            }
            if (!correlationMatched) {
                throw new Error("CORRELATION_ECHO_MISMATCH");
            }
            success = true;
        } catch (error) {
            failureCode = errorCode(error);
            try {
                failureText = String(SBH.util.errorText(error));
            } catch (ignoredText) {
                failureText = String(error);
            }
            if (startedNew && pid !== null) {
                rollbackInvoked = true;
                try {
                    rollback = executeShell(
                        buildRollbackCommand(pathSet, pid),
                        "rollback"
                    );
                    rollbackStopped =
                        yes(rollback.output, "ROLLBACK_DONE") &&
                        yes(rollback.output, "STOPPED");
                } catch (ignoredRollback) {
                    rollbackStopped = false;
                }
            }
        } finally {
            closeQuietly(reader);
            closeQuietly(writer);
            socketClosed = socket !== null ?
                closeQuietly(socket) : false;
            endpoint = null;
            endpointData = null;
            socketName = null;
            secret = null;
            correlation = null;
            statusLine = null;
            correlationLine = null;
            pathSet.secret = null;
            pathSet.socketName = null;
        }

        return {
            ok: success,
            stage:
                "production_stage52_retry1_runtime_control_service_recovery",
            authorizationId: AUTHORIZATION_ID,
            sourceReconcileAuthorizationId:
                SOURCE_RECONCILE_AUTHORIZATION_ID,
            authorizationConsumed: true,
            automaticRetryAllowed: false,
            manualOnly: true,
            markerResolutionMode:
                "phase_scoped_reverse_line_scan",
            endpointDataSource: endpointDataSource,
            endpointDataObserved: endpointDataObserved,
            preflightPassed:
                yes(raw, "PREFLIGHT_DONE") &&
                yes(raw, "PREFLIGHT_OK"),
            blockingGate:
                success ? null : marker(raw, "GATE"),
            preflightCode: numberValue(raw, "CODE"),
            staleCoreReconcileAuditVerified:
                yes(raw, "PREFLIGHT_OK"),
            productionConfigSha256: marker(raw, "CH"),
            productionConfigByteCount:
                numberValue(raw, "CB"),
            productionConfigCheckPassed:
                numberValue(raw, "CHECK") === 0,
            matchingCoreCountBefore:
                numberValue(raw, "CORE"),
            tunInterfacePresentBefore:
                yes(raw, "TUN"),
            reservedIpv4RuleCountBefore:
                numberValue(raw, "RULE4"),
            reservedIpv6RuleCountBefore:
                numberValue(raw, "RULE6"),
            reservedIpv4RouteCountBefore:
                numberValue(raw, "ROUTE4"),
            reservedIpv6RouteCountBefore:
                numberValue(raw, "ROUTE6"),
            endpointExistedBefore:
                yes(raw, "EP_EXISTS"),
            staleEndpointDetected:
                yes(raw, "EP_STALE"),
            existingControlServiceReused: reused,
            orphanControlServiceCandidateCount:
                numberValue(raw, "LIVE_TXN"),
            dispatchAttempted: !reused,
            dispatchCompletionMarkerObserved:
                dispatch !== null &&
                yes(raw, "DISPATCH_DONE"),
            dispatchExitCode:
                numberValue(raw, "DISPATCH"),
            controlServiceStarted: success && startedNew,
            controlServicePid: pid,
            controlServiceProcessAlive: success,
            controlServiceCommandValidated: success,
            controlServiceOwnerValidated:
                reused ? success :
                    numberValue(raw, "UIDV") === 0 &&
                    numberValue(raw, "GIDV") === 0,
            controlServiceRemainsRunning: success,
            endpointFileCanonical: success,
            endpointModeValidated:
                reused ? success :
                    marker(raw, "ENDPOINT_MODE") === "600",
            endpointOwnerValidated:
                reused ? success :
                    numberValue(raw, "ENDPOINT_UID") === 0 &&
                    numberValue(raw, "ENDPOINT_GID") === 0,
            endpointSchemaValidated: success,
            endpointContractReady: success,
            endpointByteCount:
                numberValue(raw, "ENDPOINT_BYTES"),
            recoveryAuditCreated:
                startedNew && yes(raw, "AUDIT_CREATED"),
            recoveryAuditRelativePath:
                startedNew ?
                    "state/control-service-last-recovery.json" : null,
            localSocketWrapperCreated:
                socketWrapperCreated,
            localSocketPublicConnectUsed:
                socketConnectionAttempted,
            connectTimeoutOverloadUsed: false,
            socketReadTimeoutConfigured:
                socketReadTimeoutConfigured,
            socketConnectionAttempted:
                socketConnectionAttempted,
            socketConnected: socketConnected,
            requestSent: requestSent,
            requestCount: requestSent ? 1 : 0,
            responseStatus:
                responseStatusMatched ? "PONG" : null,
            responseStatusMatched:
                responseStatusMatched,
            correlationMatched: correlationMatched,
            socketClosed: socketClosed,
            sensitiveReferencesCleared: true,
            tokenValueRead: pid !== null,
            tokenValueExposed: false,
            socketNameValueRead: pid !== null,
            socketNameValueExposed: false,
            rollbackInvoked: rollbackInvoked,
            rollbackStoppedExactProcess:
                rollbackStopped,
            coreStartInvoked: false,
            coreStopInvoked: false,
            coreRunning: false,
            runtimeFilesModified:
                success && startedNew,
            configModified: false,
            stagingModified: false,
            tunCreated: false,
            routeModified: false,
            networkTrafficGeneratedByProbe: false,
            networkAccessed: false,
            destructiveOperations: false,
            controlServiceRecoveryRequired: !success,
            readyForProductionLifecycleIntegration: success,
            nextAuthorizedOperation:
                success ?
                    "runtime_core_lifecycle_control_integration" :
                    (
                        rollbackInvoked && !rollbackStopped ?
                            "reconcile_control_service_recovery_state" :
                            "resolve_control_service_recovery_gate"
                    ),
            errorCode: success ? null : failureCode,
            error:
                success || failureText === null ? null :
                    String(failureText).substring(0, 256),
            preflightShellCode:
                preflight === null ? null : preflight.code,
            dispatchShellCode:
                dispatch === null ? null : dispatch.code,
            reconcileShellCode:
                reconcile === null ? null : reconcile.code,
            shellCodeAuthoritative: false,
            shellTransportCodeAnomalous:
                (
                    preflight !== null && preflight.code !== 0
                ) || (
                    dispatch !== null && dispatch.code !== 0
                ) || (
                    reconcile !== null && reconcile.code !== 0
                ),
            durationMs: now() - startedAt,
            timestamp: now()
        };
    }

    function recoverAsync(callback) {
        if (typeof callback !== "function") {
            throw new Error("Stage52 Retry1 callback unavailable");
        }
        if (busy) {
            callback({
                ok: false,
                stage:
                    "production_stage52_retry1_runtime_control_service_recovery",
                errorCode:
                    "CONTROL_SERVICE_RECOVERY_ALREADY_RUNNING",
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
                        output = recover();
                    } catch (error) {
                        output = {
                            ok: false,
                            stage:
                                "production_stage52_retry1_runtime_control_service_recovery",
                            errorCode:
                                "CONTROL_SERVICE_RECOVERY_FAILED",
                            authorizationId: AUTHORIZATION_ID,
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
            "SingBoxHub-Stage52Retry1ControlServiceRecovery"
        ).start();

        return {
            accepted: true,
            busy: false
        };
    }

    function buildCard() {
        var card = W.card(17);
        var title = W.text(
            "Stage 52 Retry 1：修复 endpoint 数据回传",
            17,
            C.navy,
            true
        );
        var note = W.text(
            "Stage 52 已成功派发并发布 endpoint，但旧 marker 解析器读取了前置门禁中的 EP_DATA=none，" +
            "导致误报 CONTROL_SERVICE_ENDPOINT_DATA_MISSING，并已精确回滚 PID 11777。" +
            "本次改为按阶段读取并从后向前解析 marker，再重新执行相同受限恢复与一次认证 PING。" +
            "不启动 sing-box Core，不创建 TUN，不修改路由、DNS 或防火墙。",
            11.4,
            C.secondary,
            false
        );
        var resultText = W.text(
            JSON.stringify({
                ready: true,
                authorizationId: AUTHORIZATION_ID,
                sourceReconcileAuthorizationId:
                    SOURCE_RECONCILE_AUTHORIZATION_ID,
                controlServiceRecoveryEnabled: true,
                authenticatedPingMaximum: 1,
                markerCollisionFixed: true,
                markerResolutionMode:
                    "phase_scoped_reverse_line_scan",
                coreStartEnabled: false,
                tunEnabled: false,
                routeWriteEnabled: false,
                automaticRetryAllowed: false
            }, null, 2),
            10.3,
            C.secondary,
            false
        );
        var button = W.button(
            "修复后恢复并验证 Runtime 控制服务",
            "shield",
            C.orange,
            C.orangeSoft,
            function () {
                resultText.setText(
                    "正在修复 marker 解析并恢复 Runtime 控制服务。"
                );
                SBH.util.toast(
                    "正在执行 Stage 52 Retry 1"
                );
                recoverAsync(function (result) {
                    resultText.setText(
                        JSON.stringify(result, null, 2)
                    );
                    SBH.util.toast(
                        result.ok === true ?
                            "Runtime 控制服务恢复并认证通过" :
                            "Stage 52 Retry 1 存在待处理项"
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
        throw new Error("Stage52 Retry1 dependencies unavailable");
    }

    SBH.runtimeControlServiceRecoveryRetry1 = {
        version: 1,
        recoverAsync: recoverAsync,
        authorizationId: AUTHORIZATION_ID,
        sourceReconcileAuthorizationId:
            SOURCE_RECONCILE_AUTHORIZATION_ID,
        manualOnly: true,
        automaticRetryAllowed: false,
        authenticatedPingMaximum: 1,
        markerCollisionFixed: true,
        markerResolutionMode:
            "phase_scoped_reverse_line_scan",
        coreStartEnabled: false,
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
        output.runtimeControlServiceRecoveryRetry1Version = 1;
        output.runtimeControlServiceRecoveryRetry1Ready = true;
        output.runtimeControlServiceRecoveryRetry1AuthorizationId =
            AUTHORIZATION_ID;
        output.runtimeControlServiceRecoveryRetry1ManualOnly = true;
        output.runtimeControlServiceRecoveryRetry1AutomaticRetry = false;
        output.runtimeControlServiceRecoveryRetry1PingMaximum = 1;
        output.runtimeControlServiceRecoveryRetry1MarkerCollisionFixed = true;
        output.runtimeControlServiceRecoveryRetry1MarkerResolutionMode =
            "phase_scoped_reverse_line_scan";
        output.runtimeControlServiceRecoveryRetry1CoreStartEnabled = false;
        output.runtimeControlServiceRecoveryRetry1TunEnabled = false;
        output.runtimeControlServiceRecoveryRetry1RouteWriteEnabled = false;
        output.writeOperationsLocked = false;
        output.destructiveOperations = false;
        return output;
    };
}());
