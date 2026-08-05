/* SingBoxHub Stage57 low-latency production lifecycle controls. Rhino ES5 only. */
SBH.versions.runtimeProductionLifecycleLowLatency = 1;

(function () {
    "use strict";

    var P = Packages;
    var Thread = P.java.lang.Thread;
    var Runnable = P.java.lang.Runnable;
    var ShellCommand =
        P.tornaco.apps.shortx.core.proto.action.ShellCommand;
    var LocalSocket = P.android.net.LocalSocket;
    var LocalSocketAddress = P.android.net.LocalSocketAddress;
    var BufferedWriter = P.java.io.BufferedWriter;
    var OutputStreamWriter = P.java.io.OutputStreamWriter;
    var BufferedReader = P.java.io.BufferedReader;
    var InputStreamReader = P.java.io.InputStreamReader;
    var SecureRandom = P.java.security.SecureRandom;
    var ReflectArray = P.java.lang.reflect.Array;
    var JavaByte = P.java.lang.Byte;
    var JavaString = P.java.lang.String;
    var Base64 = P.android.util.Base64;
    var FrameLayout = P.android.widget.FrameLayout;
    var Gravity = P.android.view.Gravity;
    var originalHome = SBH.navigation.pages[0];
    var originalNodes = SBH.navigation.pages[1];
    var originalStart = SBH.app.start;
    var W = SBH.widgets;
    var C = SBH.theme.colors;

    var busy = false;
    var verificationPending = false;
    var activated = false;
    var baseline = null;
    var lastSnapshot = null;
    var lastResult = null;
    var lastOperation = null;
    var generation = 0;

    var AUTHORIZATION_ID =
        "stage57-runtime-production-lifecycle-low-latency-user-authorized-20260806";
    var SOURCE_WRITE_UNLOCK_AUTHORIZATION_ID =
        "stage56-runtime-production-lifecycle-write-unlock-user-authorized-20260805";
    var SERVER_CLASS =
        "com.singboxhub.runtime.CoreRuntimeMain";
    var CLIENT_CLASS =
        "com.singboxhub.runtime.CoreClientMain";
    var SOCKET_READ_TIMEOUT_MS = 1800;
    var STATUS_POLL_INTERVAL_MS = 250;
    var STATUS_CONVERGENCE_TIMEOUT_MS = 6000;

    var ACTIVATION_SHELL_TEMPLATE = "umask 077\nROOT=__ROOT__\nD=__CONFIG_DIR__\nCFG=__CONFIG__\nBIN=__BINARY__\nSTATE=__STATE__\nJAR=__RUNTIME_JAR__\nWORK=__WORK__\nCTRL=__CONTROL__\nENDPOINT=__ENDPOINT__\nUNLOCK_AUDIT=__UNLOCK_AUDIT__\nOPT_AUDIT=__OPT_AUDIT__\nOPT_TMP=__OPT_TMP__\nSERVER=__SERVER__\nSOURCE_AUTH=__SOURCE_AUTH__\nAUTH=__AUTH__\nGATE=none\nCODE=0\nfinish() {\n    printf '__SBH_GATE__=%s\\n' \"$GATE\"\n    printf '__SBH_CODE__=%s\\n' \"$CODE\"\n    printf '__SBH_DONE__=1\\n'\n    exit 0\n}\nfail() {\n    GATE=\"$1\"\n    CODE=\"$2\"\n    finish\n}\nrule4_count() {\n    ip -4 rule show 2>/dev/null | awk '$1 ~ /^[0-9]+:$/ {p=$1; sub(/:$/,\"\",p); if (p>=8800 && p<=8815) c++} END{print c+0}'\n}\nrule6_count() {\n    ip -6 rule show 2>/dev/null | awk '$1 ~ /^[0-9]+:$/ {p=$1; sub(/:$/,\"\",p); if (p>=8800 && p<=8815) c++} END{print c+0}'\n}\nroute4_count() {\n    ip -4 route show table 20240 2>/dev/null | awk 'NF{c++} END{print c+0}'\n}\nroute6_count() {\n    ip -6 route show table 20240 2>/dev/null | awk 'NF{c++} END{print c+0}'\n}\nmatch_control() {\n    P=\"$1\"\n    [ -r \"/proc/$P/cmdline\" ] || return 1\n    V=$(tr '\\000' ' ' < \"/proc/$P/cmdline\" 2>/dev/null)\n    case \"$V\" in\n        *\"$SERVER\"*\"$CFG\"*\"$WORK\"*) return 0 ;;\n        *) return 1 ;;\n    esac\n}\ncandidate_fields() {\n    P=\"$1\"\n    X=\"/proc/$P/cmdline\"\n    [ -r \"$X\" ] || return 1\n    ARGS=$(tr '\\000' '\\n' < \"$X\" 2>/dev/null)\n    [ -n \"$ARGS\" ] || return 1\n    A0=$(printf '%s\\n' \"$ARGS\" | sed -n '1p')\n    BIDX=-1\n    CIDX=-1\n    IDX=0\n    while IFS= read -r A; do\n        [ \"$A\" = \"$BIN\" ] && [ \"$BIDX\" = -1 ] && BIDX=$IDX\n        [ \"$A\" = \"$CFG\" ] && [ \"$CIDX\" = -1 ] && CIDX=$IDX\n        IDX=$((IDX + 1))\n    done <<EOA\n$ARGS\nEOA\n    PP=$(awk '/^PPid:/ {print $2; exit}' \"/proc/$P/status\" 2>/dev/null)\n    U=$(awk '/^Uid:/ {print $2; exit}' \"/proc/$P/status\" 2>/dev/null)\n    S=$(awk '/^State:/ {print $2; exit}' \"/proc/$P/status\" 2>/dev/null)\n    return 0\n}\nmatch_loose_core() {\n    P=\"$1\"\n    candidate_fields \"$P\" || return 1\n    [ \"$P\" != \"$CPID\" ] && [ \"$U\" = 0 ] && [ \"$S\" != Z ] &&\n        [ \"$A0\" = \"$BIN\" ] && [ \"$BIDX\" = 0 ] && [ \"$CIDX\" -ge 1 ]\n}\nmatch_core() {\n    P=\"$1\"\n    candidate_fields \"$P\" || return 1\n    [ \"$P\" != \"$CPID\" ] && [ \"$PP\" = \"$CPID\" ] && [ \"$U\" = 0 ] &&\n        [ \"$S\" != Z ] && [ \"$A0\" = \"$BIN\" ] &&\n        [ \"$BIDX\" = 0 ] && [ \"$CIDX\" -ge 1 ]\n}\ncore_snapshot() {\n    COUNT=0\n    LOOSE=0\n    PID=0\n    PICK_PPID=0\n    PICK_UID=-1\n    PICK_STATE=none\n    PICK_ARGC=0\n    PICK_BIDX=-1\n    PICK_CIDX=-1\n    for X in /proc/[0-9]*/cmdline; do\n        [ -r \"$X\" ] || continue\n        P=${X#/proc/}\n        P=${P%/cmdline}\n        if match_loose_core \"$P\"; then\n            LOOSE=$((LOOSE + 1))\n        fi\n        if match_core \"$P\"; then\n            COUNT=$((COUNT + 1))\n            PID=\"$P\"\n            PICK_PPID=\"$PP\"\n            PICK_UID=\"$U\"\n            PICK_STATE=\"$S\"\n            PICK_ARGC=\"$IDX\"\n            PICK_BIDX=\"$BIDX\"\n            PICK_CIDX=\"$CIDX\"\n        fi\n    done\n}\nUIDV=$(id -u 2>/dev/null)\nprintf '__SBH_UID__=%s\\n' \"$UIDV\"\n[ \"$UIDV\" = 0 ] || fail root_uid 1001\n[ -d \"$ROOT\" ] && [ ! -L \"$ROOT\" ] || fail runtime_root 1002\n[ -d \"$D\" ] && [ ! -L \"$D\" ] || fail config_directory 1003\n[ -d \"$STATE\" ] && [ ! -L \"$STATE\" ] || fail state_directory 1004\n[ \"$(stat -c %a \"$STATE\" 2>/dev/null)\" = 700 ] || fail state_mode 1005\n[ \"$(stat -c %u \"$STATE\" 2>/dev/null)\" = 0 ] &&\n    [ \"$(stat -c %g \"$STATE\" 2>/dev/null)\" = 0 ] || fail state_owner 1006\n[ -d \"$CTRL\" ] && [ ! -L \"$CTRL\" ] || fail control_directory 1007\n[ -d \"$WORK\" ] && [ ! -L \"$WORK\" ] || fail work_directory 1008\n[ -f \"$JAR\" ] && [ ! -L \"$JAR\" ] || fail runtime_jar 1009\n[ -f \"$BIN\" ] && [ -x \"$BIN\" ] && [ ! -L \"$BIN\" ] || fail singbox_binary 1010\n[ -f \"$CFG\" ] && [ ! -L \"$CFG\" ] || fail production_config 1011\n[ \"$(stat -c %a \"$CFG\" 2>/dev/null)\" = 600 ] &&\n    [ \"$(stat -c %u \"$CFG\" 2>/dev/null)\" = 0 ] &&\n    [ \"$(stat -c %g \"$CFG\" 2>/dev/null)\" = 0 ] || fail production_config_metadata 1012\nSC=0\nSTAGE=\nfor F in \"$D\"/.runtime-tun.json.stage-*; do\n    [ -e \"$F\" ] || continue\n    SC=$((SC + 1))\n    STAGE=\"$F\"\ndone\n[ \"$SC\" = 1 ] || fail staging_count 1013\n[ -f \"$STAGE\" ] && [ ! -L \"$STAGE\" ] || fail staging_file 1014\nCH=$(sha256sum \"$CFG\" 2>/dev/null | awk '{print $1}')\nCB=$(stat -c %s \"$CFG\" 2>/dev/null || echo -1)\nCM=$(stat -c %Y \"$CFG\" 2>/dev/null || echo -1)\nCI=$(stat -c %i \"$CFG\" 2>/dev/null || echo -1)\nSH=$(sha256sum \"$STAGE\" 2>/dev/null | awk '{print $1}')\nSB=$(stat -c %s \"$STAGE\" 2>/dev/null || echo -1)\n[ -n \"$CH\" ] && [ \"$CH\" = \"$SH\" ] && [ \"$CB\" = \"$SB\" ] ||\n    fail production_staging_lineage 1015\nif command -v timeout >/dev/null 2>&1; then\n    timeout 30s \"$BIN\" check -c \"$CFG\" >/dev/null 2>&1\nelse\n    \"$BIN\" check -c \"$CFG\" >/dev/null 2>&1\nfi\nCHECK=$?\n[ \"$CHECK\" = 0 ] || fail production_config_check 1016\n[ -f \"$UNLOCK_AUDIT\" ] && [ ! -L \"$UNLOCK_AUDIT\" ] || fail unlock_audit_missing 1017\n[ \"$(stat -c %a \"$UNLOCK_AUDIT\" 2>/dev/null)\" = 600 ] &&\n    [ \"$(stat -c %u \"$UNLOCK_AUDIT\" 2>/dev/null)\" = 0 ] &&\n    [ \"$(stat -c %g \"$UNLOCK_AUDIT\" 2>/dev/null)\" = 0 ] || fail unlock_audit_metadata 1018\ngrep -F '\"authorizationId\":\"'\"$SOURCE_AUTH\"'\"' \"$UNLOCK_AUDIT\" >/dev/null 2>&1 ||\n    fail unlock_audit_authorization 1019\ngrep -F '\"writeActionsUnlocked\":true' \"$UNLOCK_AUDIT\" >/dev/null 2>&1 ||\n    fail unlock_audit_state 1020\n[ -f \"$ENDPOINT\" ] && [ ! -L \"$ENDPOINT\" ] || fail endpoint_missing 1021\n[ \"$(stat -c %a \"$ENDPOINT\" 2>/dev/null)\" = 600 ] &&\n    [ \"$(stat -c %u \"$ENDPOINT\" 2>/dev/null)\" = 0 ] &&\n    [ \"$(stat -c %g \"$ENDPOINT\" 2>/dev/null)\" = 0 ] || fail endpoint_metadata 1022\n[ \"$(readlink -f \"$ENDPOINT\" 2>/dev/null)\" = \"$ENDPOINT\" ] ||\n    fail endpoint_canonical 1023\nCPID=$(sed -n 's/.*\"runtimePid\"[[:space:]]*:[[:space:]]*\\([0-9][0-9]*\\).*/\\1/p' \"$ENDPOINT\" | sed -n '1p')\ncase \"$CPID\" in\n    ''|*[!0-9]*) fail endpoint_pid_invalid 1024 ;;\nesac\nkill -0 \"$CPID\" 2>/dev/null || fail control_service_not_alive 1025\nmatch_control \"$CPID\" || fail control_service_identity 1026\nCUID=$(awk '/^Uid:/ {print $2; exit}' \"/proc/$CPID/status\" 2>/dev/null)\nCGID=$(awk '/^Gid:/ {print $2; exit}' \"/proc/$CPID/status\" 2>/dev/null)\n[ \"$CUID\" = 0 ] && [ \"$CGID\" = 0 ] || fail control_service_owner 1027\ncore_snapshot\n[ \"$COUNT\" = 0 ] && [ \"$LOOSE\" = 0 ] || fail activation_requires_core_stopped 1028\nTUN=0\n[ -e /sys/class/net/sbh-tun0 ] && TUN=1\nR4=$(rule4_count)\nR6=$(rule6_count)\nRT4=$(route4_count)\nRT6=$(route6_count)\n[ \"$TUN\" = 0 ] && [ \"$R4\" = 0 ] && [ \"$R6\" = 0 ] &&\n    [ \"$RT4\" = 0 ] && [ \"$RT6\" = 0 ] ||\n    fail reserved_network_resources_present 1029\nTS=$(date +%s 2>/dev/null || echo 0)\nprintf '{\"schemaVersion\":1,\"stage\":57,\"authorizationId\":\"%s\",\"sourceWriteUnlockAuthorizationId\":\"%s\",\"runtimePid\":%s,\"lowLatencyControlEnabled\":true,\"visiblePathShellCalls\":0,\"strictBackgroundShellCallsPerWrite\":1,\"directProcessSignal\":false,\"activatedAtSeconds\":%s}\\n' \\\n    \"$AUTH\" \"$SOURCE_AUTH\" \"$CPID\" \"$TS\" > \"$OPT_TMP\" || fail optimization_audit_write 1030\nchmod 600 \"$OPT_TMP\" || fail optimization_audit_mode 1031\nchown 0:0 \"$OPT_TMP\" >/dev/null 2>&1 || fail optimization_audit_owner 1032\nmv -f \"$OPT_TMP\" \"$OPT_AUDIT\" || fail optimization_audit_publish 1033\nEP_DATA=$(toybox base64 \"$ENDPOINT\" 2>/dev/null | tr -d '\\r\\n')\n[ -n \"$EP_DATA\" ] || fail endpoint_read 1034\nprintf '__SBH_CH__=%s\\n' \"$CH\"\nprintf '__SBH_CB__=%s\\n' \"$CB\"\nprintf '__SBH_CM__=%s\\n' \"$CM\"\nprintf '__SBH_CI__=%s\\n' \"$CI\"\nprintf '__SBH_CHECK__=%s\\n' \"$CHECK\"\nprintf '__SBH_CPID__=%s\\n' \"$CPID\"\nprintf '__SBH_COUNT__=%s\\n' \"$COUNT\"\nprintf '__SBH_LOOSE__=%s\\n' \"$LOOSE\"\nprintf '__SBH_TUN__=%s\\n' \"$TUN\"\nprintf '__SBH_RULE4__=%s\\n' \"$R4\"\nprintf '__SBH_RULE6__=%s\\n' \"$R6\"\nprintf '__SBH_ROUTE4__=%s\\n' \"$RT4\"\nprintf '__SBH_ROUTE6__=%s\\n' \"$RT6\"\nprintf '__SBH_EP_DATA__=%s\\n' \"$EP_DATA\"\nprintf '__SBH_AUDIT_BYTES__=%s\\n' \"$(stat -c %s \"$OPT_AUDIT\" 2>/dev/null || echo -1)\"\nprintf '__SBH_OK__=1\\n'\nfinish";
    var VERIFY_START_SHELL_TEMPLATE = "umask 077\nCFG=__CONFIG__\nBIN=__BINARY__\nWORK=__WORK__\nSERVER=__SERVER__\nCPID=__CPID__\nEXPECTED_HASH=__EXPECTED_HASH__\nEXPECTED_BYTES=__EXPECTED_BYTES__\nAUDIT=__OP_AUDIT__\nTMP=__OP_TMP__\nAUTH=__AUTH__\nSTATUS_VALUE=__STATUS_VALUE__\nVISIBLE_MS=__VISIBLE_MS__\nrule4_count() {\n    ip -4 rule show 2>/dev/null | awk '$1 ~ /^[0-9]+:$/ {p=$1; sub(/:$/,\"\",p); if (p>=8800 && p<=8815) c++} END{print c+0}'\n}\nrule6_count() {\n    ip -6 rule show 2>/dev/null | awk '$1 ~ /^[0-9]+:$/ {p=$1; sub(/:$/,\"\",p); if (p>=8800 && p<=8815) c++} END{print c+0}'\n}\nroute4_count() {\n    ip -4 route show table 20240 2>/dev/null | awk 'NF{c++} END{print c+0}'\n}\nroute6_count() {\n    ip -6 route show table 20240 2>/dev/null | awk 'NF{c++} END{print c+0}'\n}\nmatch_control() {\n    P=\"$1\"\n    [ -r \"/proc/$P/cmdline\" ] || return 1\n    V=$(tr '\\000' ' ' < \"/proc/$P/cmdline\" 2>/dev/null)\n    case \"$V\" in\n        *\"$SERVER\"*\"$CFG\"*\"$WORK\"*) return 0 ;;\n        *) return 1 ;;\n    esac\n}\ncandidate_fields() {\n    P=\"$1\"\n    X=\"/proc/$P/cmdline\"\n    [ -r \"$X\" ] || return 1\n    ARGS=$(tr '\\000' '\\n' < \"$X\" 2>/dev/null)\n    [ -n \"$ARGS\" ] || return 1\n    A0=$(printf '%s\\n' \"$ARGS\" | sed -n '1p')\n    BIDX=-1\n    CIDX=-1\n    IDX=0\n    while IFS= read -r A; do\n        [ \"$A\" = \"$BIN\" ] && [ \"$BIDX\" = -1 ] && BIDX=$IDX\n        [ \"$A\" = \"$CFG\" ] && [ \"$CIDX\" = -1 ] && CIDX=$IDX\n        IDX=$((IDX + 1))\n    done <<EOA\n$ARGS\nEOA\n    PP=$(awk '/^PPid:/ {print $2; exit}' \"/proc/$P/status\" 2>/dev/null)\n    U=$(awk '/^Uid:/ {print $2; exit}' \"/proc/$P/status\" 2>/dev/null)\n    S=$(awk '/^State:/ {print $2; exit}' \"/proc/$P/status\" 2>/dev/null)\n    return 0\n}\nmatch_loose_core() {\n    P=\"$1\"\n    candidate_fields \"$P\" || return 1\n    [ \"$P\" != \"$CPID\" ] && [ \"$U\" = 0 ] && [ \"$S\" != Z ] &&\n        [ \"$A0\" = \"$BIN\" ] && [ \"$BIDX\" = 0 ] && [ \"$CIDX\" -ge 1 ]\n}\nmatch_core() {\n    P=\"$1\"\n    candidate_fields \"$P\" || return 1\n    [ \"$P\" != \"$CPID\" ] && [ \"$PP\" = \"$CPID\" ] && [ \"$U\" = 0 ] &&\n        [ \"$S\" != Z ] && [ \"$A0\" = \"$BIN\" ] &&\n        [ \"$BIDX\" = 0 ] && [ \"$CIDX\" -ge 1 ]\n}\ncore_snapshot() {\n    COUNT=0\n    LOOSE=0\n    PID=0\n    PICK_PPID=0\n    PICK_UID=-1\n    PICK_STATE=none\n    PICK_ARGC=0\n    PICK_BIDX=-1\n    PICK_CIDX=-1\n    for X in /proc/[0-9]*/cmdline; do\n        [ -r \"$X\" ] || continue\n        P=${X#/proc/}\n        P=${P%/cmdline}\n        if match_loose_core \"$P\"; then\n            LOOSE=$((LOOSE + 1))\n        fi\n        if match_core \"$P\"; then\n            COUNT=$((COUNT + 1))\n            PID=\"$P\"\n            PICK_PPID=\"$PP\"\n            PICK_UID=\"$U\"\n            PICK_STATE=\"$S\"\n            PICK_ARGC=\"$IDX\"\n            PICK_BIDX=\"$BIDX\"\n            PICK_CIDX=\"$CIDX\"\n        fi\n    done\n}\nUIDV=$(id -u 2>/dev/null)\n[ \"$UIDV\" = 0 ] || exit 1041\nCH=$(sha256sum \"$CFG\" 2>/dev/null | awk '{print $1}')\nCB=$(stat -c %s \"$CFG\" 2>/dev/null || echo -1)\n[ \"$CH\" = \"$EXPECTED_HASH\" ] && [ \"$CB\" = \"$EXPECTED_BYTES\" ] || exit 1042\nkill -0 \"$CPID\" 2>/dev/null && match_control \"$CPID\" || exit 1043\nI=0\ncore_snapshot\nwhile [ \"$I\" -lt 4 ] && { [ \"$COUNT\" -ne 1 ] || [ \"$LOOSE\" -ne 1 ]; }; do\n    sleep 1\n    I=$((I + 1))\n    core_snapshot\ndone\n[ \"$COUNT\" = 1 ] && [ \"$LOOSE\" = 1 ] || exit 1044\nFIRST_PID=\"$PID\"\nsleep 1\ncore_snapshot\n[ \"$COUNT\" = 1 ] && [ \"$LOOSE\" = 1 ] && [ \"$PID\" = \"$FIRST_PID\" ] || exit 1045\nCONTROL_ALIVE=0\nif kill -0 \"$CPID\" 2>/dev/null && match_control \"$CPID\"; then\n    CONTROL_ALIVE=1\nfi\n[ \"$CONTROL_ALIVE\" = 1 ] || exit 1046\nTUN=0\n[ -e /sys/class/net/sbh-tun0 ] && TUN=1\nR4=$(rule4_count)\nR6=$(rule6_count)\nRT4=$(route4_count)\nRT6=$(route6_count)\n[ \"$TUN\" = 0 ] && [ \"$R4\" = 0 ] && [ \"$R6\" = 0 ] &&\n    [ \"$RT4\" = 0 ] && [ \"$RT6\" = 0 ] || exit 1047\nTS=$(date +%s 2>/dev/null || echo 0)\nprintf '{\"schemaVersion\":1,\"stage\":57,\"authorizationId\":\"%s\",\"operation\":\"start\",\"runtimePid\":%s,\"corePid\":%s,\"responseStatus\":\"%s\",\"visibleCompletionDurationMs\":%s,\"strictVerified\":true,\"finalCoreState\":\"running\",\"directProcessSignal\":false,\"timestampSeconds\":%s}\\n' \\\n    \"$AUTH\" \"$CPID\" \"$PID\" \"$STATUS_VALUE\" \"$VISIBLE_MS\" \"$TS\" > \"$TMP\" || exit 1048\nchmod 600 \"$TMP\" || exit 1049\nchown 0:0 \"$TMP\" >/dev/null 2>&1 || exit 1050\nmv -f \"$TMP\" \"$AUDIT\" || exit 1051\nprintf '__SBH_VERIFY_DONE__=1\\n'\nprintf '__SBH_PID__=%s\\n' \"$PID\"\nprintf '__SBH_PPID__=%s\\n' \"$PICK_PPID\"\nprintf '__SBH_UIDV__=%s\\n' \"$PICK_UID\"\nprintf '__SBH_STATEV__=%s\\n' \"$PICK_STATE\"\nprintf '__SBH_ARGC__=%s\\n' \"$PICK_ARGC\"\nprintf '__SBH_BIDX__=%s\\n' \"$PICK_BIDX\"\nprintf '__SBH_CIDX__=%s\\n' \"$PICK_CIDX\"\nprintf '__SBH_COUNT__=%s\\n' \"$COUNT\"\nprintf '__SBH_LOOSE__=%s\\n' \"$LOOSE\"\nprintf '__SBH_CONTROL_ALIVE__=%s\\n' \"$CONTROL_ALIVE\"\nprintf '__SBH_TUN__=%s\\n' \"$TUN\"\nprintf '__SBH_RULE4__=%s\\n' \"$R4\"\nprintf '__SBH_RULE6__=%s\\n' \"$R6\"\nprintf '__SBH_ROUTE4__=%s\\n' \"$RT4\"\nprintf '__SBH_ROUTE6__=%s\\n' \"$RT6\"\nprintf '__SBH_AUDIT_BYTES__=%s\\n' \"$(stat -c %s \"$AUDIT\" 2>/dev/null || echo -1)\"\nexit 0";
    var VERIFY_STOP_SHELL_TEMPLATE = "umask 077\nCFG=__CONFIG__\nBIN=__BINARY__\nWORK=__WORK__\nSERVER=__SERVER__\nCPID=__CPID__\nEXPECTED_HASH=__EXPECTED_HASH__\nEXPECTED_BYTES=__EXPECTED_BYTES__\nAUDIT=__OP_AUDIT__\nTMP=__OP_TMP__\nAUTH=__AUTH__\nSTATUS_VALUE=__STATUS_VALUE__\nVISIBLE_MS=__VISIBLE_MS__\nrule4_count() {\n    ip -4 rule show 2>/dev/null | awk '$1 ~ /^[0-9]+:$/ {p=$1; sub(/:$/,\"\",p); if (p>=8800 && p<=8815) c++} END{print c+0}'\n}\nrule6_count() {\n    ip -6 rule show 2>/dev/null | awk '$1 ~ /^[0-9]+:$/ {p=$1; sub(/:$/,\"\",p); if (p>=8800 && p<=8815) c++} END{print c+0}'\n}\nroute4_count() {\n    ip -4 route show table 20240 2>/dev/null | awk 'NF{c++} END{print c+0}'\n}\nroute6_count() {\n    ip -6 route show table 20240 2>/dev/null | awk 'NF{c++} END{print c+0}'\n}\nmatch_control() {\n    P=\"$1\"\n    [ -r \"/proc/$P/cmdline\" ] || return 1\n    V=$(tr '\\000' ' ' < \"/proc/$P/cmdline\" 2>/dev/null)\n    case \"$V\" in\n        *\"$SERVER\"*\"$CFG\"*\"$WORK\"*) return 0 ;;\n        *) return 1 ;;\n    esac\n}\ncandidate_fields() {\n    P=\"$1\"\n    X=\"/proc/$P/cmdline\"\n    [ -r \"$X\" ] || return 1\n    ARGS=$(tr '\\000' '\\n' < \"$X\" 2>/dev/null)\n    [ -n \"$ARGS\" ] || return 1\n    A0=$(printf '%s\\n' \"$ARGS\" | sed -n '1p')\n    BIDX=-1\n    CIDX=-1\n    IDX=0\n    while IFS= read -r A; do\n        [ \"$A\" = \"$BIN\" ] && [ \"$BIDX\" = -1 ] && BIDX=$IDX\n        [ \"$A\" = \"$CFG\" ] && [ \"$CIDX\" = -1 ] && CIDX=$IDX\n        IDX=$((IDX + 1))\n    done <<EOA\n$ARGS\nEOA\n    PP=$(awk '/^PPid:/ {print $2; exit}' \"/proc/$P/status\" 2>/dev/null)\n    U=$(awk '/^Uid:/ {print $2; exit}' \"/proc/$P/status\" 2>/dev/null)\n    S=$(awk '/^State:/ {print $2; exit}' \"/proc/$P/status\" 2>/dev/null)\n    return 0\n}\nmatch_loose_core() {\n    P=\"$1\"\n    candidate_fields \"$P\" || return 1\n    [ \"$P\" != \"$CPID\" ] && [ \"$U\" = 0 ] && [ \"$S\" != Z ] &&\n        [ \"$A0\" = \"$BIN\" ] && [ \"$BIDX\" = 0 ] && [ \"$CIDX\" -ge 1 ]\n}\nmatch_core() {\n    P=\"$1\"\n    candidate_fields \"$P\" || return 1\n    [ \"$P\" != \"$CPID\" ] && [ \"$PP\" = \"$CPID\" ] && [ \"$U\" = 0 ] &&\n        [ \"$S\" != Z ] && [ \"$A0\" = \"$BIN\" ] &&\n        [ \"$BIDX\" = 0 ] && [ \"$CIDX\" -ge 1 ]\n}\ncore_snapshot() {\n    COUNT=0\n    LOOSE=0\n    PID=0\n    for X in /proc/[0-9]*/cmdline; do\n        [ -r \"$X\" ] || continue\n        P=${X#/proc/}\n        P=${P%/cmdline}\n        if match_loose_core \"$P\"; then\n            LOOSE=$((LOOSE + 1))\n        fi\n        if match_core \"$P\"; then\n            COUNT=$((COUNT + 1))\n            PID=\"$P\"\n        fi\n    done\n}\nUIDV=$(id -u 2>/dev/null)\n[ \"$UIDV\" = 0 ] || exit 1061\nCH=$(sha256sum \"$CFG\" 2>/dev/null | awk '{print $1}')\nCB=$(stat -c %s \"$CFG\" 2>/dev/null || echo -1)\n[ \"$CH\" = \"$EXPECTED_HASH\" ] && [ \"$CB\" = \"$EXPECTED_BYTES\" ] || exit 1062\nkill -0 \"$CPID\" 2>/dev/null && match_control \"$CPID\" || exit 1063\nI=0\ncore_snapshot\nwhile [ \"$I\" -lt 4 ] && { [ \"$COUNT\" -ne 0 ] || [ \"$LOOSE\" -ne 0 ]; }; do\n    sleep 1\n    I=$((I + 1))\n    core_snapshot\ndone\n[ \"$COUNT\" = 0 ] && [ \"$LOOSE\" = 0 ] || exit 1064\nCONTROL_ALIVE=0\nif kill -0 \"$CPID\" 2>/dev/null && match_control \"$CPID\"; then\n    CONTROL_ALIVE=1\nfi\n[ \"$CONTROL_ALIVE\" = 1 ] || exit 1065\nTUN=0\n[ -e /sys/class/net/sbh-tun0 ] && TUN=1\nR4=$(rule4_count)\nR6=$(rule6_count)\nRT4=$(route4_count)\nRT6=$(route6_count)\n[ \"$TUN\" = 0 ] && [ \"$R4\" = 0 ] && [ \"$R6\" = 0 ] &&\n    [ \"$RT4\" = 0 ] && [ \"$RT6\" = 0 ] || exit 1066\nTS=$(date +%s 2>/dev/null || echo 0)\nprintf '{\"schemaVersion\":1,\"stage\":57,\"authorizationId\":\"%s\",\"operation\":\"stop\",\"runtimePid\":%s,\"corePid\":0,\"responseStatus\":\"%s\",\"visibleCompletionDurationMs\":%s,\"strictVerified\":true,\"finalCoreState\":\"stopped\",\"directProcessSignal\":false,\"timestampSeconds\":%s}\\n' \\\n    \"$AUTH\" \"$CPID\" \"$STATUS_VALUE\" \"$VISIBLE_MS\" \"$TS\" > \"$TMP\" || exit 1067\nchmod 600 \"$TMP\" || exit 1068\nchown 0:0 \"$TMP\" >/dev/null 2>&1 || exit 1069\nmv -f \"$TMP\" \"$AUDIT\" || exit 1070\nprintf '__SBH_VERIFY_DONE__=1\\n'\nprintf '__SBH_COUNT__=%s\\n' \"$COUNT\"\nprintf '__SBH_LOOSE__=%s\\n' \"$LOOSE\"\nprintf '__SBH_CONTROL_ALIVE__=%s\\n' \"$CONTROL_ALIVE\"\nprintf '__SBH_TUN__=%s\\n' \"$TUN\"\nprintf '__SBH_RULE4__=%s\\n' \"$R4\"\nprintf '__SBH_RULE6__=%s\\n' \"$R6\"\nprintf '__SBH_ROUTE4__=%s\\n' \"$RT4\"\nprintf '__SBH_ROUTE6__=%s\\n' \"$RT6\"\nprintf '__SBH_AUDIT_BYTES__=%s\\n' \"$(stat -c %s \"$AUDIT\" 2>/dev/null || echo -1)\"\nexit 0";

    function now() {
        return Number(P.java.lang.System.currentTimeMillis());
    }

    function quote(value) {
        return "'" + String(value).replace(/'/g, "'\\''") + "'";
    }

    function fillTemplate(template, values) {
        var output = String(template);
        var key;
        for (key in values) {
            if (values.hasOwnProperty(key)) {
                output = output.split(key).join(quote(values[key]));
            }
        }
        return output;
    }

    function contextValue(data, key) {
        var value = data.get(String(key));
        return value === null || value === undefined ?
            "" : String(value);
    }

    function marker(raw, name) {
        var lines = String(raw || "").split(/\r?\n/);
        var prefix = "__SBH_" + String(name) + "__=";
        var index;
        var line;

        for (index = lines.length - 1; index >= 0; index -= 1) {
            line = String(lines[index]);
            if (line.indexOf(prefix) === 0) {
                return line.substring(prefix.length);
            }
        }
        return null;
    }

    function yes(raw, name) {
        return marker(raw, name) === "1";
    }

    function numberValue(raw, name) {
        var value = marker(raw, name);
        var parsed = Number(value);
        return value !== null && isFinite(parsed) ? parsed : null;
    }

    function executeShell(command, purpose) {
        var startedAt = now();
        var action = ShellCommand.newBuilder()
            .setCommand(String(command))
            .setSingleShot(true)
            .setId(
                "SingBoxHub#Stage57#" + String(purpose) + "#" +
                String(SBH.util.randomToken())
            )
            .build();
        var result = shortx.executeAction(action);
        var data = result.contextData;
        var stdout = contextValue(data, "shellOut");
        var stderr = contextValue(data, "shellErr");

        return {
            code: Number(data.get("shellCode")),
            output: stdout + (stderr ? "\n" + stderr : ""),
            durationMs: now() - startedAt
        };
    }

    function runtimeRoot() {
        return String(shortx.getShortXDir()) + "/SingBoxHub";
    }

    function closeQuietly(value) {
        try {
            if (value !== null && value !== undefined) {
                value.close();
                return true;
            }
        } catch (ignored) {}
        return false;
    }

    function randomHex(byteCount) {
        var random = new SecureRandom();
        var bytes = ReflectArray.newInstance(JavaByte.TYPE, byteCount);
        var output = [];
        var index;
        var value;
        var part;

        random.nextBytes(bytes);
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

    function decodeEndpoint(value) {
        var bytes = null;
        var text = null;
        try {
            bytes = Base64.decode(String(value), Base64.DEFAULT);
            text = String(new JavaString(bytes, "UTF-8"));
            return JSON.parse(text);
        } catch (error) {
            throw new Error("ENDPOINT_JSON_PARSE_FAILED");
        } finally {
            bytes = null;
            text = null;
        }
    }

    function errorCode(error) {
        var text;
        var match;
        try {
            text = String(SBH.util.errorText(error));
        } catch (ignored) {
            text = String(error);
        }
        match = text.match(/[A-Z][A-Z0-9_]{3,}/);
        return match ? String(match[0]) :
            "LOW_LATENCY_LIFECYCLE_OPERATION_FAILED";
    }

    function errorText(error) {
        try {
            return String(SBH.util.errorText(error));
        } catch (ignored) {
            return String(error);
        }
    }

    function safeStatus(value) {
        value = String(value || "");
        value = value.replace(/[^A-Za-z0-9_.:-]/g, "_");
        return value.substring(0, 64);
    }

    function statusRejected(value) {
        var text = String(value || "").toUpperCase();
        return !text ||
            /ERROR|FAILED|FAILURE|INVALID|DENIED|UNAUTHORIZED|UNKNOWN_COMMAND/.test(text);
    }

    function statusRunning(value) {
        value = String(value || "").toUpperCase();
        return value === "RUNNING" || value === "ALREADY_RUNNING";
    }

    function statusStopped(value) {
        value = String(value || "").toUpperCase();
        return value === "STOPPED" || value === "ALREADY_STOPPED";
    }

    function pathSet() {
        var root = runtimeRoot();
        return {
            root: root,
            configDir: root + "/config",
            config: root + "/config/runtime-tun.json",
            binary: root + "/bin/sing-box",
            state: root + "/state",
            runtimeJar:
                root + "/runtime/core/SingBoxHubCoreRuntime.jar",
            work: root + "/runtime/core/work",
            control: root + "/runtime/control",
            endpoint:
                root + "/runtime/control/control_endpoint.json",
            unlockAudit:
                root + "/state/production-lifecycle-write-unlock.json",
            optimizationAudit:
                root + "/state/production-lifecycle-low-latency.json",
            optimizationAuditTemp:
                root + "/state/.production-lifecycle-low-latency-" +
                randomHex(8) + ".tmp",
            operationAudit:
                root + "/state/production-lifecycle-last-operation.json",
            operationAuditTemp:
                root + "/state/.production-lifecycle-last-operation-" +
                randomHex(8) + ".tmp"
        };
    }

    function validateEndpoint(endpoint, paths, expectedPid) {
        if (!endpoint || Number(endpoint.schemaVersion) !== 1) {
            throw new Error("ENDPOINT_SCHEMA_INVALID");
        }
        if (Number(endpoint.runtimePid) !== Number(expectedPid) ||
                Number(endpoint.runtimePid) <= 1) {
            throw new Error("ENDPOINT_RUNTIME_PID_INVALID");
        }
        if (String(endpoint.serverClass || "") !== SERVER_CLASS ||
                String(endpoint.clientClass || "") !== CLIENT_CLASS) {
            throw new Error("ENDPOINT_CLASS_CONTRACT_INVALID");
        }
        if (String(endpoint.runtimeJar || "") !== paths.runtimeJar ||
                String(endpoint.binaryPath || "") !== paths.binary ||
                String(endpoint.configPath || "") !== paths.config ||
                String(endpoint.workingDirectory || "") !== paths.work) {
            throw new Error("ENDPOINT_PATH_CONTRACT_INVALID");
        }
        if (!endpoint.socketName ||
                String(endpoint.socketName).length > 128 ||
                /[\r\n\u0000]/.test(String(endpoint.socketName))) {
            throw new Error("ENDPOINT_SOCKET_NAME_INVALID");
        }
        if (!endpoint.token ||
                String(endpoint.token).length < 16 ||
                String(endpoint.token).length > 256 ||
                /[\r\n\u0000]/.test(String(endpoint.token))) {
            throw new Error("ENDPOINT_TOKEN_INVALID");
        }
        return endpoint;
    }

    function sendCommand(endpoint, command) {
        var startedAt = now();
        var socket = null;
        var writer = null;
        var reader = null;
        var correlation =
            "sbh57-" + startedAt + "-" + randomHex(12);
        var statusLine = null;
        var correlationLine = null;

        try {
            socket = new LocalSocket();
            socket.connect(
                new LocalSocketAddress(
                    String(endpoint.socketName),
                    LocalSocketAddress.Namespace.ABSTRACT
                )
            );
            socket.setSoTimeout(SOCKET_READ_TIMEOUT_MS);
            writer = new BufferedWriter(
                new OutputStreamWriter(
                    socket.getOutputStream(),
                    "UTF-8"
                )
            );
            writer.write(String(endpoint.token));
            writer.newLine();
            writer.write(correlation);
            writer.newLine();
            writer.write(String(command));
            writer.newLine();
            writer.flush();
            reader = new BufferedReader(
                new InputStreamReader(
                    socket.getInputStream(),
                    "UTF-8"
                )
            );
            statusLine = reader.readLine();
            correlationLine = reader.readLine();
            if (String(correlationLine || "") !== correlation) {
                throw new Error(
                    String(command) + "_CORRELATION_ECHO_MISMATCH"
                );
            }
            if (statusRejected(statusLine)) {
                throw new Error(
                    String(command) + "_RESPONSE_REJECTED_" +
                    safeStatus(statusLine)
                );
            }
            return {
                responseStatus: safeStatus(statusLine),
                correlationMatched: true,
                requestCount: 1,
                durationMs: now() - startedAt
            };
        } finally {
            closeQuietly(reader);
            closeQuietly(writer);
            closeQuietly(socket);
            correlation = null;
            statusLine = null;
            correlationLine = null;
        }
    }

    function pollStatus(endpoint, expectedState) {
        var startedAt = now();
        var attempts = 0;
        var response = null;
        var matched = false;

        while (now() - startedAt <=
                STATUS_CONVERGENCE_TIMEOUT_MS) {
            response = sendCommand(endpoint, "STATUS");
            attempts += 1;
            if (expectedState === "running") {
                matched = statusRunning(
                    response.responseStatus
                );
            } else {
                matched = statusStopped(
                    response.responseStatus
                );
            }
            if (matched) {
                break;
            }
            Thread.sleep(STATUS_POLL_INTERVAL_MS);
        }
        return {
            matched: matched,
            responseStatus:
                response === null ?
                    null : response.responseStatus,
            requestCount: attempts,
            durationMs: now() - startedAt
        };
    }

    function activationCommand(paths) {
        return fillTemplate(
            ACTIVATION_SHELL_TEMPLATE,
            {
                "__ROOT__": paths.root,
                "__CONFIG_DIR__": paths.configDir,
                "__CONFIG__": paths.config,
                "__BINARY__": paths.binary,
                "__STATE__": paths.state,
                "__RUNTIME_JAR__": paths.runtimeJar,
                "__WORK__": paths.work,
                "__CONTROL__": paths.control,
                "__ENDPOINT__": paths.endpoint,
                "__UNLOCK_AUDIT__": paths.unlockAudit,
                "__OPT_AUDIT__": paths.optimizationAudit,
                "__OPT_TMP__": paths.optimizationAuditTemp,
                "__SERVER__": SERVER_CLASS,
                "__SOURCE_AUTH__":
                    SOURCE_WRITE_UNLOCK_AUTHORIZATION_ID,
                "__AUTH__": AUTHORIZATION_ID
            }
        );
    }

    function verificationCommand(
        operation,
        operationContext
    ) {
        var paths = baseline.paths;
        var template =
            operation === "start" ?
                VERIFY_START_SHELL_TEMPLATE :
                VERIFY_STOP_SHELL_TEMPLATE;

        return fillTemplate(
            template,
            {
                "__CONFIG__": paths.config,
                "__BINARY__": paths.binary,
                "__WORK__": paths.work,
                "__SERVER__": SERVER_CLASS,
                "__CPID__":
                    String(baseline.controlServicePid),
                "__EXPECTED_HASH__":
                    baseline.productionConfigSha256,
                "__EXPECTED_BYTES__":
                    String(
                        baseline.productionConfigByteCount
                    ),
                "__OP_AUDIT__":
                    paths.operationAudit,
                "__OP_TMP__":
                    paths.operationAuditTemp,
                "__AUTH__": AUTHORIZATION_ID,
                "__STATUS_VALUE__":
                    operationContext.responseStatus,
                "__VISIBLE_MS__":
                    String(
                        operationContext
                            .visibleCompletionDurationMs
                    )
            }
        );
    }

    function activateInternal() {
        var startedAt = now();
        var paths = pathSet();
        var shell = executeShell(
            activationCommand(paths),
            "activation"
        );
        var endpointData;
        var endpoint;
        var status;

        if (!yes(shell.output, "DONE") ||
                !yes(shell.output, "OK")) {
            throw new Error(
                marker(shell.output, "GATE") ||
                "LOW_LATENCY_ACTIVATION_FAILED"
            );
        }
        endpointData = marker(
            shell.output,
            "EP_DATA"
        );
        endpoint = validateEndpoint(
            decodeEndpoint(endpointData),
            paths,
            numberValue(shell.output, "CPID")
        );
        status = sendCommand(endpoint, "STATUS");
        if (!statusStopped(status.responseStatus)) {
            throw new Error(
                "LOW_LATENCY_ACTIVATION_REQUIRES_STOPPED"
            );
        }

        baseline = {
            paths: paths,
            endpoint: endpoint,
            controlServicePid:
                numberValue(shell.output, "CPID"),
            productionConfigSha256:
                marker(shell.output, "CH"),
            productionConfigByteCount:
                numberValue(shell.output, "CB"),
            productionConfigMtime:
                numberValue(shell.output, "CM"),
            productionConfigInode:
                numberValue(shell.output, "CI"),
            activatedAt: now()
        };
        activated = true;
        lastOperation = "activate";
        lastSnapshot = {
            ok: true,
            state: "stopped",
            runtimeStatus: status.responseStatus,
            controlServicePid:
                baseline.controlServicePid,
            controllerOwnedCoreCount: 0,
            looseCoreCandidateCount: 0,
            corePid: null,
            strictVerified: true,
            verificationPending: false,
            productionConfigSha256:
                baseline.productionConfigSha256,
            productionConfigByteCount:
                baseline.productionConfigByteCount,
            tunInterfacePresent: false,
            reservedNetworkResourcesUnchanged: true,
            timestamp: now()
        };
        lastResult = {
            ok: true,
            stage:
                "production_stage57_runtime_production_lifecycle_low_latency_activation",
            authorizationId: AUTHORIZATION_ID,
            sourceWriteUnlockAuthorizationId:
                SOURCE_WRITE_UNLOCK_AUTHORIZATION_ID,
            authorizationConsumed: true,
            automaticRetryAllowed: false,
            manualOnly: true,
            preflightPassed: true,
            shellUid:
                numberValue(shell.output, "UID"),
            productionConfigCheckPassed:
                numberValue(shell.output, "CHECK") === 0,
            controlServicePid:
                baseline.controlServicePid,
            currentRuntimeStatus:
                status.responseStatus,
            currentCoreState: "stopped",
            currentControllerOwnedCoreCount: 0,
            currentLooseCoreCandidateCount: 0,
            lowLatencyControlEnabled: true,
            visiblePathShellCalls: 0,
            strictBackgroundShellCallsPerWrite: 1,
            statusControlUsesLocalSocketOnly: true,
            startVisiblePathUsesLocalSocketOnly: true,
            stopVisiblePathUsesLocalSocketOnly: true,
            directProcessSignalEnabled: false,
            optimizationAuditCreated: true,
            optimizationAuditRelativePath:
                "state/production-lifecycle-low-latency.json",
            optimizationAuditByteCount:
                numberValue(
                    shell.output,
                    "AUDIT_BYTES"
                ),
            activationShellDurationMs:
                shell.durationMs,
            activationStatusDurationMs:
                status.durationMs,
            activationTotalDurationMs:
                now() - startedAt,
            shellCode: shell.code,
            shellCodeAuthoritative: false,
            shellTransportCodeAnomalous:
                shell.code !== 0,
            readyForLowLatencyManualControlTest:
                true,
            nextAuthorizedOperation:
                "runtime_low_latency_manual_control_performance_acceptance",
            snapshot: lastSnapshot,
            timestamp: now()
        };
        return lastResult;
    }

    function quickStatusInternal() {
        var startedAt = now();
        var status;
        var state;

        if (!activated || baseline === null) {
            throw new Error(
                "LOW_LATENCY_CONTROL_NOT_ACTIVATED"
            );
        }
        status = sendCommand(
            baseline.endpoint,
            "STATUS"
        );
        if (statusRunning(status.responseStatus)) {
            state = "running";
        } else if (statusStopped(status.responseStatus)) {
            state = "stopped";
        } else {
            throw new Error("STATUS_STATE_UNKNOWN");
        }
        if (lastSnapshot === null) {
            lastSnapshot = {};
        }
        lastSnapshot.ok = true;
        lastSnapshot.state = state;
        lastSnapshot.runtimeStatus =
            status.responseStatus;
        lastSnapshot.controlServicePid =
            baseline.controlServicePid;
        lastSnapshot.controllerOwnedCoreCount =
            state === "running" ?
                (lastSnapshot.corePid ? 1 : null) : 0;
        lastSnapshot.looseCoreCandidateCount =
            state === "running" ?
                (lastSnapshot.corePid ? 1 : null) : 0;
        if (state === "stopped") {
            lastSnapshot.corePid = null;
            lastSnapshot.strictVerified = true;
        }
        lastSnapshot.verificationPending =
            verificationPending;
        lastSnapshot.productionConfigSha256 =
            baseline.productionConfigSha256;
        lastSnapshot.productionConfigByteCount =
            baseline.productionConfigByteCount;
        lastSnapshot.timestamp = now();
        lastOperation = "status";
        lastResult = {
            ok: true,
            operation: "status",
            stage:
                "production_stage57_runtime_low_latency_manual_control",
            responseStatus:
                status.responseStatus,
            correlationMatched: true,
            requestCount: 1,
            commandDurationMs:
                status.durationMs,
            visibleCompletionDurationMs:
                now() - startedAt,
            visiblePathShellCalls: 0,
            strictVerificationScheduled: false,
            snapshot: lastSnapshot,
            timestamp: now()
        };
        return lastResult;
    }

    function quickStartInternal() {
        var startedAt = now();
        var commandStartedAt;
        var command;
        var convergence;
        var visibleMs;

        if (!activated || baseline === null) {
            throw new Error(
                "LOW_LATENCY_CONTROL_NOT_ACTIVATED"
            );
        }
        if (verificationPending) {
            throw new Error(
                "STRICT_VERIFICATION_PENDING"
            );
        }
        if (lastSnapshot === null ||
                lastSnapshot.state !== "stopped") {
            throw new Error(
                "START_REQUIRES_STOPPED_STATE"
            );
        }

        commandStartedAt = now();
        command = sendCommand(
            baseline.endpoint,
            "START"
        );
        if (String(command.responseStatus) !==
                "STARTED") {
            throw new Error(
                "START_RESPONSE_NOT_STARTED_" +
                command.responseStatus
            );
        }
        convergence = pollStatus(
            baseline.endpoint,
            "running"
        );
        if (!convergence.matched) {
            throw new Error(
                "START_STATUS_CONVERGENCE_TIMEOUT"
            );
        }
        visibleMs = now() - startedAt;
        generation += 1;
        verificationPending = true;
        lastOperation = "start";
        lastSnapshot = {
            ok: true,
            state: "running",
            runtimeStatus:
                convergence.responseStatus,
            controlServicePid:
                baseline.controlServicePid,
            controllerOwnedCoreCount: null,
            looseCoreCandidateCount: null,
            corePid: null,
            strictVerified: false,
            verificationPending: true,
            productionConfigSha256:
                baseline.productionConfigSha256,
            productionConfigByteCount:
                baseline.productionConfigByteCount,
            tunInterfacePresent: false,
            reservedNetworkResourcesUnchanged:
                null,
            timestamp: now()
        };
        lastResult = {
            ok: true,
            operation: "start",
            phase: "visible_complete",
            stage:
                "production_stage57_runtime_low_latency_manual_control",
            authorizationId: AUTHORIZATION_ID,
            commandSent: true,
            requestCount: 1,
            responseStatus:
                command.responseStatus,
            correlationMatched: true,
            statusPollRequestCount:
                convergence.requestCount,
            finalRuntimeStatus:
                convergence.responseStatus,
            finalCoreState: "running_unverified",
            commandDurationMs:
                command.durationMs,
            statusConvergenceMs:
                convergence.durationMs,
            visibleCompletionDurationMs:
                visibleMs,
            visiblePathShellCalls: 0,
            strictVerificationScheduled: true,
            strictBackgroundShellCallsPlanned: 1,
            generation: generation,
            snapshot: lastSnapshot,
            timestamp: now()
        };
        return lastResult;
    }

    function quickStopInternal() {
        var startedAt = now();
        var command;
        var convergence;
        var visibleMs;
        var selectedPid =
            lastSnapshot === null ?
                null : lastSnapshot.corePid;

        if (!activated || baseline === null) {
            throw new Error(
                "LOW_LATENCY_CONTROL_NOT_ACTIVATED"
            );
        }
        if (verificationPending) {
            throw new Error(
                "STRICT_VERIFICATION_PENDING"
            );
        }
        if (lastSnapshot === null ||
                lastSnapshot.state !== "running") {
            throw new Error(
                "STOP_REQUIRES_RUNNING_STATE"
            );
        }

        command = sendCommand(
            baseline.endpoint,
            "STOP_CORE"
        );
        if (!statusStopped(command.responseStatus)) {
            throw new Error(
                "STOP_RESPONSE_NOT_STOPPED_" +
                command.responseStatus
            );
        }
        convergence = pollStatus(
            baseline.endpoint,
            "stopped"
        );
        if (!convergence.matched) {
            throw new Error(
                "STOP_STATUS_CONVERGENCE_TIMEOUT"
            );
        }
        visibleMs = now() - startedAt;
        generation += 1;
        verificationPending = true;
        lastOperation = "stop";
        lastSnapshot = {
            ok: true,
            state: "stopped",
            runtimeStatus:
                convergence.responseStatus,
            controlServicePid:
                baseline.controlServicePid,
            controllerOwnedCoreCount: null,
            looseCoreCandidateCount: null,
            corePid: null,
            selectedCorePid: selectedPid,
            strictVerified: false,
            verificationPending: true,
            productionConfigSha256:
                baseline.productionConfigSha256,
            productionConfigByteCount:
                baseline.productionConfigByteCount,
            tunInterfacePresent: false,
            reservedNetworkResourcesUnchanged:
                null,
            timestamp: now()
        };
        lastResult = {
            ok: true,
            operation: "stop",
            phase: "visible_complete",
            stage:
                "production_stage57_runtime_low_latency_manual_control",
            authorizationId: AUTHORIZATION_ID,
            commandSent: true,
            requestCount: 1,
            responseStatus:
                command.responseStatus,
            correlationMatched: true,
            selectedCorePid: selectedPid,
            statusPollRequestCount:
                convergence.requestCount,
            finalRuntimeStatus:
                convergence.responseStatus,
            finalCoreState: "stopped_unverified",
            commandDurationMs:
                command.durationMs,
            statusConvergenceMs:
                convergence.durationMs,
            visibleCompletionDurationMs:
                visibleMs,
            visiblePathShellCalls: 0,
            strictVerificationScheduled: true,
            strictBackgroundShellCallsPlanned: 1,
            generation: generation,
            snapshot: lastSnapshot,
            timestamp: now()
        };
        return lastResult;
    }

    function strictVerifyInternal(
        operation,
        operationContext
    ) {
        var startedAt = now();
        var shell = executeShell(
            verificationCommand(
                operation,
                operationContext
            ),
            operation + "-strict-verify"
        );
        var result;

        if (!yes(shell.output, "VERIFY_DONE")) {
            throw new Error(
                operation.toUpperCase() +
                "_STRICT_VERIFICATION_FAILED"
            );
        }
        if (operation === "start") {
            lastSnapshot = {
                ok: true,
                state: "running",
                runtimeStatus:
                    operationContext.responseStatus,
                controlServicePid:
                    baseline.controlServicePid,
                controllerOwnedCoreCount:
                    numberValue(
                        shell.output,
                        "COUNT"
                    ),
                looseCoreCandidateCount:
                    numberValue(
                        shell.output,
                        "LOOSE"
                    ),
                corePid:
                    numberValue(
                        shell.output,
                        "PID"
                    ),
                coreParentPid:
                    numberValue(
                        shell.output,
                        "PPID"
                    ),
                coreOwnerUid:
                    numberValue(
                        shell.output,
                        "UIDV"
                    ),
                coreProcessState:
                    marker(
                        shell.output,
                        "STATEV"
                    ),
                coreArgumentCount:
                    numberValue(
                        shell.output,
                        "ARGC"
                    ),
                coreBinaryArgumentIndex:
                    numberValue(
                        shell.output,
                        "BIDX"
                    ),
                coreConfigArgumentIndex:
                    numberValue(
                        shell.output,
                        "CIDX"
                    ),
                strictVerified: true,
                verificationPending: false,
                productionConfigSha256:
                    baseline.productionConfigSha256,
                productionConfigByteCount:
                    baseline.productionConfigByteCount,
                tunInterfacePresent: false,
                reservedNetworkResourcesUnchanged:
                    true,
                timestamp: now()
            };
        } else {
            lastSnapshot = {
                ok: true,
                state: "stopped",
                runtimeStatus:
                    operationContext.responseStatus,
                controlServicePid:
                    baseline.controlServicePid,
                controllerOwnedCoreCount: 0,
                looseCoreCandidateCount: 0,
                corePid: null,
                strictVerified: true,
                verificationPending: false,
                productionConfigSha256:
                    baseline.productionConfigSha256,
                productionConfigByteCount:
                    baseline.productionConfigByteCount,
                tunInterfacePresent: false,
                reservedNetworkResourcesUnchanged:
                    true,
                timestamp: now()
            };
        }
        verificationPending = false;
        result = {
            ok: true,
            operation: operation,
            phase: "strict_verified",
            stage:
                "production_stage57_runtime_low_latency_manual_control",
            authorizationId: AUTHORIZATION_ID,
            visibleCompletionDurationMs:
                operationContext
                    .visibleCompletionDurationMs,
            strictVerificationDurationMs:
                shell.durationMs,
            totalDurationMs:
                now() -
                operationContext.operationStartedAt,
            visiblePathShellCalls: 0,
            strictBackgroundShellCalls: 1,
            strictVerificationPassed: true,
            operationAuditCreated: true,
            operationAuditRelativePath:
                "state/production-lifecycle-last-operation.json",
            operationAuditByteCount:
                numberValue(
                    shell.output,
                    "AUDIT_BYTES"
                ),
            corePid:
                operation === "start" ?
                    numberValue(
                        shell.output,
                        "PID"
                    ) : null,
            finalCoreState:
                operation === "start" ?
                    "running" : "stopped",
            controlServiceRemainsRunning:
                yes(
                    shell.output,
                    "CONTROL_ALIVE"
                ),
            reservedNetworkResourcesUnchanged:
                true,
            shellCode: shell.code,
            shellCodeAuthoritative: false,
            shellTransportCodeAnomalous:
                shell.code !== 0,
            snapshot: lastSnapshot,
            performanceTargetVisibleUnderFiveSeconds:
                operationContext
                    .visibleCompletionDurationMs <= 5000,
            readyForLowLatencyPerformanceAcceptance:
                true,
            nextAuthorizedOperation:
                "runtime_low_latency_manual_control_performance_acceptance",
            timestamp: now()
        };
        lastResult = result;
        return result;
    }

    function strictFailureResult(
        operation,
        operationContext,
        error
    ) {
        var rollback = null;
        var convergence = null;
        var rollbackOk = false;

        if (operation === "start" &&
                baseline !== null) {
            try {
                rollback = sendCommand(
                    baseline.endpoint,
                    "STOP_CORE"
                );
                convergence = pollStatus(
                    baseline.endpoint,
                    "stopped"
                );
                rollbackOk =
                    statusStopped(
                        rollback.responseStatus
                    ) &&
                    convergence.matched;
            } catch (ignoredRollback) {
                rollbackOk = false;
            }
        }
        activated = false;
        verificationPending = false;
        lastSnapshot = {
            ok: false,
            state:
                rollbackOk ?
                    "stopped" : "unknown",
            runtimeStatus:
                convergence === null ?
                    null :
                    convergence.responseStatus,
            controlServicePid:
                baseline === null ?
                    null :
                    baseline.controlServicePid,
            controllerOwnedCoreCount: null,
            looseCoreCandidateCount: null,
            corePid: null,
            strictVerified: false,
            verificationPending: false,
            controlsLockedAfterVerificationFailure:
                true,
            timestamp: now()
        };
        lastResult = {
            ok: false,
            operation: operation,
            phase: "strict_verification_failed",
            stage:
                "production_stage57_runtime_low_latency_manual_control",
            errorCode: errorCode(error),
            error:
                errorText(error).substring(
                    0,
                    256
                ),
            visibleCompletionDurationMs:
                operationContext
                    .visibleCompletionDurationMs,
            totalDurationMs:
                now() -
                operationContext.operationStartedAt,
            strictVerificationPassed: false,
            controlsLocked: true,
            rollbackInvoked:
                operation === "start",
            rollbackCommandStatus:
                rollback === null ?
                    null :
                    rollback.responseStatus,
            rollbackStatusConverged:
                rollbackOk,
            directProcessSignalSent: false,
            snapshot: lastSnapshot,
            nextAuthorizedOperation:
                "rerun_stage57_low_latency_activation",
            timestamp: now()
        };
        return lastResult;
    }

    function post(callback, value) {
        SBH.handler.post(
            new JavaAdapter(Runnable, {
                run: function () {
                    callback(value);
                }
            })
        );
    }

    function runAsync(
        operation,
        visibleCallback,
        verificationCallback
    ) {
        if (busy) {
            visibleCallback({
                ok: false,
                errorCode:
                    "STAGE57_OPERATION_ALREADY_RUNNING",
                timestamp: now()
            });
            return;
        }
        if (verificationPending) {
            visibleCallback({
                ok: false,
                errorCode:
                    "STAGE57_STRICT_VERIFICATION_PENDING",
                timestamp: now()
            });
            return;
        }

        busy = true;
        new Thread(
            new JavaAdapter(Runnable, {
                run: function () {
                    var result;
                    var context;
                    try {
                        if (operation === "activate") {
                            result = activateInternal();
                        } else if (operation === "status") {
                            result = quickStatusInternal();
                        } else if (operation === "start") {
                            result = quickStartInternal();
                        } else if (operation === "stop") {
                            result = quickStopInternal();
                        } else {
                            throw new Error(
                                "UNKNOWN_OPERATION"
                            );
                        }
                    } catch (error) {
                        result = {
                            ok: false,
                            operation: operation,
                            errorCode:
                                errorCode(error),
                            error:
                                errorText(error)
                                    .substring(
                                        0,
                                        256
                                    ),
                            timestamp: now()
                        };
                    }
                    busy = false;
                    post(visibleCallback, result);

                    if (result.ok === true &&
                            (operation === "start" ||
                            operation === "stop")) {
                        context = {
                            operationStartedAt:
                                result.timestamp -
                                result
                                    .visibleCompletionDurationMs,
                            visibleCompletionDurationMs:
                                result
                                    .visibleCompletionDurationMs,
                            responseStatus:
                                result.responseStatus,
                            generation:
                                result.generation
                        };
                        new Thread(
                            new JavaAdapter(
                                Runnable,
                                {
                                    run: function () {
                                        var verifyResult;
                                        try {
                                            verifyResult =
                                                strictVerifyInternal(
                                                    operation,
                                                    context
                                                );
                                        } catch (
                                            verifyError
                                        ) {
                                            verifyResult =
                                                strictFailureResult(
                                                    operation,
                                                    context,
                                                    verifyError
                                                );
                                        }
                                        if (typeof
                                                verificationCallback ===
                                                "function") {
                                            post(
                                                verificationCallback,
                                                verifyResult
                                            );
                                        }
                                    }
                                }
                            ),
                            "SingBoxHub-Stage57-" +
                            operation +
                            "-StrictVerification"
                        ).start();
                    }
                }
            }),
            "SingBoxHub-Stage57-" +
            operation +
            "-VisiblePath"
        ).start();
    }

    function infoLine(
        iconName,
        title,
        value,
        accent
    ) {
        var row = W.row();
        row.setPadding(
            0,
            SBH.util.dp(7),
            0,
            SBH.util.dp(7)
        );
        row.addView(
            W.icon(
                iconName,
                24,
                C.secondary
            )
        );
        row.addView(
            W.text(
                title,
                12.5,
                C.secondary,
                false
            ),
            W.lp(0, W.WRAP, 1)
        );
        row.addView(
            W.text(
                value,
                13,
                accent || C.text,
                true
            )
        );
        return row;
    }

    function showHome(controller) {
        try {
            controller.showPage(0);
        } catch (ignored) {}
    }

    function performUiOperation(
        controller,
        operation
    ) {
        var label =
            operation === "start" ?
                "启动" :
                operation === "stop" ?
                    "停止" : "刷新";

        if (busy) {
            SBH.util.toast(
                "低延迟操作正在执行"
            );
            return;
        }
        if (verificationPending) {
            SBH.util.toast(
                "后台严格核验尚未完成"
            );
            return;
        }
        if (!activated) {
            SBH.util.toast(
                "请先在节点页启用低延迟控制"
            );
            return;
        }

        SBH.util.toast(
            "正在快速" + label
        );
        runAsync(
            operation,
            function (result) {
                if (result.ok === true) {
                    if (operation === "status") {
                        SBH.util.toast(
                            "刷新完成：" +
                            String(
                                result
                                    .visibleCompletionDurationMs
                            ) +
                            " ms"
                        );
                    } else {
                        SBH.util.toast(
                            label +
                            "已响应：" +
                            String(
                                result
                                    .visibleCompletionDurationMs
                            ) +
                            " ms，后台核验中"
                        );
                    }
                } else {
                    SBH.util.toast(
                        label +
                        "失败：" +
                        String(
                            result.errorCode ||
                            "UNKNOWN"
                        )
                    );
                }
                showHome(controller);
            },
            function (verifyResult) {
                if (verifyResult.ok === true) {
                    SBH.util.toast(
                        "后台严格核验通过：" +
                        String(
                            verifyResult
                                .strictVerificationDurationMs
                        ) +
                        " ms"
                    );
                } else {
                    SBH.util.toast(
                        "后台核验失败，控制已锁定"
                    );
                }
                showHome(controller);
            }
        );
    }

    function performanceText() {
        var result = lastResult;
        if (result === null) {
            return "尚无性能样本";
        }
        if (result.phase ===
                "visible_complete") {
            return "可见完成 " +
                String(
                    result
                        .visibleCompletionDurationMs
                ) +
                " ms；后台核验中";
        }
        if (result.phase ===
                "strict_verified") {
            return "可见 " +
                String(
                    result
                        .visibleCompletionDurationMs
                ) +
                " ms；严格核验 " +
                String(
                    result
                        .strictVerificationDurationMs
                ) +
                " ms";
        }
        if (result.operation === "status") {
            return "刷新 " +
                String(
                    result
                        .visibleCompletionDurationMs
                ) +
                " ms";
        }
        return "最近门禁 " +
            String(
                result
                    .activationTotalDurationMs ||
                0
            ) +
            " ms";
    }

    function buildHero(controller) {
        var shell = new FrameLayout(SBH.ctx);
        var body = W.column();
        var head = W.row();
        var circle = new FrameLayout(SBH.ctx);
        var statusBox = W.column();
        var statusRow = W.row();
        var dot = new P.android.view.View(SBH.ctx);
        var actions = W.row();
        var actionShell =
            new FrameLayout(SBH.ctx);
        var state =
            lastSnapshot === null ?
                "unknown" :
                lastSnapshot.state;
        var running = state === "running";
        var pending = verificationPending;
        var accent =
            !activated ?
                C.orange :
                pending ?
                    C.blue :
                    running ?
                        C.green : C.blue;
        var soft =
            !activated ?
                C.orangeSoft :
                pending ?
                    C.blueSoft :
                    running ?
                        C.greenSoft :
                        C.blueSoft;
        var title =
            !activated ?
                "低延迟控制待启用" :
                pending ?
                    "状态已更新，后台核验中" :
                    "低延迟生命周期控制";
        var description =
            !activated ?
                "在节点页完成一次严格门禁；之后启动和停止先快速响应" :
                pending ?
                    "界面已完成状态切换，严格 root 核验在后台执行" :
                    running ?
                        "Core 正在运行，可刷新状态或手动停止" :
                        "Core 已停止，可刷新状态或手动启动";
        var coreValue =
            state === "unknown" ?
                "待刷新" :
                running ?
                    (
                        lastSnapshot.corePid ?
                            "PID " +
                            String(
                                lastSnapshot.corePid
                            ) :
                            "运行中·核验中"
                    ) :
                    "已停止";

        shell.setBackground(
            SBH.theme.gradient(
                [
                    "#F1FAF6",
                    "#F4F7FB",
                    "#FBF7F1"
                ],
                24,
                "#E3EAE6"
            )
        );
        shell.addView(
            W.artView(false),
            W.fp(W.MATCH, W.MATCH)
        );
        body.setPadding(
            SBH.util.dp(18),
            SBH.util.dp(18),
            SBH.util.dp(18),
            SBH.util.dp(16)
        );
        circle.setBackground(
            SBH.theme.rounded(
                soft,
                50,
                soft,
                1
            )
        );
        circle.addView(
            W.icon(
                running ?
                    "play" : "shield",
                54,
                accent
            ),
            W.fp(
                W.MATCH,
                W.MATCH,
                Gravity.CENTER
            )
        );
        head.addView(
            circle,
            W.lp(
                SBH.util.dp(74),
                SBH.util.dp(74)
            )
        );
        statusBox.setPadding(
            SBH.util.dp(14),
            SBH.util.dp(4),
            0,
            0
        );
        dot.setBackground(
            SBH.theme.rounded(
                accent,
                9,
                C.clear,
                0
            )
        );
        statusRow.addView(
            dot,
            W.lp(
                SBH.util.dp(10),
                SBH.util.dp(10)
            )
        );
        statusRow.addView(
            W.text(
                title,
                19,
                accent,
                true
            ),
            W.margins(
                W.lp(
                    W.WRAP,
                    W.WRAP
                ),
                8,
                0,
                0,
                0
            )
        );
        statusBox.addView(statusRow);
        statusBox.addView(
            W.text(
                description,
                12.3,
                C.secondary,
                false
            )
        );
        head.addView(
            statusBox,
            W.lp(0, W.WRAP, 1)
        );
        head.addView(
            W.label(
                !activated ?
                    "待启用" :
                    pending ?
                        "核验中" :
                        running ?
                            "运行中" : "已停止",
                accent,
                soft
            )
        );
        body.addView(head);
        body.addView(
            infoLine(
                "settings",
                "Runtime 控制服务",
                baseline === null ?
                    "待校验" :
                    "PID " +
                    String(
                        baseline
                            .controlServicePid
                    ),
                baseline === null ?
                    C.orange : C.green
            )
        );
        body.addView(
            infoLine(
                "box",
                "sing-box Core",
                coreValue,
                running ?
                    C.green : C.blue
            )
        );
        body.addView(
            infoLine(
                "timer",
                "最近耗时",
                performanceText(),
                pending ?
                    C.blue : C.green
            )
        );
        body.addView(
            infoLine(
                "route",
                "网络资源",
                lastSnapshot &&
                lastSnapshot
                    .reservedNetworkResourcesUnchanged ===
                    false ?
                    "异常·已锁定" :
                    "保持为空",
                C.green
            )
        );

        actions.setGravity(Gravity.CENTER);
        actions.addView(
            W.button(
                "刷新",
                "reload",
                C.blue,
                C.blueSoft,
                function () {
                    performUiOperation(
                        controller,
                        "status"
                    );
                }
            ),
            W.lp(
                0,
                SBH.util.dp(48),
                1
            )
        );
        actions.addView(
            W.button(
                "启动",
                "play",
                C.green,
                C.greenSoft,
                function () {
                    performUiOperation(
                        controller,
                        "start"
                    );
                }
            ),
            W.margins(
                W.lp(
                    0,
                    SBH.util.dp(48),
                    1
                ),
                8,
                0,
                8,
                0
            )
        );
        actions.addView(
            W.button(
                "停止",
                "stop",
                C.coral,
                C.coralSoft,
                function () {
                    performUiOperation(
                        controller,
                        "stop"
                    );
                }
            ),
            W.lp(
                0,
                SBH.util.dp(48),
                1
            )
        );
        actionShell.setPadding(
            SBH.util.dp(5),
            SBH.util.dp(5),
            SBH.util.dp(5),
            SBH.util.dp(5)
        );
        actionShell.setBackground(
            SBH.theme.rounded(
                "#F9FBFC",
                17,
                "#E4E9EF",
                1
            )
        );
        actionShell.addView(actions);
        body.addView(
            actionShell,
            W.lp(
                W.MATCH,
                SBH.util.dp(60)
            )
        );
        body.addView(
            W.text(
                verificationPending ?
                    "可见状态已完成；写按钮将在后台严格核验结束后恢复。" :
                    "可见路径不调用 Shell；每次写操作仅后台执行一次严格核验。",
                10.8,
                C.secondary,
                false
            )
        );
        shell.addView(
            body,
            W.fp(W.MATCH, W.MATCH)
        );
        shell.setLayoutParams(
            W.lp(
                W.MATCH,
                SBH.util.dp(414)
            )
        );
        return shell;
    }

    function buildHome(controller) {
        var page = originalHome(controller);
        var content;
        if (page &&
                page.getChildCount() > 0) {
            content = page.getChildAt(0);
            if (content &&
                    content.getChildCount() > 0) {
                content.removeViewAt(0);
                content.addView(
                    buildHero(controller),
                    0
                );
            }
        }
        return page;
    }

    function currentResultText() {
        if (lastResult !== null) {
            return JSON.stringify(
                lastResult,
                null,
                2
            );
        }
        return JSON.stringify(
            {
                ready: true,
                authorizationId:
                    AUTHORIZATION_ID,
                sourceWriteUnlockAuthorizationId:
                    SOURCE_WRITE_UNLOCK_AUTHORIZATION_ID,
                visiblePathShellCalls: 0,
                strictBackgroundShellCallsPerWrite: 1,
                visibleTargetMs: 5000,
                strictVerificationBlocksVisibleCompletion:
                    false,
                automaticRetryAllowed: false,
                directProcessSignalEnabled: false
            },
            null,
            2
        );
    }

    function buildActivationCard(controller) {
        var card = W.card(17);
        var resultText = W.text(
            currentResultText(),
            10.2,
            C.secondary,
            false
        );
        var button = W.button(
            activated ?
                "低延迟控制已启用" :
                "校验并启用低延迟控制",
            "timer",
            activated ?
                C.green : C.orange,
            activated ?
                C.greenSoft : C.orangeSoft,
            function () {
                if (activated) {
                    resultText.setText(
                        currentResultText()
                    );
                    SBH.util.toast(
                        "低延迟控制已启用"
                    );
                    return;
                }
                if (busy) {
                    SBH.util.toast(
                        "Stage 57 门禁正在执行"
                    );
                    return;
                }
                resultText.setText(
                    "正在执行一次严格门禁并建立低延迟基线。" +
                    "\n该门禁可能仍受 ShortX Shell 传输延迟影响。"
                );
                runAsync(
                    "activate",
                    function (result) {
                        resultText.setText(
                            JSON.stringify(
                                result,
                                null,
                                2
                            )
                        );
                        SBH.util.toast(
                            result.ok === true ?
                                "低延迟控制已启用" :
                                "Stage 57 门禁存在待处理项"
                        );
                        if (result.ok === true) {
                            showHome(controller);
                        }
                    },
                    null
                );
            }
        );

        card.setPadding(
            SBH.util.dp(14),
            SBH.util.dp(14),
            SBH.util.dp(14),
            SBH.util.dp(14)
        );
        card.addView(
            W.text(
                "Stage 57：低延迟生命周期控制",
                17,
                C.navy,
                true
            )
        );
        card.addView(
            W.text(
                "一次严格门禁后，首页 START、STOP_CORE 和 STATUS 的可见路径只使用认证 LocalSocket。" +
                "界面在 Runtime 状态收敛后立即更新；进程身份、配置哈希、TUN、规则、路由和操作审计合并为一次后台 Shell 核验。" +
                "后台核验期间锁定下一次写操作；异常时启动操作仅通过 STOP_CORE 回滚，不发送系统 TERM/KILL。",
                11.3,
                C.secondary,
                false
            )
        );
        resultText.setTextIsSelectable(true);
        card.addView(resultText);
        card.addView(
            button,
            W.margins(
                W.lp(
                    W.MATCH,
                    SBH.util.dp(44)
                ),
                0,
                12,
                0,
                0
            )
        );
        return card;
    }

    function buildNodes(controller) {
        var page = originalNodes(controller);
        var content = page.getChildAt(0);
        content.addView(
            buildActivationCard(controller),
            W.margins(
                W.lp(
                    W.MATCH,
                    W.WRAP
                ),
                0,
                16,
                0,
                12
            )
        );
        return page;
    }

    if (typeof originalHome !== "function" ||
            typeof originalNodes !== "function" ||
            typeof originalStart !== "function") {
        throw new Error(
            "Stage57 dependencies unavailable"
        );
    }

    SBH.productionLifecycleLowLatency = {
        version: 1,
        authorizationId:
            AUTHORIZATION_ID,
        sourceWriteUnlockAuthorizationId:
            SOURCE_WRITE_UNLOCK_AUTHORIZATION_ID,
        isActivated: function () {
            return activated;
        },
        isBusy: function () {
            return busy;
        },
        isVerificationPending: function () {
            return verificationPending;
        },
        snapshot: function () {
            return lastSnapshot;
        },
        result: function () {
            return lastResult;
        },
        activateAsync: function (callback) {
            runAsync(
                "activate",
                callback,
                null
            );
        },
        statusAsync: function (callback) {
            runAsync(
                "status",
                callback,
                null
            );
        },
        startAsync: function (
            callback,
            verificationCallback
        ) {
            runAsync(
                "start",
                callback,
                verificationCallback
            );
        },
        stopAsync: function (
            callback,
            verificationCallback
        ) {
            runAsync(
                "stop",
                callback,
                verificationCallback
            );
        },
        visiblePathShellCalls: 0,
        strictBackgroundShellCallsPerWrite: 1,
        automaticRetryAllowed: false,
        directProcessSignalEnabled: false
    };

    SBH.navigation.register(
        0,
        buildHome
    );
    SBH.navigation.register(
        1,
        buildNodes
    );

    SBH.app.start = function () {
        var output = originalStart();
        output.runtimeProductionLifecycleLowLatencyVersion = 1;
        output.runtimeProductionLifecycleLowLatencyReady = true;
        output.runtimeProductionLifecycleLowLatencyAuthorizationId =
            AUTHORIZATION_ID;
        output.runtimeProductionLifecycleLowLatencySourceWriteUnlockId =
            SOURCE_WRITE_UNLOCK_AUTHORIZATION_ID;
        output.runtimeProductionLifecycleLowLatencyActivationRequired =
            true;
        output.runtimeProductionLifecycleLowLatencyVisiblePathShellCalls =
            0;
        output.runtimeProductionLifecycleLowLatencyStrictBackgroundShellCallsPerWrite =
            1;
        output.runtimeProductionLifecycleLowLatencyVisibleTargetMs =
            5000;
        output.runtimeProductionLifecycleLowLatencyAutomaticRetry =
            false;
        output.runtimeProductionLifecycleLowLatencyDirectProcessSignal =
            false;
        output.writeOperationsLocked = true;
        output.destructiveOperations = false;
        return output;
    };
}());
