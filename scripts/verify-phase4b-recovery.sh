#!/system/bin/sh
#
# Verify the Phase 4B recovery state after the upgraded production controller
# has been installed on the Android device.
#
# This script does not install or modify the controller. It validates hashes,
# checks the reserved auto_route resources, runs one production start/stop
# sanity cycle and confirms the protected Clash tun0 owner is unchanged.
#

EXPECTED_CONTROLLER_SHA256="d15568f21d468730cb208a3c5080da0b956722206d8b7b25dfc88dbf7c4d6092"
EXPECTED_CONFIG_SHA256="3bbf970bff202f5cb27f7afbbd9a0d70b5895024d906fa8e33be3bfe326bcf55"

TARGET_INTERFACE="sbh-tun0"
PROTECTED_INTERFACE="tun0"
AUTO_ROUTE_TABLE="20240"
AUTO_ROUTE_RULE_BASE="8800"
AUTO_ROUTE_RULE_END="8815"

sha256_file() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" 2>/dev/null | awk '{print $1}'
    else
        /system/bin/toybox sha256sum "$1" 2>/dev/null | awk '{print $1}'
    fi
}

json_escape() {
    printf '%s' "$1" |
        tr '\r\n\t' '   ' |
        sed \
            -e 's/\\/\\\\/g' \
            -e 's/"/\\"/g' \
            -e 's/[^[:print:]]/?/g'
}

json_string() {
    printf '"%s"' "$(json_escape "$1")"
}

bool_json() {
    if [ "$1" = "1" ]; then
        printf 'true'
    else
        printf 'false'
    fi
}

capture_reserved_rules() {
    RESERVED_RULES4="$(
        "$IP_COMMAND" rule show 2>/dev/null |
            awk \
                -v start="$AUTO_ROUTE_RULE_BASE" \
                -v end="$AUTO_ROUTE_RULE_END" \
                '{
                    pref = $1
                    sub(/:$/, "", pref)
                    if (pref + 0 >= start && pref + 0 <= end) {
                        print
                    }
                }'
    )"

    RESERVED_RULES6="$(
        "$IP_COMMAND" -6 rule show 2>/dev/null |
            awk \
                -v start="$AUTO_ROUTE_RULE_BASE" \
                -v end="$AUTO_ROUTE_RULE_END" \
                '{
                    pref = $1
                    sub(/:$/, "", pref)
                    if (pref + 0 >= start && pref + 0 <= end) {
                        print
                    }
                }'
    )"

    RESERVED_ROUTES4="$(
        "$IP_COMMAND" route show table "$AUTO_ROUTE_TABLE" 2>/dev/null
    )"
    RESERVED_ROUTES6="$(
        "$IP_COMMAND" -6 route show table "$AUTO_ROUTE_TABLE" 2>/dev/null
    )"
}

reserved_resources_absent() {
    capture_reserved_rules

    [ -z "$RESERVED_RULES4" ] || return 1
    [ -z "$RESERVED_RULES6" ] || return 1
    [ -z "$RESERVED_ROUTES4" ] || return 1
    [ -z "$RESERVED_ROUTES6" ] || return 1

    "$IP_COMMAND" link show dev "$TARGET_INTERFACE" >/dev/null 2>&1 && return 1
    return 0
}

capture_protected_owner() {
    run_timeout 8 sh -c '
        for PROC_DIR in /proc/[0-9]*; do
            [ -d "$PROC_DIR/fdinfo" ] || continue

            MATCHED="$(
                grep -l "^iff:[[:space:]]*tun0$" \
                    "$PROC_DIR"/fdinfo/* \
                    2>/dev/null
            )"
            [ -n "$MATCHED" ] || continue

            PID_VALUE="${PROC_DIR##*/}"
            UID_VALUE="$(
                awk "/^Uid:/ {print \$2; exit}" \
                    "$PROC_DIR/status" \
                    2>/dev/null
            )"
            CMDLINE="$(
                tr "\000" " " \
                    <"$PROC_DIR/cmdline" \
                    2>/dev/null
            )"

            printf "pid=%s uid=%s cmdline=%s\n" \
                "$PID_VALUE" \
                "$UID_VALUE" \
                "$CMDLINE"
            exit 0
        done
    ' 2>/dev/null
}

run_timeout() {
    TIMEOUT_SECONDS="$1"
    shift

    if command -v timeout >/dev/null 2>&1; then
        timeout "$TIMEOUT_SECONDS" "$@"
    else
        /system/bin/toybox timeout "$TIMEOUT_SECONDS" "$@"
    fi
}

SHORTX_DIR="$(
    ls -1dt /data/system/shortx_* 2>/dev/null |
        head -n 1
)"
PROJECT_ROOT="$SHORTX_DIR/SingBoxHub"
BIN_DIR="$PROJECT_ROOT/bin"
CONFIG_DIR="$PROJECT_ROOT/config"
METADATA_DIR="$PROJECT_ROOT/metadata"
CONTROL_DIR="$PROJECT_ROOT/runtime/control"

PRODUCTION_CONTROLLER="$BIN_DIR/singboxhub-runtime"
PRODUCTION_CONFIG="$CONFIG_DIR/runtime-tun.json"
PRODUCTION_MANIFEST="$METADATA_DIR/runtime.meta.json"
ENDPOINT_FILE="$CONTROL_DIR/control_endpoint.json"
SING_BOX_BINARY="$BIN_DIR/sing-box"

if command -v ip >/dev/null 2>&1; then
    IP_COMMAND="$(command -v ip)"
else
    IP_COMMAND="/system/bin/ip"
fi

CONTROLLER_SHA256="$(sha256_file "$PRODUCTION_CONTROLLER")"
CONFIG_SHA256="$(sha256_file "$PRODUCTION_CONFIG")"

CONTROLLER_HASH_PASSED=0
[ "$CONTROLLER_SHA256" = "$EXPECTED_CONTROLLER_SHA256" ] &&
    CONTROLLER_HASH_PASSED=1

CONFIG_HASH_PASSED=0
[ "$CONFIG_SHA256" = "$EXPECTED_CONFIG_SHA256" ] &&
    CONFIG_HASH_PASSED=1

MANIFEST_HASH_PASSED=0
grep -Fq \
    "\"controllerSha256\":\"$EXPECTED_CONTROLLER_SHA256\"" \
    "$PRODUCTION_MANIFEST" \
    2>/dev/null &&
    MANIFEST_HASH_PASSED=1

CONFIG_CHECK_OUTPUT="$(
    run_timeout 12 \
        "$SING_BOX_BINARY" check \
            -c "$PRODUCTION_CONFIG" \
        2>&1
)"
CONFIG_CHECK_EXIT_CODE=$?
CONFIG_CHECK_PASSED=0
[ "$CONFIG_CHECK_EXIT_CODE" -eq 0 ] && CONFIG_CHECK_PASSED=1

PROTECTED_OWNER_BEFORE="$(capture_protected_owner)"

PRE_CLEAN_OUTPUT="$(
    "$PRODUCTION_CONTROLLER" cleanup-tun 2>&1
)"
PRE_CLEAN_EXIT_CODE=$?

PRE_CLEAN_PASSED=0
if [ "$PRE_CLEAN_EXIT_CODE" -eq 0 ] &&
        [ "$PRE_CLEAN_OUTPUT" = "TUN_CLEAN" ] &&
        reserved_resources_absent; then
    PRE_CLEAN_PASSED=1
fi

START_OUTPUT="$(
    "$PRODUCTION_CONTROLLER" start 2>&1
)"
START_EXIT_CODE=$?
START_PASSED=0
if [ "$START_EXIT_CODE" -eq 0 ] &&
        [ "$START_OUTPUT" = "STARTED" ]; then
    START_PASSED=1
fi

TARGET_RUNNING=0
"$IP_COMMAND" link show dev "$TARGET_INTERFACE" >/dev/null 2>&1 &&
    TARGET_RUNNING=1

STOP_OUTPUT="$(
    "$PRODUCTION_CONTROLLER" stop-runtime 2>&1
)"
STOP_EXIT_CODE=$?

POST_CLEAN_OUTPUT="$(
    "$PRODUCTION_CONTROLLER" cleanup-tun 2>&1
)"
POST_CLEAN_EXIT_CODE=$?

FINAL_CLEAN_PASSED=0
if [ "$STOP_EXIT_CODE" -eq 0 ] &&
        [ "$POST_CLEAN_EXIT_CODE" -eq 0 ] &&
        [ "$POST_CLEAN_OUTPUT" = "TUN_CLEAN" ] &&
        reserved_resources_absent &&
        [ ! -e "$ENDPOINT_FILE" ]; then
    FINAL_CLEAN_PASSED=1
fi

PROTECTED_OWNER_FINAL="$(capture_protected_owner)"
PROTECTED_OWNER_UNCHANGED=0
if [ -n "$PROTECTED_OWNER_BEFORE" ] &&
        [ "$PROTECTED_OWNER_FINAL" = "$PROTECTED_OWNER_BEFORE" ]; then
    PROTECTED_OWNER_UNCHANGED=1
fi

PASSED=0
if [ "$CONTROLLER_HASH_PASSED" -eq 1 ] &&
        [ "$CONFIG_HASH_PASSED" -eq 1 ] &&
        [ "$MANIFEST_HASH_PASSED" -eq 1 ] &&
        [ "$CONFIG_CHECK_PASSED" -eq 1 ] &&
        [ "$PRE_CLEAN_PASSED" -eq 1 ] &&
        [ "$START_PASSED" -eq 1 ] &&
        [ "$TARGET_RUNNING" -eq 1 ] &&
        [ "$FINAL_CLEAN_PASSED" -eq 1 ] &&
        [ "$PROTECTED_OWNER_UNCHANGED" -eq 1 ]; then
    PASSED=1
fi

JSON="{"
JSON="${JSON}\"ok\":true,"
JSON="${JSON}\"probe\":\"singboxhub_phase4b_recovery_verify\","
JSON="${JSON}\"controllerHashPassed\":$(bool_json "$CONTROLLER_HASH_PASSED"),"
JSON="${JSON}\"configHashPassed\":$(bool_json "$CONFIG_HASH_PASSED"),"
JSON="${JSON}\"manifestHashPassed\":$(bool_json "$MANIFEST_HASH_PASSED"),"
JSON="${JSON}\"configCheckPassed\":$(bool_json "$CONFIG_CHECK_PASSED"),"
JSON="${JSON}\"preCleanOutput\":$(json_string "$PRE_CLEAN_OUTPUT"),"
JSON="${JSON}\"preCleanPassed\":$(bool_json "$PRE_CLEAN_PASSED"),"
JSON="${JSON}\"startOutput\":$(json_string "$START_OUTPUT"),"
JSON="${JSON}\"startPassed\":$(bool_json "$START_PASSED"),"
JSON="${JSON}\"targetRunning\":$(bool_json "$TARGET_RUNNING"),"
JSON="${JSON}\"stopOutput\":$(json_string "$STOP_OUTPUT"),"
JSON="${JSON}\"postCleanOutput\":$(json_string "$POST_CLEAN_OUTPUT"),"
JSON="${JSON}\"finalCleanPassed\":$(bool_json "$FINAL_CLEAN_PASSED"),"
JSON="${JSON}\"protectedOwnerBefore\":$(json_string "$PROTECTED_OWNER_BEFORE"),"
JSON="${JSON}\"protectedOwnerFinal\":$(json_string "$PROTECTED_OWNER_FINAL"),"
JSON="${JSON}\"protectedOwnerUnchanged\":$(bool_json "$PROTECTED_OWNER_UNCHANGED"),"
JSON="${JSON}\"passed\":$(bool_json "$PASSED")"
JSON="${JSON}}"

printf '%s\n' "$JSON"
[ "$PASSED" -eq 1 ]
