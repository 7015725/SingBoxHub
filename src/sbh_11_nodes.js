/* SingBoxHub node list module. Rhino ES5 only. */
SBH.versions.nodes = 1;

(function () {
    var C = SBH.theme.colors;
    var W = SBH.widgets;
    var Gravity = Packages.android.view.Gravity;

    var data = [
        ["JP", "日本 / 东京 01", "主力节点订阅", "Shadowsocks", "23 ms", C.purple, C.purpleSoft],
        ["SG", "新加坡 / SG 02", "主力节点订阅", "VLESS", "38 ms", C.blue, C.blueSoft],
        ["US", "美国 / 洛杉矶 03", "主力节点订阅", "Trojan", "62 ms", C.coral, C.coralSoft],
        ["DE", "德国 / 法兰克福 01", "备用节点订阅", "Shadowsocks", "86 ms", C.purple, C.purpleSoft],
        ["HK", "香港 / HK 04", "备用节点订阅", "VLESS", "31 ms", C.blue, C.blueSoft],
        ["TW", "台湾 / 台北 02", "备用节点订阅", "Hysteria2", "41 ms", C.cyan, C.cyanSoft]
    ];

    function rowView(controller, index, item) {
        var selected = Number(SBH.state.selectedNode || 0) === index;
        var row = W.row();
        var flag = W.text(item[0], 12, C.navy, true);
        var details = W.column();
        var meta = W.row();
        var end = W.column();
        var check;

        row.setPadding(
            SBH.util.dp(10),
            SBH.util.dp(10),
            SBH.util.dp(10),
            SBH.util.dp(10)
        );
        row.setBackground(
            SBH.theme.rounded(
                selected ? "#F0F8F4" : C.surface,
                0,
                C.clear,
                0
            )
        );

        flag.setGravity(Gravity.CENTER);
        flag.setBackground(SBH.theme.rounded(C.surface, 8, C.line, 1));
        row.addView(flag, W.lp(SBH.util.dp(38), SBH.util.dp(38)));

        details.setPadding(SBH.util.dp(10), 0, 0, 0);
        details.addView(W.text(item[1], 14.2, C.navy, true));
        meta.setPadding(0, SBH.util.dp(6), 0, 0);
        meta.addView(W.text(item[2], 10.8, C.secondary, false));
        meta.addView(
            W.label(item[3], item[5], item[6]),
            W.margins(W.lp(W.WRAP, SBH.util.dp(26)), 7, 0, 0, 0)
        );
        details.addView(meta);
        row.addView(details, W.lp(0, W.WRAP, 1));

        end.setGravity(Gravity.RIGHT);
        end.addView(W.text(item[4], 12.5, C.green, true));
        check = W.text(selected ? "✓" : "○", 19, selected ? C.green : C.secondary, true);
        check.setGravity(Gravity.RIGHT);
        check.setPadding(0, SBH.util.dp(7), 0, 0);
        end.addView(check);
        row.addView(end, W.lp(SBH.util.dp(70), W.WRAP));

        W.click(row, function () {
            SBH.state.selectedNode = index;
            SBH.database.put("selected_node", String(index));
            controller.showPage(1);
        });
        return row;
    }

    function buildList(controller) {
        var card = W.card(18);
        var i;
        for (i = 0; i < data.length; i += 1) {
            card.addView(rowView(controller, i, data[i]));
            if (i < data.length - 1) {
                card.addView(W.divider(false));
            }
        }
        return card;
    }

    SBH.state.selectedNode = Number(
        SBH.database.get("selected_node", "0")
    );

    SBH.nodes = {
        data: data,
        buildList: buildList
    };
}());
