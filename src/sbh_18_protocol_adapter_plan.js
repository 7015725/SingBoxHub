/* SingBoxHub protocol adapter planning. Rhino ES5 only. */
SBH.versions.protocolAdapterPlan = 1;

(function () {
    var File = Packages.java.io.File;
    var CACHE_SCHEMA = 1;
    var cacheFile = new File(
        SBH.paths.cacheDir,
        "runtime_protocol_adapter_plan.json"
    );
    var cachedPlan = SBH.files.readJson(cacheFile, null);
    var cachedKey = "";

    function unique(output, value, limit) {
        var text = String(value || "");
        var i;
        if (!text || output.length >= Number(limit || 64)) {
            return;
        }
        for (i = 0; i < output.length; i += 1) {
            if (output[i] === text) {
                return;
            }
        }
        output.push(text);
    }

    function pendingPlan(state, error) {
        return {
            schemaVersion: CACHE_SCHEMA,
            state: state || "checking",
            checking: state === undefined || state === null ||
                state === "checking",
            selectedTransport: "unknown",
            adapterKind: "none",
            adapterImplementationAllowed: false,
            adapterInvocationEnabled: false,
            readOnlyStatusAdapterReady: false,
            requiredEvidence: [],
            satisfiedEvidence: [],
            blockers: [],
            evidencePaths: [],
            implementationSteps: [],
            permittedOperations: [],
            prohibitedOperations: [
                "connect_transport",
                "send_command",
                "read_authentication_value",
                "start_core",
                "stop_core",
                "create_tun",
                "modify_route"
            ],
            protocolFingerprint: "",
            discoveryState: "unavailable",
            discoveryStale: false,
            planOnly: true,
            rawEndpointExposed: false,
            authenticationValueExposed: false,
            writeOperationsLocked: true,
            dryRunInvoked: false,
            destructiveOperations: false,
            error: error || null,
            checkedAt: SBH.util.now()
        };
    }

    function addRequirement(plan, code, satisfied, paths) {
        var item = {
            code: String(code),
            satisfied: satisfied === true,
            paths: paths || []
        };
        plan.requiredEvidence.push(item);
        if (item.satisfied) {
            plan.satisfiedEvidence.push(String(code));
        } else {
            plan.blockers.push(String(code));
        }
    }

    function pathsMatching(descriptors, pattern) {
        var output = [];
        var i;
        var path;
        descriptors = descriptors || [];
        for (i = 0; i < descriptors.length; i += 1) {
            path = String(descriptors[i].path || "");
            if (pattern.test(path)) {
                unique(output, path, 24);
            }
        }
        return output;
    }

    function mergePaths(output, values) {
        var i;
        values = values || [];
        for (i = 0; i < values.length; i += 1) {
            unique(output, values[i], 96);
        }
    }

    function transportEvidence(discovery, transport) {
        var output = [];
        var descriptors = discovery.fieldDescriptors || [];
        mergePaths(output, discovery.channelCandidates || []);
        if (transport === "shell_cli") {
            mergePaths(
                output,
                pathsMatching(
                    descriptors,
                    /(binary|executable|cli|ctl|command[_-]?path|script)/i
                )
            );
        } else if (transport === "unix_socket") {
            mergePaths(output, pathsMatching(descriptors, /(socket|sock|uds)/i));
        } else if (transport === "broadcast") {
            mergePaths(output, pathsMatching(descriptors, /(action|broadcast|intent)/i));
        } else if (transport === "local_http") {
            mergePaths(output, pathsMatching(descriptors, /(url|uri|host|port|listen|address)/i));
        } else if (transport === "file_mailbox") {
            mergePaths(output, pathsMatching(descriptors, /(request|response|reply|result|inbox|outbox|queue|input|output)/i));
        }
        return output;
    }

    function adapterKind(transport) {
        if (transport === "file_mailbox") {
            return "readonly_file_mailbox_status_adapter";
        }
        if (transport === "unix_socket") {
            return "readonly_unix_socket_status_adapter";
        }
        if (transport === "broadcast") {
            return "readonly_broadcast_status_adapter";
        }
        if (transport === "local_http") {
            return "readonly_local_http_status_adapter";
        }
        if (transport === "shell_cli") {
            return "readonly_shell_cli_status_adapter";
        }
        return "none";
    }

    function buildPlan(discovery) {
        var plan;
        var transport;
        var channelPaths;
        var commandPaths;
        var correlationPaths;
        var statusPaths;
        var pairRequired;
        var pairSatisfied;

        if (!discovery || discovery.checking === true) {
            return pendingPlan("checking", null);
        }
        if (discovery.endpointExists !== true || discovery.parseOk !== true) {
            plan = pendingPlan("discovery_unavailable", discovery.error || null);
            plan.discoveryState = String(discovery.state || "unavailable");
            plan.discoveryStale = discovery.stale === true;
            return plan;
        }

        transport = String(discovery.transportKind || "unknown");
        plan = pendingPlan("adapter_contract_incomplete", null);
        plan.checking = false;
        plan.selectedTransport = transport;
        plan.adapterKind = adapterKind(transport);
        plan.protocolFingerprint = String(discovery.protocolFingerprint || "");
        plan.discoveryState = String(discovery.state || "unavailable");
        plan.discoveryStale = discovery.stale === true;

        channelPaths = transportEvidence(discovery, transport);
        commandPaths = discovery.commandCarrierCandidates || [];
        correlationPaths = discovery.correlationCandidates || [];
        statusPaths = discovery.statusCarrierCandidates || [];
        pairRequired = transport === "file_mailbox" ||
            transport === "broadcast";
        pairSatisfied = discovery.requestResponsePairDeclared === true;

        addRequirement(
            plan,
            "ENDPOINT_SCHEMA_DECLARED",
            discovery.endpointSchemaPresent === true,
            []
        );
        addRequirement(
            plan,
            "AUTHENTICATION_FIELD_DECLARED",
            discovery.authenticationDeclared === true,
            discovery.authenticationFields || []
        );
        addRequirement(
            plan,
            "TRANSPORT_UNAMBIGUOUS",
            transport !== "unknown" && discovery.transportAmbiguous !== true,
            channelPaths
        );
        addRequirement(
            plan,
            "TRANSPORT_CHANNEL_DECLARED",
            channelPaths.length > 0,
            channelPaths
        );
        addRequirement(
            plan,
            "COMMAND_CARRIER_DECLARED",
            discovery.commandCarrierDeclared === true,
            commandPaths
        );
        addRequirement(
            plan,
            "CORRELATION_FIELD_DECLARED",
            discovery.correlationDeclared === true,
            correlationPaths
        );
        addRequirement(
            plan,
            "STATUS_CARRIER_DECLARED",
            discovery.statusCarrierDeclared === true,
            statusPaths
        );
        if (pairRequired) {
            addRequirement(
                plan,
                "REQUEST_RESPONSE_PAIR_DECLARED",
                pairSatisfied,
                discovery.channelCandidates || []
            );
        }

        mergePaths(plan.evidencePaths, channelPaths);
        mergePaths(plan.evidencePaths, commandPaths);
        mergePaths(plan.evidencePaths, correlationPaths);
        mergePaths(plan.evidencePaths, statusPaths);

        if (discovery.transportAmbiguous === true) {
            plan.state = "transport_ambiguous";
        } else if (transport === "unknown") {
            plan.state = "transport_unknown";
        } else if (plan.blockers.length === 0) {
            plan.state = "readonly_adapter_scaffold_ready";
            plan.adapterImplementationAllowed = true;
            plan.readOnlyStatusAdapterReady = true;
            plan.permittedOperations = [
                "implement_readonly_status_adapter",
                "validate_request_envelope_offline",
                "validate_response_envelope_offline"
            ];
            plan.implementationSteps = [
                "bind_declared_transport_without_connecting",
                "build_status_request_envelope_without_auth_value",
                "build_response_parser_from_declared_status_fields",
                "add_timeout_and_request_correlation_checks",
                "run_offline_fixture_validation_before_any_device_call"
            ];
        } else {
            plan.state = "adapter_contract_incomplete";
            plan.implementationSteps = [
                "collect_missing_field_paths",
                "keep_transport_invocation_disabled",
                "repeat_protocol_discovery_after_endpoint_schema_update"
            ];
        }

        plan.adapterInvocationEnabled = false;
        plan.planOnly = true;
        plan.rawEndpointExposed = false;
        plan.authenticationValueExposed = false;
        plan.writeOperationsLocked = true;
        plan.dryRunInvoked = false;
        plan.destructiveOperations = false;
        plan.checkedAt = SBH.util.now();
        return plan;
    }

    function planKey(discovery) {
        if (!discovery) {
            return "";
        }
        return [
            String(discovery.protocolFingerprint || ""),
            String(discovery.state || ""),
            String(discovery.transportKind || ""),
            String(discovery.stale === true)
        ].join(":");
    }

    function persist(plan) {
        if (!plan || plan.checking === true) {
            return;
        }
        cachedPlan = plan;
        try {
            SBH.util.runBg(function () {
                SBH.files.writeJson(cacheFile, plan);
                return true;
            }, null, "SingBoxHub-protocol-adapter-plan-cache");
        } catch (error) {
            SBH.log.warn("adapter.plan.cache", SBH.util.errorText(error));
        }
    }

    function planFor(discovery, persistValue) {
        var key = planKey(discovery);
        var plan;
        if (key && key === cachedKey && cachedPlan) {
            return cachedPlan;
        }
        if (discovery) {
            plan = buildPlan(discovery);
            cachedKey = key;
            cachedPlan = plan;
            if (persistValue === true) {
                persist(plan);
            }
            return plan;
        }
        if (cachedPlan) {
            cachedPlan.discoveryStale = true;
            cachedPlan.source = "persisted_cache";
            return cachedPlan;
        }
        return pendingPlan("discovery_unavailable", null);
    }

    function install() {
        var runtime = SBH.runtime;
        var oldStatus = runtime.status;
        var oldRefresh = runtime.refresh;
        var oldRequest = runtime.request;
        var oldAppStart = SBH.app.start;

        runtime.status = function () {
            var status = oldStatus();
            var plan = planFor(status.protocolDiscovery, false);
            status.protocolAdapterPlan = plan;
            if (status.writeGate) {
                status.writeGate.protocolAdapterPlan = plan;
                status.writeGate.protocolAdapterPlanState =
                    String(plan.state || "unavailable");
            }
            return status;
        };

        runtime.refresh = function () {
            var status = oldRefresh();
            var plan = planFor(status.protocolDiscovery, true);
            status.protocolAdapterPlan = plan;
            if (status.writeGate) {
                status.writeGate.protocolAdapterPlan = plan;
                status.writeGate.protocolAdapterPlanState =
                    String(plan.state || "unavailable");
            }
            return status;
        };

        runtime.request = function (requestValue) {
            var command = requestValue && requestValue.command ?
                String(requestValue.command) : "";
            var requestId = requestValue && requestValue.requestId ?
                String(requestValue.requestId) : "";
            var status;
            var plan;
            var result;

            if (command === "runtime.protocol_adapter_plan") {
                status = runtime.refresh();
                plan = status.protocolAdapterPlan ||
                    pendingPlan("discovery_unavailable", null);
                return {
                    ok: plan.adapterImplementationAllowed === true,
                    requestId: requestId,
                    code: plan.adapterImplementationAllowed ?
                        "READONLY_ADAPTER_SCAFFOLD_READY" :
                        "ADAPTER_PLAN_BLOCKED",
                    stateBefore: status.coreRunning ? "running" : "stopped",
                    stateAfter: status.coreRunning ? "running" : "stopped",
                    message: plan.adapterImplementationAllowed ?
                        "只读状态适配器脚手架条件已满足，实际调用仍禁用" :
                        "协议适配条件不完整，实际调用保持禁用",
                    data: plan
                };
            }

            result = oldRequest(requestValue);
            try {
                status = runtime.status();
                plan = status.protocolAdapterPlan;
                if (result && result.data && plan) {
                    result.data.protocolAdapterPlan = plan;
                }
            } catch (ignoredResult) {}
            return result;
        };

        runtime.protocolAdapterPlan = function () {
            return runtime.request({
                requestId: "sbh-adapter-plan-" + SBH.util.now(),
                command: "runtime.protocol_adapter_plan"
            });
        };

        SBH.app.start = function () {
            var result = oldAppStart();
            var status;
            var plan;
            try {
                status = runtime.status();
                plan = status.protocolAdapterPlan ||
                    pendingPlan("checking", null);
            } catch (error) {
                plan = pendingPlan(
                    "adapter_plan_status_unavailable",
                    SBH.util.errorText(error)
                );
            }
            result.runtimeProtocolAdapterPlan =
                String(plan.state || "checking");
            result.runtimeProtocolAdapterPlanDetails = plan;
            result.writeOperationsLocked = true;
            result.destructiveOperations = false;
            return result;
        };
    }

    if (!cachedPlan || Number(cachedPlan.schemaVersion) !== CACHE_SCHEMA) {
        cachedPlan = null;
    } else {
        cachedPlan.discoveryStale = true;
        cachedPlan.source = "persisted_cache";
    }

    install();
}());
