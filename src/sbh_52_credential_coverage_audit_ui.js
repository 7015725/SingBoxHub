/* SingBoxHub Stage42 credential coverage audit UI. Rhino ES5 only. */
SBH.versions.credentialCoverageAuditUi = 1;

(function () {
    "use strict";

    var C = SBH.theme.colors;
    var W = SBH.widgets;
    var auditService = SBH.credentialCoverageAudit;
    var originalFactory = SBH.navigation.pages[1];
    var originalStart = SBH.app.start;

    function summary(value) {
        return [
            "本地节点：" + value.totalNodeCount,
            "保险库凭据：" + value.linkedCredentialCount,
            "缺失凭据：" + value.missingCredentialNodeCount,
            "覆盖率：" + value.coveragePercent + "%",
            "完整覆盖：" + (value.coverageComplete ? "是" : "否")
        ].join(" · ");
    }

    function buildCard() {
        var card = W.card(17);
        var title = W.text(
            "凭据覆盖率审计",
            17,
            C.navy,
            true
        );
        var note = W.text(
            "只核对节点、SQLite 链接和 Keystore 密文是否对应。" +
            "不读取或显示任何真实凭据。",
            11.4,
            C.secondary,
            false
        );
        var initial = auditService.audit();
        var summaryText = W.text(
            summary(initial),
            11.2,
            initial.coverageComplete ? C.green : C.orange,
            true
        );
        var resultText = W.text(
            JSON.stringify(initial, null, 2),
            10.5,
            C.secondary,
            false
        );
        var button = W.button(
            "刷新覆盖率审计",
            "shield",
            C.blue,
            C.blueSoft,
            function () {
                var value = auditService.audit();
                summaryText.setText(summary(value));
                summaryText.setTextColor(
                    SBH.util.color(
                        value.coverageComplete ?
                            C.green : C.orange
                    )
                );
                resultText.setText(
                    JSON.stringify(value, null, 2)
                );
                SBH.util.toast(
                    value.coverageComplete ?
                        "凭据覆盖率审计通过" :
                        "发现未覆盖节点，已显示类型和名称"
                );
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
        card.addView(summaryText);
        resultText.setPadding(
            0,
            SBH.util.dp(8),
            0,
            0
        );
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

    if (!auditService ||
            typeof auditService.audit !== "function") {
        throw new Error(
            "Credential coverage audit unavailable"
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
                typeof content.addView !== "function") {
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
        throw new Error("Original app.start unavailable");
    }

    SBH.app.start = function () {
        var output = originalStart();
        output.credentialCoverageAuditUiVersion = 1;
        output.credentialCoverageAuditUiReady = true;
        output.credentialCoverageAuditButtonReady = true;
        output.credentialCoverageAuditPlaintextRead = false;
        output.subscriptionRuntimeConfigModified = false;
        output.subscriptionCoreInvoked = false;
        output.subscriptionTunCreated = false;
        output.subscriptionRouteModified = false;
        output.writeOperationsLocked = true;
        output.destructiveOperations = false;
        return output;
    };
}());
