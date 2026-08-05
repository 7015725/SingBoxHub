/* SingBoxHub Stage31 Retry5 explicit FrameLayout geometry. Rhino ES5 only. */
SBH.versions.windowExplicitGeometry = 1;

(function () {
    "use strict";

    var P = Packages;
    var WindowManager = P.android.view.WindowManager;
    var View = P.android.view.View;
    var ViewGroup = P.android.view.ViewGroup;
    var FrameLayout = P.android.widget.FrameLayout;
    var Gravity = P.android.view.Gravity;
    var Context = P.android.content.Context;
    var Runnable = P.java.lang.Runnable;
    var CountDownLatch = P.java.util.concurrent.CountDownLatch;
    var TimeUnit = P.java.util.concurrent.TimeUnit;
    var MeasureSpec = P.android.view.View.MeasureSpec;
    var originalCreate = SBH.window.createController;
    var originalStart = SBH.app.start;
    var TOP_DP = 72;
    var NAV_DP = 68;
    var OPEN_WAIT_SECONDS = 5;

    function dp(value) {
        return SBH.util.dp(value);
    }

    function childCount(view) {
        try {
            return view === null || view === undefined ?
                -1 : Number(view.getChildCount());
        } catch (ignored) {
            return -1;
        }
    }

    function dimension(view, method) {
        try {
            return view === null || view === undefined ?
                -1 : Number(view[method]());
        } catch (ignored) {
            return -1;
        }
    }

    function displaySize() {
        var metrics = SBH.ctx.getResources().getDisplayMetrics();
        return {
            width: Number(metrics.widthPixels),
            height: Number(metrics.heightPixels)
        };
    }

    function snapshot(controller) {
        return {
            attached: controller.attached === true,
            visible: controller.visible === true,
            page: Number(controller.page || 0),
            firstRenderSynchronous:
                controller.firstRenderSynchronous === true,
            explicitGeometryApplied:
                controller.explicitGeometryApplied === true,
            rootWidth: dimension(controller.root, "getWidth"),
            rootHeight: dimension(controller.root, "getHeight"),
            rootMeasuredWidth:
                dimension(controller.root, "getMeasuredWidth"),
            rootMeasuredHeight:
                dimension(controller.root, "getMeasuredHeight"),
            shellWidth: dimension(controller.shell, "getWidth"),
            shellHeight: dimension(controller.shell, "getHeight"),
            shellMeasuredWidth:
                dimension(controller.shell, "getMeasuredWidth"),
            shellMeasuredHeight:
                dimension(controller.shell, "getMeasuredHeight"),
            contentWidth:
                dimension(controller.content, "getWidth"),
            contentHeight:
                dimension(controller.content, "getHeight"),
            contentMeasuredWidth:
                dimension(controller.content, "getMeasuredWidth"),
            contentMeasuredHeight:
                dimension(controller.content, "getMeasuredHeight"),
            navWidth: dimension(controller.nav, "getWidth"),
            navHeight: dimension(controller.nav, "getHeight"),
            navMeasuredWidth:
                dimension(controller.nav, "getMeasuredWidth"),
            navMeasuredHeight:
                dimension(controller.nav, "getMeasuredHeight"),
            contentChildCount: childCount(controller.content),
            navChildCount: childCount(controller.nav),
            topHeightPx: dp(TOP_DP),
            navHeightPx: dp(NAV_DP)
        };
    }

    function applyGeometry(controller, root) {
        var oldShell = controller.shell;
        var topBar;
        var geometry = new FrameLayout(SBH.ctx);
        var topParams;
        var contentParams;
        var navParams;

        if (oldShell === null || oldShell === undefined ||
                oldShell.getChildCount() < 3) {
            throw new Error("WINDOW_BASE_SHELL_INVALID");
        }

        topBar = oldShell.getChildAt(0);

        oldShell.removeView(topBar);
        oldShell.removeView(controller.content);
        oldShell.removeView(controller.nav);
        root.removeAllViews();

        geometry.setBackgroundColor(
            SBH.util.color(SBH.theme.colors.bg)
        );

        topParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(TOP_DP)
        );
        topParams.gravity = Gravity.TOP;
        geometry.addView(topBar, topParams);

        contentParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        );
        contentParams.topMargin = dp(TOP_DP);
        contentParams.bottomMargin = dp(NAV_DP);
        controller.content.setVisibility(View.VISIBLE);
        geometry.addView(controller.content, contentParams);

        navParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(NAV_DP)
        );
        navParams.gravity = Gravity.BOTTOM;
        controller.nav.setVisibility(View.VISIBLE);
        geometry.addView(controller.nav, navParams);

        root.addView(
            geometry,
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );

        controller.shell = geometry;
        controller.explicitGeometryApplied = true;
        return root;
    }

    function forceMeasure(controller) {
        var size = displaySize();
        var widthSpec = MeasureSpec.makeMeasureSpec(
            size.width,
            MeasureSpec.EXACTLY
        );
        var heightSpec = MeasureSpec.makeMeasureSpec(
            size.height,
            MeasureSpec.EXACTLY
        );

        controller.root.measure(widthSpec, heightSpec);
        controller.root.layout(0, 0, size.width, size.height);
        controller.root.requestLayout();
        controller.root.invalidate();
    }

    function executeOpen(controller) {
        var params;

        controller.closing = false;

        if (controller.attached && controller.root !== null) {
            controller.visible = true;
            controller.root.setVisibility(View.VISIBLE);
            controller.renderNow(controller.page);
            forceMeasure(controller);
            controller.root.requestFocus();
            controller.firstRenderSynchronous = true;
            controller.geometrySnapshot = snapshot(controller);
            return true;
        }

        controller.wm = SBH.ctx.getSystemService(
            Context.WINDOW_SERVICE
        );
        controller.root = controller.buildRoot();
        params = controller.params();

        controller.wm.addView(controller.root, params);
        controller.attached = true;
        controller.visible = true;

        controller.renderNow(controller.page);
        forceMeasure(controller);
        controller.root.requestFocus();

        controller.firstRenderSynchronous = true;
        controller.geometrySnapshot = snapshot(controller);

        if (controller.geometrySnapshot.contentChildCount < 1 ||
                controller.geometrySnapshot.navChildCount < 1) {
            throw new Error("EXPLICIT_GEOMETRY_CHILDREN_MISSING");
        }

        if (controller.geometrySnapshot.contentMeasuredHeight <= 0 ||
                controller.geometrySnapshot.navMeasuredHeight <= 0) {
            throw new Error("EXPLICIT_GEOMETRY_MEASURED_HEIGHT_INVALID");
        }

        SBH.log.ok(
            "window",
            "Full UI attached with explicit FrameLayout geometry"
        );
        return true;
    }

    function cleanup(controller) {
        try {
            if (controller.wm !== null &&
                    controller.root !== null) {
                controller.wm.removeView(controller.root);
            }
        } catch (ignoredCleanup) {}

        controller.attached = false;
        controller.visible = false;
        controller.closing = false;
        controller.root = null;
        controller.content = null;
        controller.nav = null;
        controller.shell = null;
        controller.runtimeBadge = null;
        controller.firstRenderSynchronous = false;
    }

    if (typeof originalCreate !== "function") {
        throw new Error("Original window controller unavailable");
    }

    SBH.window.createController = function () {
        var controller = originalCreate();
        var originalBuildRoot = controller.buildRoot;
        var originalStatus = controller.status;

        controller.explicitGeometryApplied = false;
        controller.firstRenderSynchronous = false;
        controller.geometrySnapshot = null;

        controller.buildRoot = function () {
            return applyGeometry(
                controller,
                originalBuildRoot()
            );
        };

        controller.open = function () {
            var failure = null;
            var latch;
            var posted;

            if (SBH.util.isUiThread()) {
                try {
                    return executeOpen(controller);
                } catch (error) {
                    cleanup(controller);
                    SBH.log.error(
                        "window.explicit_geometry",
                        error
                    );
                    throw error;
                }
            }

            latch = new CountDownLatch(1);
            posted = SBH.handler.post(new JavaAdapter(Runnable, {
                run: function () {
                    try {
                        executeOpen(controller);
                    } catch (error) {
                        failure = error;
                        cleanup(controller);
                        SBH.log.error(
                            "window.explicit_geometry",
                            error
                        );
                    } finally {
                        latch.countDown();
                    }
                }
            }));

            if (posted !== true) {
                throw new Error("WINDOW_UI_TASK_POST_FAILED");
            }

            if (!latch.await(
                    OPEN_WAIT_SECONDS,
                    TimeUnit.SECONDS
                )) {
                throw new Error(
                    "WINDOW_EXPLICIT_GEOMETRY_OPEN_TIMEOUT"
                );
            }

            if (failure !== null) {
                throw failure;
            }

            return true;
        };

        controller.status = function () {
            var value = originalStatus();
            var current = snapshot(controller);

            value.firstRenderSynchronous =
                current.firstRenderSynchronous;
            value.explicitGeometryApplied =
                current.explicitGeometryApplied;
            value.rootMeasuredWidth =
                current.rootMeasuredWidth;
            value.rootMeasuredHeight =
                current.rootMeasuredHeight;
            value.shellMeasuredWidth =
                current.shellMeasuredWidth;
            value.shellMeasuredHeight =
                current.shellMeasuredHeight;
            value.contentMeasuredWidth =
                current.contentMeasuredWidth;
            value.contentMeasuredHeight =
                current.contentMeasuredHeight;
            value.navMeasuredWidth =
                current.navMeasuredWidth;
            value.navMeasuredHeight =
                current.navMeasuredHeight;
            value.contentChildCount =
                current.contentChildCount;
            value.navChildCount =
                current.navChildCount;
            return value;
        };

        return controller;
    };

    if (typeof originalStart !== "function") {
        throw new Error("Original app.start unavailable");
    }

    SBH.app.start = function () {
        var output = originalStart();
        var app = SBH.global.__SBH_APP__;
        var controller = app && app.controller ?
            app.controller : null;
        var geometry = controller ?
            snapshot(controller) : null;

        output.runtimeWindowGeometry = geometry;
        output.explicitGeometryApplied =
            geometry && geometry.explicitGeometryApplied === true;
        output.firstRenderSynchronous =
            geometry && geometry.firstRenderSynchronous === true;
        output.contentChildCount =
            geometry ? geometry.contentChildCount : -1;
        output.navChildCount =
            geometry ? geometry.navChildCount : -1;
        output.contentMeasuredHeight =
            geometry ? geometry.contentMeasuredHeight : -1;
        output.navMeasuredHeight =
            geometry ? geometry.navMeasuredHeight : -1;
        output.uiGeometryReady =
            output.contentChildCount > 0 &&
            output.navChildCount > 0 &&
            output.contentMeasuredHeight > 0 &&
            output.navMeasuredHeight > 0;
        output.writeOperationsLocked = true;
        output.runtimeFilesModified = false;
        output.coreStartInvoked = false;
        output.coreStopInvoked = false;
        output.tunCreated = false;
        output.routeModified = false;
        output.configModified = false;
        output.destructiveOperations = false;
        return output;
    };
}());
