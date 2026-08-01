/* SingBoxHub widget module. Rhino ES5 only. */
SBH.versions.widgets = 1;

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
    var Typeface = P.android.graphics.Typeface;
    var Paint = P.android.graphics.Paint;
    var Path = P.android.graphics.Path;
    var LinearGradient = P.android.graphics.LinearGradient;
    var RadialGradient = P.android.graphics.RadialGradient;
    var Shader = P.android.graphics.Shader;
    var RectF = P.android.graphics.RectF;
    var C = SBH.theme.colors;
    var MATCH = ViewGroup.LayoutParams.MATCH_PARENT;
    var WRAP = ViewGroup.LayoutParams.WRAP_CONTENT;

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
        box: "⬡"
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
            Math.max(12, Number(size) * 0.64),
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
                        SBH.util.toast("操作失败: " + SBH.util.errorText(error));
                    }
                }
            }
        ));
        return view;
    }

    function card(radius) {
        var view = column();
        view.setBackground(
            SBH.theme.rounded(C.surface, radius || 20, C.line, 1)
        );
        if (SBH.Build.VERSION.SDK_INT >= 21) {
            view.setElevation(SBH.util.dp(1));
        }
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
            SBH.util.dp(10),
            SBH.util.dp(7),
            SBH.util.dp(10),
            SBH.util.dp(7)
        );
        view.setBackground(SBH.theme.rounded(soft, 14, soft, 1));
        view.addView(icon(iconName, 20, accent));
        titleView = text(title, 13.5, accent, true);
        titleView.setPadding(SBH.util.dp(5), 0, 0, 0);
        view.addView(titleView);
        return fn ? click(view, fn) : view;
    }

    function section(title, subtitle) {
        var view = column();
        var sub;
        view.addView(text(title, 25, C.navy, true));
        if (subtitle) {
            sub = text(subtitle, 13.2, C.secondary, false);
            sub.setPadding(0, SBH.util.dp(7), 0, 0);
            view.addView(sub);
        }
        return view;
    }

    function divider(vertical) {
        var view = new View(SBH.ctx);
        view.setBackgroundColor(SBH.util.color(C.line));
        view.setLayoutParams(
            vertical ? lp(SBH.util.dp(1), MATCH) :
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
            SBH.util.dp(10),
            SBH.util.dp(16),
            SBH.util.dp(20)
        );
        scroll.addView(content, fp(MATCH, WRAP));
        return {
            view: scroll,
            content: content
        };
    }

    function horizontal() {
        var scroll = new HorizontalScrollView(SBH.ctx);
        scroll.setHorizontalScrollBarEnabled(false);
        return scroll;
    }

    function brandView() {
        var view = new JavaAdapter(View, {
            onDraw: function (canvas) {
                var width = this.getWidth();
                var height = this.getHeight();
                var size = Math.min(width, height);
                var paint = new Paint(Paint.ANTI_ALIAS_FLAG);
                var path = new Path();
                paint.setStyle(Paint.Style.STROKE);
                paint.setStrokeCap(Paint.Cap.ROUND);
                paint.setStrokeWidth(size * 0.18);
                paint.setShader(new LinearGradient(
                    0,
                    0,
                    width,
                    height,
                    SBH.util.color("#82D0B1"),
                    SBH.util.color("#679FD4"),
                    Shader.TileMode.CLAMP
                ));
                path.moveTo(size * 0.20, size * 0.25);
                path.cubicTo(
                    size * 0.42,
                    size * 0.02,
                    size * 0.82,
                    size * 0.18,
                    size * 0.80,
                    size * 0.43
                );
                path.cubicTo(
                    size * 0.78,
                    size * 0.64,
                    size * 0.35,
                    size * 0.58,
                    size * 0.23,
                    size * 0.79
                );
                canvas.drawPath(path, paint);
                path.reset();
                paint.setShader(new LinearGradient(
                    0,
                    height,
                    width,
                    0,
                    SBH.util.color("#7D86D4"),
                    SBH.util.color("#A6D3C2"),
                    Shader.TileMode.CLAMP
                ));
                path.moveTo(size * 0.80, size * 0.75);
                path.cubicTo(
                    size * 0.58,
                    size * 0.98,
                    size * 0.18,
                    size * 0.82,
                    size * 0.20,
                    size * 0.57
                );
                path.cubicTo(
                    size * 0.22,
                    size * 0.36,
                    size * 0.65,
                    size * 0.42,
                    size * 0.77,
                    size * 0.21
                );
                canvas.drawPath(path, paint);
            }
        }, SBH.ctx);
        view.setLayoutParams(lp(SBH.util.dp(52), SBH.util.dp(52)));
        return view;
    }

    function artView(mountain) {
        var view = new JavaAdapter(View, {
            onDraw: function (canvas) {
                var width = this.getWidth();
                var height = this.getHeight();
                var paint = new Paint(Paint.ANTI_ALIAS_FLAG);
                var path = new Path();
                paint.setStyle(Paint.Style.FILL);
                paint.setShader(new RadialGradient(
                    width * 0.78,
                    height * 0.46,
                    Math.max(width, height) * 0.42,
                    SBH.util.color("#28B6D9CA"),
                    SBH.util.color("#00FFFFFF"),
                    Shader.TileMode.CLAMP
                ));
                canvas.drawCircle(
                    width * 0.78,
                    height * 0.46,
                    Math.max(width, height) * 0.42,
                    paint
                );
                paint.setShader(null);
                paint.setColor(SBH.util.color("#1C7EA6CF"));
                canvas.drawOval(
                    new RectF(
                        width * 0.54,
                        height * 0.38,
                        width * 1.02,
                        height * 0.92
                    ),
                    paint
                );
                paint.setStyle(Paint.Style.STROKE);
                paint.setStrokeCap(Paint.Cap.ROUND);
                paint.setStrokeWidth(SBH.util.dp(2));
                paint.setColor(
                    SBH.util.color(mountain ? "#3A756CB5" : "#3A829E9D")
                );
                if (mountain) {
                    path.moveTo(width * 0.58, height * 0.62);
                    path.lineTo(width * 0.70, height * 0.28);
                    path.lineTo(width * 0.78, height * 0.46);
                    path.lineTo(width * 0.88, height * 0.19);
                    path.lineTo(width, height * 0.60);
                    canvas.drawPath(path, paint);
                } else {
                    path.moveTo(width * 0.58, height * 0.61);
                    path.quadTo(
                        width * 0.76,
                        height * 0.36,
                        width * 0.96,
                        height * 0.60
                    );
                    canvas.drawPath(path, paint);
                    canvas.drawLine(
                        width * 0.61,
                        height * 0.61,
                        width * 0.93,
                        height * 0.61,
                        paint
                    );
                }
            }
        }, SBH.ctx);
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
        brandView: brandView,
        artView: artView
    };
}());
