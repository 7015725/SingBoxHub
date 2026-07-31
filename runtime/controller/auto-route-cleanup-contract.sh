#!/system/bin/sh
#
# SingBoxHub auto_route cleanup contract.
#
# This file contains the strict ownership and cleanup logic used by the
# production Runtime controller after Phase 4B residual recovery.
#
# It is intended to be sourced by the production controller. The caller may
# override the variables below before sourcing this file.
#
# Safety contract:
#   - only the reserved SingBoxHub table and rule range are inspected;
#   - every route and rule is validated before deletion;
#   - an unknown entry causes a hard failure before any broad cleanup;
#   - no firewall, DNS or default-route operation is performed.
#

: "${IP_COMMAND:=/system/bin/ip}"
: "${TARGET_INTERFACE:=sbh-tun0}"
: "${AUTO_ROUTE_TABLE:=20240}"
: "${AUTO_ROUTE_RULE_BASE:=8800}"
: "${AUTO_ROUTE_RULE_END:=8815}"
: "${AUTO_ROUTE_GOTO_PREF:=8810}"

: "${AUTO_ROUTE_IPV4_PREFIX:=172.31.255.0/30}"
: "${AUTO_ROUTE_IPV6_PREFIX:=fdfe:7362:6833::/126}"
: "${AUTO_ROUTE_IPV4_DEST_A:=198.18.0.1}"
: "${AUTO_ROUTE_IPV4_DEST_B:=198.18.0.2}"
: "${AUTO_ROUTE_IPV6_DEST_A:=2001:db8::1}"
: "${AUTO_ROUTE_IPV6_DEST_B:=2001:db8::2}"

: "${CONTROLLER_LOG_FILE:=/dev/null}"

capture_auto_route_artifacts() {
    AUTO_ROUTE_RULES4="$(
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

    AUTO_ROUTE_RULES6="$(
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

    AUTO_ROUTE_ROUTES4="$(
        "$IP_COMMAND" route show table "$AUTO_ROUTE_TABLE" 2>/dev/null
    )"

    AUTO_ROUTE_ROUTES6="$(
        "$IP_COMMAND" -6 route show table "$AUTO_ROUTE_TABLE" 2>/dev/null
    )"
}

normalize_auto_route_rule() {
    printf '%s\n' "$1" |
        sed \
            -e 's/[[:space:]]*\[detached\][[:space:]]*/ /g' \
            -e 's/[[:space:]][[:space:]]*/ /g' \
            -e 's/^ //' \
            -e 's/ $//'
}

normalize_auto_route_route() {
    printf '%s\n' "$1" |
        sed \
            -e 's/[[:space:]][[:space:]]*/ /g' \
            -e 's/^ //' \
            -e 's/ $//'
}

auto_route_rule_line_allowed() {
    FAMILY="$1"
    RULE_LINE="$2"
    NORMALIZED_RULE="$(normalize_auto_route_rule "$RULE_LINE")"

    if [ "$FAMILY" = "4" ]; then
        case "$NORMALIZED_RULE" in
            "${AUTO_ROUTE_RULE_BASE}: from all iif ${TARGET_INTERFACE} goto ${AUTO_ROUTE_GOTO_PREF}"|\
            "$((AUTO_ROUTE_RULE_BASE + 1)): not from all iif lo lookup ${AUTO_ROUTE_TABLE}"|\
            "$((AUTO_ROUTE_RULE_BASE + 1)): from 0.0.0.0 iif lo lookup ${AUTO_ROUTE_TABLE}"|\
            "$((AUTO_ROUTE_RULE_BASE + 1)): from ${AUTO_ROUTE_IPV4_PREFIX} iif lo lookup ${AUTO_ROUTE_TABLE}"|\
            "${AUTO_ROUTE_GOTO_PREF}: from all nop")
                return 0
                ;;
        esac
    else
        case "$NORMALIZED_RULE" in
            "${AUTO_ROUTE_RULE_BASE}: from all iif ${TARGET_INTERFACE} goto ${AUTO_ROUTE_GOTO_PREF}"|\
            "${AUTO_ROUTE_RULE_BASE}: from ::/1 iif lo goto ${AUTO_ROUTE_GOTO_PREF}"|\
            "${AUTO_ROUTE_RULE_BASE}: from 8000::/1 iif lo goto ${AUTO_ROUTE_GOTO_PREF}"|\
            "$((AUTO_ROUTE_RULE_BASE + 1)): from ${AUTO_ROUTE_IPV6_PREFIX} iif lo lookup ${AUTO_ROUTE_TABLE}"|\
            "$((AUTO_ROUTE_RULE_BASE + 2)): from all lookup ${AUTO_ROUTE_TABLE}"|\
            "${AUTO_ROUTE_GOTO_PREF}: from all nop")
                return 0
                ;;
        esac
    fi

    return 1
}

auto_route_route_line_allowed() {
    FAMILY="$1"
    ROUTE_LINE="$2"
    NORMALIZED_ROUTE="$(normalize_auto_route_route "$ROUTE_LINE")"

    if [ "$FAMILY" = "4" ]; then
        case "$NORMALIZED_ROUTE" in
            "${AUTO_ROUTE_IPV4_DEST_A} dev ${TARGET_INTERFACE}"*|\
            "${AUTO_ROUTE_IPV4_DEST_B} dev ${TARGET_INTERFACE}"*)
                return 0
                ;;
        esac
    else
        case "$NORMALIZED_ROUTE" in
            "${AUTO_ROUTE_IPV6_DEST_A} dev ${TARGET_INTERFACE}"*|\
            "${AUTO_ROUTE_IPV6_DEST_B} dev ${TARGET_INTERFACE}"*)
                return 0
                ;;
        esac
    fi

    return 1
}

validate_auto_route_rules() {
    FAMILY="$1"
    RULE_TEXT="$2"

    [ -n "$RULE_TEXT" ] || return 0

    while IFS= read -r RULE_LINE; do
        [ -n "$RULE_LINE" ] || continue
        auto_route_rule_line_allowed "$FAMILY" "$RULE_LINE" || return 71
    done <<SBH_AUTO_ROUTE_RULES
$RULE_TEXT
SBH_AUTO_ROUTE_RULES

    return 0
}

validate_auto_route_routes() {
    FAMILY="$1"
    ROUTE_TEXT="$2"

    [ -n "$ROUTE_TEXT" ] || return 0

    while IFS= read -r ROUTE_LINE; do
        [ -n "$ROUTE_LINE" ] || continue
        auto_route_route_line_allowed "$FAMILY" "$ROUTE_LINE" || return 72
    done <<SBH_AUTO_ROUTE_ROUTES
$ROUTE_TEXT
SBH_AUTO_ROUTE_ROUTES

    return 0
}

validate_auto_route_artifacts() {
    FAMILY="$1"
    RULE_TEXT="$2"
    ROUTE_TEXT="$3"

    validate_auto_route_rules "$FAMILY" "$RULE_TEXT" || return $?
    validate_auto_route_routes "$FAMILY" "$ROUTE_TEXT" || return $?
    return 0
}

delete_auto_route_rules_family() {
    FAMILY="$1"
    PREF_VALUE="$AUTO_ROUTE_RULE_BASE"

    while [ "$PREF_VALUE" -le "$AUTO_ROUTE_RULE_END" ]; do
        DELETE_GUARD=0

        while :; do
            if [ "$FAMILY" = "4" ]; then
                CURRENT_RULE="$(
                    "$IP_COMMAND" rule show 2>/dev/null |
                        grep -m 1 "^${PREF_VALUE}:"
                )"
            else
                CURRENT_RULE="$(
                    "$IP_COMMAND" -6 rule show 2>/dev/null |
                        grep -m 1 "^${PREF_VALUE}:"
                )"
            fi

            [ -n "$CURRENT_RULE" ] || break
            auto_route_rule_line_allowed "$FAMILY" "$CURRENT_RULE" || return 73

            if [ "$FAMILY" = "4" ]; then
                "$IP_COMMAND" rule del pref "$PREF_VALUE" \
                    >>"$CONTROLLER_LOG_FILE" 2>&1 || return 74
            else
                "$IP_COMMAND" -6 rule del pref "$PREF_VALUE" \
                    >>"$CONTROLLER_LOG_FILE" 2>&1 || return 75
            fi

            DELETE_GUARD=$((DELETE_GUARD + 1))
            [ "$DELETE_GUARD" -le 32 ] || return 76
        done

        PREF_VALUE=$((PREF_VALUE + 1))
    done

    return 0
}

flush_auto_route_table() {
    "$IP_COMMAND" route flush table "$AUTO_ROUTE_TABLE" \
        >>"$CONTROLLER_LOG_FILE" 2>&1
    "$IP_COMMAND" -6 route flush table "$AUTO_ROUTE_TABLE" \
        >>"$CONTROLLER_LOG_FILE" 2>&1
}

auto_route_artifacts_absent() {
    capture_auto_route_artifacts

    [ -z "$AUTO_ROUTE_RULES4" ] || return 1
    [ -z "$AUTO_ROUTE_RULES6" ] || return 1
    [ -z "$AUTO_ROUTE_ROUTES4" ] || return 1
    [ -z "$AUTO_ROUTE_ROUTES6" ] || return 1

    return 0
}

cleanup_auto_route_artifacts() {
    capture_auto_route_artifacts

    validate_auto_route_artifacts \
        4 \
        "$AUTO_ROUTE_RULES4" \
        "$AUTO_ROUTE_ROUTES4" || return 77

    validate_auto_route_artifacts \
        6 \
        "$AUTO_ROUTE_RULES6" \
        "$AUTO_ROUTE_ROUTES6" || return 78

    delete_auto_route_rules_family 4 || return 79
    delete_auto_route_rules_family 6 || return 80
    flush_auto_route_table

    auto_route_artifacts_absent || return 81
    return 0
}

print_auto_route_artifacts() {
    capture_auto_route_artifacts

    printf '%s\n' '--- IPv4 rules ---'
    printf '%s\n' "$AUTO_ROUTE_RULES4"
    printf '%s\n' '--- IPv6 rules ---'
    printf '%s\n' "$AUTO_ROUTE_RULES6"
    printf '%s\n' '--- IPv4 routes ---'
    printf '%s\n' "$AUTO_ROUTE_ROUTES4"
    printf '%s\n' '--- IPv6 routes ---'
    printf '%s\n' "$AUTO_ROUTE_ROUTES6"
}

# Optional standalone interface for manual validation. Production code should
# normally source this file and call cleanup_auto_route_artifacts only after the
# exact SingBoxHub core is confirmed stopped.
if [ "${0##*/}" = "auto-route-cleanup-contract.sh" ]; then
    case "${1:-inspect}" in
        inspect)
            print_auto_route_artifacts
            ;;
        validate)
            capture_auto_route_artifacts
            validate_auto_route_artifacts 4 "$AUTO_ROUTE_RULES4" "$AUTO_ROUTE_ROUTES4" &&
                validate_auto_route_artifacts 6 "$AUTO_ROUTE_RULES6" "$AUTO_ROUTE_ROUTES6"
            ;;
        cleanup)
            cleanup_auto_route_artifacts
            ;;
        *)
            printf 'Usage: %s {inspect|validate|cleanup}\n' "$0"
            exit 64
            ;;
    esac
fi
