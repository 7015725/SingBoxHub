/* SingBoxHub Stage31 Retry1 bounded UI render recovery. Rhino ES5 only. */
SBH.versions.runtimeUiRenderRecovery = 1;

(function () {
    "use strict";

    var P = Packages;
    var Runnable = P.java.lang.Runnable;
    var oldStart = SBH.app.start;
    var RECOVERY_DELAY_MS = 220;

    function currentController() {
        var app = SBH.global.__SBH_APP__;
        return app && app.controller ? app.controller : null;
    }

    function currentRuntime() {
        try {
            if (SBH.runtime && typeof SBH.runtime.status === "function") {
                return SBH.runtime.status();
            }
        } catch (error) {
            SBH.log.warn(
                "runtime.ui_recovery",
                SBH.util.errorText(error)
            );
        }
        return null;
    }

    function render(controller, reason) {
        var runtime;
        if (!controller || typeof controller.showPage !== "function") {
            return false;
        }
        try {
            runtime = currentRuntime();
            if (runtime &&
                    typeof controller.applyRuntimeBadge === "function") {
                controller.applyRuntimeBadge(runtime);
            }
            controller.showPage(0);
            SBH.log.info(
                "runtime.ui_recovery",
                "Home render requested: " + String(reason)
            );
            return true;
        } catch (error) {
            SBH.log.error("runtime.ui_recovery", error);
            return false;
        }
    }

    function schedule(controller) {
        if (!controller) {
            return false;
        }
        SBH.util.runUi(function () {
            render(controller, "immediate_queue");
        });
        SBH.handler.postDelayed(
            new JavaAdapter(Runnable, {
                run: function () {
                    var status = null;
                    try {
                        if (controller.status) {
                            status = controller.status();
                        }
                    } catch (ignoredStatus) {}
                    if (!status || status.attached === true) {
                        render(controller, "bounded_delayed_retry");
                    }
                }
            }),
            RECOVERY_DELAY_MS
        );
        return true;
    }

    if (typeof oldStart !== "function") {
        throw new Error("Stage31 app.start unavailable");
    }

    SBH.app.start = function () {
        var output = oldStart();
        var controller = currentController();
        var runtime = currentRuntime();
        var gate = runtime && runtime.writeGate ? runtime.writeGate : null;

        output.runtimeUiRenderRecovery = "scheduled";
        output.runtimeUiRenderRecoveryVersion = 1;
        output.uiRenderRecoveryScheduled = schedule(controller);
        output.uiRenderRecoveryDelayMs = RECOVERY_DELAY_MS;
        output.uiRenderRecoveryPollingEnabled = false;
        output.uiRenderRecoveryAutomaticRetry = false;
        output.runtimeWriteGate = gate && gate.state ?
            String(gate.state) : String(output.runtimeWriteGate || "checking");
        output.runtimeWriteGateDetails = gate ||
            output.runtimeWriteGateDetails || null;
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
