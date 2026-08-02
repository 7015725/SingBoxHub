/* SingBoxHub Stage33 Retry4: edge back gesture fallback. Rhino ES5 only. */
SBH.versions.edgeBackFallback = 1;

(function () {
    "use strict";

    var P = Packages;
    var View = P.android.view.View;
    var MotionEvent = P.android.view.MotionEvent;
    var Gravity = P.android.view.Gravity;
    var Rect = P.android.graphics.Rect;
    var ArrayList = P.java.util.ArrayList;
    var HapticFeedbackConstants =
        P.android.view.HapticFeedbackConstants;
    var originalCreate = SBH.window.createController;
    var originalStart = SBH.app.start;
    var EDGE_WIDTH_DP = 28;
    var TRIGGER_DISTANCE_DP = 64;
    var MAX_VERTICAL_DP = 88;
    var MAX_DURATION_MS = 1200;

    function now() {
        return Number(SBH.util.now());
    }

    function errorText(error) {
        try {
            return SBH.util.errorText(error);
        } catch (ignored) {
            return String(error);
        }
    }

    function haptic(view) {
        try {
            if (SBH.Build.VERSION.SDK_INT >= 30) {
                return view.performHapticFeedback(
                    HapticFeedbackConstants.CONFIRM
                );
            }
        } catch (ignoredConfirm) {}
        try {
            return view.performHapticFeedback(
                HapticFeedbackConstants.VIRTUAL_KEY
            );
        } catch (ignoredVirtualKey) {}
        return false;
    }

    function performBack(controller, source) {
        controller.edgeBackTriggeredCount += 1;
        controller.edgeBackLastSource = String(source);
        controller.edgeBackLastTriggeredAt = now();

        if (typeof controller.handleSystemBack === "function") {
            return controller.handleSystemBack();
        }

        if (Number(controller.page) !== 0) {
            controller.page = 0;
            controller.renderNow(0);
            controller.edgeBackLastAction = "return_home";
            return true;
        }

        controller.edgeBackLastAction = "close_window";
        controller.hide();
        return true;
    }

    function createEdgeView(controller, side) {
        var edge = new View(SBH.ctx);
        var tracking = false;
        var startRawX = 0;
        var startRawY = 0;
        var startAt = 0;
        var cancelled = false;

        edge.setBackgroundColor(
            P.android.graphics.Color.TRANSPARENT
        );
        edge.setClickable(true);
        edge.setFocusable(false);
        try {
            edge.setContentDescription(
                side === "left" ?
                    "左侧边缘返回区域" :
                    "右侧边缘返回区域"
            );
        } catch (ignoredDescription) {}

        edge.setOnTouchListener(new JavaAdapter(
            View.OnTouchListener,
            {
                onTouch: function (view, event) {
                    var action = Number(
                        event.getActionMasked()
                    );
                    var rawX = Number(event.getRawX());
                    var rawY = Number(event.getRawY());
                    var dx;
                    var dy;
                    var elapsed;
                    var directed;
                    var valid;

                    if (action === MotionEvent.ACTION_DOWN) {
                        tracking = true;
                        cancelled = false;
                        startRawX = rawX;
                        startRawY = rawY;
                        startAt = now();
                        controller.edgeBackGestureStartedCount += 1;
                        controller.edgeBackLastSide = side;
                        controller.edgeBackLastStartAt = startAt;
                        return true;
                    }

                    if (!tracking) {
                        return false;
                    }

                    dx = rawX - startRawX;
                    dy = rawY - startRawY;
                    elapsed = now() - startAt;

                    if (action === MotionEvent.ACTION_MOVE) {
                        controller.edgeBackGestureMoveCount += 1;
                        controller.edgeBackLastDx = dx;
                        controller.edgeBackLastDy = dy;
                        if (Math.abs(dy) >
                                SBH.util.dp(MAX_VERTICAL_DP) ||
                                elapsed > MAX_DURATION_MS) {
                            cancelled = true;
                        }
                        return true;
                    }

                    if (action === MotionEvent.ACTION_CANCEL) {
                        tracking = false;
                        controller.edgeBackGestureCancelledCount += 1;
                        controller.edgeBackLastCancelReason =
                            "motion_cancel";
                        return true;
                    }

                    if (action === MotionEvent.ACTION_UP) {
                        tracking = false;
                        directed = side === "left" ?
                            dx >= SBH.util.dp(
                                TRIGGER_DISTANCE_DP
                            ) :
                            dx <= -SBH.util.dp(
                                TRIGGER_DISTANCE_DP
                            );
                        valid =
                            cancelled !== true &&
                            directed === true &&
                            Math.abs(dy) <=
                                SBH.util.dp(MAX_VERTICAL_DP) &&
                            elapsed <= MAX_DURATION_MS;

                        controller.edgeBackLastDx = dx;
                        controller.edgeBackLastDy = dy;
                        controller.edgeBackLastDurationMs =
                            elapsed;
                        controller.edgeBackLastGestureValid =
                            valid;

                        if (valid) {
                            haptic(view);
                            performBack(
                                controller,
                                "edge_swipe_" + side
                            );
                        } else {
                            controller.edgeBackGestureRejectedCount += 1;
                            controller.edgeBackLastCancelReason =
                                cancelled ?
                                    "vertical_or_timeout" :
                                    "distance_or_direction";
                        }
                        return true;
                    }

                    return true;
                }
            }
        ));

        return edge;
    }

    function addEdgeViews(controller, root) {
        var width = SBH.util.dp(EDGE_WIDTH_DP);
        var left = createEdgeView(controller, "left");
        var right = createEdgeView(controller, "right");
        var leftParams = SBH.widgets.fp(
            width,
            SBH.widgets.MATCH,
            Gravity.LEFT
        );
        var rightParams = SBH.widgets.fp(
            width,
            SBH.widgets.MATCH,
            Gravity.RIGHT
        );

        root.addView(left, leftParams);
        root.addView(right, rightParams);

        controller.edgeBackLeftView = left;
        controller.edgeBackRightView = right;
        controller.edgeBackViewsInstalled = true;
        return true;
    }

    function applyGestureExclusion(controller) {
        var root = controller.root;
        var width;
        var height;
        var edge;
        var rects;

        controller.edgeBackExclusionAttempted = true;

        if (SBH.Build.VERSION.SDK_INT < 29 ||
                root === null ||
                root === undefined) {
            controller.edgeBackExclusionApplied = false;
            return false;
        }

        try {
            width = Number(root.getWidth());
            height = Number(root.getHeight());
            edge = SBH.util.dp(EDGE_WIDTH_DP);

            if (width <= edge * 2 || height <= 0) {
                controller.edgeBackExclusionApplied = false;
                controller.edgeBackExclusionError =
                    "ROOT_GEOMETRY_NOT_READY";
                return false;
            }

            rects = new ArrayList();
            rects.add(new Rect(0, 0, edge, height));
            rects.add(new Rect(
                width - edge,
                0,
                width,
                height
            ));
            root.setSystemGestureExclusionRects(rects);

            controller.edgeBackExclusionApplied = true;
            controller.edgeBackExclusionError = null;
            controller.edgeBackExclusionRectCount = 2;
            controller.edgeBackExclusionWidthPx = edge;
            controller.edgeBackExclusionRootWidth = width;
            controller.edgeBackExclusionRootHeight = height;
            return true;
        } catch (error) {
            controller.edgeBackExclusionApplied = false;
            controller.edgeBackExclusionError =
                errorText(error).substring(0, 300);
            return false;
        }
    }

    if (typeof originalCreate !== "function") {
        throw new Error(
            "Original window controller unavailable"
        );
    }

    SBH.window.createController = function () {
        var controller = originalCreate();
        var originalBuildRoot = controller.buildRoot;
        var originalOpen = controller.open;
        var originalStatus = controller.status;

        controller.edgeBackFallbackVersion = 1;
        controller.edgeBackViewsInstalled = false;
        controller.edgeBackLeftView = null;
        controller.edgeBackRightView = null;
        controller.edgeBackExclusionAttempted = false;
        controller.edgeBackExclusionApplied = false;
        controller.edgeBackExclusionError = null;
        controller.edgeBackExclusionRectCount = 0;
        controller.edgeBackExclusionWidthPx = 0;
        controller.edgeBackExclusionRootWidth = 0;
        controller.edgeBackExclusionRootHeight = 0;
        controller.edgeBackGestureStartedCount = 0;
        controller.edgeBackGestureMoveCount = 0;
        controller.edgeBackGestureCancelledCount = 0;
        controller.edgeBackGestureRejectedCount = 0;
        controller.edgeBackTriggeredCount = 0;
        controller.edgeBackLastSide = null;
        controller.edgeBackLastStartAt = null;
        controller.edgeBackLastTriggeredAt = null;
        controller.edgeBackLastSource = null;
        controller.edgeBackLastAction = null;
        controller.edgeBackLastDx = null;
        controller.edgeBackLastDy = null;
        controller.edgeBackLastDurationMs = null;
        controller.edgeBackLastGestureValid = null;
        controller.edgeBackLastCancelReason = null;

        controller.buildRoot = function () {
            var root = originalBuildRoot();
            addEdgeViews(controller, root);
            return root;
        };

        controller.open = function () {
            var result = originalOpen();
            applyGestureExclusion(controller);
            return result;
        };

        controller.status = function () {
            var value = originalStatus();
            value.edgeBackFallbackVersion =
                controller.edgeBackFallbackVersion;
            value.edgeBackViewsInstalled =
                controller.edgeBackViewsInstalled === true;
            value.edgeBackExclusionAttempted =
                controller.edgeBackExclusionAttempted === true;
            value.edgeBackExclusionApplied =
                controller.edgeBackExclusionApplied === true;
            value.edgeBackExclusionError =
                controller.edgeBackExclusionError;
            value.edgeBackExclusionRectCount =
                controller.edgeBackExclusionRectCount;
            value.edgeBackExclusionWidthPx =
                controller.edgeBackExclusionWidthPx;
            value.edgeBackExclusionRootWidth =
                controller.edgeBackExclusionRootWidth;
            value.edgeBackExclusionRootHeight =
                controller.edgeBackExclusionRootHeight;
            value.edgeBackGestureStartedCount =
                controller.edgeBackGestureStartedCount;
            value.edgeBackGestureMoveCount =
                controller.edgeBackGestureMoveCount;
            value.edgeBackGestureCancelledCount =
                controller.edgeBackGestureCancelledCount;
            value.edgeBackGestureRejectedCount =
                controller.edgeBackGestureRejectedCount;
            value.edgeBackTriggeredCount =
                controller.edgeBackTriggeredCount;
            value.edgeBackLastSide =
                controller.edgeBackLastSide;
            value.edgeBackLastTriggeredAt =
                controller.edgeBackLastTriggeredAt;
            value.edgeBackLastSource =
                controller.edgeBackLastSource;
            value.edgeBackLastAction =
                controller.edgeBackLastAction;
            value.edgeBackLastDx =
                controller.edgeBackLastDx;
            value.edgeBackLastDy =
                controller.edgeBackLastDy;
            value.edgeBackLastDurationMs =
                controller.edgeBackLastDurationMs;
            value.edgeBackLastGestureValid =
                controller.edgeBackLastGestureValid;
            value.edgeBackLastCancelReason =
                controller.edgeBackLastCancelReason;
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
        var status = controller &&
            typeof controller.status === "function" ?
            controller.status() : null;

        output.edgeBackFallbackVersion = 1;
        output.edgeBackFallbackReady =
            status &&
            status.edgeBackViewsInstalled === true;
        output.edgeBackGestureExclusionAttempted =
            status &&
            status.edgeBackExclusionAttempted === true;
        output.edgeBackGestureExclusionApplied =
            status &&
            status.edgeBackExclusionApplied === true;
        output.edgeBackGestureExclusionError =
            status ? status.edgeBackExclusionError : null;
        output.edgeBackGestureEdgeWidthDp =
            EDGE_WIDTH_DP;
        output.edgeBackGestureTriggerDistanceDp =
            TRIGGER_DISTANCE_DP;
        output.edgeBackGestureMaxVerticalDp =
            MAX_VERTICAL_DP;
        output.edgeBackGestureMaxDurationMs =
            MAX_DURATION_MS;
        output.systemBackCallbackRetained = true;
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
