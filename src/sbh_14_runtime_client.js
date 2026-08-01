/* SingBoxHub asynchronous read-only Runtime Client. Rhino ES5 only. */
SBH.versions.runtimeClient = 4;

(function () {
    var P = Packages;
    var File = P.java.io.File;
    var ShellCommand =
        P.tornaco.apps.shortx.core.proto.action.ShellCommand;
    var MAX_ENDPOINT_BYTES = 65536;
    var cachedAt = 0;
    var cachedStatus = null;
    var cachedEndpointProbe = null;
    var refreshInFlight = false;
    var refreshCallbacks = [];

    function shellQuote(value) {
        return "'" + String(value).replace(/'/g, "'\\''") + "'";
    }

    function contextValue(data, key) {
        var value = data.get(String(key));
        return value === null || value === undefined ?
            "" : String(value);
    }

    function executeShell(command) {
        var action = ShellCommand.newBuilder()
            .setCommand(String(command))
            .setSingleShot(true)
            .setId("JS#SingBoxHubRuntimeReadonlyStatus")
            .build();
        var result = shortx.executeAction(action);
        var data;

        if (result === null || result === undefined) {
            throw new Error("shortx.executeAction() returned null");
        }
        data = result.contextData;
        if (data === null || data === undefined) {
            throw new Error("Shell result.contextData unavailable");
        }
        return {
            out: contextValue(data, "shellOut"),
            err: contextValue(data, "shellErr"),
            code: Number(data.get("shellCode"))
        };
    }

    function getRuntimeRoot() {
        if (typeof shortx === "undefined" || shortx === null ||
                typeof shortx.getShortXDir !== "function") {
            throw new Error("shortx.getShortXDir() unavailable");
        }
        return new File(
            String(shortx.getShortXDir()),
            "SingBoxHub"
        );
    }

    function buildCommand(root) {
        var rootPath = String(root.getAbsolutePath());
        var lines = [
            "TOYBOX=/system/bin/toybox",
            "ROOT=" + shellQuote(rootPath),
            "CORE=\"$ROOT/bin/sing-box\"",
            "EP=\"$ROOT/runtime/control/control_endpoint.json\"",
            "test_value() { if [ \"$1\" = x0 ]; then printf '1'; else printf '0'; fi; }",
            "printf 'uid\\t%s\\n' \"$($TOYBOX id -u 2>/dev/null)\"",
            "[ -d \"$ROOT\" ]; printf 'runtimeRoot\\t%s\\n' \"$(test_value x$?)\"",
            "[ -x \"$ROOT/bin/singboxhub-runtime\" ]; printf 'controller\\t%s\\n' \"$(test_value x$?)\"",
            "[ -x \"$CORE\" ]; printf 'coreBinary\\t%s\\n' \"$(test_value x$?)\"",
            "[ -x \"$ROOT/bin/singboxhub-package-policy\" ]; printf 'packagePolicy\\t%s\\n' \"$(test_value x$?)\"",
            "[ -x \"$ROOT/bin/singboxhub-policyctl\" ]; printf 'policyCtl\\t%s\\n' \"$(test_value x$?)\"",
            "[ -x \"$ROOT/bin/singboxhub-policy-manager\" ]; printf 'policyManager\\t%s\\n' \"$(test_value x$?)\"",
            "[ -x \"$ROOT/bin/singboxhub-management-api\" ]; printf 'managementApi\\t%s\\n' \"$(test_value x$?)\"",
            "[ -f \"$ROOT/metadata/runtime.meta.json\" ]; printf 'runtimeMeta\\t%s\\n' \"$(test_value x$?)\"",
            "[ -f \"$ROOT/metadata/package-policy.active.json\" ]; printf 'activePolicy\\t%s\\n' \"$(test_value x$?)\"",
            "[ -f \"$ROOT/manager/policy-manager-state.json\" ]; printf 'managerState\\t%s\\n' \"$(test_value x$?)\"",
            "[ -f \"$EP\" ]; printf 'controlEndpoint\\t%s\\n' \"$(test_value x$?)\"",
            "PID_VALUE=",
            "for PROC in /proc/[0-9]*; do",
            "  [ -L \"$PROC/exe\" ] || continue",
            "  EXE=\"$($TOYBOX readlink \"$PROC/exe\" 2>/dev/null)\"",
            "  if [ \"$EXE\" = \"$CORE\" ]; then PID_VALUE=\"${PROC##*/}\"; break; fi",
            "done",
            "printf 'corePid\\t%s\\n' \"$PID_VALUE\"",
            "if [ -f \"$EP\" ]; then",
            "  printf 'epExists\\t1\\n'",
            "  printf 'epUid\\t%s\\n' \"$($TOYBOX stat -c '%u' \"$EP\" 2>/dev/null)\"",
            "  printf 'epGid\\t%s\\n' \"$($TOYBOX stat -c '%g' \"$EP\" 2>/dev/null)\"",
            "  printf 'epMode\\t%s\\n' \"$($TOYBOX stat -c '%a' \"$EP\" 2>/dev/null)\"",
            "  printf 'epSize\\t%s\\n' \"$($TOYBOX stat -c '%s' \"$EP\" 2>/dev/null)\"",
            "  printf 'epMtime\\t%s\\n' \"$($TOYBOX stat -c '%Y' \"$EP\" 2>/dev/null)\"",
            "  printf 'epReal\\t%s\\n' \"$($TOYBOX readlink -f \"$EP\" 2>/dev/null)\"",
            "  if [ -x /system/bin/sha256sum ]; then",
            "    EP_SHA=\"$(/system/bin/sha256sum \"$EP\" 2>/dev/null | $TOYBOX awk '{print $1}')\"",
            "  else",
            "    EP_SHA=\"$($TOYBOX sha256sum \"$EP\" 2>/dev/null | $TOYBOX awk '{print $1}')\"",
            "  fi",
            "  printf 'epSha\\t%s\\n' \"$EP_SHA\"",
            "  EP_SIZE=\"$($TOYBOX stat -c '%s' \"$EP\" 2>/dev/null)\"",
            "  if [ -n \"$EP_SIZE\" ] && [ \"$EP_SIZE\" -gt 0 ] && [ \"$EP_SIZE\" -le " + MAX_ENDPOINT_BYTES + " ]; then",
            "    EP_DATA=\"$($TOYBOX base64 \"$EP\" 2>/dev/null | $TOYBOX tr -d '\\r\\n')\"",
            "    printf 'epData\\t%s\\n' \"$EP_DATA\"",
            "  fi",
            "else",
            "  printf 'epExists\\t0\\n'",
            "fi",
            "printf 'epNow\\t%s\\n' \"$($TOYBOX date +%s 2>/dev/null)\""
        ];
        return "/system/bin/toybox timeout 8 /system/bin/sh -c " +
            shellQuote(lines.join("\n"));
    }

    function boolValue(map, key) {
        return String(map[key] || "0") === "1";
    }

    function stateName(discovered, coreRunning, rootGranted) {
        if (coreRunning) {
            return "running";
        }
        if (discovered) {
            return "stopped";
        }
        if (rootGranted) {
            return "incomplete";
        }
        return "unavailable";
    }

    function buildHandshake(status) {
        return {
            schemaVersion: 1,
            ok: status.attached === true,
            attached: status.attached === true,
            transport: status.transport,
            readOnly: true,
            runtimeState: status.runtimeState,
            endpointReady: status.components &&
                status.components.controlEndpoint === true,
            capabilities: [
                "runtime.handshake",
                "runtime.status",
                "core.status",
                "route.status"
            ],
            destructiveOperations: false,
            checkedAt: status.timestamp
        };
    }

    function pendingStatus() {
        var root = null;
        try {
            root = getRuntimeRoot();
        } catch (ignored) {}
        return {
            ok: false,
            attached: false,
            checking: true,
            refreshInFlight: refreshInFlight,
            transportAvailable: false,
            transport: "shortx_shell_readonly",
            readOnly: true,
            rootGranted: false,
            runtimeRoot: root === null ?
                "" : String(root.getAbsolutePath()),
            runtimeState: "checking",
            discovered: false,
            coreRunning: false,
            corePid: null,
            components: {},
            destructiveOperations: false,
            timestamp: SBH.util.now()
        };
    }

    function parseMap(text) {
        var map = {};
        var lines = String(text || "").split(/\r?\n/);
        var i;
        var fields;
        for (i = 0; i < lines.length; i += 1) {
            fields = lines[i].split("\t");
            if (fields.length >= 2) {
                map[String(fields[0])] =
                    String(fields.slice(1).join("\t"));
            }
        }
        return map;
    }

    function updateEndpointProbe(map) {
        cachedEndpointProbe = {
            exists: String(map.epExists || "0") === "1",
            uid: String(map.epUid || ""),
            gid: String(map.epGid || ""),
            mode: String(map.epMode || ""),
            size: String(map.epSize || ""),
            mtime: String(map.epMtime || ""),
            real: String(map.epReal || ""),
            sha: String(map.epSha || ""),
            data: String(map.epData || ""),
            now: String(map.epNow || ""),
            capturedAt: SBH.util.now()
        };
    }

    function inspectBlocking() {
        var current = SBH.util.now();
        var root;
        var shell;
        var map;
        var pid;
        var discovered;
        var transportAvailable;
        var runtimeState;

        try {
            root = getRuntimeRoot();
            shell = executeShell(buildCommand(root));
            map = parseMap(shell.out);
            updateEndpointProbe(map);
            pid = /^\d+$/.test(String(map.corePid || "")) ?
                Number(map.corePid) : null;
            transportAvailable =
                shell.code === 0 && Number(map.uid) === 0;
            discovered = boolValue(map, "runtimeRoot") &&
                boolValue(map, "controller") &&
                boolValue(map, "coreBinary");
            runtimeState = stateName(
                discovered,
                pid !== null,
                transportAvailable
            );

            cachedStatus = {
                ok: transportAvailable,
                attached: transportAvailable && discovered,
                checking: false,
                refreshInFlight: refreshInFlight,
                transportAvailable: transportAvailable,
                transport: "shortx_shell_readonly",
                readOnly: true,
                shellUid: Number(map.uid),
                rootGranted: Number(map.uid) === 0,
                runtimeRoot: String(root.getAbsolutePath()),
                runtimeState: runtimeState,
                discovered: discovered,
                coreRunning: pid !== null,
                corePid: pid,
                components: {
                    controller: boolValue(map, "controller"),
                    coreBinary: boolValue(map, "coreBinary"),
                    packagePolicy: boolValue(map, "packagePolicy"),
                    policyCtl: boolValue(map, "policyCtl"),
                    policyManager: boolValue(map, "policyManager"),
                    managementApi: boolValue(map, "managementApi"),
                    runtimeMeta: boolValue(map, "runtimeMeta"),
                    activePolicy: boolValue(map, "activePolicy"),
                    managerState: boolValue(map, "managerState"),
                    controlEndpoint: boolValue(map, "controlEndpoint")
                },
                shellExitCode: shell.code,
                shellError: shell.err,
                destructiveOperations: false,
                timestamp: current
            };
            cachedStatus.handshake = buildHandshake(cachedStatus);
        } catch (error) {
            cachedEndpointProbe = null;
            cachedStatus = {
                ok: false,
                attached: false,
                checking: false,
                refreshInFlight: refreshInFlight,
                transportAvailable: false,
                transport: "shortx_shell_readonly",
                readOnly: true,
                rootGranted: false,
                runtimeState: "unavailable",
                discovered: false,
                coreRunning: false,
                corePid: null,
                components: {},
                error: SBH.util.errorText(error),
                destructiveOperations: false,
                timestamp: current
            };
            cachedStatus.handshake = buildHandshake(cachedStatus);
        }
        cachedAt = current;
        return cachedStatus;
    }

    function statusSnapshot() {
        var value = cachedStatus || pendingStatus();
        value.refreshInFlight = refreshInFlight;
        value.cacheAgeMs = cachedAt > 0 ?
            Math.max(0, SBH.util.now() - cachedAt) : null;
        return value;
    }

    function finishRefresh(value, error, elapsed) {
        var callbacks = refreshCallbacks;
        var i;
        refreshCallbacks = [];
        refreshInFlight = false;
        if (value) {
            value.refreshInFlight = false;
            value.refreshDurationMs = Number(elapsed || 0);
        }
        for (i = 0; i < callbacks.length; i += 1) {
            try {
                callbacks[i](value || statusSnapshot(), error, elapsed);
            } catch (callbackError) {
                SBH.log.error("runtime.callback", callbackError);
            }
        }
    }

    function refreshAsync(callback) {
        if (typeof callback === "function") {
            refreshCallbacks.push(callback);
        }
        if (refreshInFlight) {
            return false;
        }
        refreshInFlight = true;
        SBH.util.runBg(
            function () {
                return inspectBlocking();
            },
            finishRefresh,
            "SingBoxHub-runtime-refresh"
        );
        return true;
    }

    function resultState(status) {
        return status.coreRunning ? "running" : "stopped";
    }

    function requestBlocking(requestValue) {
        var command = requestValue && requestValue.command ?
            String(requestValue.command) : "";
        var requestId = requestValue && requestValue.requestId ?
            String(requestValue.requestId) : "";
        var before = inspectBlocking();

        if (command === "runtime.handshake") {
            return {
                ok: before.attached,
                requestId: requestId,
                code: before.attached ?
                    "READ_ONLY_HANDSHAKE_OK" :
                    "RUNTIME_NOT_ATTACHED",
                stateBefore: resultState(before),
                stateAfter: resultState(before),
                message: before.attached ?
                    "Runtime 只读握手成功" :
                    "Runtime 未完成只读接入",
                data: before.handshake
            };
        }

        if (command === "runtime.status" ||
                command === "core.status" ||
                command === "route.status") {
            return {
                ok: before.ok,
                requestId: requestId,
                code: before.ok ?
                    "READ_ONLY_STATUS" :
                    "RUNTIME_STATUS_UNAVAILABLE",
                stateBefore: resultState(before),
                stateAfter: resultState(before),
                message: before.ok ?
                    "只读 Runtime 状态已刷新" :
                    "无法读取 Runtime 状态",
                data: before
            };
        }

        return {
            ok: false,
            requestId: requestId,
            code: "READ_ONLY_CLIENT",
            stateBefore: resultState(before),
            stateAfter: resultState(before),
            message: "当前阶段仅开放握手与状态查询，写操作未开放",
            data: before
        };
    }

    function requestAsync(requestValue, callback) {
        SBH.util.runBg(
            function () {
                return requestBlocking(requestValue);
            },
            callback,
            "SingBoxHub-runtime-request"
        );
        return true;
    }

    SBH.runtime = {
        attached: false,
        transport: "shortx_shell_readonly",
        readOnly: true,

        request: requestBlocking,

        requestAsync: requestAsync,

        status: statusSnapshot,

        refresh: inspectBlocking,

        refreshAsync: refreshAsync,

        handshake: function () {
            return requestBlocking({
                requestId: "sbh-handshake-" + SBH.util.now(),
                command: "runtime.handshake"
            });
        },

        isAttached: function () {
            return statusSnapshot().attached === true;
        },

        isRefreshing: function () {
            return refreshInFlight;
        },

        endpointProbe: function () {
            return cachedEndpointProbe;
        }
    };
}());
