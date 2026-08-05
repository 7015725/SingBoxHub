/* SingBoxHub Stage48 candidate Runtime staging write and check. Rhino ES5 only. */
SBH.versions.runtimeCandidateStaging = 1;

(function () {
    "use strict";

    var P = Packages;
    var File = P.java.io.File;
    var FOS = P.java.io.FileOutputStream;
    var JavaString = P.java.lang.String;
    var MessageDigest = P.java.security.MessageDigest;
    var ReflectArray = P.java.lang.reflect.Array;
    var JavaByte = P.java.lang.Byte;
    var Thread = P.java.lang.Thread;
    var Runnable = P.java.lang.Runnable;
    var ShellCommand =
        P.tornaco.apps.shortx.core.proto.action.ShellCommand;

    var selector = SBH.selectorDefaultPreflight;
    var stage47 = SBH.runtimeStagingWriteProbe;
    var originalFactory = SBH.navigation.pages[1];
    var originalStart = SBH.app.start;
    var W = SBH.widgets;
    var C = SBH.theme.colors;
    var busy = false;

    var AUTHORIZATION_ID =
        "stage48-runtime-candidate-staging-user-authorized-20260804";
    var CLIENT_TEMP_DIR =
        "stage48-candidate-source";
    var MAX_CONFIG_BYTES = 4 * 1024 * 1024;
    var CHECK_TIMEOUT_SECONDS = 30;

    function now() {
        return Number(P.java.lang.System.currentTimeMillis());
    }

    function closeQuietly(value) {
        try {
            if (value !== null && value !== undefined) {
                value.close();
            }
        } catch (ignored) {}
    }

    function hex(bytes) {
        var output = [];
        var index;
        var value;
        var part;

        for (index = 0; index < bytes.length; index += 1) {
            value = Number(bytes[index]);
            if (value < 0) {
                value += 256;
            }
            part = value.toString(16);
            output.push(part.length === 1 ? "0" + part : part);
        }
        return output.join("");
    }

    function sha256Text(value) {
        var digest = MessageDigest.getInstance("SHA-256");
        return hex(digest.digest(
            new JavaString(String(value)).getBytes("UTF-8")
        ));
    }

    function quote(value) {
        return "'" + String(value)
            .replace(/'/g, "'\\''") + "'";
    }

    function contextValue(data, key) {
        var value = data.get(String(key));
        return value === null || value === undefined ?
            "" : String(value);
    }

    function marker(raw, name) {
        var match = String(raw || "").match(
            new RegExp(
                "(?:^|\\n)__SBH_" + name +
                "__=([^\\n]*)(?:\\n|$)"
            )
        );
        return match ? String(match[1]) : null;
    }

    function yes(raw, name) {
        return marker(raw, name) === "1";
    }

    function numberValue(raw, name) {
        var value = marker(raw, name);
        var parsed = Number(value);
        return value !== null && isFinite(parsed) ?
            parsed : null;
    }

    function executeShell(command) {
        var action = ShellCommand.newBuilder()
            .setCommand(String(command))
            .setSingleShot(true)
            .setId(
                "SingBoxHub#Stage48#" +
                String(SBH.util.randomToken())
            )
            .build();
        var result = shortx.executeAction(action);
        var data = result.contextData;
        var stdout = contextValue(data, "shellOut");
        var stderr = contextValue(data, "shellErr");

        return {
            code: Number(data.get("shellCode")),
            output: stdout +
                (stderr ? "\n" + stderr : "")
        };
    }

    function runtimeRoot() {
        return String(shortx.getShortXDir()) +
            "/SingBoxHub";
    }

    function isSelectorConfig(value) {
        var outbounds;
        var first;

        if (value === null ||
                value === undefined ||
                typeof value !== "object") {
            return false;
        }

        outbounds = value.outbounds;
        if (outbounds === null ||
                outbounds === undefined ||
                typeof outbounds.length !== "number" ||
                Number(outbounds.length) < 2) {
            return false;
        }

        first = outbounds[0];
        return first !== null &&
            first !== undefined &&
            String(first.type || "") === "selector" &&
            String(first.tag || "") === "proxy-selector" &&
            first.outbounds !== null &&
            first.outbounds !== undefined &&
            typeof first.outbounds.length === "number" &&
            Number(first.outbounds.length) > 0 &&
            String(first.default || "") !== "";
    }

    function captureCandidateAsync(callback) {
        var originalStringify = JSON.stringify;
        var captured = null;
        var restored = false;

        function restore() {
            if (!restored) {
                JSON.stringify = originalStringify;
                restored = true;
            }
        }

        JSON.stringify = function (value, replacer, space) {
            var output = originalStringify(
                value,
                replacer,
                space
            );
            if (captured === null &&
                    isSelectorConfig(value)) {
                captured = output + "\n";
            }
            return output;
        };

        try {
            return selector.selectorCheckAsync(function (result) {
                restore();
                callback(result || {}, captured);
                captured = null;
            });
        } catch (error) {
            restore();
            captured = null;
            throw error;
        }
    }

    function writeUtf8Sync(file, value) {
        var output = null;
        var bytes = new JavaString(
            String(value)
        ).getBytes("UTF-8");

        if (Number(bytes.length) > MAX_CONFIG_BYTES) {
            throw new Error("CANDIDATE_CONFIG_TOO_LARGE");
        }

        try {
            SBH.files.ensureDir(file.getParentFile());
            output = new FOS(file, false);
            output.write(bytes);
            output.flush();
            output.getFD().sync();
        } finally {
            closeQuietly(output);
        }

        try {
            file.setReadable(true, true);
            file.setWritable(true, true);
            file.setExecutable(false, false);
        } catch (ignoredMode) {}

        return Number(bytes.length);
    }

    function wipeDelete(file, byteCount) {
        var output = null;
        var zeros = ReflectArray.newInstance(
            JavaByte.TYPE,
            8192
        );
        var remaining = Number(byteCount || 0);
        var count;
        var overwritten = false;
        var deleted = false;

        try {
            if (file.exists() && remaining > 0) {
                output = new FOS(file, false);
                while (remaining > 0) {
                    count = Math.min(remaining, zeros.length);
                    output.write(zeros, 0, count);
                    remaining -= count;
                }
                output.flush();
                output.getFD().sync();
                overwritten = true;
            }
        } catch (ignoredOverwrite) {
            overwritten = false;
        } finally {
            closeQuietly(output);
        }

        try {
            deleted = !file.exists() || file.delete();
        } catch (ignoredDelete) {
            deleted = false;
        }

        return {
            overwriteSucceeded: overwritten,
            deleted: deleted
        };
    }

    function buildCommand(
        sourcePath,
        expectedHash,
        expectedBytes
    ) {
        var root = runtimeRoot();
        var dir = root + "/config";
        var target = dir + "/runtime-tun.json";
        var backup = dir + "/backups";
        var binary = root + "/bin/sing-box";
        var prefix = String(expectedHash).substring(0, 12);
        var stage = dir +
            "/.runtime-tun.json.stage-" + prefix;
        var temp = stage +
            ".tmp-" +
            String(SBH.util.randomToken())
                .replace(/[^A-Za-z0-9]/g, "")
                .substring(0, 16);

        return [
            "umask 077",
            "D=" + quote(dir),
            "T=" + quote(target),
            "B=" + quote(backup),
            "BIN=" + quote(binary),
            "SRC=" + quote(sourcePath),
            "STAGE=" + quote(stage),
            "TMP=" + quote(temp),
            "EH=" + quote(expectedHash),
            "EB=" + quote(String(expectedBytes)),
            "CREATED=0",
            "REUSED=0",
            "cleanup_tmp(){ rm -f \"$TMP\"; }",
            "trap cleanup_tmp EXIT HUP INT TERM",
            "rm -f \"$TMP\"",
            "printf '__SBH_UID__=%s\\n' \"$(id -u 2>/dev/null)\"",
            "[ -d \"$D\" ] && [ ! -L \"$D\" ] || exit 151",
            "[ -f \"$T\" ] && [ ! -L \"$T\" ] || exit 152",
            "[ -f \"$BIN\" ] && [ -x \"$BIN\" ] || exit 153",
            "[ -f \"$SRC\" ] && [ -r \"$SRC\" ] || exit 154",
            "TB=$(sha256sum \"$T\" 2>/dev/null | awk '{print $1}')",
            "TSB=$(stat -c %s \"$T\" 2>/dev/null || echo -1)",
            "TMB=$(stat -c %a \"$T\" 2>/dev/null || echo -1)",
            "TUB=$(stat -c %u \"$T\" 2>/dev/null || echo -1)",
            "TGB=$(stat -c %g \"$T\" 2>/dev/null || echo -1)",
            "DMB=$(stat -c %a \"$D\" 2>/dev/null || echo -1)",
            "DUB=$(stat -c %u \"$D\" 2>/dev/null || echo -1)",
            "DGB=$(stat -c %g \"$D\" 2>/dev/null || echo -1)",
            "DVB=$(stat -c %d \"$D\" 2>/dev/null || echo -1)",
            "[ -d \"$B\" ] && BEB=1 || BEB=0",
            "[ -L \"$B\" ] && BLB=1 || BLB=0",
            "SH=$(sha256sum \"$SRC\" 2>/dev/null | awk '{print $1}')",
            "SB=$(stat -c %s \"$SRC\" 2>/dev/null || echo -1)",
            "[ \"$SH\" = \"$EH\" ] && [ \"$SB\" = \"$EB\" ] || exit 155",
            "if [ -e \"$STAGE\" ]; then " +
                "[ -f \"$STAGE\" ] && [ ! -L \"$STAGE\" ] || exit 156; " +
                "XH=$(sha256sum \"$STAGE\" 2>/dev/null | awk '{print $1}'); " +
                "XB=$(stat -c %s \"$STAGE\" 2>/dev/null || echo -1); " +
                "[ \"$XH\" = \"$EH\" ] && [ \"$XB\" = \"$EB\" ] || exit 157; " +
                "REUSED=1; " +
            "else " +
                "cat \"$SRC\" > \"$TMP\" || exit 158; " +
                "chmod 600 \"$TMP\" || exit 159; " +
                "chown 0:0 \"$TMP\" >/dev/null 2>&1 || true; " +
                "TH=$(sha256sum \"$TMP\" 2>/dev/null | awk '{print $1}'); " +
                "TBX=$(stat -c %s \"$TMP\" 2>/dev/null || echo -1); " +
                "[ \"$TH\" = \"$EH\" ] && [ \"$TBX\" = \"$EB\" ] || exit 160; " +
                "if sync -f \"$TMP\" >/dev/null 2>&1; then SM=1; " +
                "elif sync \"$TMP\" >/dev/null 2>&1; then SM=2; " +
                "else sync; SM=3; fi; " +
                "if command -v timeout >/dev/null 2>&1; then " +
                    "timeout " + String(CHECK_TIMEOUT_SECONDS) +
                    "s \"$BIN\" check -c \"$TMP\" >/dev/null 2>&1; PC=$?; " +
                "else \"$BIN\" check -c \"$TMP\" >/dev/null 2>&1; PC=$?; fi; " +
                "printf '__SBH_PRECHECK__=%s\\n' \"$PC\"; " +
                "[ \"$PC\" = 0 ] || exit 161; " +
                "mv \"$TMP\" \"$STAGE\" || exit 162; " +
                "CREATED=1; " +
            "fi",
            "chmod 600 \"$STAGE\" || exit 163",
            "chown 0:0 \"$STAGE\" >/dev/null 2>&1 || true",
            "if command -v timeout >/dev/null 2>&1; then " +
                "timeout " + String(CHECK_TIMEOUT_SECONDS) +
                "s \"$BIN\" check -c \"$STAGE\" >/dev/null 2>&1; FC=$?; " +
            "else \"$BIN\" check -c \"$STAGE\" >/dev/null 2>&1; FC=$?; fi",
            "printf '__SBH_FINAL_CHECK__=%s\\n' \"$FC\"",
            "if [ \"$FC\" != 0 ]; then " +
                "SZ=$(stat -c %s \"$STAGE\" 2>/dev/null || echo 0); " +
                "if [ \"$SZ\" -gt 0 ]; then dd if=/dev/zero of=\"$STAGE\" bs=4096 count=$(( (SZ + 4095) / 4096 )) conv=notrunc >/dev/null 2>&1 || true; fi; " +
                "rm -f \"$STAGE\"; exit 164; fi",
            "FH=$(sha256sum \"$STAGE\" 2>/dev/null | awk '{print $1}')",
            "FB=$(stat -c %s \"$STAGE\" 2>/dev/null || echo -1)",
            "FM=$(stat -c %a \"$STAGE\" 2>/dev/null || echo -1)",
            "FU=$(stat -c %u \"$STAGE\" 2>/dev/null || echo -1)",
            "FG=$(stat -c %g \"$STAGE\" 2>/dev/null || echo -1)",
            "FV=$(stat -c %d \"$STAGE\" 2>/dev/null || echo -1)",
            "FI=$(stat -c %i \"$STAGE\" 2>/dev/null || echo -1)",
            "[ \"$FH\" = \"$EH\" ] && [ \"$FB\" = \"$EB\" ] || exit 165",
            "TA=$(sha256sum \"$T\" 2>/dev/null | awk '{print $1}')",
            "TSA=$(stat -c %s \"$T\" 2>/dev/null || echo -1)",
            "TMA=$(stat -c %a \"$T\" 2>/dev/null || echo -1)",
            "TUA=$(stat -c %u \"$T\" 2>/dev/null || echo -1)",
            "TGA=$(stat -c %g \"$T\" 2>/dev/null || echo -1)",
            "DMA=$(stat -c %a \"$D\" 2>/dev/null || echo -1)",
            "DUA=$(stat -c %u \"$D\" 2>/dev/null || echo -1)",
            "DGA=$(stat -c %g \"$D\" 2>/dev/null || echo -1)",
            "DVA=$(stat -c %d \"$D\" 2>/dev/null || echo -1)",
            "[ -d \"$B\" ] && BEA=1 || BEA=0",
            "[ -L \"$B\" ] && BLA=1 || BLA=0",
            "printf '__SBH_CREATED__=%s\\n' \"$CREATED\"",
            "printf '__SBH_REUSED__=%s\\n' \"$REUSED\"",
            "printf '__SBH_SH__=%s\\n' \"$SH\"",
            "printf '__SBH_SB__=%s\\n' \"$SB\"",
            "printf '__SBH_FH__=%s\\n' \"$FH\"",
            "printf '__SBH_FB__=%s\\n' \"$FB\"",
            "printf '__SBH_FM__=%s\\n' \"$FM\"",
            "printf '__SBH_FU__=%s\\n' \"$FU\"",
            "printf '__SBH_FG__=%s\\n' \"$FG\"",
            "printf '__SBH_FV__=%s\\n' \"$FV\"",
            "printf '__SBH_FI__=%s\\n' \"$FI\"",
            "printf '__SBH_TB__=%s\\n' \"$TB\"",
            "printf '__SBH_TA__=%s\\n' \"$TA\"",
            "printf '__SBH_TSB__=%s\\n' \"$TSB\"",
            "printf '__SBH_TSA__=%s\\n' \"$TSA\"",
            "printf '__SBH_TMB__=%s\\n' \"$TMB\"",
            "printf '__SBH_TMA__=%s\\n' \"$TMA\"",
            "printf '__SBH_TUB__=%s\\n' \"$TUB\"",
            "printf '__SBH_TUA__=%s\\n' \"$TUA\"",
            "printf '__SBH_TGB__=%s\\n' \"$TGB\"",
            "printf '__SBH_TGA__=%s\\n' \"$TGA\"",
            "printf '__SBH_DMB__=%s\\n' \"$DMB\"",
            "printf '__SBH_DMA__=%s\\n' \"$DMA\"",
            "printf '__SBH_DUB__=%s\\n' \"$DUB\"",
            "printf '__SBH_DUA__=%s\\n' \"$DUA\"",
            "printf '__SBH_DGB__=%s\\n' \"$DGB\"",
            "printf '__SBH_DGA__=%s\\n' \"$DGA\"",
            "printf '__SBH_DVB__=%s\\n' \"$DVB\"",
            "printf '__SBH_DVA__=%s\\n' \"$DVA\"",
            "printf '__SBH_BEB__=%s\\n' \"$BEB\"",
            "printf '__SBH_BEA__=%s\\n' \"$BEA\"",
            "printf '__SBH_BLB__=%s\\n' \"$BLB\"",
            "printf '__SBH_BLA__=%s\\n' \"$BLA\"",
            "printf '__SBH_SYNC_MODE__=%s\\n' \"${SM:-0}\"",
            "printf '__SBH_DONE__=1\\n'",
            "trap - EXIT HUP INT TERM",
            "exit 0"
        ].join("; ");
    }

    function stageCandidate(
        stage47Result,
        selectorResult,
        configText
    ) {
        var tempDir = new File(
            SBH.paths.cacheDir,
            CLIENT_TEMP_DIR
        );
        var sourceFile = new File(
            tempDir,
            "candidate-" +
            String(SBH.util.randomToken()) +
            ".json"
        );
        var configHash = sha256Text(configText);
        var byteCount = 0;
        var shellResult = null;
        var cleanup = null;
        var raw;
        var done;
        var targetUnchanged;
        var directoryIdentityUnchanged;
        var backupUnchanged;
        var stagingVerified;
        var finalCheck;
        var ok;

        try {
            byteCount = writeUtf8Sync(
                sourceFile,
                configText
            );
            shellResult = executeShell(
                buildCommand(
                    sourceFile.getAbsolutePath(),
                    configHash,
                    byteCount
                )
            );
        } finally {
            cleanup = wipeDelete(
                sourceFile,
                byteCount
            );
            try {
                if (tempDir.isDirectory()) {
                    tempDir.delete();
                }
            } catch (ignoredDir) {}
            configText = null;
        }

        raw = shellResult === null ?
            "" : shellResult.output;
        done = yes(raw, "DONE");
        targetUnchanged =
            marker(raw, "TB") === marker(raw, "TA") &&
            marker(raw, "TSB") === marker(raw, "TSA") &&
            marker(raw, "TMB") === marker(raw, "TMA") &&
            marker(raw, "TUB") === marker(raw, "TUA") &&
            marker(raw, "TGB") === marker(raw, "TGA");
        directoryIdentityUnchanged =
            marker(raw, "DMB") === marker(raw, "DMA") &&
            marker(raw, "DUB") === marker(raw, "DUA") &&
            marker(raw, "DGB") === marker(raw, "DGA") &&
            marker(raw, "DVB") === marker(raw, "DVA");
        backupUnchanged =
            marker(raw, "BEB") === marker(raw, "BEA") &&
            marker(raw, "BLB") === marker(raw, "BLA");
        stagingVerified =
            marker(raw, "SH") === configHash &&
            marker(raw, "FH") === configHash &&
            numberValue(raw, "SB") === byteCount &&
            numberValue(raw, "FB") === byteCount &&
            marker(raw, "FM") === "600" &&
            numberValue(raw, "FU") === 0 &&
            numberValue(raw, "FG") === 0;
        finalCheck = numberValue(raw, "FINAL_CHECK");
        ok =
            stage47Result.ok === true &&
            stage47Result.readyForExplicitCandidateStagingWrite === true &&
            selectorResult.ok === true &&
            selectorResult.singBoxCheckPassed === true &&
            selectorResult.selectorDefaultMatched === true &&
            done &&
            numberValue(raw, "UID") === 0 &&
            stagingVerified &&
            finalCheck === 0 &&
            targetUnchanged &&
            directoryIdentityUnchanged &&
            backupUnchanged &&
            cleanup !== null &&
            cleanup.deleted === true;

        return {
            ok: ok,
            stage:
                "production_stage48_candidate_runtime_staging",
            authorizationId: AUTHORIZATION_ID,
            authorizationConsumed: true,
            automaticRetryAllowed: false,
            manualOnly: true,
            stage47ProbePassed:
                stage47Result.ok === true,
            stage47AtomicRenameVerified:
                stage47Result.atomicRenameVerified === true,
            selectorPreflightPassed:
                selectorResult.ok === true &&
                selectorResult.singBoxCheckPassed === true,
            selectedNode:
                selectorResult.selectedNode || null,
            selectorTag:
                String(
                    selectorResult.selectorTag ||
                    "proxy-selector"
                ),
            selectorCandidateTagCount:
                Number(
                    selectorResult.selectorCandidateTagCount || 0
                ),
            candidateConfigSha256:
                configHash,
            candidateConfigByteCount:
                byteCount,
            candidateConfigCapturedInMemory: true,
            candidateConfigPlaintextReturned: false,
            candidateConfigContainsOperationalCredentials: true,
            candidateConfigClientTemporarySourceWritten:
                byteCount > 0,
            candidateConfigClientTemporarySourceOverwritten:
                cleanup !== null &&
                cleanup.overwriteSucceeded,
            candidateConfigClientTemporarySourceDeleted:
                cleanup !== null &&
                cleanup.deleted,
            candidateConfigWrittenToRuntime:
                yes(raw, "CREATED") ||
                yes(raw, "REUSED"),
            candidateConfigStagingCreated:
                yes(raw, "CREATED"),
            candidateConfigStagingReused:
                yes(raw, "REUSED"),
            candidateConfigStagingRetained:
                ok,
            candidateConfigStagingRelativePath:
                "config/.runtime-tun.json.stage-" +
                configHash.substring(0, 12),
            candidateConfigStagingPathReturned: false,
            candidateConfigStagingHashVerified:
                marker(raw, "FH") === configHash,
            candidateConfigStagingSizeVerified:
                numberValue(raw, "FB") === byteCount,
            candidateConfigStagingMode:
                marker(raw, "FM"),
            candidateConfigStagingUid:
                numberValue(raw, "FU"),
            candidateConfigStagingGid:
                numberValue(raw, "FG"),
            candidateConfigStagingDevice:
                marker(raw, "FV"),
            candidateConfigStagingInodeReturned: false,
            candidateConfigStagingSyncMode:
                numberValue(raw, "SYNC_MODE"),
            singBoxPreRenameCheckExitCode:
                numberValue(raw, "PRECHECK"),
            singBoxFinalStagingCheckExitCode:
                finalCheck,
            singBoxFinalStagingCheckPassed:
                finalCheck === 0,
            shellUid:
                numberValue(raw, "UID"),
            shellCode:
                shellResult === null ?
                    null : shellResult.code,
            shellCompletionMarkerObserved:
                done,
            shellCodeAuthoritative: false,
            shellTransportCodeAnomalous:
                done &&
                shellResult !== null &&
                shellResult.code !== 0,
            targetConfigHashUnchanged:
                marker(raw, "TB") === marker(raw, "TA"),
            targetConfigMetadataUnchanged:
                targetUnchanged,
            runtimeDirectoryModeOwnershipDeviceUnchanged:
                directoryIdentityUnchanged,
            backupDirectoryStateUnchanged:
                backupUnchanged,
            runtimeDirectoryTimestampMayHaveChanged: true,
            runtimeFilesModified: ok,
            runtimeFilesModifiedByAuthorizedStagingOnly: ok,
            runtimeMetadataModified: ok,
            productionConfigModified: false,
            productionConfigReplaced: false,
            backupCreated: false,
            backupDirectoryCreated: false,
            coreStartInvoked: false,
            coreStopInvoked: false,
            tunCreated: false,
            routeModified: false,
            networkAccessed: false,
            destructiveOperations: false,
            readyForExplicitBackupAndAtomicPromotion:
                ok,
            nextAuthorizedOperation:
                ok ?
                    "runtime_backup_and_atomic_promotion" :
                    "resolve_candidate_staging_gate",
            timestamp: now()
        };
    }

    function stageAsync(callback) {
        if (typeof callback !== "function") {
            throw new Error(
                "Stage48 callback unavailable"
            );
        }
        if (busy) {
            callback({
                ok: false,
                stage:
                    "production_stage48_candidate_runtime_staging",
                errorCode: "STAGE48_ALREADY_RUNNING",
                timestamp: now()
            });
            return {
                accepted: false,
                busy: true
            };
        }

        busy = true;
        return stage47.probeAsync(function (stage47Result) {
            if (!stage47Result ||
                    stage47Result.ok !== true ||
                    stage47Result.readyForExplicitCandidateStagingWrite !==
                        true) {
                busy = false;
                callback({
                    ok: false,
                    stage:
                        "production_stage48_candidate_runtime_staging",
                    errorCode:
                        "STAGE47_WRITE_PROBE_GATE_FAILED",
                    authorizationId:
                        AUTHORIZATION_ID,
                    authorizationConsumed: false,
                    productionConfigModified: false,
                    candidateConfigWrittenToRuntime: false,
                    destructiveOperations: false,
                    timestamp: now()
                });
                return;
            }

            try {
                captureCandidateAsync(function (
                    selectorResult,
                    configText
                ) {
                    if (!selectorResult ||
                            selectorResult.ok !== true ||
                            selectorResult.singBoxCheckPassed !== true ||
                            selectorResult.selectorDefaultMatched !== true ||
                            configText === null) {
                        busy = false;
                        callback({
                            ok: false,
                            stage:
                                "production_stage48_candidate_runtime_staging",
                            errorCode:
                                "CANDIDATE_CAPTURE_GATE_FAILED",
                            authorizationId:
                                AUTHORIZATION_ID,
                            authorizationConsumed: false,
                            candidateConfigPlaintextReturned: false,
                            productionConfigModified: false,
                            candidateConfigWrittenToRuntime: false,
                            destructiveOperations: false,
                            timestamp: now()
                        });
                        return;
                    }

                    new Thread(
                        new JavaAdapter(Runnable, {
                            run: function () {
                                var output;
                                try {
                                    output = stageCandidate(
                                        stage47Result,
                                        selectorResult,
                                        configText
                                    );
                                } catch (ignored) {
                                    output = {
                                        ok: false,
                                        stage:
                                            "production_stage48_candidate_runtime_staging",
                                        errorCode:
                                            "CANDIDATE_RUNTIME_STAGING_FAILED",
                                        errorDetailReturned: false,
                                        authorizationId:
                                            AUTHORIZATION_ID,
                                        authorizationConsumed: true,
                                        candidateConfigPlaintextReturned: false,
                                        productionConfigModified: false,
                                        productionConfigReplaced: false,
                                        backupCreated: false,
                                        coreStartInvoked: false,
                                        tunCreated: false,
                                        routeModified: false,
                                        destructiveOperations: false,
                                        timestamp: now()
                                    };
                                }
                                configText = null;
                                busy = false;
                                SBH.handler.post(
                                    new JavaAdapter(Runnable, {
                                        run: function () {
                                            callback(output);
                                        }
                                    })
                                );
                            }
                        }),
                        "SingBoxHub-Stage48CandidateStaging"
                    ).start();
                });
            } catch (error) {
                busy = false;
                callback({
                    ok: false,
                    stage:
                        "production_stage48_candidate_runtime_staging",
                    errorCode:
                        "CANDIDATE_CAPTURE_START_FAILED",
                    errorDetailReturned: false,
                    authorizationId:
                        AUTHORIZATION_ID,
                    authorizationConsumed: false,
                    productionConfigModified: false,
                    candidateConfigWrittenToRuntime: false,
                    destructiveOperations: false,
                    timestamp: now()
                });
            }
        });
    }

    function buildCard() {
        var card = W.card(17);
        var title = W.text(
            "候选配置 Runtime staging",
            17,
            C.navy,
            true
        );
        var note = W.text(
            "重新执行 Stage 47 门禁，生成实际 selector 候选配置，" +
            "写入 Runtime/config 的 0600 staging 文件并再次执行 " +
            "sing-box check。通过后保留 staging，但不替换生产配置。",
            11.4,
            C.secondary,
            false
        );
        var resultText = W.text(
            JSON.stringify({
                ready: true,
                authorizationId:
                    AUTHORIZATION_ID,
                candidateRuntimeStagingEnabled: true,
                productionConfigReplacementEnabled: false,
                backupEnabled: false
            }, null, 2),
            10.3,
            C.secondary,
            false
        );
        var button = W.button(
            "写入并检查候选 staging",
            "shield",
            C.orange,
            C.orangeSoft,
            function () {
                resultText.setText(
                    "正在执行 Stage 47 门禁、生成候选配置并写入 staging。"
                );
                SBH.util.toast(
                    "正在写入候选配置 staging"
                );
                stageAsync(function (result) {
                    resultText.setText(
                        JSON.stringify(result, null, 2)
                    );
                    SBH.util.toast(
                        result.ok === true ?
                            "候选配置 staging 检查通过" :
                            "候选配置 staging 存在待处理项"
                    );
                });
            }
        );

        card.setPadding(
            SBH.util.dp(14),
            SBH.util.dp(14),
            SBH.util.dp(14),
            SBH.util.dp(14)
        );
        card.addView(title);
        note.setPadding(
            0,
            SBH.util.dp(7),
            0,
            SBH.util.dp(8)
        );
        card.addView(note);
        resultText.setTextIsSelectable(true);
        card.addView(resultText);
        card.addView(
            button,
            W.margins(
                W.lp(W.MATCH, SBH.util.dp(44)),
                0,
                12,
                0,
                0
            )
        );
        return card;
    }

    if (!selector ||
            typeof selector.selectorCheckAsync !== "function" ||
            !stage47 ||
            typeof stage47.probeAsync !== "function" ||
            typeof originalFactory !== "function") {
        throw new Error(
            "Stage48 dependencies unavailable"
        );
    }

    SBH.runtimeCandidateStaging = {
        version: 1,
        stageAsync: stageAsync,
        authorizationId:
            AUTHORIZATION_ID,
        manualOnly: true,
        automaticRetryAllowed: false,
        productionConfigReplacementEnabled: false,
        backupEnabled: false
    };

    SBH.navigation.register(1, function (controller) {
        var view = originalFactory(controller);
        var content = view.getChildAt(0);
        content.addView(
            buildCard(),
            W.margins(
                W.lp(W.MATCH, W.WRAP),
                0,
                16,
                0,
                12
            )
        );
        return view;
    });

    SBH.app.start = function () {
        var output = originalStart();

        output.runtimeCandidateStagingVersion = 1;
        output.runtimeCandidateStagingReady = true;
        output.runtimeCandidateStagingAuthorizationId =
            AUTHORIZATION_ID;
        output.runtimeCandidateStagingAuthorized = true;
        output.runtimeCandidateStagingManualOnly = true;
        output.runtimeCandidateStagingAutomaticRetry = false;
        output.runtimeCandidateStagingContainsOperationalCredentials =
            true;
        output.runtimeCandidateStagingMode = "600";
        output.runtimeCandidateStagingOwnerUid = 0;
        output.runtimeCandidateStagingProductionConfigReplacementEnabled =
            false;
        output.runtimeCandidateStagingBackupEnabled = false;
        output.runtimeCandidateStagingCoreStartEnabled = false;
        output.runtimeCandidateStagingTunEnabled = false;
        output.runtimeCandidateStagingRouteWriteEnabled = false;
        output.productionConfigModified = false;
        output.writeOperationsLocked = true;
        output.destructiveOperations = false;
        return output;
    };
}());
