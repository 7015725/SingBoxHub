/* SingBoxHub Stage37 subscription CRUD UI. Rhino ES5 only. */
SBH.versions.subscriptionCrudUi = 1;

(function () {
    "use strict";

    var P = Packages;
    var Gravity = P.android.view.Gravity;
    var InputType = P.android.text.InputType;
    var C = SBH.theme.colors;
    var W = SBH.widgets;
    var repository = SBH.subscriptionRepository;
    var originalStart = SBH.app.start;

    function formatTime(value) {
        var formatter;
        if (value === null || value === undefined) {
            return "从未";
        }
        try {
            formatter = new P.java.text.SimpleDateFormat(
                "MM-dd HH:mm",
                P.java.util.Locale.getDefault()
            );
            return String(
                formatter.format(
                    new P.java.util.Date(Number(value))
                )
            );
        } catch (ignored) {
            return String(value);
        }
    }

    function sourceSummary(urlValue) {
        try {
            var uri = new P.java.net.URI(String(urlValue));
            var scheme = String(uri.getScheme() || "");
            var host = String(uri.getHost() || "");
            var path = String(uri.getRawPath() || "/");
            return scheme + "://" + host + path +
                (uri.getRawQuery() !== null ?
                    "?<masked>" : "");
        } catch (ignored) {
            return "<invalid>";
        }
    }

    function inputField(hint, uriMode) {
        var view = W.input(hint);
        if (uriMode) {
            view.setInputType(
                InputType.TYPE_CLASS_TEXT |
                InputType.TYPE_TEXT_VARIATION_URI
            );
        }
        return view;
    }

    function smallButton(
        title,
        icon,
        accent,
        soft,
        action
    ) {
        return W.button(
            title,
            icon,
            accent,
            soft,
            action
        );
    }

    function build(controller) {
        var page = W.scrollPage();
        var editor = W.card(18);
        var editorTitle = W.text(
            "新增订阅记录",
            17,
            C.navy,
            true
        );
        var editorHint = W.text(
            "仅保存到客户端 SQLite，不下载、不写 Runtime",
            11.5,
            C.secondary,
            false
        );
        var nameInput = inputField("订阅名称", false);
        var urlInput = inputField(
            "https://example.com/subscription",
            true
        );
        var remarkInput = inputField("备注（可选）", false);
        var editorActions = W.row();
        var secondaryActions = W.row();
        var previewCard = W.card(16);
        var previewTitle = W.text(
            "只读配置预览",
            15,
            C.navy,
            true
        );
        var previewText = W.text(
            "选择订阅记录后生成脱敏预览。",
            11.2,
            C.secondary,
            false
        );
        var listTitle = W.text(
            "已保存订阅",
            18,
            C.navy,
            true
        );
        var listContainer = W.column();
        var selectedId = null;
        var selectedEnabled = true;
        var rows;
        var i;

        function resetEditor() {
            selectedId = null;
            selectedEnabled = true;
            editorTitle.setText("新增订阅记录");
            nameInput.setText("");
            urlInput.setText("");
            remarkInput.setText("");
            previewText.setText(
                "选择订阅记录后生成脱敏预览。"
            );
            return true;
        }

        function readInput() {
            return {
                name: String(nameInput.getText()),
                url: String(urlInput.getText()),
                remark: String(remarkInput.getText()),
                enabled: selectedEnabled
            };
        }

        function save() {
            var row;
            if (selectedId === null) {
                row = repository.create(readInput());
                SBH.util.toast(
                    "已新增订阅：" + row.name
                );
            } else {
                row = repository.update(
                    selectedId,
                    readInput()
                );
                SBH.util.toast(
                    "已保存订阅：" + row.name
                );
            }
            controller.showPage(1);
        }

        function fillExample() {
            nameInput.setText("示例订阅");
            urlInput.setText(
                "https://example.com/subscription?token=demo"
            );
            remarkInput.setText(
                "本地 CRUD 测试，不会访问网络"
            );
            selectedEnabled = true;
            SBH.util.toast("已填充示例，尚未保存");
        }

        function editRow(row) {
            selectedId = row.id;
            selectedEnabled = row.enabled;
            editorTitle.setText(
                "编辑订阅 #" + row.id
            );
            nameInput.setText(row.name);
            urlInput.setText(row.url);
            remarkInput.setText(row.remark);
            SBH.util.toast(
                "已载入：" + row.name
            );
        }

        function previewRow(row) {
            var value = repository.preview(row.id);
            previewText.setText(
                JSON.stringify(value, null, 2)
            );
            SBH.util.toast(
                "已生成脱敏只读预览"
            );
        }

        function deleteRow(row) {
            if (!repository.remove(row.id)) {
                throw new Error("订阅记录删除失败");
            }
            SBH.util.toast(
                "已删除订阅：" + row.name
            );
            controller.showPage(1);
        }

        function toggleRow(row) {
            var updated = repository.setEnabled(
                row.id,
                !row.enabled
            );
            SBH.util.toast(
                updated.enabled ?
                    "订阅已启用" :
                    "订阅已停用"
            );
            controller.showPage(1);
        }

        function buildCard(row) {
            var card = W.card(17);
            var head = W.row();
            var titleColumn = W.column();
            var title = W.text(
                row.name,
                16,
                C.navy,
                true
            );
            var source = W.text(
                sourceSummary(row.url),
                10.8,
                C.secondary,
                false
            );
            var meta = W.text(
                "更新 " + formatTime(row.updatedAt) +
                " · 节点 " + row.nodeCount,
                10.8,
                C.secondary,
                false
            );
            var actionRow1 = W.row();
            var actionRow2 = W.row();

            card.setPadding(
                SBH.util.dp(13),
                SBH.util.dp(13),
                SBH.util.dp(13),
                SBH.util.dp(13)
            );

            titleColumn.addView(title);
            source.setPadding(0, SBH.util.dp(5), 0, 0);
            titleColumn.addView(source);
            if (row.remark) {
                meta.setText(
                    row.remark + " · 更新 " +
                    formatTime(row.updatedAt)
                );
            }
            meta.setPadding(0, SBH.util.dp(5), 0, 0);
            titleColumn.addView(meta);

            head.addView(
                W.icon("cloud", 38, row.enabled ?
                    C.green : C.secondary)
            );
            head.addView(
                titleColumn,
                W.margins(
                    W.lp(0, W.WRAP, 1),
                    8,
                    0,
                    8,
                    0
                )
            );
            head.addView(
                W.label(
                    row.enabled ? "已启用" : "已停用",
                    row.enabled ? C.green : C.secondary,
                    row.enabled ? C.greenSoft : C.surfaceAlt
                )
            );
            card.addView(head);

            actionRow1.setPadding(
                0,
                SBH.util.dp(12),
                0,
                0
            );
            actionRow1.addView(
                smallButton(
                    "编辑",
                    "settings",
                    C.blue,
                    C.blueSoft,
                    function () {
                        editRow(row);
                    }
                ),
                W.lp(0, SBH.util.dp(40), 1)
            );
            actionRow1.addView(
                smallButton(
                    "预览",
                    "list",
                    C.purple,
                    C.purpleSoft,
                    function () {
                        previewRow(row);
                    }
                ),
                W.margins(
                    W.lp(0, SBH.util.dp(40), 1),
                    8,
                    0,
                    0,
                    0
                )
            );
            card.addView(actionRow1);

            actionRow2.setPadding(
                0,
                SBH.util.dp(8),
                0,
                0
            );
            actionRow2.addView(
                smallButton(
                    row.enabled ? "停用" : "启用",
                    row.enabled ? "pause" : "play",
                    C.orange,
                    C.orangeSoft,
                    function () {
                        toggleRow(row);
                    }
                ),
                W.lp(0, SBH.util.dp(40), 1)
            );
            actionRow2.addView(
                smallButton(
                    "删除",
                    "close",
                    C.coral,
                    C.coralSoft,
                    function () {
                        deleteRow(row);
                    }
                ),
                W.margins(
                    W.lp(0, SBH.util.dp(40), 1),
                    8,
                    0,
                    0,
                    0
                )
            );
            card.addView(actionRow2);
            return card;
        }

        page.content.addView(
            W.section(
                "订阅数据链",
                "客户端 SQLite CRUD 与脱敏配置预览"
            )
        );

        editor.setPadding(
            SBH.util.dp(14),
            SBH.util.dp(14),
            SBH.util.dp(14),
            SBH.util.dp(14)
        );
        editor.setGravity(Gravity.CENTER_VERTICAL);
        editor.addView(editorTitle);
        editorHint.setPadding(
            0,
            SBH.util.dp(5),
            0,
            SBH.util.dp(10)
        );
        editor.addView(editorHint);
        editor.addView(
            nameInput,
            W.lp(W.MATCH, SBH.util.dp(50))
        );
        editor.addView(
            urlInput,
            W.margins(
                W.lp(W.MATCH, SBH.util.dp(50)),
                0,
                8,
                0,
                0
            )
        );
        editor.addView(
            remarkInput,
            W.margins(
                W.lp(W.MATCH, SBH.util.dp(50)),
                0,
                8,
                0,
                0
            )
        );

        editorActions.setPadding(
            0,
            SBH.util.dp(10),
            0,
            0
        );
        editorActions.addView(
            smallButton(
                "保存",
                "check",
                C.green,
                C.greenSoft,
                save
            ),
            W.lp(0, SBH.util.dp(42), 1)
        );
        editorActions.addView(
            smallButton(
                "清空",
                "reload",
                C.secondary,
                C.surfaceAlt,
                resetEditor
            ),
            W.margins(
                W.lp(0, SBH.util.dp(42), 1),
                8,
                0,
                0,
                0
            )
        );
        editor.addView(editorActions);

        secondaryActions.setPadding(
            0,
            SBH.util.dp(8),
            0,
            0
        );
        secondaryActions.addView(
            smallButton(
                "填充示例",
                "magic",
                C.purple,
                C.purpleSoft,
                fillExample
            ),
            W.lp(W.MATCH, SBH.util.dp(42))
        );
        editor.addView(secondaryActions);

        page.content.addView(
            editor,
            W.margins(
                W.lp(W.MATCH, W.WRAP),
                0,
                14,
                0,
                0
            )
        );

        previewCard.setPadding(
            SBH.util.dp(14),
            SBH.util.dp(14),
            SBH.util.dp(14),
            SBH.util.dp(14)
        );
        previewCard.addView(previewTitle);
        previewText.setPadding(
            0,
            SBH.util.dp(8),
            0,
            0
        );
        previewText.setTextIsSelectable(true);
        previewCard.addView(previewText);
        page.content.addView(
            previewCard,
            W.margins(
                W.lp(W.MATCH, W.WRAP),
                0,
                12,
                0,
                0
            )
        );

        listTitle.setPadding(
            0,
            SBH.util.dp(16),
            0,
            SBH.util.dp(10)
        );
        page.content.addView(listTitle);

        rows = repository.list();
        if (rows.length === 0) {
            listContainer.addView(
                W.text(
                    "暂无订阅记录。可先点击“填充示例”，再保存。",
                    12,
                    C.secondary,
                    false
                )
            );
        } else {
            for (i = 0; i < rows.length; i += 1) {
                listContainer.addView(
                    buildCard(rows[i]),
                    W.margins(
                        W.lp(W.MATCH, W.WRAP),
                        0,
                        0,
                        0,
                        10
                    )
                );
            }
        }
        page.content.addView(listContainer);
        return page.view;
    }

    if (!repository) {
        throw new Error("Subscription repository unavailable");
    }

    SBH.navigation.register(1, build);

    if (typeof originalStart !== "function") {
        throw new Error("Original app.start unavailable");
    }

    SBH.app.start = function () {
        var output = originalStart();

        output.subscriptionCrudUiVersion = 1;
        output.subscriptionCrudUiReady = true;
        output.subscriptionCrudOperations = [
            "create",
            "read",
            "update",
            "enable_disable",
            "delete",
            "readonly_preview"
        ];
        output.subscriptionPreviewQueryMasked = true;
        output.subscriptionNetworkAccessed = false;
        output.subscriptionRuntimeConfigModified = false;
        output.subscriptionCoreInvoked = false;
        output.subscriptionTunCreated = false;
        output.subscriptionRouteModified = false;
        output.writeOperationsLocked = true;
        output.destructiveOperations = false;
        return output;
    };
}());
