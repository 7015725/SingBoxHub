/* SingBoxHub Stage50 Retry1 read-only preflight diagnostic. Rhino ES5 only. */
SBH.versions.runtimeCoreStartPreflightDiagnostic = 1;

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

    var DIAGNOSTIC_ID =
        "stage50-retry1-readonly-preflight-diagnostic-20260804";
    var CHECK_TIMEOUT_SECONDS = 30;

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

    function executeShell(command) {
        var action = ShellCommand.newBuilder()
            .setCommand(String(command))
            .setSingleShot(true)
            .setId(
                "SingBoxHub#Stage50Retry1#diagnostic#" +
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

    function buildCommand() {
        var root = runtimeRoot();
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
            "BLOCK=none",
            "BLOCK_CODE=0",
            "block(){ if [ \"$BLOCK\" = none ]; then BLOCK=\"$1\"; BLOCK_CODE=\"$2\"; fi; }"
        ];

        lines = lines.concat(resourceCountFunctions());
        lines = lines.concat(identityFunctions());
        lines.push(checkFunction());
        lines = lines.concat([
            "UIDV=$(id -u 2>/dev/null)",
            "printf '__SBH_UID__=%s\\n' \"$UIDV\"",
            "[ \"$UIDV\" = 0 ] || block root_uid 211",

            "ROOT_OK=0; [ -d \"$ROOT\" ] && [ ! -L \"$ROOT\" ] && ROOT_OK=1",
            "printf '__SBH_ROOT_OK__=%s\\n' \"$ROOT_OK\"",
            "[ \"$ROOT_OK\" = 1 ] || block runtime_root 212",

            "CONFIG_DIR_OK=0; [ -d \"$D\" ] && [ ! -L \"$D\" ] && CONFIG_DIR_OK=1",
            "printf '__SBH_CONFIG_DIR_OK__=%s\\n' \"$CONFIG_DIR_OK\"",
            "[ \"$CONFIG_DIR_OK\" = 1 ] || block config_directory 213",

            "STATE_OK=0; [ -d \"$STATE\" ] && [ ! -L \"$STATE\" ] && STATE_OK=1",
            "printf '__SBH_STATE_DIR_OK__=%s\\n' \"$STATE_OK\"",
            "[ \"$STATE_OK\" = 1 ] || block state_directory 214",

            "LOGS_OK=0; [ -d \"$LOGS\" ] && [ ! -L \"$LOGS\" ] && LOGS_OK=1",
            "printf '__SBH_LOGS_DIR_OK__=%s\\n' \"$LOGS_OK\"",
            "[ \"$LOGS_OK\" = 1 ] || block logs_directory 215",

            "PROBE_EXISTS=0; [ -e \"$PROBE\" ] && PROBE_EXISTS=1",
            "PROBE_TYPE_OK=1",
            "if [ \"$PROBE_EXISTS\" = 1 ]; then " +
                "[ -d \"$PROBE\" ] && [ ! -L \"$PROBE\" ] || PROBE_TYPE_OK=0; fi",
            "printf '__SBH_PROBE_EXISTS__=%s\\n' \"$PROBE_EXISTS\"",
            "printf '__SBH_PROBE_TYPE_OK__=%s\\n' \"$PROBE_TYPE_OK\"",
            "[ \"$PROBE_TYPE_OK\" = 1 ] || block probe_directory_type 216",

            "CFG_OK=0; [ -f \"$CFG\" ] && [ ! -L \"$CFG\" ] && CFG_OK=1",
            "printf '__SBH_CONFIG_FILE_OK__=%s\\n' \"$CFG_OK\"",
            "[ \"$CFG_OK\" = 1 ] || block production_config_file 219",

            "BIN_OK=0; [ -f \"$BIN\" ] && [ -x \"$BIN\" ] && [ ! -L \"$BIN\" ] && BIN_OK=1",
            "printf '__SBH_BINARY_OK__=%s\\n' \"$BIN_OK\"",
            "[ \"$BIN_OK\" = 1 ] || block singbox_binary 220",

            "CM=$(stat -c %a \"$CFG\" 2>/dev/null || echo -1)",
            "CU=$(stat -c %u \"$CFG\" 2>/dev/null || echo -1)",
            "CG=$(stat -c %g \"$CFG\" 2>/dev/null || echo -1)",
            "printf '__SBH_CM__=%s\\n' \"$CM\"",
            "printf '__SBH_CU__=%s\\n' \"$CU\"",
            "printf '__SBH_CG__=%s\\n' \"$CG\"",
            "[ \"$CM\" = 600 ] && [ \"$CU\" = 0 ] && [ \"$CG\" = 0 ] || block production_config_metadata 221",

            "SC=0; STAGE=''",
            "for F in \"$D\"/.runtime-tun.json.stage-*; do " +
                "[ -e \"$F\" ] || continue; SC=$((SC + 1)); STAGE=\"$F\"; " +
            "done",
            "printf '__SBH_STAGE_COUNT__=%s\\n' \"$SC\"",
            "[ \"$SC\" = 1 ] || block staging_count 222",

            "STAGE_OK=0",
            "if [ \"$SC\" = 1 ] && [ -f \"$STAGE\" ] && [ ! -L \"$STAGE\" ]; then STAGE_OK=1; fi",
            "printf '__SBH_STAGE_TYPE_OK__=%s\\n' \"$STAGE_OK\"",
            "[ \"$SC\" != 1 ] || [ \"$STAGE_OK\" = 1 ] || block staging_file_type 223",

            "CH=$(sha256sum \"$CFG\" 2>/dev/null | awk '{print $1}')",
            "CB=$(stat -c %s \"$CFG\" 2>/dev/null || echo -1)",
            "SH=none; SB=-1",
            "if [ \"$SC\" = 1 ]; then " +
                "SH=$(sha256sum \"$STAGE\" 2>/dev/null | awk '{print $1}'); " +
                "SB=$(stat -c %s \"$STAGE\" 2>/dev/null || echo -1); fi",
            "LINEAGE=0; [ \"$SC\" = 1 ] && [ -n \"$CH\" ] && [ \"$CH\" = \"$SH\" ] && [ \"$CB\" = \"$SB\" ] && LINEAGE=1",
            "printf '__SBH_CH__=%s\\n' \"${CH:-none}\"",
            "printf '__SBH_CB__=%s\\n' \"$CB\"",
            "printf '__SBH_SH__=%s\\n' \"$SH\"",
            "printf '__SBH_SB__=%s\\n' \"$SB\"",
            "printf '__SBH_LINEAGE__=%s\\n' \"$LINEAGE\"",
            "[ \"$LINEAGE\" = 1 ] || block production_staging_lineage 224",

            "CHECK=-1",
            "if [ \"$CFG_OK\" = 1 ] && [ \"$BIN_OK\" = 1 ]; then check_config; CHECK=$?; fi",
            "printf '__SBH_CHECK__=%s\\n' \"$CHECK\"",
            "[ \"$CHECK\" = 0 ] || block production_config_check 225",

            "ACTIVE_META_EXISTS=0; [ -e \"$ACTIVE_META\" ] && ACTIVE_META_EXISTS=1",
            "ACTIVE_META_FILE_OK=1",
            "if [ \"$ACTIVE_META_EXISTS\" = 1 ]; then " +
                "[ -f \"$ACTIVE_META\" ] && [ ! -L \"$ACTIVE_META\" ] || ACTIVE_META_FILE_OK=0; fi",
            "printf '__SBH_ACTIVE_META_EXISTS__=%s\\n' \"$ACTIVE_META_EXISTS\"",
            "printf '__SBH_ACTIVE_META_FILE_OK__=%s\\n' \"$ACTIVE_META_FILE_OK\"",
            "[ \"$ACTIVE_META_EXISTS\" = 0 ] || block active_metadata_present 227",

            "ACTIVE_PID_EXISTS=0; [ -e \"$ACTIVE_PID\" ] && ACTIVE_PID_EXISTS=1",
            "ACTIVE_PID_FILE_OK=1; ACTIVE_PID_NUMERIC=0; ACTIVE_PID_ALIVE=0; ACTIVE_PID_MATCH=0",
            "if [ \"$ACTIVE_PID_EXISTS\" = 1 ]; then " +
                "[ -f \"$ACTIVE_PID\" ] && [ ! -L \"$ACTIVE_PID\" ] || ACTIVE_PID_FILE_OK=0; " +
                "AP=$(cat \"$ACTIVE_PID\" 2>/dev/null); " +
                "case \"$AP\" in ''|*[!0-9]*) ACTIVE_PID_NUMERIC=0;; *) ACTIVE_PID_NUMERIC=1;; esac; " +
                "if [ \"$ACTIVE_PID_NUMERIC\" = 1 ] && kill -0 \"$AP\" 2>/dev/null; then ACTIVE_PID_ALIVE=1; fi; " +
                "if [ \"$ACTIVE_PID_ALIVE\" = 1 ] && match_core \"$AP\"; then ACTIVE_PID_MATCH=1; fi; " +
            "fi",
            "printf '__SBH_ACTIVE_PID_EXISTS__=%s\\n' \"$ACTIVE_PID_EXISTS\"",
            "printf '__SBH_ACTIVE_PID_FILE_OK__=%s\\n' \"$ACTIVE_PID_FILE_OK\"",
            "printf '__SBH_ACTIVE_PID_NUMERIC__=%s\\n' \"$ACTIVE_PID_NUMERIC\"",
            "printf '__SBH_ACTIVE_PID_ALIVE__=%s\\n' \"$ACTIVE_PID_ALIVE\"",
            "printf '__SBH_ACTIVE_PID_MATCH__=%s\\n' \"$ACTIVE_PID_MATCH\"",
            "if [ \"$ACTIVE_PID_EXISTS\" = 1 ]; then " +
                "if [ \"$ACTIVE_PID_FILE_OK\" != 1 ]; then block active_pid_file_type 228; " +
                "elif [ \"$ACTIVE_PID_NUMERIC\" != 1 ]; then block active_pid_format 229; " +
                "elif [ \"$ACTIVE_PID_ALIVE\" = 1 ] && [ \"$ACTIVE_PID_MATCH\" = 1 ]; then block active_core_already_running 230; " +
                "else block stale_active_pid 231; fi; fi",

            "EXISTING=$(core_count)",
            "printf '__SBH_EXISTING__=%s\\n' \"$EXISTING\"",
            "[ \"$EXISTING\" = 0 ] || block existing_matching_core 232",

            "TUN=0; [ -e /sys/class/net/sbh-tun0 ] && TUN=1",
            "R4=$(rule4_count); R6=$(rule6_count)",
            "RT4=$(route4_count); RT6=$(route6_count)",
            "printf '__SBH_TUN__=%s\\n' \"$TUN\"",
            "printf '__SBH_RULE4__=%s\\n' \"$R4\"",
            "printf '__SBH_RULE6__=%s\\n' \"$R6\"",
            "printf '__SBH_ROUTE4__=%s\\n' \"$RT4\"",
            "printf '__SBH_ROUTE6__=%s\\n' \"$RT6\"",
            "[ \"$TUN\" = 0 ] && [ \"$R4\" = 0 ] && [ \"$R6\" = 0 ] && " +
                "[ \"$RT4\" = 0 ] && [ \"$RT6\" = 0 ] || block reserved_network_resources 233",

            "WOULD_PASS=0; [ \"$BLOCK\" = none ] && WOULD_PASS=1",
            "printf '__SBH_BLOCK__=%s\\n' \"$BLOCK\"",
            "printf '__SBH_BLOCK_CODE__=%s\\n' \"$BLOCK_CODE\"",
            "printf '__SBH_WOULD_PASS__=%s\\n' \"$WOULD_PASS\"",
            "printf '__SBH_DONE__=1\\n'",
            "exit 0"
        ]);

        return lines.join("; ");
    }

    function diagnose() {
        var shell = executeShell(buildCommand());
        var raw = shell.output;
        var done = yes(raw, "DONE");
        var blockingGate = marker(raw, "BLOCK");
        var wouldPass = yes(raw, "WOULD_PASS");
        var success = done && blockingGate !== null;

        return {
            ok: success,
            stage:
                "production_stage50_retry1_readonly_preflight_diagnostic",
            diagnosticId: DIAGNOSTIC_ID,
            authorizationConsumed: false,
            automaticRetryAllowed: false,
            manualOnly: true,
            readOnlyDiagnostic: true,
            completionMarkerObserved: done,
            originalPreflightWouldPass: wouldPass,
            blockingGate:
                blockingGate === "none" ? null : blockingGate,
            likelyOriginalExitCode:
                numberValue(raw, "BLOCK_CODE"),
            shellUid: numberValue(raw, "UID"),
            runtimeRootValid: yes(raw, "ROOT_OK"),
            configDirectoryValid: yes(raw, "CONFIG_DIR_OK"),
            stateDirectoryValid: yes(raw, "STATE_DIR_OK"),
            logsDirectoryValid: yes(raw, "LOGS_DIR_OK"),
            probeDirectoryExists: yes(raw, "PROBE_EXISTS"),
            probeDirectoryTypeValid: yes(raw, "PROBE_TYPE_OK"),
            probeDirectoryWouldBeCreated:
                !yes(raw, "PROBE_EXISTS") &&
                yes(raw, "STATE_DIR_OK"),
            productionConfigFileValid:
                yes(raw, "CONFIG_FILE_OK"),
            singBoxBinaryValid: yes(raw, "BINARY_OK"),
            productionConfigMode: marker(raw, "CM"),
            productionConfigUid: numberValue(raw, "CU"),
            productionConfigGid: numberValue(raw, "CG"),
            stagingCount: numberValue(raw, "STAGE_COUNT"),
            stagingFileTypeValid: yes(raw, "STAGE_TYPE_OK"),
            productionConfigSha256: marker(raw, "CH"),
            productionConfigByteCount: numberValue(raw, "CB"),
            stagingConfigSha256: marker(raw, "SH"),
            stagingConfigByteCount: numberValue(raw, "SB"),
            productionStagingLineageMatched:
                yes(raw, "LINEAGE"),
            productionConfigCheckExitCode:
                numberValue(raw, "CHECK"),
            productionConfigCheckPassed:
                numberValue(raw, "CHECK") === 0,
            activeMetadataExists:
                yes(raw, "ACTIVE_META_EXISTS"),
            activeMetadataFileTypeValid:
                yes(raw, "ACTIVE_META_FILE_OK"),
            activePidExists:
                yes(raw, "ACTIVE_PID_EXISTS"),
            activePidFileTypeValid:
                yes(raw, "ACTIVE_PID_FILE_OK"),
            activePidNumeric:
                yes(raw, "ACTIVE_PID_NUMERIC"),
            activePidAlive:
                yes(raw, "ACTIVE_PID_ALIVE"),
            activePidMatchesCore:
                yes(raw, "ACTIVE_PID_MATCH"),
            existingMatchingCoreCount:
                numberValue(raw, "EXISTING"),
            tunInterfacePresent: yes(raw, "TUN"),
            reservedIpv4RuleCount:
                numberValue(raw, "RULE4"),
            reservedIpv6RuleCount:
                numberValue(raw, "RULE6"),
            reservedIpv4RouteCount:
                numberValue(raw, "ROUTE4"),
            reservedIpv6RouteCount:
                numberValue(raw, "ROUTE6"),
            shellCode: shell.code,
            shellCodeAuthoritative: false,
            shellTransportCodeAnomalous:
                done && shell.code !== 0,
            coreStartInvoked: false,
            coreStopInvoked: false,
            runtimeFilesModified: false,
            configModified: false,
            tunCreated: false,
            routeModified: false,
            networkAccessed: false,
            destructiveOperations: false,
            readyForCorrectedStage50Retry:
                success && wouldPass,
            nextAuthorizedOperation:
                success ?
                    (
                        wouldPass ?
                            "corrected_runtime_core_start_probe_retry" :
                            "repair_identified_stage50_preflight_gate"
                    ) :
                    "resolve_stage50_diagnostic_transport",
            timestamp: now()
        };
    }

    function diagnoseAsync(callback) {
        if (typeof callback !== "function") {
            throw new Error(
                "Stage50 Retry1 diagnostic callback unavailable"
            );
        }
        if (busy) {
            callback({
                ok: false,
                stage:
                    "production_stage50_retry1_readonly_preflight_diagnostic",
                errorCode:
                    "STAGE50_RETRY1_DIAGNOSTIC_ALREADY_RUNNING",
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
                        output = diagnose();
                    } catch (ignored) {
                        output = {
                            ok: false,
                            stage:
                                "production_stage50_retry1_readonly_preflight_diagnostic",
                            errorCode:
                                "READONLY_PREFLIGHT_DIAGNOSTIC_FAILED",
                            errorDetailReturned: false,
                            diagnosticId: DIAGNOSTIC_ID,
                            authorizationConsumed: false,
                            coreStartInvoked: false,
                            runtimeFilesModified: false,
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
            "SingBoxHub-Stage50Retry1Diagnostic"
        ).start();

        return {
            accepted: true,
            busy: false
        };
    }

    function buildCard() {
        var card = W.card(17);
        var title = W.text(
            "Stage 50 前置门禁诊断",
            17,
            C.navy,
            true
        );
        var note = W.text(
            "只读复核 Stage 50 的每项前置条件并返回首个阻断门禁。" +
            "本诊断不再次启动 Core，不创建文件，不修复状态，不修改配置、TUN 或路由。",
            11.4,
            C.secondary,
            false
        );
        var resultText = W.text(
            JSON.stringify({
                ready: true,
                diagnosticId: DIAGNOSTIC_ID,
                readOnly: true,
                coreStartEnabled: false,
                runtimeWriteEnabled: false,
                automaticRetryAllowed: false
            }, null, 2),
            10.3,
            C.secondary,
            false
        );
        var button = W.button(
            "诊断 Stage 50 前置门禁",
            "shield",
            C.orange,
            C.orangeSoft,
            function () {
                resultText.setText(
                    "正在执行只读前置门禁诊断。"
                );
                SBH.util.toast(
                    "正在诊断 Stage 50 前置门禁"
                );
                diagnoseAsync(function (result) {
                    resultText.setText(
                        JSON.stringify(result, null, 2)
                    );
                    SBH.util.toast(
                        result.ok === true ?
                            (
                                result.blockingGate ?
                                    "已定位 Stage 50 阻断门禁" :
                                    "前置条件已通过，等待修正版启动授权"
                            ) :
                            "Stage 50 诊断存在待处理项"
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
            "Stage50 Retry1 diagnostic dependencies unavailable"
        );
    }

    SBH.runtimeCoreStartPreflightDiagnostic = {
        version: 1,
        diagnoseAsync: diagnoseAsync,
        diagnosticId: DIAGNOSTIC_ID,
        manualOnly: true,
        readOnly: true,
        automaticRetryAllowed: false,
        coreStartEnabled: false,
        runtimeWriteEnabled: false
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

        output.runtimeCoreStartPreflightDiagnosticVersion = 1;
        output.runtimeCoreStartPreflightDiagnosticReady = true;
        output.runtimeCoreStartPreflightDiagnosticId =
            DIAGNOSTIC_ID;
        output.runtimeCoreStartPreflightDiagnosticManualOnly = true;
        output.runtimeCoreStartPreflightDiagnosticReadOnly = true;
        output.runtimeCoreStartDiagnosticCoreStartEnabled = false;
        output.runtimeCoreStartDiagnosticRuntimeWriteEnabled = false;
        output.writeOperationsLocked = true;
        output.destructiveOperations = false;
        return output;
    };
}());
