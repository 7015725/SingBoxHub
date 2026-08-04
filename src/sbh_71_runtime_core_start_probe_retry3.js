/* SingBoxHub Stage50 Retry3 constrained Core start probe after state repair. Rhino ES5 only. */
SBH.versions.runtimeCoreStartProbeRetry3 = 1;

(function () {
    "use strict";

    var P = Packages;
    var Thread = P.java.lang.Thread;
    var Runnable = P.java.lang.Runnable;
    var ShellCommand =
        P.tornaco.apps.shortx.core.proto.action.ShellCommand;
    var originalFactory = SBH.navigation.pages[1];
    var originalStart = SBH.app.start;
    var W = SBH.widgets;
    var C = SBH.theme.colors;
    var busy = false;

    var AUTHORIZATION_ID =
        "stage50-retry3-runtime-core-start-probe-user-authorized-20260804";
    var CHECK_TIMEOUT_SECONDS = 30;
    var START_WAIT_SECONDS = 6;
    var STABILITY_SECONDS = 4;
    var MAX_LOG_BYTES = 1024 * 1024;

    function now() {
        return Number(P.java.lang.System.currentTimeMillis());
    }

    function quote(value) {
        return "'" + String(value)
            .replace(/'/g, "'\\''") + "'";
    }

    function contextValue(data, key) {
        var value = data.get(String(key));
        return value === null || value === undefined ?
            "" : String(value);
    }

    function marker(raw, name) {
        var match = String(raw || "").match(
            new RegExp(
                "(?:^|\\n)__SBH_" + name +
                "__=([^\\n]*)(?:\\n|$)"
            )
        );
        return match ? String(match[1]) : null;
    }

    function yes(raw, name) {
        return marker(raw, name) === "1";
    }

    function numberValue(raw, name) {
        var value = marker(raw, name);
        var parsed = Number(value);
        return value !== null && isFinite(parsed) ?
            parsed : null;
    }

    function executeShell(command, suffix) {
        var action = ShellCommand.newBuilder()
            .setCommand(String(command))
            .setSingleShot(true)
            .setId(
                "SingBoxHub#Stage50Retry3#" +
                String(suffix || "shell") + "#" +
                String(SBH.util.randomToken())
            )
            .build();
        var result = shortx.executeAction(action);
        var data = result.contextData;
        var stdout = contextValue(data, "shellOut");
        var stderr = contextValue(data, "shellErr");

        return {
            code: Number(data.get("shellCode")),
            output: stdout +
                (stderr ? "\n" + stderr : "")
        };
    }

    function runtimeRoot() {
        return String(shortx.getShortXDir()) +
            "/SingBoxHub";
    }

    function paths(token) {
        var root = runtimeRoot();
        var state = root + "/state";
        var probeDir = state + "/core-probes";
        return {
            root: root,
            configDir: root + "/config",
            config: root + "/config/runtime-tun.json",
            binary: root + "/bin/sing-box",
            state: state,
            probeDir: probeDir,
            logs: root + "/logs",
            transactionPid:
                probeDir + "/core-start-" + token + ".pid",
            log:
                root + "/logs/core-start-probe-" + token + ".log",
            activePid:
                state + "/core-probe-active.pid",
            activeMeta:
                state + "/core-probe-active.json"
        };
    }

    function resourceCountFunctions() {
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
                "[ \"$A2\" = -c ] && [ \"$A3\" = \"$CFG\" ]; " +
            "}",
            "core_count(){ " +
                "C=0; for X in /proc/[0-9]*/cmdline; do " +
                    "[ -r \"$X\" ] || continue; P=${X#/proc/}; P=${P%/cmdline}; " +
                    "if match_core \"$P\"; then C=$((C + 1)); fi; " +
                "done; printf '%s' \"$C\"; " +
            "}"
        ];
    }

    function checkFunction() {
        return "check_config(){ " +
            "if command -v timeout >/dev/null 2>&1; then " +
                "timeout " + String(CHECK_TIMEOUT_SECONDS) +
                "s \"$BIN\" check -c \"$CFG\" >/dev/null 2>&1; " +
            "else \"$BIN\" check -c \"$CFG\" >/dev/null 2>&1; fi; " +
        "}";
    }

    function buildPreflightCommand(pathSet) {
        var lines = [
            "umask 077",
            "ROOT=" + quote(pathSet.root),
            "D=" + quote(pathSet.configDir),
            "CFG=" + quote(pathSet.config),
            "BIN=" + quote(pathSet.binary),
            "STATE=" + quote(pathSet.state),
            "PROBE=" + quote(pathSet.probeDir),
            "LOGS=" + quote(pathSet.logs),
            "TXN=" + quote(pathSet.transactionPid),
            "LOG=" + quote(pathSet.log),
            "ACTIVE_PID=" + quote(pathSet.activePid),
            "ACTIVE_META=" + quote(pathSet.activeMeta)
        ];

        lines = lines.concat(resourceCountFunctions());
        lines = lines.concat(identityFunctions());
        lines.push(checkFunction());
        lines = lines.concat([
            "printf '__SBH_UID__=%s\\n' \"$(id -u 2>/dev/null)\"",
            "[ \"$(id -u 2>/dev/null)\" = 0 ] || exit 211",
            "[ -d \"$ROOT\" ] && [ ! -L \"$ROOT\" ] || exit 212",
            "[ -d \"$D\" ] && [ ! -L \"$D\" ] || exit 213",
            "[ -d \"$STATE\" ] && [ ! -L \"$STATE\" ] || exit 214",
            "SM=$(stat -c %a \"$STATE\" 2>/dev/null || echo -1)",
            "SU=$(stat -c %u \"$STATE\" 2>/dev/null || echo -1)",
            "SG=$(stat -c %g \"$STATE\" 2>/dev/null || echo -1)",
            "printf '__SBH_SM__=%s\\n' \"$SM\"",
            "printf '__SBH_SU__=%s\\n' \"$SU\"",
            "printf '__SBH_SG__=%s\\n' \"$SG\"",
            "[ \"$SM\" = 700 ] && [ \"$SU\" = 0 ] && [ \"$SG\" = 0 ] || exit 234",
            "[ -d \"$LOGS\" ] && [ ! -L \"$LOGS\" ] || exit 215",
            "if [ -e \"$PROBE\" ]; then " +
                "[ -d \"$PROBE\" ] && [ ! -L \"$PROBE\" ] || exit 216; " +
            "else mkdir \"$PROBE\" 2>/dev/null || exit 217; fi",
            "chmod 700 \"$PROBE\" 2>/dev/null || exit 218",
            "chown 0:0 \"$PROBE\" >/dev/null 2>&1 || true",
            "[ -f \"$CFG\" ] && [ ! -L \"$CFG\" ] || exit 219",
            "[ -f \"$BIN\" ] && [ -x \"$BIN\" ] && [ ! -L \"$BIN\" ] || exit 220",
            "CM=$(stat -c %a \"$CFG\" 2>/dev/null || echo -1)",
            "CU=$(stat -c %u \"$CFG\" 2>/dev/null || echo -1)",
            "CG=$(stat -c %g \"$CFG\" 2>/dev/null || echo -1)",
            "[ \"$CM\" = 600 ] && [ \"$CU\" = 0 ] && [ \"$CG\" = 0 ] || exit 221",
            "SC=0; STAGE=''",
            "for F in \"$D\"/.runtime-tun.json.stage-*; do " +
                "[ -e \"$F\" ] || continue; SC=$((SC + 1)); STAGE=\"$F\"; " +
            "done",
            "printf '__SBH_STAGE_COUNT__=%s\\n' \"$SC\"",
            "[ \"$SC\" = 1 ] || exit 222",
            "[ -f \"$STAGE\" ] && [ ! -L \"$STAGE\" ] || exit 223",
            "CH=$(sha256sum \"$CFG\" 2>/dev/null | awk '{print $1}')",
            "CB=$(stat -c %s \"$CFG\" 2>/dev/null || echo -1)",
            "SH=$(sha256sum \"$STAGE\" 2>/dev/null | awk '{print $1}')",
            "SB=$(stat -c %s \"$STAGE\" 2>/dev/null || echo -1)",
            "[ \"$CH\" = \"$SH\" ] && [ \"$CB\" = \"$SB\" ] || exit 224",
            "check_config; CHECK=$?",
            "printf '__SBH_CHECK__=%s\\n' \"$CHECK\"",
            "[ \"$CHECK\" = 0 ] || exit 225",
            "[ ! -e \"$TXN\" ] && [ ! -e \"$TXN.tmp\" ] && [ ! -e \"$LOG\" ] || exit 226",
            "[ ! -e \"$ACTIVE_META\" ] || exit 227",
            "if [ -e \"$ACTIVE_PID\" ]; then " +
                "[ -f \"$ACTIVE_PID\" ] && [ ! -L \"$ACTIVE_PID\" ] || exit 228; " +
                "AP=$(cat \"$ACTIVE_PID\" 2>/dev/null); " +
                "case \"$AP\" in ''|*[!0-9]*) exit 229;; esac; " +
                "if kill -0 \"$AP\" 2>/dev/null && match_core \"$AP\"; then exit 230; fi; " +
                "exit 231; " +
            "fi",
            "EXISTING=$(core_count)",
            "printf '__SBH_EXISTING__=%s\\n' \"$EXISTING\"",
            "[ \"$EXISTING\" = 0 ] || exit 232",
            "TUN=0; [ -e /sys/class/net/sbh-tun0 ] && TUN=1",
            "R4=$(rule4_count); R6=$(rule6_count)",
            "RT4=$(route4_count); RT6=$(route6_count)",
            "printf '__SBH_TUN_BEFORE__=%s\\n' \"$TUN\"",
            "printf '__SBH_RULE4_BEFORE__=%s\\n' \"$R4\"",
            "printf '__SBH_RULE6_BEFORE__=%s\\n' \"$R6\"",
            "printf '__SBH_ROUTE4_BEFORE__=%s\\n' \"$RT4\"",
            "printf '__SBH_ROUTE6_BEFORE__=%s\\n' \"$RT6\"",
            "[ \"$TUN\" = 0 ] && [ \"$R4\" = 0 ] && [ \"$R6\" = 0 ] && " +
                "[ \"$RT4\" = 0 ] && [ \"$RT6\" = 0 ] || exit 233",
            "printf '__SBH_CH__=%s\\n' \"$CH\"",
            "printf '__SBH_CB__=%s\\n' \"$CB\"",
            "printf '__SBH_SH__=%s\\n' \"$SH\"",
            "printf '__SBH_SB__=%s\\n' \"$SB\"",
            "printf '__SBH_CM__=%s\\n' \"$CM\"",
            "printf '__SBH_CU__=%s\\n' \"$CU\"",
            "printf '__SBH_CG__=%s\\n' \"$CG\"",
            "printf '__SBH_PREFLIGHT_DONE__=1\\n'",
            "exit 0"
        ]);
        return lines.join("; ");
    }

    function buildDispatchCommand(pathSet) {
        var inner = [
            "umask 077",
            "TXN=\"$1\"",
            "LOG=\"$2\"",
            "ROOT=\"$3\"",
            "BIN=\"$4\"",
            "CFG=\"$5\"",
            "TMP=\"$TXN.tmp\"",
            "printf '%s\\n' \"$$\" > \"$TMP\" || exit 241",
            "chmod 600 \"$TMP\" || exit 242",
            "chown 0:0 \"$TMP\" >/dev/null 2>&1 || true",
            "mv \"$TMP\" \"$TXN\" || exit 243",
            "cd \"$ROOT\" || exit 244",
            "exec \"$BIN\" run -c \"$CFG\" >>\"$LOG\" 2>&1 </dev/null"
        ].join("; ");

        return [
            "umask 077",
            "TXN=" + quote(pathSet.transactionPid),
            "LOG=" + quote(pathSet.log),
            "ROOT=" + quote(pathSet.root),
            "BIN=" + quote(pathSet.binary),
            "CFG=" + quote(pathSet.config),
            "[ ! -e \"$TXN\" ] && [ ! -e \"$TXN.tmp\" ] && [ ! -e \"$LOG\" ] || exit 245",
            ": > \"$LOG\" || exit 246",
            "chmod 600 \"$LOG\" || exit 247",
            "chown 0:0 \"$LOG\" >/dev/null 2>&1 || true",
            "toybox setsid toybox setsid -d /system/bin/sh -c " +
                quote(inner) + " sh \"$TXN\" \"$LOG\" \"$ROOT\" \"$BIN\" \"$CFG\" " +
                ">/dev/null 2>&1 </dev/null",
            "DISPATCH=$?",
            "printf '__SBH_DISPATCH__=%s\\n' \"$DISPATCH\"",
            "[ \"$DISPATCH\" = 0 ] || exit 248",
            "printf '__SBH_DISPATCH_DONE__=1\\n'",
            "exit 0"
        ].join("; ");
    }

    function buildReconcileCommand(pathSet, token, expectedHash) {
        var lines = [
            "umask 077",
            "ROOT=" + quote(pathSet.root),
            "D=" + quote(pathSet.configDir),
            "CFG=" + quote(pathSet.config),
            "BIN=" + quote(pathSet.binary),
            "STATE=" + quote(pathSet.state),
            "TXN=" + quote(pathSet.transactionPid),
            "LOG=" + quote(pathSet.log),
            "ACTIVE_PID=" + quote(pathSet.activePid),
            "ACTIVE_META=" + quote(pathSet.activeMeta),
            "TOKEN=" + quote(token),
            "AUTH=" + quote(AUTHORIZATION_ID),
            "EXPECTED=" + quote(expectedHash),
            "MAXLOG=" + quote(String(MAX_LOG_BYTES)),
            "ROLLBACK=0",
            "ROLLBACK_STOPPED=0",
            "TERM_SENT=0",
            "KILL_SENT=0",
            "PUBLISHED=0"
        ];

        lines = lines.concat(resourceCountFunctions());
        lines = lines.concat(identityFunctions());
        lines = lines.concat([
            "rollback_exact(){ " +
                "ROLLBACK=1; " +
                "if [ -n \"${PID:-}\" ]; then " +
                    "case \"$PID\" in *[!0-9]*|'') ;; " +
                    "*) if kill -0 \"$PID\" 2>/dev/null; then " +
                        "if match_core \"$PID\"; then " +
                            "kill -TERM \"$PID\" 2>/dev/null && TERM_SENT=1; " +
                            "I=0; while [ \"$I\" -lt 3 ] && kill -0 \"$PID\" 2>/dev/null; do sleep 1; I=$((I + 1)); done; " +
                            "if kill -0 \"$PID\" 2>/dev/null && match_core \"$PID\"; then " +
                                "kill -KILL \"$PID\" 2>/dev/null && KILL_SENT=1; sleep 1; " +
                            "fi; " +
                        "fi; " +
                    "fi; " +
                    "if ! kill -0 \"$PID\" 2>/dev/null; then ROLLBACK_STOPPED=1; fi;; esac; " +
                "fi; " +
                "if [ -f \"$ACTIVE_PID\" ] && [ \"$(cat \"$ACTIVE_PID\" 2>/dev/null)\" = \"${PID:-none}\" ]; then rm -f \"$ACTIVE_PID\"; fi; " +
                "if [ \"$PUBLISHED\" = 1 ]; then rm -f \"$ACTIVE_META\"; fi; " +
                "rm -f \"$TXN.tmp\"; " +
            "}",
            "emit_failure(){ " +
                "EC=\"$1\"; rollback_exact; " +
                "printf '__SBH_PID__=%s\\n' \"${PID:--1}\"; " +
                "printf '__SBH_ROLLBACK__=%s\\n' \"$ROLLBACK\"; " +
                "printf '__SBH_ROLLBACK_STOPPED__=%s\\n' \"$ROLLBACK_STOPPED\"; " +
                "printf '__SBH_TERM_SENT__=%s\\n' \"$TERM_SENT\"; " +
                "TUNA=0; [ -e /sys/class/net/sbh-tun0 ] && TUNA=1; " +
                "R4A=$(rule4_count); R6A=$(rule6_count); " +
                "RT4A=$(route4_count); RT6A=$(route6_count); " +
                "printf '__SBH_KILL_SENT__=%s\\n' \"$KILL_SENT\"; " +
                "printf '__SBH_TUN_AFTER__=%s\\n' \"$TUNA\"; " +
                "printf '__SBH_RULE4_AFTER__=%s\\n' \"$R4A\"; " +
                "printf '__SBH_RULE6_AFTER__=%s\\n' \"$R6A\"; " +
                "printf '__SBH_ROUTE4_AFTER__=%s\\n' \"$RT4A\"; " +
                "printf '__SBH_ROUTE6_AFTER__=%s\\n' \"$RT6A\"; " +
                "printf '__SBH_FAILURE_MARKER__=1\\n'; exit \"$EC\"; " +
            "}",
            "I=0; while [ \"$I\" -lt " + String(START_WAIT_SECONDS) +
                " ] && [ ! -f \"$TXN\" ]; do sleep 1; I=$((I + 1)); done",
            "[ -f \"$TXN\" ] && [ ! -L \"$TXN\" ] || emit_failure 251",
            "PID=$(cat \"$TXN\" 2>/dev/null)",
            "case \"$PID\" in ''|*[!0-9]*) emit_failure 252;; esac",
            "kill -0 \"$PID\" 2>/dev/null || emit_failure 253",
            "match_core \"$PID\" || emit_failure 254",
            "UIDV=$(awk '/^Uid:/ {print $2; exit}' \"/proc/$PID/status\" 2>/dev/null)",
            "[ \"$UIDV\" = 0 ] || emit_failure 255",
            "COUNT=$(core_count)",
            "[ \"$COUNT\" = 1 ] || emit_failure 256",
            "I=0; while [ \"$I\" -lt " + String(STABILITY_SECONDS) +
                " ]; do sleep 1; kill -0 \"$PID\" 2>/dev/null || emit_failure 257; " +
                "match_core \"$PID\" || emit_failure 258; I=$((I + 1)); done",
            "STATEV=$(awk '/^State:/ {print $2; exit}' \"/proc/$PID/status\" 2>/dev/null)",
            "[ -n \"$STATEV\" ] && [ \"$STATEV\" != Z ] || emit_failure 259",
            "[ -f \"$LOG\" ] && [ ! -L \"$LOG\" ] || emit_failure 260",
            "LM=$(stat -c %a \"$LOG\" 2>/dev/null || echo -1)",
            "LU=$(stat -c %u \"$LOG\" 2>/dev/null || echo -1)",
            "LG=$(stat -c %g \"$LOG\" 2>/dev/null || echo -1)",
            "LB=$(stat -c %s \"$LOG\" 2>/dev/null || echo -1)",
            "[ \"$LM\" = 600 ] && [ \"$LU\" = 0 ] && [ \"$LG\" = 0 ] || emit_failure 261",
            "[ \"$LB\" -ge 0 ] && [ \"$LB\" -le \"$MAXLOG\" ] || emit_failure 262",
            "FATAL=0",
            "grep -Eai 'panic|fatal|permission denied|address already in use|failed to start|invalid configuration' \"$LOG\" >/dev/null 2>&1 && FATAL=1 || true",
            "[ \"$FATAL\" = 0 ] || emit_failure 263",
            "CH=$(sha256sum \"$CFG\" 2>/dev/null | awk '{print $1}')",
            "[ \"$CH\" = \"$EXPECTED\" ] || emit_failure 264",
            "TUNA=0; [ -e /sys/class/net/sbh-tun0 ] && TUNA=1",
            "R4A=$(rule4_count); R6A=$(rule6_count)",
            "RT4A=$(route4_count); RT6A=$(route6_count)",
            "[ \"$TUNA\" = 0 ] && [ \"$R4A\" = 0 ] && [ \"$R6A\" = 0 ] && " +
                "[ \"$RT4A\" = 0 ] && [ \"$RT6A\" = 0 ] || emit_failure 265",
            "APTMP=\"$STATE/.core-probe-active.pid.$TOKEN.tmp\"",
            "AMTMP=\"$STATE/.core-probe-active.json.$TOKEN.tmp\"",
            "rm -f \"$APTMP\" \"$AMTMP\"",
            "printf '%s\\n' \"$PID\" > \"$APTMP\" || emit_failure 266",
            "chmod 600 \"$APTMP\" || emit_failure 267",
            "chown 0:0 \"$APTMP\" >/dev/null 2>&1 || true",
            "mv \"$APTMP\" \"$ACTIVE_PID\" || emit_failure 268",
            "PUBLISHED=1",
            "TS=$(date +%s 2>/dev/null || echo 0)",
            "printf '{\\n  \"schemaVersion\": 1,\\n  \"stage\": 50,\\n  \"authorizationId\": \"%s\",\\n  \"pid\": %s,\\n  \"configSha256\": \"%s\",\\n  \"configRelativePath\": \"config/runtime-tun.json\",\\n  \"logRelativePath\": \"logs/core-start-probe-%s.log\",\\n  \"startedAtSeconds\": %s,\\n  \"mode\": \"outbound_only_probe\"\\n}\\n' " +
                "\"$AUTH\" \"$PID\" \"$CH\" \"$TOKEN\" \"$TS\" > \"$AMTMP\" || emit_failure 269",
            "chmod 600 \"$AMTMP\" || emit_failure 270",
            "chown 0:0 \"$AMTMP\" >/dev/null 2>&1 || true",
            "mv \"$AMTMP\" \"$ACTIVE_META\" || emit_failure 271",
            "kill -0 \"$PID\" 2>/dev/null || emit_failure 272",
            "match_core \"$PID\" || emit_failure 273",
            "COUNT2=$(core_count)",
            "[ \"$COUNT2\" = 1 ] || emit_failure 274",
            "printf '__SBH_PID__=%s\\n' \"$PID\"",
            "printf '__SBH_UIDV__=%s\\n' \"$UIDV\"",
            "printf '__SBH_STATE__=%s\\n' \"$STATEV\"",
            "printf '__SBH_COUNT__=%s\\n' \"$COUNT2\"",
            "printf '__SBH_LOG_MODE__=%s\\n' \"$LM\"",
            "printf '__SBH_LOG_UID__=%s\\n' \"$LU\"",
            "printf '__SBH_LOG_GID__=%s\\n' \"$LG\"",
            "printf '__SBH_LOG_BYTES__=%s\\n' \"$LB\"",
            "printf '__SBH_FATAL__=%s\\n' \"$FATAL\"",
            "printf '__SBH_CH__=%s\\n' \"$CH\"",
            "printf '__SBH_TUN_AFTER__=%s\\n' \"$TUNA\"",
            "printf '__SBH_RULE4_AFTER__=%s\\n' \"$R4A\"",
            "printf '__SBH_RULE6_AFTER__=%s\\n' \"$R6A\"",
            "printf '__SBH_ROUTE4_AFTER__=%s\\n' \"$RT4A\"",
            "printf '__SBH_ROUTE6_AFTER__=%s\\n' \"$RT6A\"",
            "printf '__SBH_ACTIVE_PID_PUBLISHED__=1\\n'",
            "printf '__SBH_ACTIVE_META_PUBLISHED__=1\\n'",
            "printf '__SBH_ROLLBACK__=0\\n'",
            "printf '__SBH_RECONCILE_DONE__=1\\n'",
            "exit 0"
        ]);

        return lines.join("; ");
    }

    function startProbe() {
        var token = String(SBH.util.randomToken())
            .replace(/[^A-Za-z0-9]/g, "")
            .substring(0, 18);
        var pathSet = paths(token);
        var preflight = executeShell(
            buildPreflightCommand(pathSet),
            "preflight"
        );
        var preRaw = preflight.output;
        var preflightDone = yes(preRaw, "PREFLIGHT_DONE");
        var expectedHash = marker(preRaw, "CH");
        var dispatch;
        var dispatchRaw;
        var reconcile;
        var raw;
        var reconcileDone;
        var failureMarker;
        var rollbackInvoked;
        var rollbackStopped;
        var beforeTun;
        var afterTun;
        var beforeRule4;
        var afterRule4;
        var beforeRule6;
        var afterRule6;
        var beforeRoute4;
        var afterRoute4;
        var beforeRoute6;
        var afterRoute6;
        var resourceUnchanged;
        var ok;

        if (!preflightDone || expectedHash === null) {
            return {
                ok: false,
                stage:
                    "production_stage50_retry3_runtime_core_start_probe",
                errorCode: "CORE_START_PREFLIGHT_FAILED",
                errorDetailReturned: false,
                authorizationId: AUTHORIZATION_ID,
                authorizationConsumed: true,
                automaticRetryAllowed: false,
                manualOnly: true,
                preflightPassed: false,
                preflightShellCode: preflight.code,
                preflightCompletionMarkerObserved:
                    preflightDone,
                repairedStateDirectoryExpected: true,
                repairedStateDirectoryMode:
                    marker(preRaw, "SM"),
                repairedStateDirectoryUid:
                    numberValue(preRaw, "SU"),
                repairedStateDirectoryGid:
                    numberValue(preRaw, "SG"),
                coreStartInvoked: false,
                coreStopInvoked: false,
                tunCreated: false,
                routeModified: false,
                destructiveOperations: false,
                timestamp: now()
            };
        }

        dispatch = executeShell(
            buildDispatchCommand(pathSet),
            "dispatch"
        );
        dispatchRaw = dispatch.output;

        reconcile = executeShell(
            buildReconcileCommand(
                pathSet,
                token,
                expectedHash
            ),
            "reconcile"
        );
        raw = preRaw + "\n" + dispatchRaw +
            "\n" + reconcile.output;
        reconcileDone = yes(raw, "RECONCILE_DONE");
        failureMarker = yes(raw, "FAILURE_MARKER");
        rollbackInvoked = yes(raw, "ROLLBACK");
        rollbackStopped = yes(raw, "ROLLBACK_STOPPED");
        beforeTun = numberValue(raw, "TUN_BEFORE");
        afterTun = numberValue(raw, "TUN_AFTER");
        beforeRule4 = numberValue(raw, "RULE4_BEFORE");
        afterRule4 = numberValue(raw, "RULE4_AFTER");
        beforeRule6 = numberValue(raw, "RULE6_BEFORE");
        afterRule6 = numberValue(raw, "RULE6_AFTER");
        beforeRoute4 = numberValue(raw, "ROUTE4_BEFORE");
        afterRoute4 = numberValue(raw, "ROUTE4_AFTER");
        beforeRoute6 = numberValue(raw, "ROUTE6_BEFORE");
        afterRoute6 = numberValue(raw, "ROUTE6_AFTER");
        resourceUnchanged =
            beforeTun === 0 && afterTun === 0 &&
            beforeRule4 === 0 && afterRule4 === 0 &&
            beforeRule6 === 0 && afterRule6 === 0 &&
            beforeRoute4 === 0 && afterRoute4 === 0 &&
            beforeRoute6 === 0 && afterRoute6 === 0;
        ok =
            reconcileDone &&
            !failureMarker &&
            !rollbackInvoked &&
            numberValue(raw, "PID") !== null &&
            numberValue(raw, "UIDV") === 0 &&
            numberValue(raw, "COUNT") === 1 &&
            marker(raw, "STATE") !== "Z" &&
            marker(raw, "CH") === expectedHash &&
            marker(raw, "LOG_MODE") === "600" &&
            numberValue(raw, "LOG_UID") === 0 &&
            numberValue(raw, "LOG_GID") === 0 &&
            numberValue(raw, "FATAL") === 0 &&
            yes(raw, "ACTIVE_PID_PUBLISHED") &&
            yes(raw, "ACTIVE_META_PUBLISHED") &&
            resourceUnchanged;

        return {
            ok: ok,
            stage:
                "production_stage50_retry3_runtime_core_start_probe",
            authorizationId: AUTHORIZATION_ID,
            authorizationConsumed: true,
            automaticRetryAllowed: false,
            manualOnly: true,
            preflightPassed: preflightDone,
            stateDirectoryRepairVerified:
                marker(raw, "SM") === "700" &&
                numberValue(raw, "SU") === 0 &&
                numberValue(raw, "SG") === 0,
            stateDirectoryMode: marker(raw, "SM"),
            stateDirectoryUid: numberValue(raw, "SU"),
            stateDirectoryGid: numberValue(raw, "SG"),
            stage49ProductionConfigLineageVerified:
                marker(raw, "CH") === marker(raw, "SH") &&
                numberValue(raw, "CB") ===
                    numberValue(raw, "SB"),
            productionConfigSha256: expectedHash,
            productionConfigByteCount:
                numberValue(raw, "CB"),
            productionConfigMode:
                marker(raw, "CM"),
            productionConfigUid:
                numberValue(raw, "CU"),
            productionConfigGid:
                numberValue(raw, "CG"),
            productionConfigCheckPassed:
                numberValue(raw, "CHECK") === 0,
            outboundOnlyCandidateLineage:
                marker(raw, "CH") === marker(raw, "SH") &&
                numberValue(raw, "CB") ===
                    numberValue(raw, "SB"),
            existingMatchingCoreCountBefore:
                numberValue(raw, "EXISTING"),
            dispatchAttempted: true,
            dispatchCompletionMarkerObserved:
                yes(raw, "DISPATCH_DONE"),
            dispatchExitCode:
                numberValue(raw, "DISPATCH"),
            processPid:
                numberValue(raw, "PID"),
            processPidReturned:
                numberValue(raw, "PID") !== null,
            processAlive: ok,
            processIdentityValidated: ok,
            processOwnerUid:
                numberValue(raw, "UIDV"),
            processState:
                marker(raw, "STATE"),
            matchingCoreCountAfter:
                numberValue(raw, "COUNT"),
            stabilizationSeconds:
                STABILITY_SECONDS,
            stabilizationPassed: ok,
            coreLogRelativePath:
                "logs/core-start-probe-<run-token>.log",
            coreLogPathReturned: false,
            coreLogMode:
                marker(raw, "LOG_MODE"),
            coreLogUid:
                numberValue(raw, "LOG_UID"),
            coreLogGid:
                numberValue(raw, "LOG_GID"),
            coreLogByteCount:
                numberValue(raw, "LOG_BYTES"),
            fatalLogSignalDetected:
                numberValue(raw, "FATAL") === 1,
            activePidPublished:
                yes(raw, "ACTIVE_PID_PUBLISHED"),
            activeMetadataPublished:
                yes(raw, "ACTIVE_META_PUBLISHED"),
            activePidRelativePath:
                "state/core-probe-active.pid",
            activeMetadataRelativePath:
                "state/core-probe-active.json",
            tunInterfacePresentBefore:
                beforeTun === 1,
            tunInterfacePresentAfter:
                afterTun === 1,
            tunCreated:
                beforeTun === 0 && afterTun === 1,
            reservedIpv4RuleCountBefore:
                beforeRule4,
            reservedIpv4RuleCountAfter:
                afterRule4,
            reservedIpv6RuleCountBefore:
                beforeRule6,
            reservedIpv6RuleCountAfter:
                afterRule6,
            reservedIpv4RouteCountBefore:
                beforeRoute4,
            reservedIpv4RouteCountAfter:
                afterRoute4,
            reservedIpv6RouteCountBefore:
                beforeRoute6,
            reservedIpv6RouteCountAfter:
                afterRoute6,
            routeModified: resourceUnchanged === false,
            reservedNetworkResourcesUnchanged:
                resourceUnchanged,
            networkTrafficGeneratedByProbe: false,
            networkConnectivityTestInvoked: false,
            rollbackInvoked: rollbackInvoked,
            rollbackStoppedExactProcess:
                rollbackStopped,
            rollbackTermSignalSent:
                yes(raw, "TERM_SENT"),
            rollbackKillSignalSent:
                yes(raw, "KILL_SENT"),
            coreStartInvoked: true,
            coreStopInvoked: rollbackInvoked,
            coreRemainsRunning: ok,
            preflightShellCode: preflight.code,
            dispatchShellCode: dispatch.code,
            reconcileShellCode: reconcile.code,
            shellCodeAuthoritative: false,
            shellTransportCodeAnomalous:
                (
                    preflightDone && preflight.code !== 0
                ) || (
                    yes(raw, "DISPATCH_DONE") &&
                    dispatch.code !== 0
                ) || (
                    reconcileDone && reconcile.code !== 0
                ),
            destructiveOperations: false,
            readyForCoreStatusAndExactStopControl:
                ok,
            nextAuthorizedOperation:
                ok ?
                    "runtime_core_status_and_exact_stop_control" :
                    (
                        rollbackStopped ?
                            "review_core_start_failure_after_exact_rollback" :
                            "resolve_core_start_probe_gate"
                    ),
            timestamp: now()
        };
    }

    function startProbeAsync(callback) {
        if (typeof callback !== "function") {
            throw new Error("Stage50 Retry3 callback unavailable");
        }
        if (busy) {
            callback({
                ok: false,
                stage:
                    "production_stage50_retry3_runtime_core_start_probe",
                errorCode: "STAGE50_RETRY3_ALREADY_RUNNING",
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
                        output = startProbe();
                    } catch (ignored) {
                        output = {
                            ok: false,
                            stage:
                                "production_stage50_retry3_runtime_core_start_probe",
                            errorCode:
                                "CONSTRAINED_CORE_START_PROBE_FAILED",
                            errorDetailReturned: false,
                            authorizationId:
                                AUTHORIZATION_ID,
                            authorizationConsumed: true,
                            automaticRetryAllowed: false,
                            manualOnly: true,
                            coreStartStateUnknown: true,
                            exactReconciliationRequired: true,
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
            "SingBoxHub-Stage50Retry3CoreStartProbe"
        ).start();

        return {
            accepted: true,
            busy: false
        };
    }

    function buildCard() {
        var card = W.card(17);
        var title = W.text(
            "Stage 50 Retry 3：受限 Core 启动探测",
            17,
            C.navy,
            true
        );
        var note = W.text(
            "先复核已修复的 Runtime/state 为 0700、root 所有，再校验 Stage 49 生产配置与 staging 的哈希链，确认没有已有 Core、" +
            "sbh-tun0 或预留路由资源，再以双 setsid 启动 sing-box。" +
            "稳定验证通过后保留本次精确 PID；失败时只停止本次启动且身份匹配的进程。" +
            "本阶段不创建 TUN、不写路由、不执行连通性测试。",
            11.4,
            C.secondary,
            false
        );
        var resultText = W.text(
            JSON.stringify({
                ready: true,
                authorizationId:
                    AUTHORIZATION_ID,
                manualOnly: true,
                automaticRetryAllowed: false,
                stateDirectoryRepairRequired: true,
                stateDirectoryExpectedMode: "700",
                stateDirectoryExpectedUid: 0,
                stateDirectoryExpectedGid: 0,
                constrainedCoreStartEnabled: true,
                exactFailureRollbackEnabled: true,
                tunEnabled: false,
                routeWriteEnabled: false,
                connectivityTestEnabled: false
            }, null, 2),
            10.3,
            C.secondary,
            false
        );
        var button = W.button(
            "重新受限启动并验证 Core",
            "shield",
            C.orange,
            C.orangeSoft,
            function () {
                resultText.setText(
                    "正在执行配置门禁、受限启动和稳定性验证。"
                );
                SBH.util.toast(
                    "正在受限启动 sing-box Core"
                );
                startProbeAsync(function (result) {
                    resultText.setText(
                        JSON.stringify(result, null, 2)
                    );
                    SBH.util.toast(
                        result.ok === true ?
                            "Core 启动验证通过，保持受控运行" :
                            (
                                result.rollbackStoppedExactProcess === true ?
                                    "启动未通过，已精确停止本次进程" :
                                    "Core 启动探测存在待处理项"
                            )
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
        throw new Error("Stage50 Retry3 dependencies unavailable");
    }

    SBH.runtimeCoreStartProbeRetry3 = {
        version: 1,
        startProbeAsync: startProbeAsync,
        authorizationId: AUTHORIZATION_ID,
        manualOnly: true,
        automaticRetryAllowed: false,
        constrainedCoreStartEnabled: true,
        exactFailureRollbackEnabled: true,
        tunEnabled: false,
        routeWriteEnabled: false,
        connectivityTestEnabled: false
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

        output.runtimeCoreStartProbeRetry3Version = 1;
        output.runtimeCoreStartProbeRetry3Ready = true;
        output.runtimeCoreStartProbeRetry3AuthorizationId =
            AUTHORIZATION_ID;
        output.runtimeCoreStartProbeRetry3Authorized = true;
        output.runtimeCoreStartProbeRetry3ManualOnly = true;
        output.runtimeCoreStartProbeRetry3AutomaticRetry = false;
        output.runtimeCoreStartRetryAfterStateRepair = true;
        output.runtimeCoreStartStateDirectoryModeExpected = "700";
        output.runtimeCoreStartStateDirectoryOwnerExpected = "0:0";
        output.runtimeCoreStartEnabled = true;
        output.runtimeCoreStartExactRollbackEnabled = true;
        output.runtimeCoreStartTunEnabled = false;
        output.runtimeCoreStartRouteWriteEnabled = false;
        output.runtimeCoreStartConnectivityTestEnabled = false;
        output.writeOperationsLocked = false;
        output.destructiveOperations = false;
        return output;
    };
}());
