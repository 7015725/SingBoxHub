/* SingBoxHub asynchronous read-only Runtime Client. Rhino ES5 only. */
SBH.versions.runtimeClient = 5;

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

    function executeShell(command, id) {
        var action = ShellCommand.newBuilder()
            .setCommand(String(command))
            .setSingleShot(true)
            .setId(String(id || "JS#SingBoxHubRuntimeReadonly"))
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

    function buildRuntimeCommand(root) {
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
            "printf 'corePid\\t%s\\n' \"$PID_VALUE\""
        ];
        return "/system/bin/toybox timeout 8 /system/bin/sh -c " +
            shellQuote(lines.join("\n"));
    }

    function buildEndpointCommand(root) {
        var endpointPath =
            String(root.getAbsolutePath()) +
            "/runtime/control/control_endpoint.json";
        var lines = [
            "TOYBOX=/system/bin/toybox",
            "EP=" + shellQuote(endpointPath),
            "if [ -f \"$EP\" ]; then",
            "  printf 'exists\\t1\\n'",
            "  printf 'uid\\t%s\\n' \"$($TOYBOX stat -c '%u' \"$EP\" 2>/dev/null)\"",
            "  printf 'gid\\t%s\\n' \"$($TOYBOX stat -c '%g' \"$EP\" 2>/dev/null)\"",
            "  printf 'mode\\t%s\\n' \"$($TOYBOX stat -c '%a' \"$EP\" 2>/dev/null)\"",
            "  printf 'size\\t%s\\n' \"$($TOYBOX stat -c '%s' \"$EP\" 2>/dev/null)\"",
            "  printf 'mtime\\t%s\\n' \"$($TOYBOX stat -c '%Y' \"$EP\" 2>/dev/null)\"",
            "  printf 'real\\t%s\\n' \"$($TOYBOX readlink -f \"$EP\" 2>/dev/null)\"",
            "  SHA_VALUE=",
            "  if [ -x /system/bin/sha256sum ]; then",
            "    SHA_VALUE=\"$(/system/bin/sha256sum \"$EP\" 2>/dev/null | $TOYBOX awk '{print $1}')\"",
            "  else",
            "    SHA_VALUE=\"$($TOYBOX sha256sum \"$EP\" 2>/dev/null | $TOYBOX awk '{print $1}')\"",
            "  fi",
            "  printf 'sha\\t%s\\n' \"$SHA_VALUE\"",
            "  SIZE_VALUE=\"$($TOYBOX stat -c '%s' \"$EP\" 2>/dev/null)\"",
            "  if [ -n \"$SIZE_VALUE\" ] && [ \"$SIZE_VALUE\" -gt 0 ] && [ \"$SIZE_VALUE\" -le " + MAX_ENDPOINT_BYTES + " ]; then",
            "    DATA_VALUE=\"$($TOYBOX base64 \"$EP\" 2>/dev/null | $TOYBOX tr -d '\\r\\n')\"",
            "    printf 'data\\t%s\\n' \"$DATA_VALUE\"",
            "  fi",
            "else",
            "  printf 'exists\\t0\\n'",
            "fi",
            "printf 'now\\t%s\\n' \"$($TOYBOX date +%s 2>/dev/null)\""
        ];
        return "/system/bin/toybox timeout 5 /system/bin/sh -c " +
            shellQuote(lines.join("\n"));
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

    function updateEndpointProbe(map, shellResult, error) {
        cachedEndpointProbe = {
            exists: String(map.exists || "0") === "1",
            uid: String(map.uid || ""),
            gid: String(map.gid || ""),
            mode: String(map.mode || ""),
            size: String(map.size || ""),
            mtime: String(map.mtime || ""),
            real: String(map.real || ""),
            sha: String(map.sha || ""),
            data: String(map.data || ""),
            now: String(map.now || ""),
            transport: "separate_shell_readonly",
            shellExitCode: shellResult ?
                Number(shellResult.code) : -1,
            shellError: shellResult ?
                String(shellResult.err || "") : "",
            error: error ?
                SBH.util.errorText(error) : null,
            capturedAt: SBH.util.now()
        };
    }

    function inspectEndpointBlocking(root, coarseExists) {
        var result;
        var map;
        try {
            result = executeShell(
                buildEndpointCommand(root),
                "JS#SingBoxHubEndpointDetail"
            );
            map = parseMap(result.out);
            updateEndpointProbe(map, result, null);
        } catch (error) {
            updateEndpointProbe(
                {exists: coarseExists ? "1" : "0"},
                null,
                error
            );
        }
        return cachedEndpointProbe;
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
        var coarseEndpoint;

        try {
            root = getRuntimeRoot();
            shell = executeShell(
                buildRuntimeCommand(root),
                "JS#SingBoxHubRuntimeStatus"
            );
            map = parseMap(shell.out);
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
            coarseEndpoint =
                boolValue(map, "controlEndpoint");

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
                    controlEndpoint: coarseEndpoint
                },
                shellExitCode: shell.code,
                shellError: shell.err,
                endpointProbeTransport:
                    "separate_shell_readonly",
                destructiveOperations: false,
                timestamp: current
            };
            cachedStatus.handshake =
                buildHandshake(cachedStatus);

            inspectEndpointBlocking(root, coarseEndpoint);
            cachedStatus.endpointProbeAvailable =
                cachedEndpointProbe !== null;
            cachedStatus.endpointProbeError =
                cachedEndpointProbe ?
                    cachedEndpointProbe.error : null;
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
            cachedStatus.handshake =
                buildHandshake(cachedStatus);
        }

        cachedAt = current;
        return cachedStatus;
    }

    function statusSnapshot() {
        var value = cachedStatus || pendingStatus();
        value.refreshInFlight = refreshInFlight;
        value.cacheAgeMs = cachedAt > 0 ?
            Math.max(0, SBH.util.now() - cachedAt) :
            null;
        return value;
    }

    function finishRefresh(value, error, elapsed) {
        var callbacks = refreshCallbacks;
        var i;
        refreshCallbacks = [];
        refreshInFlight = false;
        if (value) {
            value.refreshInFlight = false;
            value.refreshDurationMs =
                Number(elapsed || 0);
        }
        for (i = 0; i < callbacks.length; i += 1) {
            try {
                callbacks[i](
                    value || statusSnapshot(),
                    error,
                    elapsed
                );
            } catch (callbackError) {
                SBH.log.error(
                    "runtime.callback",
                    callbackError
                );
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
        return status.coreRunning ?
            "running" : "stopped";
    }

    function requestBlocking(requestValue) {
        var command =
            requestValue && requestValue.command ?
                String(requestValue.command) : "";
        var requestId =
            requestValue && requestValue.requestId ?
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
            message:
                "当前阶段仅开放握手与状态查询，写操作未开放",
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
                requestId:
                    "sbh-handshake-" + SBH.util.now(),
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
