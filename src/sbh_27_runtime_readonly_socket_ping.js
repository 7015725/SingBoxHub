/* SingBoxHub one-shot read-only Runtime LocalSocket PING verification. Rhino ES5 only. */
SBH.versions.runtimeReadonlySocketPing = 1;
(function () {
    var P = Packages;
    var File = P.java.io.File;
    var LocalSocket = P.android.net.LocalSocket;
    var LocalSocketAddress = P.android.net.LocalSocketAddress;
    var BufferedWriter = P.java.io.BufferedWriter;
    var OutputStreamWriter = P.java.io.OutputStreamWriter;
    var BufferedReader = P.java.io.BufferedReader;
    var InputStreamReader = P.java.io.InputStreamReader;
    var SecureRandom = P.java.security.SecureRandom;
    var ReflectArray = P.java.lang.reflect.Array;
    var JavaByte = P.java.lang.Byte;
    var SCHEMA = 1;
    var CONNECT_TIMEOUT_MS = 1500;
    var READ_TIMEOUT_MS = 2000;
    var TOTAL_BUDGET_MS = 4000;
    var MAX_ENDPOINT_BYTES = 65536;
    var AUTHORIZATION_ID = "stage27-user-authorized-20260802";
    var cacheFile = new File(SBH.paths.cacheDir, "runtime_readonly_socket_ping.json");
    var cached = SBH.files.readJson(cacheFile, null);

    function now() {
        return Number(SBH.util.now());
    }

    function closeQuietly(value) {
        try {
            if (value !== null && value !== undefined) {
                value.close();
            }
        } catch (ignored) {}
    }

    function valueList(value) {
        if (value === null || value === undefined) {
            return [];
        }
        if (Object.prototype.toString.call(value) === "[object Array]") {
            return value.slice(0);
        }
        return [value];
    }

    function blank(state, error) {
        return {
            schemaVersion: SCHEMA,
            state: state || "not_started",
            checking: false,
            authorizationId: AUTHORIZATION_ID,
            authorizationConsumed: false,
            automaticExecution: true,
            automaticRetryAllowed: false,
            reusedCachedResult: false,
            endpointContractReady: false,
            endpointFileExists: false,
            endpointFileCanonical: false,
            endpointSchemaValidated: false,
            endpointIdentity: null,
            commandAllowlist: ["PING"],
            command: "PING",
            commandLockedToPing: true,
            requestLineCount: 3,
            expectedResponseLineCount: 2,
            connectTimeoutMs: CONNECT_TIMEOUT_MS,
            readTimeoutMs: READ_TIMEOUT_MS,
            totalBudgetMs: TOTAL_BUDGET_MS,
            attemptStartedAt: 0,
            attemptCompletedAt: 0,
            connectElapsedMs: null,
            totalElapsedMs: null,
            endpointValueRead: false,
            tokenValueRead: false,
            tokenValueUsed: false,
            tokenValueExposed: false,
            socketNameValueRead: false,
            socketNameValueUsed: false,
            socketNameValueExposed: false,
            correlationGenerated: false,
            correlationLength: 0,
            correlationExposed: false,
            requestConstructedInMemory: false,
            requestSerialized: false,
            requestSent: false,
            requestCount: 0,
            responseRead: false,
            responseLineCount: 0,
            responseStatus: null,
            responseStatusMatched: false,
            correlationMatched: false,
            socketConnectionAttempted: false,
            socketConnected: false,
            socketClosed: false,
            sensitiveReferencesCleared: false,
            coreStartInvoked: false,
            coreStopInvoked: false,
            runtimeStopInvoked: false,
            unknownCommandInvoked: false,
            coreClientMainInvoked: false,
            markerFileCreated: false,
            runtimeFilesModified: false,
            adapterImplementationAllowed: false,
            adapterInvocationEnabled: false,
            readOnlyStatusAdapterReady: false,
            readyForExplicitDryRun: false,
            realSocketDryRunAllowed: false,
            dryRunInvoked: false,
            writeOperationsLocked: true,
            destructiveOperations: false,
            safeFailure: true,
            errorCode: null,
            error: error || null,
            checkedAt: now()
        };
    }

    function endpointFile() {
        if (typeof shortx === "undefined" || shortx === null ||
                typeof shortx.getShortXDir !== "function") {
            throw new Error("SHORTX_DIR_UNAVAILABLE");
        }
        return new File(
            new File(String(shortx.getShortXDir()), "SingBoxHub"),
            "runtime/control/control_endpoint.json"
        );
    }

    function expectedEndpointPath() {
        return String(endpointFile().getCanonicalPath());
    }

    function endpointIdentity(file, endpoint) {
        return {
            schemaVersion: Number(endpoint.schemaVersion || 0),
            runtimePid: Number(endpoint.runtimePid || 0),
            createdAt: Number(endpoint.createdAt || 0),
            size: Number(file.length()),
            mtime: Number(file.lastModified())
        };
    }

    function identityKey(identity) {
        identity = identity || {};
        return [
            Number(identity.schemaVersion || 0),
            Number(identity.runtimePid || 0),
            Number(identity.createdAt || 0),
            Number(identity.size || 0),
            Number(identity.mtime || 0)
        ].join("|");
    }

    function statusGate(status) {
        var transaction = status ? status.runtimeTransactionContract : null;
        var preview = status ? status.runtimeSanitizedDryRunPreview : null;
        var plan = status ? status.protocolAdapterPlan : null;
        var blockers = valueList(plan ? plan.blockers : []);
        return {
            transactionReady: !!transaction &&
                transaction.readOnlyPingContractReady === true &&
                transaction.pingSideEffectFree === true,
            previewReady: !!preview &&
                String(preview.state || "") === "sanitized_dry_run_preview_ready" &&
                preview.planNormalized === true &&
                preview.realSocketDryRunAllowed === false,
            planReady: !!plan &&
                String(plan.state || "") === "sanitized_preview_ready" &&
                plan.adapterImplementationAllowed === true &&
                plan.adapterInvocationEnabled === false &&
                blockers.length === 0,
            blockers: blockers
        };
    }

    function validateEndpoint(file, endpoint) {
        var canonical = String(file.getCanonicalPath());
        var expected = expectedEndpointPath();
        var socketName;
        var token;
        if (!file.exists() || !file.isFile()) {
            throw new Error("ENDPOINT_FILE_NOT_FOUND");
        }
        if (canonical !== expected) {
            throw new Error("ENDPOINT_CANONICAL_PATH_MISMATCH");
        }
        if (Number(file.length()) <= 0 || Number(file.length()) > MAX_ENDPOINT_BYTES) {
            throw new Error("ENDPOINT_FILE_SIZE_INVALID");
        }
        if (!endpoint || Number(endpoint.schemaVersion || 0) !== 1) {
            throw new Error("ENDPOINT_SCHEMA_INVALID");
        }
        if (!/^\d+$/.test(String(endpoint.runtimePid || ""))) {
            throw new Error("ENDPOINT_RUNTIME_PID_INVALID");
        }
        socketName = String(endpoint.socketName || "");
        token = String(endpoint.token || "");
        if (socketName.length < 1 || socketName.length > 128 || /[\r\n\u0000]/.test(socketName)) {
            throw new Error("ENDPOINT_SOCKET_NAME_INVALID");
        }
        if (token.length < 16 || token.length > 256 || /[\r\n\u0000]/.test(token)) {
            throw new Error("ENDPOINT_TOKEN_INVALID");
        }
        return {
            canonical: canonical,
            socketName: socketName,
            token: token,
            identity: endpointIdentity(file, endpoint)
        };
    }

    function randomCorrelation() {
        var random = new SecureRandom();
        var bytes = ReflectArray.newInstance(JavaByte.TYPE, 12);
        var hex = "";
        var i;
        var value;
        random.nextBytes(bytes);
        for (i = 0; i < bytes.length; i += 1) {
            value = Number(bytes[i]);
            if (value < 0) {
                value += 256;
            }
            if (value < 16) {
                hex += "0";
            }
            hex += value.toString(16);
        }
        return "sbh-ping-" + now() + "-" + hex;
    }

    function sanitizeError(error, socketName, token) {
        var text = SBH.util.errorText(error);
        var name = String(socketName || "");
        var secret = String(token || "");
        if (name.length > 0) {
            text = text.split(name).join("<SOCKET_NAME_REDACTED>");
        }
        if (secret.length > 0) {
            text = text.split(secret).join("<TOKEN_REDACTED>");
        }
        if (text.length > 512) {
            text = text.substring(0, 512);
        }
        return text;
    }

    function save(result) {
        cached = result;
        try {
            SBH.files.writeJson(cacheFile, result);
        } catch (error) {
            SBH.log.warn("runtime.readonly.ping.cache", SBH.util.errorText(error));
        }
    }

    function cachedAuthorizedResult() {
        if (!cached || Number(cached.schemaVersion || 0) !== SCHEMA) {
            return null;
        }
        if (String(cached.authorizationId || "") !== AUTHORIZATION_ID) {
            return null;
        }
        if (cached.authorizationConsumed !== true || cached.dryRunInvoked !== true) {
            return null;
        }
        cached.reusedCachedResult = true;
        cached.automaticExecution = false;
        cached.checkedAt = now();
        cached.source = "persisted_one_shot_result";
        return cached;
    }

    function executeOneShot(status) {
        var gate = statusGate(status);
        var result = blank("readonly_socket_ping_blocked", null);
        var file = null;
        var endpoint = null;
        var validated = null;
        var existing = null;
        var socket = null;
        var address = null;
        var writer = null;
        var reader = null;
        var socketName = null;
        var token = null;
        var correlation = null;
        var responseStatus = null;
        var responseCorrelation = null;
        var startedAt = now();
        var connectStartedAt = 0;
        var connectedAt = 0;

        existing = cachedAuthorizedResult();
        if (existing !== null) {
            return existing;
        }

        result.attemptStartedAt = startedAt;
        result.readyForExplicitDryRun = false;
        result.realSocketDryRunAllowed = false;

        if (!gate.transactionReady || !gate.previewReady || !gate.planReady) {
            result.state = "readonly_socket_ping_waiting_for_gate";
            result.errorCode = "STATIC_GATE_NOT_READY";
            result.error = "Static read-only PING contract gate is not ready";
            result.gate = gate;
            result.authorizationConsumed = false;
            result.dryRunInvoked = false;
            result.attemptCompletedAt = now();
            result.totalElapsedMs = result.attemptCompletedAt - startedAt;
            return result;
        }

        result.authorizationConsumed = true;
        result.dryRunInvoked = true;

        try {
            file = endpointFile();
            result.endpointFileExists = file.exists() && file.isFile();
            endpoint = SBH.files.readJson(file, null);
            result.endpointValueRead = true;
            validated = validateEndpoint(file, endpoint);
            result.endpointFileCanonical = true;
            result.endpointSchemaValidated = true;
            result.endpointContractReady = true;
            result.endpointIdentity = validated.identity;
            result.endpointIdentityKey = identityKey(validated.identity);

            socketName = validated.socketName;
            token = validated.token;
            validated.socketName = null;
            validated.token = null;
            endpoint = null;
            result.socketNameValueRead = true;
            result.socketNameValueUsed = true;
            result.tokenValueRead = true;
            result.tokenValueUsed = true;

            correlation = randomCorrelation();
            result.correlationGenerated = true;
            result.correlationLength = correlation.length;
            result.requestConstructedInMemory = true;

            socket = new LocalSocket();
            socket.setSoTimeout(READ_TIMEOUT_MS);
            address = new LocalSocketAddress(
                socketName,
                LocalSocketAddress.Namespace.ABSTRACT
            );
            result.socketConnectionAttempted = true;
            connectStartedAt = now();
            socket.connect(address, CONNECT_TIMEOUT_MS);
            connectedAt = now();
            result.connectElapsedMs = connectedAt - connectStartedAt;
            result.socketConnected = true;

            writer = new BufferedWriter(
                new OutputStreamWriter(socket.getOutputStream())
            );
            writer.write(token);
            writer.newLine();
            writer.write(correlation);
            writer.newLine();
            writer.write("PING");
            writer.newLine();
            result.requestSerialized = true;
            writer.flush();
            result.requestSent = true;
            result.requestCount = 1;

            reader = new BufferedReader(
                new InputStreamReader(socket.getInputStream())
            );
            responseStatus = reader.readLine();
            responseCorrelation = reader.readLine();
            result.responseRead = true;
            result.responseLineCount = 2;
            result.responseStatus = responseStatus === null ? null : String(responseStatus);
            result.responseStatusMatched = String(responseStatus || "") === "PONG";
            result.correlationMatched = String(responseCorrelation || "") === correlation;

            if (now() - startedAt > TOTAL_BUDGET_MS) {
                throw new Error("TOTAL_EXECUTION_BUDGET_EXCEEDED");
            }
            if (!result.responseStatusMatched) {
                throw new Error("UNEXPECTED_RESPONSE_STATUS");
            }
            if (!result.correlationMatched) {
                throw new Error("CORRELATION_ECHO_MISMATCH");
            }

            result.state = "readonly_socket_ping_verified";
            result.adapterImplementationAllowed = true;
            result.readOnlyStatusAdapterReady = true;
            result.safeFailure = false;
            result.errorCode = null;
            result.error = null;
        } catch (error) {
            result.state = "readonly_socket_ping_failed";
            result.errorCode = result.errorCode || "READONLY_SOCKET_PING_FAILED";
            result.error = sanitizeError(error, socketName, token);
            result.adapterImplementationAllowed = false;
            result.readOnlyStatusAdapterReady = false;
            result.safeFailure = true;
        } finally {
            closeQuietly(reader);
            closeQuietly(writer);
            closeQuietly(socket);
            result.socketClosed = result.socketConnectionAttempted === true;
            token = null;
            socketName = null;
            correlation = null;
            responseCorrelation = null;
            address = null;
            endpoint = null;
            validated = null;
            result.sensitiveReferencesCleared = true;
            result.attemptCompletedAt = now();
            result.totalElapsedMs = result.attemptCompletedAt - startedAt;
            result.checkedAt = result.attemptCompletedAt;
            result.tokenValueExposed = false;
            result.socketNameValueExposed = false;
            result.correlationExposed = false;
            result.authenticationValueExposed = false;
            result.rawEndpointExposed = false;
            result.coreStartInvoked = false;
            result.coreStopInvoked = false;
            result.runtimeStopInvoked = false;
            result.unknownCommandInvoked = false;
            result.coreClientMainInvoked = false;
            result.markerFileCreated = false;
            result.runtimeFilesModified = false;
            result.adapterInvocationEnabled = false;
            result.readyForExplicitDryRun = false;
            result.realSocketDryRunAllowed = false;
            result.writeOperationsLocked = true;
            result.destructiveOperations = false;
        }
        save(result);
        return result;
    }

    function normalizePlan(status, result) {
        var plan = status ? status.protocolAdapterPlan : null;
        if (!status || !plan) {
            return status;
        }
        plan.runtimeReadonlySocketPingState = String(result.state || "not_started");
        plan.readOnlyPingVerified = result.state === "readonly_socket_ping_verified";
        plan.readOnlyStatusAdapterReady = result.readOnlyStatusAdapterReady === true;
        plan.dryRunInvoked = result.dryRunInvoked === true;
        plan.adapterInvocationEnabled = false;
        plan.readyForExplicitDryRun = false;
        plan.realSocketDryRunAllowed = false;
        plan.writeOperationsLocked = true;
        plan.destructiveOperations = false;
        if (result.state === "readonly_socket_ping_verified") {
            plan.state = "readonly_ping_verified";
            plan.adapterKind = "readonly_unix_socket_ping_adapter";
            plan.adapterImplementationAllowed = true;
            plan.blockers = [];
            plan.implementationSteps = [
                "consume_verified_readonly_ping_status",
                "keep_mutating_commands_locked"
            ];
            plan.permittedOperations = [
                "build_sanitized_ping_preview",
                "read_verified_ping_result"
            ];
        } else if (result.state === "readonly_socket_ping_failed") {
            plan.state = "readonly_ping_verification_failed";
            plan.adapterImplementationAllowed = false;
            plan.blockers = ["READONLY_SOCKET_PING_NOT_VERIFIED"];
            plan.permittedOperations = ["read_ping_failure_result"];
        }
        plan.prohibitedOperations = [
            "send_start_command",
            "send_stop_core_command",
            "send_stop_runtime_command",
            "send_unknown_command",
            "expose_authentication_value",
            "create_client_marker_file",
            "create_tun",
            "modify_route"
        ];
        status.protocolAdapterPlanState = String(plan.state || "checking");
        if (status.writeGate) {
            status.writeGate.protocolAdapterPlan = plan;
            status.writeGate.protocolAdapterPlanState = String(plan.state || "checking");
            status.writeGate.runtimeReadonlySocketPing = result;
            status.writeGate.readyForExplicitDryRun = false;
            status.writeGate.writeOperationsLocked = true;
            status.writeGate.destructiveOperations = false;
        }
        return status;
    }

    function attach(status, result) {
        status = status || {};
        result = result || cached || blank("not_started", null);
        status.runtimeReadonlySocketPing = result;
        return normalizePlan(status, result);
    }

    function install() {
        var runtime = SBH.runtime;
        var oldStatus = runtime.status;
        var oldRefresh = runtime.refresh;
        var oldRequest = runtime.request;
        var oldStart = SBH.app.start;

        runtime.status = function () {
            return attach(oldStatus(), cached);
        };

        runtime.refresh = function () {
            return attach(oldRefresh(), cached);
        };

        runtime.request = function (request) {
            var command = request && request.command ? String(request.command) : "";
            var requestId = request && request.requestId ? String(request.requestId) : "";
            var status;
            var response;
            if (command === "runtime.readonly_ping_status") {
                status = attach(oldStatus(), cached);
                return {
                    ok: !!cached && cached.state === "readonly_socket_ping_verified",
                    requestId: requestId,
                    code: "RUNTIME_READONLY_PING_STATUS",
                    stateBefore: status.coreRunning ? "running" : "stopped",
                    stateAfter: status.coreRunning ? "running" : "stopped",
                    message: "Runtime 只读 Socket PING 状态",
                    data: cached || blank("not_started", null)
                };
            }
            response = oldRequest(request);
            try {
                if (response && response.data) {
                    response.data.runtimeReadonlySocketPing =
                        cached || blank("not_started", null);
                }
            } catch (ignored) {}
            return response;
        };

        runtime.readonlyPingStatus = function () {
            return runtime.request({
                requestId: "sbh-readonly-ping-status-" + now(),
                command: "runtime.readonly_ping_status"
            });
        };

        SBH.app.start = function () {
            var output = oldStart();
            var status;
            var result;
            try {
                status = oldStatus();
                result = executeOneShot(status);
                status = attach(status, result);
                output.runtimeReadonlySocketPing = String(result.state || "not_started");
                output.runtimeReadonlySocketPingDetails = result;
                output.runtimeProtocolAdapterPlan = String(
                    status.protocolAdapterPlan ?
                        status.protocolAdapterPlan.state : "checking"
                );
                output.runtimeProtocolAdapterPlanDetails =
                    status.protocolAdapterPlan || null;
                output.protocolAdapterPlanState = String(
                    status.protocolAdapterPlanState || output.runtimeProtocolAdapterPlan
                );
                if (output.runtimeWriteGateDetails) {
                    output.runtimeWriteGateDetails.protocolAdapterPlanState =
                        output.protocolAdapterPlanState;
                    output.runtimeWriteGateDetails.protocolAdapterPlan =
                        status.protocolAdapterPlan || null;
                    output.runtimeWriteGateDetails.runtimeReadonlySocketPing = result;
                    output.runtimeWriteGateDetails.readyForExplicitDryRun = false;
                    output.runtimeWriteGateDetails.writeOperationsLocked = true;
                    output.runtimeWriteGateDetails.destructiveOperations = false;
                }
            } catch (error) {
                result = blank("readonly_socket_ping_status_unavailable",
                    sanitizeError(error, "", ""));
                result.authorizationConsumed = true;
                result.dryRunInvoked = true;
                output.runtimeReadonlySocketPing = result.state;
                output.runtimeReadonlySocketPingDetails = result;
            }
            output.writeOperationsLocked = true;
            output.destructiveOperations = false;
            return output;
        };
    }

    if (!cached || Number(cached.schemaVersion || 0) !== SCHEMA ||
            String(cached.authorizationId || "") !== AUTHORIZATION_ID) {
        cached = null;
    }
    install();
}());
