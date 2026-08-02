/* SingBoxHub one-shot read-only Runtime LocalSocket PING verification. Rhino ES5 only. */
SBH.versions.runtimeReadonlySocketPing = 2;
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
    var JavaString = P.java.lang.String;
    var Base64 = P.android.util.Base64;
    var SCHEMA = 2;
    var CONNECT_TIMEOUT_MS = 1500;
    var READ_TIMEOUT_MS = 2000;
    var TOTAL_BUDGET_MS = 15000;
    var MAX_ENDPOINT_BYTES = 65536;
    var AUTHORIZATION_ID = "stage27-retry1-user-authorized-20260802";
    var cacheFile = new File(SBH.paths.cacheDir, "runtime_readonly_socket_ping.json");
    var cached = SBH.files.readJson(cacheFile, null);

    function now() {
        return Number(SBH.util.now());
    }

    function closeQuietly(value) {
        try {
            if (value !== null && value !== undefined) {
                value.close();
                return true;
            }
        } catch (ignored) {}
        return false;
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
            endpointProbeAvailable: false,
            endpointProbeRefreshed: false,
            endpointProbeTransport: "shortx_root_shell_base64_memory",
            endpointFileExists: false,
            endpointFileCanonical: false,
            endpointOwnerValidated: false,
            endpointModeValidated: false,
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
            endpointRefreshElapsedMs: null,
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

    function endpointIdentity(probe, endpoint) {
        return {
            schemaVersion: Number(endpoint.schemaVersion || 0),
            runtimePid: Number(endpoint.runtimePid || 0),
            createdAt: Number(endpoint.createdAt || 0),
            size: Number(probe.size || 0),
            mtimeEpochSeconds: Number(probe.mtime || 0),
            uid: Number(probe.uid || -1),
            gid: Number(probe.gid || -1),
            mode: String(probe.mode || "")
        };
    }

    function identityKey(identity) {
        identity = identity || {};
        return [
            Number(identity.schemaVersion || 0),
            Number(identity.runtimePid || 0),
            Number(identity.createdAt || 0),
            Number(identity.size || 0),
            Number(identity.mtimeEpochSeconds || 0),
            Number(identity.uid || -1),
            Number(identity.gid || -1),
            String(identity.mode || "")
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

    function currentProbe() {
        try {
            if (SBH.runtime && typeof SBH.runtime.endpointProbe === "function") {
                return SBH.runtime.endpointProbe();
            }
        } catch (ignored) {}
        return null;
    }

    function loadProbe(refreshFunction, result) {
        var probe = currentProbe();
        var started;
        if (!probe || probe.exists !== true || !probe.data) {
            if (typeof refreshFunction !== "function") {
                throw new Error("ENDPOINT_PROBE_UNAVAILABLE");
            }
            started = now();
            refreshFunction();
            result.endpointProbeRefreshed = true;
            result.endpointRefreshElapsedMs = now() - started;
            probe = currentProbe();
        }
        if (!probe) {
            throw new Error("ENDPOINT_PROBE_UNAVAILABLE");
        }
        result.endpointProbeAvailable = true;
        return probe;
    }

    function parseProbeEndpoint(probe) {
        var decoded = null;
        var text = null;
        var endpoint = null;
        if (probe.exists !== true) {
            throw new Error("ENDPOINT_FILE_NOT_FOUND");
        }
        if (probe.error) {
            throw new Error("ENDPOINT_PROBE_ERROR");
        }
        if (!probe.data) {
            throw new Error("ENDPOINT_PROBE_DATA_MISSING");
        }
        try {
            decoded = Base64.decode(String(probe.data), Base64.DEFAULT);
            text = String(new JavaString(decoded, "UTF-8"));
            endpoint = JSON.parse(text);
            return endpoint;
        } catch (error) {
            throw new Error("ENDPOINT_JSON_PARSE_FAILED");
        } finally {
            decoded = null;
            text = null;
        }
    }

    function validateProbeEndpoint(probe, endpoint) {
        var expected = expectedEndpointPath();
        var real = String(probe.real || "");
        var size = Number(probe.size || 0);
        var socketName;
        var token;
        if (probe.exists !== true) {
            throw new Error("ENDPOINT_FILE_NOT_FOUND");
        }
        if (!real || real !== expected) {
            throw new Error("ENDPOINT_CANONICAL_PATH_MISMATCH");
        }
        if (String(probe.uid || "") !== "1000" ||
                String(probe.gid || "") !== "1000") {
            throw new Error("ENDPOINT_OWNER_INVALID");
        }
        if (String(probe.mode || "") !== "600") {
            throw new Error("ENDPOINT_MODE_INVALID");
        }
        if (!isFinite(size) || size <= 0 || size > MAX_ENDPOINT_BYTES) {
            throw new Error("ENDPOINT_FILE_SIZE_INVALID");
        }
        if (!endpoint || typeof endpoint !== "object" ||
                Number(endpoint.schemaVersion || 0) !== 1) {
            throw new Error("ENDPOINT_SCHEMA_INVALID");
        }
        if (!/^\d+$/.test(String(endpoint.runtimePid || ""))) {
            throw new Error("ENDPOINT_RUNTIME_PID_INVALID");
        }
        socketName = String(endpoint.socketName || "");
        token = String(endpoint.token || "");
        if (socketName.length < 1 || socketName.length > 128 ||
                /[\r\n\u0000]/.test(socketName)) {
            throw new Error("ENDPOINT_SOCKET_NAME_INVALID");
        }
        if (token.length < 16 || token.length > 256 ||
                /[\r\n\u0000]/.test(token)) {
            throw new Error("ENDPOINT_TOKEN_INVALID");
        }
        return {
            socketName: socketName,
            token: token,
            identity: endpointIdentity(probe, endpoint)
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

    function errorCodeOf(error) {
        var text = SBH.util.errorText(error);
        var known = [
            "SHORTX_DIR_UNAVAILABLE",
            "ENDPOINT_PROBE_UNAVAILABLE",
            "ENDPOINT_PROBE_ERROR",
            "ENDPOINT_PROBE_DATA_MISSING",
            "ENDPOINT_FILE_NOT_FOUND",
            "ENDPOINT_CANONICAL_PATH_MISMATCH",
            "ENDPOINT_OWNER_INVALID",
            "ENDPOINT_MODE_INVALID",
            "ENDPOINT_FILE_SIZE_INVALID",
            "ENDPOINT_JSON_PARSE_FAILED",
            "ENDPOINT_SCHEMA_INVALID",
            "ENDPOINT_RUNTIME_PID_INVALID",
            "ENDPOINT_SOCKET_NAME_INVALID",
            "ENDPOINT_TOKEN_INVALID",
            "TOTAL_EXECUTION_BUDGET_EXCEEDED",
            "UNEXPECTED_RESPONSE_STATUS",
            "CORRELATION_ECHO_MISMATCH"
        ];
        var i;
        for (i = 0; i < known.length; i += 1) {
            if (text.indexOf(known[i]) >= 0) {
                return known[i];
            }
        }
        return "READONLY_SOCKET_PING_FAILED";
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

    function executeOneShot(status, refreshFunction) {
        var gate = statusGate(status);
        var result = blank("readonly_socket_ping_blocked", null);
        var probe = null;
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
            probe = loadProbe(refreshFunction, result);
            result.endpointFileExists = probe.exists === true;
            endpoint = parseProbeEndpoint(probe);
            result.endpointValueRead = true;
            validated = validateProbeEndpoint(probe, endpoint);
            result.endpointFileCanonical = true;
            result.endpointOwnerValidated = true;
            result.endpointModeValidated = true;
            result.endpointSchemaValidated = true;
            result.endpointContractReady = true;
            result.endpointIdentity = validated.identity;
            result.endpointIdentityKey = identityKey(validated.identity);

            socketName = validated.socketName;
            token = validated.token;
            validated.socketName = null;
            validated.token = null;
            endpoint = null;
            probe = null;
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
                new OutputStreamWriter(socket.getOutputStream(), "UTF-8")
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
                new InputStreamReader(socket.getInputStream(), "UTF-8")
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
            result.errorCode = errorCodeOf(error);
            result.error = sanitizeError(error, socketName, token);
            result.adapterImplementationAllowed = false;
            result.readOnlyStatusAdapterReady = false;
            result.safeFailure = true;
        } finally {
            closeQuietly(reader);
            closeQuietly(writer);
            if (socket !== null && socket !== undefined) {
                result.socketClosed = closeQuietly(socket);
            } else {
                result.socketClosed = false;
            }
            token = null;
            socketName = null;
            correlation = null;
            responseCorrelation = null;
            responseStatus = null;
            address = null;
            endpoint = null;
            validated = null;
            probe = null;
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
                result = executeOneShot(status, oldRefresh);
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
                result.errorCode = errorCodeOf(error);
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