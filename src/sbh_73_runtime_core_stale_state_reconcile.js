/* SingBoxHub Stage51 Retry1 stale Core state reconciliation. Rhino ES5 only. */
SBH.versions.runtimeCoreStaleStateReconcile = 1;

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
        "stage51-retry1-stale-core-state-reconcile-user-authorized-20260804";
    var SOURCE_AUTHORIZATION_ID =
        "stage50-retry3-runtime-core-start-probe-user-authorized-20260804";
    var CHECK_TIMEOUT_SECONDS = 30;
    var MAX_LOG_BYTES = 1024 * 1024;

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

    function executeShell(command) {
        var action = ShellCommand.newBuilder()
            .setCommand(String(command))
            .setSingleShot(true)
            .setId(
                "SingBoxHub#Stage51Retry1#staleReconcile#" +
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

    function buildCommand() {
        var root = runtimeRoot();
        var token = String(SBH.util.randomToken())
            .replace(/[^A-Za-z0-9]/g, "")
            .substring(0, 20);
        var lines = [
            "umask 077",
            "ROOT=" + quote(root),
            "D=" + quote(root + "/config"),
            "CFG=" + quote(root + "/config/runtime-tun.json"),
            "BIN=" + quote(root + "/bin/sing-box"),
            "STATE=" + quote(root + "/state"),
            "PROBE=" + quote(root + "/state/core-probes"),
            "LOGS=" + quote(root + "/logs"),
            "ACTIVE_PID=" + quote(root + "/state/core-probe-active.pid"),
            "ACTIVE_META=" + quote(root + "/state/core-probe-active.json"),
            "AUDIT=" + quote(root + "/state/core-probe-last-reconcile.json"),
            "ENDPOINT=" + quote(root + "/cache/control_endpoint.json"),
            "TOKEN=" + quote(token),
            "GATE=none",
            "CODE=0",
            "REMOVED=0",
            "AUDIT_CREATED=0",
            "finish(){ " +
                "printf '__SBH_GATE__=%s\\n' \"$GATE\"; " +
                "printf '__SBH_CODE__=%s\\n' \"$CODE\"; " +
                "printf '__SBH_REMOVED__=%s\\n' \"$REMOVED\"; " +
                "printf '__SBH_AUDIT_CREATED__=%s\\n' \"$AUDIT_CREATED\"; " +
                "printf '__SBH_DONE__=1\\n'; exit 0; }",
            "fail(){ GATE=\"$1\"; CODE=\"$2\"; finish; }",
            "rule4_count(){ ip -4 rule show 2>/dev/null | awk '" +
                "$1 ~ /^[0-9]+:$/ {p=$1; sub(/:$/,\"\",p); " +
                "if (p>=8800 && p<=8815) c++} END{print c+0}'; }",
            "rule6_count(){ ip -6 rule show 2>/dev/null | awk '" +
                "$1 ~ /^[0-9]+:$/ {p=$1; sub(/:$/,\"\",p); " +
                "if (p>=8800 && p<=8815) c++} END{print c+0}'; }",
            "route4_count(){ ip -4 route show table 20240 2>/dev/null | " +
                "awk 'NF{c++} END{print c+0}'; }",
            "route6_count(){ ip -6 route show table 20240 2>/dev/null | " +
                "awk 'NF{c++} END{print c+0}'; }",
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
            "check_config(){ " +
                "if command -v timeout >/dev/null 2>&1; then " +
                    "timeout " + String(CHECK_TIMEOUT_SECONDS) +
                    "s \"$BIN\" check -c \"$CFG\" >/dev/null 2>&1; " +
                "else \"$BIN\" check -c \"$CFG\" >/dev/null 2>&1; fi; }",
            "meta_number(){ sed -n \"s/^[[:space:]]*\\\"$1\\\":[[:space:]]*\\([0-9][0-9]*\\),*[[:space:]]*$/\\1/p\" \"$ACTIVE_META\" | sed -n '1p'; }",
            "meta_string(){ sed -n \"s/^[[:space:]]*\\\"$1\\\":[[:space:]]*\\\"\\([^\\\"]*\\)\\\",*[[:space:]]*$/\\1/p\" \"$ACTIVE_META\" | sed -n '1p'; }",

            "[ \"$(id -u 2>/dev/null)\" = 0 ] || fail root_uid 501",
            "[ -d \"$ROOT\" ] && [ ! -L \"$ROOT\" ] || fail runtime_root 502",
            "[ -d \"$D\" ] && [ ! -L \"$D\" ] || fail config_directory 503",
            "[ -d \"$STATE\" ] && [ ! -L \"$STATE\" ] || fail state_directory 504",
            "[ -d \"$PROBE\" ] && [ ! -L \"$PROBE\" ] || fail probe_directory 505",
            "[ -d \"$LOGS\" ] && [ ! -L \"$LOGS\" ] || fail logs_directory 506",
            "SM=$(stat -c %a \"$STATE\" 2>/dev/null || echo -1)",
            "SU=$(stat -c %u \"$STATE\" 2>/dev/null || echo -1)",
            "SG=$(stat -c %g \"$STATE\" 2>/dev/null || echo -1)",
            "[ \"$SM\" = 700 ] && [ \"$SU\" = 0 ] && [ \"$SG\" = 0 ] || fail state_directory_metadata 507",
            "[ -f \"$CFG\" ] && [ ! -L \"$CFG\" ] || fail production_config 508",
            "[ -f \"$BIN\" ] && [ -x \"$BIN\" ] && [ ! -L \"$BIN\" ] || fail singbox_binary 509",
            "CM=$(stat -c %a \"$CFG\" 2>/dev/null || echo -1)",
            "CU=$(stat -c %u \"$CFG\" 2>/dev/null || echo -1)",
            "CG=$(stat -c %g \"$CFG\" 2>/dev/null || echo -1)",
            "[ \"$CM\" = 600 ] && [ \"$CU\" = 0 ] && [ \"$CG\" = 0 ] || fail production_config_metadata 510",

            "SC=0; STAGE=''",
            "for F in \"$D\"/.runtime-tun.json.stage-*; do " +
                "[ -e \"$F\" ] || continue; SC=$((SC + 1)); STAGE=\"$F\"; done",
            "[ \"$SC\" = 1 ] || fail staging_count 511",
            "[ -f \"$STAGE\" ] && [ ! -L \"$STAGE\" ] || fail staging_file_type 512",
            "CH=$(sha256sum \"$CFG\" 2>/dev/null | awk '{print $1}')",
            "CB=$(stat -c %s \"$CFG\" 2>/dev/null || echo -1)",
            "SH=$(sha256sum \"$STAGE\" 2>/dev/null | awk '{print $1}')",
            "SB=$(stat -c %s \"$STAGE\" 2>/dev/null || echo -1)",
            "[ -n \"$CH\" ] && [ \"$CH\" = \"$SH\" ] && [ \"$CB\" = \"$SB\" ] || fail production_staging_lineage 513",
            "check_config; CHECK=$?",
            "[ \"$CHECK\" = 0 ] || fail production_config_check 514",

            "[ -f \"$ACTIVE_PID\" ] && [ ! -L \"$ACTIVE_PID\" ] || fail active_pid_file 515",
            "[ -f \"$ACTIVE_META\" ] && [ ! -L \"$ACTIVE_META\" ] || fail active_metadata_file 516",
            "APM=$(stat -c %a \"$ACTIVE_PID\" 2>/dev/null || echo -1)",
            "APU=$(stat -c %u \"$ACTIVE_PID\" 2>/dev/null || echo -1)",
            "APG=$(stat -c %g \"$ACTIVE_PID\" 2>/dev/null || echo -1)",
            "AMM=$(stat -c %a \"$ACTIVE_META\" 2>/dev/null || echo -1)",
            "AMU=$(stat -c %u \"$ACTIVE_META\" 2>/dev/null || echo -1)",
            "AMG=$(stat -c %g \"$ACTIVE_META\" 2>/dev/null || echo -1)",
            "[ \"$APM\" = 600 ] && [ \"$APU\" = 0 ] && [ \"$APG\" = 0 ] || fail active_pid_metadata 517",
            "[ \"$AMM\" = 600 ] && [ \"$AMU\" = 0 ] && [ \"$AMG\" = 0 ] || fail active_metadata_metadata 518",
            "PID=$(cat \"$ACTIVE_PID\" 2>/dev/null)",
            "case \"$PID\" in ''|*[!0-9]*) fail active_pid_value 519;; esac",

            "META_SCHEMA=$(meta_number schemaVersion)",
            "META_STAGE=$(meta_number stage)",
            "META_PID=$(meta_number pid)",
            "META_STARTED=$(meta_number startedAtSeconds)",
            "META_AUTH=$(meta_string authorizationId)",
            "META_HASH=$(meta_string configSha256)",
            "META_CONFIG=$(meta_string configRelativePath)",
            "META_LOG=$(meta_string logRelativePath)",
            "META_MODE=$(meta_string mode)",
            "[ \"$META_SCHEMA\" = 1 ] && [ \"$META_STAGE\" = 50 ] || fail active_metadata_schema 520",
            "[ \"$META_PID\" = \"$PID\" ] || fail active_metadata_pid_mismatch 521",
            "[ \"$META_AUTH\" = " + quote(SOURCE_AUTHORIZATION_ID) + " ] || fail active_metadata_authorization 522",
            "[ \"$META_HASH\" = \"$CH\" ] || fail active_metadata_config_hash 523",
            "[ \"$META_CONFIG\" = config/runtime-tun.json ] || fail active_metadata_config_path 524",
            "[ \"$META_MODE\" = outbound_only_probe ] || fail active_metadata_mode 525",
            "case \"$META_LOG\" in logs/core-start-probe-*.log) ;; *) fail active_metadata_log_path 526;; esac",
            "LOG=\"$ROOT/$META_LOG\"",
            "[ -f \"$LOG\" ] && [ ! -L \"$LOG\" ] || fail core_log_file 527",
            "LM=$(stat -c %a \"$LOG\" 2>/dev/null || echo -1)",
            "LU=$(stat -c %u \"$LOG\" 2>/dev/null || echo -1)",
            "LG=$(stat -c %g \"$LOG\" 2>/dev/null || echo -1)",
            "LB=$(stat -c %s \"$LOG\" 2>/dev/null || echo -1)",
            "[ \"$LM\" = 600 ] && [ \"$LU\" = 0 ] && [ \"$LG\" = 0 ] || fail core_log_metadata 528",
            "[ \"$LB\" -ge 0 ] && [ \"$LB\" -le " + String(MAX_LOG_BYTES) + " ] || fail core_log_size 529",

            "ALIVE=0; kill -0 \"$PID\" 2>/dev/null && ALIVE=1",
            "IDENTITY=0; if [ \"$ALIVE\" = 1 ] && match_core \"$PID\"; then IDENTITY=1; fi",
            "COUNT=$(core_count)",
            "[ \"$ALIVE\" = 0 ] || fail recorded_pid_still_alive 530",
            "[ \"$COUNT\" = 0 ] || fail matching_core_still_present 531",

            "TUN=0; [ -e /sys/class/net/sbh-tun0 ] && TUN=1",
            "R4=$(rule4_count); R6=$(rule6_count)",
            "RT4=$(route4_count); RT6=$(route6_count)",
            "[ \"$TUN\" = 0 ] && [ \"$R4\" = 0 ] && [ \"$R6\" = 0 ] && " +
                "[ \"$RT4\" = 0 ] && [ \"$RT6\" = 0 ] || fail reserved_network_resources 532",

            "TXN_TOTAL=0; TXN_MATCH=0; TXN=''",
            "for F in \"$PROBE\"/core-start-*.pid; do " +
                "[ -e \"$F\" ] || continue; " +
                "[ -f \"$F\" ] && [ ! -L \"$F\" ] || fail transaction_pid_file_type 533; " +
                "TXN_TOTAL=$((TXN_TOTAL + 1)); V=$(cat \"$F\" 2>/dev/null); " +
                "if [ \"$V\" = \"$PID\" ]; then TXN_MATCH=$((TXN_MATCH + 1)); TXN=\"$F\"; fi; done",
            "[ \"$TXN_TOTAL\" = 1 ] && [ \"$TXN_MATCH\" = 1 ] || fail transaction_pid_record_set 534",

            "FATAL=0; grep -Eai 'panic|fatal|permission denied|address already in use|failed to start|invalid configuration' \"$LOG\" >/dev/null 2>&1 && FATAL=1 || true",

            "CONTROL_ENDPOINT_EXISTS=0; CONTROL_PID=0; CONTROL_ALIVE=0",
            "if [ -f \"$ENDPOINT\" ] && [ ! -L \"$ENDPOINT\" ]; then " +
                "CONTROL_ENDPOINT_EXISTS=1; " +
                "CONTROL_PID=$(sed -n 's/^[[:space:]]*\"runtimePid\":[[:space:]]*\\([0-9][0-9]*\\),*[[:space:]]*$/\\1/p' \"$ENDPOINT\" | sed -n '1p'); " +
                "case \"$CONTROL_PID\" in ''|*[!0-9]*) CONTROL_PID=0;; esac; " +
                "if [ \"$CONTROL_PID\" -gt 0 ] && kill -0 \"$CONTROL_PID\" 2>/dev/null; then CONTROL_ALIVE=1; fi; fi",

            "TMP=\"$STATE/.core-probe-reconcile-$TOKEN.tmp\"",
            "rm -f \"$TMP\"",
            "TS=$(date +%s 2>/dev/null || echo 0)",
            "printf '{\\n  \"schemaVersion\": 1,\\n  \"stage\": 51,\\n  \"authorizationId\": \"%s\",\\n  \"sourceAuthorizationId\": \"%s\",\\n  \"pid\": %s,\\n  \"processAliveAtReconcile\": false,\\n  \"matchingCoreCount\": 0,\\n  \"configSha256\": \"%s\",\\n  \"logRelativePath\": \"%s\",\\n  \"fatalLogSignalDetected\": %s,\\n  \"controlServicePid\": %s,\\n  \"controlServiceAlive\": %s,\\n  \"reconciledAtSeconds\": %s\\n}\\n' " +
                quote(AUTHORIZATION_ID) + " " + quote(SOURCE_AUTHORIZATION_ID) +
                " \"$PID\" \"$CH\" \"$META_LOG\" " +
                "\"$FATAL\" \"$CONTROL_PID\" \"$CONTROL_ALIVE\" \"$TS\" > \"$TMP\" || fail reconcile_audit_write 535",
            "chmod 600 \"$TMP\" 2>/dev/null || fail reconcile_audit_chmod 536",
            "chown 0:0 \"$TMP\" >/dev/null 2>&1 || true",
            "sync \"$TMP\" >/dev/null 2>&1 || sync >/dev/null 2>&1 || true",

            "rm -f \"$ACTIVE_PID\" || fail remove_active_pid 537",
            "rm -f \"$ACTIVE_META\" || fail remove_active_metadata 538",
            "rm -f \"$TXN\" || fail remove_transaction_pid 539",
            "[ ! -e \"$ACTIVE_PID\" ] && [ ! -L \"$ACTIVE_PID\" ] || fail verify_active_pid_removed 540",
            "[ ! -e \"$ACTIVE_META\" ] && [ ! -L \"$ACTIVE_META\" ] || fail verify_active_metadata_removed 541",
            "[ ! -e \"$TXN\" ] && [ ! -L \"$TXN\" ] || fail verify_transaction_pid_removed 542",
            "REMOVED=1",
            "mv -f \"$TMP\" \"$AUDIT\" || fail reconcile_audit_publish 543",
            "AUDIT_CREATED=1",

            "COUNT_AFTER=$(core_count)",
            "TUN_AFTER=0; [ -e /sys/class/net/sbh-tun0 ] && TUN_AFTER=1",
            "R4_AFTER=$(rule4_count); R6_AFTER=$(rule6_count)",
            "RT4_AFTER=$(route4_count); RT6_AFTER=$(route6_count)",
            "[ \"$COUNT_AFTER\" = 0 ] || fail core_count_changed 544",
            "[ \"$TUN_AFTER\" = 0 ] && [ \"$R4_AFTER\" = 0 ] && [ \"$R6_AFTER\" = 0 ] && " +
                "[ \"$RT4_AFTER\" = 0 ] && [ \"$RT6_AFTER\" = 0 ] || fail network_resources_changed 545",

            "printf '__SBH_PID__=%s\\n' \"$PID\"",
            "printf '__SBH_META_STARTED__=%s\\n' \"$META_STARTED\"",
            "printf '__SBH_CONFIG_HASH__=%s\\n' \"$CH\"",
            "printf '__SBH_CONFIG_BYTES__=%s\\n' \"$CB\"",
            "printf '__SBH_CONFIG_CHECK__=%s\\n' \"$CHECK\"",
            "printf '__SBH_LOG_BYTES__=%s\\n' \"$LB\"",
            "printf '__SBH_FATAL__=%s\\n' \"$FATAL\"",
            "printf '__SBH_PROCESS_ALIVE__=%s\\n' \"$ALIVE\"",
            "printf '__SBH_PROCESS_IDENTITY__=%s\\n' \"$IDENTITY\"",
            "printf '__SBH_CORE_COUNT_BEFORE__=%s\\n' \"$COUNT\"",
            "printf '__SBH_CORE_COUNT_AFTER__=%s\\n' \"$COUNT_AFTER\"",
            "printf '__SBH_TUN_BEFORE__=%s\\n' \"$TUN\"",
            "printf '__SBH_TUN_AFTER__=%s\\n' \"$TUN_AFTER\"",
            "printf '__SBH_RULE4_BEFORE__=%s\\n' \"$R4\"",
            "printf '__SBH_RULE4_AFTER__=%s\\n' \"$R4_AFTER\"",
            "printf '__SBH_RULE6_BEFORE__=%s\\n' \"$R6\"",
            "printf '__SBH_RULE6_AFTER__=%s\\n' \"$R6_AFTER\"",
            "printf '__SBH_ROUTE4_BEFORE__=%s\\n' \"$RT4\"",
            "printf '__SBH_ROUTE4_AFTER__=%s\\n' \"$RT4_AFTER\"",
            "printf '__SBH_ROUTE6_BEFORE__=%s\\n' \"$RT6\"",
            "printf '__SBH_ROUTE6_AFTER__=%s\\n' \"$RT6_AFTER\"",
            "printf '__SBH_TXN_TOTAL__=%s\\n' \"$TXN_TOTAL\"",
            "printf '__SBH_TXN_MATCH__=%s\\n' \"$TXN_MATCH\"",
            "printf '__SBH_CONTROL_ENDPOINT_EXISTS__=%s\\n' \"$CONTROL_ENDPOINT_EXISTS\"",
            "printf '__SBH_CONTROL_PID__=%s\\n' \"$CONTROL_PID\"",
            "printf '__SBH_CONTROL_ALIVE__=%s\\n' \"$CONTROL_ALIVE\"",
            "printf '__SBH_RECONCILE_OK__=1\\n'",
            "finish"
        ];
        return lines.join("; ");
    }

    function reconcile() {
        var shellResult = executeShell(buildCommand());
        var raw = shellResult.output;
        var done = yes(raw, "DONE");
        var success =
            done &&
            yes(raw, "RECONCILE_OK") &&
            yes(raw, "REMOVED") &&
            yes(raw, "AUDIT_CREATED") &&
            numberValue(raw, "PROCESS_ALIVE") === 0 &&
            numberValue(raw, "CORE_COUNT_AFTER") === 0 &&
            numberValue(raw, "TUN_AFTER") === 0 &&
            numberValue(raw, "RULE4_AFTER") === 0 &&
            numberValue(raw, "RULE6_AFTER") === 0 &&
            numberValue(raw, "ROUTE4_AFTER") === 0 &&
            numberValue(raw, "ROUTE6_AFTER") === 0;

        return {
            ok: success,
            stage:
                "production_stage51_retry1_stale_core_state_reconciliation",
            authorizationId: AUTHORIZATION_ID,
            authorizationConsumed: true,
            manualOnly: true,
            automaticRetryAllowed: false,
            completionMarkerObserved: done,
            blockingGate:
                success ? null : marker(raw, "GATE"),
            reconcileCode: numberValue(raw, "CODE"),
            staleProcessPid: numberValue(raw, "PID"),
            staleProcessAlive: yes(raw, "PROCESS_ALIVE"),
            staleProcessIdentityMatched:
                yes(raw, "PROCESS_IDENTITY"),
            activeMetadataStartedAtSeconds:
                numberValue(raw, "META_STARTED"),
            productionConfigSha256:
                marker(raw, "CONFIG_HASH"),
            productionConfigByteCount:
                numberValue(raw, "CONFIG_BYTES"),
            productionConfigCheckExitCode:
                numberValue(raw, "CONFIG_CHECK"),
            coreLogByteCount:
                numberValue(raw, "LOG_BYTES"),
            fatalLogSignalDetected:
                yes(raw, "FATAL"),
            matchingCoreCountBefore:
                numberValue(raw, "CORE_COUNT_BEFORE"),
            matchingCoreCountAfter:
                numberValue(raw, "CORE_COUNT_AFTER"),
            transactionPidRecordCount:
                numberValue(raw, "TXN_TOTAL"),
            staleActiveRecordsRemoved:
                yes(raw, "REMOVED"),
            reconcileAuditCreated:
                yes(raw, "AUDIT_CREATED"),
            reconcileAuditRelativePath:
                "state/core-probe-last-reconcile.json",
            tunInterfaceBefore:
                yes(raw, "TUN_BEFORE"),
            tunInterfaceAfter:
                yes(raw, "TUN_AFTER"),
            reservedIpv4RuleCountBefore:
                numberValue(raw, "RULE4_BEFORE"),
            reservedIpv4RuleCountAfter:
                numberValue(raw, "RULE4_AFTER"),
            reservedIpv6RuleCountBefore:
                numberValue(raw, "RULE6_BEFORE"),
            reservedIpv6RuleCountAfter:
                numberValue(raw, "RULE6_AFTER"),
            reservedIpv4RouteCountBefore:
                numberValue(raw, "ROUTE4_BEFORE"),
            reservedIpv4RouteCountAfter:
                numberValue(raw, "ROUTE4_AFTER"),
            reservedIpv6RouteCountBefore:
                numberValue(raw, "ROUTE6_BEFORE"),
            reservedIpv6RouteCountAfter:
                numberValue(raw, "ROUTE6_AFTER"),
            controlEndpointExists:
                yes(raw, "CONTROL_ENDPOINT_EXISTS"),
            controlServicePid:
                numberValue(raw, "CONTROL_PID"),
            controlServiceAlive:
                yes(raw, "CONTROL_ALIVE"),
            controlServiceRecoveryRequired:
                !yes(raw, "CONTROL_ALIVE"),
            coreStartInvoked: false,
            coreStopInvoked: false,
            processSignalSent: false,
            configModified: false,
            stagingModified: false,
            coreLogModified: false,
            tunCreated: false,
            routeModified: false,
            networkAccessed: false,
            destructiveOperations: false,
            readyForControlServiceRecovery:
                success && !yes(raw, "CONTROL_ALIVE"),
            readyForProductionLifecycleIntegration:
                success && yes(raw, "CONTROL_ALIVE"),
            nextAuthorizedOperation:
                success ?
                    (
                        yes(raw, "CONTROL_ALIVE") ?
                            "runtime_core_lifecycle_control_integration" :
                            "runtime_control_service_recovery_before_lifecycle_integration"
                    ) :
                    "resolve_stale_core_state_reconciliation_failure",
            shellCode: shellResult.code,
            shellCodeAuthoritative: false,
            shellTransportCodeAnomalous:
                done && shellResult.code !== 0,
            timestamp: now()
        };
    }

    function reconcileAsync(callback) {
        if (typeof callback !== "function") {
            throw new Error(
                "Stage51 Retry1 callback unavailable"
            );
        }
        if (busy) {
            callback({
                ok: false,
                stage:
                    "production_stage51_retry1_stale_core_state_reconciliation",
                errorCode:
                    "STALE_CORE_RECONCILIATION_ALREADY_RUNNING",
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
                        output = reconcile();
                    } catch (ignored) {
                        output = {
                            ok: false,
                            stage:
                                "production_stage51_retry1_stale_core_state_reconciliation",
                            errorCode:
                                "STALE_CORE_RECONCILIATION_FAILED",
                            errorDetailReturned: false,
                            authorizationId:
                                AUTHORIZATION_ID,
                            authorizationConsumed: true,
                            coreStartInvoked: false,
                            coreStopInvoked: false,
                            processSignalSent: false,
                            configModified: false,
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
            "SingBoxHub-Stage51Retry1Reconcile"
        ).start();

        return {
            accepted: true,
            busy: false
        };
    }

    function buildCard() {
        var card = W.card(17);
        var title = W.text(
            "Stage 51 Retry 1：失效 Core 状态核对",
            17,
            C.navy,
            true
        );
        var note = W.text(
            "Stage 51 已确认活动记录中的 PID 不再存活。" +
            "本操作会再次验证配置血缘、日志、PID 元数据、事务记录及预留网络资源，" +
            "确认没有任何匹配 Core 后，仅删除失效的活动 PID、活动元数据和对应事务 PID，" +
            "并写入核对审计。不会发送进程信号，也不会修改配置、日志、TUN 或路由。",
            11.4,
            C.secondary,
            false
        );
        var resultText = W.text(
            JSON.stringify({
                ready: true,
                authorizationId: AUTHORIZATION_ID,
                identifiedGate: "core_process_not_alive",
                expectedDiagnosticCode: 430,
                processSignalEnabled: false,
                staleRecordReconciliationEnabled: true,
                automaticRetryAllowed: false
            }, null, 2),
            10.3,
            C.secondary,
            false
        );
        var button = W.button(
            "核对并清理失效 Core 记录",
            "shield",
            C.orange,
            C.orangeSoft,
            function () {
                resultText.setText(
                    "正在核验失效 PID、活动元数据、事务记录和网络资源。"
                );
                SBH.util.toast(
                    "正在核对失效 Core 状态"
                );
                reconcileAsync(function (result) {
                    resultText.setText(
                        JSON.stringify(result, null, 2)
                    );
                    SBH.util.toast(
                        result.ok === true ?
                            "失效 Core 状态已完成核对" :
                            "失效 Core 状态仍有待处理项"
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
            "Stage51 Retry1 dependencies unavailable"
        );
    }

    SBH.runtimeCoreStaleStateReconcile = {
        version: 1,
        reconcileAsync: reconcileAsync,
        authorizationId: AUTHORIZATION_ID,
        sourceAuthorizationId:
            SOURCE_AUTHORIZATION_ID,
        manualOnly: true,
        automaticRetryAllowed: false,
        processSignalEnabled: false,
        staleRecordReconciliationEnabled: true
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
        output.runtimeCoreStaleStateReconcileVersion = 1;
        output.runtimeCoreStaleStateReconcileReady = true;
        output.runtimeCoreStaleStateReconcileAuthorizationId =
            AUTHORIZATION_ID;
        output.runtimeCoreStaleStateReconcileManualOnly = true;
        output.runtimeCoreStaleStateReconcileAutomaticRetry =
            false;
        output.runtimeCoreStaleStateReconcileProcessSignalEnabled =
            false;
        output.runtimeCoreStaleStateReconcileTunEnabled = false;
        output.runtimeCoreStaleStateReconcileRouteWriteEnabled =
            false;
        output.writeOperationsLocked = false;
        output.destructiveOperations = false;
        return output;
    };
}());
