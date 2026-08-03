/* SingBoxHub Stage46 read-only production promotion audit. Rhino ES5 only. */
SBH.versions.productionPromotionAudit = 1;

(function () {
    "use strict";

    var P = Packages;
    var Thread = P.java.lang.Thread;
    var Runnable = P.java.lang.Runnable;
    var ShellCommand =
        P.tornaco.apps.shortx.core.proto.action.ShellCommand;

    var selectorService = SBH.selectorDefaultPreflight;
    var originalStart = SBH.app.start;

    var TARGET_RELATIVE_PATH = "config/runtime-tun.json";
    var BACKUP_DIR_RELATIVE_PATH = "config/backups";
    var PLAN_VERSION = 1;
    var MIN_FREE_KB = 1024;

    function now() {
        return Number(P.java.lang.System.currentTimeMillis());
    }

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
            "__=([^\\n]*)(?:\\n|$)"
        );
        var match = String(value || "").match(expression);
        return match ? String(match[1]) : null;
    }

    function markerBoolean(value, name) {
        return marker(value, name) === "1";
    }

    function markerNumber(value, name) {
        var raw = marker(value, name);
        var parsed = Number(raw);
        return raw !== null && isFinite(parsed) ?
            parsed : null;
    }

    function stripMarkers(value) {
        return String(value || "")
            .replace(
                /(?:^|\n)__SBH_[A-Z0-9_]+__=[^\n]*(?:\n|$)/g,
                "\n"
            )
            .replace(/^\s+|\s+$/g, "");
    }

    function executeShell(command) {
        var action = ShellCommand.newBuilder()
            .setCommand(String(command))
            .setSingleShot(true)
            .setId(
                "SingBoxHub#Stage46Audit#" +
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

    function postCallback(callback, result) {
        SBH.handler.post(new JavaAdapter(Runnable, {
            run: function () {
                callback(result);
            }
        }));
    }

    function runtimeRootPath() {
        if (typeof shortx === "undefined" ||
                shortx === null ||
                typeof shortx.getShortXDir !== "function") {
            throw new Error(
                "SHORTX_ROOT_UNAVAILABLE"
            );
        }
        return String(shortx.getShortXDir()) +
            "/SingBoxHub";
    }

    function buildAuditCommand(rootPath) {
        var configDir = rootPath + "/config";
        var targetPath =
            rootPath + "/" + TARGET_RELATIVE_PATH;
        var backupDir =
            rootPath + "/" + BACKUP_DIR_RELATIVE_PATH;

        return [
            "ROOT=" + shellQuote(rootPath),
            "DIR=" + shellQuote(configDir),
            "TARGET=" + shellQuote(targetPath),
            "BACKUP=" + shellQuote(backupDir),
            "printf '__SBH_UID__=%s\\n' \"$(id -u 2>/dev/null)\"",
            "if [ -d \"$DIR\" ]; then " +
                "printf '__SBH_DIR_EXISTS__=1\\n'; " +
                "else printf '__SBH_DIR_EXISTS__=0\\n'; fi",
            "if [ -L \"$DIR\" ]; then " +
                "printf '__SBH_DIR_SYMLINK__=1\\n'; " +
                "else printf '__SBH_DIR_SYMLINK__=0\\n'; fi",
            "if [ -e \"$TARGET\" ]; then " +
                "printf '__SBH_TARGET_EXISTS__=1\\n'; " +
                "else printf '__SBH_TARGET_EXISTS__=0\\n'; fi",
            "if [ -f \"$TARGET\" ]; then " +
                "printf '__SBH_TARGET_FILE__=1\\n'; " +
                "else printf '__SBH_TARGET_FILE__=0\\n'; fi",
            "if [ -L \"$TARGET\" ]; then " +
                "printf '__SBH_TARGET_SYMLINK__=1\\n'; " +
                "else printf '__SBH_TARGET_SYMLINK__=0\\n'; fi",
            "if [ -r \"$TARGET\" ]; then " +
                "printf '__SBH_TARGET_READABLE__=1\\n'; " +
                "else printf '__SBH_TARGET_READABLE__=0\\n'; fi",
            "if [ -d \"$BACKUP\" ]; then " +
                "printf '__SBH_BACKUP_DIR_EXISTS__=1\\n'; " +
                "else printf '__SBH_BACKUP_DIR_EXISTS__=0\\n'; fi",
            "if [ -L \"$BACKUP\" ]; then " +
                "printf '__SBH_BACKUP_DIR_SYMLINK__=1\\n'; " +
                "else printf '__SBH_BACKUP_DIR_SYMLINK__=0\\n'; fi",
            "if command -v sha256sum >/dev/null 2>&1; then " +
                "printf '__SBH_SHA_TOOL__=1\\n'; " +
                "if [ -f \"$TARGET\" ] && [ ! -L \"$TARGET\" ]; then " +
                    "H=$(sha256sum \"$TARGET\" 2>/dev/null | " +
                    "awk '{print $1}'); " +
                    "printf '__SBH_TARGET_SHA256__=%s\\n' \"$H\"; " +
                "else printf '__SBH_TARGET_SHA256__=none\\n'; fi; " +
                "else printf '__SBH_SHA_TOOL__=0\\n'; " +
                "printf '__SBH_TARGET_SHA256__=unavailable\\n'; fi",
            "if command -v stat >/dev/null 2>&1; then " +
                "printf '__SBH_STAT_TOOL__=1\\n'; " +
                "printf '__SBH_DIR_MODE__=%s\\n' " +
                    "\"$(stat -c %a \"$DIR\" 2>/dev/null || echo -1)\"; " +
                "printf '__SBH_DIR_UID__=%s\\n' " +
                    "\"$(stat -c %u \"$DIR\" 2>/dev/null || echo -1)\"; " +
                "printf '__SBH_DIR_GID__=%s\\n' " +
                    "\"$(stat -c %g \"$DIR\" 2>/dev/null || echo -1)\"; " +
                "printf '__SBH_DIR_DEVICE__=%s\\n' " +
                    "\"$(stat -c %d \"$DIR\" 2>/dev/null || echo -1)\"; " +
                "if [ -e \"$TARGET\" ]; then " +
                    "printf '__SBH_TARGET_MODE__=%s\\n' " +
                        "\"$(stat -c %a \"$TARGET\" 2>/dev/null || echo -1)\"; " +
                    "printf '__SBH_TARGET_UID__=%s\\n' " +
                        "\"$(stat -c %u \"$TARGET\" 2>/dev/null || echo -1)\"; " +
                    "printf '__SBH_TARGET_GID__=%s\\n' " +
                        "\"$(stat -c %g \"$TARGET\" 2>/dev/null || echo -1)\"; " +
                    "printf '__SBH_TARGET_SIZE__=%s\\n' " +
                        "\"$(stat -c %s \"$TARGET\" 2>/dev/null || echo -1)\"; " +
                    "printf '__SBH_TARGET_DEVICE__=%s\\n' " +
                        "\"$(stat -c %d \"$TARGET\" 2>/dev/null || echo -1)\"; " +
                "else " +
                    "printf '__SBH_TARGET_MODE__=-1\\n'; " +
                    "printf '__SBH_TARGET_UID__=-1\\n'; " +
                    "printf '__SBH_TARGET_GID__=-1\\n'; " +
                    "printf '__SBH_TARGET_SIZE__=0\\n'; " +
                    "printf '__SBH_TARGET_DEVICE__=-1\\n'; fi; " +
                "else printf '__SBH_STAT_TOOL__=0\\n'; fi",
            "FREE=$(df -Pk \"$DIR\" 2>/dev/null | " +
                "awk 'NR==2 {print $4; exit}'); " +
                "case \"$FREE\" in ''|*[!0-9]*) FREE=-1;; esac; " +
                "printf '__SBH_FREE_KB__=%s\\n' \"$FREE\"",
            "printf '__SBH_READ_ONLY_AUDIT__=1\\n'",
            "exit 0"
        ].join("; ");
    }

    function performAudit(selectorResult) {
        var startedAt = now();
        var rootPath = runtimeRootPath();
        var shellResult = executeShell(
            buildAuditCommand(rootPath)
        );
        var raw = shellResult.output;
        var shellUid = markerNumber(raw, "UID");
        var dirExists = markerBoolean(
            raw,
            "DIR_EXISTS"
        );
        var dirSymlink = markerBoolean(
            raw,
            "DIR_SYMLINK"
        );
        var targetExists = markerBoolean(
            raw,
            "TARGET_EXISTS"
        );
        var targetFile = markerBoolean(
            raw,
            "TARGET_FILE"
        );
        var targetSymlink = markerBoolean(
            raw,
            "TARGET_SYMLINK"
        );
        var targetReadable = markerBoolean(
            raw,
            "TARGET_READABLE"
        );
        var backupDirExists = markerBoolean(
            raw,
            "BACKUP_DIR_EXISTS"
        );
        var backupDirSymlink = markerBoolean(
            raw,
            "BACKUP_DIR_SYMLINK"
        );
        var shaTool = markerBoolean(
            raw,
            "SHA_TOOL"
        );
        var statTool = markerBoolean(
            raw,
            "STAT_TOOL"
        );
        var currentHash = marker(
            raw,
            "TARGET_SHA256"
        );
        var candidateHash = String(
            selectorResult.temporaryConfigSha256 || ""
        ).toLowerCase();
        var candidateBytes = Number(
            selectorResult.temporaryConfigByteCount || 0
        );
        var freeKb = markerNumber(
            raw,
            "FREE_KB"
        );
        var requiredFreeKb = Math.max(
            MIN_FREE_KB,
            Math.ceil(candidateBytes * 4 / 1024)
        );
        var hashAvailable =
            !targetExists ||
            (
                shaTool &&
                currentHash !== null &&
                /^[0-9a-f]{64}$/i.test(currentHash)
            );
        var targetShapeSafe =
            !targetExists ||
            (
                targetFile &&
                !targetSymlink &&
                targetReadable
            );
        var metadataGate =
            shellResult.code === 0 &&
            shellUid === 0 &&
            dirExists &&
            !dirSymlink &&
            targetShapeSafe &&
            statTool &&
            hashAvailable &&
            freeKb !== null &&
            freeKb >= requiredFreeKb;
        var alreadyMatches =
            targetExists &&
            hashAvailable &&
            currentHash.toLowerCase() === candidateHash;
        var promotionNeeded =
            metadataGate &&
            !alreadyMatches;
        var currentPrefix =
            targetExists &&
            /^[0-9a-f]{64}$/i.test(currentHash || "") ?
                String(currentHash).substring(0, 12) :
                "none";
        var candidatePrefix =
            /^[0-9a-f]{64}$/i.test(candidateHash) ?
                candidateHash.substring(0, 12) :
                "unknown";

        return {
            ok: metadataGate,
            stage:
                "production_stage46_readonly_promotion_audit",
            promotionPlanVersion: PLAN_VERSION,
            selectorPreflightPassed:
                selectorResult.ok === true &&
                selectorResult.singBoxCheckPassed === true &&
                selectorResult.selectorDefaultMatched === true,
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
                candidateHash || null,
            candidateConfigByteCount:
                candidateBytes,
            currentConfigSha256:
                targetExists &&
                /^[0-9a-f]{64}$/i.test(currentHash || "") ?
                    String(currentHash).toLowerCase() :
                    null,
            currentConfigContentReturned: false,
            currentConfigHashComputedInRootShell: true,
            targetRelativePath:
                TARGET_RELATIVE_PATH,
            targetDirectoryRelativePath:
                "config",
            targetDirectoryExists:
                dirExists,
            targetDirectorySymlink:
                dirSymlink,
            targetDirectoryMode:
                marker(raw, "DIR_MODE"),
            targetDirectoryUid:
                markerNumber(raw, "DIR_UID"),
            targetDirectoryGid:
                markerNumber(raw, "DIR_GID"),
            targetDirectoryDevice:
                marker(raw, "DIR_DEVICE"),
            targetExists:
                targetExists,
            targetRegularFile:
                targetFile,
            targetSymlink:
                targetSymlink,
            targetReadable:
                targetReadable,
            targetMode:
                marker(raw, "TARGET_MODE"),
            targetUid:
                markerNumber(raw, "TARGET_UID"),
            targetGid:
                markerNumber(raw, "TARGET_GID"),
            targetSizeBytes:
                markerNumber(raw, "TARGET_SIZE"),
            targetDevice:
                marker(raw, "TARGET_DEVICE"),
            backupDirectoryRelativePath:
                BACKUP_DIR_RELATIVE_PATH,
            backupDirectoryExists:
                backupDirExists,
            backupDirectorySymlink:
                backupDirSymlink,
            backupDirectoryCreationRequired:
                !backupDirExists,
            backupRequired:
                targetExists &&
                !alreadyMatches,
            plannedBackupRelativePath:
                targetExists &&
                !alreadyMatches ?
                    BACKUP_DIR_RELATIVE_PATH +
                    "/runtime-tun." +
                    currentPrefix +
                    ".json" :
                    null,
            plannedStagingRelativePath:
                "config/.runtime-tun.json.stage-" +
                candidatePrefix,
            plannedAtomicOperation:
                "rename_same_directory",
            stagingSameDirectoryPlanned:
                true,
            sameFilesystemByPlan:
                true,
            atomicRenameTestPerformed:
                false,
            runtimeDirectoryWriteProbePerformed:
                false,
            freeSpaceKb:
                freeKb,
            requiredFreeSpaceKb:
                requiredFreeKb,
            freeSpaceGatePassed:
                freeKb !== null &&
                freeKb >= requiredFreeKb,
            sha256ToolAvailable:
                shaTool,
            statToolAvailable:
                statTool,
            productionConfigAlreadyMatches:
                alreadyMatches,
            promotionNeeded:
                promotionNeeded,
            readOnlyAuditPassed:
                metadataGate,
            readyForExplicitStagingWriteProbe:
                promotionNeeded,
            explicitWriteAuthorizationRequired:
                true,
            writeOperationsLocked:
                true,
            nextAuthorizedOperation:
                alreadyMatches ?
                    "none_config_already_matches" :
                    (
                        promotionNeeded ?
                            "runtime_directory_staging_write_probe" :
                            "resolve_readonly_audit_gate"
                    ),
            shellUid:
                shellUid,
            shellCode:
                shellResult.code,
            shellDiagnostic:
                shellResult.code === 0 ?
                    null :
                    stripMarkers(raw).substring(0, 500),
            candidateConfigPersisted:
                false,
            productionConfigModified:
                false,
            runtimeFilesModified:
                false,
            runtimeMetadataModified:
                false,
            coreStartInvoked:
                false,
            coreStopInvoked:
                false,
            tunCreated:
                false,
            routeModified:
                false,
            networkAccessed:
                false,
            destructiveOperations:
                false,
            durationMs:
                now() - startedAt,
            timestamp:
                now()
        };
    }

    function auditAsync(callback) {
        if (typeof callback !== "function") {
            throw new Error(
                "生产配置审计回调不可用"
            );
        }

        return selectorService.selectorCheckAsync(
            function (selectorResult) {
                if (!selectorResult ||
                        selectorResult.ok !== true ||
                        selectorResult.singBoxCheckPassed !== true ||
                        selectorResult.selectorDefaultMatched !== true) {
                    callback({
                        ok: false,
                        stage:
                            "production_stage46_readonly_promotion_audit",
                        errorCode:
                            "SELECTOR_PREFLIGHT_GATE_FAILED",
                        selectorPreflightPassed:
                            false,
                        errorDetailReturned:
                            false,
                        explicitWriteAuthorizationRequired:
                            true,
                        writeOperationsLocked:
                            true,
                        candidateConfigPersisted:
                            false,
                        productionConfigModified:
                            false,
                        runtimeFilesModified:
                            false,
                        coreStartInvoked:
                            false,
                        tunCreated:
                            false,
                        routeModified:
                            false,
                        destructiveOperations:
                            false,
                        timestamp:
                            now()
                    });
                    return;
                }

                new Thread(
                    new JavaAdapter(Runnable, {
                        run: function () {
                            var result;
                            try {
                                result = performAudit(
                                    selectorResult
                                );
                            } catch (ignoredError) {
                                result = {
                                    ok: false,
                                    stage:
                                        "production_stage46_readonly_promotion_audit",
                                    errorCode:
                                        "READONLY_PROMOTION_AUDIT_FAILED",
                                    errorDetailReturned:
                                        false,
                                    explicitWriteAuthorizationRequired:
                                        true,
                                    writeOperationsLocked:
                                        true,
                                    candidateConfigPersisted:
                                        false,
                                    productionConfigModified:
                                        false,
                                    runtimeFilesModified:
                                        false,
                                    coreStartInvoked:
                                        false,
                                    tunCreated:
                                        false,
                                    routeModified:
                                        false,
                                    destructiveOperations:
                                        false,
                                    timestamp:
                                        now()
                                };
                            }
                            postCallback(
                                callback,
                                result
                            );
                        }
                    }),
                    "SingBoxHub-ProductionPromotionAudit"
                ).start();
            }
        );
    }

    if (!selectorService ||
            typeof selectorService.selectorCheckAsync !==
                "function" ||
            typeof selectorService.getSelectedNode !==
                "function") {
        throw new Error(
            "Stage46 selector dependency unavailable"
        );
    }

    SBH.productionPromotionAudit = {
        version: 1,
        auditAsync: auditAsync,
        targetRelativePath:
            TARGET_RELATIVE_PATH,
        backupDirectoryRelativePath:
            BACKUP_DIR_RELATIVE_PATH,
        readOnly: true,
        explicitWriteAuthorizationRequired:
            true,
        runtimeWriteEnabled:
            false
    };

    if (typeof originalStart !== "function") {
        throw new Error(
            "Original app.start unavailable"
        );
    }

    SBH.app.start = function () {
        var output = originalStart();
        var selected =
            selectorService.getSelectedNode();

        output.productionPromotionAuditVersion = 1;
        output.productionPromotionAuditReady = true;
        output.productionPromotionAuditManualOnly = true;
        output.productionPromotionAuditReadOnly = true;
        output.productionPromotionTargetRelativePath =
            TARGET_RELATIVE_PATH;
        output.productionPromotionBackupDirectoryRelativePath =
            BACKUP_DIR_RELATIVE_PATH;
        output.productionPromotionSelectedNode =
            selected;
        output.productionPromotionStagingSameDirectoryPlanned =
            true;
        output.productionPromotionAtomicRenameTestPerformed =
            false;
        output.productionPromotionRuntimeWriteProbePerformed =
            false;
        output.productionPromotionExplicitAuthorizationRequired =
            true;
        output.productionPromotionRuntimeWriteEnabled =
            false;
        output.productionPromotionConfigModified =
            false;
        output.productionPromotionRuntimeFilesModified =
            false;
        output.writeOperationsLocked = true;
        output.destructiveOperations = false;
        return output;
    };
}());
