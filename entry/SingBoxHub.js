/*
 * SingBoxHub Monet UI prototype
 * Android 14 / ShortX / Rhino ES5 / WindowManager + native Views
 *
 * This is a non-destructive visual prototype. It performs no shell command,
 * process control, TUN creation, route change, firewall operation or Core I/O.
 */
(function () {
    "use strict";

    var PROJECT = "SingBoxHub";
    var ENTRY_VERSION = 2;
    var MODULE_VERSION = "monet-ui-prototype-20260801.01";
    var CLOSE_ACTION = "com.singboxhub.prototype.UI_CLOSE";

    var P = Packages;
    var Build = P.android.os.Build;
    var Color = P.android.graphics.Color;
    var Gravity = P.android.view.Gravity;
    var View = P.android.view.View;
    var ViewGroup = P.android.view.ViewGroup;
    var WindowManager = P.android.view.WindowManager;
    var LinearLayout = P.android.widget.LinearLayout;
    var FrameLayout = P.android.widget.FrameLayout;
    var ScrollView = P.android.widget.ScrollView;
    var HorizontalScrollView = P.android.widget.HorizontalScrollView;
    var TextView = P.android.widget.TextView;
    var EditText = P.android.widget.EditText;
    var Switch = P.android.widget.Switch;
    var Toast = P.android.widget.Toast;
    var GradientDrawable = P.android.graphics.drawable.GradientDrawable;
    var Paint = P.android.graphics.Paint;
    var Path = P.android.graphics.Path;
    var RectF = P.android.graphics.RectF;
    var LinearGradient = P.android.graphics.LinearGradient;
    var RadialGradient = P.android.graphics.RadialGradient;
    var Shader = P.android.graphics.Shader;
    var Typeface = P.android.graphics.Typeface;
    var Handler = P.android.os.Handler;
    var Looper = P.android.os.Looper;
    var Intent = P.android.content.Intent;
    var IntentFilter = P.android.content.IntentFilter;
    var BroadcastReceiver = P.android.content.BroadcastReceiver;
    var Context = P.android.content.Context;
    var KeyEvent = P.android.view.KeyEvent;
    var InputType = P.android.text.InputType;

    var MATCH = ViewGroup.LayoutParams.MATCH_PARENT;
    var WRAP = ViewGroup.LayoutParams.WRAP_CONTENT;
    var ctx = null;
    var density = 1;
    var handler = new Handler(Looper.getMainLooper());

    var C = {
        bg: "#F8F9FB", surface: "#FCFDFE", softSurface: "#F5F7FA",
        navy: "#101C3C", text: "#293751", secondary: "#738097", line: "#E4E8EF",
        green: "#2BA56F", greenSoft: "#E8F7EF", blue: "#3275D8", blueSoft: "#EAF1FC",
        purple: "#765FD1", purpleSoft: "#F0EDFC", orange: "#C96D35", orangeSoft: "#FBEFE8",
        coral: "#C45E58", coralSoft: "#FBEDEC", cyan: "#399C93", cyanSoft: "#E9F7F5",
        white: "#FFFFFFFF", clear: "#00000000"
    };

    var GLYPH = {
        brand: "S", bell: "⌑", more: "⋮", home: "⌂", nodes: "⌘", log: "▤", settings: "⚙",
        check: "✓", shield: "◇", cloud: "☁", list: "☷", route: "↝", magic: "✦",
        pulse: "⌁", layers: "◆", search: "⌕", filter: "▽", play: "▶", stop: "■",
        reload: "↻", clock: "◷", chip: "▦", box: "⬡", bolt: "ϟ", calendar: "▣",
        phone: "▯", keyboard: "⌨", moon: "☾", grid: "▦", pause: "Ⅱ", star: "☆"
    };

    function getContext() {
        var value = null;
        try { if (typeof context !== "undefined" && context !== null) { value = context; } } catch (ignored1) {}
        if (value === null) { try { value = P.android.app.ActivityThread.currentApplication(); } catch (ignored2) {} }
        if (value === null) { try { value = P.android.app.AppGlobals.getInitialApplication(); } catch (ignored3) {} }
        if (value === null) { throw new Error("Android Context unavailable"); }
        try { return value.getApplicationContext() || value; } catch (ignored4) { return value; }
    }

    function dp(v) { if (v === 0) { return 0; } return Math.max(1, Math.round(v * density)); }
    function col(v) { return Color.parseColor(v); }
    function ints(values) {
        var result = java.lang.reflect.Array.newInstance(java.lang.Integer.TYPE, values.length);
        var i;
        for (i = 0; i < values.length; i += 1) { result[i] = values[i]; }
        return result;
    }
    function lp(w, h, weight) { return typeof weight === "number" ? new LinearLayout.LayoutParams(w, h, weight) : new LinearLayout.LayoutParams(w, h); }
    function fp(w, h, gravity) { var p = new FrameLayout.LayoutParams(w, h); if (typeof gravity === "number") { p.gravity = gravity; } return p; }
    function margins(p, l, t, r, b) { p.setMargins(dp(l), dp(t), dp(r), dp(b)); return p; }
    function rounded(fill, radius, stroke, sw) {
        var d = new GradientDrawable(); d.setColor(col(fill)); d.setCornerRadius(dp(radius));
        if (stroke && sw) { d.setStroke(dp(sw), col(stroke)); } return d;
    }
    function gradient(colors, radius, stroke) {
        var values = [], i;
        for (i = 0; i < colors.length; i += 1) { values.push(col(colors[i])); }
        var d = new GradientDrawable(GradientDrawable.Orientation.TL_BR, ints(values));
        d.setCornerRadius(dp(radius)); if (stroke) { d.setStroke(dp(1), col(stroke)); } return d;
    }
    function column() { var v = new LinearLayout(ctx); v.setOrientation(LinearLayout.VERTICAL); return v; }
    function row() { var v = new LinearLayout(ctx); v.setOrientation(LinearLayout.HORIZONTAL); v.setGravity(Gravity.CENTER_VERTICAL); return v; }
    function text(value, size, colorValue, bold) {
        var v = new TextView(ctx); v.setText(String(value)); v.setTextSize(size); v.setTextColor(col(colorValue || C.text));
        v.setGravity(Gravity.CENTER_VERTICAL); v.setIncludeFontPadding(false);
        v.setTypeface(Typeface.create("sans-serif", bold ? Typeface.BOLD : Typeface.NORMAL)); return v;
    }
    function icon(name, size, colorValue, bold) {
        var v = text(GLYPH[name] || name, Math.max(12, size * 0.64), colorValue || C.text, bold !== false);
        v.setGravity(Gravity.CENTER); v.setLayoutParams(lp(dp(size), dp(size))); return v;
    }
    function space(w, h) { var v = new View(ctx); v.setLayoutParams(lp(dp(w), dp(h))); return v; }
    function divider(vertical) { var v = new View(ctx); v.setBackgroundColor(col(C.line)); v.setLayoutParams(vertical ? lp(dp(1), MATCH) : lp(MATCH, dp(1))); return v; }
    function elevate(v, amount) { if (Build.VERSION.SDK_INT >= 21) { try { v.setElevation(dp(amount)); } catch (ignored) {} } }
    function click(v, fn) {
        v.setClickable(true); v.setOnClickListener(new JavaAdapter(P.android.view.View.OnClickListener, {
            onClick: function (view) { try { fn(view); } catch (error) { toast("操作失败：" + error); } }
        })); return v;
    }
    function toast(message) { try { Toast.makeText(ctx, String(message), Toast.LENGTH_SHORT).show(); } catch (ignored) {} }
    function label(value, accent, soft) {
        var v = text(value, 11.5, accent, false); v.setGravity(Gravity.CENTER); v.setPadding(dp(9), dp(5), dp(9), dp(5));
        v.setBackground(rounded(soft, 12, soft, 0)); v.setLayoutParams(lp(WRAP, dp(29))); return v;
    }
    function badge(name, accent, soft, size) {
        var box = new FrameLayout(ctx); box.setBackground(gradient([soft, C.white], 14, soft));
        box.addView(icon(name, (size || 44) - 12, accent), fp(MATCH, MATCH, Gravity.CENTER)); box.setLayoutParams(lp(dp(size || 44), dp(size || 44))); return box;
    }
    function card(radius) { var v = column(); v.setBackground(rounded(C.surface, radius || 18, C.line, 1)); elevate(v, 0.7); return v; }
    function button(title, iconName, accent, soft, fn) {
        var v = row(); v.setGravity(Gravity.CENTER); v.setPadding(dp(10), dp(7), dp(10), dp(7)); v.setBackground(rounded(soft, 13, soft, 1));
        v.addView(icon(iconName, 20, accent)); var t = text(title, 13.5, accent, true); t.setPadding(dp(6), 0, 0, 0); v.addView(t);
        return fn ? click(v, fn) : v;
    }
    function section(titleValue, subtitle) {
        var box = column(); box.addView(text(titleValue, 25, C.navy, true));
        if (subtitle) { var s = text(subtitle, 13.5, C.secondary, false); s.setPadding(0, dp(7), 0, 0); box.addView(s); } return box;
    }
    function scrollPage() {
        var sc = new ScrollView(ctx); sc.setFillViewport(true); sc.setVerticalScrollBarEnabled(false); sc.setClipToPadding(false);
        var content = column(); content.setPadding(dp(16), dp(10), dp(16), dp(18)); sc.addView(content, fp(MATCH, WRAP));
        return {view: sc, content: content};
    }

    function BrandView() {
        var v = new JavaAdapter(View, {
            onDraw: function (canvas) {
                var w = this.getWidth(), h = this.getHeight(), s = Math.min(w, h), p = new Paint(Paint.ANTI_ALIAS_FLAG), path = new Path();
                p.setStyle(Paint.Style.STROKE); p.setStrokeCap(Paint.Cap.ROUND); p.setStrokeWidth(s * 0.19);
                p.setShader(new LinearGradient(0, 0, w, h, col("#84D7B5"), col("#65A5DC"), Shader.TileMode.CLAMP));
                path.moveTo(s * 0.20, s * 0.25); path.cubicTo(s * 0.42, s * 0.02, s * 0.82, s * 0.18, s * 0.80, s * 0.43); path.cubicTo(s * 0.78, s * 0.64, s * 0.35, s * 0.58, s * 0.23, s * 0.79); canvas.drawPath(path, p);
                path.reset(); p.setShader(new LinearGradient(0, h, w, 0, col("#7E87E0"), col("#A8D8C6"), Shader.TileMode.CLAMP));
                path.moveTo(s * 0.80, s * 0.75); path.cubicTo(s * 0.58, s * 0.98, s * 0.18, s * 0.82, s * 0.20, s * 0.57); path.cubicTo(s * 0.22, s * 0.36, s * 0.65, s * 0.42, s * 0.77, s * 0.21); canvas.drawPath(path, p);
            }
        }, ctx); v.setLayoutParams(lp(dp(54), dp(54))); return v;
    }

    function ArtView(mountain) {
        var v = new JavaAdapter(View, {
            onDraw: function (canvas) {
                var w = this.getWidth(), h = this.getHeight(), p = new Paint(Paint.ANTI_ALIAS_FLAG), path = new Path();
                p.setStyle(Paint.Style.FILL); p.setShader(new RadialGradient(w * 0.78, h * 0.46, Math.max(w, h) * 0.43, col("#32B9DED0"), col("#00FFFFFF"), Shader.TileMode.CLAMP)); canvas.drawCircle(w * 0.78, h * 0.46, Math.max(w, h) * 0.43, p); p.setShader(null);
                p.setColor(col("#1E79A9D9")); canvas.drawOval(new RectF(w * 0.52, h * 0.38, w * 1.02, h * 0.92), p);
                p.setColor(col("#1EA7D5BB")); canvas.drawOval(new RectF(w * 0.64, h * 0.12, w * 0.98, h * 0.68), p);
                p.setStyle(Paint.Style.STROKE); p.setStrokeCap(Paint.Cap.ROUND); p.setStrokeWidth(dp(2)); p.setColor(col(mountain ? "#397A70C4" : "#398BA7A6"));
                if (mountain) {
                    path.moveTo(w * 0.58, h * 0.62); path.lineTo(w * 0.70, h * 0.28); path.lineTo(w * 0.78, h * 0.46); path.lineTo(w * 0.88, h * 0.19); path.lineTo(w, h * 0.60); canvas.drawPath(path, p);
                    p.setColor(col("#36C67D5C")); canvas.drawLine(w * 0.73, h * 0.63, w * 0.96, h * 0.63, p); canvas.drawLine(w * 0.84, h * 0.47, w * 0.84, h * 0.78, p);
                } else {
                    path.moveTo(w * 0.58, h * 0.61); path.quadTo(w * 0.76, h * 0.36, w * 0.96, h * 0.60); canvas.drawPath(path, p); canvas.drawLine(w * 0.61, h * 0.61, w * 0.93, h * 0.61, p);
                    canvas.drawLine(w * 0.68, h * 0.55, w * 0.68, h * 0.76, p); canvas.drawLine(w * 0.86, h * 0.55, w * 0.86, h * 0.76, p);
                }
            }
        }, ctx); v.setLayoutParams(fp(MATCH, MATCH)); return v;
    }

    function topBar() {
        var bar = row(); bar.setPadding(dp(18), dp(12), dp(12), dp(8)); bar.setBackgroundColor(col(C.bg));
        bar.addView(BrandView()); var brand = column(); brand.setPadding(dp(10), 0, 0, 0); brand.addView(text("SingBoxHub", 24, C.navy, true));
        var sub = text("Runtime Prototype", 12.5, "#A0A8B7", false); sub.setPadding(0, dp(3), 0, 0); brand.addView(sub); bar.addView(brand, lp(0, WRAP, 1));
        var bell = new FrameLayout(ctx); bell.setBackground(rounded(C.surface, 14, C.line, 1)); bell.addView(icon("bell", 30, C.text, false), fp(MATCH, MATCH, Gravity.CENTER));
        click(bell, function () { toast("暂无新通知"); }); bar.addView(bell, margins(lp(dp(48), dp(48)), 0, 0, 5, 0));
        var more = new FrameLayout(ctx); more.addView(icon("more", 30, C.text), fp(MATCH, MATCH, Gravity.CENTER)); click(more, function () { toast(MODULE_VERSION); }); bar.addView(more, lp(dp(42), dp(48))); return bar;
    }

    function navItem(controller, index, iconName, titleValue) {
        var selected = controller.page === index, box = column(); box.setGravity(Gravity.CENTER);
        var indicator = new View(ctx); indicator.setBackground(rounded(selected ? C.blue : C.clear, 2, C.clear, 0)); box.addView(indicator, margins(lp(dp(52), dp(3)), 0, 0, 0, 4));
        box.addView(icon(iconName, 29, selected ? C.blue : "#68758A")); var t = text(titleValue, 11.5, selected ? C.blue : "#68758A", selected); t.setGravity(Gravity.CENTER); t.setPadding(0, dp(4), 0, 0); box.addView(t);
        return click(box, function () { controller.show(index); });
    }
    function bottomNav(controller) {
        var nav = row(); nav.setBackground(rounded(C.surface, 0, C.line, 1)); nav.setPadding(dp(4), 0, dp(4), dp(5));
        nav.addView(navItem(controller, 0, "home", "首页"), lp(0, MATCH, 1)); nav.addView(navItem(controller, 1, "nodes", "节点"), lp(0, MATCH, 1));
        nav.addView(navItem(controller, 2, "log", "日志"), lp(0, MATCH, 1)); nav.addView(navItem(controller, 3, "settings", "设置"), lp(0, MATCH, 1)); return nav;
    }

    function infoLine(iconName, name, value) {
        var v = row(); v.setPadding(0, dp(7), 0, dp(7)); v.addView(icon(iconName, 22, C.secondary, false));
        var n = text(name, 13, C.secondary, false); n.setPadding(dp(10), 0, 0, 0); v.addView(n, lp(dp(112), WRAP)); v.addView(text(value, 14, C.text, false), lp(0, WRAP, 1)); return v;
    }

    function hero(controller) {
        var shell = new FrameLayout(ctx); shell.setBackground(gradient(["#F1FAF6", "#F3F8FD", "#FCFCFD"], 20, "#DDE9E5")); shell.addView(ArtView(false)); elevate(shell, 0.8);
        var body = column(); body.setPadding(dp(18), dp(18), dp(18), dp(16)); var head = row();
        var circle = new FrameLayout(ctx); circle.setBackground(rounded("#ECFAF3", 50, "#CDEEDD", 1)); circle.addView(icon("check", 55, C.green), fp(MATCH, MATCH, Gravity.CENTER)); head.addView(circle, lp(dp(76), dp(76)));
        var statusBox = column(); statusBox.setPadding(dp(14), dp(4), 0, 0); var state = row(); var dot = new View(ctx); dot.setBackground(rounded(controller.running ? C.green : C.coral, 9, C.clear, 0)); state.addView(dot, lp(dp(10), dp(10)));
        var stateText = text(controller.running ? "运行中" : "已停止", 22, controller.running ? C.green : C.coral, true); stateText.setPadding(dp(8), 0, 0, 0); state.addView(stateText); statusBox.addView(state);
        var desc = text(controller.running ? "连接正常 · 所有系统健康" : "Runtime 未连接 · 等待启动", 13.5, C.secondary, false); desc.setPadding(0, dp(8), 0, 0); statusBox.addView(desc); head.addView(statusBox, lp(0, WRAP, 1)); head.addView(label("TUN 隔离", C.green, C.greenSoft)); body.addView(head);
        var info = column(); info.setPadding(0, dp(10), 0, dp(9)); info.addView(infoLine("settings", "核心版本", "sing-box 1.13.12")); info.addView(infoLine("phone", "运行平台", "Android 14 / arm64")); info.addView(infoLine("box", "脚本引擎", "ShortX · Rhino ES5")); body.addView(info);
        var actions = row(); actions.setGravity(Gravity.CENTER); actions.addView(button("启动", "play", C.green, C.greenSoft, function () { controller.running = true; controller.addLog("OK", "收到启动请求（UI 原型未连接 Runtime）", "runtime"); controller.show(0); toast("未执行真实启动"); }), lp(0, dp(50), 1));
        actions.addView(button("停止", "stop", C.coral, C.coralSoft, function () { controller.running = false; controller.addLog("WARN", "收到停止请求（UI 原型未连接 Runtime）", "runtime"); controller.show(0); toast("未执行真实停止"); }), margins(lp(0, dp(50), 1), 8, 0, 8, 0));
        actions.addView(button("重载配置", "reload", C.blue, C.blueSoft, function () { controller.addLog("INFO", "配置重载请求进入原型队列", "config"); toast("重载配置演示"); }), lp(0, dp(50), 1));
        var actionShell = new FrameLayout(ctx); actionShell.setPadding(dp(5), dp(5), dp(5), dp(5)); actionShell.setBackground(rounded("#F9FBFC", 17, "#E4E9EF", 1)); actionShell.addView(actions); body.addView(actionShell, lp(MATCH, dp(62)));
        shell.addView(body, fp(MATCH, MATCH)); shell.setLayoutParams(lp(MATCH, dp(326))); return shell;
    }

    function feature(iconName, accent, soft, titleValue, subtitle, status, fn) {
        var v = card(18); v.setPadding(dp(14), dp(14), dp(14), dp(12)); v.addView(badge(iconName, accent, soft, 48));
        var titleText = text(titleValue, 17, C.navy, true); titleText.setPadding(0, dp(11), 0, 0); v.addView(titleText); var sub = text(subtitle, 12.3, C.secondary, false); sub.setPadding(0, dp(5), 0, dp(10)); v.addView(sub); v.addView(divider(false));
        var s = text(status, 12.3, accent, false); s.setPadding(0, dp(9), 0, 0); v.addView(s); return fn ? click(v, fn) : v;
    }
    function featureRow(parent, left, right) { var r = row(); r.setGravity(Gravity.TOP); r.addView(left, margins(lp(0, dp(164), 1), 0, 0, 6, 0)); r.addView(right, margins(lp(0, dp(164), 1), 6, 0, 0, 0)); parent.addView(r, margins(lp(MATCH, WRAP), 0, 12, 0, 0)); }
    function metric(iconName, accent, titleValue, value, note) {
        var v = column(); v.setGravity(Gravity.CENTER); v.addView(icon(iconName, 25, accent)); var t = text(titleValue, 11, C.text, false); t.setGravity(Gravity.CENTER); t.setPadding(0, dp(4), 0, 0); v.addView(t);
        if (value) { var x = text(value, 16.5, accent, true); x.setGravity(Gravity.CENTER); x.setPadding(0, dp(4), 0, 0); v.addView(x); }
        if (note) { var n = text(note, 10.2, C.secondary, false); n.setGravity(Gravity.CENTER); n.setPadding(0, dp(3), 0, 0); v.addView(n); } return v;
    }
    function homePage(controller) {
        var page = scrollPage(); page.content.addView(hero(controller));
        featureRow(page.content, feature("shield", C.green, C.greenSoft, "配置校验", "检查配置文件", "✓ 通过校验", function () { toast("配置校验通过（演示）"); }), feature("cloud", C.purple, C.purpleSoft, "订阅管理", "管理订阅与更新", "3 个订阅 · 最近更新 08:35", function () { controller.show(1); }));
        featureRow(page.content, feature("list", C.blue, C.blueSoft, "节点列表", "查看与管理节点", "总计 128 · 在线 96", function () { controller.show(1); }), feature("route", C.orange, C.orangeSoft, "策略路由", "规则与路由管理", "路由表 20240", function () { toast("策略路由待接入 Runtime"); }));
        featureRow(page.content, feature("log", C.blue, C.blueSoft, "运行日志", "查看运行日志", "最近日志 08:42:11", function () { controller.show(2); }), feature("magic", C.purple, C.purpleSoft, "自动化任务", "ShortX JS 任务", "已启用 5 · 就绪", function () { controller.show(3); }));
        var summary = card(18); summary.setOrientation(LinearLayout.HORIZONTAL); summary.setPadding(dp(8), dp(14), dp(8), dp(14));
        summary.addView(metric("pulse", C.green, "延迟测试", "23 ms", "国内节点"), lp(0, WRAP, 1)); summary.addView(divider(true), lp(dp(1), dp(75))); summary.addView(metric("route", C.purple, "路由表", "20240", "条目"), lp(0, WRAP, 1));
        summary.addView(divider(true), lp(dp(1), dp(75))); summary.addView(metric("layers", C.orange, "规则范围", "8800–8815", "规则组"), lp(0, WRAP, 1)); summary.addView(divider(true), lp(dp(1), dp(75))); summary.addView(metric("shield", C.green, "备份状态", "就绪", "● 可回滚"), lp(0, WRAP, 1));
        page.content.addView(summary, margins(lp(MATCH, WRAP), 0, 14, 0, 0)); return page.view;
    }

    function segment(controller, titleValue, index) { var selected = controller.segment === index, v = text(titleValue, 14.5, selected ? C.green : C.navy, selected); v.setGravity(Gravity.CENTER); v.setBackground(rounded(selected ? "#F7FBFA" : C.clear, 13, selected ? "#CDE7DE" : C.clear, selected ? 1 : 0)); return click(v, function () { controller.segment = index; controller.show(1); }); }
    function subCard(accent, soft, titleValue, status, host, updated, count) {
        var v = card(18); v.setPadding(dp(13), dp(13), dp(13), dp(12)); var head = row(); head.addView(badge("cloud", accent, soft, 42)); head.addView(space(8, 1)); head.addView(label(status, accent, soft)); v.addView(head);
        var t = text(titleValue, 16.5, C.navy, true); t.setPadding(0, dp(10), 0, 0); v.addView(t); var h = text(host, 11.3, C.secondary, false); h.setPadding(0, dp(5), 0, 0); v.addView(h);
        var i1 = row(); i1.setPadding(0, dp(11), 0, 0); i1.addView(text("更新时间", 11.3, C.secondary, false), lp(0, WRAP, 1)); i1.addView(text(updated, 11.3, C.text, false)); v.addView(i1);
        var i2 = row(); i2.setPadding(0, dp(7), 0, dp(10)); i2.addView(text("节点数量", 11.3, C.secondary, false), lp(0, WRAP, 1)); i2.addView(text(count, 11.3, C.text, false)); v.addView(i2);
        var actions = row(); actions.addView(button("更新", "reload", C.green, C.greenSoft, function () { toast(titleValue + "：更新完成（演示）"); }), lp(0, dp(37), 1)); actions.addView(button("测试延迟", "clock", C.purple, C.purpleSoft, function () { toast(titleValue + "：平均 36 ms"); }), margins(lp(0, dp(37), 1), 6, 0, 0, 0)); v.addView(actions); return v;
    }
    function chip(titleValue, selected, accent, fn) { var v = text(titleValue, 12.3, selected ? C.white : C.secondary, selected); v.setGravity(Gravity.CENTER); v.setPadding(dp(13), dp(8), dp(13), dp(8)); v.setBackground(rounded(selected ? accent : C.surface, 13, selected ? accent : C.line, 1)); return fn ? click(v, fn) : v; }
    function flag(value) { var v = text(value, 17, C.navy, false); v.setGravity(Gravity.CENTER); v.setBackground(rounded(C.surface, 7, C.line, 1)); return v; }
    function node(controller, index, flagValue, name, source, protocol, latency, accent, soft) {
        var selected = controller.node === index, v = row(); v.setPadding(dp(10), dp(10), dp(10), dp(10)); v.setBackground(rounded(selected ? "#F0FAF5" : C.surface, 0, C.clear, 0)); v.addView(flag(flagValue), lp(dp(38), dp(38)));
        var info = column(); info.setPadding(dp(10), 0, dp(6), 0); info.addView(text(name, 14.3, C.navy, true)); var sub = text(source + " · 国际线路", 10.3, C.secondary, false); sub.setPadding(0, dp(4), 0, 0); info.addView(sub); v.addView(info, lp(0, WRAP, 1));
        v.addView(label(protocol, accent, soft)); var slow = latency.indexOf("6") === 0 || latency.indexOf("8") === 0; v.addView(label(latency, slow ? C.orange : C.green, slow ? C.orangeSoft : C.greenSoft), margins(lp(WRAP, dp(29)), 8, 0, 0, 0)); v.addView(icon("star", 30, "#B8C0CF", false)); v.addView(icon(selected ? "check" : "○", 27, selected ? C.green : "#C7CED9", false));
        return click(v, function () { controller.node = index; controller.addLog("INFO", "已选择节点：" + name, "nodes"); controller.show(1); });
    }
    function nodesPage(controller) {
        var page = scrollPage(); page.content.addView(section("节点与订阅", "管理订阅源与节点，选择最优线路")); var seg = row(); seg.setPadding(dp(3), dp(3), dp(3), dp(3)); seg.setBackground(rounded("#F7F8FA", 15, C.line, 1)); seg.addView(segment(controller, "订阅", 0), lp(0, dp(48), 1)); seg.addView(segment(controller, "节点", 1), lp(0, dp(48), 1)); seg.addView(segment(controller, "分组", 2), lp(0, dp(48), 1)); page.content.addView(seg, margins(lp(MATCH, dp(54)), 0, 16, 0, 0));
        var hs = new HorizontalScrollView(ctx); hs.setHorizontalScrollBarEnabled(false); var subs = row(); subs.setPadding(0, dp(14), dp(4), dp(2));
        subs.addView(subCard(C.green, C.greenSoft, "主力节点订阅", "已启用", "sub.main.example.com", "今天 08:35", "128"), margins(lp(dp(256), dp(240)), 0, 0, 12, 0)); subs.addView(subCard(C.purple, C.purpleSoft, "备用节点订阅", "备用", "sub.backup.example.com", "昨天 22:10", "86"), margins(lp(dp(256), dp(240)), 0, 0, 12, 0)); subs.addView(subCard(C.orange, C.orangeSoft, "实验性节点订阅", "已禁用", "sub.exp.example.com", "05-10 14:20", "42"), lp(dp(256), dp(240))); hs.addView(subs, fp(WRAP, WRAP)); page.content.addView(hs, lp(MATCH, dp(256)));
        var searchRow = row(), searchShell = row(); searchShell.setPadding(dp(12), 0, dp(8), 0); searchShell.setBackground(rounded(C.surface, 14, C.line, 1)); searchShell.addView(icon("search", 24, C.secondary, false));
        var search = new EditText(ctx); search.setTextSize(13.5); search.setHint("搜索节点名称 / 国家 / 备注"); search.setHintTextColor(col("#A4ACBA")); search.setTextColor(col(C.text)); search.setSingleLine(true); search.setInputType(InputType.TYPE_CLASS_TEXT); search.setBackgroundColor(Color.TRANSPARENT); search.setPadding(dp(8), 0, 0, 0); searchShell.addView(search, lp(0, dp(52), 1)); searchRow.addView(searchShell, lp(0, dp(52), 1)); searchRow.addView(button("筛选", "filter", C.text, C.surface, function () { toast("筛选面板待接入"); }), margins(lp(dp(92), dp(52)), 10, 0, 0, 0)); page.content.addView(searchRow, lp(MATCH, dp(52)));
        var chipScroll = new HorizontalScrollView(ctx); chipScroll.setHorizontalScrollBarEnabled(false); var chips = row(), titles = ["全部 128", "延迟排序 ↕", "协议⌄", "分组⌄", "收藏⌄", "可用⌄"], i; chips.setPadding(0, dp(12), dp(4), dp(12));
        for (i = 0; i < titles.length; i += 1) { chips.addView(chip(titles[i], i === 0, i === 0 ? C.green : C.blue, function () { toast("筛选条件已切换（演示）"); }), margins(lp(WRAP, dp(40)), 0, 0, 8, 0)); } chipScroll.addView(chips, fp(WRAP, WRAP)); page.content.addView(chipScroll, lp(MATCH, dp(64)));
        var list = card(18), data = [
            ["🇯🇵", "日本 · 东京 01", "主力节点订阅", "Shadowsocks", "23 ms", C.purple, C.purpleSoft], ["🇸🇬", "新加坡 · SG 02", "主力节点订阅", "VLESS", "38 ms", C.blue, C.blueSoft],
            ["🇺🇸", "美国 · 洛杉矶 03", "主力节点订阅", "Trojan", "62 ms", C.coral, C.coralSoft], ["🇩🇪", "德国 · 法兰克福 01", "备用节点订阅", "Shadowsocks", "86 ms", C.purple, C.purpleSoft],
            ["🇭🇰", "香港 · HK 04", "备用节点订阅", "VLESS", "31 ms", C.blue, C.blueSoft], ["🇹🇼", "台湾 · 台北 02", "备用节点订阅", "Hysteria2", "41 ms", C.cyan, C.cyanSoft]
        ];
        for (i = 0; i < data.length; i += 1) { list.addView(node(controller, i, data[i][0], data[i][1], data[i][2], data[i][3], data[i][4], data[i][5], data[i][6]), lp(MATCH, dp(66))); if (i < data.length - 1) { list.addView(divider(false)); } }
        page.content.addView(list); return page.view;
    }

    function levelStyle(level) { if (level === "OK") { return [C.green, C.greenSoft]; } if (level === "WARN") { return [C.orange, C.orangeSoft]; } if (level === "CLEANUP") { return [C.cyan, C.cyanSoft]; } return [C.blue, C.blueSoft]; }
    function logRow(entry) {
        var style = levelStyle(entry.level), v = row(); v.setPadding(dp(9), dp(9), dp(9), dp(9)); v.addView(text(entry.time, 10.3, C.secondary, false), lp(dp(83), WRAP)); v.addView(label(entry.level, style[0], style[1]), lp(dp(entry.level === "CLEANUP" ? 77 : 57), dp(27)));
        var message = text(entry.message, 12, C.text, false); message.setPadding(dp(9), 0, dp(4), 0); v.addView(message, lp(0, WRAP, 1)); var module = text(entry.module, 10.3, "#A0A8B5", false); module.setGravity(Gravity.RIGHT | Gravity.CENTER_VERTICAL); v.addView(module, lp(dp(57), WRAP)); return v;
    }
    function logsPage(controller) {
        var page = scrollPage(), titleRow = row(); titleRow.addView(text("运行日志", 25, C.navy, true)); titleRow.addView(label("● 实时", C.green, C.greenSoft), margins(lp(WRAP, dp(29)), 12, 0, 0, 0)); page.content.addView(titleRow);
        var summary = card(18); summary.setOrientation(LinearLayout.HORIZONTAL); summary.setPadding(dp(6), dp(15), dp(6), dp(15)); var items = [["check", C.green, "当前状态", controller.running ? "运行中" : "已停止"], ["clock", C.blue, "运行时长", "08:35:12"], ["chip", C.purple, "内存占用", "76.3 MB"], ["layers", C.orange, "路由表", "20240"], ["shield", C.green, "清理状态", "就绪"]], i;
        for (i = 0; i < items.length; i += 1) { summary.addView(metric(items[i][0], items[i][1], items[i][2], items[i][3], i === 0 ? "连接正常" : ""), lp(0, WRAP, 1)); if (i < items.length - 1) { summary.addView(divider(true), lp(dp(1), dp(85))); } } page.content.addView(summary, margins(lp(MATCH, WRAP), 0, 16, 0, 0));
        var logCard = card(18); logCard.setPadding(dp(10), dp(10), dp(10), dp(10)); var controls = row(); controls.addView(chip("▽ 全部级别", false, C.blue, function () { toast("日志级别筛选（演示）"); }), lp(dp(124), dp(44)));
        var searchShell = row(); searchShell.setBackground(rounded(C.softSurface, 12, C.line, 1)); searchShell.setPadding(dp(9), 0, dp(7), 0); var search = new EditText(ctx); search.setHint("搜索日志内容…"); search.setHintTextColor(col("#A4ACBA")); search.setTextColor(col(C.text)); search.setTextSize(12.5); search.setSingleLine(true); search.setInputType(InputType.TYPE_CLASS_TEXT); search.setBackgroundColor(Color.TRANSPARENT); searchShell.addView(search, lp(0, dp(44), 1)); searchShell.addView(icon("search", 21, C.secondary, false)); controls.addView(searchShell, margins(lp(0, dp(44), 1), 8, 0, 8, 0));
        controls.addView(button(controller.paused ? "继续" : "暂停", controller.paused ? "play" : "pause", C.text, C.surface, function () { controller.paused = !controller.paused; controller.show(2); }), lp(dp(88), dp(44))); logCard.addView(controls);
        var list = column(); list.setBackground(rounded("#FBFCFD", 14, C.line, 1)); for (i = 0; i < controller.logs.length; i += 1) { list.addView(logRow(controller.logs[i])); if (i < controller.logs.length - 1) { list.addView(divider(false)); } } logCard.addView(list, margins(lp(MATCH, WRAP), 0, 10, 0, 0));
        var footer = row(); footer.setPadding(dp(6), dp(10), dp(6), 0); footer.addView(text("已显示最新 " + controller.logs.length + " 条日志", 11, C.secondary, false), lp(0, WRAP, 1)); footer.addView(text("自动滚动", 11.5, C.text, false)); var sw = new Switch(ctx); sw.setChecked(true); footer.addView(sw, lp(dp(52), dp(38))); logCard.addView(footer); page.content.addView(logCard, margins(lp(MATCH, WRAP), 0, 14, 0, 0));
        var actions = card(18); actions.setOrientation(LinearLayout.HORIZONTAL); actions.setPadding(dp(10), dp(10), dp(10), dp(10)); actions.addView(button("导出日志", "log", C.green, C.greenSoft, function () { toast("日志导出接口待接入"); }), lp(0, dp(54), 1));
        actions.addView(button("清空", "stop", C.coral, C.coralSoft, function () { controller.logs = []; controller.show(2); toast("演示日志已清空"); }), margins(lp(0, dp(54), 1), 10, 0, 10, 0)); actions.addView(button("诊断", "pulse", C.blue, C.blueSoft, function () { toast("诊断完成：未发现 UI 级异常"); }), lp(0, dp(54), 1)); page.content.addView(actions, margins(lp(MATCH, WRAP), 0, 14, 0, 0)); return page.view;
    }

    function taskRow(controller, iconName, accent, soft, titleValue, condition) {
        var v = row(); v.setPadding(dp(10), dp(9), dp(10), dp(9)); v.addView(badge(iconName, accent, soft, 42)); var info = column(); info.setPadding(dp(12), 0, dp(8), 0); info.addView(text(titleValue, 14.3, C.navy, true)); var cond = text("● " + condition, 10.7, C.secondary, false); cond.setPadding(0, dp(5), 0, 0); info.addView(cond); v.addView(info, lp(0, WRAP, 1));
        var sw = new Switch(ctx); sw.setChecked(true); sw.setOnCheckedChangeListener(new JavaAdapter(P.android.widget.CompoundButton.OnCheckedChangeListener, { onCheckedChanged: function (buttonView, checked) { controller.addLog("INFO", titleValue + (checked ? " 已启用" : " 已停用"), "automation"); } })); v.addView(sw, lp(dp(56), dp(42))); var arrow = text("›", 25, C.secondary, false); arrow.setGravity(Gravity.CENTER); v.addView(arrow, lp(dp(26), dp(42))); return v;
    }
    function settingRow(iconName, accent, soft, titleValue, subtitle, value) {
        var v = row(); v.setPadding(dp(10), dp(8), dp(10), dp(8)); v.addView(badge(iconName, accent, soft, 40)); var info = column(); info.setPadding(dp(12), 0, dp(8), 0); info.addView(text(titleValue, 14, C.navy, true)); var s = text(subtitle, 10.7, C.secondary, false); s.setPadding(0, dp(4), 0, 0); info.addView(s); v.addView(info, lp(0, WRAP, 1)); v.addView(text(value, 11.3, C.secondary, false)); var arrow = text("›", 25, C.secondary, false); arrow.setGravity(Gravity.CENTER); v.addView(arrow, lp(dp(28), dp(40))); return click(v, function () { toast(titleValue + "：详情待接入"); });
    }
    function group(titleValue) { var v = card(18); v.setPadding(dp(12), dp(12), dp(12), dp(8)); var t = text(titleValue, 15, C.navy, true); t.setPadding(dp(2), 0, 0, dp(8)); v.addView(t); return v; }
    function engineCard() {
        var shell = new FrameLayout(ctx); shell.setBackground(gradient(["#F7F5FD", "#F7F9FD", "#FCFCFD"], 18, "#E6E3F2")); shell.addView(ArtView(true)); var body = column(); body.setPadding(dp(16), dp(16), dp(16), dp(16)); var head = row(); head.addView(badge("magic", C.purple, C.purpleSoft, 48)); var t = text("ShortX JS Task", 20, C.navy, true); t.setPadding(dp(12), 0, 0, 0); head.addView(t); head.addView(label("● 就绪", C.green, C.greenSoft), margins(lp(WRAP, dp(29)), 12, 0, 0, 0)); body.addView(head);
        var r1 = row(); r1.setPadding(0, dp(16), 0, 0); r1.addView(infoLine("box", "执行引擎", "Rhino ES5"), lp(0, WRAP, 1)); r1.addView(infoLine("clock", "最近运行", "今天 08:42:11"), lp(0, WRAP, 1)); body.addView(r1); var r2 = row(); r2.addView(infoLine("bolt", "触发模式", "事件触发"), lp(0, WRAP, 1)); r2.addView(infoLine("calendar", "下次运行", "条件满足时"), lp(0, WRAP, 1)); body.addView(r2); shell.addView(body, fp(MATCH, MATCH)); return shell;
    }
    function settingsPage(controller) {
        var page = scrollPage(), head = row(); head.addView(badge("settings", C.purple, C.purpleSoft, 52)); var titleBox = column(); titleBox.setPadding(dp(12), 0, 0, 0); titleBox.addView(text("自动化与设置", 24, C.navy, true)); var subtitle = text("管理 ShortX JS 任务与运行时设置", 12.5, C.secondary, false); subtitle.setPadding(0, dp(6), 0, 0); titleBox.addView(subtitle); head.addView(titleBox); page.content.addView(head);
        page.content.addView(engineCard(), margins(lp(MATCH, dp(218)), 0, 16, 0, 0)); var tasks = group("自动化任务"), taskData = [["shield", C.green, C.greenSoft, "启动前校验", "每次启动前执行"], ["cloud", C.purple, C.purpleSoft, "配置备份", "每日 02:00 自动备份"], ["reload", C.orange, C.orangeSoft, "失败回滚", "执行失败时触发"], ["pulse", C.green, C.greenSoft, "健康检查", "每 30 分钟执行"]], i;
        for (i = 0; i < taskData.length; i += 1) { tasks.addView(taskRow(controller, taskData[i][0], taskData[i][1], taskData[i][2], taskData[i][3], taskData[i][4])); if (i < taskData.length - 1) { tasks.addView(divider(false)); } } page.content.addView(tasks, margins(lp(MATCH, WRAP), 0, 14, 0, 0));
        var runtime = group("运行时设置"), settings = [["phone", C.blue, C.blueSoft, "动态 dp 布局", "根据屏幕密度动态计算单位", "已启用"], ["keyboard", C.purple, C.purpleSoft, "IME 避让", "输入法弹出时自动避让", "已启用"], ["moon", C.blue, C.blueSoft, "深色模式", "跟随系统主题", "跟随系统"], ["grid", C.orange, C.orangeSoft, "几何信息记忆", "记住窗口位置与尺寸", "待接入"]];
        for (i = 0; i < settings.length; i += 1) { runtime.addView(settingRow(settings[i][0], settings[i][1], settings[i][2], settings[i][3], settings[i][4], settings[i][5])); if (i < settings.length - 1) { runtime.addView(divider(false)); } } page.content.addView(runtime, margins(lp(MATCH, WRAP), 0, 14, 0, 0));
        var stable = group("稳定性与生命周期"), advanced = [["pulse", C.green, C.greenSoft, "Canvas 无变化停帧", "仅视觉变化时重绘", "已启用"], ["route", C.purple, C.purpleSoft, "系统返回链", "页面返回与窗口关闭统一处理", "已启用"], ["box", C.blue, C.blueSoft, "SQLite 状态持久化", "保存设置、节点与几何状态", "待接入"], ["shield", C.orange, C.orangeSoft, "Runtime 与 UI 生命周期分离", "关闭 UI 不停止 Runtime", "已启用"]];
        for (i = 0; i < advanced.length; i += 1) { stable.addView(settingRow(advanced[i][0], advanced[i][1], advanced[i][2], advanced[i][3], advanced[i][4], advanced[i][5])); if (i < advanced.length - 1) { stable.addView(divider(false)); } } page.content.addView(stable, margins(lp(MATCH, WRAP), 0, 14, 0, 0));
        var env = card(18); env.setPadding(dp(14), dp(12), dp(14), dp(12)); env.addView(text("环境信息", 13.5, C.navy, true)); var envRow = row(); envRow.setPadding(0, dp(12), 0, 0); envRow.addView(metric("phone", C.green, "Android 14", "", ""), lp(0, WRAP, 1)); envRow.addView(divider(true), lp(dp(1), dp(34))); envRow.addView(metric("box", C.purple, "SDK 34", "", ""), lp(0, WRAP, 1)); envRow.addView(divider(true), lp(dp(1), dp(34))); envRow.addView(metric("chip", C.orange, "arm64-v8a", "", ""), lp(0, WRAP, 1)); env.addView(envRow); page.content.addView(env, margins(lp(MATCH, WRAP), 0, 14, 0, 0)); return page.view;
    }

    function initialLogs() { return [
        {time: "08:42:11.235", level: "INFO", message: "配置文件检查通过", module: "config"}, {time: "08:42:11.252", level: "OK", message: "配置加载完成，使用配置文件：config.json", module: "loader"},
        {time: "08:42:11.389", level: "INFO", message: "Runtime daemon 已连接", module: "daemon"}, {time: "08:42:11.521", level: "INFO", message: "TUN 模式已启用，接口：sbh-tun0", module: "tun"},
        {time: "08:42:11.622", level: "OK", message: "TUN 接口附着成功，路由已注入系统", module: "tun"}, {time: "08:42:11.731", level: "INFO", message: "路由表已加载：20240 条", module: "route"},
        {time: "08:42:11.842", level: "OK", message: "规则范围校验通过：8800–8815", module: "rules"}, {time: "08:42:11.953", level: "INFO", message: "DNS 解析器初始化完成", module: "dns"},
        {time: "08:42:12.064", level: "WARN", message: "发现 1 条过期规则，将在清理时移除", module: "rules"}, {time: "08:42:12.175", level: "OK", message: "健康检查通过，所有系统指标正常", module: "health"},
        {time: "08:42:12.286", level: "INFO", message: "创建回滚点：rp_20240527_084212", module: "rollback"}, {time: "08:42:12.397", level: "CLEANUP", message: "清理就绪，未发现残留临时文件", module: "cleanup"}
    ]; }

    function Controller() { this.wm = null; this.root = null; this.content = null; this.nav = null; this.receiver = null; this.page = 0; this.running = true; this.segment = 0; this.node = 0; this.paused = false; this.logs = initialLogs(); this.closed = false; }
    Controller.prototype.addLog = function (level, message, module) {
        if (this.paused) { return; } var d = new Date(); function pad(v, n) { var s = String(v); while (s.length < n) { s = "0" + s; } return s; }
        this.logs.push({time: pad(d.getHours(), 2) + ":" + pad(d.getMinutes(), 2) + ":" + pad(d.getSeconds(), 2) + "." + pad(d.getMilliseconds(), 3), level: level, message: message, module: module}); while (this.logs.length > 50) { this.logs.shift(); }
    };
    Controller.prototype.pageView = function (index) { if (index === 1) { return nodesPage(this); } if (index === 2) { return logsPage(this); } if (index === 3) { return settingsPage(this); } return homePage(this); };
    Controller.prototype.show = function (index) { if (this.closed || this.content === null) { return; } this.page = index; this.content.removeAllViews(); this.content.addView(this.pageView(index), fp(MATCH, MATCH)); this.nav.removeAllViews(); this.nav.addView(bottomNav(this), fp(MATCH, MATCH)); try { this.root.requestFocus(); } catch (ignored) {} };
    Controller.prototype.close = function () { if (this.closed) { return; } this.closed = true; try { if (this.root && this.wm) { this.wm.removeViewImmediate(this.root); } } catch (ignored1) {} try { if (this.receiver) { ctx.unregisterReceiver(this.receiver); } } catch (ignored2) {} this.root = null; this.receiver = null; };
    Controller.prototype.register = function () {
        var self = this; this.receiver = new JavaAdapter(BroadcastReceiver, { onReceive: function (contextValue, intent) { if (intent && String(intent.getAction()) === CLOSE_ACTION) { self.close(); } } }); var filter = new IntentFilter(CLOSE_ACTION);
        if (Build.VERSION.SDK_INT >= 33) { ctx.registerReceiver(this.receiver, filter, Context.RECEIVER_NOT_EXPORTED); } else { ctx.registerReceiver(this.receiver, filter); }
    };
    Controller.prototype.build = function () {
        var self = this, root = new FrameLayout(ctx), shell = column(); root.setBackgroundColor(col(C.bg)); root.setFocusable(true); root.setFocusableInTouchMode(true); shell.setBackgroundColor(col(C.bg)); shell.addView(topBar(), lp(MATCH, dp(88))); this.content = new FrameLayout(ctx); shell.addView(this.content, lp(MATCH, 0, 1)); this.nav = new FrameLayout(ctx); shell.addView(this.nav, lp(MATCH, dp(76))); root.addView(shell, fp(MATCH, MATCH));
        root.setOnKeyListener(new JavaAdapter(P.android.view.View.OnKeyListener, { onKey: function (view, keyCode, event) { if (keyCode === KeyEvent.KEYCODE_BACK && event.getAction() === KeyEvent.ACTION_UP) { if (self.page !== 0) { self.show(0); } else { self.close(); } return true; } return false; } }));
        if (Build.VERSION.SDK_INT >= 20) { root.setOnApplyWindowInsetsListener(new JavaAdapter(P.android.view.View.OnApplyWindowInsetsListener, { onApplyWindowInsets: function (view, insets) { var top = 0, bottom = 0; try { if (Build.VERSION.SDK_INT >= 30) { var bars = insets.getInsets(P.android.view.WindowInsets.Type.systemBars()); top = bars.top; bottom = bars.bottom; } else { top = insets.getSystemWindowInsetTop(); bottom = insets.getSystemWindowInsetBottom(); } } catch (ignored) {} shell.setPadding(0, top, 0, bottom); return insets; } })); }
        this.root = root; this.show(0); return root;
    };
    Controller.prototype.open = function () {
        this.wm = ctx.getSystemService(Context.WINDOW_SERVICE); var type = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
        var flags = WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN | WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS;
        var params = new WindowManager.LayoutParams(MATCH, MATCH, type, flags, P.android.graphics.PixelFormat.TRANSLUCENT); params.gravity = Gravity.TOP | Gravity.START; params.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE | WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN; params.setTitle("SingBoxHub Monet UI Prototype");
        if (Build.VERSION.SDK_INT >= 28) { try { params.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES; } catch (ignored) {} }
        this.wm.addView(this.build(), params); this.register(); this.root.requestFocus();
    };

    function startUi() {
        try { ctx.sendBroadcast(new Intent(CLOSE_ACTION)); } catch (ignored) {}
        handler.postDelayed(new JavaAdapter(java.lang.Runnable, { run: function () { try { new Controller().open(); } catch (error) { toast("SingBoxHub UI 启动失败：" + error); } } }), 180);
    }
    function run() {
        ctx = getContext(); density = ctx.getResources().getDisplayMetrics().density; startUi();
        return {ok: true, project: PROJECT, entryVersion: ENTRY_VERSION, moduleSetVersion: MODULE_VERSION, started: true, status: "monet_ui_prototype_requested", runtimeAttached: false, coreOperationsEnabled: false, destructiveOperations: false, timestamp: new Date().getTime(), message: "Monet UI prototype requested; Runtime controls remain non-destructive placeholders."};
    }
    try { return JSON.stringify(run()); } catch (fatal) { return JSON.stringify({ok: false, project: PROJECT, entryVersion: ENTRY_VERSION, moduleSetVersion: MODULE_VERSION, started: false, status: "ui_start_failed", error: String(fatal), destructiveOperations: false, timestamp: new Date().getTime()}); }
}());
