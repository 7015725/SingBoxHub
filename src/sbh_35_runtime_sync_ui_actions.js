/* SingBoxHub Stage32 synchronous Runtime UI actions. Rhino ES5 only. */
SBH.versions.runtimeSynchronousUiActions = 1;

(function () {
    "use strict";

    var System = Packages.java.lang.System;
    var originalRefreshAsync = SBH.runtime.refreshAsync;
    var originalRequestAsync = SBH.runtime.requestAsync;
    var originalStart = SBH.app.start;
    var sequence = 0;
    var lastAction = null;

    function now() {
        return Number(System.currentTimeMillis());
    }

    function errorText(error) {
        try {
            return SBH.util.errorText(error);
        } catch (ignored) {
            return String(error);
        }
    }

    function commandOf(requestValue) {
        return requestValue && requestValue.command ?
            String(requestValue.command) : "unknown";
    }

    function record(kind, command, ok, code, message, elapsed, error) {
        sequence += 1;
        lastAction = {
            schemaVersion: 1,
            sequence: sequence,
            kind: String(kind),
            command: String(command),
            ok: ok === true,
            code: code === null || code === undefined ?
                null : String(code),
            message: message === null || message === undefined ?
                null : String(message),
            elapsedMs: Number(elapsed || 0),
            error: error ? errorText(error).substring(0, 300) : null,
            completedAt: now(),
            synchronousUiEvent: true,
            backgroundCallbackUsed: false,
            writeOperationsLocked: true,
            destructiveOperations: false
        };
        return lastAction;
    }

    function callback(callbackValue, value, error, elapsed) {
        if (typeof callbackValue !== "function") {
            return;
        }
        callbackValue(value, error, elapsed);
    }

    if (typeof SBH.runtime.refresh !== "function" ||
            typeof SBH.runtime.request !== "function") {
        throw new Error("Synchronous Runtime APIs unavailable");
    }

    SBH.runtime.refreshAsync = function (callbackValue) {
        var startedAt = now();
        var value = null;
        var failure = null;

        try {
            value = SBH.runtime.refresh();
            record(
                "refresh",
                "runtime.status",
                value && value.ok === true,
                value && value.ok === true ?
                    "AUTHENTICATED_READ_ONLY_STATUS" :
                    "RUNTIME_STATUS_UNAVAILABLE",
                value && value.ok === true ?
                    "Runtime 状态已同步刷新" :
                    "Runtime 状态同步刷新失败",
                now() - startedAt,
                null
            );
        } catch (error) {
            failure = error;
            record(
                "refresh",
                "runtime.status",
                false,
                "SYNCHRONOUS_UI_REFRESH_FAILED",
                "Runtime 状态同步刷新失败",
                now() - startedAt,
                error
            );
        }

        callback(
            callbackValue,
            value,
            failure,
            now() - startedAt
        );
        return failure === null;
    };

    SBH.runtime.requestAsync = function (requestValue, callbackValue) {
        var startedAt = now();
        var value = null;
        var failure = null;
        var command = commandOf(requestValue);

        try {
            value = SBH.runtime.request(requestValue || {});
            record(
                "request",
                command,
                value && value.ok === true,
                value ? value.code : null,
                value ? value.message : null,
                now() - startedAt,
                null
            );
        } catch (error) {
            failure = error;
            record(
                "request",
                command,
                false,
                "SYNCHRONOUS_UI_REQUEST_FAILED",
                "Runtime 同步请求失败",
                now() - startedAt,
                error
            );
        }

        callback(
            callbackValue,
            value,
            failure,
            now() - startedAt
        );
        return failure === null;
    };

    SBH.runtime.uiActionStatus = function () {
        return lastAction;
    };

    SBH.runtime.uiActionsSynchronous = true;
    SBH.runtime.backgroundRefreshAsync = originalRefreshAsync;
    SBH.runtime.backgroundRequestAsync = originalRequestAsync;

    if (typeof originalStart !== "function") {
        throw new Error("Original app.start unavailable");
    }

    SBH.app.start = function () {
        var output = originalStart();
        output.runtimeUiActionsMode = "synchronous_ui_event";
        output.runtimeUiActionsVersion = 1;
        output.runtimeUiActionsReady = true;
        output.runtimeUiActionsBackgroundCallbacksDisabled = true;
        output.runtimeUiActionsPollingEnabled = false;
        output.runtimeUiActionsAutomaticRetry = false;
        output.runtimeUiActionSupportedCommands = [
            "runtime.handshake",
            "runtime.write_gate",
            "runtime.status",
            "core.status"
        ];
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
