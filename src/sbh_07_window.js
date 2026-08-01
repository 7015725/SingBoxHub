/* SingBoxHub WindowManager module. Rhino ES5 only. */
SBH.versions.window = 1;

(function () {
    var P = Packages;
    var WindowManager = P.android.view.WindowManager;
    var FrameLayout = P.android.widget.FrameLayout;
    var Gravity = P.android.view.Gravity;
    var KeyEvent = P.android.view.KeyEvent;
    var C = SBH.theme.colors;
    var W = SBH.widgets;
    var MATCH = W.MATCH;

    function createController() {
        var controller = {
            wm: null,
            root: null,
            shell: null,
            content: null,
            nav: null,
            page: 0,
            attached: false,
            visible: false,
            currentPageView: null,
            onHidden: null
        };

        controller.buildTopBar = function () {
            var bar = W.row();
            var brand = W.column();
            var subtitle;
            var bell;
            var more;

            bar.setPadding(
                SBH.util.dp(18),
                SBH.util.dp(12),
                SBH.util.dp(12),
                SBH.util.dp(8)
            );
            bar.setBackgroundColor(SBH.util.color(C.bg));
            bar.addView(W.brandView());

            brand.setPadding(SBH.util.dp(10), 0, 0, 0);
            brand.addView(W.text("SingBoxHub", 24, C.navy, true));
            subtitle = W.text(
                "Runtime Prototype",
                12.5,
                "#9BA6B5",
                false
            );
            subtitle.setPadding(0, SBH.util.dp(3), 0, 0);
            brand.addView(subtitle);
            bar.addView(brand, W.lp(0, W.WRAP, 1));

            bell = new FrameLayout(SBH.ctx);
            bell.setBackground(SBH.theme.rounded(C.surface, 14, C.line, 1));
            bell.addView(
                W.icon("bell", 30, C.text),
                W.fp(MATCH, MATCH, Gravity.CENTER)
            );
            W.click(bell, function () {
                SBH.util.toast("暂无新通知");
            });
            bar.addView(
                bell,
                W.margins(
                    W.lp(SBH.util.dp(48), SBH.util.dp(48)),
                    0,
                    0,
                    5,
                    0
                )
            );

            more = new FrameLayout(SBH.ctx);
            more.addView(
                W.icon("more", 30, C.text),
                W.fp(MATCH, MATCH, Gravity.CENTER)
            );
            W.click(more, function () {
                SBH.util.toast(SBH.bootstrap.moduleSetVersion);
            });
            bar.addView(more, W.lp(SBH.util.dp(42), SBH.util.dp(48)));
            return bar;
        };

        controller.buildRoot = function () {
            var root = new FrameLayout(SBH.ctx);
            var shell = W.column();

            root.setBackgroundColor(SBH.util.color(C.bg));
            root.setFocusable(true);
            root.setFocusableInTouchMode(true);
            shell.setBackgroundColor(SBH.util.color(C.bg));
            shell.addView(
                controller.buildTopBar(),
                W.lp(MATCH, SBH.util.dp(86))
            );

            controller.content = new FrameLayout(SBH.ctx);
            shell.addView(controller.content, W.lp(MATCH, 0, 1));

            controller.nav = new FrameLayout(SBH.ctx);
            shell.addView(
                controller.nav,
                W.lp(MATCH, SBH.util.dp(76))
            );

            root.addView(shell, W.fp(MATCH, MATCH));
            controller.shell = shell;

            root.setOnKeyListener(new JavaAdapter(
                P.android.view.View.OnKeyListener,
                {
                    onKey: function (view, keyCode, event) {
                        if (keyCode === KeyEvent.KEYCODE_BACK &&
                                event.getAction() === KeyEvent.ACTION_UP) {
                            if (controller.page !== 0) {
                                controller.showPage(0);
                            } else {
                                controller.hide();
                            }
                            return true;
                        }
                        return false;
                    }
                }
            ));

            if (SBH.Build.VERSION.SDK_INT >= 20) {
                root.setOnApplyWindowInsetsListener(new JavaAdapter(
                    P.android.view.View.OnApplyWindowInsetsListener,
                    {
                        onApplyWindowInsets: function (view, insets) {
                            var top = 0;
                            var bottom = 0;
                            try {
                                if (SBH.Build.VERSION.SDK_INT >= 30) {
                                    var bars = insets.getInsets(
                                        P.android.view.WindowInsets.Type
                                            .systemBars()
                                    );
                                    top = bars.top;
                                    bottom = bars.bottom;
                                } else {
                                    top = insets.getSystemWindowInsetTop();
                                    bottom = insets.getSystemWindowInsetBottom();
                                }
                            } catch (ignored) {}
                            shell.setPadding(0, top, 0, bottom);
                            return insets;
                        }
                    }
                ));
            }
            return root;
        };

        controller.params = function () {
            var type = SBH.Build.VERSION.SDK_INT >= 26 ?
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY :
                WindowManager.LayoutParams.TYPE_PHONE;
            var flags =
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS;
            var params = new WindowManager.LayoutParams(
                MATCH,
                MATCH,
                type,
                flags,
                P.android.graphics.PixelFormat.TRANSLUCENT
            );
            params.gravity = Gravity.TOP | Gravity.START;
            params.softInputMode =
                WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE |
                WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN;
            params.setTitle("SingBoxHub Modular UI");
            if (SBH.Build.VERSION.SDK_INT >= 28) {
                try {
                    params.layoutInDisplayCutoutMode =
                        WindowManager.LayoutParams
                            .LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
                } catch (ignored) {}
            }
            return params;
        };

        controller.render = function () {
            var pageFactory = SBH.navigation.pages[controller.page];
            var pageView;
            var navView;

            if (!pageFactory) {
                controller.page = 0;
                pageFactory = SBH.navigation.pages[0];
            }
            controller.content.removeAllViews();
            controller.nav.removeAllViews();
            pageView = pageFactory(controller);
            navView = SBH.navigation.build(controller);
            controller.currentPageView = pageView;
            controller.content.addView(pageView, W.fp(MATCH, MATCH));
            controller.nav.addView(navView, W.fp(MATCH, MATCH));
        };

        controller.showPage = function (index) {
            controller.page = Number(index);
            if (controller.root !== null) {
                controller.render();
            }
        };

        controller.open = function () {
            if (controller.attached) {
                controller.visible = true;
                controller.root.setVisibility(P.android.view.View.VISIBLE);
                controller.root.requestFocus();
                return;
            }
            controller.wm = SBH.ctx.getSystemService(
                P.android.content.Context.WINDOW_SERVICE
            );
            controller.root = controller.buildRoot();
            controller.render();
            controller.wm.addView(controller.root, controller.params());
            controller.attached = true;
            controller.visible = true;
            controller.root.requestFocus();
            SBH.log.ok("window", "Window attached");
        };

        controller.hide = function () {
            if (!controller.attached) {
                controller.visible = false;
                return;
            }
            try {
                controller.wm.removeViewImmediate(controller.root);
            } catch (error) {
                SBH.log.warn("window", "removeView failed: " + error);
            }
            controller.attached = false;
            controller.visible = false;
            controller.root = null;
            controller.content = null;
            controller.nav = null;
            controller.shell = null;
            if (controller.onHidden) {
                try {
                    controller.onHidden();
                } catch (ignored) {}
            }
        };

        controller.show = function () {
            if (controller.attached) {
                controller.visible = true;
                controller.root.setVisibility(P.android.view.View.VISIBLE);
                controller.root.requestFocus();
                return;
            }
            controller.open();
        };

        controller.toggle = function () {
            if (controller.attached) {
                controller.hide();
            } else {
                controller.show();
            }
        };

        controller.stop = function () {
            controller.hide();
        };

        controller.status = function () {
            return {
                visible: controller.visible,
                attached: controller.attached,
                page: controller.page
            };
        };

        return controller;
    }

    SBH.window = {
        createController: createController
    };
}());
