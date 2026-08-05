/* SingBoxHub Stage33 Retry1: ColorOS predictive-back repair. Rhino ES5 only. */
SBH.versions.backDispatchRepair = 1;

(function () {
    "use strict";

    var P = Packages;
    var View = P.android.view.View;
    var WindowManager = P.android.view.WindowManager;
    var Runnable = P.java.lang.Runnable;
    var CountDownLatch = P.java.util.concurrent.CountDownLatch;
    var TimeUnit = P.java.util.concurrent.TimeUnit;
    var originalCreate = SBH.window.createController;
    var originalStart = SBH.app.start;
    var REGISTRATION_WAIT_SECONDS = 3;
    var PRIORITY_DEFAULT = 0;

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

    function requestFocus(controller) {
        try {
            controller.root.setFocusable(true);
            controller.root.setFocusableInTouchMode(true);
            controller.root.requestFocus();
        } catch (error) {
            controller.backRepairFocusError =
                errorText(error).substring(0, 300);
        }
    }

    function updateFocusState(controller) {
        try {
            controller.backRepairRootFocused =
                controller.root !== null &&
                controller.root.isFocused() === true;
        } catch (ignoredFocused) {
            controller.backRepairRootFocused = false;
        }
        try {
            controller.backRepairWindowFocused =
                controller.root !== null &&
                controller.root.hasWindowFocus() === true;
        } catch (ignoredWindowFocus) {
            controller.backRepairWindowFocused = false;
        }
        try {
            controller.backRepairAttachedToWindow =
                controller.root !== null &&
                controller.root.isAttachedToWindow() === true;
        } catch (ignoredAttached) {
            controller.backRepairAttachedToWindow =
                controller.attached === true;
        }
    }

    function performBack(controller, source) {
        controller.backRepairInvokedCount += 1;
        controller.backInvocationCount =
            Number(controller.backInvocationCount || 0) + 1;
        controller.lastBackSource = String(source);
        controller.lastBackAt = now();

        if (typeof controller.handleSystemBack === "function") {
            return controller.handleSystemBack();
        }

        if (Number(controller.page) !== 0) {
            controller.page = 0;
            controller.renderNow(0);
            controller.lastBackAction = "return_home";
            return true;
        }

        controller.lastBackAction = "close_window";
        controller.hide();
        return true;
    }

    function unregisterCurrent(controller) {
        var dispatcher = controller.backDispatcher;
        var callback = controller.backCallback;

        if (dispatcher === null || dispatcher === undefined ||
                callback === null || callback === undefined) {
            return false;
        }

        try {
            dispatcher.unregisterOnBackInvokedCallback(callback);
            controller.backRepairPreviousCallbackUnregistered = true;
            return true;
        } catch (error) {
            controller.backRepairPreviousUnregisterError =
                errorText(error).substring(0, 300);
            return false;
        } finally {
            controller.backDispatcher = null;
            controller.backCallback = null;
            controller.backCallbackRegistered = false;
        }
    }

    function createAnimationCallback(controller) {
        var callbackClass;
        var callback;

        if (SBH.Build.VERSION.SDK_INT < 34) {
            return null;
        }

        try {
            callbackClass = P.java.lang.Class.forName(
                "android.window.OnBackAnimationCallback"
            );
            callback = new JavaAdapter(
                P.android.window.OnBackAnimationCallback,
                {
                    onBackStarted: function (event) {
                        controller.backRepairStartedCount += 1;
                        controller.backRepairLastProgress = 0;
                        controller.backRepairLastEventAt = now();
                    },
                    onBackProgressed: function (event) {
                        controller.backRepairProgressedCount += 1;
                        controller.backRepairLastEventAt = now();
                        try {
                            controller.backRepairLastProgress =
                                Number(event.getProgress());
                        } catch (ignoredProgress) {}
                    },
                    onBackCancelled: function () {
                        controller.backRepairCancelledCount += 1;
                        controller.backRepairLastEventAt = now();
                    },
                    onBackInvoked: function () {
                        controller.backRepairLastEventAt = now();
                        performBack(
                            controller,
                            "on_back_animation_invoked"
                        );
                    }
                }
            );

            if (!callbackClass.isInstance(callback)) {
                controller.backRepairAnimationProxyValidated = false;
                return null;
            }

            controller.backRepairAnimationProxyValidated = true;
            return callback;
        } catch (error) {
            controller.backRepairAnimationCreateError =
                errorText(error).substring(0, 300);
            return null;
        }
    }

    function createFinalCallback(controller) {
        try {
            return new JavaAdapter(
                P.android.window.OnBackInvokedCallback,
                {
                    onBackInvoked: function () {
                        controller.backRepairLastEventAt = now();
                        performBack(
                            controller,
                            "on_back_invoked_fallback"
                        );
                    }
                }
            );
        } catch (error) {
            controller.backRepairFinalCallbackCreateError =
                errorText(error).substring(0, 300);
            return null;
        }
    }

    function registerNow(controller) {
        var dispatcher;
        var callback;
        var mode;
        var priority = PRIORITY_DEFAULT;

        controller.backRepairRegistrationAttempted = true;
        controller.backRepairRegistrationError = null;
        requestFocus(controller);
        updateFocusState(controller);

        if (SBH.Build.VERSION.SDK_INT < 33) {
            controller.backRepairRegistrationMode =
                "legacy_key_listener";
            return false;
        }

        try {
            dispatcher = controller.root
                .findOnBackInvokedDispatcher();
            if (dispatcher === null || dispatcher === undefined) {
                throw new Error("BACK_DISPATCHER_UNAVAILABLE");
            }

            callback = createAnimationCallback(controller);
            if (callback !== null) {
                mode = "on_back_animation_default";
                controller.backRepairAnimationCallbackUsed = true;
            } else {
                callback = createFinalCallback(controller);
                mode = "on_back_invoked_default_fallback";
                controller.backRepairAnimationCallbackUsed = false;
            }

            if (callback === null) {
                throw new Error("BACK_CALLBACK_CREATE_FAILED");
            }

            try {
                priority = Number(
                    P.android.window.OnBackInvokedDispatcher
                        .PRIORITY_DEFAULT
                );
            } catch (ignoredPriority) {
                priority = PRIORITY_DEFAULT;
            }

            dispatcher.registerOnBackInvokedCallback(
                priority,
                callback
            );

            controller.backDispatcher = dispatcher;
            controller.backCallback = callback;
            controller.backCallbackRegistered = true;
            controller.backCallbackUnregistered = false;
            controller.backDispatcherAvailable = true;
            controller.backRegistrationAttempted = true;
            controller.backRegistrationMode = mode;
            controller.backPriority = priority;
            controller.backRegistrationError = null;

            controller.backRepairRegistered = true;
            controller.backRepairRegistrationMode = mode;
            controller.backRepairPriority = priority;
            controller.backRepairRegisteredAt = now();
            updateFocusState(controller);
            return true;
        } catch (error) {
            controller.backCallbackRegistered = false;
            controller.backRepairRegistered = false;
            controller.backRepairRegistrationMode =
                "registration_failed_key_fallback";
            controller.backRepairRegistrationError =
                errorText(error).substring(0, 300);
            controller.backRegistrationMode =
                controller.backRepairRegistrationMode;
            controller.backRegistrationError =
                controller.backRepairRegistrationError;
            return false;
        }
    }

    function registerAfterAttach(controller) {
        var latch;
        var posted;
        var result = false;
        var failure = null;

        if (controller.root === null ||
                controller.root === undefined) {
            controller.backRepairRegistrationError =
                "ROOT_VIEW_UNAVAILABLE";
            return false;
        }

        controller.backRepairPostRegistrationAttempted = true;

        if (SBH.util.isUiThread()) {
            try {
                result = registerNow(controller);
            } catch (error) {
                failure = error;
            }
        } else {
            latch = new CountDownLatch(1);
            posted = controller.root.post(new JavaAdapter(Runnable, {
                run: function () {
                    try {
                        result = registerNow(controller);
                    } catch (error) {
                        failure = error;
                    } finally {
                        latch.countDown();
                    }
                }
            }));

            controller.backRepairPostAccepted = posted === true;
            if (posted !== true) {
                controller.backRepairRegistrationError =
                    "BACK_REGISTRATION_POST_REJECTED";
                return false;
            }

            if (!latch.await(
                    REGISTRATION_WAIT_SECONDS,
                    TimeUnit.SECONDS
                )) {
                controller.backRepairRegistrationTimedOut = true;
                controller.backRepairRegistrationError =
                    "BACK_REGISTRATION_POST_TIMEOUT";
                return false;
            }
        }

        if (failure !== null) {
            controller.backRepairRegistrationError =
                errorText(failure).substring(0, 300);
            return false;
        }

        return result;
    }

    if (typeof originalCreate !== "function") {
        throw new Error("Original window controller unavailable");
    }

    SBH.window.createController = function () {
        var controller = originalCreate();
        var originalOpen = controller.open;
        var originalParams = controller.params;
        var originalStatus = controller.status;

        controller.backRepairVersion = 1;
        controller.backRepairRegistrationAttempted = false;
        controller.backRepairPostRegistrationAttempted = false;
        controller.backRepairPostAccepted = false;
        controller.backRepairRegistrationTimedOut = false;
        controller.backRepairRegistered = false;
        controller.backRepairRegistrationMode = "not_started";
        controller.backRepairPriority = null;
        controller.backRepairRegisteredAt = null;
        controller.backRepairPreviousCallbackUnregistered = false;
        controller.backRepairPreviousUnregisterError = null;
        controller.backRepairAnimationCallbackUsed = false;
        controller.backRepairAnimationProxyValidated = null;
        controller.backRepairAnimationCreateError = null;
        controller.backRepairFinalCallbackCreateError = null;
        controller.backRepairRegistrationError = null;
        controller.backRepairFocusError = null;
        controller.backRepairAttachedToWindow = false;
        controller.backRepairRootFocused = false;
        controller.backRepairWindowFocused = false;
        controller.backRepairStartedCount = 0;
        controller.backRepairProgressedCount = 0;
        controller.backRepairCancelledCount = 0;
        controller.backRepairInvokedCount = 0;
        controller.backRepairLastProgress = null;
        controller.backRepairLastEventAt = null;

        controller.params = function () {
            var params = originalParams();
            try {
                params.flags = Number(params.flags) &
                    ~Number(
                        WindowManager.LayoutParams
                            .FLAG_NOT_FOCUSABLE
                    );
                params.flags = Number(params.flags) &
                    ~Number(
                        WindowManager.LayoutParams
                            .FLAG_ALT_FOCUSABLE_IM
                    );
            } catch (error) {
                controller.backRepairWindowFlagError =
                    errorText(error).substring(0, 300);
            }
            return params;
        };

        controller.open = function () {
            var result = originalOpen();
            unregisterCurrent(controller);
            registerAfterAttach(controller);
            return result;
        };

        controller.status = function () {
            var value = originalStatus();
            updateFocusState(controller);

            value.backRepairVersion =
                controller.backRepairVersion;
            value.backRepairRegistrationAttempted =
                controller.backRepairRegistrationAttempted === true;
            value.backRepairPostRegistrationAttempted =
                controller.backRepairPostRegistrationAttempted === true;
            value.backRepairPostAccepted =
                controller.backRepairPostAccepted === true;
            value.backRepairRegistrationTimedOut =
                controller.backRepairRegistrationTimedOut === true;
            value.backRepairRegistered =
                controller.backRepairRegistered === true;
            value.backRepairRegistrationMode =
                controller.backRepairRegistrationMode;
            value.backRepairPriority =
                controller.backRepairPriority;
            value.backRepairRegisteredAt =
                controller.backRepairRegisteredAt;
            value.backRepairPreviousCallbackUnregistered =
                controller.backRepairPreviousCallbackUnregistered === true;
            value.backRepairPreviousUnregisterError =
                controller.backRepairPreviousUnregisterError;
            value.backRepairAnimationCallbackUsed =
                controller.backRepairAnimationCallbackUsed === true;
            value.backRepairAnimationProxyValidated =
                controller.backRepairAnimationProxyValidated;
            value.backRepairAnimationCreateError =
                controller.backRepairAnimationCreateError;
            value.backRepairFinalCallbackCreateError =
                controller.backRepairFinalCallbackCreateError;
            value.backRepairRegistrationError =
                controller.backRepairRegistrationError;
            value.backRepairFocusError =
                controller.backRepairFocusError;
            value.backRepairAttachedToWindow =
                controller.backRepairAttachedToWindow === true;
            value.backRepairRootFocused =
                controller.backRepairRootFocused === true;
            value.backRepairWindowFocused =
                controller.backRepairWindowFocused === true;
            value.backRepairStartedCount =
                controller.backRepairStartedCount;
            value.backRepairProgressedCount =
                controller.backRepairProgressedCount;
            value.backRepairCancelledCount =
                controller.backRepairCancelledCount;
            value.backRepairInvokedCount =
                controller.backRepairInvokedCount;
            value.backRepairLastProgress =
                controller.backRepairLastProgress;
            value.backRepairLastEventAt =
                controller.backRepairLastEventAt;
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

        output.systemBackRepairVersion = 1;
        output.systemBackRepairRegistered =
            status && status.backRepairRegistered === true;
        output.systemBackRepairRegistrationMode =
            status ? status.backRepairRegistrationMode : null;
        output.systemBackRepairPriority =
            status ? status.backRepairPriority : null;
        output.systemBackRepairAnimationCallbackUsed =
            status &&
            status.backRepairAnimationCallbackUsed === true;
        output.systemBackRepairAnimationProxyValidated =
            status ?
            status.backRepairAnimationProxyValidated : null;
        output.systemBackRepairRegisteredAfterAttach =
            status &&
            status.backRepairPostRegistrationAttempted === true &&
            status.backRepairPostAccepted === true;
        output.systemBackRepairPreviousOverlayUnregistered =
            status &&
            status.backRepairPreviousCallbackUnregistered === true;
        output.systemBackRepairAttachedToWindow =
            status &&
            status.backRepairAttachedToWindow === true;
        output.systemBackRepairRootFocused =
            status && status.backRepairRootFocused === true;
        output.systemBackRepairWindowFocused =
            status && status.backRepairWindowFocused === true;
        output.systemBackRepairRegistrationError =
            status ? status.backRepairRegistrationError : null;

        output.systemBackRegistrationAttempted =
            status &&
            status.backRepairRegistrationAttempted === true;
        output.systemBackDispatcherAvailable =
            status && status.backDispatcherAvailable === true;
        output.systemBackCallbackRegistered =
            status && status.backCallbackRegistered === true;
        output.systemBackRegistrationMode =
            status ? status.backRepairRegistrationMode : null;
        output.systemBackPriority =
            status ? status.backRepairPriority : null;
        output.systemBackRegistrationError =
            status ? status.backRepairRegistrationError : null;
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
