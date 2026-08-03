/* SingBoxHub Stage44 ephemeral sing-box binary check UI. Rhino ES5 only. */
SBH.versions.ephemeralBinaryCheckUi = 1;

(function () {
    "use strict";

    var C = SBH.theme.colors;
    var W = SBH.widgets;
    var service = SBH.candidateConfigPreflight;
    var originalFactory = SBH.navigation.pages[1];
    var originalStart = SBH.app.start;

    function initialText() {
        return JSON.stringify({
            ready: true,
            action:
                "生成临时完整配置，调用 sing-box check，完成后立即覆盖并删除临时文件。",
            productionConfigModified: false,
            coreStartInvoked: false,
            tunCreated: false,
            routeModified: false
        }, null, 2);
    }

    function buildCard() {
        var card = W.card(17);
        var title = W.text(
            "sing-box 临时配置检查",
            17,
            C.navy,
            true
        );
        var note = W.text(
            "候选 outbound 仅写入客户端临时目录，执行 sing-box check 后" +
            "立即覆盖并删除。不替换生产配置，也不启动 Core/TUN。",
            11.4,
            C.secondary,
            false
        );
        var resultText = W.text(
            initialText(),
            10.5,
            C.secondary,
            false
        );
        var button = W.button(
            "运行 sing-box 配置检查",
            "check",
            C.blue,
            C.blueSoft,
            function () {
                resultText.setText(
                    "正在生成临时配置并调用 sing-box check。" +
                    "检查完成前请保持浮窗打开。"
                );
                SBH.util.toast(
                    "正在运行 sing-box 临时配置检查"
                );
                service.binaryCheckAsync(function (result) {
                    resultText.setText(
                        JSON.stringify(result, null, 2)
                    );
                    SBH.util.toast(
                        result.ok === true &&
                        result.singBoxCheckPassed === true &&
                        result.temporaryConfigDeleted === true ?
                            "sing-box 临时配置检查通过" :
                            "sing-box 配置检查存在待处理项"
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

    if (!service ||
            typeof service.binaryCheckAsync !== "function") {
        throw new Error(
            "Ephemeral binary check unavailable"
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

        output.ephemeralBinaryCheckUiVersion = 1;
        output.ephemeralBinaryCheckUiReady = true;
        output.ephemeralBinaryCheckButtonReady = true;
        output.ephemeralBinaryCheckManualOnly = true;
        output.ephemeralBinaryCheckTemporaryConfigOnly = true;
        output.ephemeralBinaryCheckProductionConfigModified =
            false;
        output.ephemeralBinaryCheckCoreStartEnabled = false;
        output.ephemeralBinaryCheckTunEnabled = false;
        output.ephemeralBinaryCheckRouteWriteEnabled = false;
        output.writeOperationsLocked = true;
        output.destructiveOperations = false;
        return output;
    };
}());
