/* SingBoxHub Runtime Client adapter. Rhino ES5 only. */
SBH.versions.runtimeClient = 3;

(function () {
    var P = Packages;
    var File = P.java.io.File;
    var ShellCommand = P.tornaco.apps.shortx.core.proto.action.ShellCommand;

    var CACHE_MS = 1500;
    var cachedAt = 0;
    var cachedStatus = null;

    function shellQuote(value) {
        return "'" + String(value).replace(/'/g, "'\\''") + "'";
    }

    function contextValue(data, key) {
        var value = data.get(String(key));
        return value === null || value === undefined ? "" : String(value);
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
        return new File(String(shortx.getShortXDir()), "SingBoxHub");
    }

    function buildCommand(root) {
        var rootPath = String(root.getAbsolutePath());
        var lines = [
            "TOYBOX=/system/bin/toybox",
            "ROOT=" + shellQuote(rootPath),
            "CORE=\"$ROOT/bin/sing-box\"",
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
            "[ -f \"$ROOT/runtime/control/control_endpoint.json\" ]; printf 'controlEndpoint\\t%s\\n' \"$(test_value x$?)\"",
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

    function inspect(force) {
        var current = SBH.util.now();
        var root;
        var shell;
        var lines;
        var map = {};
        var i;
        var fields;
        var pid;
        var discovered;
        var transportAvailable;
        var runtimeState;

        if (!force && cachedStatus !== null && current - cachedAt < CACHE_MS) {
            return cachedStatus;
        }

        try {
            root = getRuntimeRoot();
            shell = executeShell(buildCommand(root));
            lines = String(shell.out || "").split(/\r?\n/);
            for (i = 0; i < lines.length; i += 1) {
                fields = lines[i].split("\t");
                if (fields.length >= 2) {
                    map[String(fields[0])] = String(fields.slice(1).join("\t"));
                }
            }
            pid = /^\d+$/.test(String(map.corePid || "")) ?
                Number(map.corePid) : null;
            transportAvailable = shell.code === 0 && Number(map.uid) === 0;
            discovered = boolValue(map, "runtimeRoot") &&
                boolValue(map, "controller") &&
                boolValue(map, "coreBinary");
            runtimeState = stateName(discovered, pid !== null, transportAvailable);

            cachedStatus = {
                ok: transportAvailable,
                attached: transportAvailable && discovered,
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
            cachedStatus = {
                ok: false,
                attached: false,
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

    function resultState(status) {
        return status.coreRunning ? "running" : "stopped";
    }

    function request(requestValue) {
        var command = requestValue && requestValue.command ?
            String(requestValue.command) : "";
        var requestId = requestValue && requestValue.requestId ?
            String(requestValue.requestId) : "";
        var before = inspect(true);

        if (command === "runtime.handshake") {
            return {
                ok: before.attached,
                requestId: requestId,
                code: before.attached ?
                    "READ_ONLY_HANDSHAKE_OK" : "RUNTIME_NOT_ATTACHED",
                stateBefore: resultState(before),
                stateAfter: resultState(before),
                message: before.attached ?
                    "Runtime 只读握手成功" : "Runtime 未完成只读接入",
                data: before.handshake
            };
        }

        if (command === "runtime.status" || command === "core.status" ||
                command === "route.status") {
            return {
                ok: before.ok,
                requestId: requestId,
                code: before.ok ? "READ_ONLY_STATUS" : "RUNTIME_STATUS_UNAVAILABLE",
                stateBefore: resultState(before),
                stateAfter: resultState(before),
                message: before.ok ? "只读 Runtime 状态已刷新" : "无法读取 Runtime 状态",
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

    SBH.runtime = {
        attached: false,
        transport: "shortx_shell_readonly",
        readOnly: true,
        request: request,
        status: function () {
            return inspect(false);
        },
        refresh: function () {
            return inspect(true);
        },
        handshake: function () {
            return request({
                requestId: "sbh-handshake-" + SBH.util.now(),
                command: "runtime.handshake"
            });
        },
        isAttached: function () {
            return inspect(false).attached === true;
        }
    };
}());
