/* SingBoxHub asynchronous Runtime write gate and coordinator. Rhino ES5 only. */
SBH.versions.runtimeWriteGate = 2;
SBH.versions.app = 7;

(function () {
    var P = Packages;
    var File = P.java.io.File;
    var JavaString = P.java.lang.String;
    var Base64 = P.android.util.Base64;
    var IntentFilter = P.android.content.IntentFilter;
    var BroadcastReceiver = P.android.content.BroadcastReceiver;
    var Context = P.android.content.Context;
    var MAX_ENDPOINT_BYTES = 65536;
    var gateCache = null;
    var asyncQueue = [];
    var asyncRunning = false;

    function own(value, key) {
        return Object.prototype.hasOwnProperty.call(value, key);
    }

    function isArray(value) {
        return Object.prototype.toString.call(value) === "[object Array]";
    }

    function unique(output, value) {
        var text = String(value || "");
        var i;
        if (!text || text.length > 96 || output.length >= 64) {
            return;
        }
        for (i = 0; i < output.length; i += 1) {
            if (output[i] === text) {
                return;
            }
        }
        output.push(text);
    }

    function collectCommands(output, value) {
        var i;
        var key;
        if (typeof value === "string" || typeof value === "number") {
            unique(output, value);
            return;
        }
        if (isArray(value)) {
            for (i = 0; i < value.length; i += 1) {
                if (value[i] && typeof value[i] === "object") {
                    unique(
                        output,
                        value[i].command || value[i].name ||
                        value[i].id || value[i].method ||
                        value[i].action || ""
                    );
                } else {
                    unique(output, value[i]);
                }
            }
            return;
        }
        if (value && typeof value === "object") {
            for (key in value) {
                if (own(value, key)) {
                    unique(output, key);
                }
            }
        }
    }

    function profileOf(endpoint) {
        var commands = [];
        var sensitive = [];
        var fieldPaths = [];
        var commandKey = /^(commands|controlCommands|allowedCommands|capabilities|methods|operations|actions|supportedCommands)$/i;
        var secretKey = /(token|secret|password|credential|authorization|auth(token|secret|key|file|path)|^auth$|private[_-]?key|nonce)/i;

        function addField(path) {
            if (fieldPaths.length < 96) {
                unique(fieldPaths, path);
            }
        }

        function walk(value, path, depth) {
            var key;
            var child;
            var nextPath;
            if (!value || typeof value !== "object" || depth > 4) {
                return;
            }
            for (key in value) {
                if (!own(value, key)) {
                    continue;
                }
                child = value[key];
                nextPath = path ? path + "." + key : String(key);
                addField(nextPath);
                if (commandKey.test(String(key))) {
                    collectCommands(commands, child);
                }
                if (secretKey.test(String(key)) &&
                        child !== null && child !== undefined &&
                        String(child).length && sensitive.length < 32) {
                    sensitive.push(nextPath);
                }
                if (child && typeof child === "object") {
                    walk(child, nextPath, depth + 1);
                }
            }
        }

        if (!endpoint || typeof endpoint !== "object") {
            return {
                parseOk: false,
                schemaPresent: false,
                authPresent: false,
                commands: [],
                sensitiveFields: [],
                fieldPaths: []
            };
        }

        walk(endpoint, "", 0);
        return {
            parseOk: true,
            schemaPresent:
                endpoint.schemaVersion !== undefined ||
                endpoint.protocolVersion !== undefined ||
                endpoint.version !== undefined,
            schemaVersion: String(
                endpoint.schemaVersion !== undefined ? endpoint.schemaVersion :
                (endpoint.protocolVersion !== undefined ? endpoint.protocolVersion :
                (endpoint.version !== undefined ? endpoint.version : ""))
            ),
            authPresent: sensitive.length > 0,
            commands: commands,
            sensitiveFields: sensitive,
            fieldPaths: fieldPaths
        };
    }

    function normalize(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/\s+/g, "")
            .replace(/_/g, ".");
    }

    function hasCommand(commands, values) {
        var i;
        var j;
        var command;
        for (i = 0; i < commands.length; i += 1) {
            command = normalize(commands[i]);
            for (j = 0; j < values.length; j += 1) {
                if (command === normalize(values[j])) {
                    return true;
                }
            }
        }
        return false;
    }

    function numberValue(value, fallback) {
        var parsed = Number(value);
        return isFinite(parsed) ? parsed : fallback;
    }

    function pendingGate(state, error) {
        return {
            schemaVersion: 2,
            state: state || "checking",
            checking: state === undefined || state === null || state === "checking",
            endpointExists: false,
            endpointValidated: false,
            commands: [],
            endpointFieldPaths: [],
            readyForExplicitDryRun: false,
            rawEndpointExposed: false,
            writeOperationsLocked: true,
            dryRunInvoked: false,
            destructiveOperations: false,
            error: error || null,
            checkedAt: SBH.util.now()
        };
    }

    function buildGate(runtime, probe, profile) {
        var exists = probe && probe.exists === true;
        var expected = String(runtime.runtimeRoot || "") +
            "/runtime/control/control_endpoint.json";
        var owner = numberValue(probe ? probe.uid : "", -1);
        var modeText = String(probe ? probe.mode || "" : "");
        var mode = /^[0-7]{3,4}$/.test(modeText) ?
            parseInt(modeText, 8) : -1;
        var size = numberValue(probe ? probe.size : "", -1);
        var commands = profile.commands || [];
        var statusCapability = hasCommand(
            commands,
            ["status", "runtime.status", "core.status"]
        );
        var startCapability = hasCommand(
            commands,
            ["start", "runtime.start", "core.start"]
        );
        var stopCapability = hasCommand(
            commands,
            ["stop", "runtime.stop", "core.stop"]
        );
        var dryRunCapability = hasCommand(
            commands,
            [
                "dry-run", "dry_run", "preflight",
                "runtime.preflight", "core.preflight",
                "core.start.dry-run", "core.start.dry_run"
            ]
        );
        var trustedOwner = owner === 0 || owner === 1000;
        var notWorldWritable = mode >= 0 && (mode & 2) === 0;
        var pathMatched = String(probe ? probe.real || "" : "") === expected;
        var protocolDeclared = commands.length > 0;
        var endpointValidated =
            exists && profile.parseOk && profile.schemaPresent &&
            profile.authPresent && protocolDeclared && trustedOwner &&
            notWorldWritable && size > 0 && size <= MAX_ENDPOINT_BYTES &&
            pathMatched;
        var writeCapabilities = startCapability && stopCapability;
        var ready = endpointValidated && writeCapabilities && dryRunCapability;
        var state;

        if (!runtime.attached) {
            state = runtime.checking ? "checking" : "runtime_not_attached";
        } else if (!exists) {
            state = "endpoint_missing";
        } else if (!profile.parseOk) {
            state = "endpoint_parse_failed";
        } else if (!endpointValidated) {
            state = "endpoint_review_required";
        } else if (!writeCapabilities) {
            state = "write_capabilities_not_declared";
        } else if (!dryRunCapability) {
            state = "dry_run_not_declared";
        } else {
            state = "ready_for_explicit_dry_run";
        }

        return {
            schemaVersion: 2,
            state: state,
            checking: state === "checking",
            endpointExists: exists,
            endpointValidated: endpointValidated,
            canonicalPathMatched: pathMatched,
            ownerUid: owner,
            ownerGid: numberValue(probe ? probe.gid : "", -1),
            ownerTrusted: trustedOwner,
            mode: modeText,
            notWorldWritable: notWorldWritable,
            strictPermissions: mode >= 0 && (mode & 18) === 0,
            size: size,
            sizeAccepted: size > 0 && size <= MAX_ENDPOINT_BYTES,
            mtimeEpochSeconds: numberValue(probe ? probe.mtime : "", 0),
            ageSeconds: Math.max(
                0,
                numberValue(probe ? probe.now : "", 0) -
                numberValue(probe ? probe.mtime : "", 0)
            ),
            sha256Prefix: String(probe ? probe.sha || "" : "").substring(0, 16),
            parseOk: profile.parseOk === true,
            schemaPresent: profile.schemaPresent === true,
            endpointSchemaVersion: String(profile.schemaVersion || ""),
            protocolDeclared: protocolDeclared,
            commandCount: commands.length,
            commands: commands,
            endpointFieldPaths: profile.fieldPaths || [],
            statusCapabilityDeclared: statusCapability,
            startCapabilityDeclared: startCapability,
            stopCapabilityDeclared: stopCapability,
            writeCapabilitiesDiscovered: writeCapabilities,
            dryRunCapabilityDiscovered: dryRunCapability,
            readyForExplicitDryRun: ready,
            sensitiveFieldCount: (profile.sensitiveFields || []).length,
            sensitiveFields: profile.sensitiveFields || [],
            authPresent: profile.authPresent === true,
            rawEndpointExposed: false,
            writeOperationsLocked: true,
            dryRunInvoked: false,
            destructiveOperations: false,
            checkedAt: SBH.util.now()
        };
    }

    function inspectGateFromProbe(runtime, probe) {
        var endpoint = null;
        var profile;
        if (!runtime || runtime.checking === true) {
            gateCache = pendingGate("checking", null);
            return gateCache;
        }
        if (!probe) {
            gateCache = pendingGate(
                "endpoint_probe_unavailable",
                "Runtime endpoint probe unavailable"
            );
            return gateCache;
        }
        try {
            if (probe.exists && probe.data) {
                endpoint = JSON.parse(String(
                    new JavaString(
                        Base64.decode(String(probe.data), Base64.DEFAULT),
                        "UTF-8"
                    )
                ));
            }
            profile = profileOf(endpoint);
            gateCache = buildGate(runtime, probe, profile);
        } catch (error) {
            gateCache = pendingGate(
                "endpoint_inspection_failed",
                SBH.util.errorText(error)
            );
            gateCache.endpointExists = probe.exists === true;
        }
        return gateCache;
    }

    function gateMessage(gate) {
        if (gate.readyForExplicitDryRun) {
            return "写操作门禁通过，可进入显式干运行阶段";
        }
        if (gate.endpointValidated) {
            return "控制端点已校验，写操作仍锁定";
        }
        if (gate.checking) {
            return "Runtime 门禁正在后台检查";
        }
        if (gate.endpointExists) {
            return "控制端点需要复核，写操作保持锁定";
        }
        return "未发现生产控制端点，写操作保持锁定";
    }

    function stateName(status) {
        return status && status.coreRunning ? "running" : "stopped";
    }

    function drainAsyncQueue() {
        var item;
        if (asyncRunning || asyncQueue.length === 0) {
            return;
        }
        item = asyncQueue.shift();
        asyncRunning = true;
        SBH.util.runBg(
            item.work,
            function (value, error, elapsed) {
                asyncRunning = false;
                if (typeof item.callback === "function") {
                    try {
                        item.callback(value, error, elapsed);
                    } catch (callbackError) {
                        SBH.log.error("runtime.async", callbackError);
                    }
                }
                drainAsyncQueue();
            },
            item.name || "SingBoxHub-runtime-operation"
        );
    }

    function enqueueAsync(work, callback, name) {
        asyncQueue.push({work: work, callback: callback, name: name});
        drainAsyncQueue();
        return true;
    }

    function installGate() {
        var runtime = SBH.runtime;
        var oldStatus = runtime.status;
        var oldRefresh = runtime.refresh;
        var oldRequest = runtime.request;

        function enrichCached(status) {
            status = status || {};
            status.writeGate = gateCache || pendingGate("checking", null);
            status.writeOperationsLocked = true;
            status.destructiveOperations = false;
            status.asyncOperationInFlight = asyncRunning;
            status.asyncQueueDepth = asyncQueue.length;
            return status;
        }

        runtime.status = function () {
            return enrichCached(oldStatus());
        };

        runtime.refresh = function () {
            var status = oldRefresh();
            var probe = null;
            try {
                if (typeof runtime.endpointProbe === "function") {
                    probe = runtime.endpointProbe();
                }
            } catch (ignoredProbe) {}
            status.writeGate = inspectGateFromProbe(status, probe);
            status.writeOperationsLocked = true;
            status.destructiveOperations = false;
            return status;
        };

        runtime.refreshAsync = function (callback) {
            return enqueueAsync(
                function () {
                    return runtime.refresh();
                },
                callback,
                "SingBoxHub-runtime-refresh"
            );
        };

        runtime.request = function (requestValue) {
            var command = requestValue && requestValue.command ?
                String(requestValue.command) : "";
            var requestId = requestValue && requestValue.requestId ?
                String(requestValue.requestId) : "";
            var status;
            var gate;
            var handshake;

            if (command === "runtime.write_gate") {
                status = runtime.refresh();
                gate = status.writeGate || {};
                return {
                    ok: gate.endpointValidated === true,
                    requestId: requestId,
                    code: gate.readyForExplicitDryRun ?
                        "WRITE_GATE_READY" :
                        (gate.endpointValidated ?
                            "WRITE_GATE_ENDPOINT_VALID" :
                            "WRITE_GATE_BLOCKED"),
                    stateBefore: stateName(status),
                    stateAfter: stateName(status),
                    message: gateMessage(gate),
                    data: gate
                };
            }

            if (command === "runtime.status" ||
                    command === "core.status" ||
                    command === "route.status") {
                status = runtime.refresh();
                return {
                    ok: status.ok === true,
                    requestId: requestId,
                    code: status.ok ?
                        "READ_ONLY_STATUS" :
                        "RUNTIME_STATUS_UNAVAILABLE",
                    stateBefore: stateName(status),
                    stateAfter: stateName(status),
                    message: status.ok ?
                        "只读 Runtime 状态已刷新" :
                        "无法读取 Runtime 状态",
                    data: status
                };
            }

            if (command === "runtime.handshake") {
                status = runtime.refresh();
                handshake = status.handshake || {};
                return {
                    ok: status.attached === true,
                    requestId: requestId,
                    code: status.attached === true ?
                        "READ_ONLY_HANDSHAKE_OK" :
                        "RUNTIME_NOT_ATTACHED",
                    stateBefore: stateName(status),
                    stateAfter: stateName(status),
                    message: status.attached === true ?
                        "Runtime 只读握手成功" :
                        "Runtime 未完成只读接入",
                    data: handshake
                };
            }

            status = runtime.status();
            return {
                ok: false,
                requestId: requestId,
                code: "WRITE_OPERATIONS_LOCKED",
                stateBefore: stateName(status),
                stateAfter: stateName(status),
                message: "写操作门禁尚未解除，未执行任何 Runtime 写命令",
                data: status.writeGate || status
            };
        };

        runtime.requestAsync = function (requestValue, callback) {
            return enqueueAsync(
                function () {
                    return runtime.request(requestValue);
                },
                callback,
                "SingBoxHub-runtime-request"
            );
        };

        runtime.writeGate = function () {
            return runtime.request({
                requestId: "sbh-write-gate-" + SBH.util.now(),
                command: "runtime.write_gate"
            });
        };

        runtime.writeGateAsync = function (callback) {
            return runtime.requestAsync(
                {
                    requestId: "sbh-write-gate-" + SBH.util.now(),
                    command: "runtime.write_gate"
                },
                callback
            );
        };

        runtime.isAsyncBusy = function () {
            return asyncRunning || asyncQueue.length > 0;
        };

        runtime.writeOperationsLocked = true;
        runtime.originalReadOnlyRequest = oldRequest;
    }

    installGate();

    function runtimeStatus() {
        try {
            if (SBH.runtime && typeof SBH.runtime.status === "function") {
                return SBH.runtime.status();
            }
        } catch (error) {
            SBH.log.warn("app", "Runtime status unavailable: " + error);
        }
        return {
            attached: false,
            checking: true,
            readOnly: true,
            transport: "unavailable",
            runtimeState: "checking",
            writeGate: pendingGate("checking", null),
            writeOperationsLocked: true,
            destructiveOperations: false
        };
    }

    function gateState(runtime) {
        return runtime && runtime.writeGate && runtime.writeGate.state ?
            String(runtime.writeGate.state) : "checking";
    }

    function createJsonWriter(file, name) {
        var pending = null;
        var writing = false;
        var cancelled = false;

        function flush() {
            var value;
            if (cancelled || writing || pending === null) {
                return;
            }
            value = pending;
            pending = null;
            writing = true;
            SBH.util.runBg(
                function () {
                    SBH.files.writeJson(file, value);
                    return true;
                },
                function (ignoredValue, error) {
                    writing = false;
                    if (error) {
                        SBH.log.warn(name, SBH.util.errorText(error));
                    }
                    if (!cancelled && pending !== null) {
                        flush();
                    }
                },
                name
            );
        }

        return {
            write: function (value) {
                if (cancelled) {
                    return false;
                }
                pending = value;
                flush();
                return true;
            },
            cancel: function () {
                cancelled = true;
                pending = null;
            }
        };
    }

    function start() {
        var previous = SBH.global.__SBH_APP__;
        var endpointFile = new File(
            SBH.paths.cacheDir,
            "control_endpoint.json"
        );
        var statusFile = new File(
            SBH.paths.cacheDir,
            "ui_status.json"
        );
        var endpointWriter = createJsonWriter(endpointFile, "app.endpoint");
        var statusWriter = createJsonWriter(statusFile, "app.status");
        var token = SBH.util.randomToken();
        var action = "com.singboxhub.control." + token;
        var controller;
        var receiver = null;
        var receiverRegistered = false;
        var stopped = false;
        var initialRuntime;

        try {
            if (previous && previous.controller) {
                previous.controller.onHidden = null;
            }
            if (previous && typeof previous.stop === "function") {
                previous.stop();
            }
        } catch (ignoredPrevious) {}

        try {
            if (endpointFile.exists()) {
                endpointFile.delete();
            }
        } catch (ignoredEndpoint) {}

        initialRuntime = runtimeStatus();
        controller = SBH.window.createController();

        function statusValue(command) {
            var status = controller.status();
            var runtime = runtimeStatus();
            status.schemaVersion = 4;
            status.command = command || "status";
            status.updatedAt = SBH.util.now();
            status.moduleSetVersion = SBH.bootstrap.moduleSetVersion;
            status.runtimeAttached = runtime.attached === true;
            status.runtimeChecking = runtime.checking === true;
            status.runtimeReadOnly = runtime.readOnly !== false;
            status.runtimeTransport = String(runtime.transport || "unavailable");
            status.runtimeState = String(runtime.runtimeState || "checking");
            status.runtimeWriteGate = gateState(runtime);
            status.writeOperationsLocked = true;
            status.destructiveOperations = false;
            status.receiverRegistered = receiverRegistered;
            return status;
        }

        function writeStatus(command) {
            var value = statusValue(command);
            statusWriter.write(value);
            return value;
        }

        function controlEndpointValue(runtime) {
            return {
                schemaVersion: 4,
                action: action,
                token: token,
                commands: [
                    "show", "hide", "toggle", "status",
                    "refresh_runtime", "stop_ui"
                ],
                moduleSetVersion: SBH.bootstrap.moduleSetVersion,
                runtimeAttached: runtime.attached === true,
                runtimeChecking: runtime.checking === true,
                runtimeReadOnly: runtime.readOnly !== false,
                runtimeWriteGate: gateState(runtime),
                writeOperationsLocked: true,
                destructiveOperations: false,
                createdAt: SBH.util.now()
            };
        }

        function writeControlEndpoint(runtime) {
            if (!receiverRegistered || stopped) {
                return;
            }
            endpointWriter.write(controlEndpointValue(runtime));
        }

        function removeEndpoint() {
            endpointWriter.cancel();
            try {
                if (endpointFile.exists()) {
                    endpointFile.delete();
                }
            } catch (ignoredDelete) {}
        }

        function stopCoordinator() {
            if (stopped) {
                return true;
            }
            stopped = true;
            try {
                controller.stop();
            } catch (ignoredStop) {}
            try {
                if (receiverRegistered && receiver !== null) {
                    SBH.ctx.unregisterReceiver(receiver);
                }
            } catch (ignoredReceiver) {}
            receiverRegistered = false;
            removeEndpoint();
            writeStatus("stop_ui");
            SBH.log.info("app", "Coordinator stopped");
            return true;
        }

        function applyRuntimeResult(runtime, error) {
            var status;
            if (stopped) {
                return;
            }
            status = runtime || runtimeStatus();
            if (error) {
                SBH.log.warn("app.runtime", SBH.util.errorText(error));
            }
            try {
                controller.applyRuntimeBadge(status);
            } catch (ignoredBadge) {}
            try {
                if (controller.attached && controller.page === 0) {
                    controller.showPage(0);
                }
            } catch (ignoredPage) {}
            writeControlEndpoint(status);
            writeStatus("runtime_refreshed");
        }

        receiver = new JavaAdapter(BroadcastReceiver, {
            onReceive: function (contextValue, intent) {
                var command;
                var receivedToken;
                if (intent === null || stopped) {
                    return;
                }
                receivedToken = String(intent.getStringExtra("token") || "");
                if (receivedToken !== token) {
                    SBH.log.warn("app", "Rejected control token");
                    return;
                }
                command = String(intent.getStringExtra("command") || "status");
                if (command === "show") {
                    controller.show();
                } else if (command === "hide") {
                    controller.hide();
                } else if (command === "toggle") {
                    controller.toggle();
                } else if (command === "refresh_runtime") {
                    SBH.runtime.refreshAsync(applyRuntimeResult);
                } else if (command === "stop_ui") {
                    stopCoordinator();
                    return;
                }
                writeStatus(command);
            }
        });

        try {
            if (SBH.Build.VERSION.SDK_INT >= 33) {
                SBH.ctx.registerReceiver(
                    receiver,
                    new IntentFilter(action),
                    Context.RECEIVER_NOT_EXPORTED
                );
            } else {
                SBH.ctx.registerReceiver(receiver, new IntentFilter(action));
            }
            receiverRegistered = true;
        } catch (receiverError) {
            receiverRegistered = false;
            SBH.log.warn(
                "app",
                "Control receiver unavailable: " + receiverError
            );
        }

        controller.onHidden = function () {
            writeStatus("hidden");
        };

        SBH.global.__SBH_APP__ = {
            controller: controller,
            receiver: receiver,
            stop: stopCoordinator,
            action: receiverRegistered ? action : null,
            token: receiverRegistered ? token : null,
            runtime: SBH.runtime
        };

        controller.open();
        writeControlEndpoint(initialRuntime);
        writeStatus("opening");
        SBH.runtime.refreshAsync(applyRuntimeResult);
        SBH.log.ok("app", "Full UI coordinator started");

        return {
            ok: true,
            started: true,
            status: "full_ui_opening",
            safeMode: false,
            coordinatorStarted: true,
            receiverRegistered: receiverRegistered,
            windowOperationsEnabled: true,
            uiVisible: true,
            runtimeAttached: initialRuntime.attached === true,
            runtimeCheckPending: true,
            runtimeReadOnly: initialRuntime.readOnly !== false,
            runtimeTransport: String(initialRuntime.transport || "unavailable"),
            runtimeState: String(initialRuntime.runtimeState || "checking"),
            runtimeWriteGate: gateState(initialRuntime),
            runtimeWriteGateDetails:
                initialRuntime.writeGate || pendingGate("checking", null),
            writeOperationsLocked: true,
            destructiveOperations: false,
            controlAction: receiverRegistered ? action : null,
            controlEndpointPath: receiverRegistered ?
                endpointFile.getAbsolutePath() : null,
            moduleSetVersion: SBH.bootstrap.moduleSetVersion
        };
    }

    SBH.app = {
        start: start
    };
}());
