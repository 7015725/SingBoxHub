/* SingBoxHub navigation module. Rhino ES5 only. */
SBH.versions.navigation = 1;

(function () {
    var C = SBH.theme.colors;
    var W = SBH.widgets;
    var Gravity = Packages.android.view.Gravity;
    var View = Packages.android.view.View;

    function navItem(controller, index, iconName, title) {
        var selected = controller.page === index;
        var box = W.column();
        var indicator = new View(SBH.ctx);
        var titleView;

        box.setGravity(Gravity.CENTER);
        indicator.setBackground(
            SBH.theme.rounded(
                selected ? C.blue : C.clear,
                2,
                C.clear,
                0
            )
        );
        box.addView(
            indicator,
            W.margins(
                W.lp(SBH.util.dp(50), SBH.util.dp(3)),
                0,
                0,
                0,
                4
            )
        );
        box.addView(
            W.icon(
                iconName,
                28,
                selected ? C.blue : "#6D788A"
            )
        );
        titleView = W.text(
            title,
            11.5,
            selected ? C.blue : "#6D788A",
            selected
        );
        titleView.setGravity(Gravity.CENTER);
        box.addView(titleView);
        W.click(box, function () {
            controller.showPage(index);
        });
        return box;
    }

    function build(controller) {
        var bar = W.row();
        bar.setGravity(Gravity.CENTER);
        bar.setPadding(
            SBH.util.dp(10),
            SBH.util.dp(5),
            SBH.util.dp(10),
            SBH.util.dp(7)
        );
        bar.setBackgroundColor(SBH.util.color(C.surface));
        bar.addView(navItem(controller, 0, "home", "首页"), W.lp(0, W.MATCH, 1));
        bar.addView(navItem(controller, 1, "nodes", "节点"), W.lp(0, W.MATCH, 1));
        bar.addView(navItem(controller, 2, "logs", "日志"), W.lp(0, W.MATCH, 1));
        bar.addView(navItem(controller, 3, "settings", "设置"), W.lp(0, W.MATCH, 1));
        return bar;
    }

    SBH.navigation = {
        pages: {},
        build: build,
        register: function (index, factory) {
            SBH.navigation.pages[Number(index)] = factory;
        }
    };
}());
