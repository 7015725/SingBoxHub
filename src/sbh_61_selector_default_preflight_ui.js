/* SingBoxHub Stage45 selector default-node UI. Rhino ES5 only. */
SBH.versions.selectorDefaultPreflightUi = 1;

(function () {
    "use strict";

    var C = SBH.theme.colors;
    var W = SBH.widgets;
    var service = SBH.selectorDefaultPreflight;
    var originalFactory = SBH.navigation.pages[1];
    var originalStart = SBH.app.start;

    function findSelectedIndex(nodes) {
        var index;
        for (index = 0; index < nodes.length; index += 1) {
            if (nodes[index].selected === true) {
                return index;
            }
        }
        return nodes.length > 0 ? 0 : -1;
    }

    function displayName(item, index) {
        return String(
            item.name ||
            (item.protocol + " 节点 " +
                String(index + 1))
        );
    }

    function buildCard() {
        var nodes = service.listNodes();
        var selectedIndex = findSelectedIndex(nodes);
        var previewIndex = selectedIndex;
        var card = W.card(17);
        var title = W.text(
            "默认节点与 selector 预检",
            17,
            C.navy,
            true
        );
        var note = W.text(
            "默认节点仅保存为客户端 SQLite 节点键。" +
            "预检会临时加入 selector outbound 并执行 sing-box check，" +
            "不会写入生产配置。",
            11.4,
            C.secondary,
            false
        );
        var selectedText = W.text(
            "默认节点：读取中",
            11.8,
            C.green,
            true
        );
        var previewTitle = W.text(
            "",
            14,
            C.navy,
            true
        );
        var previewMeta = W.text(
            "",
            10.8,
            C.secondary,
            false
        );
        var moveRow1 = W.row();
        var moveRow2 = W.row();
        var resultText = W.text(
            "",
            10.3,
            C.secondary,
            false
        );

        function refresh() {
            var selected;
            var preview;

            if (nodes.length <= 0) {
                selectedText.setText(
                    "默认节点：无可用节点"
                );
                selectedText.setTextColor(
                    SBH.util.color(C.orange)
                );
                previewTitle.setText(
                    "没有已加密节点"
                );
                previewMeta.setText("");
                return;
            }

            selected = selectedIndex >= 0 ?
                nodes[selectedIndex] : null;
            preview = nodes[previewIndex];

            selectedText.setText(
                selected === null ?
                    "默认节点：未选择" :
                    "默认节点：" +
                    displayName(
                        selected,
                        selectedIndex
                    )
            );
            previewTitle.setText(
                "候选 " +
                String(previewIndex + 1) +
                "/" + String(nodes.length) +
                " · " +
                displayName(
                    preview,
                    previewIndex
                )
            );
            previewMeta.setText(
                String(preview.protocol) +
                " · " +
                String(
                    preview.subscriptionName ||
                    ("订阅 #" +
                        preview.subscriptionId)
                )
            );
        }

        function move(delta) {
            if (nodes.length <= 0) {
                return;
            }
            previewIndex =
                (previewIndex + delta) % nodes.length;
            if (previewIndex < 0) {
                previewIndex += nodes.length;
            }
            refresh();
        }

        function saveSelection() {
            var selected;

            if (nodes.length <= 0) {
                throw new Error(
                    "没有可选择的节点"
                );
            }
            selected = service.selectDefaultNode(
                nodes[previewIndex].nodeKey
            );
            selectedIndex = previewIndex;
            nodes[selectedIndex] = selected;
            refresh();
            SBH.util.toast("默认节点已保存");
            return selected;
        }

        function runCheck() {
            var selected = saveSelection();

            resultText.setText(
                "正在使用“" +
                displayName(
                    selected,
                    selectedIndex
                ) +
                "”作为 selector 默认节点，" +
                "并执行临时 sing-box check。"
            );
            SBH.util.toast(
                "正在运行 selector 配置预检"
            );
            service.selectorCheckAsync(function (result) {
                resultText.setText(
                    JSON.stringify(result, null, 2)
                );
                SBH.util.toast(
                    result.ok === true &&
                    result.singBoxCheckPassed === true &&
                    result.selectorDefaultMatched === true ?
                        "selector 配置预检通过" :
                        "selector 配置预检存在待处理项"
                );
            });
        }

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
        card.addView(selectedText);

        previewTitle.setPadding(
            0,
            SBH.util.dp(12),
            0,
            0
        );
        card.addView(previewTitle);
        previewMeta.setPadding(
            0,
            SBH.util.dp(5),
            0,
            SBH.util.dp(9)
        );
        card.addView(previewMeta);

        moveRow1.addView(
            W.button(
                "上一个",
                "more",
                C.blue,
                C.blueSoft,
                function () {
                    move(-1);
                }
            ),
            W.lp(0, SBH.util.dp(42), 1)
        );
        moveRow1.addView(
            W.button(
                "下一个",
                "more",
                C.blue,
                C.blueSoft,
                function () {
                    move(1);
                }
            ),
            W.margins(
                W.lp(0, SBH.util.dp(42), 1),
                8,
                0,
                0,
                0
            )
        );
        card.addView(moveRow1);

        moveRow2.setPadding(
            0,
            SBH.util.dp(8),
            0,
            0
        );
        moveRow2.addView(
            W.button(
                "前 10 个",
                "list",
                C.purple,
                C.purpleSoft,
                function () {
                    move(-10);
                }
            ),
            W.lp(0, SBH.util.dp(42), 1)
        );
        moveRow2.addView(
            W.button(
                "后 10 个",
                "list",
                C.purple,
                C.purpleSoft,
                function () {
                    move(10);
                }
            ),
            W.margins(
                W.lp(0, SBH.util.dp(42), 1),
                8,
                0,
                0,
                0
            )
        );
        card.addView(moveRow2);

        card.addView(
            W.button(
                "设为默认节点",
                "star",
                C.green,
                C.greenSoft,
                saveSelection
            ),
            W.margins(
                W.lp(W.MATCH, SBH.util.dp(44)),
                0,
                10,
                0,
                0
            )
        );

        resultText.setPadding(
            0,
            SBH.util.dp(10),
            0,
            0
        );
        resultText.setTextIsSelectable(true);
        card.addView(resultText);
        card.addView(
            W.button(
                "运行 selector 配置预检",
                "check",
                C.blue,
                C.blueSoft,
                runCheck
            ),
            W.margins(
                W.lp(W.MATCH, SBH.util.dp(44)),
                0,
                12,
                0,
                0
            )
        );

        resultText.setText(
            JSON.stringify({
                ready:
                    nodes.length > 0 &&
                    selectedIndex >= 0,
                nodeCount: nodes.length,
                selectedNode:
                    selectedIndex >= 0 ?
                        nodes[selectedIndex] :
                        null,
                selectorTag:
                    service.selectorTag,
                selectorConfigPersisted: false,
                productionConfigModified: false
            }, null, 2)
        );
        refresh();
        return card;
    }

    if (!service ||
            typeof service.listNodes !== "function" ||
            typeof service.selectDefaultNode !== "function" ||
            typeof service.selectorCheckAsync !== "function") {
        throw new Error(
            "Selector default preflight service unavailable"
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
        throw new Error(
            "Original app.start unavailable"
        );
    }

    SBH.app.start = function () {
        var output = originalStart();

        output.selectorDefaultPreflightUiVersion = 1;
        output.selectorDefaultPreflightUiReady = true;
        output.selectorDefaultSelectionUiReady = true;
        output.selectorDefaultSelectionStepControls = [
            -10,
            -1,
            1,
            10
        ];
        output.selectorDefaultSelectionPlaintextDisplayed =
            false;
        output.selectorDefaultCheckButtonReady = true;
        output.selectorDefaultProductionConfigModified =
            false;
        output.writeOperationsLocked = true;
        output.destructiveOperations = false;
        return output;
    };
}());
