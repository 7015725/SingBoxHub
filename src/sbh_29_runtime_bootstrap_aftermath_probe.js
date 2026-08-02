/* Stage29: read-only aftermath probe for Stage28 control-service bootstrap. Rhino ES5. */
SBH.versions.runtimeBootstrapAftermathProbe = 1;

(function () {
    var P = Packages;
    var File = P.java.io.File;
    var ShellCommand =
        P.tornaco.apps.shortx.core.proto.action.ShellCommand;

    var CACHE_FILE = new File(
        SBH.paths.cacheDir,
        "runtime_bootstrap_aftermath_probe.json"
    );
    var cached = SBH.files.readJson(CACHE_FILE, null);

    function now() {
        return Number(SBH.util.now());
    }

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
            .setId("JS#SBHStage29Aftermath")
            .build();
        var result = shortx.executeAction(action);
        var data;

        if (result === null || result === undefined) {
            throw new Error("SHORTX_SHELL_RESULT_NULL");
        }
        data = result.contextData;
        if (data === null || data === undefined) {
            throw new Error("SHORTX_SHELL_CONTEXT_UNAVAILABLE");
        }
        return {
            out: contextValue(data, "shellOut"),
            err: contextValue(data, "shellErr"),
            code: Number(data.get("shellCode"))
        };
    }

    function parseMap(text) {
        var result = {};
        var lines = String(text || "").split(/\r?\n/);
        var i;
        var fields;
        for (i = 0; i < lines.length; i += 1) {
            fields = lines[i].split("\t");
            if (fields.length >= 2) {
                result[String(fields[0])] =
                    String(fields.slice(1).join("\t"));
            }
        }
        return result;
    }

    function boolValue(map, key) {
        return String(map[key] || "0") === "1";
    }

    function numberValue(map, key) {
        var value = String(map[key] || "");
        return /^\d+$/.test(value) ? Number(value) : null;
    }

    function runtimeRoot() {
        if (typeof shortx === "undefined" || shortx === null ||
                typeof shortx.getShortXDir !== "function") {
            throw new Error("SHORTX_DIR_UNAVAILABLE");
        }
        return String(
            new File(
                String(shortx.getShortXDir()),
                "SingBoxHub"
            ).getCanonicalPath()
        );
    }

    function buildCommand(previousCheckedAt) {
        var root = runtimeRoot();
        var lines = [
            "T=/system/bin/toybox",
            "R=" + shellQuote(root),
            "D=\"$R/runtime/control\"",
            "E=\"$D/control_endpoint.json\"",
            "L=\"$R/logs/runtime-production.log\"",
            "S='com.singboxhub.runtime.CoreRuntimeMain'",
            "C=\"$R/config/runtime-tun.json\"",
            "W=\"$R/runtime/core/work\"",
            "printf 'uid\\t%s\\n' \"$($T id -u 2>/dev/null)\"",
            "EE=0; [ -f \"$E\" ] && EE=1",
            "printf 'endpointExists\\t%s\\n' \"$EE\"",
            "EP=; EC=; EU=; EG=; EM=; EZ=; ET=; ER=",
            "if [ \"$EE\" = 1 ]; then",
            "  EP=\"$($T sed -n 's/.*\"runtimePid\":\\([0-9][0-9]*\\).*/\\1/p' \"$E\" 2>/dev/null)\"",
            "  EC=\"$($T sed -n 's/.*\"createdAt\":\\([0-9][0-9]*\\).*/\\1/p' \"$E\" 2>/dev/null)\"",
            "  EU=\"$($T stat -c '%u' \"$E\" 2>/dev/null)\"",
            "  EG=\"$($T stat -c '%g' \"$E\" 2>/dev/null)\"",
            "  EM=\"$($T stat -c '%a' \"$E\" 2>/dev/null)\"",
            "  EZ=\"$($T stat -c '%s' \"$E\" 2>/dev/null)\"",
            "  ET=\"$($T stat -c '%Y' \"$E\" 2>/dev/null)\"",
            "  ER=\"$($T readlink -f \"$E\" 2>/dev/null)\"",
            "fi",
            "printf 'endpointPid\\t%s\\nendpointCreatedAt\\t%s\\nendpointUid\\t%s\\nendpointGid\\t%s\\nendpointMode\\t%s\\nendpointSize\\t%s\\nendpointMtime\\t%s\\nendpointReal\\t%s\\n' \"$EP\" \"$EC\" \"$EU\" \"$EG\" \"$EM\" \"$EZ\" \"$ET\" \"$ER\"",
            "CP=; CU=; CG=; CM=0",
            "for Q in /proc/[0-9]*; do",
            "  [ -r \"$Q/cmdline\" ] || continue",
            "  V=\"$($T tr '\\000' ' ' <\"$Q/cmdline\" 2>/dev/null)\"",
            "  case \"$V\" in *\"$S \"*\"$C \"*\"$W \"*) CP=\"${Q##*/}\"; CM=1; break;; esac",
            "done",
            "if [ -n \"$CP\" ] && [ -r \"/proc/$CP/status\" ]; then",
            "  while read K A B C1 D1 E1; do",
            "    case \"$K\" in Uid:) CU=\"$B\";; Gid:) CG=\"$B\";; esac",
            "  done <\"/proc/$CP/status\"",
            "fi",
            "printf 'controlPid\\t%s\\ncontrolUidEffective\\t%s\\ncontrolGidEffective\\t%s\\ncontrolCmdMatched\\t%s\\n' \"$CP\" \"$CU\" \"$CG\" \"$CM\"",
            "EA=0; ECM=0",
            "case \"$EP\" in ''|*[!0-9]*) ;; *) [ -d \"/proc/$EP\" ] && EA=1;; esac",
            "if [ \"$EA\" = 1 ] && [ -r \"/proc/$EP/cmdline\" ]; then",
            "  EV=\"$($T tr '\\000' ' ' <\"/proc/$EP/cmdline\" 2>/dev/null)\"",
            "  case \"$EV\" in *\"$S \"*\"$C \"*\"$W \"*) ECM=1;; esac",
            "fi",
            "printf 'endpointPidAlive\\t%s\\nendpointCmdMatched\\t%s\\n' \"$EA\" \"$ECM\"",
            "PC=\"$($T find \"$D\" -maxdepth 1 -type f -name 'runtime.*.pid' 2>/dev/null | $T wc -l | $T tr -d ' ')\"",
            "RC=\"$($T find \"$D\" -maxdepth 1 -type f -name 'runtime.*.ready' 2>/dev/null | $T wc -l | $T tr -d ' ')\"",
            "TC=\"$($T find \"$D\" -maxdepth 1 -type f -name '.control_endpoint.*.tmp' 2>/dev/null | $T wc -l | $T tr -d ' ')\"",
            "printf 'tempPidCount\\t%s\\ntempReadyCount\\t%s\\ntempEndpointCount\\t%s\\n' \"$PC\" \"$RC\" \"$TC\"",
            "LE=0; LM=; LZ=; LF=0; LN=0; LP=0; LV=0; LS=0",
            "if [ -f \"$L\" ]; then",
            "  LE=1; LM=\"$($T stat -c '%Y' \"$L\" 2>/dev/null)\"; LZ=\"$($T stat -c '%s' \"$L\" 2>/dev/null)\"",
            "  TL=\"$($T tail -n 96 \"$L\" 2>/dev/null)\"",
            "  case \"$TL\" in *ClassNotFoundException*|*'Could not find or load main class'*) LF=1;; esac",
            "  case \"$TL\" in *NoClassDefFoundError*) LN=1;; esac",
            "  case \"$TL\" in *'Permission denied'*) LP=1;; esac",
            "  case \"$TL\" in *VerifyError*|*verification*) LV=1;; esac",
            "  case \"$TL\" in *SecurityException*|*SELinux*) LS=1;; esac",
            "fi",
            "printf 'logExists\\t%s\\nlogMtime\\t%s\\nlogSize\\t%s\\nlogClassLoadFailure\\t%s\\nlogNoClassDef\\t%s\\nlogPermissionDenied\\t%s\\nlogVerifyFailure\\t%s\\nlogSecurityFailure\\t%s\\n' \"$LE\" \"$LM\" \"$LZ\" \"$LF\" \"$LN\" \"$LP\" \"$LV\" \"$LS\"",
            "PAST=" + shellQuote(String(Number(previousCheckedAt || 0))),
            "LG=0; case \"$LM\" in ''|*[!0-9]*) ;; *) [ $((LM*1000)) -ge $((PAST-20000)) ] && LG=1;; esac",
            "printf 'logChangedNearAttempt\\t%s\\n' \"$LG\""
        ];
        return "/system/bin/toybox timeout 6 /system/bin/sh -c " +
            shellQuote(lines.join("\n"));
    }

    function classify(result) {
        if (result.controlServiceProcessFound &&
                result.endpointPidMatchesControlService &&
                result.endpointCommandValidated) {
            return "CONTROL_SERVICE_STARTED_STAGE28_REPORT_TIMED_OUT";
        }
        if (result.controlServiceProcessFound &&
                !result.endpointPidMatchesControlService) {
            return "CONTROL_SERVICE_STARTED_ENDPOINT_NOT_PUBLISHED";
        }
        if (!result.controlServiceProcessFound &&
                (result.tempPidFileCount > 0 ||
                result.tempReadyFileCount > 0 ||
                result.tempEndpointFileCount > 0)) {
            return "LAUNCH_ARTIFACTS_REMAIN_PROCESS_NOT_ALIVE";
        }
        if (result.logSignals.classLoadFailure) {
            return "CONTROL_SERVICE_CLASS_LOAD_FAILED";
        }
        if (result.logSignals.noClassDefFound) {
            return "CONTROL_SERVICE_DEPENDENCY_LOAD_FAILED";
        }
        if (result.logSignals.permissionDenied) {
            return "CONTROL_SERVICE_PERMISSION_DENIED";
        }
        if (result.logSignals.verifyFailure) {
            return "CONTROL_SERVICE_DEX_VERIFY_FAILED";
        }
        if (result.logSignals.securityFailure) {
            return "CONTROL_SERVICE_SECURITY_FAILURE";
        }
        if (result.logSignals.changedNearAttempt) {
            return "CONTROL_SERVICE_EXITED_BEFORE_READY_OR_REPORT";
        }
        return "STAGE28_LAUNCH_TRANSACTION_TIMED_OUT_WITHOUT_TERMINAL_RESULT";
    }

    function probe(previous) {
        var startedAt = now();
        var shell = executeShell(
            buildCommand(previous && previous.checkedAt)
        );
        var map = parseMap(shell.out);
        var controlPid = numberValue(map, "controlPid");
        var endpointPid = numberValue(map, "endpointPid");
        var result = {
            schemaVersion: 1,
            state: "runtime_bootstrap_aftermath_probe_ready",
            readOnly: true,
            sourceStage28State: previous ?
                String(previous.state || "") : "",
            sourceStage28CheckedAt: previous ?
                Number(previous.checkedAt || 0) : 0,
            sourceStage28AuthorizationConsumed: previous ?
                previous.authorizationConsumed === true : false,
            sourceStage28StartupResult: previous ?
                String(previous.startupResult || "") : "",
            sourceStage28ShellExitCode: previous ?
                Number(previous.startupShellExitCode) : null,
            sourceStage28ShellErrorPresent: previous ?
                previous.startupShellErrorPresent === true : false,
            shellUid: numberValue(map, "uid"),
            rootGranted: String(map.uid || "") === "0",
            probeShellExitCode: shell.code,
            probeShellErrorPresent: String(shell.err || "").length > 0,
            endpointExists: boolValue(map, "endpointExists"),
            endpointPid: endpointPid,
            endpointCreatedAt: numberValue(map, "endpointCreatedAt"),
            endpointUid: numberValue(map, "endpointUid"),
            endpointGid: numberValue(map, "endpointGid"),
            endpointMode: String(map.endpointMode || ""),
            endpointSize: numberValue(map, "endpointSize"),
            endpointMtimeEpochSeconds:
                numberValue(map, "endpointMtime"),
            endpointCanonical:
                String(map.endpointReal || "") ===
                runtimeRoot() +
                "/runtime/control/control_endpoint.json",
            endpointPidAlive: boolValue(map, "endpointPidAlive"),
            endpointCommandValidated:
                boolValue(map, "endpointCmdMatched"),
            controlServiceProcessFound: controlPid !== null,
            controlServicePid: controlPid,
            controlServiceUidEffective:
                numberValue(map, "controlUidEffective"),
            controlServiceGidEffective:
                numberValue(map, "controlGidEffective"),
            controlServiceCommandValidated:
                boolValue(map, "controlCmdMatched"),
            endpointPidMatchesControlService:
                endpointPid !== null &&
                controlPid !== null &&
                endpointPid === controlPid,
            tempPidFileCount:
                numberValue(map, "tempPidCount") || 0,
            tempReadyFileCount:
                numberValue(map, "tempReadyCount") || 0,
            tempEndpointFileCount:
                numberValue(map, "tempEndpointCount") || 0,
            logExists: boolValue(map, "logExists"),
            logMtimeEpochSeconds:
                numberValue(map, "logMtime"),
            logSize: numberValue(map, "logSize"),
            logSignals: {
                classLoadFailure:
                    boolValue(map, "logClassLoadFailure"),
                noClassDefFound:
                    boolValue(map, "logNoClassDef"),
                permissionDenied:
                    boolValue(map, "logPermissionDenied"),
                verifyFailure:
                    boolValue(map, "logVerifyFailure"),
                securityFailure:
                    boolValue(map, "logSecurityFailure"),
                changedNearAttempt:
                    boolValue(map, "logChangedNearAttempt")
            },
            endpointTokenRead: false,
            endpointTokenExposed: false,
            socketNameRead: false,
            socketConnectionAttempted: false,
            requestSent: false,
            processStarted: false,
            processStopped: false,
            filesModified: false,
            runtimeControllerInvoked: false,
            singBoxCoreStarted: false,
            tunCreated: false,
            routeModified: false,
            configModified: false,
            destructiveOperations: false,
            recommendedRetryDesign: [
                "split_preflight_launch_readiness_into_short_shell_transactions",
                "remove_nested_background_wait_dependency",
                "return_spawned_pid_before_readiness_polling",
                "probe_ready_and_endpoint_with_separate_readonly_shell",
                "preserve_one_authorization_one_ping"
            ],
            error: shell.code === 0 ? null :
                "AFTERMATH_SHELL_EXIT_" + shell.code,
            checkedAt: now(),
            durationMs: now() - startedAt
        };
        result.likelyFailurePoint = classify(result);
        return result;
    }

    function save(result) {
        cached = result;
        try {
            SBH.files.writeJson(CACHE_FILE, result);
        } catch (ignored) {}
    }

    function obtain(previous) {
        var result;
        if (cached && cached.schemaVersion === 1 &&
                cached.sourceStage28CheckedAt ===
                Number(previous && previous.checkedAt || 0)) {
            cached.reusedCachedResult = true;
            return cached;
        }
        try {
            result = probe(previous);
        } catch (error) {
            result = {
                schemaVersion: 1,
                state: "runtime_bootstrap_aftermath_probe_failed",
                readOnly: true,
                sourceStage28CheckedAt:
                    Number(previous && previous.checkedAt || 0),
                endpointTokenRead: false,
                endpointTokenExposed: false,
                socketNameRead: false,
                socketConnectionAttempted: false,
                requestSent: false,
                processStarted: false,
                processStopped: false,
                filesModified: false,
                runtimeControllerInvoked: false,
                singBoxCoreStarted: false,
                tunCreated: false,
                routeModified: false,
                configModified: false,
                destructiveOperations: false,
                error: String(SBH.util.errorText(error)),
                checkedAt: now()
            };
        }
        save(result);
        return result;
    }

    var oldStart = SBH.app.start;
    SBH.app.start = function () {
        var output = oldStart();
        var gate = output.runtimeWriteGateDetails || {};
        var previous =
            gate.runtimeControlServiceBootstrapPing ||
            output.runtimeControlServiceBootstrapPingDetails ||
            null;
        var result = obtain(previous);

        output.runtimeBootstrapAftermathProbe = result.state;
        output.runtimeBootstrapAftermathProbeDetails = result;

        if (gate) {
            gate.runtimeBootstrapAftermathProbe = result;
            output.runtimeWriteGateDetails = gate;
        }
        return output;
    };
}());