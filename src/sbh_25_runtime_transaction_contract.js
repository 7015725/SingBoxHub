/* SingBoxHub Runtime single-transaction read-only PING contract resolver. Rhino ES5 only. */
SBH.versions.runtimeTransactionContract = 1;
(function () {
var P = Packages;
var File = P.java.io.File;
var SCHEMA = 1;
var cacheFile = new File(SBH.paths.cacheDir, "runtime_transaction_contract.json");
var cache = SBH.files.readJson(cacheFile, null);
var cacheKey = "";

function blank(state, error) {
    return {
        schemaVersion: SCHEMA,
        state: state || "checking",
        checking: !state || state === "checking",
        sourceCfgState: "",
        sourceDataflowState: "",
        requestSchemaConfirmed: false,
        responseSchemaConfirmed: false,
        tokenValidationConfirmed: false,
        commandCarrierConfirmed: false,
        pingBranchConfirmed: false,
        pingResponseStatusResolved: false,
        pingExpectedResponses: [],
        correlationEchoConfirmed: false,
        correlationEchoEvidence: [],
        transactionBoundaryConfirmed: false,
        loopBackStateIsolated: false,
        pathStateLimitIsolated: false,
        currentTransactionSideEffects: [],
        ignoredCrossTransactionSideEffects: [],
        pingSideEffectFree: false,
        oneRequestOneResponseConfirmed: false,
        transactionRequestLineCount: 0,
        transactionResponseLineCount: 0,
        blockers: [],
        readOnlyPingContractReady: false,
        minimumProbeImplementation: "custom_local_socket_client_required",
        staticInspectionOnly: true,
        classLoadingPerformed: false,
        classInitializationPerformed: false,
        classInstantiationPerformed: false,
        socketConnectionAttempted: false,
        methodInvocationPerformed: false,
        dexExecuted: false,
        temporaryFilesCreated: false,
        runtimeFilesModified: false,
        authenticationValueRead: false,
        authenticationValueUsed: false,
        authenticationValueExposed: false,
        rawEndpointExposed: false,
        adapterImplementationAllowed: false,
        adapterInvocationEnabled: false,
        readyForExplicitDryRun: false,
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

function containsValue(values, expected) {
    var list = valueList(values);
    var i;
    for (i = 0; i < list.length; i += 1) {
        if (String(list[i]) === String(expected)) {
            return true;
        }
    }
    return false;
}

function stringContains(value, expected) {
    return String(value || "").indexOf(String(expected || "")) >= 0;
}

function arrayOnlyContains(values, expected) {
    var list = valueList(values);
    return list.length === 1 && String(list[0]) === String(expected);
}

function inputKey(status) {
    var cfg = status ? status.runtimeDexCfgContract : null;
    var flow = status ? status.runtimeDexProtocolDataflow : null;
    return [
        cfg ? cfg.inputKey : "",
        cfg ? cfg.checkedAt : "",
        cfg ? cfg.state : "",
        flow ? flow.inputKey : "",
        flow ? flow.checkedAt : "",
        flow ? flow.state : ""
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
        SBH.log.warn("runtime.transaction.contract.cache", SBH.util.errorText(error));
    }
}

function schemaLine(schema, index) {
    if (!schema || !schema.lines) {
        return [];
    }
    return valueList(schema.lines[String(index)]);
}

function hasPingTrue(conditions) {
    var list = valueList(conditions);
    var i;
    for (i = 0; i < list.length; i += 1) {
        if (stringContains(list[i], "equals(string:PING,server.readLine[2])=true") ||
            stringContains(list[i], "equals(server.readLine[2],string:PING)=true")) {
            return true;
        }
    }
    return false;
}

function maxServerReadLineIndex(conditions) {
    var list = valueList(conditions);
    var regex = /server\.readLine\[(\d+)\]/g;
    var maximum = -1;
    var i;
    var match;
    for (i = 0; i < list.length; i += 1) {
        regex.lastIndex = 0;
        while ((match = regex.exec(String(list[i]))) !== null) {
            maximum = Math.max(maximum, Number(match[1]));
        }
    }
    return maximum;
}

function classifySideEffects(cfg) {
    var source = valueList(cfg ? cfg.pingSideEffectEvidence : []);
    var current = [];
    var cross = [];
    var i;
    var effect;
    var maximum;
    for (i = 0; i < source.length; i += 1) {
        effect = source[i] || {};
        maximum = maxServerReadLineIndex(effect.conditions);
        if (maximum >= 3) {
            cross.push(effect);
        } else if (hasPingTrue(effect.conditions)) {
            current.push(effect);
        }
    }
    return { current: current, cross: cross };
}

function findPingStatusEvidence(cfg) {
    var paths = valueList(cfg ? cfg.pingPathEvidence : []);
    var output = [];
    var i;
    var path;
    for (i = 0; i < paths.length; i += 1) {
        path = paths[i] || {};
        if (Number(path.lineIndex) === 0 &&
            containsValue(path.values, "string:PONG") &&
            hasPingTrue(path.conditions) &&
            maxServerReadLineIndex(path.conditions) <= 2) {
            output.push(path);
        }
    }
    return output;
}

function writerKeyFromCall(call) {
    var args = valueList(call ? call.arguments : []);
    return args.length ? String(args[0]) : "";
}

function isWriteCall(call) {
    return stringContains(call ? call.signature : "",
        "Ljava/io/BufferedWriter;->write(Ljava/lang/String;)V");
}

function isNewLineCall(call) {
    return stringContains(call ? call.signature : "",
        "Ljava/io/BufferedWriter;->newLine()V");
}

function isFlushCall(call) {
    return stringContains(call ? call.signature : "",
        "Ljava/io/BufferedWriter;->flush()V");
}

function callValue(call) {
    var args = valueList(call ? call.arguments : []);
    return args.length > 1 ? String(args[1]) : "";
}

function findCorrelationSequence(cfg, flow) {
    var calls = valueList(flow ? flow.serverCallTrace : []);
    var pingPaths = findPingStatusEvidence(cfg);
    var evidence = [];
    var i;
    var j;
    var k;
    var pingPc;
    var statusCall;
    var correlationCall;
    var writerKey;
    var sawNewLine;
    var sawFlush;
    for (i = 0; i < pingPaths.length; i += 1) {
        pingPc = Number(pingPaths[i].pc);
        statusCall = null;
        for (j = 0; j < calls.length; j += 1) {
            if (Number(calls[j].pc) === pingPc && isWriteCall(calls[j])) {
                statusCall = calls[j];
                break;
            }
        }
        if (!statusCall) {
            continue;
        }
        writerKey = writerKeyFromCall(statusCall);
        sawNewLine = false;
        correlationCall = null;
        sawFlush = false;
        for (k = j + 1; k < calls.length && Number(calls[k].pc) <= pingPc + 20; k += 1) {
            if (writerKeyFromCall(calls[k]) !== writerKey) {
                continue;
            }
            if (isNewLineCall(calls[k])) {
                sawNewLine = true;
            } else if (sawNewLine && isWriteCall(calls[k]) &&
                stringContains(callValue(calls[k]), "server.requestLine[1]")) {
                correlationCall = calls[k];
            } else if (correlationCall && isFlushCall(calls[k])) {
                sawFlush = true;
                break;
            }
        }
        if (statusCall && sawNewLine && correlationCall && sawFlush) {
            evidence.push({
                statusWritePc: Number(statusCall.pc),
                statusValue: "PONG",
                correlationWritePc: Number(correlationCall.pc),
                correlationValue: "server.requestLine[1]",
                sameWriter: true,
                newlineSeparated: true,
                flushed: true,
                requestLineIndex: 1,
                responseLineIndex: 1
            });
        }
    }
    return evidence;
}

function resolve(status, force) {
    var cfg = status ? status.runtimeDexCfgContract : null;
    var flow = status ? status.runtimeDexProtocolDataflow : null;
    var key = inputKey(status);
    var result;
    var pingEvidence;
    var correlationEvidence;
    var sideEffects;
    if (!cfg || cfg.checking === true || !flow || flow.checking === true) {
        return blank("checking", null);
    }
    if (!force && cache && cache.stale !== true && cacheKey === key) {
        return cache;
    }
    result = blank("transaction_contract_incomplete", null);
    result.checking = false;
    result.inputKey = key;
    result.sourceCfgState = String(cfg.state || "");
    result.sourceDataflowState = String(flow.state || "");
    try {
        result.requestSchemaConfirmed = !!cfg.requestSchema &&
            Number(cfg.requestSchema.lineCount) === 3 &&
            arrayOnlyContains(schemaLine(cfg.requestSchema, 0), "arg:1") &&
            arrayOnlyContains(schemaLine(cfg.requestSchema, 1), "arg:2") &&
            arrayOnlyContains(schemaLine(cfg.requestSchema, 2), "arg:3");
        result.transactionRequestLineCount = result.requestSchemaConfirmed ? 3 : 0;
        result.tokenValidationConfirmed = cfg.tokenValidationConfirmed === true;
        result.commandCarrierConfirmed = cfg.commandCarrierConfirmed === true;
        pingEvidence = findPingStatusEvidence(cfg);
        result.pingBranchConfirmed = pingEvidence.length > 0;
        result.pingExpectedResponses = result.pingBranchConfirmed ? ["PONG"] : [];
        result.pingResponseStatusResolved = result.pingBranchConfirmed;
        correlationEvidence = findCorrelationSequence(cfg, flow);
        result.correlationEchoEvidence = correlationEvidence;
        result.correlationEchoConfirmed = correlationEvidence.length > 0;
        result.responseSchemaConfirmed = result.pingResponseStatusResolved &&
            result.correlationEchoConfirmed;
        result.transactionResponseLineCount = result.responseSchemaConfirmed ? 2 : 0;
        sideEffects = classifySideEffects(cfg);
        result.currentTransactionSideEffects = sideEffects.current;
        result.ignoredCrossTransactionSideEffects = sideEffects.cross;
        result.pingSideEffectFree = sideEffects.current.length === 0;
        result.loopBackStateIsolated = sideEffects.cross.length > 0 &&
            result.pingSideEffectFree;
        result.pathStateLimitIsolated = !!(cfg.serverCfg &&
            cfg.serverCfg.stateLimitReached === true &&
            result.loopBackStateIsolated && result.responseSchemaConfirmed);
        result.oneRequestOneResponseConfirmed = result.requestSchemaConfirmed &&
            result.responseSchemaConfirmed;
        result.transactionBoundaryConfirmed = result.oneRequestOneResponseConfirmed &&
            result.loopBackStateIsolated;
        if (!result.requestSchemaConfirmed) {
            result.blockers.push("THREE_LINE_REQUEST_NOT_CONFIRMED");
        }
        if (!result.tokenValidationConfirmed) {
            result.blockers.push("TOKEN_VALIDATION_NOT_CONFIRMED");
        }
        if (!result.commandCarrierConfirmed) {
            result.blockers.push("COMMAND_CARRIER_NOT_CONFIRMED");
        }
        if (!result.pingResponseStatusResolved) {
            result.blockers.push("PING_RESPONSE_NOT_RESOLVED");
        }
        if (!result.correlationEchoConfirmed) {
            result.blockers.push("CORRELATION_ECHO_NOT_CONFIRMED");
        }
        if (!result.pingSideEffectFree) {
            result.blockers.push("CURRENT_TRANSACTION_SIDE_EFFECT_FOUND");
        }
        if (!result.transactionBoundaryConfirmed) {
            result.blockers.push("TRANSACTION_BOUNDARY_NOT_CONFIRMED");
        }
        result.readOnlyPingContractReady = result.blockers.length === 0;
        result.adapterImplementationAllowed = result.readOnlyPingContractReady;
        result.readyForExplicitDryRun = false;
        result.state = result.readOnlyPingContractReady ?
            "readonly_ping_contract_ready" : "transaction_contract_incomplete";
        result.stale = false;
        result.checkedAt = SBH.util.now();
        save(result);
        return result;
    } catch (error) {
        result.state = "transaction_contract_failed";
        result.error = SBH.util.errorText(error);
        result.stale = false;
        result.checkedAt = SBH.util.now();
        save(result);
        return result;
    }
}

function attach(status, contract) {
    var plan;
    status = status || {};
    contract = contract || cache || blank("checking", null);
    status.runtimeTransactionContract = contract;
    plan = status.protocolAdapterPlan;
    if (plan) {
        plan.runtimeTransactionContractState = String(contract.state || "checking");
        plan.transactionBoundaryConfirmed = contract.transactionBoundaryConfirmed === true;
        plan.correlationEchoConfirmed = contract.correlationEchoConfirmed === true;
        plan.pingSideEffectFree = contract.pingSideEffectFree === true;
        plan.readOnlyPingContractReady = contract.readOnlyPingContractReady === true;
        plan.commandCarrierResolvedByStaticCfg = contract.commandCarrierConfirmed === true;
        plan.correlationResolvedByStaticCfg = contract.correlationEchoConfirmed === true;
        plan.blockersAfterTransactionBoundary = valueList(contract.blockers);
        plan.adapterImplementationAllowed = contract.readOnlyPingContractReady === true;
        plan.adapterInvocationEnabled = false;
        plan.readyForExplicitDryRun = false;
        plan.writeOperationsLocked = true;
        plan.destructiveOperations = false;
    }
    if (status.writeGate) {
        status.writeGate.runtimeTransactionContract = contract;
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
        return attach(oldStatus(), cache);
    };
    runtime.refresh = function () {
        var status = oldRefresh();
        var contract = resolve(status, false);
        return attach(status, contract);
    };
    runtime.request = function (request) {
        var command = request && request.command ? String(request.command) : "";
        var requestId = request && request.requestId ? String(request.requestId) : "";
        var status;
        var contract;
        var response;
        if (command === "runtime.transaction_contract") {
            status = oldRefresh();
            contract = resolve(status, true);
            status = attach(status, contract);
            return {
                ok: contract.error === null && contract.readOnlyPingContractReady === true,
                requestId: requestId,
                code: "RUNTIME_TRANSACTION_CONTRACT",
                stateBefore: status.coreRunning ? "running" : "stopped",
                stateAfter: status.coreRunning ? "running" : "stopped",
                message: "Runtime 单连接只读 PING 契约静态识别完成",
                data: contract
            };
        }
        response = oldRequest(request);
        try {
            status = runtime.status();
            if (response && response.data && status.runtimeTransactionContract) {
                response.data.runtimeTransactionContract = status.runtimeTransactionContract;
            }
        } catch (ignored) {}
        return response;
    };
    runtime.transactionContract = function () {
        return runtime.request({
            requestId: "sbh-transaction-contract-" + SBH.util.now(),
            command: "runtime.transaction_contract"
        });
    };
    SBH.app.start = function () {
        var output = oldStart();
        var status;
        var contract;
        try {
            status = runtime.status();
            contract = status.runtimeTransactionContract || blank("checking", null);
            output.runtimeTransactionContract = String(contract.state || "checking");
            output.runtimeTransactionContractDetails = contract;
            if (status.protocolAdapterPlan) {
                output.runtimeProtocolAdapterPlan = String(
                    status.protocolAdapterPlan.state || "checking"
                );
                output.runtimeProtocolAdapterPlanDetails = status.protocolAdapterPlan;
            }
        } catch (error) {
            contract = blank("transaction_contract_status_unavailable",
                SBH.util.errorText(error));
            output.runtimeTransactionContract = contract.state;
            output.runtimeTransactionContractDetails = contract;
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
