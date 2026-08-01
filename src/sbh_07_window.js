/* SingBoxHub responsive WindowManager controller. Rhino ES5 only. */
SBH.versions.window = 5;

(function () {
    var P = Packages;
    var WindowManager = P.android.view.WindowManager;
    var FrameLayout = P.android.widget.FrameLayout;
    var Gravity = P.android.view.Gravity;
    var KeyEvent = P.android.view.KeyEvent;
    var View = P.android.view.View;
    var Context = P.android.content.Context;
    var Runnable = P.java.lang.Runnable;
    var File = P.java.io.File;
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
            runtimeBadge: null,
            page: 0,
            attached: false,
            visible: false,
            rendering: false,
            closing: false,
            stage: "created",
            onHidden: null
        };
        var stateFile = new File(
            SBH.paths.bootstrapDir,
            "full_ui_window_state.json"
        );
        var checkpointPending = null;
        var checkpointWriting = false;

        function flushCheckpoint() {
            var value;
            if (checkpointWriting || checkpointPending === null) {
                return;
            }
            value = checkpointPending;
            checkpointPending = null;
            checkpointWriting = true;
            SBH.util.runBg(
                function () {
                    SBH.files.writeJson(stateFile, value);
                    return true;
                },
                function (ignoredValue, error) {
                    checkpointWriting = false;
                    if (error) {
                        try {
                            SBH.log.warn(
                                "window.checkpoint",
                                SBH.util.errorText(error)
                            );
                        } catch (ignoredLog) {}
                    }
                    if (checkpointPending !== null) {
                        flushCheckpoint();
                    }
                },
                "SingBoxHub-window-state"
            );
        }

        function checkpoint(stage, extra) {
            var value = extra || {};
            controller.stage = stage;
            value.schemaVersion = 2;
            value.stage = stage;
            value.page = controller.page;
            value.attached = controller.attached;
            value.visible = controller.visible;
            value.moduleSetVersion =
                SBH.bootstrap.moduleSetVersion;
            value.updatedAt = SBH.util.now();
            checkpointPending = value;
            flushCheckpoint();
        }

        function hideKeyboard() {
            var imm;
            try {
                imm = SBH.ctx.getSystemService(
                    Context.INPUT_METHOD_SERVICE
                );
                if (controller.root !== null) {
                    imm.hideSoftInputFromWindow(
                        controller.root.getWindowToken(),
                        0
                    );
                    controller.root.clearFocus();
                }
            } catch (ignored) {}
        }

        function runtimePresentation(runtime) {
            if (runtime && runtime.checking === true) {
                return {
                    text: "Runtime 检查中",
                    accent: C.orange,
                    soft: C.orangeSoft
                };
            }
            if (runtime && runtime.coreRunning === true) {
                return {
                    text: "Core 运行中",
                    accent: C.green,
                    soft: C.greenSoft
                };
            }
            if (runtime && runtime.attached === true) {
                return {
                    text: runtime.readOnly === false ?
                        "Runtime 已连接" :
                        "只读已接入",
                    accent: C.green,
                    soft: C.greenSoft
                };
            }
            if (runtime && runtime.rootGranted === true) {
                return {
                    text: "Runtime 不完整",
                    accent: C.orange,
                    soft: C.orangeSoft
                };
            }
            return {
                text: "Runtime 未连接",
                accent: C.coral,
                soft: C.coralSoft
            };
        }

        controller.applyRuntimeBadge = function (runtime) {
            var state;
            if (controller.runtimeBadge === null) {
                return;
            }
            state = runtimePresentation(runtime);
            controller.runtimeBadge.setText(state.text);
            controller.runtimeBadge.setTextColor(
                SBH.util.color(state.accent)
            );
            controller.runtimeBadge.setBackground(
                SBH.theme.rounded(
                    state.soft,
                    12,
                    state.soft,
                    0
                )
            );
        };

        controller.refreshRuntimeBadge = function (force) {
            var runtime = null;

            if (force === true &&
                    SBH.runtime &&
                    typeof SBH.runtime.refreshAsync === "function") {
                SBH.runtime.refreshAsync(function (value, error) {
                    if (error) {
                        SBH.log.warn(
                            "window.runtime",
                            SBH.util.errorText(error)
                        );
                    }
                    if (!controller.closing) {
                        controller.applyRuntimeBadge(value);
                    }
                });
                try {
                    runtime = SBH.runtime.status();
                } catch (ignoredCurrent) {}
                controller.applyRuntimeBadge(runtime);
                return runtime;
            }

            try {
                if (SBH.runtime &&
                        typeof SBH.runtime.status === "function") {
                    runtime = SBH.runtime.status();
                }
            } catch (error) {
                SBH.log.warn(
                    "window.runtime",
                    "Runtime badge read failed: " +
                    SBH.util.errorText(error)
                );
            }
            controller.applyRuntimeBadge(runtime);
            return runtime;
        };

        controller.buildTopBar = function () {
            var bar = W.row();
            var brand = W.column();
            var subtitle;
            var closeBox = new FrameLayout(SBH.ctx);

            bar.setPadding(
                SBH.util.dp(16),
                SBH.util.dp(10),
                SBH.util.dp(10),
                SBH.util.dp(8)
            );
            bar.setBackgroundColor(SBH.util.color(C.bg));
            bar.addView(W.brandView());

            brand.setPadding(SBH.util.dp(10), 0, 0, 0);
            brand.addView(
                W.text("SingBoxHub", 22, C.navy, true)
            );
            subtitle = W.text(
                "ShortX Runtime Console",
                11.8,
                C.secondary,
                false
            );
            subtitle.setPadding(
                0,
                SBH.util.dp(3),
                0,
                0
            );
            brand.addView(subtitle);
            bar.addView(
                brand,
                W.lp(0, W.WRAP, 1)
            );

            controller.runtimeBadge = W.label(
                "Runtime 检查中",
                C.orange,
                C.orangeSoft
            );
            bar.addView(
                controller.runtimeBadge,
                W.margins(
                    W.lp(W.WRAP, SBH.util.dp(30)),
                    0,
                    0,
                    8,
                    0
                )
            );
            controller.refreshRuntimeBadge(false);

            closeBox.setBackground(
                SBH.theme.rounded(
                    C.surface,
                    13,
                    C.line,
                    1
                )
            );
            closeBox.addView(
                W.icon("close", 28, C.text),
                W.fp(MATCH, MATCH, Gravity.CENTER)
            );
            W.click(closeBox, function () {
                controller.hide();
            });
            bar.addView(
                closeBox,
                W.lp(
                    SBH.util.dp(42),
                    SBH.util.dp(42)
                )
            );
            return bar;
        };

        controller.buildRoot = function () {
            var root = new FrameLayout(SBH.ctx);
            var shell = W.column();
            var placeholder = W.text(
                "正在加载 SingBoxHub 界面...",
                14,
                C.secondary,
                false
            );

            root.setBackgroundColor(
                SBH.util.color(C.bg)
            );
            root.setFocusable(true);
            root.setFocusableInTouchMode(true);
            shell.setBackgroundColor(
                SBH.util.color(C.bg)
            );
            shell.addView(
                controller.buildTopBar(),
                W.lp(MATCH, SBH.util.dp(72))
            );

            controller.content =
                new FrameLayout(SBH.ctx);
            placeholder.setGravity(Gravity.CENTER);
            controller.content.addView(
                placeholder,
                W.fp(MATCH, MATCH, Gravity.CENTER)
            );
            shell.addView(
                controller.content,
                W.lp(MATCH, 0, 1)
            );

            controller.nav =
                new FrameLayout(SBH.ctx);
            shell.addView(
                controller.nav,
                W.lp(MATCH, SBH.util.dp(68))
            );

            root.addView(
                shell,
                W.fp(MATCH, MATCH)
            );
            controller.shell = shell;
            root.setOnKeyListener(
                new JavaAdapter(
                    P.android.view.View.OnKeyListener,
                    {
                        onKey: function (
                            view,
                            keyCode,
                            event
                        ) {
                            if (keyCode ===
                                    KeyEvent.KEYCODE_BACK &&
                                    event.getAction() ===
                                    KeyEvent.ACTION_UP) {
                                hideKeyboard();
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
                )
            );
            return root;
        };

        controller.params = function () {
            var type =
                SBH.Build.VERSION.SDK_INT >= 26 ?
                WindowManager.LayoutParams
                    .TYPE_APPLICATION_OVERLAY :
                WindowManager.LayoutParams.TYPE_PHONE;
            var flags =
                WindowManager.LayoutParams
                    .FLAG_NOT_TOUCH_MODAL;
            var params =
                new WindowManager.LayoutParams(
                    MATCH,
                    MATCH,
                    type,
                    flags,
                    P.android.graphics.PixelFormat
                        .TRANSLUCENT
                );
            params.gravity =
                Gravity.TOP | Gravity.START;
            params.windowAnimations = 0;
            params.softInputMode =
                WindowManager.LayoutParams
                    .SOFT_INPUT_ADJUST_RESIZE |
                WindowManager.LayoutParams
                    .SOFT_INPUT_STATE_ALWAYS_HIDDEN;
            params.setTitle("SingBoxHub Full UI");
            return params;
        };

        controller.renderNow = function (index) {
            var pageFactory;
            var pageView;
            var navView;
            var runtime = null;

            if (!controller.attached ||
                    controller.closing ||
                    controller.rendering ||
                    controller.content === null ||
                    controller.nav === null) {
                return;
            }

            controller.rendering = true;
            try {
                controller.page = Number(index);
                pageFactory =
                    SBH.navigation.pages[controller.page];
                if (!pageFactory) {
                    controller.page = 0;
                    pageFactory =
                        SBH.navigation.pages[0];
                }
                if (!pageFactory) {
                    throw new Error(
                        "Home page factory is not registered"
                    );
                }

                checkpoint(
                    "before_page_render",
                    {targetPage: controller.page}
                );
                controller.content.removeAllViews();
                controller.nav.removeAllViews();
                pageView = pageFactory(controller);
                navView =
                    SBH.navigation.build(controller);
                controller.content.addView(
                    pageView,
                    W.fp(MATCH, MATCH)
                );
                controller.nav.addView(
                    navView,
                    W.fp(MATCH, MATCH)
                );

                try {
                    if (SBH.runtime &&
                            typeof SBH.runtime.status ===
                            "function") {
                        runtime =
                            SBH.runtime.status();
                    }
                } catch (ignoredRuntime) {}
                controller.applyRuntimeBadge(runtime);

                checkpoint(
                    "after_page_render",
                    {renderedPage: controller.page}
                );
            } catch (error) {
                try {
                    controller.content.removeAllViews();
                    controller.content.addView(
                        W.text(
                            "界面构建失败: " +
                            SBH.util.errorText(error),
                            13,
                            C.coral,
                            false
                        ),
                        W.fp(
                            MATCH,
                            MATCH,
                            Gravity.CENTER
                        )
                    );
                } catch (ignoredRenderError) {}
                SBH.log.error(
                    "window.render",
                    error
                );
                checkpoint(
                    "page_render_failed",
                    {error: SBH.util.errorText(error)}
                );
            } finally {
                controller.rendering = false;
            }
        };

        controller.showPage = function (index) {
            hideKeyboard();
            SBH.util.runUi(function () {
                controller.renderNow(index);
            });
        };

        controller.open = function () {
            SBH.util.runUi(function () {
                var params;
                try {
                    controller.closing = false;
                    if (controller.attached &&
                            controller.root !== null) {
                        controller.visible = true;
                        controller.root.setVisibility(
                            View.VISIBLE
                        );
                        controller.root.requestFocus();
                        controller.refreshRuntimeBadge(
                            false
                        );
                        checkpoint(
                            "shown_existing",
                            {}
                        );
                        return;
                    }

                    checkpoint(
                        "before_build_shell",
                        {}
                    );
                    controller.wm =
                        SBH.ctx.getSystemService(
                            Context.WINDOW_SERVICE
                        );
                    controller.root =
                        controller.buildRoot();
                    params = controller.params();
                    checkpoint(
                        "before_add_view",
                        {
                            type: Number(params.type),
                            flags: Number(params.flags)
                        }
                    );
                    controller.wm.addView(
                        controller.root,
                        params
                    );
                    controller.attached = true;
                    controller.visible = true;
                    checkpoint(
                        "after_add_view",
                        {}
                    );

                    SBH.handler.postDelayed(
                        new JavaAdapter(
                            Runnable,
                            {
                                run: function () {
                                    if (!controller.attached ||
                                            controller.closing ||
                                            controller.root ===
                                            null) {
                                        return;
                                    }
                                    controller.renderNow(
                                        controller.page
                                    );
                                    try {
                                        controller.root
                                            .requestFocus();
                                    } catch (
                                        ignoredFocus
                                    ) {}
                                }
                            }
                        ),
                        60
                    );
                    SBH.log.ok(
                        "window",
                        "Full UI window attached"
                    );
                } catch (error) {
                    controller.attached = false;
                    controller.visible = false;
                    controller.closing = false;
                    checkpoint(
                        "open_failed",
                        {
                            error:
                                SBH.util.errorText(error)
                        }
                    );
                    SBH.log.error(
                        "window.open",
                        error
                    );
                    try {
                        if (controller.wm !== null &&
                                controller.root !== null) {
                            controller.wm.removeView(
                                controller.root
                            );
                        }
                    } catch (ignoredCleanup) {}
                    controller.root = null;
                    controller.content = null;
                    controller.nav = null;
                    controller.shell = null;
                    controller.runtimeBadge = null;
                }
            });
        };

        controller.hide = function () {
            SBH.util.runUi(function () {
                var root = controller.root;
                if (!controller.attached ||
                        root === null) {
                    controller.visible = false;
                    return;
                }

                controller.closing = true;
                hideKeyboard();
                checkpoint(
                    "before_remove_view",
                    {}
                );
                try {
                    controller.wm.removeView(root);
                } catch (error) {
                    SBH.log.warn(
                        "window",
                        "removeView failed: " +
                        error
                    );
                }

                controller.attached = false;
                controller.visible = false;
                controller.root = null;
                controller.content = null;
                controller.nav = null;
                controller.shell = null;
                controller.runtimeBadge = null;
                checkpoint(
                    "after_remove_view",
                    {}
                );

                if (controller.onHidden) {
                    try {
                        controller.onHidden();
                    } catch (ignoredHidden) {}
                }
                controller.closing = false;
            });
        };

        controller.show = function () {
            if (controller.attached) {
                SBH.util.runUi(function () {
                    if (controller.root !== null) {
                        controller.root.setVisibility(
                            View.VISIBLE
                        );
                        controller.root.requestFocus();
                        controller.visible = true;
                        controller.refreshRuntimeBadge(
                            false
                        );
                    }
                });
            } else {
                controller.open();
            }
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
                page: controller.page,
                stage: controller.stage,
                rendering: controller.rendering,
                closing: controller.closing
            };
        };

        return controller;
    }

    SBH.window = {
        createController: createController
    };
}());
