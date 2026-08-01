/* SingBoxHub non-blocking Runtime gate status home overlay. Rhino ES5 only. */
SBH.versions.runtimeStatusHome = 5;

(function () {
    var P = Packages;
    var C = SBH.theme.colors;
    var W = SBH.widgets;
    var FrameLayout = P.android.widget.FrameLayout;
    var Gravity = P.android.view.Gravity;
    var originalHome = SBH.navigation.pages[0];
    var actionPending = false;

    function infoLine(iconName, title, value, accent) {
        var row = W.row();
        var right = W.text(value, 13, accent || C.text, true);
        row.setPadding(0, SBH.util.dp(7), 0, SBH.util.dp(7));
        row.addView(W.icon(iconName, 24, C.secondary));
        row.addView(
            W.text(title, 12.5, C.secondary, false),
            W.lp(0, W.WRAP, 1)
        );
        row.addView(right);
        return row;
    }

    function controllerAttached(controller) {
        try {
            return controller && controller.status &&
                controller.status().attached === true;
        } catch (ignored) {
            return false;
        }
    }

    function syncView(controller, runtime) {
        if (!controllerAttached(controller)) {
            return;
        }
        try {
            if (runtime &&
                    typeof controller.applyRuntimeBadge === "function") {
                controller.applyRuntimeBadge(runtime);
            } else if (
                typeof controller.refreshRuntimeBadge === "function"
            ) {
                controller.refreshRuntimeBadge(false);
            }
        } catch (ignoredBadge) {}
        try {
            if (typeof controller.showPage === "function") {
                controller.showPage(0);
            }
        } catch (ignoredPage) {}
    }

    function completeAction(controller, result, error) {
        var runtime = null;
        actionPending = false;
        if (error) {
            SBH.log.error("runtime.async", error);
            SBH.util.toast("Runtime 检查失败");
        } else if (result) {
            SBH.log.info(
                "runtime",
                String(result.code || "") + ": " +
                String(result.message || "")
            );
            SBH.util.toast(result.message || "Runtime 检查完成");
            if (result.data && result.data.runtimeState) {
                runtime = result.data;
            }
        }
        try {
            if (SBH.runtime && typeof SBH.runtime.status === "function") {
                runtime = SBH.runtime.status();
            }
        } catch (ignoredStatus) {}
        syncView(controller, runtime);
    }

    function requestAsync(controller, command) {
        if (actionPending) {
            SBH.util.toast("Runtime 检查正在进行");
            return;
        }
        if (!SBH.runtime ||
                typeof SBH.runtime.requestAsync !== "function") {
            SBH.util.toast("异步 Runtime 接口不可用");
            return;
        }
        actionPending = true;
        SBH.util.toast("正在检查…");
        SBH.runtime.requestAsync(
            {
                requestId: "sbh-ui-" + SBH.util.now(),
                command: command,
                expectedState: "unknown",
                arguments: {}
            },
            function (result, error) {
                completeAction(controller, result, error);
            }
        );
    }

    function refreshAsync(controller) {
        if (actionPending) {
            SBH.util.toast("Runtime 检查正在进行");
            return;
        }
        if (!SBH.runtime ||
                typeof SBH.runtime.refreshAsync !== "function") {
            SBH.util.toast("异步刷新接口不可用");
            return;
        }
        actionPending = true;
        SBH.util.toast("正在刷新…");
        SBH.runtime.refreshAsync(function (runtime, error) {
            actionPending = false;
            if (error) {
                SBH.log.error("runtime.refresh", error);
                SBH.util.toast("Runtime 刷新失败");
            } else {
                SBH.util.toast("Runtime 状态已刷新");
            }
            syncView(controller, runtime);
        });
    }

    function componentText(value) {
        return value ? "已就绪" : "缺失";
    }

    function endpointText(runtime) {
        var components = runtime.components || {};
        if (runtime.checking) {
            return "检查中";
        }
        if (!runtime.attached) {
            return "未接入";
        }
        return components.controlEndpoint ? "已发现" : "未生成";
    }

    function gatePresentation(runtime) {
        var gate = runtime.writeGate || {};
        if (gate.checking === true || gate.state === "checking") {
            return {text: "后台检查中", accent: C.orange};
        }
        if (gate.readyForExplicitDryRun === true) {
            return {text: "可进入干运行", accent: C.green};
        }
        if (gate.endpointValidated === true &&
                gate.writeCapabilitiesDiscovered === true) {
            return {text: "等待干运行", accent: C.blue};
        }
        if (gate.endpointValidated === true) {
            return {text: "端点已校验", accent: C.blue};
        }
        if (gate.endpointExists === true) {
            return {text: "需要复核", accent: C.orange};
        }
        return {text: "端点缺失", accent: C.coral};
    }

    function buildHero(controller) {
        var runtime = SBH.runtime.status();
        var gateState = gatePresentation(runtime);
        var shell = new FrameLayout(SBH.ctx);
        var body = W.column();
        var head = W.row();
        var circle = new FrameLayout(SBH.ctx);
        var statusBox = W.column();
        var statusRow = W.row();
        var dot = new P.android.view.View(SBH.ctx);
        var title;
        var description;
        var accent;
        var soft;
        var actions = W.row();
        var actionShell = new FrameLayout(SBH.ctx);
        var components = runtime.components || {};

        if (runtime.checking) {
            title = "Runtime 后台检查中";
            description = "界面保持可操作，状态完成后自动更新";
            accent = C.orange;
            soft = C.orangeSoft;
        } else if (runtime.coreRunning) {
            title = "Runtime 运行中";
            description = "只读握手正常，sing-box PID " +
                String(runtime.corePid);
            accent = C.green;
            soft = C.greenSoft;
        } else if (runtime.attached) {
            title = "Runtime 已只读接入";
            description = "生产组件已发现，写操作保持锁定";
            accent = C.blue;
            soft = C.blueSoft;
        } else if (runtime.rootGranted) {
            title = "Runtime 接入不完整";
            description = "Shell 权限正常，但关键生产组件缺失";
            accent = C.orange;
            soft = C.orangeSoft;
        } else {
            title = "Runtime 状态不可用";
            description = runtime.error ?
                String(runtime.error) :
                "ShortX Shell 状态读取失败";
            accent = C.coral;
            soft = C.coralSoft;
        }

        shell.setBackground(
            SBH.theme.gradient(
                ["#F1FAF6", "#F4F7FB", "#FBF7F1"],
                24,
                "#E3EAE6"
            )
        );
        shell.addView(W.artView(false), W.fp(W.MATCH, W.MATCH));
        body.setPadding(
            SBH.util.dp(18),
            SBH.util.dp(18),
            SBH.util.dp(18),
            SBH.util.dp(16)
        );

        circle.setBackground(SBH.theme.rounded(soft, 50, soft, 1));
        circle.addView(
            W.icon(runtime.coreRunning ? "shield" : "box", 54, accent),
            W.fp(W.MATCH, W.MATCH, Gravity.CENTER)
        );
        head.addView(
            circle,
            W.lp(SBH.util.dp(74), SBH.util.dp(74))
        );

        statusBox.setPadding(SBH.util.dp(14), SBH.util.dp(4), 0, 0);
        dot.setBackground(SBH.theme.rounded(accent, 9, C.clear, 0));
        statusRow.addView(
            dot,
            W.lp(SBH.util.dp(10), SBH.util.dp(10))
        );
        statusRow.addView(
            W.text(title, 21, accent, true),
            W.margins(W.lp(W.WRAP, W.WRAP), 8, 0, 0, 0)
        );
        statusBox.addView(statusRow);
        description = W.text(description, 13, C.secondary, false);
        description.setPadding(0, SBH.util.dp(8), 0, 0);
        statusBox.addView(description);
        head.addView(statusBox, W.lp(0, W.WRAP, 1));
        head.addView(
            W.label(
                runtime.checking ? "异步检查" :
                    (runtime.attached ? "只读握手" : "等待接入"),
                runtime.checking ? C.orange :
                    (runtime.attached ? C.green : C.orange),
                runtime.checking ? C.orangeSoft :
                    (runtime.attached ? C.greenSoft : C.orangeSoft)
            )
        );
        body.addView(head);

        body.addView(
            infoLine(
                "settings",
                "生产控制器",
                runtime.checking ? "检查中" :
                    componentText(components.controller),
                runtime.checking ? C.orange :
                    (components.controller ? C.green : C.coral)
            )
        );
        body.addView(
            infoLine(
                "box",
                "sing-box Core",
                runtime.checking ? "检查中" :
                    (runtime.coreRunning ? "运行中" :
                        componentText(components.coreBinary)),
                runtime.checking ? C.orange :
                    (runtime.coreRunning ? C.green : C.blue)
            )
        );
        body.addView(
            infoLine(
                "magic",
                "Runtime 控制端点",
                endpointText(runtime),
                runtime.checking ? C.orange :
                    (components.controlEndpoint ? C.green : C.orange)
            )
        );
        body.addView(
            infoLine(
                "shield",
                "写操作门禁",
                gateState.text,
                gateState.accent
            )
        );

        actions.setGravity(Gravity.CENTER);
        actions.addView(
            W.button(
                "握手",
                "shield",
                C.green,
                C.greenSoft,
                function () {
                    requestAsync(controller, "runtime.handshake");
                }
            ),
            W.lp(0, SBH.util.dp(48), 1)
        );
        actions.addView(
            W.button(
                "门禁",
                "check",
                C.blue,
                C.blueSoft,
                function () {
                    requestAsync(controller, "runtime.write_gate");
                }
            ),
            W.margins(W.lp(0, SBH.util.dp(48), 1), 8, 0, 8, 0)
        );
        actions.addView(
            W.button(
                "刷新",
                "reload",
                C.blue,
                C.blueSoft,
                function () {
                    refreshAsync(controller);
                }
            ),
            W.lp(0, SBH.util.dp(48), 1)
        );

        actionShell.setPadding(
            SBH.util.dp(5),
            SBH.util.dp(5),
            SBH.util.dp(5),
            SBH.util.dp(5)
        );
        actionShell.setBackground(
            SBH.theme.rounded("#F9FBFC", 17, "#E4E9EF", 1)
        );
        actionShell.addView(actions);
        body.addView(actionShell, W.lp(W.MATCH, SBH.util.dp(60)));
        shell.addView(body, W.fp(W.MATCH, W.MATCH));
        shell.setLayoutParams(W.lp(W.MATCH, SBH.util.dp(356)));
        return shell;
    }

    function build(controller) {
        var page = originalHome(controller);
        var content;
        if (page !== null && page !== undefined && page.getChildCount() > 0) {
            content = page.getChildAt(0);
            if (content !== null && content.getChildCount() > 0) {
                content.removeViewAt(0);
                content.addView(buildHero(controller), 0);
            }
        }
        return page;
    }

    if (typeof originalHome !== "function") {
        throw new Error("Original home page factory unavailable");
    }
    SBH.navigation.register(0, build);
}());
