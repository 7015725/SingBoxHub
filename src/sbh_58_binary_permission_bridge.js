/* SingBoxHub Stage44 Retry2 temporary permission bridge. Rhino ES5 only. */
SBH.versions.binaryPermissionBridge = 1;

(function () {
    "use strict";

    var P = Packages;
    var File = P.java.io.File;
    var Runnable = P.java.lang.Runnable;
    var ShellCommand =
        P.tornaco.apps.shortx.core.proto.action.ShellCommand;
    var service = SBH.candidateConfigPreflight;
    var originalCheck = service.binaryCheckAsync;
    var originalStart = SBH.app.start;
    var stateFile = new File(
        SBH.paths.cacheDir,
        ".stage44-permission-bridge.state"
    );
    var startupRecoveryNeeded = stateFile.isFile();
    var startupRecoveryAttempted = false;
    var startupRecoverySucceeded = true;

    function shellQuote(value) {
        return "'" + String(value)
            .replace(/'/g, "'\\''") + "'";
    }

    function readContext(data, key) {
        var value = data.get(String(key));
        return value === null || value === undefined ?
            "" : String(value);
    }

    function marker(value, name) {
        var expression = new RegExp(
            "(?:^|\\n)__SBH_" + name +
            "__=([0-9]+)(?:\\n|$)"
        );
        var match = String(value || "").match(expression);
        return match ? Number(match[1]) : null;
    }

    function executeShell(command, idSuffix) {
        var action = ShellCommand.newBuilder()
            .setCommand(String(command))
            .setSingleShot(true)
            .setId(
                "SingBoxHub#Stage44Retry2#" +
                String(idSuffix) + "#" +
                String(SBH.util.randomToken())
            )
            .build();
        var result = shortx.executeAction(action);
        var data = result.contextData;
        var stdout = readContext(data, "shellOut");
        var stderr = readContext(data, "shellErr");
        return {
            code: Number(data.get("shellCode")),
            output: stdout +
                (stderr ? "\n" + stderr : "")
        };
    }

    function paths() {
        var root = String(shortx.getShortXDir());
        return {
            shortxRoot: root,
            runtimeRoot: root + "/SingBoxHub",
            binaryDir: root + "/SingBoxHub/bin",
            binaryPath: root + "/SingBoxHub/bin/sing-box",
            statePath: stateFile.getAbsolutePath()
        };
    }

    function restoreBridge() {
        var value = paths();
        var command = [
            "STATE=" + shellQuote(value.statePath),
            "ROOT=" + shellQuote(value.shortxRoot),
            "RUNTIME=" + shellQuote(value.runtimeRoot),
            "BINDIR=" + shellQuote(value.binaryDir),
            "BIN=" + shellQuote(value.binaryPath),
            "if [ ! -f \"$STATE\" ]; then " +
                "printf '__SBH_RESTORE_NEEDED__=0\\n'; exit 0; fi",
            "printf '__SBH_RESTORE_NEEDED__=1\\n'",
            "read M1 M2 M3 M4 < \"$STATE\" || exit 121",
            "case \"$M1:$M2:$M3:$M4\" in " +
                "*[!0-7:]*|'') exit 122;; esac",
            "chmod \"$M1\" \"$ROOT\" || exit 123",
            "chmod \"$M2\" \"$RUNTIME\" || exit 123",
            "chmod \"$M3\" \"$BINDIR\" || exit 123",
            "chmod \"$M4\" \"$BIN\" || exit 123",
            "rm -f \"$STATE\" || exit 124",
            "printf '__SBH_RESTORED__=1\\n'"
        ].join("; ");
        var result = executeShell(command, "restore");
        return {
            ok: result.code === 0,
            needed: marker(
                result.output,
                "RESTORE_NEEDED"
            ) === 1,
            restored: marker(
                result.output,
                "RESTORED"
            ) === 1,
            shellCode: result.code
        };
    }

    function prepareBridge() {
        var value = paths();
        var command = [
            "umask 077",
            "STATE=" + shellQuote(value.statePath),
            "ROOT=" + shellQuote(value.shortxRoot),
            "RUNTIME=" + shellQuote(value.runtimeRoot),
            "BINDIR=" + shellQuote(value.binaryDir),
            "BIN=" + shellQuote(value.binaryPath),
            "printf '__SBH_UID__=%s\\n' \"$(id -u 2>/dev/null)\"",
            "[ -f \"$BIN\" ] || exit 127",
            "M1=$(stat -c %a \"$ROOT\") || exit 120",
            "M2=$(stat -c %a \"$RUNTIME\") || exit 120",
            "M3=$(stat -c %a \"$BINDIR\") || exit 120",
            "M4=$(stat -c %a \"$BIN\") || exit 120",
            "printf '%s %s %s %s\\n' " +
                "\"$M1\" \"$M2\" \"$M3\" \"$M4\" > \"$STATE\" " +
                "|| exit 121",
            "chmod 600 \"$STATE\" || exit 121",
            "chmod o+x \"$ROOT\" \"$RUNTIME\" \"$BINDIR\" " +
                "|| exit 122",
            "chmod o+rx \"$BIN\" || exit 122",
            "printf '__SBH_PREPARED__=1\\n'"
        ].join("; ");
        var result = executeShell(command, "prepare");
        return {
            ok:
                result.code === 0 &&
                marker(result.output, "PREPARED") === 1,
            shellUid: marker(result.output, "UID"),
            shellCode: result.code
        };
    }

    function post(callback, result) {
        SBH.handler.post(new JavaAdapter(Runnable, {
            run: function () {
                callback(result);
            }
        }));
    }

    if (startupRecoveryNeeded) {
        startupRecoveryAttempted = true;
        startupRecoverySucceeded = restoreBridge().ok;
    }

    if (!service || typeof originalCheck !== "function") {
        throw new Error(
            "Stage44 Retry2 permission bridge dependencies unavailable"
        );
    }

    service.binaryCheckAsync = function (callback) {
        var prepared;
        var accepted;

        if (typeof callback !== "function") {
            throw new Error(
                "二进制检查回调不可用"
            );
        }

        prepared = prepareBridge();
        if (!prepared.ok) {
            restoreBridge();
            post(callback, {
                ok: false,
                stage:
                    "credential_stage44_retry2_permission_bridge",
                errorCode:
                    "PERMISSION_BRIDGE_PREPARE_FAILED",
                permissionBridgeUsed: true,
                permissionBridgePrepared: false,
                permissionBridgeShellUid:
                    prepared.shellUid,
                permissionBridgeShellCode:
                    prepared.shellCode,
                permissionBridgeRestored: true,
                runtimeContentModified: false,
                runtimeMetadataModifiedTemporarily: false,
                runtimeMetadataCurrentlyModified: false,
                shortxExecuteActionUsed: true,
                javaProcessBuilderUsed: false,
                candidateObjectsReturned: false,
                plaintextCredentialReturned: false,
                plaintextCredentialPersisted: false,
                productionConfigModified: false,
                coreStartInvoked: false,
                tunCreated: false,
                routeModified: false,
                destructiveOperations: false,
                timestamp: Number(SBH.util.now())
            });
            return {
                accepted: false,
                permissionBridgePrepared: false
            };
        }

        try {
            accepted = originalCheck(function (result) {
                var restored = restoreBridge();
                var value = result || {};

                value.stage =
                    "credential_stage44_retry2_permission_bridge";
                value.permissionBridgeUsed = true;
                value.permissionBridgePrepared = true;
                value.permissionBridgeShellUid =
                    prepared.shellUid;
                value.permissionBridgeRestored =
                    restored.ok;
                value.permissionBridgeRestoreNeeded =
                    restored.needed;
                value.permissionBridgeRestoreShellCode =
                    restored.shellCode;
                value.runtimeContentModified = false;
                value.runtimeMetadataModifiedTemporarily = true;
                value.runtimeMetadataCurrentlyModified =
                    !restored.ok;
                value.shortxExecuteActionUsed = true;
                value.javaProcessBuilderUsed = false;

                if (!restored.ok) {
                    value.ok = false;
                    value.errorCode =
                        "PERMISSION_BRIDGE_RESTORE_FAILED";
                    value.errorDetailReturned = false;
                }
                callback(value);
            });
            return accepted;
        } catch (ignoredError) {
            restoreBridge();
            post(callback, {
                ok: false,
                stage:
                    "credential_stage44_retry2_permission_bridge",
                errorCode:
                    "PERMISSION_BRIDGE_WRAPPED_CHECK_FAILED",
                errorDetailReturned: false,
                permissionBridgeUsed: true,
                permissionBridgePrepared: true,
                permissionBridgeRestored: true,
                runtimeContentModified: false,
                runtimeMetadataModifiedTemporarily: true,
                runtimeMetadataCurrentlyModified: false,
                shortxExecuteActionUsed: true,
                javaProcessBuilderUsed: false,
                productionConfigModified: false,
                coreStartInvoked: false,
                tunCreated: false,
                routeModified: false,
                destructiveOperations: false,
                timestamp: Number(SBH.util.now())
            });
            return {
                accepted: false,
                permissionBridgePrepared: true
            };
        }
    };

    if (typeof originalStart !== "function") {
        throw new Error(
            "Original app.start unavailable"
        );
    }

    SBH.app.start = function () {
        var output = originalStart();

        output.binaryPermissionBridgeVersion = 1;
        output.binaryPermissionBridgeReady = true;
        output.binaryPermissionBridgeStartupRecoveryNeeded =
            startupRecoveryNeeded;
        output.binaryPermissionBridgeStartupRecoveryAttempted =
            startupRecoveryAttempted;
        output.binaryPermissionBridgeStartupRecoverySucceeded =
            startupRecoverySucceeded;
        output.binaryPermissionBridgeTemporaryOnly = true;
        output.binaryPermissionBridgeExactModeRestore = true;
        output.binaryPermissionBridgeRuntimeContentModified = false;
        output.candidateBinaryCheckJavaProcessBuilderUsed = false;
        output.writeOperationsLocked = true;
        output.destructiveOperations = false;
        return output;
    };
}());
