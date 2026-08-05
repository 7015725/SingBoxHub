/* SingBoxHub Stage40 credential vault UI. Rhino ES5 only. */
SBH.versions.credentialVaultUi = 1;

(function () {
    "use strict";

    var C = SBH.theme.colors;
    var W = SBH.widgets;
    var vault = SBH.credentialVault;
    var originalFactory =
        SBH.navigation.pages[1];
    var originalStart = SBH.app.start;

    function buildVaultCard() {
        var card = W.card(17);
        var title = W.text(
            "Android Keystore 凭据保险库",
            17,
            C.navy,
            true
        );
        var note = W.text(
            "本阶段仅执行测试密文的加密、解密和删除。" +
            "不会导入真实订阅凭据。",
            11.5,
            C.secondary,
            false
        );
        var statusText = W.text(
            JSON.stringify(vault.status(), null, 2),
            10.8,
            C.secondary,
            false
        );
        var action = W.button(
            "运行保险库自检",
            "shield",
            C.blue,
            C.blueSoft,
            function () {
                statusText.setText(
                    "正在生成测试密文并验证 AES-GCM 往返。" +
                    "测试记录会在完成后立即删除。"
                );
                SBH.util.toast("正在执行保险库自检");
                vault.selfTestAsync(function (result) {
                    statusText.setText(
                        JSON.stringify(result, null, 2)
                    );
                    SBH.util.toast(
                        result.ok === true ?
                            "保险库自检通过" :
                            "保险库自检失败"
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
            SBH.util.dp(10)
        );
        card.addView(note);
        statusText.setTextIsSelectable(true);
        card.addView(statusText);
        card.addView(
            action,
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

    if (!vault) {
        throw new Error(
            "Credential vault unavailable"
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
            buildVaultCard(),
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

        output.credentialVaultUiVersion = 1;
        output.credentialVaultUiReady = true;
        output.credentialVaultSelfTestButtonReady = true;
        output.credentialVaultSelfTestManualOnly = true;
        output.credentialVaultRealCredentialImportEnabled =
            false;
        output.credentialVaultPlaintextDisplayEnabled =
            false;
        output.subscriptionRuntimeConfigModified = false;
        output.subscriptionCoreInvoked = false;
        output.subscriptionTunCreated = false;
        output.subscriptionRouteModified = false;
        output.writeOperationsLocked = true;
        output.destructiveOperations = false;
        return output;
    };
}());
