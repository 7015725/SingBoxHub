/* SingBoxHub Stage34: inline action feedback only. Rhino ES5 only. */
SBH.versions.inlineFeedback = 1;

(function () {
    "use strict";

    var P = Packages;
    var View = P.android.view.View;
    var ViewGroup = P.android.view.ViewGroup;
    var FrameLayout = P.android.widget.FrameLayout;
    var Gravity = P.android.view.Gravity;
    var originalCreate = SBH.window.createController;
    var originalStart = SBH.app.start;
    var originalToast = SBH.util.toast;
    var FEEDBACK_HEIGHT_DP = 48;
    var FEEDBACK_SIDE_DP = 18;
    var FEEDBACK_BOTTOM_DP = 78;

    function now() {
        return Number(SBH.util.now());
    }

    function textOf(value) {
        return String(
            value === null || value === undefined ?
                "" : value
        );
    }

    function classify(message) {
        var value = textOf(message);
        var C = SBH.theme.colors;

        if (/失败|错误|不可用|拒绝|异常|缺失/.test(value)) {
            return {
                accent: C.coral,
                soft: C.coralSoft,
                kind: "error"
            };
        }
        if (/正在|检查中|刷新中|处理中/.test(value)) {
            return {
                accent: C.orange,
                soft: C.orangeSoft,
                kind: "pending"
            };
        }
        if (/锁定|门禁|端点|只读/.test(value)) {
            return {
                accent: C.blue,
                soft: C.blueSoft,
                kind: "locked"
            };
        }
        return {
            accent: C.green,
            soft: C.greenSoft,
            kind: "success"
        };
    }

    function currentController() {
        var app = SBH.global.__SBH_APP__;
        return app && app.controller ? app.controller : null;
    }

    function controllerAttached(controller) {
        try {
            return controller &&
                controller.attached === true &&
                controller.root !== null;
        } catch (ignored) {
            return false;
        }
    }

    function feedbackLayoutParams() {
        var params = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            SBH.util.dp(FEEDBACK_HEIGHT_DP)
        );
        params.gravity = Gravity.BOTTOM;
        params.leftMargin = SBH.util.dp(FEEDBACK_SIDE_DP);
        params.rightMargin = SBH.util.dp(FEEDBACK_SIDE_DP);
        params.bottomMargin = SBH.util.dp(FEEDBACK_BOTTOM_DP);
        return params;
    }

    function installFeedback(controller, root) {
        var bar = SBH.widgets.row();
        var dot = new View(SBH.ctx);
        var text = SBH.widgets.text(
            "操作结果",
            12.8,
            SBH.theme.colors.text,
            true
        );

        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(
            SBH.util.dp(14),
            0,
            SBH.util.dp(14),
            0
        );
        bar.setVisibility(View.GONE);
        try {
            bar.setElevation(SBH.util.dp(10));
        } catch (ignoredElevation) {}

        dot.setBackground(
            SBH.theme.rounded(
                SBH.theme.colors.green,
                8,
                SBH.theme.colors.clear,
                0
            )
        );
        bar.addView(
            dot,
            SBH.widgets.lp(
                SBH.util.dp(9),
                SBH.util.dp(9)
            )
        );

        text.setPadding(SBH.util.dp(10), 0, 0, 0);
        bar.addView(
            text,
            SBH.widgets.lp(
                0,
                SBH.widgets.WRAP,
                1
            )
        );

        SBH.widgets.click(bar, function () {
            bar.setVisibility(View.GONE);
        });

        root.addView(bar, feedbackLayoutParams());

        controller.inlineFeedbackBar = bar;
        controller.inlineFeedbackDot = dot;
        controller.inlineFeedbackText = text;
        controller.inlineFeedbackReady = true;
        controller.inlineFeedbackCount = 0;
        controller.lastInlineFeedback = null;
        controller.lastInlineFeedbackKind = null;
        controller.lastInlineFeedbackAt = null;

        controller.showInlineFeedback = function (message) {
            var presentation = classify(message);
            var value = textOf(message || "操作完成");

            controller.inlineFeedbackCount += 1;
            controller.lastInlineFeedback = value;
            controller.lastInlineFeedbackKind =
                presentation.kind;
            controller.lastInlineFeedbackAt = now();

            text.setText(value);
            text.setTextColor(
                SBH.util.color(presentation.accent)
            );
            dot.setBackground(
                SBH.theme.rounded(
                    presentation.accent,
                    8,
                    SBH.theme.colors.clear,
                    0
                )
            );
            bar.setBackground(
                SBH.theme.rounded(
                    presentation.soft,
                    15,
                    presentation.accent,
                    1
                )
            );
            bar.setVisibility(View.VISIBLE);
            try {
                bar.bringToFront();
            } catch (ignoredFront) {}
            return true;
        };

        controller.hideInlineFeedback = function () {
            bar.setVisibility(View.GONE);
            return true;
        };

        return true;
    }

    if (typeof originalCreate !== "function") {
        throw new Error(
            "Original window controller unavailable"
        );
    }

    SBH.window.createController = function () {
        var controller = originalCreate();
        var originalBuildRoot = controller.buildRoot;
        var originalStatus = controller.status;

        controller.inlineFeedbackReady = false;

        controller.buildRoot = function () {
            var root = originalBuildRoot();
            installFeedback(controller, root);
            return root;
        };

        controller.status = function () {
            var value = originalStatus();
            value.inlineFeedbackReady =
                controller.inlineFeedbackReady === true;
            value.inlineFeedbackCount =
                Number(controller.inlineFeedbackCount || 0);
            value.lastInlineFeedback =
                controller.lastInlineFeedback;
            value.lastInlineFeedbackKind =
                controller.lastInlineFeedbackKind;
            value.lastInlineFeedbackAt =
                controller.lastInlineFeedbackAt;
            value.systemBackDeferred = true;
            value.systemBackCustomGestureInstalled = false;
            return value;
        };

        return controller;
    };

    SBH.util.toast = function (message) {
        var controller = currentController();

        if (controllerAttached(controller) &&
                typeof controller.showInlineFeedback ===
                    "function") {
            return controller.showInlineFeedback(message);
        }

        return originalToast(message);
    };

    if (typeof originalStart !== "function") {
        throw new Error("Original app.start unavailable");
    }

    SBH.app.start = function () {
        var output = originalStart();
        var controller = currentController();
        var status = null;

        try {
            if (controller &&
                    typeof controller.status === "function") {
                status = controller.status();
            }
        } catch (ignoredStatus) {}

        output.inlineFeedbackVersion = 1;
        output.inlineFeedbackReady =
            status && status.inlineFeedbackReady === true;
        output.toastRoutedToInlineFeedback = true;
        output.inlineFeedbackPersistentUntilNextAction = true;
        output.systemBackDeferred = true;
        output.systemBackCustomGestureInstalled = false;
        output.closeButtonRetained = true;
        output.writeOperationsLocked = true;
        output.runtimeFilesModified = false;
        output.coreStartInvoked = false;
        output.coreStopInvoked = false;
        output.tunCreated = false;
        output.routeModified = false;
        output.configModified = false;
        output.destructiveOperations = false;

        return output;
    };
}());
