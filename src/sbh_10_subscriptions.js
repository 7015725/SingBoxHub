/* SingBoxHub subscription page module. Rhino ES5 only. */
SBH.versions.subscriptions = 1;

(function () {
    var C = SBH.theme.colors;
    var W = SBH.widgets;
    var EditText = Packages.android.widget.EditText;
    var InputType = Packages.android.text.InputType;
    var Color = Packages.android.graphics.Color;

    function chip(title, selected, accent) {
        var view = W.text(
            title,
            12.2,
            selected ? C.white : C.secondary,
            selected
        );
        view.setGravity(Packages.android.view.Gravity.CENTER);
        view.setPadding(
            SBH.util.dp(13),
            SBH.util.dp(8),
            SBH.util.dp(13),
            SBH.util.dp(8)
        );
        view.setBackground(
            SBH.theme.rounded(
                selected ? accent : C.surface,
                13,
                selected ? accent : C.line,
                1
            )
        );
        return view;
    }

    function subscriptionCard(accent, soft, name, status, host, updated, count) {
        var card = W.card(18);
        var head = W.row();
        var title;
        var hostView;
        var line;
        var actions = W.row();

        card.setPadding(
            SBH.util.dp(13),
            SBH.util.dp(13),
            SBH.util.dp(13),
            SBH.util.dp(12)
        );
        head.addView(W.icon("cloud", 42, accent));
        head.addView(W.label(status, accent, soft));
        card.addView(head);
        title = W.text(name, 16.5, C.navy, true);
        title.setPadding(0, SBH.util.dp(10), 0, 0);
        card.addView(title);
        hostView = W.text(host, 11.3, C.secondary, false);
        hostView.setPadding(0, SBH.util.dp(5), 0, 0);
        card.addView(hostView);

        line = W.row();
        line.setPadding(0, SBH.util.dp(11), 0, 0);
        line.addView(W.text("更新时间", 11.3, C.secondary, false), W.lp(0, W.WRAP, 1));
        line.addView(W.text(updated, 11.3, C.text, false));
        card.addView(line);

        line = W.row();
        line.setPadding(0, SBH.util.dp(7), 0, SBH.util.dp(10));
        line.addView(W.text("节点数量", 11.3, C.secondary, false), W.lp(0, W.WRAP, 1));
        line.addView(W.text(count, 11.3, C.text, false));
        card.addView(line);

        actions.addView(
            W.button("更新", "reload", C.green, C.greenSoft, function () {
                SBH.util.toast("Runtime 未连接, 未执行更新");
            }),
            W.lp(0, SBH.util.dp(37), 1)
        );
        actions.addView(
            W.button("测试延迟", "clock", C.purple, C.purpleSoft, function () {
                SBH.util.toast("延迟测试接口待接入");
            }),
            W.margins(W.lp(0, SBH.util.dp(37), 1), 6, 0, 0, 0)
        );
        card.addView(actions);
        return card;
    }

    function build(controller) {
        var page = W.scrollPage();
        var segments = W.row();
        var subScroll = W.horizontal();
        var subs = W.row();
        var searchRow = W.row();
        var searchShell = W.row();
        var search = new EditText(SBH.ctx);
        var chipScroll = W.horizontal();
        var chips = W.row();
        var titles = ["全部 128", "延迟排序", "协议", "分组", "收藏", "可用"];
        var i;
        var nodeCard;

        page.content.addView(
            W.section("节点与订阅", "管理订阅源与节点, 选择最优线路")
        );

        segments.setPadding(0, SBH.util.dp(14), 0, SBH.util.dp(8));
        segments.addView(chip("订阅", true, C.green), W.lp(0, SBH.util.dp(42), 1));
        segments.addView(chip("节点", false, C.green), W.margins(W.lp(0, SBH.util.dp(42), 1), 8, 0, 8, 0));
        segments.addView(chip("分组", false, C.green), W.lp(0, SBH.util.dp(42), 1));
        page.content.addView(segments);

        subs.setPadding(0, SBH.util.dp(6), SBH.util.dp(4), SBH.util.dp(2));
        subs.addView(
            subscriptionCard(
                C.green,
                C.greenSoft,
                "主力节点订阅",
                "已启用",
                "sub.main.example.com",
                "今天 08:35",
                "128"
            ),
            W.margins(W.lp(SBH.util.dp(256), SBH.util.dp(240)), 0, 0, 12, 0)
        );
        subs.addView(
            subscriptionCard(
                C.purple,
                C.purpleSoft,
                "备用节点订阅",
                "备用",
                "sub.backup.example.com",
                "昨天 22:10",
                "86"
            ),
            W.margins(W.lp(SBH.util.dp(256), SBH.util.dp(240)), 0, 0, 12, 0)
        );
        subs.addView(
            subscriptionCard(
                C.orange,
                C.orangeSoft,
                "实验性节点订阅",
                "已禁用",
                "sub.exp.example.com",
                "05-10 14:20",
                "42"
            ),
            W.lp(SBH.util.dp(256), SBH.util.dp(240))
        );
        subScroll.addView(subs, W.fp(W.WRAP, W.WRAP));
        page.content.addView(subScroll, W.lp(W.MATCH, SBH.util.dp(252)));

        searchShell.setPadding(
            SBH.util.dp(12),
            0,
            SBH.util.dp(8),
            0
        );
        searchShell.setBackground(
            SBH.theme.rounded(C.surface, 14, C.line, 1)
        );
        searchShell.addView(W.icon("search", 24, C.secondary));
        search.setTextSize(13.5);
        search.setHint("搜索节点名称 / 国家 / 备注");
        search.setHintTextColor(SBH.util.color("#A4ACBA"));
        search.setTextColor(SBH.util.color(C.text));
        search.setSingleLine(true);
        search.setInputType(InputType.TYPE_CLASS_TEXT);
        search.setBackgroundColor(Color.TRANSPARENT);
        search.setPadding(SBH.util.dp(8), 0, 0, 0);
        searchShell.addView(search, W.lp(0, SBH.util.dp(52), 1));
        searchRow.addView(searchShell, W.lp(0, SBH.util.dp(52), 1));
        searchRow.addView(
            W.button("筛选", "filter", C.text, C.surface, function () {
                SBH.util.toast("筛选面板将在下一阶段接入");
            }),
            W.margins(W.lp(SBH.util.dp(92), SBH.util.dp(52)), 10, 0, 0, 0)
        );
        page.content.addView(searchRow);

        chips.setPadding(0, SBH.util.dp(12), SBH.util.dp(4), SBH.util.dp(12));
        for (i = 0; i < titles.length; i += 1) {
            chips.addView(
                chip(titles[i], i === 0, i === 0 ? C.green : C.blue),
                W.margins(W.lp(W.WRAP, SBH.util.dp(40)), 0, 0, 8, 0)
            );
        }
        chipScroll.addView(chips, W.fp(W.WRAP, W.WRAP));
        page.content.addView(chipScroll, W.lp(W.MATCH, SBH.util.dp(64)));

        nodeCard = SBH.nodes.buildList(controller);
        page.content.addView(nodeCard);
        return page.view;
    }

    SBH.navigation.register(1, build);
}());
