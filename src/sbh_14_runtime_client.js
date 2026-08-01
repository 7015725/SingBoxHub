/* SingBoxHub Runtime Client adapter. Rhino ES5 only. */
SBH.versions.runtimeClient = 1;

(function () {
    SBH.runtime = {
        attached: false,
        transport: "placeholder",

        request: function (request) {
            return {
                ok: false,
                requestId: request && request.requestId ?
                    String(request.requestId) : "",
                code: "RUNTIME_NOT_ATTACHED",
                stateBefore: "unavailable",
                stateAfter: "unavailable",
                message: "Runtime Client 尚未接入, 未执行真实操作",
                data: null
            };
        },

        status: function () {
            return {
                attached: false,
                transport: "placeholder",
                coreRunning: false
            };
        }
    };
}());
