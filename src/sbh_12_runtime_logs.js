/* SingBoxHub runtime log page module. Rhino ES5 only. */
SBH.versions.runtimeLogs = 1;

(function () {
    var C = SBH.theme.colors;
    var W = SBH.widgets;
    var EditText = Packages.android.widget.EditText;
    var InputType = Packages.android.text.InputType;
    var Color = Packages.android.graphics.Color;
    var Switch = Packages.android.widget.Switch;
    var LinearLayout = Packages.android.widget.LinearLayout;

    function accentFor(level) {
        if (level === "OK") {
            return [C.green, C.greenSoft];
        }
        if (level === "WARN") {
            return [C.orange, C.orangeSoft];
        }
        if (level === "ERROR") {
            return [C.coral, C.coralSoft];
        }
        return [C.blue, C.blueSoft];
    }

    function timeText(at) {
        var date = new Date(Number(at));
        function pad(value, width) {
            var text = String(value);
            while (text.length < width) {
                text = "0" + text;
            }
            return text;
        }
        return pad(date.getHours(), 2) + ":" +
            pad(date.getMinutes(), 2) + ":" +
            pad(date.getSeconds(), 2) + "." +
            pad(date.getMilliseconds(), 3);
    }

    function logRow(item) {
        var colors = accentFor(item.level);
        var row = W.row();
        var middle = W.column();
        row.setPadding(
            SBH.util.dp(9),
            SBH.util.dp(8),
            SBH.util.dp(9),
            SBH.util.dp(8)
        );
        row.addView(
            W.text(timeText(item.at), 10.5, C.secondary, false),
            W.lp(SBH.util.dp(82), W.WRAP)
        );
        row.addView(
            W.label(item.level, colors[0], colors[1]),
            W.lp(SBH.util.dp(66), SBH.util.dp(27))
        );
        middle.setPadding(SBH.util.dp(8), 0, 0, 0);
        middle.addView(W.text(item.message, 11.7, C.text, false));
        middle.addView(W.text(item.module, 10.2, C.secondary, false));
        row.addView(middle, W.lp(0, W.WRAP, 1));
        return row;
    }

    function metric(title, value, note, accent) {
        var box = W.column();
        var a = W.text(title, 10.3, C.secondary, false);
        var b = W.text(value, 14.5, accent, true);
        var c = W.text(note, 9.8, C.secondary, false);
        a.setGravity(Packages.android.view.Gravity.CENTER);
        b.setGravity(Packages.android.view.Gravity.CENTER);
        c.setGravity(Packages.android.view.Gravity.CENTER);
        b.setPadding(0, SBH.util.dp(5), 0, 0);
        c.setPadding(0, SBH.util.dp(3), 0, 0);
        box.addView(a);
        box.addView(b);
        box.addView(c);
        return box;
    }

    function build(controller) {
        var page = W.scrollPage();
        var titleRow = W.row();
        var summary = W.card(18);
        var logCard = W.card(18);
        var controls = W.row();
        var searchShell = W.row();
        var search = new EditText(SBH.ctx);
        var list = W.column();
        var logs = SBH.log.list();
        var footer = W.row();
        var autoScroll = new Switch(SBH.ctx);
        var actions = W.card(18);
        var i;

        titleRow.addView(W.text("运行日志", 25, C.navy, true));
        titleRow.addView(
            W.label("本地实时", C.green, C.greenSoft),
            W.margins(W.lp(W.WRAP, SBH.util.dp(29)), 12, 0, 0, 0)
        );
        page.content.addView(titleRow);

        summary.setOrientation(LinearLayout.HORIZONTAL);
        summary.setPadding(
            SBH.util.dp(6),
            SBH.util.dp(15),
            SBH.util.dp(6),
            SBH.util.dp(15)
        );
        summary.addView(metric("当前状态", "未连接", "安全占位", C.orange), W.lp(0, W.WRAP, 1));
        summary.addView(W.divider(true), W.lp(SBH.util.dp(1), SBH.util.dp(78)));
        summary.addView(metric("模块版本", SBH.bootstrap.moduleSetVersion, "本地集", C.blue), W.lp(0, W.WRAP, 1));
        summary.addView(W.divider(true), W.lp(SBH.util.dp(1), SBH.util.dp(78)));
        summary.addView(metric("日志条目", String(logs.length), "内存日志", C.purple), W.lp(0, W.WRAP, 1));
        summary.addView(W.divider(true), W.lp(SBH.util.dp(1), SBH.util.dp(78)));
        summary.addView(metric("路由表", "20240", "未操作", C.orange), W.lp(0, W.WRAP, 1));
        page.content.addView(
            summary,
            W.margins(W.lp(W.MATCH, W.WRAP), 0, 16, 0, 0)
        );

        logCard.setPadding(
            SBH.util.dp(10),
            SBH.util.dp(10),
            SBH.util.dp(10),
            SBH.util.dp(10)
        );
        controls.addView(
            W.label("全部级别", C.blue, C.blueSoft),
            W.lp(SBH.util.dp(112), SBH.util.dp(40))
        );

        searchShell.setBackground(
            SBH.theme.rounded(C.surfaceAlt, 12, C.line, 1)
        );
        searchShell.setPadding(
            SBH.util.dp(9),
            0,
            SBH.util.dp(7),
            0
        );
        search.setHint("搜索日志内容");
        search.setHintTextColor(SBH.util.color("#A4ACBA"));
        search.setTextColor(SBH.util.color(C.text));
        search.setTextSize(12.5);
        search.setSingleLine(true);
        search.setInputType(InputType.TYPE_CLASS_TEXT);
        search.setBackgroundColor(Color.TRANSPARENT);
        searchShell.addView(search, W.lp(0, SBH.util.dp(42), 1));
        searchShell.addView(W.icon("search", 21, C.secondary));
        controls.addView(
            searchShell,
            W.margins(W.lp(0, SBH.util.dp(42), 1), 8, 0, 8, 0)
        );
        controls.addView(
            W.button("刷新", "reload", C.text, C.surface, function () {
                controller.showPage(2);
            }),
            W.lp(SBH.util.dp(80), SBH.util.dp(42))
        );
        logCard.addView(controls);

        list.setBackground(SBH.theme.rounded("#FBFCFD", 14, C.line, 1));
        for (i = Math.max(0, logs.length - 30); i < logs.length; i += 1) {
            list.addView(logRow(logs[i]));
            if (i < logs.length - 1) {
                list.addView(W.divider(false));
            }
        }
        logCard.addView(
            list,
            W.margins(W.lp(W.MATCH, W.WRAP), 0, 10, 0, 0)
        );

        footer.setPadding(
            SBH.util.dp(6),
            SBH.util.dp(10),
            SBH.util.dp(6),
            0
        );
        footer.addView(
            W.text("显示最近 " + Math.min(30, logs.length) + " 条", 11, C.secondary, false),
            W.lp(0, W.WRAP, 1)
        );
        footer.addView(W.text("自动滚动", 11.5, C.text, false));
        autoScroll.setChecked(true);
        footer.addView(autoScroll, W.lp(SBH.util.dp(52), SBH.util.dp(38)));
        logCard.addView(footer);
        page.content.addView(
            logCard,
            W.margins(W.lp(W.MATCH, W.WRAP), 0, 14, 0, 0)
        );

        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setPadding(
            SBH.util.dp(10),
            SBH.util.dp(10),
            SBH.util.dp(10),
            SBH.util.dp(10)
        );
        actions.addView(
            W.button("导出日志", "logs", C.green, C.greenSoft, function () {
                SBH.util.toast("日志导出将在文件模块阶段接入");
            }),
            W.lp(0, SBH.util.dp(52), 1)
        );
        actions.addView(
            W.button("诊断", "shield", C.purple, C.purpleSoft, function () {
                SBH.util.toast("Runtime 诊断接口待接入");
            }),
            W.margins(W.lp(0, SBH.util.dp(52), 1), 8, 0, 0, 0)
        );
        page.content.addView(actions);
        return page.view;
    }

    SBH.navigation.register(2, build);
}());
