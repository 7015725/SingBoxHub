/* SingBoxHub Stage53 Retry3 controller-owned Core stop reconciliation. Rhino ES5 only. */
SBH.versions.runtimeControllerOwnedCoreStopReconcile = 1;

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
    var originalFactory = SBH.navigation.pages[1];
    var originalStart = SBH.app.start;
    var W = SBH.widgets;
    var C = SBH.theme.colors;
    var busy = false;

    var AUTHORIZATION_ID =
        "stage53-retry3-runtime-stop-core-controller-owned-process-reconcile-user-authorized-20260805";
    var SOURCE_DIAGNOSTIC_ID =
        "stage53-retry2-runtime-core-state-divergence-readonly-20260805";
    var SERVER_CLASS =
        "com.singboxhub.runtime.CoreRuntimeMain";
    var CLIENT_CLASS =
        "com.singboxhub.runtime.CoreClientMain";
    var SOCKET_READ_TIMEOUT_MS = 2500;
    var CHECK_TIMEOUT_SECONDS = 30;
    var STOP_WAIT_SECONDS = 8;

    function now() {
        return Number(P.java.lang.System.currentTimeMillis());
    }

    function quote(value) {
        return "'" + String(value).replace(/'/g, "'\\''") + "'";
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

    function numberValue(raw, name) {
        var value = marker(raw, name);
        var parsed = Number(value);
        return value !== null && isFinite(parsed) ? parsed : null;
    }

    function yes(raw, name) {
        return marker(raw, name) === "1";
    }

    function executeShell(command, purpose) {
        var action = ShellCommand.newBuilder()
            .setCommand(String(command))
            .setSingleShot(true)
            .setId(
                "SingBoxHub#Stage53Retry3#" +
                String(purpose) + "#" +
                String(SBH.util.randomToken())
            )
            .build();
        var result = shortx.executeAction(action);
        var data = result.contextData;
        var stdout = contextValue(data, "shellOut");
        var stderr = contextValue(data, "shellErr");

        return {
            code: Number(data.get("shellCode")),
            output: stdout + (stderr ? "\n" + stderr : "")
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

    function validateEndpoint(endpoint, expectedPid) {
        var root = runtimeRoot();

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
        if (String(endpoint.runtimeJar || "") !==
                root + "/runtime/core/SingBoxHubCoreRuntime.jar" ||
                String(endpoint.binaryPath || "") !==
                root + "/bin/sing-box" ||
                String(endpoint.configPath || "") !==
                root + "/config/runtime-tun.json" ||
                String(endpoint.workingDirectory || "") !==
                root + "/runtime/core/work") {
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

    function safeStatus(value) {
        return String(value || "")
            .replace(/[^A-Za-z0-9_.:-]/g, "_")
            .substring(0, 64);
    }

    function statusRejected(value) {
        var text = String(value || "").toUpperCase();
        return !text ||
            /ERROR|FAILED|FAILURE|INVALID|DENIED|UNAUTHORIZED|UNKNOWN_COMMAND/.test(text);
    }

    function sendCommand(endpoint, command) {
        var socket = null;
        var writer = null;
        var reader = null;
        var correlation =
            "sbh53r3-" + now() + "-" + randomHex(12);
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
                    String(command) +
                    "_CORRELATION_ECHO_MISMATCH"
                );
            }
            if (statusRejected(statusLine)) {
                throw new Error(
                    String(command) +
                    "_RESPONSE_REJECTED_" +
                    safeStatus(statusLine)
                );
            }

            return {
                requestSent: true,
                requestCount: 1,
                responseStatus: safeStatus(statusLine),
                responseStatusReturned:
                    statusLine !== null,
                correlationMatched: true,
                socketConnected: true,
                socketReadTimeoutConfigured: true
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

    function resourceFunctions() {
        return [
            "rule4_count(){ ip -4 rule show 2>/dev/null | awk '" +
                "$1 ~ /^[0-9]+:$/ {p=$1; sub(/:$/,\"\",p); " +
                "if (p>=8800 && p<=8815) c++} END{print c+0}'; }",
            "rule6_count(){ ip -6 rule show 2>/dev/null | awk '" +
                "$1 ~ /^[0-9]+:$/ {p=$1; sub(/:$/,\"\",p); " +
                "if (p>=8800 && p<=8815) c++} END{print c+0}'; }",
            "route4_count(){ ip -4 route show table 20240 2>/dev/null | " +
                "awk 'NF{c++} END{print c+0}'; }",
            "route6_count(){ ip -6 route show table 20240 2>/dev/null | " +
                "awk 'NF{c++} END{print c+0}'; }"
        ];
    }

    function identityFunctions() {
        return [
            "match_control(){ " +
                "P=\"$1\"; [ -r \"/proc/$P/cmdline\" ] || return 1; " +
                "V=$(tr '\\000' ' ' < \"/proc/$P/cmdline\" 2>/dev/null); " +
                "case \"$V\" in *\"$SERVER\"*\"$CFG\"*\"$WORK\"*) return 0;; " +
                "*) return 1;; esac; }",
            "candidate_fields(){ " +
                "P=\"$1\"; X=\"/proc/$P/cmdline\"; " +
                "[ -r \"$X\" ] || return 1; " +
                "ARGS=$(tr '\\000' '\\n' < \"$X\" 2>/dev/null); " +
                "[ -n \"$ARGS\" ] || return 1; " +
                "A0=$(printf '%s\\n' \"$ARGS\" | sed -n '1p'); " +
                "BIDX=-1; CIDX=-1; IDX=0; " +
                "while IFS= read -r A; do " +
                    "[ \"$A\" = \"$BIN\" ] && [ \"$BIDX\" = -1 ] && BIDX=$IDX; " +
                    "[ \"$A\" = \"$CFG\" ] && [ \"$CIDX\" = -1 ] && CIDX=$IDX; " +
                    "IDX=$((IDX + 1)); " +
                "done <<EOA\n$ARGS\nEOA\n" +
                "PP=$(awk '/^PPid:/ {print $2; exit}' \"/proc/$P/status\" 2>/dev/null); " +
                "U=$(awk '/^Uid:/ {print $2; exit}' \"/proc/$P/status\" 2>/dev/null); " +
                "S=$(awk '/^State:/ {print $2; exit}' \"/proc/$P/status\" 2>/dev/null); " +
                "return 0; }",
            "match_controller_core(){ " +
                "P=\"$1\"; candidate_fields \"$P\" || return 1; " +
                "[ \"$P\" != \"$CPID\" ] && [ \"$PP\" = \"$CPID\" ] && " +
                "[ \"$U\" = 0 ] && [ \"$S\" != Z ] && " +
                "[ \"$A0\" = \"$BIN\" ] && [ \"$BIDX\" = 0 ] && " +
                "[ \"$CIDX\" -ge 1 ]; }",
            "controller_snapshot(){ " +
                "CCOUNT=0; CPICK=0; " +
                "for X in /proc/[0-9]*/cmdline; do " +
                    "[ -r \"$X\" ] || continue; " +
                    "P=${X#/proc/}; P=${P%/cmdline}; " +
                    "if match_controller_core \"$P\"; then " +
                        "CCOUNT=$((CCOUNT + 1)); CPICK=\"$P\"; " +
                        "printf '__SBH_CONTROLLER_CANDIDATE__=%s|%s|%s|%s|%s|%s|%s\\n' " +
                            "\"$P\" \"$PP\" \"$U\" \"$S\" \"$IDX\" \"$BIDX\" \"$CIDX\"; " +
                    "fi; " +
                "done; }"
        ];
    }

    function buildPreflightCommand() {
        var root = runtimeRoot();
        var config = root + "/config/runtime-tun.json";
        var binary = root + "/bin/sing-box";
        var endpoint = root +
            "/runtime/control/control_endpoint.json";
        var work = root + "/runtime/core/work";
        var lines = [
            "umask 077",
            "ROOT=" + quote(root),
            "CFG=" + quote(config),
            "BIN=" + quote(binary),
            "ENDPOINT=" + quote(endpoint),
            "WORK=" + quote(work),
            "SERVER=" + quote(SERVER_CLASS),
            "GATE=none; CODE=0",
            "finish(){ printf '__SBH_GATE__=%s\\n' \"$GATE\"; " +
                "printf '__SBH_CODE__=%s\\n' \"$CODE\"; " +
                "printf '__SBH_DONE__=1\\n'; exit 0; }",
            "fail(){ GATE=\"$1\"; CODE=\"$2\"; finish; }",
            "check_config(){ if command -v timeout >/dev/null 2>&1; then " +
                "timeout " + String(CHECK_TIMEOUT_SECONDS) +
                "s \"$BIN\" check -c \"$CFG\" >/dev/null 2>&1; " +
                "else \"$BIN\" check -c \"$CFG\" >/dev/null 2>&1; fi; }"
        ];

        lines = lines.concat(resourceFunctions());
        lines = lines.concat(identityFunctions());
        lines = lines.concat([
            "UIDV=$(id -u 2>/dev/null)",
            "printf '__SBH_UID__=%s\\n' \"$UIDV\"",
            "[ \"$UIDV\" = 0 ] || fail root_uid 771",
            "[ -d \"$ROOT\" ] && [ ! -L \"$ROOT\" ] || fail runtime_root 772",
            "[ -f \"$BIN\" ] && [ -x \"$BIN\" ] && [ ! -L \"$BIN\" ] || fail binary 773",
            "[ -f \"$CFG\" ] && [ ! -L \"$CFG\" ] || fail config 774",
            "check_config; CHECK=$?",
            "[ \"$CHECK\" = 0 ] || fail config_check 775",
            "[ -f \"$ENDPOINT\" ] && [ ! -L \"$ENDPOINT\" ] || fail endpoint 776",
            "[ \"$(stat -c %a \"$ENDPOINT\" 2>/dev/null)\" = 600 ] && " +
                "[ \"$(stat -c %u \"$ENDPOINT\" 2>/dev/null)\" = 0 ] && " +
                "[ \"$(stat -c %g \"$ENDPOINT\" 2>/dev/null)\" = 0 ] || " +
                "fail endpoint_metadata 777",
            "CPID=$(sed -n 's/.*\"runtimePid\"[[:space:]]*:[[:space:]]*" +
                "\\([0-9][0-9]*\\).*/\\1/p' \"$ENDPOINT\" | sed -n '1p')",
            "case \"$CPID\" in ''|*[!0-9]*) fail endpoint_pid 778;; esac",
            "kill -0 \"$CPID\" 2>/dev/null || fail control_not_alive 779",
            "match_control \"$CPID\" || fail control_identity 780",
            "CUID=$(awk '/^Uid:/ {print $2; exit}' \"/proc/$CPID/status\" 2>/dev/null)",
            "CGID=$(awk '/^Gid:/ {print $2; exit}' \"/proc/$CPID/status\" 2>/dev/null)",
            "[ \"$CUID\" = 0 ] && [ \"$CGID\" = 0 ] || fail control_owner 781",
            "EP_DATA=$(toybox base64 \"$ENDPOINT\" 2>/dev/null | tr -d '\\r\\n')",
            "[ -n \"$EP_DATA\" ] || fail endpoint_read 782",
            "controller_snapshot",
            "[ \"$CCOUNT\" = 1 ] || fail controller_owned_candidate_count 783",
            "candidate_fields \"$CPICK\" || fail controller_owned_candidate_read 784",
            "SELECTED_PID=\"$CPICK\"",
            "SELECTED_PPID=\"$PP\"",
            "SELECTED_UID=\"$U\"",
            "SELECTED_STATE=\"$S\"",
            "SELECTED_ARGC=\"$IDX\"",
            "SELECTED_BIDX=\"$BIDX\"",
            "SELECTED_CIDX=\"$CIDX\"",
            "TUN=0; [ -e /sys/class/net/sbh-tun0 ] && TUN=1",
            "R4=$(rule4_count); R6=$(rule6_count); " +
                "RT4=$(route4_count); RT6=$(route6_count)",
            "[ \"$TUN\" = 0 ] && [ \"$R4\" = 0 ] && [ \"$R6\" = 0 ] && " +
                "[ \"$RT4\" = 0 ] && [ \"$RT6\" = 0 ] || " +
                "fail reserved_network_resources_present 785",
            "printf '__SBH_CHECK__=%s\\n' \"$CHECK\"",
            "printf '__SBH_CPID__=%s\\n' \"$CPID\"",
            "printf '__SBH_CUID__=%s\\n' \"$CUID\"",
            "printf '__SBH_CGID__=%s\\n' \"$CGID\"",
            "printf '__SBH_EP_DATA__=%s\\n' \"$EP_DATA\"",
            "printf '__SBH_CCOUNT__=%s\\n' \"$CCOUNT\"",
            "printf '__SBH_SELECTED_PID__=%s\\n' \"$SELECTED_PID\"",
            "printf '__SBH_SELECTED_PPID__=%s\\n' \"$SELECTED_PPID\"",
            "printf '__SBH_SELECTED_UID__=%s\\n' \"$SELECTED_UID\"",
            "printf '__SBH_SELECTED_STATE__=%s\\n' \"$SELECTED_STATE\"",
            "printf '__SBH_SELECTED_ARGC__=%s\\n' \"$SELECTED_ARGC\"",
            "printf '__SBH_SELECTED_BIDX__=%s\\n' \"$SELECTED_BIDX\"",
            "printf '__SBH_SELECTED_CIDX__=%s\\n' \"$SELECTED_CIDX\"",
            "printf '__SBH_TUN__=%s\\n' \"$TUN\"",
            "printf '__SBH_RULE4__=%s\\n' \"$R4\"",
            "printf '__SBH_RULE6__=%s\\n' \"$R6\"",
            "printf '__SBH_ROUTE4__=%s\\n' \"$RT4\"",
            "printf '__SBH_ROUTE6__=%s\\n' \"$RT6\"",
            "printf '__SBH_PREFLIGHT_OK__=1\\n'",
            "finish"
        ]);

        return lines.join("; ");
    }

    function buildAfterStopCommand(controlPid, selectedPid) {
        var root = runtimeRoot();
        var config = root + "/config/runtime-tun.json";
        var binary = root + "/bin/sing-box";
        var work = root + "/runtime/core/work";
        var lines = [
            "umask 077",
            "CFG=" + quote(config),
            "BIN=" + quote(binary),
            "WORK=" + quote(work),
            "SERVER=" + quote(SERVER_CLASS),
            "CPID=" + quote(String(controlPid)),
            "SELECTED=" + quote(String(selectedPid))
        ];

        lines = lines.concat(resourceFunctions());
        lines = lines.concat(identityFunctions());
        lines = lines.concat([
            "I=0",
            "while [ \"$I\" -lt " + String(STOP_WAIT_SECONDS) + " ]; do " +
                "if ! kill -0 \"$SELECTED\" 2>/dev/null; then break; fi; " +
                "if ! match_controller_core \"$SELECTED\"; then break; fi; " +
                "sleep 1; I=$((I + 1)); done",
            "SELECTED_STOPPED=0",
            "if ! kill -0 \"$SELECTED\" 2>/dev/null; then " +
                "SELECTED_STOPPED=1; " +
                "elif ! match_controller_core \"$SELECTED\"; then " +
                "SELECTED_STOPPED=1; fi",
            "controller_snapshot",
            "CONTROL_ALIVE=0",
            "if kill -0 \"$CPID\" 2>/dev/null && match_control \"$CPID\"; then " +
                "CONTROL_ALIVE=1; fi",
            "TUN=0; [ -e /sys/class/net/sbh-tun0 ] && TUN=1",
            "R4=$(rule4_count); R6=$(rule6_count); " +
                "RT4=$(route4_count); RT6=$(route6_count)",
            "printf '__SBH_AFTER_DONE__=1\\n'",
            "printf '__SBH_SELECTED_STOPPED__=%s\\n' \"$SELECTED_STOPPED\"",
            "printf '__SBH_REMAINING_CONTROLLER_COUNT__=%s\\n' \"$CCOUNT\"",
            "printf '__SBH_CONTROL_ALIVE__=%s\\n' \"$CONTROL_ALIVE\"",
            "printf '__SBH_TUN__=%s\\n' \"$TUN\"",
            "printf '__SBH_RULE4__=%s\\n' \"$R4\"",
            "printf '__SBH_RULE6__=%s\\n' \"$R6\"",
            "printf '__SBH_ROUTE4__=%s\\n' \"$RT4\"",
            "printf '__SBH_ROUTE6__=%s\\n' \"$RT6\"",
            "exit 0"
        ]);

        return lines.join("; ");
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
            "CONTROLLER_OWNED_CORE_STOP_RECONCILE_FAILED";
    }

    function reconcile() {
        var startedAt = now();
        var preflight = null;
        var endpointData = null;
        var endpoint = null;
        var statusBefore = null;
        var stop = null;
        var after = null;
        var statusAfter = null;
        var ping = null;
        var controlPid = null;
        var selectedPid = null;
        var failureCode = null;
        var failureText = null;
        var ok = false;
        var statusBeforeText = "";
        var statusAfterText = "";
        var selectedStopped = false;
        var remainingCount = null;
        var controlAlive = false;
        var resourcesClean = false;
        var next = null;

        try {
            preflight = executeShell(
                buildPreflightCommand(),
                "preflight"
            );
            if (!yes(preflight.output, "DONE") ||
                    !yes(preflight.output, "PREFLIGHT_OK")) {
                throw new Error(
                    marker(preflight.output, "GATE") ||
                    "STOP_RECONCILE_PREFLIGHT_FAILED"
                );
            }

            controlPid = numberValue(
                preflight.output,
                "CPID"
            );
            selectedPid = numberValue(
                preflight.output,
                "SELECTED_PID"
            );
            endpointData = marker(
                preflight.output,
                "EP_DATA"
            );
            if (controlPid === null ||
                    selectedPid === null ||
                    endpointData === null ||
                    endpointData === "") {
                throw new Error(
                    "STOP_RECONCILE_PREFLIGHT_DATA_MISSING"
                );
            }

            endpoint = validateEndpoint(
                decodeEndpoint(endpointData),
                controlPid
            );

            statusBefore = sendCommand(endpoint, "STATUS");
            statusBeforeText =
                String(statusBefore.responseStatus || "")
                    .toUpperCase();
            if (!(statusBeforeText === "RUNNING" ||
                    statusBeforeText === "ALREADY_RUNNING" ||
                    statusBeforeText === "STARTED")) {
                throw new Error(
                    "STATUS_BEFORE_STOP_NOT_RUNNING_" +
                    safeStatus(statusBeforeText)
                );
            }

            stop = sendCommand(endpoint, "STOP_CORE");
            if (!(String(stop.responseStatus).toUpperCase() ===
                    "STOPPED" ||
                    String(stop.responseStatus).toUpperCase() ===
                    "ALREADY_STOPPED" ||
                    String(stop.responseStatus).toUpperCase() ===
                    "OK")) {
                throw new Error(
                    "STOP_CORE_RESPONSE_UNEXPECTED_" +
                    safeStatus(stop.responseStatus)
                );
            }

            after = executeShell(
                buildAfterStopCommand(
                    controlPid,
                    selectedPid
                ),
                "reconcile-after-stop"
            );
            if (!yes(after.output, "AFTER_DONE")) {
                throw new Error(
                    "STOP_RECONCILE_COMPLETION_MISSING"
                );
            }

            selectedStopped =
                yes(after.output, "SELECTED_STOPPED");
            remainingCount = numberValue(
                after.output,
                "REMAINING_CONTROLLER_COUNT"
            );
            controlAlive =
                yes(after.output, "CONTROL_ALIVE");
            resourcesClean =
                !yes(after.output, "TUN") &&
                numberValue(after.output, "RULE4") === 0 &&
                numberValue(after.output, "RULE6") === 0 &&
                numberValue(after.output, "ROUTE4") === 0 &&
                numberValue(after.output, "ROUTE6") === 0;

            if (!selectedStopped ||
                    remainingCount !== 0 ||
                    !controlAlive ||
                    !resourcesClean) {
                throw new Error(
                    "STOP_CORE_POST_RECONCILIATION_FAILED"
                );
            }

            statusAfter = sendCommand(endpoint, "STATUS");
            statusAfterText =
                String(statusAfter.responseStatus || "")
                    .toUpperCase();
            if (!(statusAfterText === "STOPPED" ||
                    statusAfterText === "ALREADY_STOPPED")) {
                throw new Error(
                    "STATUS_AFTER_STOP_NOT_STOPPED_" +
                    safeStatus(statusAfterText)
                );
            }

            ping = sendCommand(endpoint, "PING");
            if (String(ping.responseStatus).toUpperCase() !==
                    "PONG") {
                throw new Error("FINAL_PING_NOT_PONG");
            }

            ok = true;
            next =
                "retry_runtime_core_lifecycle_with_controller_owned_process_contract";
        } catch (error) {
            failureCode = errorCode(error);
            try {
                failureText =
                    String(SBH.util.errorText(error));
            } catch (ignoredText) {
                failureText = String(error);
            }

            if (after !== null) {
                selectedStopped =
                    yes(after.output, "SELECTED_STOPPED");
                remainingCount = numberValue(
                    after.output,
                    "REMAINING_CONTROLLER_COUNT"
                );
                controlAlive =
                    yes(after.output, "CONTROL_ALIVE");
                resourcesClean =
                    !yes(after.output, "TUN") &&
                    numberValue(after.output, "RULE4") === 0 &&
                    numberValue(after.output, "RULE6") === 0 &&
                    numberValue(after.output, "ROUTE4") === 0 &&
                    numberValue(after.output, "ROUTE6") === 0;
            }

            if (after !== null &&
                    !controlAlive) {
                next =
                    "recover_runtime_control_service_after_stop_reconcile";
            } else if (after !== null &&
                    (!selectedStopped ||
                    (remainingCount !== null &&
                    remainingCount > 0))) {
                next =
                    "review_controller_owned_core_exact_stop_fallback";
            } else if (after !== null &&
                    selectedStopped &&
                    remainingCount === 0) {
                next =
                    "verify_runtime_stopped_state_after_partial_reconcile";
            } else {
                next =
                    "resolve_controller_owned_core_stop_reconcile_gate";
            }
        } finally {
            endpoint = null;
            endpointData = null;
        }

        return {
            ok: ok,
            stage:
                "production_stage53_retry3_runtime_stop_core_controller_owned_process_reconcile",
            authorizationId: AUTHORIZATION_ID,
            sourceDiagnosticId:
                SOURCE_DIAGNOSTIC_ID,
            authorizationConsumed: true,
            automaticRetryAllowed: false,
            manualOnly: true,
            reconciliationMode:
                "authenticated_stop_core_controller_owned_pid_exact_observation",
            preflightPassed:
                preflight !== null &&
                yes(preflight.output, "DONE") &&
                yes(preflight.output, "PREFLIGHT_OK"),
            blockingGate:
                ok || preflight === null ?
                    null : marker(
                        preflight.output,
                        "GATE"
                    ),
            preflightCode:
                preflight === null ?
                    null : numberValue(
                        preflight.output,
                        "CODE"
                    ),
            shellUid:
                preflight === null ?
                    null : numberValue(
                        preflight.output,
                        "UID"
                    ),
            productionConfigCheckPassed:
                preflight !== null &&
                numberValue(
                    preflight.output,
                    "CHECK"
                ) === 0,
            controlServicePid: controlPid,
            controlServiceProcessAliveBefore:
                preflight !== null &&
                controlPid !== null,
            controlServiceOwnerValidated:
                preflight !== null &&
                numberValue(
                    preflight.output,
                    "CUID"
                ) === 0 &&
                numberValue(
                    preflight.output,
                    "CGID"
                ) === 0,
            controllerOwnedCandidateCountBefore:
                preflight === null ?
                    null : numberValue(
                        preflight.output,
                        "CCOUNT"
                    ),
            selectedCorePid: selectedPid,
            selectedCoreParentPid:
                preflight === null ?
                    null : numberValue(
                        preflight.output,
                        "SELECTED_PPID"
                    ),
            selectedCoreUid:
                preflight === null ?
                    null : numberValue(
                        preflight.output,
                        "SELECTED_UID"
                    ),
            selectedCoreStateBefore:
                preflight === null ?
                    null : marker(
                        preflight.output,
                        "SELECTED_STATE"
                    ),
            selectedCoreArgumentCount:
                preflight === null ?
                    null : numberValue(
                        preflight.output,
                        "SELECTED_ARGC"
                    ),
            selectedCoreBinaryArgumentIndex:
                preflight === null ?
                    null : numberValue(
                        preflight.output,
                        "SELECTED_BIDX"
                    ),
            selectedCoreConfigArgumentIndex:
                preflight === null ?
                    null : numberValue(
                        preflight.output,
                        "SELECTED_CIDX"
                    ),
            selectedCoreControllerOwned:
                preflight !== null &&
                numberValue(
                    preflight.output,
                    "SELECTED_PPID"
                ) === controlPid &&
                numberValue(
                    preflight.output,
                    "SELECTED_UID"
                ) === 0 &&
                numberValue(
                    preflight.output,
                    "SELECTED_BIDX"
                ) === 0 &&
                numberValue(
                    preflight.output,
                    "SELECTED_CIDX"
                ) >= 1,
            statusBeforeCommandSent:
                statusBefore !== null,
            statusBeforeRequestCount:
                statusBefore === null ?
                    0 : statusBefore.requestCount,
            statusBeforeResponseStatus:
                statusBefore === null ?
                    null : statusBefore.responseStatus,
            statusBeforeCorrelationMatched:
                statusBefore !== null &&
                statusBefore.correlationMatched === true,
            runtimeClaimedRunningBefore:
                statusBeforeText === "RUNNING" ||
                statusBeforeText === "ALREADY_RUNNING" ||
                statusBeforeText === "STARTED",
            stopCoreCommandSent:
                stop !== null,
            stopCoreRequestCount:
                stop === null ? 0 : stop.requestCount,
            stopCoreResponseStatus:
                stop === null ?
                    null : stop.responseStatus,
            stopCoreCorrelationMatched:
                stop !== null &&
                stop.correlationMatched === true,
            selectedCoreStopped:
                selectedStopped,
            remainingControllerOwnedCoreCount:
                remainingCount,
            controlServiceRemainsRunning:
                controlAlive,
            statusAfterCommandSent:
                statusAfter !== null,
            statusAfterRequestCount:
                statusAfter === null ?
                    0 : statusAfter.requestCount,
            statusAfterResponseStatus:
                statusAfter === null ?
                    null : statusAfter.responseStatus,
            statusAfterCorrelationMatched:
                statusAfter !== null &&
                statusAfter.correlationMatched === true,
            runtimeClaimedStoppedAfter:
                statusAfterText === "STOPPED" ||
                statusAfterText === "ALREADY_STOPPED",
            finalPingSent:
                ping !== null,
            finalPingRequestCount:
                ping === null ? 0 : ping.requestCount,
            finalPingResponseStatus:
                ping === null ?
                    null : ping.responseStatus,
            finalPingCorrelationMatched:
                ping !== null &&
                ping.correlationMatched === true,
            tunInterfacePresentBefore:
                preflight !== null &&
                yes(preflight.output, "TUN"),
            tunInterfacePresentAfter:
                after !== null &&
                yes(after.output, "TUN"),
            reservedIpv4RuleCountAfter:
                after === null ?
                    null : numberValue(
                        after.output,
                        "RULE4"
                    ),
            reservedIpv6RuleCountAfter:
                after === null ?
                    null : numberValue(
                        after.output,
                        "RULE6"
                    ),
            reservedIpv4RouteCountAfter:
                after === null ?
                    null : numberValue(
                        after.output,
                        "ROUTE4"
                    ),
            reservedIpv6RouteCountAfter:
                after === null ?
                    null : numberValue(
                        after.output,
                        "ROUTE6"
                    ),
            reservedNetworkResourcesUnchanged:
                resourcesClean,
            directProcessSignalSent: false,
            coreStartInvoked: false,
            coreStopInvoked:
                stop !== null,
            runtimeFilesModified: false,
            configModified: false,
            stagingModified: false,
            tunCreated: false,
            routeModified: false,
            dnsModified: false,
            firewallModified: false,
            networkConnectivityTestInvoked: false,
            networkTrafficGeneratedByProbe: false,
            sensitiveReferencesCleared: true,
            tokenValueExposed: false,
            socketNameValueExposed: false,
            destructiveOperations: false,
            readyForLifecycleRetry:
                ok,
            nextAuthorizedOperation: next,
            errorCode:
                ok ? null : failureCode,
            error:
                ok || failureText === null ?
                    null :
                    String(failureText).substring(
                        0,
                        256
                    ),
            preflightShellCode:
                preflight === null ?
                    null : preflight.code,
            afterStopShellCode:
                after === null ?
                    null : after.code,
            shellCodeAuthoritative: false,
            shellTransportCodeAnomalous:
                (preflight !== null &&
                preflight.code !== 0) ||
                (after !== null &&
                after.code !== 0),
            durationMs: now() - startedAt,
            timestamp: now()
        };
    }

    function reconcileAsync(callback) {
        if (typeof callback !== "function") {
            throw new Error(
                "Stage53 Retry3 callback unavailable"
            );
        }
        if (busy) {
            callback({
                ok: false,
                stage:
                    "production_stage53_retry3_runtime_stop_core_controller_owned_process_reconcile",
                errorCode:
                    "CONTROLLER_OWNED_CORE_STOP_RECONCILE_ALREADY_RUNNING",
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
                        output = reconcile();
                    } catch (error) {
                        output = {
                            ok: false,
                            stage:
                                "production_stage53_retry3_runtime_stop_core_controller_owned_process_reconcile",
                            authorizationId:
                                AUTHORIZATION_ID,
                            authorizationConsumed: true,
                            automaticRetryAllowed: false,
                            coreStartInvoked: false,
                            coreStopInvoked: false,
                            directProcessSignalSent: false,
                            runtimeFilesModified: false,
                            tunCreated: false,
                            routeModified: false,
                            destructiveOperations: false,
                            errorCode:
                                "CONTROLLER_OWNED_CORE_STOP_RECONCILE_FAILED",
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
            "SingBoxHub-Stage53Retry3StopReconcile"
        ).start();

        return {
            accepted: true,
            busy: false
        };
    }

    function buildCard() {
        var card = W.card(17);
        var title = W.text(
            "Stage 53 Retry 3：控制器持有 Core 停止归一化",
            17,
            C.navy,
            true
        );
        var note = W.text(
            "Retry 2 已确认 Runtime STATUS 为 RUNNING，且存在一个由控制服务 PID 19373 直接持有的 sing-box Core 候选：" +
            "argv0 为生产二进制、生产配置位于参数 5，但不符合旧四参数匹配规则。" +
            "本阶段先精确锁定唯一控制器持有进程，再通过已认证 Runtime 发送一次 STOP_CORE，" +
            "确认该 PID 消失、控制服务继续运行、STATUS 为 STOPPED，并执行一次最终 PING。" +
            "不会发送系统进程信号，不修改配置、TUN、路由、DNS 或防火墙。",
            11.4,
            C.secondary,
            false
        );
        var resultText = W.text(
            JSON.stringify({
                ready: true,
                authorizationId:
                    AUTHORIZATION_ID,
                sourceDiagnosticId:
                    SOURCE_DIAGNOSTIC_ID,
                requiredControllerOwnedCandidateCount: 1,
                stopCoreRequestMaximum: 1,
                statusRequestMaximum: 2,
                finalPingMaximum: 1,
                directProcessSignalEnabled: false,
                coreStartEnabled: false,
                runtimeFileWriteEnabled: false,
                tunEnabled: false,
                routeWriteEnabled: false,
                automaticRetryAllowed: false
            }, null, 2),
            10.3,
            C.secondary,
            false
        );
        var button = W.button(
            "停止并核对控制器持有 Core",
            "shield",
            C.orange,
            C.orangeSoft,
            function () {
                resultText.setText(
                    "正在锁定控制器持有 Core，发送一次 STOP_CORE 并核对最终状态。"
                );
                SBH.util.toast(
                    "正在执行 Core 停止归一化"
                );
                reconcileAsync(function (result) {
                    resultText.setText(
                        JSON.stringify(result, null, 2)
                    );
                    SBH.util.toast(
                        result.ok === true ?
                            "控制器持有 Core 已安全停止" :
                            "Core 停止归一化存在待处理项"
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
        throw new Error(
            "Stage53 Retry3 dependencies unavailable"
        );
    }

    SBH.runtimeControllerOwnedCoreStopReconcile = {
        version: 1,
        runAsync: reconcileAsync,
        authorizationId: AUTHORIZATION_ID,
        sourceDiagnosticId:
            SOURCE_DIAGNOSTIC_ID,
        manualOnly: true,
        automaticRetryAllowed: false,
        requiredControllerOwnedCandidateCount: 1,
        stopCoreRequestMaximum: 1,
        statusRequestMaximum: 2,
        finalPingMaximum: 1,
        directProcessSignalEnabled: false,
        coreStartEnabled: false,
        runtimeFileWriteEnabled: false,
        tunEnabled: false,
        routeWriteEnabled: false
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

        output.runtimeControllerOwnedCoreStopReconcileVersion = 1;
        output.runtimeControllerOwnedCoreStopReconcileReady = true;
        output.runtimeControllerOwnedCoreStopReconcileAuthorizationId =
            AUTHORIZATION_ID;
        output.runtimeControllerOwnedCoreStopReconcileManualOnly = true;
        output.runtimeControllerOwnedCoreStopReconcileAutomaticRetry =
            false;
        output.runtimeControllerOwnedCoreStopReconcileCandidateCount = 1;
        output.runtimeControllerOwnedCoreStopReconcileStopMaximum = 1;
        output.runtimeControllerOwnedCoreStopReconcileStatusMaximum = 2;
        output.runtimeControllerOwnedCoreStopReconcileFinalPingMaximum = 1;
        output.runtimeControllerOwnedCoreStopReconcileDirectSignalEnabled =
            false;
        output.writeOperationsLocked = false;
        output.destructiveOperations = false;
        return output;
    };
}());
