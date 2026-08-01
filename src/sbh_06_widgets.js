/* SingBoxHub widget module. Rhino ES5 only. */
SBH.versions.widgets = 3;

(function () {
    var P = Packages;
    var View = P.android.view.View;
    var ViewGroup = P.android.view.ViewGroup;
    var Gravity = P.android.view.Gravity;
    var LinearLayout = P.android.widget.LinearLayout;
    var FrameLayout = P.android.widget.FrameLayout;
    var TextView = P.android.widget.TextView;
    var ScrollView = P.android.widget.ScrollView;
    var HorizontalScrollView = P.android.widget.HorizontalScrollView;
    var EditText = P.android.widget.EditText;
    var Typeface = P.android.graphics.Typeface;
    var InputType = P.android.text.InputType;
    var C = SBH.theme.colors;
    var MATCH = ViewGroup.LayoutParams.MATCH_PARENT;
    var WRAP = ViewGroup.LayoutParams.WRAP_CONTENT;
    var PAGE_BOTTOM_PADDING_DP = 48;

    var glyph = {
        home: "⌂",
        nodes: "⌘",
        logs: "▤",
        settings: "⚙",
        check: "✓",
        cloud: "☁",
        route: "↝",
        list: "☷",
        shield: "◇",
        play: "▶",
        stop: "■",
        reload: "↻",
        search: "⌕",
        filter: "▽",
        clock: "◷",
        chip: "▦",
        magic: "✦",
        more: "⋮",
        bell: "⌑",
        pause: "Ⅱ",
        star: "☆",
        box: "⬡",
        close: "×"
    };

    function lp(width, height, weight) {
        if (typeof weight === "number") {
            return new LinearLayout.LayoutParams(width, height, weight);
        }
        return new LinearLayout.LayoutParams(width, height);
    }

    function fp(width, height, gravity) {
        var params = new FrameLayout.LayoutParams(width, height);
        if (typeof gravity === "number") {
            params.gravity = gravity;
        }
        return params;
    }

    function margins(params, left, top, right, bottom) {
        params.setMargins(
            SBH.util.dp(left),
            SBH.util.dp(top),
            SBH.util.dp(right),
            SBH.util.dp(bottom)
        );
        return params;
    }

    function column() {
        var view = new LinearLayout(SBH.ctx);
        view.setOrientation(LinearLayout.VERTICAL);
        return view;
    }

    function row() {
        var view = new LinearLayout(SBH.ctx);
        view.setOrientation(LinearLayout.HORIZONTAL);
        view.setGravity(Gravity.CENTER_VERTICAL);
        return view;
    }

    function text(value, size, colorValue, bold) {
        var view = new TextView(SBH.ctx);
        view.setText(String(value));
        view.setTextSize(Number(size));
        view.setTextColor(SBH.util.color(colorValue || C.text));
        view.setGravity(Gravity.CENTER_VERTICAL);
        view.setIncludeFontPadding(false);
        view.setTypeface(
            Typeface.create(
                "sans-serif",
                bold ? Typeface.BOLD : Typeface.NORMAL
            )
        );
        return view;
    }

    function icon(name, size, colorValue) {
        var view = text(
            glyph[name] || String(name),
            Math.max(13, Number(size) * 0.62),
            colorValue || C.text,
            true
        );
        view.setGravity(Gravity.CENTER);
        view.setLayoutParams(lp(SBH.util.dp(size), SBH.util.dp(size)));
        return view;
    }

    function click(view, fn) {
        view.setClickable(true);
        view.setOnClickListener(new JavaAdapter(
            P.android.view.View.OnClickListener,
            {
                onClick: function (clicked) {
                    try {
                        fn(clicked);
                    } catch (error) {
                        SBH.log.error("widgets", error);
                        SBH.util.toast(
                            "操作失败: " + SBH.util.errorText(error)
                        );
                    }
                }
            }
        ));
        return view;
    }

    function card(radius) {
        var view = column();
        view.setBackground(
            SBH.theme.rounded(C.surface, radius || 18, C.line, 1)
        );
        return view;
    }

    function label(value, accent, soft) {
        var view = text(value, 11.5, accent, false);
        view.setGravity(Gravity.CENTER);
        view.setPadding(
            SBH.util.dp(9),
            SBH.util.dp(5),
            SBH.util.dp(9),
            SBH.util.dp(5)
        );
        view.setBackground(SBH.theme.rounded(soft, 12, soft, 0));
        return view;
    }

    function button(title, iconName, accent, soft, fn) {
        var view = row();
        var titleView;
        view.setGravity(Gravity.CENTER);
        view.setPadding(
            SBH.util.dp(9),
            SBH.util.dp(7),
            SBH.util.dp(9),
            SBH.util.dp(7)
        );
        view.setBackground(SBH.theme.rounded(soft, 14, soft, 1));
        view.addView(icon(iconName, 20, accent));
        titleView = text(title, 13.2, accent, true);
        titleView.setPadding(SBH.util.dp(5), 0, 0, 0);
        view.addView(titleView);
        return fn ? click(view, fn) : view;
    }

    function section(title, subtitle) {
        var view = column();
        var sub;
        view.addView(text(title, 24, C.navy, true));
        if (subtitle) {
            sub = text(subtitle, 13, C.secondary, false);
            sub.setPadding(0, SBH.util.dp(6), 0, 0);
            view.addView(sub);
        }
        return view;
    }

    function divider(vertical) {
        var view = new View(SBH.ctx);
        view.setBackgroundColor(SBH.util.color(C.line));
        view.setLayoutParams(
            vertical ?
                lp(SBH.util.dp(1), MATCH) :
                lp(MATCH, SBH.util.dp(1))
        );
        return view;
    }

    function scrollPage() {
        var scroll = new ScrollView(SBH.ctx);
        var content = column();
        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        scroll.setClipToPadding(false);
        content.setPadding(
            SBH.util.dp(16),
            SBH.util.dp(12),
            SBH.util.dp(16),
            SBH.util.dp(PAGE_BOTTOM_PADDING_DP)
        );
        scroll.addView(content, fp(MATCH, WRAP));
        return { view: scroll, content: content };
    }

    function horizontal() {
        var scroll = new HorizontalScrollView(SBH.ctx);
        scroll.setHorizontalScrollBarEnabled(false);
        scroll.setFillViewport(false);
        return scroll;
    }

    function input(hint) {
        var view = new EditText(SBH.ctx);
        view.setTextSize(13.5);
        view.setHint(String(hint || ""));
        view.setHintTextColor(SBH.util.color("#A4ACBA"));
        view.setTextColor(SBH.util.color(C.text));
        view.setSingleLine(true);
        view.setInputType(InputType.TYPE_CLASS_TEXT);
        view.setBackground(SBH.theme.rounded(C.surface, 14, C.line, 1));
        view.setPadding(
            SBH.util.dp(14),
            0,
            SBH.util.dp(14),
            0
        );
        return view;
    }

    function brandView() {
        var view = text("S", 22, C.white, true);
        view.setGravity(Gravity.CENTER);
        view.setBackground(
            SBH.theme.gradient(
                ["#75BFA4", "#648BC8", "#8B79BF"],
                15,
                null
            )
        );
        view.setLayoutParams(lp(SBH.util.dp(48), SBH.util.dp(48)));
        return view;
    }

    function artView(mountain) {
        var view = new View(SBH.ctx);
        view.setBackground(
            SBH.theme.gradient(
                mountain ?
                    ["#18A89BC6", "#187A86D1", "#10FFFFFF"] :
                    ["#1887C6AE", "#187AA8D8", "#10FFFFFF"],
                22,
                null
            )
        );
        view.setLayoutParams(fp(MATCH, MATCH));
        return view;
    }

    SBH.widgets = {
        MATCH: MATCH,
        WRAP: WRAP,
        Gravity: Gravity,
        lp: lp,
        fp: fp,
        margins: margins,
        column: column,
        row: row,
        text: text,
        icon: icon,
        click: click,
        card: card,
        label: label,
        button: button,
        section: section,
        divider: divider,
        scrollPage: scrollPage,
        horizontal: horizontal,
        input: input,
        brandView: brandView,
        artView: artView
    };
}());
