/* SingBoxHub Stage45 selector default-node preflight. Rhino ES5 only. */
SBH.versions.selectorDefaultPreflight = 1;

(function () {
    "use strict";

    var Runnable = Packages.java.lang.Runnable;
    var service = SBH.candidateConfigPreflight;
    var baseCheck = service.binaryCheckAsync;
    var originalStart = SBH.app.start;
    var SETTING_KEY = "selector_default_node_key";
    var SELECTOR_TAG = "proxy-selector";
    var WATCHDOG_MS = 45000;
    var injectionState = null;
    var inFlight = false;

    function closeQuietly(value) {
        try {
            if (value !== null && value !== undefined) {
                value.close();
            }
        } catch (ignored) {}
    }

    function stableTag(row) {
        return "node-s" + String(row.subscriptionId) + "-" +
            String(row.fingerprint).substring(0, 16);
    }

    function nodeKey(row) {
        return String(row.subscriptionId) + ":" +
            String(row.fingerprint);
    }

    function loadRows() {
        var cursor = null;
        var rows = [];

        try {
            cursor = SBH.database.open().rawQuery(
                "SELECT n.subscription_id,n.fingerprint,n.name," +
                "n.protocol,s.name " +
                "FROM subscription_nodes n " +
                "JOIN subscription_node_credentials c " +
                "ON c.subscription_id=n.subscription_id " +
                "AND c.fingerprint=n.fingerprint " +
                "LEFT JOIN subscriptions s ON s.id=n.subscription_id " +
                "ORDER BY n.subscription_id,n.protocol,n.name",
                []
            );
            while (cursor.moveToNext()) {
                rows.push({
                    subscriptionId: Number(cursor.getLong(0)),
                    fingerprint: String(cursor.getString(1) || ""),
                    name: String(cursor.getString(2) || ""),
                    protocol: String(cursor.getString(3) || ""),
                    subscriptionName:
                        String(cursor.getString(4) || "")
                });
            }
            return rows;
        } finally {
            closeQuietly(cursor);
        }
    }

    function summary(row, selected) {
        return {
            nodeKey: nodeKey(row),
            name: String(row.name || ""),
            protocol: String(row.protocol || ""),
            subscriptionId: Number(row.subscriptionId),
            subscriptionName:
                String(row.subscriptionName || ""),
            tag: stableTag(row),
            selected: selected === true
        };
    }

    function resolveSelected(rows, persistFallback) {
        var saved = String(
            SBH.database.get(SETTING_KEY, "")
        );
        var index;

        for (index = 0; index < rows.length; index += 1) {
            if (nodeKey(rows[index]) === saved) {
                return rows[index];
            }
        }

        if (rows.length <= 0) {
            return null;
        }

        if (persistFallback === true) {
            SBH.database.put(
                SETTING_KEY,
                nodeKey(rows[0])
            );
        }
        return rows[0];
    }

    function listNodes() {
        var rows = loadRows();
        var selected = resolveSelected(rows, true);
        var selectedKey = selected === null ?
            "" : nodeKey(selected);
        var output = [];
        var index;

        for (index = 0; index < rows.length; index += 1) {
            output.push(summary(
                rows[index],
                nodeKey(rows[index]) === selectedKey
            ));
        }
        rows = [];
        return output;
    }

    function getSelectedNode() {
        var rows = loadRows();
        var selected = resolveSelected(rows, true);
        var output = selected === null ?
            null : summary(selected, true);
        rows = [];
        return output;
    }

    function selectDefaultNode(value) {
        var requested = String(value || "");
        var rows = loadRows();
        var index;
        var selected;

        for (index = 0; index < rows.length; index += 1) {
            if (nodeKey(rows[index]) === requested) {
                selected = rows[index];
                if (!SBH.database.put(
                        SETTING_KEY,
                        requested
                    )) {
                    rows = [];
                    throw new Error(
                        "默认节点写入客户端数据库失败"
                    );
                }
                rows = [];
                return summary(selected, true);
            }
        }

        rows = [];
        throw new Error("默认节点不存在或已失效");
    }

    function isCandidateConfig(value, state) {
        var outbounds;
        var index;
        var item;

        if (value === null ||
                value === undefined ||
                typeof value !== "object") {
            return false;
        }

        outbounds = value.outbounds;
        if (outbounds === null ||
                outbounds === undefined ||
                typeof outbounds.length !== "number" ||
                Number(outbounds.length) !==
                    Number(state.nodeCount)) {
            return false;
        }

        for (index = 0; index < outbounds.length; index += 1) {
            item = outbounds[index];
            if (item === null ||
                    item === undefined ||
                    typeof item !== "object" ||
                    String(item.tag || "").indexOf("node-s") !== 0 ||
                    String(item.type || "") === "selector") {
                return false;
            }
        }
        return true;
    }

    function injectSelector(value, state) {
        var outbounds = value.outbounds;
        var tags = [];
        var tagMap = {};
        var copy = {};
        var selector;
        var key;
        var index;
        var tag;

        for (index = 0; index < outbounds.length; index += 1) {
            tag = String(outbounds[index].tag || "");
            if (!tag || tagMap[tag] === true) {
                throw new Error(
                    "候选节点标签为空或重复"
                );
            }
            tagMap[tag] = true;
            tags.push(tag);
        }

        if (tagMap[state.selectedTag] !== true) {
            throw new Error(
                "默认节点不在候选 outbound 中"
            );
        }

        selector = {
            type: "selector",
            tag: SELECTOR_TAG,
            outbounds: tags,
            default: state.selectedTag,
            interrupt_exist_connections: false
        };

        for (key in value) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                copy[key] = value[key];
            }
        }
        copy.outbounds = [selector].concat(outbounds);

        state.injected = true;
        state.candidateTagCount = tags.length;
        state.defaultMatched = true;
        return copy;
    }

    function activateStringify(state) {
        state.originalStringify = JSON.stringify;
        JSON.stringify = function (value, replacer, space) {
            var current = injectionState;
            if (current !== null &&
                    current.runId === state.runId &&
                    isCandidateConfig(value, current)) {
                return current.originalStringify(
                    injectSelector(value, current),
                    replacer,
                    space
                );
            }
            return state.originalStringify(
                value,
                replacer,
                space
            );
        };
    }

    function clearState(runId) {
        var state = injectionState;
        if (state !== null &&
                state.runId === runId) {
            try {
                JSON.stringify =
                    state.originalStringify;
            } catch (ignoredRestore) {}
            injectionState = null;
            inFlight = false;
        }
    }

    function scheduleWatchdog(runId) {
        SBH.handler.postDelayed(
            new JavaAdapter(Runnable, {
                run: function () {
                    clearState(runId);
                }
            }),
            WATCHDOG_MS
        );
    }

    function selectorCheckAsync(callback) {
        var nodes;
        var selected;
        var runId;
        var accepted;

        if (typeof callback !== "function") {
            throw new Error(
                "selector 预检回调不可用"
            );
        }
        if (inFlight) {
            throw new Error(
                "已有 selector 预检正在执行"
            );
        }

        nodes = listNodes();
        selected = getSelectedNode();
        if (selected === null || nodes.length <= 0) {
            nodes = [];
            throw new Error(
                "没有可用于 selector 的节点"
            );
        }

        runId = String(SBH.util.randomToken());
        injectionState = {
            runId: runId,
            nodeCount: nodes.length,
            selectedTag: selected.tag,
            injected: false,
            candidateTagCount: 0,
            defaultMatched: false,
            originalStringify: null
        };
        activateStringify(injectionState);
        inFlight = true;
        scheduleWatchdog(runId);

        try {
            accepted = baseCheck(function (result) {
                var state = injectionState;
                var value = result || {};

                if (state === null ||
                        state.runId !== runId) {
                    value.ok = false;
                    value.errorCode =
                        "SELECTOR_PREFLIGHT_STATE_EXPIRED";
                    value.errorDetailReturned = false;
                } else {
                    value.stage =
                        "selector_stage45_default_node_preflight";
                    value.selectorOutboundIncluded =
                        state.injected === true;
                    value.selectorTag = SELECTOR_TAG;
                    value.selectorDefaultTag =
                        state.selectedTag;
                    value.selectorDefaultMatched =
                        state.defaultMatched === true;
                    value.selectorCandidateTagCount =
                        state.candidateTagCount;
                    value.selectedNode = selected;
                    value.selectorInterruptExistingConnections =
                        false;
                    value.selectorConfigPersisted = false;
                    value.defaultNodePersistedLocally = true;
                    if (state.injected !== true ||
                            state.defaultMatched !== true ||
                            state.candidateTagCount !==
                                nodes.length) {
                        value.ok = false;
                        value.errorCode =
                            "SELECTOR_INJECTION_NOT_OBSERVED";
                        value.errorDetailReturned = false;
                    }
                }

                value.productionConfigModified = false;
                value.runtimeFilesModified = false;
                value.configModified = false;
                value.coreStartInvoked = false;
                value.tunCreated = false;
                value.routeModified = false;
                value.destructiveOperations = false;

                clearState(runId);
                nodes = [];
                callback(value);
            });
            return accepted;
        } catch (error) {
            clearState(runId);
            nodes = [];
            throw error;
        }
    }

    if (!service ||
            typeof baseCheck !== "function") {
        throw new Error(
            "Stage45 binary check dependency unavailable"
        );
    }

    SBH.selectorDefaultPreflight = {
        version: 1,
        listNodes: listNodes,
        getSelectedNode: getSelectedNode,
        selectDefaultNode: selectDefaultNode,
        selectorCheckAsync: selectorCheckAsync,
        selectorTag: SELECTOR_TAG,
        defaultNodeSetting: SETTING_KEY,
        manualOnly: true,
        selectorConfigPersisted: false,
        runtimeWriteEnabled: false
    };

    if (typeof originalStart !== "function") {
        throw new Error(
            "Original app.start unavailable"
        );
    }

    SBH.app.start = function () {
        var output = originalStart();
        var nodes = listNodes();
        var selected = getSelectedNode();

        output.selectorDefaultPreflightVersion = 1;
        output.selectorDefaultPreflightReady = true;
        output.selectorDefaultNodePersisted =
            selected !== null;
        output.selectorDefaultNodeCount =
            nodes.length;
        output.selectorDefaultNode = selected;
        output.selectorOutboundTag = SELECTOR_TAG;
        output.selectorOutboundExpected = true;
        output.selectorInterruptExistingConnections = false;
        output.selectorPreflightManualOnly = true;
        output.selectorPreflightTemporaryConfigOnly = true;
        output.selectorPreflightSerializerInjectionScoped =
            true;
        output.selectorPreflightWatchdogMs =
            WATCHDOG_MS;
        output.selectorPreflightBinaryTransport =
            "shortx_shell_action";
        output.selectorPreflightJavaBinaryPrecheckUsed =
            false;
        output.selectorPreflightPermissionBridgeUsed =
            false;
        output.selectorPreflightJavaProcessBuilderUsed =
            false;
        output.selectorPreflightProductionConfigModified =
            false;
        output.selectorPreflightRuntimeUsable = false;
        output.writeOperationsLocked = true;
        output.destructiveOperations = false;

        nodes = [];
        return output;
    };
}());
