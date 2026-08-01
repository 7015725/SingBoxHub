/* SingBoxHub production endpoint protocol discovery. Rhino ES5 only. */
SBH.versions.protocolDiscovery = 1;

(function () {
    var P = Packages;
    var File = P.java.io.File;
    var JavaString = P.java.lang.String;
    var Base64 = P.android.util.Base64;
    var CACHE_SCHEMA = 1;
    var MAX_FIELDS = 96;
    var cacheFile = new File(
        SBH.paths.cacheDir,
        "runtime_protocol_discovery.json"
    );
    var cachedDiscovery = SBH.files.readJson(cacheFile, null);
    var cachedProbeKey = "";

    function own(value, key) {
        return Object.prototype.hasOwnProperty.call(value, key);
    }

    function isArray(value) {
        return Object.prototype.toString.call(value) === "[object Array]";
    }

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

    function pendingDiscovery(state, error) {
        return {
            schemaVersion: CACHE_SCHEMA,
            state: state || "checking",
            checking: state === undefined || state === null ||
                state === "checking",
            endpointExists: false,
            parseOk: false,
            schemaPresent: false,
            authenticationDeclared: false,
            adapterState: "unavailable",
            transportKind: "unknown",
            transportCandidates: [],
            topLevelFields: [],
            fieldDescriptors: [],
            channelCandidates: [],
            commandCarrierCandidates: [],
            correlationCandidates: [],
            statusCarrierCandidates: [],
            safeScalarHints: [],
            protocolFingerprint: "",
            requestChannelDeclared: false,
            responseChannelDeclared: false,
            requestResponsePairDeclared: false,
            commandCarrierDeclared: false,
            correlationDeclared: false,
            statusCarrierDeclared: false,
            readyForAdapterImplementation: false,
            readyForExplicitDryRun: false,
            probeOnly: true,
            rawEndpointExposed: false,
            writeOperationsLocked: true,
            destructiveOperations: false,
            stale: false,
            error: error || null,
            checkedAt: SBH.util.now()
        };
    }

    function valueType(value) {
        if (value === null) {
            return "null";
        }
        if (isArray(value)) {
            return "array";
        }
        return typeof value;
    }

    function valueKind(value) {
        var text;
        if (value === null || value === undefined) {
            return "empty";
        }
        if (typeof value === "boolean") {
            return "boolean";
        }
        if (typeof value === "number") {
            return "number";
        }
        if (typeof value !== "string") {
            return valueType(value);
        }
        text = String(value);
        if (/^\/[^\r\n]*$/.test(text)) {
            return "absolute_path";
        }
        if (/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:\/|$)/i.test(text)) {
            return "local_url";
        }
        if (/^[A-Za-z][A-Za-z0-9_.-]{2,127}$/.test(text) &&
                text.indexOf(".") >= 0) {
            return "action_or_identifier";
        }
        if (/^\d+$/.test(text)) {
            return "numeric_text";
        }
        return "text";
    }

    function isSensitivePath(path) {
        return /(token|secret|password|credential|authorization|auth(token|secret|key|file|path)|^auth$|private[_-]?key|nonce|cookie|signature)/i
            .test(String(path || ""));
    }

    function safeHintAllowed(path, value) {
        var key = String(path || "").split(".").pop();
        var text;
        if (isSensitivePath(path)) {
            return false;
        }
        if (!/(schema|protocol|version|transport|type|mode|format|encoding|kind)$/i
                .test(key)) {
            return false;
        }
        if (typeof value !== "string" && typeof value !== "number" &&
                typeof value !== "boolean") {
            return false;
        }
        text = String(value);
        return text.length <= 64 && !/[\r\n]/.test(text);
    }

    function addScore(scores, name, amount) {
        scores[name] = Number(scores[name] || 0) + Number(amount || 0);
    }

    function inspectStructure(endpoint) {
        var descriptors = [];
        var topLevelFields = [];
        var channelCandidates = [];
        var commandCandidates = [];
        var correlationCandidates = [];
        var statusCandidates = [];
        var authFields = [];
        var safeHints = [];
        var scores = {
            file_mailbox: 0,
            unix_socket: 0,
            broadcast: 0,
            local_http: 0,
            shell_cli: 0
        };
        var requestDeclared = false;
        var responseDeclared = false;
        var commandDeclared = false;
        var correlationDeclared = false;
        var statusDeclared = false;

        function addDescriptor(path, value) {
            var type = valueType(value);
            var kind = valueKind(value);
            var lower = String(path || "").toLowerCase();
            var text = typeof value === "string" ? String(value) : "";
            var sensitive = isSensitivePath(path);
            var descriptor;

            if (descriptors.length < MAX_FIELDS) {
                descriptor = {
                    path: String(path),
                    type: type,
                    valueKind: kind,
                    sensitive: sensitive
                };
                if (typeof value === "string") {
                    descriptor.valueLength = text.length;
                } else if (isArray(value)) {
                    descriptor.itemCount = value.length;
                } else if (value && typeof value === "object") {
                    try {
                        descriptor.keyCount = Object.keys(value).length;
                    } catch (ignoredKeys) {}
                }
                descriptors.push(descriptor);
            }

            if (sensitive) {
                unique(authFields, path, 32);
            }
            if (safeHintAllowed(path, value)) {
                safeHints.push({path: String(path), value: value});
            }

            if (/(request|inbox|input|command[_-]?dir|command[_-]?file|queue[_-]?in)/i
                    .test(lower)) {
                requestDeclared = true;
                unique(channelCandidates, path, 48);
                addScore(scores, "file_mailbox", kind === "absolute_path" ? 4 : 2);
            }
            if (/(response|reply|result|outbox|output|queue[_-]?out)/i
                    .test(lower)) {
                responseDeclared = true;
                unique(channelCandidates, path, 48);
                addScore(scores, "file_mailbox", kind === "absolute_path" ? 4 : 2);
            }
            if (/(socket|sock|uds)/i.test(lower)) {
                unique(channelCandidates, path, 48);
                addScore(scores, "unix_socket", 4);
                if (/\.sock(?:et)?$/i.test(text)) {
                    addScore(scores, "unix_socket", 3);
                }
            }
            if (/(action|broadcast|intent)/i.test(lower)) {
                unique(channelCandidates, path, 48);
                addScore(scores, "broadcast", kind === "action_or_identifier" ? 4 : 2);
            }
            if (/(url|uri|host|port|http|listen|address)/i.test(lower)) {
                unique(channelCandidates, path, 48);
                addScore(scores, "local_http", kind === "local_url" ? 5 : 2);
            }
            if (/(binary|executable|cli|ctl|command[_-]?path|script)/i.test(lower)) {
                addScore(scores, "shell_cli", kind === "absolute_path" ? 4 : 2);
            }
            if (/(command|operation|method|action|opcode|verb)/i.test(lower)) {
                commandDeclared = true;
                unique(commandCandidates, path, 48);
            }
            if (/(request[_-]?id|correlation|transaction|trace[_-]?id|message[_-]?id|\bid\b)/i
                    .test(lower)) {
                correlationDeclared = true;
                unique(correlationCandidates, path, 32);
            }
            if (/(status|state|health|running|pid|last[_-]?error)/i.test(lower)) {
                statusDeclared = true;
                unique(statusCandidates, path, 48);
            }
        }

        function walk(value, path, depth) {
            var key;
            var child;
            var nextPath;
            if (!value || typeof value !== "object" || depth > 5) {
                return;
            }
            for (key in value) {
                if (!own(value, key)) {
                    continue;
                }
                child = value[key];
                nextPath = path ? path + "." + key : String(key);
                if (!path) {
                    unique(topLevelFields, key, 64);
                }
                addDescriptor(nextPath, child);
                if (child && typeof child === "object") {
                    walk(child, nextPath, depth + 1);
                }
            }
        }

        walk(endpoint, "", 0);
        return {
            descriptors: descriptors,
            topLevelFields: topLevelFields,
            channelCandidates: channelCandidates,
            commandCandidates: commandCandidates,
            correlationCandidates: correlationCandidates,
            statusCandidates: statusCandidates,
            authFields: authFields,
            safeHints: safeHints,
            scores: scores,
            requestDeclared: requestDeclared,
            responseDeclared: responseDeclared,
            commandDeclared: commandDeclared,
            correlationDeclared: correlationDeclared,
            statusDeclared: statusDeclared
        };
    }

    function chooseTransport(scores) {
        var names = [
            "file_mailbox",
            "unix_socket",
            "broadcast",
            "local_http",
            "shell_cli"
        ];
        var candidates = [];
        var bestName = "unknown";
        var bestScore = 0;
        var secondScore = 0;
        var i;
        var score;

        for (i = 0; i < names.length; i += 1) {
            score = Number(scores[names[i]] || 0);
            if (score > 0) {
                candidates.push({kind: names[i], score: score});
            }
            if (score > bestScore) {
                secondScore = bestScore;
                bestScore = score;
                bestName = names[i];
            } else if (score > secondScore) {
                secondScore = score;
            }
        }
        candidates.sort(function (left, right) {
            return Number(right.score) - Number(left.score);
        });
        return {
            kind: bestScore > 0 ? bestName : "unknown",
            score: bestScore,
            ambiguous: bestScore > 0 && secondScore === bestScore,
            candidates: candidates
        };
    }

    function endpointFromProbe(probe) {
        if (!probe || probe.exists !== true || !probe.data) {
            return null;
        }
        return JSON.parse(String(
            new JavaString(
                Base64.decode(String(probe.data), Base64.DEFAULT),
                "UTF-8"
            )
        ));
    }

    function probeKey(probe) {
        if (!probe) {
            return "";
        }
        return [
            String(probe.sha || ""),
            String(probe.size || ""),
            String(probe.mtime || ""),
            String(probe.exists === true)
        ].join(":");
    }

    function buildDiscovery(runtime, probe) {
        var endpoint;
        var structure;
        var transport;
        var schemaPresent;
        var schemaVersion;
        var fingerprintInput = [];
        var i;
        var adapterState;
        var readyForAdapter;
        var discovery;

        if (!runtime || runtime.checking === true) {
            return pendingDiscovery("checking", null);
        }
        if (!probe) {
            return pendingDiscovery(
                "endpoint_probe_unavailable",
                "Runtime endpoint probe unavailable"
            );
        }
        if (probe.exists !== true) {
            discovery = pendingDiscovery("endpoint_missing", null);
            discovery.endpointExists = false;
            discovery.checkedAt = SBH.util.now();
            return discovery;
        }

        try {
            endpoint = endpointFromProbe(probe);
            if (!endpoint || typeof endpoint !== "object") {
                discovery = pendingDiscovery(
                    "endpoint_parse_failed",
                    "Endpoint JSON object unavailable"
                );
                discovery.endpointExists = true;
                return discovery;
            }
            structure = inspectStructure(endpoint);
            transport = chooseTransport(structure.scores);
            schemaPresent = endpoint.schemaVersion !== undefined ||
                endpoint.protocolVersion !== undefined ||
                endpoint.version !== undefined;
            schemaVersion = String(
                endpoint.schemaVersion !== undefined ? endpoint.schemaVersion :
                (endpoint.protocolVersion !== undefined ? endpoint.protocolVersion :
                (endpoint.version !== undefined ? endpoint.version : ""))
            );
            for (i = 0; i < structure.descriptors.length; i += 1) {
                fingerprintInput.push(
                    structure.descriptors[i].path + ":" +
                    structure.descriptors[i].type + ":" +
                    structure.descriptors[i].valueKind
                );
            }
            fingerprintInput.sort();

            if (transport.ambiguous) {
                adapterState = "transport_ambiguous";
            } else if (transport.kind !== "unknown") {
                adapterState = "transport_identified";
            } else {
                adapterState = "structure_identified";
            }
            readyForAdapter = schemaPresent &&
                structure.authFields.length > 0 &&
                transport.kind !== "unknown" &&
                !transport.ambiguous;

            discovery = {
                schemaVersion: CACHE_SCHEMA,
                state: readyForAdapter ?
                    "ready_for_adapter_implementation" :
                    adapterState,
                checking: false,
                endpointExists: true,
                parseOk: true,
                endpointSchemaPresent: schemaPresent,
                endpointSchemaVersion: schemaVersion,
                authenticationDeclared: structure.authFields.length > 0,
                authenticationFields: structure.authFields,
                adapterState: adapterState,
                transportKind: transport.kind,
                transportScore: transport.score,
                transportAmbiguous: transport.ambiguous,
                transportCandidates: transport.candidates,
                topLevelFields: structure.topLevelFields,
                fieldDescriptors: structure.descriptors,
                channelCandidates: structure.channelCandidates,
                commandCarrierCandidates: structure.commandCandidates,
                correlationCandidates: structure.correlationCandidates,
                statusCarrierCandidates: structure.statusCandidates,
                safeScalarHints: structure.safeHints,
                protocolFingerprint: SBH.files.sha256Text(
                    fingerprintInput.join("\n")
                ).substring(0, 24),
                endpointSha256Prefix: String(probe.sha || "").substring(0, 16),
                endpointSize: Number(probe.size || 0),
                requestChannelDeclared: structure.requestDeclared,
                responseChannelDeclared: structure.responseDeclared,
                requestResponsePairDeclared:
                    structure.requestDeclared && structure.responseDeclared,
                commandCarrierDeclared: structure.commandDeclared,
                correlationDeclared: structure.correlationDeclared,
                statusCarrierDeclared: structure.statusDeclared,
                readyForAdapterImplementation: readyForAdapter,
                readyForExplicitDryRun: false,
                probeOnly: true,
                rawEndpointExposed: false,
                writeOperationsLocked: true,
                destructiveOperations: false,
                stale: false,
                checkedAt: SBH.util.now()
            };
            return discovery;
        } catch (error) {
            discovery = pendingDiscovery(
                "endpoint_inspection_failed",
                SBH.util.errorText(error)
            );
            discovery.endpointExists = true;
            return discovery;
        }
    }

    function persist(discovery) {
        if (!discovery || discovery.checking === true) {
            return;
        }
        cachedDiscovery = discovery;
        try {
            SBH.util.runBg(function () {
                SBH.files.writeJson(cacheFile, discovery);
                return true;
            }, null, "SingBoxHub-protocol-discovery-cache");
        } catch (error) {
            SBH.log.warn("protocol.cache", SBH.util.errorText(error));
        }
    }

    function currentProbe() {
        try {
            if (SBH.runtime &&
                    typeof SBH.runtime.endpointProbe === "function") {
                return SBH.runtime.endpointProbe();
            }
        } catch (ignored) {}
        return null;
    }

    function discoveryFor(runtime, persistValue) {
        var probe = currentProbe();
        var key = probeKey(probe);
        var discovery;

        if (probe && key && key === cachedProbeKey && cachedDiscovery) {
            discovery = cachedDiscovery;
        } else if (probe) {
            discovery = buildDiscovery(runtime, probe);
            cachedProbeKey = key;
            cachedDiscovery = discovery;
            if (persistValue === true) {
                persist(discovery);
            }
        } else if (cachedDiscovery) {
            discovery = cachedDiscovery;
            discovery.stale = true;
            discovery.source = "persisted_cache";
        } else {
            discovery = pendingDiscovery(
                runtime && runtime.checking === true ?
                    "checking" : "endpoint_probe_unavailable",
                null
            );
        }
        return discovery;
    }

    function install() {
        var runtime = SBH.runtime;
        var oldStatus = runtime.status;
        var oldRefresh = runtime.refresh;
        var oldRequest = runtime.request;
        var oldAppStart = SBH.app.start;

        runtime.status = function () {
            var status = oldStatus();
            var discovery = discoveryFor(status, false);
            status.protocolDiscovery = discovery;
            if (status.writeGate) {
                status.writeGate.protocolDiscovery = discovery;
                status.writeGate.protocolAdapterState =
                    String(discovery.adapterState || "unavailable");
                status.writeGate.protocolTransport =
                    String(discovery.transportKind || "unknown");
            }
            return status;
        };

        runtime.refresh = function () {
            var status = oldRefresh();
            var discovery = discoveryFor(status, true);
            status.protocolDiscovery = discovery;
            if (status.writeGate) {
                status.writeGate.protocolDiscovery = discovery;
                status.writeGate.protocolAdapterState =
                    String(discovery.adapterState || "unavailable");
                status.writeGate.protocolTransport =
                    String(discovery.transportKind || "unknown");
            }
            return status;
        };

        runtime.request = function (requestValue) {
            var command = requestValue && requestValue.command ?
                String(requestValue.command) : "";
            var requestId = requestValue && requestValue.requestId ?
                String(requestValue.requestId) : "";
            var status;
            var discovery;
            var result;

            if (command === "runtime.protocol_discovery") {
                status = runtime.refresh();
                discovery = status.protocolDiscovery ||
                    pendingDiscovery("endpoint_probe_unavailable", null);
                return {
                    ok: discovery.parseOk === true,
                    requestId: requestId,
                    code: discovery.readyForAdapterImplementation ?
                        "PROTOCOL_ADAPTER_READY" :
                        (discovery.parseOk ?
                            "PROTOCOL_STRUCTURE_IDENTIFIED" :
                            "PROTOCOL_DISCOVERY_BLOCKED"),
                    stateBefore: status.coreRunning ? "running" : "stopped",
                    stateAfter: status.coreRunning ? "running" : "stopped",
                    message: discovery.readyForAdapterImplementation ?
                        "生产端点协议已识别，可进入只读适配器实现阶段" :
                        (discovery.parseOk ?
                            "生产端点结构已提取，仍需适配传输协议" :
                            "生产端点协议尚未识别"),
                    data: discovery
                };
            }

            result = oldRequest(requestValue);
            try {
                status = runtime.status();
                discovery = status.protocolDiscovery;
                if (result && result.data && discovery) {
                    result.data.protocolDiscovery = discovery;
                }
            } catch (ignoredResult) {}
            return result;
        };

        runtime.protocolDiscovery = function () {
            return runtime.request({
                requestId: "sbh-protocol-" + SBH.util.now(),
                command: "runtime.protocol_discovery"
            });
        };

        SBH.app.start = function () {
            var result = oldAppStart();
            var status;
            var discovery;
            try {
                status = runtime.status();
                discovery = status.protocolDiscovery ||
                    pendingDiscovery("checking", null);
            } catch (error) {
                discovery = pendingDiscovery(
                    "protocol_status_unavailable",
                    SBH.util.errorText(error)
                );
            }
            result.runtimeProtocolDiscovery =
                String(discovery.state || "checking");
            result.runtimeProtocolDiscoveryDetails = discovery;
            result.writeOperationsLocked = true;
            result.destructiveOperations = false;
            return result;
        };
    }

    if (!cachedDiscovery ||
            Number(cachedDiscovery.schemaVersion) !== CACHE_SCHEMA) {
        cachedDiscovery = null;
    } else {
        cachedDiscovery.stale = true;
        cachedDiscovery.source = "persisted_cache";
    }

    install();
}());
