/* SingBoxHub Stage46 production promotion audit UI. Rhino ES5 only. */
SBH.versions.productionPromotionAuditUi = 1;

(function () {
    "use strict";

    var C = SBH.theme.colors;
    var W = SBH.widgets;
    var service = SBH.productionPromotionAudit;
    var selectorService = SBH.selectorDefaultPreflight;
    var originalFactory = SBH.navigation.pages[1];
    var originalStart = SBH.app.start;

    function selectedSummary() {
        var selected =
            selectorService.getSelectedNode();

        if (selected === null) {
            return "默认节点：未选择";
        }

        return "默认节点：" +
            String(selected.name || selected.protocol) +
            " · " +
            String(selected.protocol || "");
    }

    function initialResult() {
        return JSON.stringify({
            ready: true,
            selectedNode:
                selectorService.getSelectedNode(),
            targetRelativePath:
                service.targetRelativePath,
            auditMode:
                "read_only",
            runtimeDirectoryWriteProbePerformed:
                false,
            productionConfigModified:
                false,
            explicitWriteAuthorizationRequired:
                true
        }, null, 2);
    }

    function buildCard() {
        var card = W.card(17);
        var title = W.text(
            "生产配置提升前只读审计",
            17,
            C.navy,
            true
        );
        var note = W.text(
            "先重新执行 selector 临时检查，再由 Root Shell " +
            "只读取生产配置的哈希、类型、权限和可用空间，" +
            "生成备份与同目录原子替换计划。本阶段不写 Runtime。",
            11.4,
            C.secondary,
            false
        );
        var selectedText = W.text(
            selectedSummary(),
            11.8,
            C.green,
            true
        );
        var resultText = W.text(
            initialResult(),
            10.3,
            C.secondary,
            false
        );
        var button = W.button(
            "运行生产配置只读审计",
            "shield",
            C.blue,
            C.blueSoft,
            function () {
                selectedText.setText(
                    selectedSummary()
                );
                resultText.setText(
                    "正在验证 selector 配置并审计生产目标。" +
                    "不会写入 Runtime 目录。"
                );
                SBH.util.toast(
                    "正在运行生产配置只读审计"
                );
                service.auditAsync(function (result) {
                    resultText.setText(
                        JSON.stringify(result, null, 2)
                    );
                    SBH.util.toast(
                        result.ok === true &&
                        result.readOnlyAuditPassed === true ?
                            (
                                result.productionConfigAlreadyMatches ===
                                    true ?
                                    "生产配置已与候选配置一致" :
                                    "只读审计通过，等待写入授权"
                            ) :
                            "生产配置只读审计存在待处理项"
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
        card.addView(selectedText);
        resultText.setPadding(
            0,
            SBH.util.dp(10),
            0,
            0
        );
        resultText.setTextIsSelectable(true);
        card.addView(resultText);
        card.addView(
            button,
            W.margins(
                W.lp(
                    W.MATCH,
                    SBH.util.dp(44)
                ),
                0,
                12,
                0,
                0
            )
        );
        return card;
    }

    if (!service ||
            typeof service.auditAsync !== "function") {
        throw new Error(
            "Production promotion audit unavailable"
        );
    }
    if (!selectorService ||
            typeof selectorService.getSelectedNode !==
                "function") {
        throw new Error(
            "Selector service unavailable"
        );
    }
    if (typeof originalFactory !== "function") {
        throw new Error(
            "Subscription page factory unavailable"
        );
    }

    SBH.navigation.register(1, function (controller) {
        var view = originalFactory(controller);
        var content = view.getChildAt(0);

        if (content === null ||
                content === undefined ||
                typeof content.addView !==
                    "function") {
            throw new Error(
                "Subscription page content unavailable"
            );
        }

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

    if (typeof originalStart !== "function") {
        throw new Error(
            "Original app.start unavailable"
        );
    }

    SBH.app.start = function () {
        var output = originalStart();

        output.productionPromotionAuditUiVersion = 1;
        output.productionPromotionAuditUiReady = true;
        output.productionPromotionAuditButtonReady = true;
        output.productionPromotionAuditResultSanitized = true;
        output.productionPromotionAuditRuntimeWriteEnabled =
            false;
        output.productionPromotionAuditConfigModified =
            false;
        output.writeOperationsLocked = true;
        output.destructiveOperations = false;
        return output;
    };
}());
