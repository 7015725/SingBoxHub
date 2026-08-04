/* SingBoxHub Stage50 Retry2 state directory repair. Rhino ES5 only. */
SBH.versions.runtimeStateDirectoryRepair = 1;

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
        "stage50-retry2-state-directory-repair-user-authorized-20260804";

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
                "SingBoxHub#Stage50Retry2#stateRepair#" +
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

    function buildCommand() {
        var root = runtimeRoot();
        var lines = [
            "umask 077",
            "ROOT=" + quote(root),
            "D=" + quote(root + "/config"),
            "CFG=" + quote(root + "/config/runtime-tun.json"),
            "BIN=" + quote(root + "/bin/sing-box"),
            "STATE=" + quote(root + "/state"),
            "LOGS=" + quote(root + "/logs"),
            "CREATED=0",
            "PREEXISTED=0",
            "RESULT=unknown",
            "GATE=none",
            "CODE=0",
            "finish(){ " +
                "printf '__SBH_RESULT__=%s\\n' \"$RESULT\"; " +
                "printf '__SBH_GATE__=%s\\n' \"$GATE\"; " +
                "printf '__SBH_CODE__=%s\\n' \"$CODE\"; " +
                "printf '__SBH_CREATED__=%s\\n' \"$CREATED\"; " +
                "printf '__SBH_PREEXISTED__=%s\\n' \"$PREEXISTED\"; " +
                "printf '__SBH_DONE__=1\\n'; exit 0; " +
            "}",
            "fail(){ RESULT=blocked; GATE=\"$1\"; CODE=\"$2\"; finish; }",
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
            "}",
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

            "UIDV=$(id -u 2>/dev/null)",
            "printf '__SBH_UID__=%s\\n' \"$UIDV\"",
            "[ \"$UIDV\" = 0 ] || fail root_uid 301",

            "[ -d \"$ROOT\" ] && [ ! -L \"$ROOT\" ] || fail runtime_root 302",
            "[ -d \"$D\" ] && [ ! -L \"$D\" ] || fail config_directory 303",
            "[ -d \"$LOGS\" ] && [ ! -L \"$LOGS\" ] || fail logs_directory 304",
            "[ -f \"$CFG\" ] && [ ! -L \"$CFG\" ] || fail production_config 305",
            "[ -f \"$BIN\" ] && [ -x \"$BIN\" ] && [ ! -L \"$BIN\" ] || fail singbox_binary 306",

            "CH0=$(sha256sum \"$CFG\" 2>/dev/null | awk '{print $1}')",
            "CB0=$(stat -c %s \"$CFG\" 2>/dev/null || echo -1)",
            "CM0=$(stat -c %a \"$CFG\" 2>/dev/null || echo -1)",
            "CU0=$(stat -c %u \"$CFG\" 2>/dev/null || echo -1)",
            "CG0=$(stat -c %g \"$CFG\" 2>/dev/null || echo -1)",
            "printf '__SBH_CONFIG_HASH_BEFORE__=%s\\n' \"$CH0\"",
            "printf '__SBH_CONFIG_BYTES_BEFORE__=%s\\n' \"$CB0\"",
            "[ \"$CM0\" = 600 ] && [ \"$CU0\" = 0 ] && [ \"$CG0\" = 0 ] || fail production_config_metadata 307",

            "SC=0; STAGE=''",
            "for F in \"$D\"/.runtime-tun.json.stage-*; do " +
                "[ -e \"$F\" ] || continue; SC=$((SC + 1)); STAGE=\"$F\"; " +
            "done",
            "printf '__SBH_STAGE_COUNT__=%s\\n' \"$SC\"",
            "[ \"$SC\" = 1 ] || fail staging_count 308",
            "[ -f \"$STAGE\" ] && [ ! -L \"$STAGE\" ] || fail staging_file_type 309",
            "SH0=$(sha256sum \"$STAGE\" 2>/dev/null | awk '{print $1}')",
            "SB0=$(stat -c %s \"$STAGE\" 2>/dev/null || echo -1)",
            "printf '__SBH_STAGE_HASH_BEFORE__=%s\\n' \"$SH0\"",
            "printf '__SBH_STAGE_BYTES_BEFORE__=%s\\n' \"$SB0\"",
            "[ -n \"$CH0\" ] && [ \"$CH0\" = \"$SH0\" ] && [ \"$CB0\" = \"$SB0\" ] || fail production_staging_lineage 310",

            "CORE0=$(core_count)",
            "TUN0=0; ip link show sbh-tun0 >/dev/null 2>&1 && TUN0=1",
            "R40=$(rule4_count); R60=$(rule6_count)",
            "T40=$(route4_count); T60=$(route6_count)",
            "printf '__SBH_CORE_BEFORE__=%s\\n' \"$CORE0\"",
            "printf '__SBH_TUN_BEFORE__=%s\\n' \"$TUN0\"",
            "printf '__SBH_RULE4_BEFORE__=%s\\n' \"$R40\"",
            "printf '__SBH_RULE6_BEFORE__=%s\\n' \"$R60\"",
            "printf '__SBH_ROUTE4_BEFORE__=%s\\n' \"$T40\"",
            "printf '__SBH_ROUTE6_BEFORE__=%s\\n' \"$T60\"",
            "[ \"$CORE0\" = 0 ] || fail matching_core_present 311",
            "[ \"$TUN0\" = 0 ] || fail tun_present 312",
            "[ \"$R40\" = 0 ] && [ \"$R60\" = 0 ] && [ \"$T40\" = 0 ] && [ \"$T60\" = 0 ] || fail reserved_network_resources_present 313",

            "if [ -e \"$STATE\" ] || [ -L \"$STATE\" ]; then " +
                "PREEXISTED=1; " +
                "[ -d \"$STATE\" ] && [ ! -L \"$STATE\" ] || fail state_path_conflict 314; " +
            "else " +
                "mkdir \"$STATE\" 2>/dev/null || fail state_directory_create 315; " +
                "CREATED=1; " +
            "fi",
            "chmod 700 \"$STATE\" 2>/dev/null || fail state_directory_chmod 316",
            "chown 0:0 \"$STATE\" >/dev/null 2>&1 || fail state_directory_chown 317",
            "sync >/dev/null 2>&1 || true",

            "STATE_OK=0; [ -d \"$STATE\" ] && [ ! -L \"$STATE\" ] && STATE_OK=1",
            "SM=$(stat -c %a \"$STATE\" 2>/dev/null || echo -1)",
            "SU=$(stat -c %u \"$STATE\" 2>/dev/null || echo -1)",
            "SG=$(stat -c %g \"$STATE\" 2>/dev/null || echo -1)",
            "printf '__SBH_STATE_OK__=%s\\n' \"$STATE_OK\"",
            "printf '__SBH_STATE_MODE__=%s\\n' \"$SM\"",
            "printf '__SBH_STATE_UID__=%s\\n' \"$SU\"",
            "printf '__SBH_STATE_GID__=%s\\n' \"$SG\"",
            "[ \"$STATE_OK\" = 1 ] && [ \"$SM\" = 700 ] && [ \"$SU\" = 0 ] && [ \"$SG\" = 0 ] || fail state_directory_verify 318",

            "CH1=$(sha256sum \"$CFG\" 2>/dev/null | awk '{print $1}')",
            "CB1=$(stat -c %s \"$CFG\" 2>/dev/null || echo -1)",
            "SH1=$(sha256sum \"$STAGE\" 2>/dev/null | awk '{print $1}')",
            "SB1=$(stat -c %s \"$STAGE\" 2>/dev/null || echo -1)",
            "printf '__SBH_CONFIG_HASH_AFTER__=%s\\n' \"$CH1\"",
            "printf '__SBH_CONFIG_BYTES_AFTER__=%s\\n' \"$CB1\"",
            "printf '__SBH_STAGE_HASH_AFTER__=%s\\n' \"$SH1\"",
            "printf '__SBH_STAGE_BYTES_AFTER__=%s\\n' \"$SB1\"",
            "[ \"$CH0\" = \"$CH1\" ] && [ \"$CB0\" = \"$CB1\" ] || fail production_config_changed 319",
            "[ \"$SH0\" = \"$SH1\" ] && [ \"$SB0\" = \"$SB1\" ] || fail staging_changed 320",

            "CORE1=$(core_count)",
            "TUN1=0; ip link show sbh-tun0 >/dev/null 2>&1 && TUN1=1",
            "R41=$(rule4_count); R61=$(rule6_count)",
            "T41=$(route4_count); T61=$(route6_count)",
            "printf '__SBH_CORE_AFTER__=%s\\n' \"$CORE1\"",
            "printf '__SBH_TUN_AFTER__=%s\\n' \"$TUN1\"",
            "printf '__SBH_RULE4_AFTER__=%s\\n' \"$R41\"",
            "printf '__SBH_RULE6_AFTER__=%s\\n' \"$R61\"",
            "printf '__SBH_ROUTE4_AFTER__=%s\\n' \"$T41\"",
            "printf '__SBH_ROUTE6_AFTER__=%s\\n' \"$T61\"",
            "[ \"$CORE1\" = 0 ] || fail core_state_changed 321",
            "[ \"$TUN1\" = 0 ] || fail tun_state_changed 322",
            "[ \"$R41\" = 0 ] && [ \"$R61\" = 0 ] && [ \"$T41\" = 0 ] && [ \"$T61\" = 0 ] || fail network_resources_changed 323",

            "RESULT=repaired",
            "GATE=none",
            "CODE=0",
            "finish"
        ];
        return lines.join("; ");
    }

    function repair() {
        var shellResult = executeShell(buildCommand());
        var raw = shellResult.output;
        var done = yes(raw, "DONE");
        var result = marker(raw, "RESULT");
        var success =
            done &&
            result === "repaired" &&
            yes(raw, "STATE_OK") &&
            marker(raw, "STATE_MODE") === "700" &&
            numberValue(raw, "STATE_UID") === 0 &&
            numberValue(raw, "STATE_GID") === 0 &&
            marker(raw, "CONFIG_HASH_BEFORE") ===
                marker(raw, "CONFIG_HASH_AFTER") &&
            numberValue(raw, "CONFIG_BYTES_BEFORE") ===
                numberValue(raw, "CONFIG_BYTES_AFTER") &&
            marker(raw, "STAGE_HASH_BEFORE") ===
                marker(raw, "STAGE_HASH_AFTER") &&
            numberValue(raw, "STAGE_BYTES_BEFORE") ===
                numberValue(raw, "STAGE_BYTES_AFTER") &&
            numberValue(raw, "CORE_AFTER") === 0 &&
            numberValue(raw, "TUN_AFTER") === 0 &&
            numberValue(raw, "RULE4_AFTER") === 0 &&
            numberValue(raw, "RULE6_AFTER") === 0 &&
            numberValue(raw, "ROUTE4_AFTER") === 0 &&
            numberValue(raw, "ROUTE6_AFTER") === 0;

        return {
            ok: success,
            stage:
                "production_stage50_retry2_state_directory_repair",
            authorizationId: AUTHORIZATION_ID,
            authorizationConsumed: true,
            automaticRetryAllowed: false,
            manualOnly: true,
            identifiedGate: "state_directory",
            originalLikelyExitCode: 214,
            shellCompletionMarkerObserved: done,
            repairResult: result,
            blockingGate:
                result === "blocked" ? marker(raw, "GATE") : null,
            repairCode: numberValue(raw, "CODE"),
            shellUid: numberValue(raw, "UID"),
            stateDirectoryPreexisted: yes(raw, "PREEXISTED"),
            stateDirectoryCreated: yes(raw, "CREATED"),
            stateDirectoryValid: yes(raw, "STATE_OK"),
            stateDirectoryMode: marker(raw, "STATE_MODE"),
            stateDirectoryUid: numberValue(raw, "STATE_UID"),
            stateDirectoryGid: numberValue(raw, "STATE_GID"),
            productionConfigHashUnchanged:
                marker(raw, "CONFIG_HASH_BEFORE") ===
                    marker(raw, "CONFIG_HASH_AFTER"),
            productionConfigSizeUnchanged:
                numberValue(raw, "CONFIG_BYTES_BEFORE") ===
                    numberValue(raw, "CONFIG_BYTES_AFTER"),
            stagingHashUnchanged:
                marker(raw, "STAGE_HASH_BEFORE") ===
                    marker(raw, "STAGE_HASH_AFTER"),
            stagingSizeUnchanged:
                numberValue(raw, "STAGE_BYTES_BEFORE") ===
                    numberValue(raw, "STAGE_BYTES_AFTER"),
            matchingCoreCountBefore:
                numberValue(raw, "CORE_BEFORE"),
            matchingCoreCountAfter:
                numberValue(raw, "CORE_AFTER"),
            tunInterfaceBefore: yes(raw, "TUN_BEFORE"),
            tunInterfaceAfter: yes(raw, "TUN_AFTER"),
            reservedIpv4RuleCountBefore:
                numberValue(raw, "RULE4_BEFORE"),
            reservedIpv6RuleCountBefore:
                numberValue(raw, "RULE6_BEFORE"),
            reservedIpv4RouteCountBefore:
                numberValue(raw, "ROUTE4_BEFORE"),
            reservedIpv6RouteCountBefore:
                numberValue(raw, "ROUTE6_BEFORE"),
            reservedIpv4RuleCountAfter:
                numberValue(raw, "RULE4_AFTER"),
            reservedIpv6RuleCountAfter:
                numberValue(raw, "RULE6_AFTER"),
            reservedIpv4RouteCountAfter:
                numberValue(raw, "ROUTE4_AFTER"),
            reservedIpv6RouteCountAfter:
                numberValue(raw, "ROUTE6_AFTER"),
            shellCode: shellResult.code,
            shellCodeAuthoritative: false,
            shellTransportCodeAnomalous:
                done && shellResult.code !== 0,
            coreStartInvoked: false,
            coreStopInvoked: false,
            runtimeFilesModified: yes(raw, "CREATED"),
            configModified: false,
            stagingModified: false,
            tunCreated: false,
            routeModified: false,
            networkAccessed: false,
            destructiveOperations: false,
            readyForCorrectedStage50Retry: success,
            nextAuthorizedOperation:
                success ?
                    "runtime_core_start_probe_retry_after_state_directory_repair" :
                    "resolve_state_directory_repair_failure",
            timestamp: now()
        };
    }

    function repairAsync(callback) {
        if (typeof callback !== "function") {
            throw new Error("Stage50 Retry2 callback unavailable");
        }
        if (busy) {
            callback({
                ok: false,
                stage:
                    "production_stage50_retry2_state_directory_repair",
                errorCode: "STATE_DIRECTORY_REPAIR_ALREADY_RUNNING",
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
                        output = repair();
                    } catch (ignored) {
                        output = {
                            ok: false,
                            stage:
                                "production_stage50_retry2_state_directory_repair",
                            errorCode:
                                "STATE_DIRECTORY_REPAIR_FAILED",
                            errorDetailReturned: false,
                            authorizationId: AUTHORIZATION_ID,
                            authorizationConsumed: true,
                            coreStartInvoked: false,
                            coreStopInvoked: false,
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
            "SingBoxHub-Stage50Retry2StateRepair"
        ).start();

        return {
            accepted: true,
            busy: false
        };
    }

    function buildCard() {
        var card = W.card(17);
        var title = W.text(
            "修复 Stage 50 state 目录",
            17,
            C.navy,
            true
        );
        var note = W.text(
            "只修复已定位的 Runtime/state 前置门禁。若路径不存在，则创建为 0700、root 所有；" +
            "若路径已被普通文件或符号链接占用，将安全拒绝。" +
            "本阶段不启动 Core，不修改配置、staging、TUN 或路由。",
            11.4,
            C.secondary,
            false
        );
        var resultText = W.text(
            JSON.stringify({
                ready: true,
                authorizationId: AUTHORIZATION_ID,
                identifiedGate: "state_directory",
                expectedOriginalExitCode: 214,
                stateDirectoryRepairEnabled: true,
                coreStartEnabled: false,
                automaticRetryAllowed: false
            }, null, 2),
            10.3,
            C.secondary,
            false
        );
        var button = W.button(
            "创建并校验 Runtime state 目录",
            "shield",
            C.orange,
            C.orangeSoft,
            function () {
                resultText.setText(
                    "正在校验并修复 Runtime state 目录。"
                );
                SBH.util.toast(
                    "正在修复 Stage 50 state 目录"
                );
                repairAsync(function (result) {
                    resultText.setText(
                        JSON.stringify(result, null, 2)
                    );
                    SBH.util.toast(
                        result.ok === true ?
                            "Runtime state 目录修复完成" :
                            "state 目录修复存在待处理项"
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
            "Stage50 Retry2 repair dependencies unavailable"
        );
    }

    SBH.runtimeStateDirectoryRepair = {
        version: 1,
        repairAsync: repairAsync,
        authorizationId: AUTHORIZATION_ID,
        manualOnly: true,
        automaticRetryAllowed: false,
        identifiedGate: "state_directory",
        expectedOriginalExitCode: 214,
        coreStartEnabled: false
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

        output.runtimeStateDirectoryRepairVersion = 1;
        output.runtimeStateDirectoryRepairReady = true;
        output.runtimeStateDirectoryRepairAuthorizationId =
            AUTHORIZATION_ID;
        output.runtimeStateDirectoryRepairManualOnly = true;
        output.runtimeStateDirectoryRepairAutomaticRetry = false;
        output.runtimeStateDirectoryRepairIdentifiedGate =
            "state_directory";
        output.runtimeStateDirectoryRepairCoreStartEnabled = false;
        output.writeOperationsLocked = false;
        output.destructiveOperations = false;
        return output;
    };
}());
