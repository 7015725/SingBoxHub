/* SingBoxHub Runtime sanitized PING dry-run preview and adapter-plan normalization. Rhino ES5 only. */
SBH.versions.runtimeSanitizedDryRunPreview = 1;
(function () {
    var P = Packages;
    var File = P.java.io.File;
    var SecureRandom = P.java.security.SecureRandom;
    var SCHEMA = 1;
    var cacheFile = new File(SBH.paths.cacheDir, "runtime_sanitized_dry_run_preview.json");
    var cache = SBH.files.readJson(cacheFile, null);
    var cacheKey = "";

    function blank(state, error) {
        return {
            schemaVersion: SCHEMA,
            state: state || "checking",
            checking: !state || state === "checking",
            sourceTransactionState: "",
            transactionContractReady: false,
            planNormalized: false,
            normalizedPlanState: "",
            requiredEvidenceBefore: [],
            requiredEvidenceAfter: [],
            blockersBefore: [],
            blockersAfter: [],
            legacyBlockersCleared: [],
            requestPreview: null,
            expectedResponsePreview: null,
            correlationCandidate: "",
            previewOnly: true,
            commandAllowlist: ["PING"],
            commandLockedToPing: true,
            tokenSourceDeclared: false,
            tokenValueRead: false,
            tokenValueExposed: false,
            socketNameValueRead: false,
            socketNameValueExposed: false,
            requestConstructedInMemory: false,
            requestSerialized: false,
            requestSent: false,
            responseRead: false,
            socketConnectionAttempted: false,
            methodInvocationPerformed: false,
            runtimeFilesModified: false,
            authenticationValueUsed: false,
            adapterInvocationEnabled: false,
            readyForExplicitDryRun: false,
            explicitSocketAuthorizationRequired: true,
            realSocketDryRunAllowed: false,
            writeOperationsLocked: true,
            destructiveOperations: false,
            stale: false,
            error: error || null,
            checkedAt: SBH.util.now()
        };
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

    function copyObject(value) {
        var output = {};
        var key;
        if (!value || typeof value !== "object") {
            return output;
        }
        for (key in value) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                output[key] = value[key];
            }
        }
        return output;
    }

    function cloneEvidence(list) {
        var input = valueList(list);
        var output = [];
        var i;
        var item;
        for (i = 0; i < input.length; i += 1) {
            item = copyObject(input[i]);
            item.paths = valueList(item.paths);
            output.push(item);
        }
        return output;
    }

    function pushUnique(list, value) {
        var i;
        value = String(value || "");
        if (!value) {
            return;
        }
        for (i = 0; i < list.length; i += 1) {
            if (String(list[i]) === value) {
                return;
            }
        }
        list.push(value);
    }

    function evidenceCodeSatisfied(list, code, paths) {
        var i;
        var item;
        var found = false;
        for (i = 0; i < list.length; i += 1) {
            item = list[i];
            if (String(item.code || "") === String(code)) {
                item.satisfied = true;
                item.paths = valueList(paths);
                found = true;
            }
        }
        if (!found) {
            list.push({ code: String(code), satisfied: true, paths: valueList(paths) });
        }
    }

    function evidenceSummary(list) {
        var output = [];
        var input = valueList(list);
        var i;
        for (i = 0; i < input.length; i += 1) {
            output.push({
                code: String(input[i].code || ""),
                satisfied: input[i].satisfied === true,
                paths: valueList(input[i].paths)
            });
        }
        return output;
    }

    function randomHex(byteCount) {
        var random = new SecureRandom();
        var bytes = P.java.lang.reflect.Array.newInstance(P.java.lang.Byte.TYPE, Number(byteCount));
        var hex = [];
        var i;
        var value;
        random.nextBytes(bytes);
        for (i = 0; i < bytes.length; i += 1) {
            value = Number(bytes[i]);
            if (value < 0) {
                value += 256;
            }
            hex.push((value < 16 ? "0" : "") + value.toString(16));
        }
        return hex.join("");
    }

    function correlationCandidate() {
        return "sbh-ping-preview-" + Number(SBH.util.now()).toString(16) + "-" + randomHex(6);
    }

    function inputKey(status) {
        var contract = status ? status.runtimeTransactionContract : null;
        var plan = status ? status.protocolAdapterPlan : null;
        var discovery = status ? status.protocolDiscovery : null;
        return [
            contract ? contract.inputKey : "",
            contract ? contract.checkedAt : "",
            contract ? contract.state : "",
            plan ? plan.protocolFingerprint : "",
            discovery ? discovery.endpointSize : "",
            discovery ? discovery.endpointSchemaVersion : ""
        ].join("|");
    }

    function save(result) {
        if (!result || result.checking === true) {
            return;
        }
        cache = result;
        cacheKey = String(result.inputKey || "");
        try {
            SBH.files.writeJson(cacheFile, result);
        } catch (error) {
            SBH.log.warn("runtime.sanitized.preview.cache", SBH.util.errorText(error));
        }
    }

    function normalizeEvidence(plan, contract) {
        var before = cloneEvidence(plan ? plan.requiredEvidence : []);
        var after = cloneEvidence(before);
        var blockersBefore = valueList(plan ? plan.blockers : []);
        var blockersAfter = [];
        var satisfied = [];
        var i;
        var code;
        evidenceCodeSatisfied(after, "COMMAND_CARRIER_DECLARED", [
            "runtimeTransactionContract.commandCarrierConfirmed",
            "request.line[2]",
            "command:PING"
        ]);
        evidenceCodeSatisfied(after, "CORRELATION_FIELD_DECLARED", [
            "runtimeTransactionContract.correlationEchoConfirmed",
            "request.line[1]",
            "response.line[1]"
        ]);
        for (i = 0; i < after.length; i += 1) {
            code = String(after[i].code || "");
            if (after[i].satisfied === true) {
                pushUnique(satisfied, code);
            } else {
                pushUnique(blockersAfter, code);
            }
        }
        if (contract && contract.readOnlyPingContractReady === true) {
            blockersAfter = [];
        }
        return {
            before: evidenceSummary(before),
            after: evidenceSummary(after),
            blockersBefore: blockersBefore,
            blockersAfter: blockersAfter,
            satisfiedEvidence: satisfied
        };
    }

    function buildPreview(status, force) {
        var contract = status ? status.runtimeTransactionContract : null;
        var plan = status ? status.protocolAdapterPlan : null;
        var discovery = status ? status.protocolDiscovery : null;
        var key = inputKey(status);
        var result;
        var normalized;
        var candidate;
        var cleared = [];
        var i;
        if (!contract || contract.checking === true) {
            return blank("checking", null);
        }
        if (!force && cache && cache.stale !== true && cacheKey === key) {
            return cache;
        }
        result = blank("preview_contract_incomplete", null);
        result.checking = false;
        result.inputKey = key;
        result.sourceTransactionState = String(contract.state || "");
        try {
            result.transactionContractReady = contract.readOnlyPingContractReady === true &&
                valueList(contract.blockers).length === 0 &&
                valueList(contract.currentTransactionSideEffects).length === 0;
            if (!result.transactionContractReady) {
                result.error = "Runtime transaction contract is not ready";
                result.checkedAt = SBH.util.now();
                save(result);
                return result;
            }
            normalized = normalizeEvidence(plan, contract);
            result.requiredEvidenceBefore = normalized.before;
            result.requiredEvidenceAfter = normalized.after;
            result.blockersBefore = normalized.blockersBefore;
            result.blockersAfter = normalized.blockersAfter;
            for (i = 0; i < result.blockersBefore.length; i += 1) {
                if (String(result.blockersBefore[i]) === "COMMAND_CARRIER_DECLARED" ||
                    String(result.blockersBefore[i]) === "CORRELATION_FIELD_DECLARED") {
                    cleared.push(String(result.blockersBefore[i]));
                }
            }
            result.legacyBlockersCleared = cleared;
            result.planNormalized = normalized.blockersAfter.length === 0;
            result.normalizedPlanState = result.planNormalized ?
                "sanitized_preview_ready" : "adapter_contract_incomplete";
            candidate = cache && cache.correlationCandidate && cacheKey === key ?
                String(cache.correlationCandidate) : correlationCandidate();
            result.correlationCandidate = candidate;
            result.tokenSourceDeclared = !!(discovery && discovery.authenticationDeclared === true);
            result.requestPreview = {
                transport: "android_local_socket_abstract",
                socketName: {
                    source: "endpoint.socketName",
                    value: "<SOCKET_NAME_REDACTED>",
                    valueRead: false,
                    valueExposed: false
                },
                encoding: "UTF-8",
                framing: "line_delimited_text",
                lineTerminator: "\\n",
                lineCount: 3,
                lines: [
                    {
                        index: 0,
                        role: "authentication",
                        source: "endpoint.token",
                        value: "<TOKEN_REDACTED>",
                        sensitive: true,
                        valueRead: false
                    },
                    {
                        index: 1,
                        role: "correlation",
                        source: "generated_preview_candidate",
                        value: candidate,
                        sensitive: false,
                        valueRead: false
                    },
                    {
                        index: 2,
                        role: "command",
                        source: "fixed_allowlist",
                        value: "PING",
                        sensitive: false,
                        valueRead: false
                    }
                ],
                renderedRedacted: "<TOKEN_REDACTED>\\n" + candidate + "\\nPING\\n"
            };
            result.expectedResponsePreview = {
                encoding: "UTF-8",
                framing: "line_delimited_text",
                lineTerminator: "\\n",
                lineCount: 2,
                lines: [
                    { index: 0, role: "status", value: "PONG" },
                    { index: 1, role: "correlation_echo", value: candidate }
                ],
                rendered: "PONG\\n" + candidate + "\\n"
            };
            result.requestConstructedInMemory = true;
            result.requestSerialized = false;
            result.state = result.planNormalized && result.tokenSourceDeclared ?
                "sanitized_dry_run_preview_ready" : "preview_contract_incomplete";
            result.stale = false;
            result.checkedAt = SBH.util.now();
            save(result);
            return result;
        } catch (error) {
            result.state = "sanitized_preview_failed";
            result.error = SBH.util.errorText(error);
            result.stale = false;
            result.checkedAt = SBH.util.now();
            save(result);
            return result;
        }
    }

    function normalizePlan(plan, preview) {
        var normalized;
        var i;
        var item;
        if (!plan || !preview || preview.state !== "sanitized_dry_run_preview_ready") {
            return plan;
        }
        normalized = normalizeEvidence(plan, { readOnlyPingContractReady: true });
        plan.requiredEvidence = normalized.after;
        plan.satisfiedEvidence = normalized.satisfiedEvidence;
        plan.blockers = normalized.blockersAfter;
        plan.state = "sanitized_preview_ready";
        plan.adapterKind = "readonly_unix_socket_ping_adapter";
        plan.adapterImplementationAllowed = true;
        plan.readOnlyStatusAdapterReady = false;
        plan.adapterInvocationEnabled = false;
        plan.readyForExplicitDryRun = false;
        plan.planOnly = true;
        plan.permittedOperations = ["build_sanitized_ping_preview"];
        plan.prohibitedOperations = [
            "connect_transport",
            "send_command",
            "read_authentication_value",
            "expose_authentication_value",
            "start_core",
            "stop_core",
            "create_tun",
            "modify_route"
        ];
        plan.implementationSteps = [
            "review_sanitized_ping_preview",
            "require_explicit_authorization_before_socket_dry_run"
        ];
        plan.transactionBoundaryConfirmed = true;
        plan.correlationEchoConfirmed = true;
        plan.commandCarrierResolvedByStaticCfg = true;
        plan.correlationResolvedByStaticCfg = true;
        plan.blockersAfterStaticCfg = [];
        plan.blockersAfterTransactionBoundary = [];
        plan.runtimeSanitizedDryRunPreviewState = preview.state;
        plan.sanitizedPreviewReady = true;
        plan.explicitSocketAuthorizationRequired = true;
        plan.authenticationValueExposed = false;
        plan.writeOperationsLocked = true;
        plan.dryRunInvoked = false;
        plan.destructiveOperations = false;
        for (i = 0; i < plan.requiredEvidence.length; i += 1) {
            item = plan.requiredEvidence[i];
            if (String(item.code || "") === "COMMAND_CARRIER_DECLARED" ||
                String(item.code || "") === "CORRELATION_FIELD_DECLARED") {
                item.satisfied = true;
            }
        }
        return plan;
    }

    function attach(status, preview) {
        status = status || {};
        preview = preview || cache || blank("checking", null);
        status.runtimeSanitizedDryRunPreview = preview;
        if (status.protocolAdapterPlan) {
            normalizePlan(status.protocolAdapterPlan, preview);
        }
        if (status.writeGate) {
            status.writeGate.runtimeSanitizedDryRunPreview = preview;
        }
        return status;
    }

    function install() {
        var runtime = SBH.runtime;
        var oldStatus = runtime.status;
        var oldRefresh = runtime.refresh;
        var oldRequest = runtime.request;
        var oldStart = SBH.app.start;

        runtime.status = function () {
            var status = oldStatus();
            var preview = buildPreview(status, false);
            return attach(status, preview);
        };

        runtime.refresh = function () {
            var status = oldRefresh();
            var preview = buildPreview(status, false);
            return attach(status, preview);
        };

        runtime.request = function (request) {
            var command = request && request.command ? String(request.command) : "";
            var requestId = request && request.requestId ? String(request.requestId) : "";
            var status;
            var preview;
            var response;
            if (command === "runtime.sanitized_dry_run_preview") {
                status = oldRefresh();
                preview = buildPreview(status, true);
                status = attach(status, preview);
                return {
                    ok: preview.error === null &&
                        preview.state === "sanitized_dry_run_preview_ready",
                    requestId: requestId,
                    code: "RUNTIME_SANITIZED_DRY_RUN_PREVIEW",
                    stateBefore: status.coreRunning ? "running" : "stopped",
                    stateAfter: status.coreRunning ? "running" : "stopped",
                    message: "Runtime 脱敏 PING dry-run 预览已生成，未连接 Socket",
                    data: preview
                };
            }
            response = oldRequest(request);
            try {
                status = runtime.status();
                if (response && response.data && status.runtimeSanitizedDryRunPreview) {
                    response.data.runtimeSanitizedDryRunPreview =
                        status.runtimeSanitizedDryRunPreview;
                }
            } catch (ignored) {}
            return response;
        };

        runtime.sanitizedDryRunPreview = function () {
            return runtime.request({
                requestId: "sbh-sanitized-preview-" + SBH.util.now(),
                command: "runtime.sanitized_dry_run_preview"
            });
        };

        SBH.app.start = function () {
            var output = oldStart();
            var status;
            var preview;
            try {
                status = runtime.status();
                preview = status.runtimeSanitizedDryRunPreview || blank("checking", null);
                output.runtimeSanitizedDryRunPreview = String(preview.state || "checking");
                output.runtimeSanitizedDryRunPreviewDetails = preview;
                if (status.protocolAdapterPlan) {
                    output.runtimeProtocolAdapterPlan = String(
                        status.protocolAdapterPlan.state || "checking"
                    );
                    output.runtimeProtocolAdapterPlanDetails = status.protocolAdapterPlan;
                }
            } catch (error) {
                preview = blank("sanitized_preview_status_unavailable",
                    SBH.util.errorText(error));
                output.runtimeSanitizedDryRunPreview = preview.state;
                output.runtimeSanitizedDryRunPreviewDetails = preview;
            }
            output.writeOperationsLocked = true;
            output.destructiveOperations = false;
            return output;
        };
    }

    if (!cache || Number(cache.schemaVersion) !== SCHEMA) {
        cache = null;
    } else {
        cacheKey = String(cache.inputKey || "");
        cache.stale = true;
        cache.source = "persisted_cache";
    }
    install();
}());
