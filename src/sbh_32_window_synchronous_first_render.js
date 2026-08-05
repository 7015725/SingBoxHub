/* SingBoxHub Stage31 Retry3 synchronous first window render. Rhino ES5 only. */
SBH.versions.windowSynchronousFirstRender = 1;

(function () {
    "use strict";

    var P = Packages;
    var View = P.android.view.View;
    var Context = P.android.content.Context;
    var Runnable = P.java.lang.Runnable;
    var CountDownLatch = P.java.util.concurrent.CountDownLatch;
    var TimeUnit = P.java.util.concurrent.TimeUnit;
    var originalCreate = SBH.window.createController;
    var OPEN_WAIT_SECONDS = 4;

    function childCount(view) {
        try {
            return view === null || view === undefined ?
                -1 : Number(view.getChildCount());
        } catch (ignored) {
            return -1;
        }
    }

    function executeOpen(controller) {
        var params;

        controller.closing = false;

        if (controller.attached && controller.root !== null) {
            controller.visible = true;
            controller.root.setVisibility(View.VISIBLE);
            controller.renderNow(controller.page);
            controller.root.requestFocus();
            controller.firstRenderSynchronous = true;
            controller.firstRenderContentChildCount =
                childCount(controller.content);
            controller.firstRenderNavChildCount =
                childCount(controller.nav);
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
        controller.root.requestFocus();
        controller.firstRenderSynchronous = true;
        controller.firstRenderContentChildCount =
            childCount(controller.content);
        controller.firstRenderNavChildCount =
            childCount(controller.nav);

        if (controller.firstRenderContentChildCount < 1 ||
                controller.firstRenderNavChildCount < 1) {
            throw new Error("SYNCHRONOUS_FIRST_RENDER_EMPTY");
        }

        SBH.log.ok(
            "window",
            "Full UI attached with synchronous first render"
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
        var originalStatus = controller.status;

        controller.firstRenderSynchronous = false;
        controller.firstRenderContentChildCount = -1;
        controller.firstRenderNavChildCount = -1;

        controller.open = function () {
            var failure = null;
            var latch;
            var posted;

            if (SBH.util.isUiThread()) {
                try {
                    return executeOpen(controller);
                } catch (error) {
                    cleanup(controller);
                    SBH.log.error("window.sync_open", error);
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
                        SBH.log.error("window.sync_open", error);
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
                throw new Error("WINDOW_SYNCHRONOUS_OPEN_TIMEOUT");
            }

            if (failure !== null) {
                throw failure;
            }

            return true;
        };

        controller.status = function () {
            var value = originalStatus();
            value.firstRenderSynchronous =
                controller.firstRenderSynchronous === true;
            value.contentChildCount =
                childCount(controller.content);
            value.navChildCount =
                childCount(controller.nav);
            value.firstRenderContentChildCount =
                controller.firstRenderContentChildCount;
            value.firstRenderNavChildCount =
                controller.firstRenderNavChildCount;
            return value;
        };

        return controller;
    };
}());
