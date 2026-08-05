/* SingBoxHub Stage31 Retry6 startup UI finalizer. Rhino ES5 only. */
SBH.versions.runtimeStartupUiFinalizer = 1;

(function () {
    "use strict";

    var P = Packages;
    var ViewGroup = P.android.view.ViewGroup;
    var Runnable = P.java.lang.Runnable;
    var CountDownLatch = P.java.util.concurrent.CountDownLatch;
    var TimeUnit = P.java.util.concurrent.TimeUnit;
    var MeasureSpec = P.android.view.View.MeasureSpec;
    var originalStart = SBH.app.start;
    var FINALIZE_WAIT_SECONDS = 5;

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

    function snapshot(controller) {
        return {
            attached: controller && controller.attached === true,
            visible: controller && controller.visible === true,
            page: controller ? Number(controller.page || 0) : null,
            rendering: controller && controller.rendering === true,
            closing: controller && controller.closing === true,
            contentChildCount: controller ?
                childCount(controller.content) : -1,
            navChildCount: controller ?
                childCount(controller.nav) : -1,
            contentMeasuredWidth: controller ?
                dimension(controller.content, "getMeasuredWidth") : -1,
            contentMeasuredHeight: controller ?
                dimension(controller.content, "getMeasuredHeight") : -1,
            navMeasuredWidth: controller ?
                dimension(controller.nav, "getMeasuredWidth") : -1,
            navMeasuredHeight: controller ?
                dimension(controller.nav, "getMeasuredHeight") : -1,
            rootMeasuredWidth: controller ?
                dimension(controller.root, "getMeasuredWidth") : -1,
            rootMeasuredHeight: controller ?
                dimension(controller.root, "getMeasuredHeight") : -1
        };
    }

    function finalizeOnUi(controller, runtime) {
        if (!controller || !controller.root ||
                !controller.content || !controller.nav) {
            throw new Error("STARTUP_UI_CONTROLLER_INCOMPLETE");
        }

        if (controller.rendering === true) {
            controller.rendering = false;
        }

        if (runtime &&
                typeof controller.applyRuntimeBadge === "function") {
            controller.applyRuntimeBadge(runtime);
        }

        if (typeof controller.renderNow !== "function") {
            throw new Error("STARTUP_RENDER_NOW_UNAVAILABLE");
        }

        controller.renderNow(0);
        forceMeasure(controller);
        controller.root.requestFocus();

        return snapshot(controller);
    }

    function finalizeAndWait(controller, runtime) {
        var result = null;
        var failure = null;
        var latch;
        var posted;

        if (SBH.util.isUiThread()) {
            return finalizeOnUi(controller, runtime);
        }

        latch = new CountDownLatch(1);
        posted = SBH.handler.post(new JavaAdapter(Runnable, {
            run: function () {
                try {
                    result = finalizeOnUi(controller, runtime);
                } catch (error) {
                    failure = error;
                } finally {
                    latch.countDown();
                }
            }
        }));

        if (posted !== true) {
            throw new Error("STARTUP_UI_FINALIZER_POST_FAILED");
        }

        if (!latch.await(
                FINALIZE_WAIT_SECONDS,
                TimeUnit.SECONDS
            )) {
            throw new Error("STARTUP_UI_FINALIZER_TIMEOUT");
        }

        if (failure !== null) {
            throw failure;
        }

        return result;
    }

    function runtimeStatus() {
        if (!SBH.runtime ||
                typeof SBH.runtime.status !== "function") {
            return null;
        }
        return SBH.runtime.status();
    }

    if (typeof originalStart !== "function") {
        throw new Error("Original app.start unavailable");
    }

    SBH.app.start = function () {
        var originalRefreshAsync = SBH.runtime.refreshAsync;
        var suppressedInitialRefreshCount = 0;
        var output;
        var app;
        var controller;
        var runtime;
        var geometry;
        var gate;
        var finalizationError = null;

        SBH.runtime.refreshAsync = function (callback) {
            suppressedInitialRefreshCount += 1;
            return typeof callback === "function" || callback === undefined;
        };

        try {
            output = originalStart();
        } finally {
            SBH.runtime.refreshAsync = originalRefreshAsync;
        }

        app = SBH.global.__SBH_APP__;
        controller = app && app.controller ? app.controller : null;
        runtime = runtimeStatus();

        try {
            geometry = finalizeAndWait(controller, runtime);
        } catch (error) {
            finalizationError = SBH.util.errorText(error);
            geometry = snapshot(controller);
            SBH.log.error("runtime.startup_ui_finalizer", error);
        }

        gate = runtime && runtime.writeGate ? runtime.writeGate : null;

        output.startupInitialRefreshSuppressed =
            suppressedInitialRefreshCount > 0;
        output.suppressedInitialRefreshCount =
            suppressedInitialRefreshCount;
        output.startupUiFinalizerVersion = 1;
        output.startupUiFinalizationAttempted = true;
        output.startupUiFinalizationError = finalizationError;
        output.startupUiGeometry = geometry;
        output.startupContentChildCount =
            geometry ? geometry.contentChildCount : -1;
        output.startupNavChildCount =
            geometry ? geometry.navChildCount : -1;
        output.startupContentMeasuredHeight =
            geometry ? geometry.contentMeasuredHeight : -1;
        output.startupNavMeasuredHeight =
            geometry ? geometry.navMeasuredHeight : -1;
        output.startupUiReady =
            finalizationError === null &&
            output.startupContentChildCount > 0 &&
            output.startupNavChildCount > 0 &&
            output.startupContentMeasuredHeight > 0 &&
            output.startupNavMeasuredHeight > 0;
        output.runtimeWriteGate = gate && gate.state ?
            String(gate.state) :
            String(output.runtimeWriteGate || "checking");
        output.runtimeWriteGateDetails = gate ||
            output.runtimeWriteGateDetails || null;
        output.runtimeCheckPending = false;
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
