/* SingBoxHub Stage44 outer-error redaction guard. Rhino ES5 only. */
SBH.versions.ephemeralBinaryCheckRedaction = 1;

(function () {
    "use strict";

    var service = SBH.candidateConfigPreflight;
    var originalCheck = service.binaryCheckAsync;
    var originalStart = SBH.app.start;

    if (!service || typeof originalCheck !== "function") {
        throw new Error(
            "Ephemeral binary check service unavailable"
        );
    }

    service.binaryCheckAsync = function (callback) {
        if (typeof callback !== "function") {
            throw new Error(
                "二进制检查回调不可用"
            );
        }

        return originalCheck(function (result) {
            var value = result || {};
            if (Object.prototype.hasOwnProperty.call(
                    value,
                    "error"
                )) {
                delete value.error;
            }
            if (value.ok !== true) {
                value.errorCode = String(
                    value.errorCode ||
                    "EPHEMERAL_BINARY_CHECK_FAILED"
                );
                value.errorDetailReturned = false;
            }
            callback(value);
        });
    };

    if (typeof originalStart !== "function") {
        throw new Error("Original app.start unavailable");
    }

    SBH.app.start = function () {
        var output = originalStart();
        output.ephemeralBinaryCheckRedactionVersion = 1;
        output.ephemeralBinaryCheckOuterErrorReturned = false;
        output.ephemeralBinaryCheckSanitizedDiagnosticOnly = true;
        output.writeOperationsLocked = true;
        output.destructiveOperations = false;
        return output;
    };
}());
