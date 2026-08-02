/* SingBoxHub Stage33 Retry5: ClipHub modal focus parity. Rhino ES5 only. */
SBH.versions.clipHubModalFocusParity = 1;

(function () {
    "use strict";

    var P = Packages;
    var WindowManager = P.android.view.WindowManager;
    var Runnable = P.java.lang.Runnable;
    var CountDownLatch = P.java.util.concurrent.CountDownLatch;
    var TimeUnit = P.java.util.concurrent.TimeUnit;
    var originalCreate = SBH.window.createController;
    var originalStart = SBH.app.start;
    var FOCUS_SETTLE_MS = 180;
    var MAIN_TIMEOUT_MS = 3000;

    function errorText(error) {
        try {
            return SBH.util.errorText(error);
        } catch (ignored) {
            return String(error);
        }
    }

    function hasFlag(flags, flag) {
        return (Number(flags) & Number(flag)) !== 0;
    }

    function snapshotParams(params) {
        var flags = params ? Number(params.flags) : 0;
        return {
            type: params ? Number(params.type) : null,
            flags: flags,
            notFocusable: hasFlag(
                flags,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
            ),
            notTouchModal: hasFlag(
                flags,
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
            ),
            altFocusableIm: hasFlag(
                flags,
                WindowManager.LayoutParams.FLAG_ALT_FOCUSABLE_IM
            ),
            layoutInScreen: hasFlag(
                flags,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
            ),
            hardwareAccelerated: hasFlag(
                flags,
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
            ),
            dimBehind: hasFlag(
                flags,
                WindowManager.LayoutParams.FLAG_DIM_BEHIND
            )
        };
    }

    function applyParity(controller, params, source) {
        var before;
        var flags;

        if (params === null || params === undefined) {
            throw new Error("WINDOW_LAYOUT_PARAMS_UNAVAILABLE");
        }

        before = snapshotParams(params);
        flags = Number(params.flags);
        flags = flags & ~Number(
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
        );
        flags = flags & ~Number(
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
        );
        flags = flags & ~Number(
            WindowManager.LayoutParams.FLAG_ALT_FOCUSABLE_IM
        );
        flags = flags | Number(
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
        );
        flags = flags | Number(
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
        );
        params.flags = flags;

        controller.modalFocusParityApplyCount += 1;
        controller.modalFocusParityLastSource = String(source);
        controller.modalFocusParityBefore = before;
        controller.modalFocusParityAfter = snapshotParams(params);
        return params;
    }

    function snapshotFocus(controller) {
        var root = controller.root;
        var params = null;

        try {
            params = root !== null ? root.getLayoutParams() : null;
        } catch (ignoredParams) {}

        controller.modalFocusParityAttached =
            root !== null &&
            root !== undefined &&
            root.isAttachedToWindow() === true;
        controller.modalFocusParityRootFocused =
            root !== null &&
            root !== undefined &&
            root.isFocused() === true;
        controller.modalFocusParityWindowFocused =
            root !== null &&
            root !== undefined &&
            root.hasWindowFocus() === true;
        controller.modalFocusParityActualParams =
            snapshotParams(params);
        return controller.modalFocusParityWindowFocused;
    }

    function enforceOnMain(controller) {
        var root = controller.root;
        var params;

        if (root === null || root === undefined) {
            throw new Error("WINDOW_ROOT_UNAVAILABLE");
        }
        if (root.isAttachedToWindow() !== true) {
            throw new Error("WINDOW_ROOT_NOT_ATTACHED");
        }

        params = root.getLayoutParams();
        applyParity(controller, params, "attached_update");
        controller.wm.updateViewLayout(root, params);
        controller.modalFocusParityUpdateCount += 1;

        root.setFocusable(true);
        root.setFocusableInTouchMode(true);
        controller.modalFocusParityRequestFocusResult =
            root.requestFocus() === true;
        snapshotFocus(controller);
        return true;
    }

    function runMainSync(controller, callback) {
        var latch;
        var posted;
        var value = null;
        var failure = null;

        if (SBH.util.isUiThread()) {
            return callback();
        }

        latch = new CountDownLatch(1);
        posted = SBH.handler.post(new JavaAdapter(Runnable, {
            run: function () {
                try {
                    value = callback();
                } catch (error) {
                    failure = error;
                } finally {
                    latch.countDown();
                }
            }
        }));

        if (posted !== true) {
            throw new Error("FOCUS_PARITY_MAIN_POST_FAILED");
        }
        if (!latch.await(
                MAIN_TIMEOUT_MS,
                TimeUnit.MILLISECONDS
            )) {
            throw new Error("FOCUS_PARITY_MAIN_TIMEOUT");
        }
        if (failure !== null) {
            throw failure;
        }
        return value;
    }

    function settleFocus(controller) {
        var latch;
        var posted;
        var failure = null;

        if (SBH.util.isUiThread()) {
            snapshotFocus(controller);
            return true;
        }

        latch = new CountDownLatch(1);
        posted = SBH.handler.postDelayed(
            new JavaAdapter(Runnable, {
                run: function () {
                    try {
                        if (controller.root !== null &&
                                controller.root.isAttachedToWindow()) {
                            controller.root.setFocusable(true);
                            controller.root.setFocusableInTouchMode(true);
                            controller.root.requestFocus();
                            snapshotFocus(controller);
                        }
                    } catch (error) {
                        failure = error;
                    } finally {
                        latch.countDown();
                    }
                }
            }),
            FOCUS_SETTLE_MS
        );

        if (posted !== true) {
            throw new Error("FOCUS_SETTLE_POST_FAILED");
        }
        if (!latch.await(
                MAIN_TIMEOUT_MS,
                TimeUnit.MILLISECONDS
            )) {
            throw new Error("FOCUS_SETTLE_TIMEOUT");
        }
        if (failure !== null) {
            throw failure;
        }
        return true;
    }

    if (typeof originalCreate !== "function") {
        throw new Error("Original window controller unavailable");
    }

    SBH.window.createController = function () {
        var controller = originalCreate();
        var originalParams = controller.params;
        var originalOpen = controller.open;
        var originalStatus = controller.status;

        controller.modalFocusParityVersion = 1;
        controller.modalFocusParityApplyCount = 0;
        controller.modalFocusParityUpdateCount = 0;
        controller.modalFocusParityLastSource = null;
        controller.modalFocusParityBefore = null;
        controller.modalFocusParityAfter = null;
        controller.modalFocusParityActualParams = null;
        controller.modalFocusParityAttached = false;
        controller.modalFocusParityRootFocused = false;
        controller.modalFocusParityWindowFocused = false;
        controller.modalFocusParityRequestFocusResult = null;
        controller.modalFocusParityError = null;

        controller.params = function () {
            return applyParity(
                controller,
                originalParams(),
                "before_add_view"
            );
        };

        controller.open = function () {
            var result = originalOpen();
            try {
                runMainSync(controller, function () {
                    return enforceOnMain(controller);
                });
                settleFocus(controller);
                if (typeof controller.clipHubBackScanNow ===
                        "function") {
                    controller.clipHubBackScanNow();
                }
            } catch (error) {
                controller.modalFocusParityError =
                    errorText(error).substring(0, 300);
            }
            return result;
        };

        controller.status = function () {
            var value = originalStatus();
            try {
                snapshotFocus(controller);
            } catch (error) {
                controller.modalFocusParityError =
                    errorText(error).substring(0, 300);
            }

            value.modalFocusParityVersion =
                controller.modalFocusParityVersion;
            value.modalFocusParityApplyCount =
                controller.modalFocusParityApplyCount;
            value.modalFocusParityUpdateCount =
                controller.modalFocusParityUpdateCount;
            value.modalFocusParityLastSource =
                controller.modalFocusParityLastSource;
            value.modalFocusParityBefore =
                controller.modalFocusParityBefore;
            value.modalFocusParityAfter =
                controller.modalFocusParityAfter;
            value.modalFocusParityActualParams =
                controller.modalFocusParityActualParams;
            value.modalFocusParityAttached =
                controller.modalFocusParityAttached === true;
            value.modalFocusParityRootFocused =
                controller.modalFocusParityRootFocused === true;
            value.modalFocusParityWindowFocused =
                controller.modalFocusParityWindowFocused === true;
            value.modalFocusParityRequestFocusResult =
                controller.modalFocusParityRequestFocusResult;
            value.modalFocusParityError =
                controller.modalFocusParityError;
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
        var status = null;

        if (controller !== null &&
                typeof controller.status === "function") {
            status = controller.status();
        }

        output.modalFocusParityVersion = 1;
        output.modalFocusParityReference =
            "7015725/ClipHub:src/ch_11_filter.js";
        output.modalFocusParityOnly = true;
        output.customEdgeGestureInstalled = false;
        output.modalFocusParityApplied =
            status &&
            status.modalFocusParityApplyCount >= 2;
        output.modalFocusParityBefore =
            status ? status.modalFocusParityBefore : null;
        output.modalFocusParityAfter =
            status ? status.modalFocusParityAfter : null;
        output.modalFocusParityActualParams =
            status ? status.modalFocusParityActualParams : null;
        output.modalFocusParityAttached =
            status && status.modalFocusParityAttached === true;
        output.modalFocusParityRootFocused =
            status && status.modalFocusParityRootFocused === true;
        output.modalFocusParityWindowFocused =
            status && status.modalFocusParityWindowFocused === true;
        output.modalFocusParityRequestFocusResult =
            status ?
            status.modalFocusParityRequestFocusResult : null;
        output.modalFocusParityError =
            status ? status.modalFocusParityError : null;
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
