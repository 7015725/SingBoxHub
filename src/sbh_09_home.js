/* SingBoxHub home page module. Rhino ES5 only. */
SBH.versions.home = 1;

(function () {
    var C = SBH.theme.colors;
    var W = SBH.widgets;
    var FrameLayout = Packages.android.widget.FrameLayout;
    var LinearLayout = Packages.android.widget.LinearLayout;
    var Gravity = Packages.android.view.Gravity;

    function infoLine(iconName, title, value) {
        var row = W.row();
        var right = W.text(value, 13, C.text, true);
        row.setPadding(0, SBH.util.dp(7), 0, SBH.util.dp(7));
        row.addView(W.icon(iconName, 24, C.secondary));
        row.addView(W.text(title, 12.5, C.secondary, false), W.lp(0, W.WRAP, 1));
        row.addView(right);
        return row;
    }

    function request(command) {
        var result = SBH.runtime.request({
            requestId: "sbh-" + SBH.util.now(),
            command: command,
            expectedState: "unknown",
            arguments: {}
        });
        SBH.log.warn("runtime", result.code + ": " + result.message);
        SBH.util.toast(result.message);
    }

    function hero() {
        var shell = new FrameLayout(SBH.ctx);
        var body = W.column();
        var head = W.row();
        var circle = new FrameLayout(SBH.ctx);
        var status = W.column();
        var statusRow = W.row();
        var dot = new Packages.android.view.View(SBH.ctx);
        var description;
        var actions = W.row();
        var actionShell = new FrameLayout(SBH.ctx);

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

        circle.setBackground(
            SBH.theme.rounded("#ECF7F1", 50, "#CFE7DA", 1)
        );
        circle.addView(
            W.icon("shield", 54, C.green),
            W.fp(W.MATCH, W.MATCH, Gravity.CENTER)
        );
        head.addView(circle, W.lp(SBH.util.dp(74), SBH.util.dp(74)));

        status.setPadding(SBH.util.dp(14), SBH.util.dp(4), 0, 0);
        dot.setBackground(SBH.theme.rounded(C.orange, 9, C.clear, 0));
        statusRow.addView(dot, W.lp(SBH.util.dp(10), SBH.util.dp(10)));
        statusRow.addView(
            W.text("Runtime 未连接", 21, C.orange, true),
            W.margins(W.lp(W.WRAP, W.WRAP), 8, 0, 0, 0)
        );
        status.addView(statusRow);
        description = W.text(
            "当前为安全 UI 原型, 未启用核心操作",
            13,
            C.secondary,
            false
        );
        description.setPadding(0, SBH.util.dp(8), 0, 0);
        status.addView(description);
        head.addView(status, W.lp(0, W.WRAP, 1));
        head.addView(W.label("安全占位", C.green, C.greenSoft));
        body.addView(head);

        body.addView(infoLine("settings", "核心版本", "sing-box 1.13.12"));
        body.addView(infoLine("box", "运行平台", "Android 14 / arm64"));
        body.addView(infoLine("magic", "脚本引擎", "ShortX / Rhino ES5"));

        actions.setGravity(Gravity.CENTER);
        actions.addView(
            W.button("启动", "play", C.green, C.greenSoft, function () {
                request("core.start");
            }),
            W.lp(0, SBH.util.dp(48), 1)
        );
        actions.addView(
            W.button("停止", "stop", C.coral, C.coralSoft, function () {
                request("core.stop");
            }),
            W.margins(W.lp(0, SBH.util.dp(48), 1), 8, 0, 8, 0)
        );
        actions.addView(
            W.button("重载", "reload", C.blue, C.blueSoft, function () {
                request("core.reload");
            }),
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
        shell.setLayoutParams(W.lp(W.MATCH, SBH.util.dp(320)));
        return shell;
    }

    function feature(iconName, accent, soft, title, subtitle, value, fn) {
        var card = W.card(18);
        var titleView;
        var subtitleView;
        var valueView;
        card.setPadding(
            SBH.util.dp(14),
            SBH.util.dp(14),
            SBH.util.dp(14),
            SBH.util.dp(13)
        );
        card.addView(W.icon(iconName, 42, accent));
        titleView = W.text(title, 16, C.navy, true);
        titleView.setPadding(0, SBH.util.dp(10), 0, 0);
        card.addView(titleView);
        subtitleView = W.text(subtitle, 11.5, C.secondary, false);
        subtitleView.setPadding(0, SBH.util.dp(5), 0, 0);
        card.addView(subtitleView);
        valueView = W.text(value, 11.5, accent, true);
        valueView.setPadding(0, SBH.util.dp(9), 0, 0);
        card.addView(valueView);
        W.click(card, fn);
        return card;
    }

    function featureRow(content, left, right) {
        var row = W.row();
        row.addView(left, W.lp(0, SBH.util.dp(150), 1));
        row.addView(
            right,
            W.margins(W.lp(0, SBH.util.dp(150), 1), 10, 0, 0, 0)
        );
        content.addView(
            row,
            W.margins(W.lp(W.MATCH, SBH.util.dp(150)), 0, 12, 0, 0)
        );
    }

    function metric(title, value, note, accent) {
        var box = W.column();
        var titleView = W.text(title, 10.8, C.secondary, false);
        var valueView = W.text(value, 16.5, accent, true);
        var noteView = W.text(note, 10.2, C.secondary, false);
        box.setGravity(Gravity.CENTER);
        titleView.setGravity(Gravity.CENTER);
        valueView.setGravity(Gravity.CENTER);
        noteView.setGravity(Gravity.CENTER);
        valueView.setPadding(0, SBH.util.dp(5), 0, 0);
        noteView.setPadding(0, SBH.util.dp(4), 0, 0);
        box.addView(titleView);
        box.addView(valueView);
        box.addView(noteView);
        return box;
    }

    function build(controller) {
        var page = W.scrollPage();
        var summary = W.card(18);

        page.content.addView(hero());
        featureRow(
            page.content,
            feature(
                "shield",
                C.green,
                C.greenSoft,
                "配置校验",
                "检查配置文件",
                "等待 Runtime",
                function () { request("config.check"); }
            ),
            feature(
                "cloud",
                C.purple,
                C.purpleSoft,
                "订阅管理",
                "管理订阅源",
                "3 个示例订阅",
                function () { controller.showPage(1); }
            )
        );
        featureRow(
            page.content,
            feature(
                "list",
                C.blue,
                C.blueSoft,
                "节点列表",
                "查看节点和延迟",
                "128 个示例节点",
                function () { controller.showPage(1); }
            ),
            feature(
                "route",
                C.orange,
                C.orangeSoft,
                "策略路由",
                "受控路由范围",
                "表 20240",
                function () { request("route.status"); }
            )
        );
        featureRow(
            page.content,
            feature(
                "logs",
                C.blue,
                C.blueSoft,
                "运行日志",
                "查看本地日志",
                "实时记录",
                function () { controller.showPage(2); }
            ),
            feature(
                "magic",
                C.purple,
                C.purpleSoft,
                "自动化任务",
                "ShortX JS 任务",
                "安全占位",
                function () { controller.showPage(3); }
            )
        );

        summary.setOrientation(LinearLayout.HORIZONTAL);
        summary.setPadding(
            SBH.util.dp(8),
            SBH.util.dp(14),
            SBH.util.dp(8),
            SBH.util.dp(14)
        );
        summary.addView(metric("延迟测试", "-- ms", "未执行", C.green), W.lp(0, W.WRAP, 1));
        summary.addView(W.divider(true), W.lp(SBH.util.dp(1), SBH.util.dp(70)));
        summary.addView(metric("路由表", "20240", "受控范围", C.purple), W.lp(0, W.WRAP, 1));
        summary.addView(W.divider(true), W.lp(SBH.util.dp(1), SBH.util.dp(70)));
        summary.addView(metric("规则范围", "8800-8815", "白名单", C.orange), W.lp(0, W.WRAP, 1));
        summary.addView(W.divider(true), W.lp(SBH.util.dp(1), SBH.util.dp(70)));
        summary.addView(metric("备份状态", "待接入", "不伪造", C.green), W.lp(0, W.WRAP, 1));
        page.content.addView(
            summary,
            W.margins(W.lp(W.MATCH, W.WRAP), 0, 12, 0, 0)
        );
        return page.view;
    }

    SBH.navigation.register(0, build);
}());
