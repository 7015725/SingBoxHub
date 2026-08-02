/* SingBoxHub Stage33 Retry5: bounded visible edge-back handles. Rhino ES5 only. */
SBH.versions.boundedEdgeBackHandles = 1;

(function () {
    "use strict";

    var P = Packages;
    var View = P.android.view.View;
    var FrameLayout = P.android.widget.FrameLayout;
    var MotionEvent = P.android.view.MotionEvent;
    var Gravity = P.android.view.Gravity;
    var Rect = P.android.graphics.Rect;
    var ArrayList = P.java.util.ArrayList;
    var HapticFeedbackConstants =
        P.android.view.HapticFeedbackConstants;
    var originalCreate = SBH.window.createController;
    var originalStart = SBH.app.start;

    var TOUCH_WIDTH_DP = 72;
    var EXCLUSION_HEIGHT_DP = 200;
    var HANDLE_WIDTH_DP = 5;
    var HANDLE_HEIGHT_DP = 72;
    var HANDLE_INSET_DP = 14;
    var TRIGGER_DISTANCE_DP = 56;
    var MAX_VERTICAL_DP = 72;
    var MAX_DURATION_MS = 1500;

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

    function removeViewQuietly(view) {
        try {
            if (view !== null &&
                    view !== undefined &&
                    view.getParent() !== null) {
                view.getParent().removeView(view);
            }
        } catch (ignored) {}
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
        } catch (ignoredVirtual) {}
        return false;
    }

    function performBack(controller, source) {
        controller.boundedEdgeTriggeredCount += 1;
        controller.boundedEdgeLastSource = String(source);
        controller.boundedEdgeLastTriggeredAt = now();

        if (typeof controller.handleSystemBack === "function") {
            return controller.handleSystemBack();
        }

        if (Number(controller.page) !== 0) {
            controller.page = 0;
            controller.renderNow(0);
            controller.boundedEdgeLastAction =
                "return_home";
            return true;
        }

        controller.boundedEdgeLastAction =
            "close_window";
        controller.hide();
        return true;
    }

    function handleBackground(side) {
        var C = SBH.theme.colors;
        var shell = new FrameLayout(SBH.ctx);
        var handle = new View(SBH.ctx);
        var handleParams = new FrameLayout.LayoutParams(
            SBH.util.dp(HANDLE_WIDTH_DP),
            SBH.util.dp(HANDLE_HEIGHT_DP)
        );

        shell.setBackgroundColor(
            P.android.graphics.Color.TRANSPARENT
        );
        handle.setBackground(
            SBH.theme.rounded(
                C.blue,
                HANDLE_WIDTH_DP,
                C.clear,
                0
            )
        );
        handle.setAlpha(0.45);

        handleParams.gravity =
            Gravity.CENTER_VERTICAL |
            (side === "left" ?
                Gravity.LEFT :
                Gravity.RIGHT);

        if (side === "left") {
            handleParams.leftMargin =
                SBH.util.dp(HANDLE_INSET_DP);
        } else {
            handleParams.rightMargin =
                SBH.util.dp(HANDLE_INSET_DP);
        }

        shell.addView(handle, handleParams);
        return {
            shell: shell,
            handle: handle
        };
    }

    function createTouchZone(controller, side) {
        var visual = handleBackground(side);
        var zone = visual.shell;
        var handle = visual.handle;
        var tracking = false;
        var cancelled = false;
        var startRawX = 0;
        var startRawY = 0;
        var startAt = 0;

        zone.setClickable(true);
        zone.setFocusable(false);

        try {
            zone.setContentDescription(
                side === "left" ?
                    "左侧返回手势把手" :
                    "右侧返回手势把手"
            );
        } catch (ignoredDescription) {}

        zone.setOnTouchListener(new JavaAdapter(
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

                        controller.boundedEdgeDownCount += 1;
                        controller.boundedEdgeLastSide = side;
                        controller.boundedEdgeLastStartAt =
                            startAt;

                        handle.setAlpha(0.95);
                        try {
                            handle.animate()
                                .scaleX(1.35)
                                .scaleY(1.08)
                                .setDuration(90)
                                .start();
                        } catch (ignoredDownAnimation) {}

                        if (typeof controller
                                .showInlineFeedback ===
                                "function") {
                            controller.showInlineFeedback(
                                side === "left" ?
                                    "继续向右滑动返回" :
                                    "继续向左滑动返回"
                            );
                        }
                        return true;
                    }

                    if (!tracking) {
                        return false;
                    }

                    dx = rawX - startRawX;
                    dy = rawY - startRawY;
                    elapsed = now() - startAt;

                    if (action === MotionEvent.ACTION_MOVE) {
                        controller.boundedEdgeMoveCount += 1;
                        controller.boundedEdgeLastDx = dx;
                        controller.boundedEdgeLastDy = dy;

                        if (Math.abs(dy) >
                                SBH.util.dp(
                                    MAX_VERTICAL_DP
                                ) ||
                                elapsed >
                                    MAX_DURATION_MS) {
                            cancelled = true;
                        }

                        try {
                            handle.setTranslationX(
                                side === "left" ?
                                    Math.max(
                                        0,
                                        Math.min(
                                            dx,
                                            SBH.util.dp(42)
                                        )
                                    ) :
                                    Math.min(
                                        0,
                                        Math.max(
                                            dx,
                                            -SBH.util.dp(42)
                                        )
                                    )
                            );
                        } catch (ignoredMoveVisual) {}
                        return true;
                    }

                    if (action === MotionEvent.ACTION_CANCEL) {
                        tracking = false;
                        controller.boundedEdgeCancelCount += 1;
                        controller.boundedEdgeLastRejectReason =
                            "motion_cancel";
                        handle.setAlpha(0.45);
                        handle.setTranslationX(0);
                        handle.setScaleX(1);
                        handle.setScaleY(1);
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
                                SBH.util.dp(
                                    MAX_VERTICAL_DP
                                ) &&
                            elapsed <= MAX_DURATION_MS;

                        controller.boundedEdgeLastDx = dx;
                        controller.boundedEdgeLastDy = dy;
                        controller.boundedEdgeLastDurationMs =
                            elapsed;
                        controller.boundedEdgeLastGestureValid =
                            valid;

                        handle.setAlpha(0.45);
                        handle.setTranslationX(0);
                        handle.setScaleX(1);
                        handle.setScaleY(1);

                        if (valid) {
                            haptic(view);
                            performBack(
                                controller,
                                "bounded_edge_" + side
                            );
                        } else {
                            controller.boundedEdgeRejectedCount += 1;
                            controller.boundedEdgeLastRejectReason =
                                cancelled ?
                                    "vertical_or_timeout" :
                                    "distance_or_direction";

                            if (typeof controller
                                    .showInlineFeedback ===
                                    "function") {
                                controller.showInlineFeedback(
                                    "滑动距离不足，未触发返回"
                                );
                            }
                        }
                        return true;
                    }

                    return true;
                }
            }
        ));

        return {
            zone: zone,
            handle: handle
        };
    }

    function installBoundedZones(controller, root) {
        var left;
        var right;
        var leftParams;
        var rightParams;

        removeViewQuietly(controller.edgeBackLeftView);
        removeViewQuietly(controller.edgeBackRightView);

        left = createTouchZone(controller, "left");
        right = createTouchZone(controller, "right");

        leftParams = new FrameLayout.LayoutParams(
            SBH.util.dp(TOUCH_WIDTH_DP),
            SBH.util.dp(EXCLUSION_HEIGHT_DP)
        );
        leftParams.gravity =
            Gravity.LEFT | Gravity.CENTER_VERTICAL;

        rightParams = new FrameLayout.LayoutParams(
            SBH.util.dp(TOUCH_WIDTH_DP),
            SBH.util.dp(EXCLUSION_HEIGHT_DP)
        );
        rightParams.gravity =
            Gravity.RIGHT | Gravity.CENTER_VERTICAL;

        root.addView(left.zone, leftParams);
        root.addView(right.zone, rightParams);

        controller.boundedEdgeLeftZone = left.zone;
        controller.boundedEdgeRightZone = right.zone;
        controller.boundedEdgeLeftHandle = left.handle;
        controller.boundedEdgeRightHandle = right.handle;
        controller.boundedEdgeHandlesInstalled = true;

        try {
            left.zone.bringToFront();
            right.zone.bringToFront();
        } catch (ignoredFront) {}

        return true;
    }

    function applyBoundedExclusion(controller) {
        var root = controller.root;
        var width;
        var height;
        var zoneWidth;
        var zoneHeight;
        var top;
        var bottom;
        var rects;

        controller.boundedEdgeExclusionAttempted = true;

        if (SBH.Build.VERSION.SDK_INT < 29 ||
                root === null ||
                root === undefined) {
            controller.boundedEdgeExclusionApplied = false;
            return false;
        }

        try {
            width = Number(root.getWidth());
            height = Number(root.getHeight());
            zoneWidth = SBH.util.dp(TOUCH_WIDTH_DP);
            zoneHeight = Math.min(
                SBH.util.dp(EXCLUSION_HEIGHT_DP),
                height
            );
            top = Math.max(
                0,
                Math.floor((height - zoneHeight) / 2)
            );
            bottom = Math.min(
                height,
                top + zoneHeight
            );

            if (width <= zoneWidth * 2 ||
                    height <= 0 ||
                    bottom <= top) {
                throw new Error(
                    "BOUNDED_EDGE_GEOMETRY_INVALID"
                );
            }

            rects = new ArrayList();
            rects.add(new Rect(
                0,
                top,
                zoneWidth,
                bottom
            ));
            rects.add(new Rect(
                width - zoneWidth,
                top,
                width,
                bottom
            ));
            root.setSystemGestureExclusionRects(rects);

            controller.boundedEdgeExclusionApplied = true;
            controller.boundedEdgeExclusionError = null;
            controller.boundedEdgeExclusionTopPx = top;
            controller.boundedEdgeExclusionBottomPx =
                bottom;
            controller.boundedEdgeExclusionHeightPx =
                bottom - top;
            controller.boundedEdgeExclusionWidthPx =
                zoneWidth;
            controller.boundedEdgeExclusionRectCount = 2;
            return true;
        } catch (error) {
            controller.boundedEdgeExclusionApplied = false;
            controller.boundedEdgeExclusionError =
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

        controller.boundedEdgeBackVersion = 1;
        controller.boundedEdgeHandlesInstalled = false;
        controller.boundedEdgeExclusionAttempted = false;
        controller.boundedEdgeExclusionApplied = false;
        controller.boundedEdgeExclusionError = null;
        controller.boundedEdgeExclusionTopPx = null;
        controller.boundedEdgeExclusionBottomPx = null;
        controller.boundedEdgeExclusionHeightPx = null;
        controller.boundedEdgeExclusionWidthPx = null;
        controller.boundedEdgeExclusionRectCount = 0;
        controller.boundedEdgeDownCount = 0;
        controller.boundedEdgeMoveCount = 0;
        controller.boundedEdgeCancelCount = 0;
        controller.boundedEdgeRejectedCount = 0;
        controller.boundedEdgeTriggeredCount = 0;
        controller.boundedEdgeLastSide = null;
        controller.boundedEdgeLastStartAt = null;
        controller.boundedEdgeLastTriggeredAt = null;
        controller.boundedEdgeLastSource = null;
        controller.boundedEdgeLastAction = null;
        controller.boundedEdgeLastDx = null;
        controller.boundedEdgeLastDy = null;
        controller.boundedEdgeLastDurationMs = null;
        controller.boundedEdgeLastGestureValid = null;
        controller.boundedEdgeLastRejectReason = null;

        controller.buildRoot = function () {
            var root = originalBuildRoot();
            installBoundedZones(controller, root);
            return root;
        };

        controller.open = function () {
            var result = originalOpen();
            applyBoundedExclusion(controller);
            return result;
        };

        controller.status = function () {
            var value = originalStatus();

            value.boundedEdgeBackVersion =
                controller.boundedEdgeBackVersion;
            value.boundedEdgeHandlesInstalled =
                controller.boundedEdgeHandlesInstalled === true;
            value.boundedEdgeExclusionAttempted =
                controller.boundedEdgeExclusionAttempted === true;
            value.boundedEdgeExclusionApplied =
                controller.boundedEdgeExclusionApplied === true;
            value.boundedEdgeExclusionError =
                controller.boundedEdgeExclusionError;
            value.boundedEdgeExclusionTopPx =
                controller.boundedEdgeExclusionTopPx;
            value.boundedEdgeExclusionBottomPx =
                controller.boundedEdgeExclusionBottomPx;
            value.boundedEdgeExclusionHeightPx =
                controller.boundedEdgeExclusionHeightPx;
            value.boundedEdgeExclusionWidthPx =
                controller.boundedEdgeExclusionWidthPx;
            value.boundedEdgeExclusionRectCount =
                controller.boundedEdgeExclusionRectCount;
            value.boundedEdgeDownCount =
                controller.boundedEdgeDownCount;
            value.boundedEdgeMoveCount =
                controller.boundedEdgeMoveCount;
            value.boundedEdgeCancelCount =
                controller.boundedEdgeCancelCount;
            value.boundedEdgeRejectedCount =
                controller.boundedEdgeRejectedCount;
            value.boundedEdgeTriggeredCount =
                controller.boundedEdgeTriggeredCount;
            value.boundedEdgeLastSide =
                controller.boundedEdgeLastSide;
            value.boundedEdgeLastTriggeredAt =
                controller.boundedEdgeLastTriggeredAt;
            value.boundedEdgeLastSource =
                controller.boundedEdgeLastSource;
            value.boundedEdgeLastAction =
                controller.boundedEdgeLastAction;
            value.boundedEdgeLastDx =
                controller.boundedEdgeLastDx;
            value.boundedEdgeLastDy =
                controller.boundedEdgeLastDy;
            value.boundedEdgeLastDurationMs =
                controller.boundedEdgeLastDurationMs;
            value.boundedEdgeLastGestureValid =
                controller.boundedEdgeLastGestureValid;
            value.boundedEdgeLastRejectReason =
                controller.boundedEdgeLastRejectReason;
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

        output.boundedEdgeBackVersion = 1;
        output.boundedEdgeBackReady =
            status &&
            status.boundedEdgeHandlesInstalled === true;
        output.boundedEdgeExclusionApplied =
            status &&
            status.boundedEdgeExclusionApplied === true;
        output.boundedEdgeExclusionError =
            status ?
            status.boundedEdgeExclusionError : null;
        output.boundedEdgeTouchWidthDp =
            TOUCH_WIDTH_DP;
        output.boundedEdgeHeightDp =
            EXCLUSION_HEIGHT_DP;
        output.boundedEdgeTriggerDistanceDp =
            TRIGGER_DISTANCE_DP;
        output.boundedEdgeMaxVerticalDp =
            MAX_VERTICAL_DP;
        output.boundedEdgeMaxDurationMs =
            MAX_DURATION_MS;
        output.boundedEdgeVisibleHandles = true;
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
