/* SingBoxHub Runtime JAR static interface inspection. Rhino ES5 only. */
SBH.versions.runtimeJarStaticInspection = 1;

(function () {
    var P = Packages;
    var File = P.java.io.File;
    var JavaString = P.java.lang.String;
    var Base64 = P.android.util.Base64;
    var ShellCommand =
        P.tornaco.apps.shortx.core.proto.action.ShellCommand;
    var CACHE_SCHEMA = 1;
    var MAX_DUMP_CHARS = 131072;
    var cacheFile = new File(
        SBH.paths.cacheDir,
        "runtime_jar_static_inspection.json"
    );
    var cachedInspection = SBH.files.readJson(cacheFile, null);
    var cachedInputKey = "";

    function pendingInspection(state, error) {
        return {
            schemaVersion: CACHE_SCHEMA,
            state: state || "checking",
            checking: state === undefined || state === null ||
                state === "checking",
            endpointEvidenceAvailable: false,
            runtimeJarDeclared: false,
            runtimeJarPath: "",
            runtimeJarExists: false,
            runtimeJarCanonicalPathMatched: false,
            runtimeJarOwnerUid: -1,
            runtimeJarOwnerGid: -1,
            runtimeJarMode: "",
            runtimeJarSize: -1,
            runtimeJarMtimeEpochSeconds: 0,
            runtimeJarSha256Prefix: "",
            dexdumpAvailable: false,
            dexdumpPath: "",
            archiveListingAvailable: false,
            dexEntryCount: 0,
            classEntryCount: 0,
            clientClassName: "",
            serverClassName: "",
            socketNameDeclared: false,
            clientClassFound: false,
            serverClassFound: false,
            clientClass: null,
            serverClass: null,
            clientMethods: [],
            serverMethods: [],
            constructorCandidates: [],
            statusMethodCandidates: [],
            requestMethodCandidates: [],
            lifecycleMethodCandidates: [],
            responseTypeCandidates: [],
            methodSignatureCount: 0,
            dumpTruncated: false,
            classLoadingPerformed: false,
            classInitializationPerformed: false,
            classInstantiationPerformed: false,
            socketConnectionAttempted: false,
            methodInvocationPerformed: false,
            temporaryExtractionPerformed: false,
            runtimeFilesModified: false,
            authenticationValueUsed: false,
            authenticationValueExposed: false,
            rawEndpointExposed: false,
            staticInspectionOnly: true,
            adapterInvocationEnabled: false,
            writeOperationsLocked: true,
            destructiveOperations: false,
            stale: false,
            error: error || null,
            checkedAt: SBH.util.now()
        };
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
            .setId("JS#SingBoxHubRuntimeJarStaticInspection")
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

    function parseMap(text) {
        var map = {};
        var lines = String(text || "").split(/\r?\n/);
        var i;
        var fields;
        for (i = 0; i < lines.length; i += 1) {
            fields = lines[i].split("\t");
            if (fields.length >= 2) {
                map[String(fields[0])] =
                    String(fields.slice(1).join("\t"));
            }
        }
        return map;
    }

    function jsonStringField(text, key) {
        var escapedKey = String(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        var pattern = new RegExp(
            "\\\"" + escapedKey +
            "\\\"\\s*:\\s*\\\"((?:\\\\.|[^\\\"\\\\])*)\\\""
        );
        var match = pattern.exec(String(text || ""));
        if (!match) {
            return "";
        }
        try {
            return String(JSON.parse("\"" + match[1] + "\""));
        } catch (ignored) {
            return "";
        }
    }

    function endpointEvidence() {
        var probe = null;
        var text = "";
        var evidence;
        try {
            if (SBH.runtime &&
                    typeof SBH.runtime.endpointProbe === "function") {
                probe = SBH.runtime.endpointProbe();
            }
        } catch (ignoredProbe) {}
        if (!probe || probe.exists !== true || !probe.data) {
            return null;
        }
        try {
            text = String(new JavaString(
                Base64.decode(String(probe.data), Base64.DEFAULT),
                "UTF-8"
            ));
        } catch (error) {
            return null;
        }
        evidence = {
            runtimeJar: jsonStringField(text, "runtimeJar"),
            clientClass: jsonStringField(text, "clientClass"),
            serverClass: jsonStringField(text, "serverClass"),
            socketName: jsonStringField(text, "socketName"),
            endpointSize: String(probe.size || ""),
            endpointMtime: String(probe.mtime || ""),
            endpointSha: String(probe.sha || "")
        };
        return evidence;
    }

    function validClassName(value) {
        return /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)+$/.test(
            String(value || "")
        );
    }

    function validAbsoluteJar(value) {
        var text = String(value || "");
        return /^\/[A-Za-z0-9_.$+@%:,=~\/-]{1,510}\.jar$/i.test(text) &&
            text.indexOf("/../") < 0 && text.indexOf("//") < 0;
    }

    function validSocketName(value) {
        var text = String(value || "");
        return text.length > 0 && text.length <= 160 &&
            !/[\r\n\t]/.test(text);
    }

    function descriptor(className) {
        return "L" + String(className).replace(/\./g, "/") + ";";
    }

    function classEntry(className) {
        return String(className).replace(/\./g, "/") + ".class";
    }

    function buildCommand(runtimeRoot, evidence) {
        var jar = String(evidence.runtimeJar);
        var clientDescriptor = descriptor(evidence.clientClass);
        var serverDescriptor = descriptor(evidence.serverClass);
        var clientEntry = classEntry(evidence.clientClass);
        var serverEntry = classEntry(evidence.serverClass);
        var expectedPrefix = String(runtimeRoot || "") + "/";
        var awkProgram = [
            "BEGIN { capture=0; header=\"\"; }",
            "/^Class #[0-9]+/ {",
            "  if (capture) { print \"__SBH_CLASS_END__\"; }",
            "  capture=0; header=$0; next;",
            "}",
            "/Class descriptor/ {",
            "  if (index($0, \"\\047\" client \"\\047\") > 0) {",
            "    capture=1; print \"__SBH_CLIENT_BEGIN__\"; print header; print $0; next;",
            "  }",
            "  if (index($0, \"\\047\" server \"\\047\") > 0) {",
            "    capture=1; print \"__SBH_SERVER_BEGIN__\"; print header; print $0; next;",
            "  }",
            "}",
            "{ if (capture) { print $0; } }",
            "END { if (capture) { print \"__SBH_CLASS_END__\"; } }"
        ].join("\n");
        var lines = [
            "TOYBOX=/system/bin/toybox",
            "JAR=" + shellQuote(jar),
            "EXPECTED_PREFIX=" + shellQuote(expectedPrefix),
            "CLIENT_DESC=" + shellQuote(clientDescriptor),
            "SERVER_DESC=" + shellQuote(serverDescriptor),
            "CLIENT_ENTRY=" + shellQuote(clientEntry),
            "SERVER_ENTRY=" + shellQuote(serverEntry),
            "if [ -f \"$JAR\" ]; then",
            "  printf 'jarExists\\t1\\n'",
            "  REAL=\"$($TOYBOX readlink -f \"$JAR\" 2>/dev/null)\"",
            "  printf 'jarReal\\t%s\\n' \"$REAL\"",
            "  case \"$REAL\" in \"$EXPECTED_PREFIX\"*) printf 'jarPathMatched\\t1\\n' ;; *) printf 'jarPathMatched\\t0\\n' ;; esac",
            "  printf 'jarUid\\t%s\\n' \"$($TOYBOX stat -c '%u' \"$JAR\" 2>/dev/null)\"",
            "  printf 'jarGid\\t%s\\n' \"$($TOYBOX stat -c '%g' \"$JAR\" 2>/dev/null)\"",
            "  printf 'jarMode\\t%s\\n' \"$($TOYBOX stat -c '%a' \"$JAR\" 2>/dev/null)\"",
            "  printf 'jarSize\\t%s\\n' \"$($TOYBOX stat -c '%s' \"$JAR\" 2>/dev/null)\"",
            "  printf 'jarMtime\\t%s\\n' \"$($TOYBOX stat -c '%Y' \"$JAR\" 2>/dev/null)\"",
            "  SHA_VALUE=",
            "  if [ -x /system/bin/sha256sum ]; then",
            "    SHA_VALUE=\"$(/system/bin/sha256sum \"$JAR\" 2>/dev/null | $TOYBOX awk '{print $1}')\"",
            "  else",
            "    SHA_VALUE=\"$($TOYBOX sha256sum \"$JAR\" 2>/dev/null | $TOYBOX awk '{print $1}')\"",
            "  fi",
            "  printf 'jarSha\\t%s\\n' \"$SHA_VALUE\"",
            "else",
            "  printf 'jarExists\\t0\\n'",
            "fi",
            "DEXDUMP=",
            "for CANDIDATE in /apex/com.android.art/bin/dexdump /system/bin/dexdump /system/bin/dexdump64; do",
            "  if [ -x \"$CANDIDATE\" ]; then DEXDUMP=\"$CANDIDATE\"; break; fi",
            "done",
            "printf 'dexdumpPath\\t%s\\n' \"$DEXDUMP\"",
            "ARCHIVE_TOOL=",
            "if $TOYBOX unzip -l \"$JAR\" >/dev/null 2>&1; then",
            "  ARCHIVE_TOOL=toybox_unzip",
            "  LIST=\"$($TOYBOX unzip -l \"$JAR\" 2>/dev/null)\"",
            "elif [ -x /system/bin/unzip ] && /system/bin/unzip -l \"$JAR\" >/dev/null 2>&1; then",
            "  ARCHIVE_TOOL=system_unzip",
            "  LIST=\"$(/system/bin/unzip -l \"$JAR\" 2>/dev/null)\"",
            "else",
            "  LIST=",
            "fi",
            "printf 'archiveTool\\t%s\\n' \"$ARCHIVE_TOOL\"",
            "if [ -n \"$LIST\" ]; then",
            "  printf 'dexEntryCount\\t%s\\n' \"$(printf '%s\\n' \"$LIST\" | $TOYBOX awk '$NF ~ /^classes([0-9]+)?\\.dex$/ {n++} END {print n+0}')\"",
            "  printf 'classEntryCount\\t%s\\n' \"$(printf '%s\\n' \"$LIST\" | $TOYBOX awk '$NF ~ /\\.class$/ {n++} END {print n+0}')\"",
            "  printf 'clientArchiveEntry\\t%s\\n' \"$(printf '%s\\n' \"$LIST\" | $TOYBOX awk -v target=\"$CLIENT_ENTRY\" '$NF == target {found=1} END {print found+0}')\"",
            "  printf 'serverArchiveEntry\\t%s\\n' \"$(printf '%s\\n' \"$LIST\" | $TOYBOX awk -v target=\"$SERVER_ENTRY\" '$NF == target {found=1} END {print found+0}')\"",
            "fi",
            "if [ -n \"$DEXDUMP\" ] && [ -f \"$JAR\" ]; then",
            "  FILTERED=\"$(\"$DEXDUMP\" \"$JAR\" 2>/dev/null | $TOYBOX awk -v client=\"$CLIENT_DESC\" -v server=\"$SERVER_DESC\" " + shellQuote(awkProgram) + ")\"",
            "  DUMP_SIZE=${#FILTERED}",
            "  DUMP_TRUNCATED=0",
            "  if [ \"$DUMP_SIZE\" -gt " + MAX_DUMP_CHARS + " ]; then",
            "    FILTERED=\"$(printf '%s' \"$FILTERED\" | $TOYBOX head -c " + MAX_DUMP_CHARS + ")\"",
            "    DUMP_TRUNCATED=1",
            "  fi",
            "  printf 'dumpChars\\t%s\\n' \"${#FILTERED}\"",
            "  printf 'dumpTruncated\\t%s\\n' \"$DUMP_TRUNCATED\"",
            "  DUMP_DATA=\"$(printf '%s' \"$FILTERED\" | $TOYBOX base64 2>/dev/null | $TOYBOX tr -d '\\r\\n')\"",
            "  printf 'dumpData\\t%s\\n' \"$DUMP_DATA\"",
            "fi"
        ];
        return "/system/bin/toybox timeout 15 /system/bin/sh -c " +
            shellQuote(lines.join("\n"));
    }

    function numberValue(value, fallback) {
        var parsed = Number(value);
        return isFinite(parsed) ? parsed : fallback;
    }

    function boolValue(value) {
        return String(value || "0") === "1";
    }

    function unique(output, value, limit) {
        var text = String(value || "");
        var i;
        if (!text || output.length >= Number(limit || 64)) {
            return;
        }
        for (i = 0; i < output.length; i += 1) {
            if (output[i] === text) {
                return;
            }
        }
        output.push(text);
    }

    function methodReturnType(descriptorValue) {
        var text = String(descriptorValue || "");
        var index = text.lastIndexOf(")");
        return index >= 0 ? text.substring(index + 1) : "";
    }

    function parseClassSections(text) {
        var result = {client: null, server: null};
        var lines = String(text || "").split(/\r?\n/);
        var current = null;
        var method = null;
        var methodKind = "unknown";
        var i;
        var line;
        var match;

        function finishMethod() {
            if (current && method && method.name && method.descriptor) {
                method.returnType = methodReturnType(method.descriptor);
                current.methods.push(method);
            }
            method = null;
        }

        function finishClass() {
            finishMethod();
            current = null;
            methodKind = "unknown";
        }

        for (i = 0; i < lines.length; i += 1) {
            line = String(lines[i]);
            if (line === "__SBH_CLIENT_BEGIN__") {
                finishClass();
                current = {role: "client", descriptor: "", superclass: "", methods: []};
                result.client = current;
                continue;
            }
            if (line === "__SBH_SERVER_BEGIN__") {
                finishClass();
                current = {role: "server", descriptor: "", superclass: "", methods: []};
                result.server = current;
                continue;
            }
            if (line === "__SBH_CLASS_END__") {
                finishClass();
                continue;
            }
            if (!current) {
                continue;
            }
            match = /Class descriptor\s*:\s*'([^']+)'/.exec(line);
            if (match) {
                current.descriptor = String(match[1]);
                continue;
            }
            match = /Superclass\s*:\s*'([^']+)'/.exec(line);
            if (match) {
                current.superclass = String(match[1]);
                continue;
            }
            if (/Direct methods\s*-/.test(line)) {
                finishMethod();
                methodKind = "direct";
                continue;
            }
            if (/Virtual methods\s*-/.test(line)) {
                finishMethod();
                methodKind = "virtual";
                continue;
            }
            if (/^\s*#\d+\s*:/.test(line)) {
                finishMethod();
                method = {
                    name: "",
                    descriptor: "",
                    returnType: "",
                    access: "",
                    kind: methodKind
                };
                continue;
            }
            if (!method) {
                continue;
            }
            match = /name\s*:\s*'([^']+)'/.exec(line);
            if (match) {
                method.name = String(match[1]);
                continue;
            }
            match = /type\s*:\s*'([^']+)'/.exec(line);
            if (match) {
                method.descriptor = String(match[1]);
                continue;
            }
            match = /access\s*:\s*(.+)$/.exec(line);
            if (match) {
                method.access = String(match[1]).replace(/^\s+|\s+$/g, "");
            }
        }
        finishClass();
        return result;
    }

    function collectCandidates(inspection) {
        var all = [];
        var i;
        var method;
        var name;
        var responseType;
        var constructors = [];
        var statuses = [];
        var requests = [];
        var lifecycles = [];
        var responses = [];

        function addMethods(values, role) {
            var j;
            var copy;
            values = values || [];
            for (j = 0; j < values.length; j += 1) {
                copy = values[j];
                copy.role = role;
                all.push(copy);
            }
        }

        addMethods(inspection.clientMethods, "client");
        addMethods(inspection.serverMethods, "server");
        for (i = 0; i < all.length; i += 1) {
            method = all[i];
            name = String(method.name || "");
            if (name === "<init>" || name === "<clinit>") {
                constructors.push(method);
            }
            if (/(status|state|health|running|alive|ping|pid)/i.test(name)) {
                statuses.push(method);
            }
            if (/(request|send|call|execute|command|invoke|transact|query)/i.test(name)) {
                requests.push(method);
            }
            if (/^(start|stop|close|shutdown|connect|disconnect|open)$/i.test(name)) {
                lifecycles.push(method);
            }
            responseType = String(method.returnType || "");
            if (responseType && responseType !== "V") {
                unique(responses, responseType, 48);
            }
        }
        inspection.constructorCandidates = constructors;
        inspection.statusMethodCandidates = statuses;
        inspection.requestMethodCandidates = requests;
        inspection.lifecycleMethodCandidates = lifecycles;
        inspection.responseTypeCandidates = responses;
        inspection.methodSignatureCount = all.length;
    }

    function inputKey(evidence) {
        if (!evidence) {
            return "";
        }
        return [
            String(evidence.runtimeJar || ""),
            String(evidence.clientClass || ""),
            String(evidence.serverClass || ""),
            String(evidence.socketName || ""),
            String(evidence.endpointSize || ""),
            String(evidence.endpointMtime || ""),
            String(evidence.endpointSha || "")
        ].join("|");
    }

    function correctProtocol(status, evidence, inspection) {
        var discovery = status ? status.protocolDiscovery : null;
        var plan = status ? status.protocolAdapterPlan : null;
        var original;
        if (!evidence || !validSocketName(evidence.socketName) ||
                !validClassName(evidence.clientClass) ||
                !validClassName(evidence.serverClass) ||
                !validAbsoluteJar(evidence.runtimeJar)) {
            return;
        }
        if (discovery && discovery.parseOk === true) {
            original = String(discovery.transportKind || "unknown");
            discovery.transportKind = "unix_socket";
            discovery.transportScore = Math.max(
                Number(discovery.transportScore || 0),
                14
            );
            discovery.transportAmbiguous = false;
            discovery.adapterState = "transport_identified";
            discovery.readyForAdapterImplementation = true;
            discovery.transportCorrection = {
                applied: original !== "unix_socket",
                originalTransport: original,
                correctedTransport: "unix_socket",
                reason: "JAVA_RUNTIME_SOCKET_BOOTSTRAP_FIELDS"
            };
            discovery.transportCandidates = [
                {kind: "unix_socket", score: 14},
                {kind: "shell_cli", score: 0}
            ];
        }
        if (plan) {
            original = String(plan.selectedTransport || "unknown");
            plan.selectedTransport = "unix_socket";
            plan.adapterKind = "readonly_unix_socket_status_adapter";
            plan.transportCorrection = {
                applied: original !== "unix_socket",
                originalTransport: original,
                correctedTransport: "unix_socket",
                reason: "JAVA_RUNTIME_SOCKET_BOOTSTRAP_FIELDS"
            };
            plan.jarStaticInspectionState = inspection ?
                String(inspection.state || "checking") : "checking";
            plan.jarMethodSignaturesIdentified = inspection &&
                inspection.methodSignatureCount > 0;
            plan.adapterInvocationEnabled = false;
            plan.writeOperationsLocked = true;
            plan.destructiveOperations = false;
        }
        if (status && status.writeGate) {
            status.writeGate.protocolTransport = "unix_socket";
            status.writeGate.jarStaticInspection = inspection;
        }
    }

    function persist(inspection) {
        if (!inspection || inspection.checking === true) {
            return;
        }
        cachedInspection = inspection;
        cachedInputKey = String(inspection.inputKey || "");
        try {
            SBH.files.writeJson(cacheFile, inspection);
        } catch (error) {
            SBH.log.warn("jar.inspect.cache", SBH.util.errorText(error));
        }
    }

    function inspectBlocking(status, force) {
        var evidence = endpointEvidence();
        var key = inputKey(evidence);
        var shell;
        var map;
        var dumpText = "";
        var parsed;
        var inspection;
        var runtimeRoot = status ? String(status.runtimeRoot || "") : "";

        if (!evidence) {
            inspection = pendingInspection(
                status && status.checking === true ?
                    "checking" : "endpoint_evidence_unavailable",
                null
            );
            correctProtocol(status, evidence, inspection);
            return inspection;
        }
        if (!force && cachedInspection &&
                cachedInspection.stale !== true &&
                cachedInputKey === key) {
            correctProtocol(status, evidence, cachedInspection);
            return cachedInspection;
        }
        if (!validAbsoluteJar(evidence.runtimeJar)) {
            inspection = pendingInspection(
                "runtime_jar_path_invalid",
                "runtimeJar is not a validated absolute JAR path"
            );
            inspection.endpointEvidenceAvailable = true;
            inspection.runtimeJarDeclared = !!evidence.runtimeJar;
            correctProtocol(status, evidence, inspection);
            persist(inspection);
            return inspection;
        }
        if (!validClassName(evidence.clientClass) ||
                !validClassName(evidence.serverClass)) {
            inspection = pendingInspection(
                "runtime_class_name_invalid",
                "clientClass or serverClass is invalid"
            );
            inspection.endpointEvidenceAvailable = true;
            inspection.runtimeJarDeclared = true;
            inspection.runtimeJarPath = evidence.runtimeJar;
            correctProtocol(status, evidence, inspection);
            persist(inspection);
            return inspection;
        }

        try {
            shell = executeShell(buildCommand(runtimeRoot, evidence));
            map = parseMap(shell.out);
            if (map.dumpData) {
                dumpText = String(new JavaString(
                    Base64.decode(String(map.dumpData), Base64.DEFAULT),
                    "UTF-8"
                ));
            }
            parsed = parseClassSections(dumpText);
            inspection = pendingInspection("signatures_identified", null);
            inspection.checking = false;
            inspection.endpointEvidenceAvailable = true;
            inspection.runtimeJarDeclared = true;
            inspection.runtimeJarPath = String(map.jarReal || evidence.runtimeJar);
            inspection.runtimeJarExists = boolValue(map.jarExists);
            inspection.runtimeJarCanonicalPathMatched =
                boolValue(map.jarPathMatched);
            inspection.runtimeJarOwnerUid =
                numberValue(map.jarUid, -1);
            inspection.runtimeJarOwnerGid =
                numberValue(map.jarGid, -1);
            inspection.runtimeJarMode = String(map.jarMode || "");
            inspection.runtimeJarSize = numberValue(map.jarSize, -1);
            inspection.runtimeJarMtimeEpochSeconds =
                numberValue(map.jarMtime, 0);
            inspection.runtimeJarSha256Prefix =
                String(map.jarSha || "").substring(0, 16);
            inspection.dexdumpAvailable = !!String(map.dexdumpPath || "");
            inspection.dexdumpPath = String(map.dexdumpPath || "");
            inspection.archiveListingAvailable =
                !!String(map.archiveTool || "");
            inspection.archiveListingTool = String(map.archiveTool || "");
            inspection.dexEntryCount = numberValue(map.dexEntryCount, 0);
            inspection.classEntryCount = numberValue(map.classEntryCount, 0);
            inspection.clientArchiveEntry =
                boolValue(map.clientArchiveEntry);
            inspection.serverArchiveEntry =
                boolValue(map.serverArchiveEntry);
            inspection.clientClassName = evidence.clientClass;
            inspection.serverClassName = evidence.serverClass;
            inspection.socketNameDeclared =
                validSocketName(evidence.socketName);
            inspection.clientClass = parsed.client;
            inspection.serverClass = parsed.server;
            inspection.clientClassFound = parsed.client !== null;
            inspection.serverClassFound = parsed.server !== null;
            inspection.clientMethods = parsed.client ?
                parsed.client.methods : [];
            inspection.serverMethods = parsed.server ?
                parsed.server.methods : [];
            inspection.dumpTruncated = boolValue(map.dumpTruncated);
            inspection.dumpCharacters = numberValue(map.dumpChars, 0);
            inspection.shellExitCode = shell.code;
            inspection.shellError = shell.err;
            inspection.inputKey = key;
            inspection.stale = false;
            collectCandidates(inspection);

            if (!inspection.runtimeJarExists) {
                inspection.state = "runtime_jar_missing";
            } else if (!inspection.runtimeJarCanonicalPathMatched) {
                inspection.state = "runtime_jar_path_mismatch";
            } else if (!inspection.dexdumpAvailable) {
                inspection.state = "dexdump_unavailable";
            } else if (!inspection.clientClassFound &&
                    !inspection.serverClassFound) {
                inspection.state = "target_classes_not_found";
            } else if (!inspection.clientClassFound ||
                    !inspection.serverClassFound) {
                inspection.state = "partial_signatures_identified";
            } else if (inspection.methodSignatureCount === 0) {
                inspection.state = "classes_found_without_methods";
            } else {
                inspection.state = "signatures_identified";
            }
            inspection.checkedAt = SBH.util.now();
            correctProtocol(status, evidence, inspection);
            persist(inspection);
            return inspection;
        } catch (error) {
            inspection = pendingInspection(
                "jar_static_inspection_failed",
                SBH.util.errorText(error)
            );
            inspection.endpointEvidenceAvailable = true;
            inspection.runtimeJarDeclared = true;
            inspection.runtimeJarPath = evidence.runtimeJar;
            inspection.clientClassName = evidence.clientClass;
            inspection.serverClassName = evidence.serverClass;
            inspection.socketNameDeclared =
                validSocketName(evidence.socketName);
            inspection.inputKey = key;
            correctProtocol(status, evidence, inspection);
            persist(inspection);
            return inspection;
        }
    }

    function attach(status, inspection) {
        status = status || {};
        inspection = inspection || cachedInspection ||
            pendingInspection("checking", null);
        status.runtimeJarStaticInspection = inspection;
        correctProtocol(status, endpointEvidence(), inspection);
        return status;
    }

    function install() {
        var runtime = SBH.runtime;
        var oldStatus = runtime.status;
        var oldRefresh = runtime.refresh;
        var oldRequest = runtime.request;
        var oldAppStart = SBH.app.start;

        runtime.status = function () {
            return attach(oldStatus(), cachedInspection);
        };

        runtime.refresh = function () {
            var status = oldRefresh();
            var inspection = inspectBlocking(status, false);
            return attach(status, inspection);
        };

        runtime.request = function (requestValue) {
            var command = requestValue && requestValue.command ?
                String(requestValue.command) : "";
            var requestId = requestValue && requestValue.requestId ?
                String(requestValue.requestId) : "";
            var status;
            var inspection;
            var result;

            if (command === "runtime.jar_static_inspection") {
                status = oldRefresh();
                inspection = inspectBlocking(status, true);
                status = attach(status, inspection);
                return {
                    ok: inspection.state === "signatures_identified" ||
                        inspection.state === "partial_signatures_identified",
                    requestId: requestId,
                    code: inspection.state === "signatures_identified" ?
                        "JAR_SIGNATURES_IDENTIFIED" :
                        "JAR_STATIC_INSPECTION_INCOMPLETE",
                    stateBefore: status.coreRunning ? "running" : "stopped",
                    stateAfter: status.coreRunning ? "running" : "stopped",
                    message: inspection.state === "signatures_identified" ?
                        "Runtime JAR 指定类的方法签名已静态识别" :
                        "Runtime JAR 静态识别尚未完整",
                    data: inspection
                };
            }

            result = oldRequest(requestValue);
            try {
                status = runtime.status();
                if (result && result.data &&
                        status.runtimeJarStaticInspection) {
                    result.data.runtimeJarStaticInspection =
                        status.runtimeJarStaticInspection;
                }
            } catch (ignoredResult) {}
            return result;
        };

        runtime.jarStaticInspection = function () {
            return runtime.request({
                requestId: "sbh-jar-static-" + SBH.util.now(),
                command: "runtime.jar_static_inspection"
            });
        };

        SBH.app.start = function () {
            var result = oldAppStart();
            var status;
            var inspection;
            try {
                status = runtime.status();
                inspection = status.runtimeJarStaticInspection ||
                    pendingInspection("checking", null);
            } catch (error) {
                inspection = pendingInspection(
                    "jar_static_status_unavailable",
                    SBH.util.errorText(error)
                );
            }
            result.runtimeJarStaticInspection =
                String(inspection.state || "checking");
            result.runtimeJarStaticInspectionDetails = inspection;
            result.writeOperationsLocked = true;
            result.destructiveOperations = false;
            return result;
        };
    }

    if (!cachedInspection ||
            Number(cachedInspection.schemaVersion) !== CACHE_SCHEMA) {
        cachedInspection = null;
    } else {
        cachedInputKey = String(cachedInspection.inputKey || "");
        cachedInspection.stale = true;
        cachedInspection.source = "persisted_cache";
    }

    install();
}());
