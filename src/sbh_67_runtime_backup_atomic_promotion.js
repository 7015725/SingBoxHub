/* SingBoxHub Stage49 production backup and atomic promotion. Rhino ES5 only. */
SBH.versions.runtimeBackupAtomicPromotion = 1;

(function () {
    "use strict";

    var P = Packages;
    var Thread = P.java.lang.Thread;
    var Runnable = P.java.lang.Runnable;
    var ShellCommand =
        P.tornaco.apps.shortx.core.proto.action.ShellCommand;
    var originalFactory = SBH.navigation.pages[1];
    var originalStart = SBH.app.start;
    var W = SBH.widgets;
    var C = SBH.theme.colors;
    var busy = false;

    var AUTHORIZATION_ID =
        "stage49-runtime-backup-atomic-promotion-user-authorized-20260804";
    var CHECK_TIMEOUT_SECONDS = 30;

    function now() {
        return Number(P.java.lang.System.currentTimeMillis());
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
                "SingBoxHub#Stage49#" +
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

    function buildCommand() {
        var root = runtimeRoot();
        var dir = root + "/config";
        var target = dir + "/runtime-tun.json";
        var backupDir = dir + "/backups";
        var binary = root + "/bin/sing-box";
        var token = String(SBH.util.randomToken())
            .replace(/[^A-Za-z0-9]/g, "")
            .substring(0, 18);

        return [
            "umask 077",
            "D=" + quote(dir),
            "T=" + quote(target),
            "B=" + quote(backupDir),
            "BIN=" + quote(binary),
            "AUTH=" + quote(AUTHORIZATION_ID),
            "TOKEN=" + quote(token),
            "REPLACED=0",
            "SUCCESS=0",
            "ROLLBACK=0",
            "ROLLBACK_PASS=0",
            "BACKUP_CREATED=0",
            "BACKUP_REUSED=0",
            "AUDIT_CREATED=0",
            "ALREADY=0",
            "sync_file(){ " +
                "if sync -f \"$1\" >/dev/null 2>&1; then return 0; " +
                "elif sync \"$1\" >/dev/null 2>&1; then return 0; " +
                "else sync >/dev/null 2>&1; fi; " +
            "}",
            "check_file(){ " +
                "if command -v timeout >/dev/null 2>&1; then " +
                    "timeout " + String(CHECK_TIMEOUT_SECONDS) +
                    "s \"$BIN\" check -c \"$1\" >/dev/null 2>&1; " +
                "else \"$BIN\" check -c \"$1\" >/dev/null 2>&1; fi; " +
            "}",
            "rollback_target(){ " +
                "ROLLBACK=1; " +
                "RBT=\"$D/.runtime-tun.json.rollback-$TOKEN\"; " +
                "rm -f \"$RBT\"; " +
                "cat \"$BACKUP\" > \"$RBT\" 2>/dev/null || return 1; " +
                "chmod 600 \"$RBT\" 2>/dev/null || return 1; " +
                "chown 0:0 \"$RBT\" >/dev/null 2>&1 || true; " +
                "sync_file \"$RBT\"; " +
                "RBH=$(sha256sum \"$RBT\" 2>/dev/null | awk '{print $1}'); " +
                "RBS=$(stat -c %s \"$RBT\" 2>/dev/null || echo -1); " +
                "[ \"$RBH\" = \"$TH\" ] && [ \"$RBS\" = \"$TB\" ] || return 1; " +
                "check_file \"$RBT\"; RC=$?; " +
                "[ \"$RC\" = 0 ] || return 1; " +
                "mv -f \"$RBT\" \"$T\" 2>/dev/null || return 1; " +
                "RHF=$(sha256sum \"$T\" 2>/dev/null | awk '{print $1}'); " +
                "RBF=$(stat -c %s \"$T\" 2>/dev/null || echo -1); " +
                "check_file \"$T\"; RFC=$?; " +
                "[ \"$RHF\" = \"$TH\" ] && [ \"$RBF\" = \"$TB\" ] && [ \"$RFC\" = 0 ] || return 1; " +
                "ROLLBACK_PASS=1; return 0; " +
            "}",
            "fail_after_replace(){ " +
                "EC=\"$1\"; " +
                "if [ \"$REPLACED\" = 1 ] && [ \"$SUCCESS\" != 1 ]; then rollback_target || true; fi; " +
                "printf '__SBH_REPLACED__=%s\\n' \"$REPLACED\"; " +
                "printf '__SBH_ROLLBACK__=%s\\n' \"$ROLLBACK\"; " +
                "printf '__SBH_ROLLBACK_PASS__=%s\\n' \"$ROLLBACK_PASS\"; " +
                "printf '__SBH_RH__=%s\\n' \"${RHF:-none}\"; " +
                "printf '__SBH_RB__=%s\\n' \"${RBF:--1}\"; " +
                "printf '__SBH_RCHECK__=%s\\n' \"${RFC:--1}\"; " +
                "exit \"$EC\"; " +
            "}",
            "cleanup(){ " +
                "rm -f \"${PTMP:-}\" \"${BTMP:-}\" \"${ATMP:-}\" \"${RBT:-}\"; " +
            "}",
            "trap cleanup EXIT HUP INT TERM",
            "printf '__SBH_UID__=%s\\n' \"$(id -u 2>/dev/null)\"",
            "[ -d \"$D\" ] && [ ! -L \"$D\" ] || exit 171",
            "[ -f \"$T\" ] && [ ! -L \"$T\" ] || exit 172",
            "[ -f \"$BIN\" ] && [ -x \"$BIN\" ] || exit 173",
            "SC=0",
            "STAGE=''",
            "for F in \"$D\"/.runtime-tun.json.stage-*; do " +
                "[ -e \"$F\" ] || continue; SC=$((SC + 1)); STAGE=\"$F\"; " +
            "done",
            "printf '__SBH_STAGE_COUNT__=%s\\n' \"$SC\"",
            "[ \"$SC\" = 1 ] || exit 174",
            "[ -f \"$STAGE\" ] && [ ! -L \"$STAGE\" ] || exit 175",
            "SN=$(basename \"$STAGE\")",
            "printf '__SBH_STAGE_NAME__=%s\\n' \"$SN\"",
            "SH=$(sha256sum \"$STAGE\" 2>/dev/null | awk '{print $1}')",
            "SB=$(stat -c %s \"$STAGE\" 2>/dev/null || echo -1)",
            "SM=$(stat -c %a \"$STAGE\" 2>/dev/null || echo -1)",
            "SU=$(stat -c %u \"$STAGE\" 2>/dev/null || echo -1)",
            "SG=$(stat -c %g \"$STAGE\" 2>/dev/null || echo -1)",
            "SV=$(stat -c %d \"$STAGE\" 2>/dev/null || echo -1)",
            "SI=$(stat -c %i \"$STAGE\" 2>/dev/null || echo -1)",
            "case \"$SH\" in " +
                "????????????????????????????????????????????????????????????????) ;; " +
                "*) exit 176;; esac",
            "[ \"$SB\" -gt 0 ] && [ \"$SM\" = 600 ] && " +
                "[ \"$SU\" = 0 ] && [ \"$SG\" = 0 ] || exit 177",
            "TH=$(sha256sum \"$T\" 2>/dev/null | awk '{print $1}')",
            "TB=$(stat -c %s \"$T\" 2>/dev/null || echo -1)",
            "TM=$(stat -c %a \"$T\" 2>/dev/null || echo -1)",
            "TU=$(stat -c %u \"$T\" 2>/dev/null || echo -1)",
            "TG=$(stat -c %g \"$T\" 2>/dev/null || echo -1)",
            "TV=$(stat -c %d \"$T\" 2>/dev/null || echo -1)",
            "TI=$(stat -c %i \"$T\" 2>/dev/null || echo -1)",
            "DV=$(stat -c %d \"$D\" 2>/dev/null || echo -1)",
            "[ \"$SV\" = \"$DV\" ] && [ \"$TV\" = \"$DV\" ] || exit 178",
            "check_file \"$STAGE\"; STAGE_CHECK=$?",
            "printf '__SBH_STAGE_CHECK__=%s\\n' \"$STAGE_CHECK\"",
            "[ \"$STAGE_CHECK\" = 0 ] || exit 179",
            "RUN=0",
            "for PTH in /proc/[0-9]*/cmdline; do " +
                "[ -r \"$PTH\" ] || continue; " +
                "ARG0=$(tr '\\000' '\\n' < \"$PTH\" 2>/dev/null | sed -n '1p'); " +
                "[ \"$ARG0\" = \"$BIN\" ] && RUN=$((RUN + 1)); " +
            "done",
            "printf '__SBH_RUNNING_CORE_COUNT__=%s\\n' \"$RUN\"",
            "[ \"$RUN\" = 0 ] || exit 180",
            "FREE=$(df -Pk \"$D\" 2>/dev/null | awk 'NR==2 {print $4; exit}')",
            "case \"$FREE\" in ''|*[!0-9]*) FREE=-1;; esac",
            "REQ=$(( (TB + SB + 1023) / 1024 + 1024 ))",
            "printf '__SBH_FREE__=%s\\n' \"$FREE\"",
            "printf '__SBH_REQUIRED__=%s\\n' \"$REQ\"",
            "[ \"$FREE\" -ge \"$REQ\" ] || exit 181",
            "if [ \"$TH\" = \"$SH\" ] && [ \"$TB\" = \"$SB\" ]; then " +
                "ALREADY=1; " +
                "check_file \"$T\"; FINAL_CHECK=$?; " +
                "[ \"$FINAL_CHECK\" = 0 ] || exit 182; " +
            "else " +
                "if [ -e \"$B\" ]; then " +
                    "[ -d \"$B\" ] && [ ! -L \"$B\" ] || exit 183; " +
                "else mkdir \"$B\" 2>/dev/null || exit 184; BDIR_CREATED=1; fi; " +
                "chmod 700 \"$B\" 2>/dev/null || exit 185; " +
                "chown 0:0 \"$B\" >/dev/null 2>&1 || true; " +
                "BP=$(printf '%s' \"$TH\" | cut -c 1-12); " +
                "SP=$(printf '%s' \"$SH\" | cut -c 1-12); " +
                "BACKUP=\"$B/runtime-tun.before-$BP-to-$SP.json\"; " +
                "BN=$(basename \"$BACKUP\"); " +
                "if [ -e \"$BACKUP\" ]; then " +
                    "[ -f \"$BACKUP\" ] && [ ! -L \"$BACKUP\" ] || exit 186; " +
                    "BH=$(sha256sum \"$BACKUP\" 2>/dev/null | awk '{print $1}'); " +
                    "BS=$(stat -c %s \"$BACKUP\" 2>/dev/null || echo -1); " +
                    "[ \"$BH\" = \"$TH\" ] && [ \"$BS\" = \"$TB\" ] || exit 187; " +
                    "BACKUP_REUSED=1; " +
                "else " +
                    "BTMP=\"$B/.runtime-tun.backup-$TOKEN.tmp\"; " +
                    "rm -f \"$BTMP\"; " +
                    "cat \"$T\" > \"$BTMP\" 2>/dev/null || exit 188; " +
                    "chmod 600 \"$BTMP\" 2>/dev/null || exit 189; " +
                    "chown 0:0 \"$BTMP\" >/dev/null 2>&1 || true; " +
                    "sync_file \"$BTMP\"; " +
                    "BH=$(sha256sum \"$BTMP\" 2>/dev/null | awk '{print $1}'); " +
                    "BS=$(stat -c %s \"$BTMP\" 2>/dev/null || echo -1); " +
                    "[ \"$BH\" = \"$TH\" ] && [ \"$BS\" = \"$TB\" ] || exit 190; " +
                    "mv \"$BTMP\" \"$BACKUP\" 2>/dev/null || exit 191; " +
                    "BACKUP_CREATED=1; " +
                "fi; " +
                "PTMP=\"$D/.runtime-tun.json.promote-$SP-$TOKEN\"; " +
                "rm -f \"$PTMP\"; " +
                "cat \"$STAGE\" > \"$PTMP\" 2>/dev/null || exit 192; " +
                "chmod 600 \"$PTMP\" 2>/dev/null || exit 193; " +
                "chown 0:0 \"$PTMP\" >/dev/null 2>&1 || true; " +
                "PH=$(sha256sum \"$PTMP\" 2>/dev/null | awk '{print $1}'); " +
                "PS=$(stat -c %s \"$PTMP\" 2>/dev/null || echo -1); " +
                "PV=$(stat -c %d \"$PTMP\" 2>/dev/null || echo -1); " +
                "[ \"$PH\" = \"$SH\" ] && [ \"$PS\" = \"$SB\" ] && [ \"$PV\" = \"$DV\" ] || exit 194; " +
                "check_file \"$PTMP\"; PROMOTE_CHECK=$?; " +
                "[ \"$PROMOTE_CHECK\" = 0 ] || exit 195; " +
                "sync_file \"$PTMP\"; " +
                "mv -f \"$PTMP\" \"$T\" 2>/dev/null || exit 196; " +
                "REPLACED=1; " +
                "FH=$(sha256sum \"$T\" 2>/dev/null | awk '{print $1}'); " +
                "FB=$(stat -c %s \"$T\" 2>/dev/null || echo -1); " +
                "FM=$(stat -c %a \"$T\" 2>/dev/null || echo -1); " +
                "FU=$(stat -c %u \"$T\" 2>/dev/null || echo -1); " +
                "FG=$(stat -c %g \"$T\" 2>/dev/null || echo -1); " +
                "FV=$(stat -c %d \"$T\" 2>/dev/null || echo -1); " +
                "FI=$(stat -c %i \"$T\" 2>/dev/null || echo -1); " +
                "[ \"$FH\" = \"$SH\" ] && [ \"$FB\" = \"$SB\" ] && " +
                    "[ \"$FM\" = 600 ] && [ \"$FU\" = 0 ] && [ \"$FG\" = 0 ] && " +
                    "[ \"$FV\" = \"$DV\" ] || fail_after_replace 197; " +
                "check_file \"$T\"; FINAL_CHECK=$?; " +
                "[ \"$FINAL_CHECK\" = 0 ] || fail_after_replace 198; " +
                "AN=\"promotion-$BP-to-$SP.json\"; " +
                "AUDIT=\"$B/$AN\"; " +
                "ATMP=\"$B/.$AN.$TOKEN.tmp\"; " +
                "TS=$(date +%s 2>/dev/null || echo 0); " +
                "printf '{\\n  \"schemaVersion\": 1,\\n  \"stage\": 49,\\n  \"authorizationId\": \"%s\",\\n  \"previousSha256\": \"%s\",\\n  \"candidateSha256\": \"%s\",\\n  \"previousBytes\": %s,\\n  \"candidateBytes\": %s,\\n  \"backupFile\": \"%s\",\\n  \"stagingFile\": \"%s\",\\n  \"timestampSeconds\": %s\\n}\\n' " +
                    "\"$AUTH\" \"$TH\" \"$SH\" \"$TB\" \"$SB\" \"$BN\" \"$SN\" \"$TS\" > \"$ATMP\" || fail_after_replace 199; " +
                "chmod 600 \"$ATMP\" 2>/dev/null || fail_after_replace 200; " +
                "chown 0:0 \"$ATMP\" >/dev/null 2>&1 || true; " +
                "sync_file \"$ATMP\"; " +
                "mv -f \"$ATMP\" \"$AUDIT\" 2>/dev/null || fail_after_replace 201; " +
                "AUDIT_CREATED=1; " +
                "SUCCESS=1; " +
            "fi",
            "[ -f \"$STAGE\" ] && [ ! -L \"$STAGE\" ] || exit 202",
            "SFH=$(sha256sum \"$STAGE\" 2>/dev/null | awk '{print $1}')",
            "SFB=$(stat -c %s \"$STAGE\" 2>/dev/null || echo -1)",
            "[ \"$SFH\" = \"$SH\" ] && [ \"$SFB\" = \"$SB\" ] || exit 203",
            "printf '__SBH_SH__=%s\\n' \"$SH\"",
            "printf '__SBH_SB__=%s\\n' \"$SB\"",
            "printf '__SBH_SM__=%s\\n' \"$SM\"",
            "printf '__SBH_SU__=%s\\n' \"$SU\"",
            "printf '__SBH_SG__=%s\\n' \"$SG\"",
            "printf '__SBH_SV__=%s\\n' \"$SV\"",
            "printf '__SBH_SI__=%s\\n' \"$SI\"",
            "printf '__SBH_TH__=%s\\n' \"$TH\"",
            "printf '__SBH_TB__=%s\\n' \"$TB\"",
            "printf '__SBH_TM__=%s\\n' \"$TM\"",
            "printf '__SBH_TU__=%s\\n' \"$TU\"",
            "printf '__SBH_TG__=%s\\n' \"$TG\"",
            "printf '__SBH_TV__=%s\\n' \"$TV\"",
            "printf '__SBH_TI__=%s\\n' \"$TI\"",
            "printf '__SBH_DV__=%s\\n' \"$DV\"",
            "printf '__SBH_ALREADY__=%s\\n' \"$ALREADY\"",
            "printf '__SBH_BACKUP_DIR_CREATED__=%s\\n' \"${BDIR_CREATED:-0}\"",
            "printf '__SBH_BACKUP_CREATED__=%s\\n' \"$BACKUP_CREATED\"",
            "printf '__SBH_BACKUP_REUSED__=%s\\n' \"$BACKUP_REUSED\"",
            "printf '__SBH_BACKUP_NAME__=%s\\n' \"${BN:-none}\"",
            "printf '__SBH_BACKUP_HASH__=%s\\n' \"${BH:-none}\"",
            "printf '__SBH_BACKUP_SIZE__=%s\\n' \"${BS:--1}\"",
            "printf '__SBH_PROMOTE_CHECK__=%s\\n' \"${PROMOTE_CHECK:--1}\"",
            "printf '__SBH_REPLACED__=%s\\n' \"$REPLACED\"",
            "printf '__SBH_FH__=%s\\n' \"${FH:-$TH}\"",
            "printf '__SBH_FB__=%s\\n' \"${FB:-$TB}\"",
            "printf '__SBH_FM__=%s\\n' \"${FM:-$TM}\"",
            "printf '__SBH_FU__=%s\\n' \"${FU:-$TU}\"",
            "printf '__SBH_FG__=%s\\n' \"${FG:-$TG}\"",
            "printf '__SBH_FV__=%s\\n' \"${FV:-$TV}\"",
            "printf '__SBH_FI__=%s\\n' \"${FI:-$TI}\"",
            "printf '__SBH_FINAL_CHECK__=%s\\n' \"${FINAL_CHECK:--1}\"",
            "printf '__SBH_AUDIT_CREATED__=%s\\n' \"$AUDIT_CREATED\"",
            "printf '__SBH_AUDIT_NAME__=%s\\n' \"${AN:-none}\"",
            "printf '__SBH_ROLLBACK__=%s\\n' \"$ROLLBACK\"",
            "printf '__SBH_ROLLBACK_PASS__=%s\\n' \"$ROLLBACK_PASS\"",
            "printf '__SBH_STAGING_RETAINED__=1\\n'",
            "printf '__SBH_DONE__=1\\n'",
            "trap - EXIT HUP INT TERM",
            "exit 0"
        ].join("; ");
    }

    function promote() {
        var shellResult = executeShell(buildCommand());
        var raw = shellResult.output;
        var done = yes(raw, "DONE");
        var already = yes(raw, "ALREADY");
        var replaced = yes(raw, "REPLACED");
        var rollbackInvoked = yes(raw, "ROLLBACK");
        var rollbackPassed = yes(raw, "ROLLBACK_PASS");
        var candidateHash = marker(raw, "SH");
        var finalHash = marker(raw, "FH");
        var candidateBytes = numberValue(raw, "SB");
        var finalBytes = numberValue(raw, "FB");
        var targetMatches =
            candidateHash !== null &&
            candidateHash === finalHash &&
            candidateBytes !== null &&
            candidateBytes === finalBytes;
        var success =
            done &&
            numberValue(raw, "UID") === 0 &&
            numberValue(raw, "STAGE_COUNT") === 1 &&
            numberValue(raw, "STAGE_CHECK") === 0 &&
            numberValue(raw, "RUNNING_CORE_COUNT") === 0 &&
            yes(raw, "STAGING_RETAINED") &&
            !rollbackInvoked &&
            targetMatches &&
            numberValue(raw, "FINAL_CHECK") === 0 &&
            (
                already ||
                (
                    replaced &&
                    (
                        yes(raw, "BACKUP_CREATED") ||
                        yes(raw, "BACKUP_REUSED")
                    ) &&
                    yes(raw, "AUDIT_CREATED")
                )
            );
        var stageName = marker(raw, "STAGE_NAME");
        var backupName = marker(raw, "BACKUP_NAME");
        var auditName = marker(raw, "AUDIT_NAME");

        return {
            ok: success,
            stage:
                "production_stage49_runtime_backup_atomic_promotion",
            authorizationId: AUTHORIZATION_ID,
            authorizationConsumed: true,
            automaticRetryAllowed: false,
            manualOnly: true,
            stage48StagingDiscovered:
                numberValue(raw, "STAGE_COUNT") === 1,
            stage48StagingValidated:
                numberValue(raw, "STAGE_CHECK") === 0,
            stagingRelativePath:
                stageName && stageName !== "none" ?
                    "config/" + stageName : null,
            stagingPathReturned: false,
            stagingRetained: yes(raw, "STAGING_RETAINED"),
            candidateConfigSha256: candidateHash,
            candidateConfigByteCount: candidateBytes,
            candidateConfigMode: marker(raw, "SM"),
            candidateConfigUid: numberValue(raw, "SU"),
            candidateConfigGid: numberValue(raw, "SG"),
            previousProductionConfigSha256:
                marker(raw, "TH"),
            previousProductionConfigByteCount:
                numberValue(raw, "TB"),
            promotionNeeded: !already,
            productionConfigAlreadyMatched: already,
            backupDirectoryCreated:
                yes(raw, "BACKUP_DIR_CREATED"),
            backupCreated: yes(raw, "BACKUP_CREATED"),
            backupReused: yes(raw, "BACKUP_REUSED"),
            backupRelativePath:
                backupName && backupName !== "none" ?
                    "config/backups/" + backupName : null,
            backupHashVerified:
                already ||
                marker(raw, "BACKUP_HASH") ===
                    marker(raw, "TH"),
            backupSizeVerified:
                already ||
                numberValue(raw, "BACKUP_SIZE") ===
                    numberValue(raw, "TB"),
            atomicRenamePerformed: replaced,
            sameFilesystemVerified:
                marker(raw, "SV") === marker(raw, "DV") &&
                marker(raw, "TV") === marker(raw, "DV"),
            productionConfigReplaced: replaced,
            productionConfigSha256: finalHash,
            productionConfigByteCount: finalBytes,
            productionConfigHashMatchesCandidate:
                targetMatches,
            productionConfigMode: marker(raw, "FM"),
            productionConfigUid: numberValue(raw, "FU"),
            productionConfigGid: numberValue(raw, "FG"),
            productionConfigCheckExitCode:
                numberValue(raw, "FINAL_CHECK"),
            productionConfigCheckPassed:
                numberValue(raw, "FINAL_CHECK") === 0,
            auditRecordCreated: yes(raw, "AUDIT_CREATED"),
            auditRecordRelativePath:
                auditName && auditName !== "none" ?
                    "config/backups/" + auditName : null,
            rollbackInvoked: rollbackInvoked,
            rollbackPassed: rollbackPassed,
            rollbackProductionSha256:
                marker(raw, "RH"),
            rollbackProductionByteCount:
                numberValue(raw, "RB"),
            rollbackCheckExitCode:
                numberValue(raw, "RCHECK"),
            runningCoreCount:
                numberValue(raw, "RUNNING_CORE_COUNT"),
            freeSpaceKb: numberValue(raw, "FREE"),
            requiredFreeSpaceKb:
                numberValue(raw, "REQUIRED"),
            shellUid: numberValue(raw, "UID"),
            shellCode: shellResult.code,
            shellCompletionMarkerObserved: done,
            shellCodeAuthoritative: false,
            shellTransportCodeAnomalous:
                done && shellResult.code !== 0,
            coreStartInvoked: false,
            coreStopInvoked: false,
            tunCreated: false,
            routeModified: false,
            networkAccessed: false,
            destructiveOperations: false,
            readyForExplicitCoreStartProbe: success,
            nextAuthorizedOperation:
                success ?
                    "runtime_core_start_probe_with_exact_rollback" :
                    (
                        rollbackPassed ?
                            "review_stage49_failure_after_verified_rollback" :
                            "resolve_backup_atomic_promotion_gate"
                    ),
            timestamp: now()
        };
    }

    function promoteAsync(callback) {
        if (typeof callback !== "function") {
            throw new Error("Stage49 callback unavailable");
        }
        if (busy) {
            callback({
                ok: false,
                stage:
                    "production_stage49_runtime_backup_atomic_promotion",
                errorCode: "STAGE49_ALREADY_RUNNING",
                timestamp: now()
            });
            return {
                accepted: false,
                busy: true
            };
        }

        busy = true;
        new Thread(
            new JavaAdapter(Runnable, {
                run: function () {
                    var output;
                    try {
                        output = promote();
                    } catch (ignored) {
                        output = {
                            ok: false,
                            stage:
                                "production_stage49_runtime_backup_atomic_promotion",
                            errorCode:
                                "BACKUP_ATOMIC_PROMOTION_FAILED",
                            errorDetailReturned: false,
                            authorizationId:
                                AUTHORIZATION_ID,
                            authorizationConsumed: true,
                            productionConfigReplaced: false,
                            coreStartInvoked: false,
                            tunCreated: false,
                            routeModified: false,
                            destructiveOperations: false,
                            timestamp: now()
                        };
                    }
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
            "SingBoxHub-Stage49AtomicPromotion"
        ).start();

        return {
            accepted: true,
            busy: false
        };
    }

    function buildCard() {
        var card = W.card(17);
        var title = W.text(
            "生产配置备份与原子提升",
            17,
            C.navy,
            true
        );
        var note = W.text(
            "校验 Stage 48 staging，确认 sing-box 核心未运行，" +
            "备份当前 runtime-tun.json，再通过同目录原子重命名提升候选配置。" +
            "提升后再次执行 sing-box check；失败时从备份精确回滚。" +
            "本阶段不启动核心、不创建 TUN、不修改路由。",
            11.4,
            C.secondary,
            false
        );
        var resultText = W.text(
            JSON.stringify({
                ready: true,
                authorizationId:
                    AUTHORIZATION_ID,
                manualOnly: true,
                automaticRetryAllowed: false,
                backupEnabled: true,
                atomicPromotionEnabled: true,
                exactRollbackEnabled: true,
                coreStartEnabled: false
            }, null, 2),
            10.3,
            C.secondary,
            false
        );
        var button = W.button(
            "备份并原子提升生产配置",
            "shield",
            C.orange,
            C.orangeSoft,
            function () {
                resultText.setText(
                    "正在校验 staging、备份生产配置并执行原子提升。"
                );
                SBH.util.toast(
                    "正在执行生产配置原子提升"
                );
                promoteAsync(function (result) {
                    resultText.setText(
                        JSON.stringify(result, null, 2)
                    );
                    SBH.util.toast(
                        result.ok === true ?
                            "生产配置提升完成，核心仍保持锁定" :
                            (
                                result.rollbackPassed === true ?
                                    "提升失败，已验证回滚" :
                                    "生产配置提升存在待处理项"
                            )
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

    if (typeof originalFactory !== "function" ||
            typeof originalStart !== "function") {
        throw new Error("Stage49 dependencies unavailable");
    }

    SBH.runtimeBackupAtomicPromotion = {
        version: 1,
        promoteAsync: promoteAsync,
        authorizationId: AUTHORIZATION_ID,
        manualOnly: true,
        automaticRetryAllowed: false,
        backupEnabled: true,
        atomicPromotionEnabled: true,
        exactRollbackEnabled: true,
        coreStartEnabled: false
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

        output.runtimeBackupAtomicPromotionVersion = 1;
        output.runtimeBackupAtomicPromotionReady = true;
        output.runtimeBackupAtomicPromotionAuthorizationId =
            AUTHORIZATION_ID;
        output.runtimeBackupAtomicPromotionAuthorized = true;
        output.runtimeBackupAtomicPromotionManualOnly = true;
        output.runtimeBackupAtomicPromotionAutomaticRetry = false;
        output.runtimeBackupEnabled = true;
        output.runtimeAtomicPromotionEnabled = true;
        output.runtimeExactRollbackEnabled = true;
        output.runtimePromotionCoreStartEnabled = false;
        output.runtimePromotionTunEnabled = false;
        output.runtimePromotionRouteWriteEnabled = false;
        output.writeOperationsLocked = false;
        output.destructiveOperations = false;
        return output;
    };
}());
