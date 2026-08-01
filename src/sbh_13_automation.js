/* SingBoxHub automation and settings page module. Rhino ES5 only. */
SBH.versions.automation = 1;

(function () {
    var C = SBH.theme.colors;
    var W = SBH.widgets;
    var Switch = Packages.android.widget.Switch;
    var FrameLayout = Packages.android.widget.FrameLayout;
    var Gravity = Packages.android.view.Gravity;

    function switchRow(iconName, accent, soft, title, subtitle, key, defaultValue) {
        var row = W.row();
        var iconBox = new FrameLayout(SBH.ctx);
        var content = W.column();
        var toggle = new Switch(SBH.ctx);

        row.setPadding(
            SBH.util.dp(12),
            SBH.util.dp(10),
            SBH.util.dp(8),
            SBH.util.dp(10)
        );
        iconBox.setBackground(SBH.theme.gradient([soft, C.white], 13, soft));
        iconBox.addView(
            W.icon(iconName, 34, accent),
            W.fp(W.MATCH, W.MATCH, Gravity.CENTER)
        );
        row.addView(iconBox, W.lp(SBH.util.dp(42), SBH.util.dp(42)));

        content.setPadding(SBH.util.dp(10), 0, 0, 0);
        content.addView(W.text(title, 14.2, C.navy, true));
        content.addView(W.text(subtitle, 10.8, C.secondary, false));
        row.addView(content, W.lp(0, W.WRAP, 1));

        toggle.setChecked(SBH.database.getBoolean(key, defaultValue));
        toggle.setOnCheckedChangeListener(new JavaAdapter(
            Packages.android.widget.CompoundButton.OnCheckedChangeListener,
            {
                onCheckedChanged: function (button, checked) {
                    SBH.database.putBoolean(key, checked);
                    SBH.log.info("settings", key + "=" + checked);
                }
            }
        ));
        row.addView(toggle, W.lp(SBH.util.dp(56), SBH.util.dp(42)));
        return row;
    }

    function taskCard() {
        var card = W.card(20);
        var shell = new FrameLayout(SBH.ctx);
        var body = W.column();
        var top = W.row();

        shell.setBackground(
            SBH.theme.gradient(
                ["#F3F0FA", "#EFF6FA", "#F5F8F3"],
                20,
                C.line
            )
        );
        shell.addView(W.artView(true), W.fp(W.MATCH, W.MATCH));
        body.setPadding(
            SBH.util.dp(16),
            SBH.util.dp(16),
            SBH.util.dp(16),
            SBH.util.dp(16)
        );
        top.addView(W.icon("magic", 48, C.purple));
        top.addView(
            W.text("ShortX JS Task", 18, C.navy, true),
            W.margins(W.lp(0, W.WRAP, 1), 10, 0, 0, 0)
        );
        top.addView(W.label("就绪", C.green, C.greenSoft));
        body.addView(top);
        body.addView(
            W.text("执行引擎: Rhino ES5", 12.2, C.secondary, false),
            W.margins(W.lp(W.MATCH, W.WRAP), 0, 12, 0, 0)
        );
        body.addView(W.text("触发模式: 事件触发", 12.2, C.secondary, false));
        body.addView(W.text("Runtime: 尚未附加", 12.2, C.orange, true));
        shell.addView(body, W.fp(W.MATCH, W.MATCH));
        card.addView(shell, W.lp(W.MATCH, SBH.util.dp(164)));
        return card;
    }

    function listCard(rows) {
        var card = W.card(18);
        var i;
        for (i = 0; i < rows.length; i += 1) {
            card.addView(rows[i]);
            if (i < rows.length - 1) {
                card.addView(W.divider(false));
            }
        }
        return card;
    }

    function build(controller) {
        var page = W.scrollPage();
        var tasks;
        var settings;

        page.content.addView(
            W.section(
                "自动化与设置",
                "管理 ShortX JS 任务与运行时设置"
            )
        );
        page.content.addView(
            taskCard(),
            W.margins(W.lp(W.MATCH, W.WRAP), 0, 14, 0, 0)
        );

        tasks = listCard([
            switchRow("shield", C.green, C.greenSoft, "启动前校验", "每次启动前执行", "task_precheck", true),
            switchRow("cloud", C.purple, C.purpleSoft, "配置备份", "每日 02:00 自动备份", "task_backup", true),
            switchRow("reload", C.orange, C.orangeSoft, "失败回滚", "执行失败时触发", "task_rollback", true),
            switchRow("clock", C.blue, C.blueSoft, "健康检查", "每 30 分钟执行", "task_health", false)
        ]);
        page.content.addView(
            tasks,
            W.margins(W.lp(W.MATCH, W.WRAP), 0, 14, 0, 0)
        );

        settings = listCard([
            switchRow("box", C.blue, C.blueSoft, "动态 dp 布局", "根据 density 和可用窗口计算", "setting_dynamic_dp", true),
            switchRow("magic", C.purple, C.purpleSoft, "IME 避让", "使用 ADJUST_RESIZE", "setting_ime", true),
            switchRow("settings", C.cyan, C.cyanSoft, "几何信息记忆", "SQLite 持久化窗口状态", "setting_geometry", true),
            switchRow("pause", C.green, C.greenSoft, "Canvas 无变化停帧", "仅重绘状态变化区域", "setting_canvas_idle", true),
            switchRow("route", C.orange, C.orangeSoft, "系统返回链", "二级页返回首页, 首页隐藏", "setting_back_chain", true),
            switchRow("shield", C.green, C.greenSoft, "UI 与 Runtime 分离", "关闭 UI 不停止核心", "setting_runtime_split", true)
        ]);
        page.content.addView(settings);
        return page.view;
    }

    SBH.navigation.register(3, build);
}());
