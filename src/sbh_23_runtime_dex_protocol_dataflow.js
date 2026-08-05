/* SingBoxHub Runtime DEX protocol data-flow inspection. Rhino ES5 only. */
SBH.versions.runtimeDexProtocolDataflow = 1;
(function () {
var P = Packages;
var File = P.java.io.File;
var JavaString = P.java.lang.String;
var Base64 = P.android.util.Base64;
var ShellCommand = P.tornaco.apps.shortx.core.proto.action.ShellCommand;
var SCHEMA = 1;
var MAX_DEX = 131072;
var cacheFile = new File(SBH.paths.cacheDir, "runtime_dex_protocol_dataflow.json");
var cache = SBH.files.readJson(cacheFile, null);
var cacheKey = "";

function blank(state, error) {
    return {
        schemaVersion: SCHEMA,
        state: state || "checking",
        checking: !state || state === "checking",
        runtimeJarDeclared: false,
        runtimeJarPath: "",
        runtimeJarExists: false,
        runtimeJarCanonicalPathMatched: false,
        runtimeJarSize: -1,
        runtimeJarSha256Prefix: "",
        dexPayloadStatus: "not_requested",
        dexBytesTransferred: 0,
        dexTransferLimitBytes: MAX_DEX,
        dexVersion: "",
        clientClassName: "",
        serverClassName: "",
        clientMainCodeFound: false,
        serverMainCodeFound: false,
        clientArgumentMap: [],
        serverArgumentMap: [],
        clientCallTrace: [],
        serverCallTrace: [],
        requestWriteSequence: [],
        serverReadSequence: [],
        responseWriteSequence: [],
        clientReadSequence: [],
        clientSocketAddressSources: [],
        serverSocketNameSources: [],
        fileCreateSideEffects: [],
        runtimeExecEvidence: [],
        processControlEvidence: [],
        stringComparisonEvidence: [],
        branchEvidence: [],
        commandBranches: [],
        commandCarrierCandidates: [],
        authenticationCarrierCandidates: [],
        correlationEvidence: [],
        pingRequestLine: null,
        pingExpectedResponses: [],
        socketAddressSource: null,
        authenticationCarrier: null,
        commandCarrier: null,
        lineFramingConfirmed: false,
        oneConnectionOneResponseConfirmed: false,
        correlationState: "unknown",
        commandCarrierState: "unknown",
        authenticationCarrierState: "unknown",
        framingState: "unknown",
        pingContractState: "unknown",
        readOnlyProbeContractReady: false,
        dataflowEvidenceAvailable: false,
        classLoadingPerformed: false,
        classInitializationPerformed: false,
        classInstantiationPerformed: false,
        socketConnectionAttempted: false,
        methodInvocationPerformed: false,
        dexExecuted: false,
        temporaryFilesCreated: false,
        runtimeFilesModified: false,
        authenticationValueRead: false,
        authenticationValueUsed: false,
        authenticationValueExposed: false,
        rawDexExposed: false,
        rawEndpointExposed: false,
        staticInspectionOnly: true,
        adapterInvocationEnabled: false,
        writeOperationsLocked: true,
        destructiveOperations: false,
        stale: false,
        shellExitCode: -1,
        shellError: "",
        error: error || null,
        checkedAt: SBH.util.now()
    };
}

function quote(value) {
    return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

function contextValue(data, key) {
    var value = data.get(String(key));
    return value === null || value === undefined ? "" : String(value);
}

function runShell(command) {
    var action = ShellCommand.newBuilder()
        .setCommand(String(command))
        .setSingleShot(true)
        .setId("JS#SingBoxHubRuntimeDexProtocolDataflow")
        .build();
    var result = shortx.executeAction(action);
    var data;
    if (!result) {
        throw new Error("shortx.executeAction() returned null");
    }
    data = result.contextData;
    if (!data) {
        throw new Error("Shell result.contextData unavailable");
    }
    return {
        out: contextValue(data, "shellOut"),
        err: contextValue(data, "shellErr"),
        code: Number(data.get("shellCode"))
    };
}

function parseShellMap(text) {
    var output = {};
    var lines = String(text || "").split(/\r?\n/);
    var i;
    var parts;
    for (i = 0; i < lines.length; i += 1) {
        parts = lines[i].split("\t");
        if (parts.length >= 2) {
            output[String(parts[0])] = String(parts.slice(1).join("\t"));
        }
    }
    return output;
}

function jsonStringField(text, key) {
    var escaped = String(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var match = new RegExp("\\\"" + escaped +
        "\\\"\\s*:\\s*\\\"((?:\\\\.|[^\\\"\\\\])*)\\\"").exec(String(text || ""));
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
    var text;
    try {
        if (SBH.runtime && typeof SBH.runtime.endpointProbe === "function") {
            probe = SBH.runtime.endpointProbe();
        }
    } catch (ignored) {}
    if (!probe || probe.exists !== true || !probe.data) {
        return null;
    }
    try {
        text = String(new JavaString(
            Base64.decode(String(probe.data), Base64.DEFAULT),
            "UTF-8"
        ));
    } catch (ignoredDecode) {
        return null;
    }
    return {
        runtimeJar: jsonStringField(text, "runtimeJar"),
        clientClass: jsonStringField(text, "clientClass"),
        serverClass: jsonStringField(text, "serverClass"),
        tokenDeclared: /"token"\s*:/.test(text),
        endpointSize: String(probe.size || ""),
        endpointMtime: String(probe.mtime || ""),
        endpointSha: String(probe.sha || "")
    };
}

function validJar(value) {
    value = String(value || "");
    return /^\/[A-Za-z0-9_.$+@%:,=~\/-]{1,510}\.jar$/i.test(value) &&
        value.indexOf("/../") < 0 &&
        value.indexOf("//") < 0;
}

function validClass(value) {
    return /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)+$/
        .test(String(value || ""));
}

function inputKey(evidence, status) {
    var archive = status ? status.runtimeArchiveInventory : null;
    var contract = status ? status.runtimeDexContract : null;
    var code = status ? status.runtimeDexCodeContract : null;
    if (!evidence) {
        return "";
    }
    return [
        evidence.runtimeJar,
        evidence.clientClass,
        evidence.serverClass,
        evidence.endpointSize,
        evidence.endpointMtime,
        evidence.endpointSha,
        archive ? archive.runtimeJarSha256Prefix : "",
        contract ? contract.dexVersion : "",
        contract ? contract.dexBytesTransferred : "",
        code ? code.state : ""
    ].join("|");
}

function shellCommand(runtimeRoot, evidence) {
    var lines = [
        "T=/system/bin/toybox",
        "J=" + quote(evidence.runtimeJar),
        "P=" + quote(String(runtimeRoot || "") + "/"),
        "printf 'exists\\t0\\npathMatched\\t0\\npayloadStatus\\tnot_requested\\n'",
        "[ -f \"$J\" ] || exit 0",
        "R=\"$($T readlink -f \"$J\" 2>/dev/null)\"",
        "printf 'exists\\t1\\nrealPath\\t%s\\n' \"$R\"",
        "case \"$R\" in \"$P\"*) printf 'pathMatched\\t1\\n' ;; *) printf 'payloadStatus\\tpath_mismatch\\n'; exit 0 ;; esac",
        "printf 'jarSize\\t%s\\n' \"$($T stat -c '%s' \"$J\" 2>/dev/null)\"",
        "S=\"$($T sha256sum \"$J\" 2>/dev/null | $T awk '{print $1}')\"",
        "printf 'jarSha\\t%s\\n' \"$S\"",
        "U=/system/bin/unzip",
        "[ -x \"$U\" ] || U=\"$T unzip\"",
        "N=\"$($U -p \"$J\" classes.dex 2>/dev/null | $T wc -c | $T tr -d ' \\r\\n')\"",
        "case \"$N\" in ''|*[!0-9]*) printf 'payloadStatus\\tdex_entry_missing\\n'; exit 0 ;; esac",
        "printf 'dexSize\\t%s\\n' \"$N\"",
        "[ \"$N\" -gt 0 ] || { printf 'payloadStatus\\tdex_entry_missing\\n'; exit 0; }",
        "[ \"$N\" -le " + MAX_DEX + " ] || { printf 'payloadStatus\\toversized\\n'; exit 0; }",
        "D=\"$($U -p \"$J\" classes.dex 2>/dev/null | $T base64 | $T tr -d '\\r\\n')\"",
        "[ -n \"$D\" ] || { printf 'payloadStatus\\tread_failed\\n'; exit 0; }",
        "printf 'payloadStatus\\tok\\n'",
        "printf 'dexData\\t%s\\n' \"$D\""
    ];
    return "/system/bin/toybox timeout 12 /system/bin/sh -c " +
        quote(lines.join("\n"));
}

function numberOr(value, fallback) {
    value = Number(value);
    return isFinite(value) ? value : fallback;
}

function isOne(value) {
    return String(value || "0") === "1";
}

function bounds(bytes, offset, count) {
    offset = Number(offset);
    count = Number(count);
    if (offset < 0 || count < 0 || offset + count > Number(bytes.length)) {
        throw new Error("DEX bounds exceeded");
    }
}

function u1(bytes, offset) {
    bounds(bytes, offset, 1);
    return Number(bytes[Number(offset)]) & 255;
}

function u2(bytes, offset) {
    return u1(bytes, offset) + u1(bytes, Number(offset) + 1) * 256;
}

function u4(bytes, offset) {
    return u1(bytes, offset) +
        u1(bytes, Number(offset) + 1) * 256 +
        u1(bytes, Number(offset) + 2) * 65536 +
        u1(bytes, Number(offset) + 3) * 16777216;
}

function signed16(value) {
    value = Number(value) & 65535;
    return value & 32768 ? value - 65536 : value;
}

function signed32(value) {
    value = Number(value);
    return value > 2147483647 ? value - 4294967296 : value;
}

function uleb(bytes, offset) {
    var result = 0;
    var shift = 0;
    var position = Number(offset);
    var value;
    var count = 0;
    do {
        value = u1(bytes, position);
        position += 1;
        result += (value & 127) * Math.pow(2, shift);
        shift += 7;
        count += 1;
        if (count > 5) {
            throw new Error("Invalid ULEB128");
        }
    } while ((value & 128) !== 0);
    return { value: result, next: position };
}

function asciiString(bytes, offset) {
    var position = uleb(bytes, offset).next;
    var chars = [];
    var value;
    while (position < bytes.length) {
        value = u1(bytes, position);
        position += 1;
        if (value === 0) {
            break;
        }
        if (value < 32 || value > 126) {
            return "";
        }
        chars.push(String.fromCharCode(value));
        if (chars.length > 512) {
            throw new Error("DEX string exceeds limit");
        }
    }
    return chars.join("");
}

function safeCount(value, maximum, label) {
    value = Number(value);
    if (value < 0 || value > maximum) {
        throw new Error(label + " exceeds safety limit: " + value);
    }
    return value;
}

function pushUnique(list, value, maximum) {
    var i;
    value = String(value || "");
    if (!value || list.length >= Number(maximum || 96)) {
        return;
    }
    for (i = 0; i < list.length; i += 1) {
        if (list[i] === value) {
            return;
        }
    }
    list.push(value);
}

function descriptor(className) {
    return "L" + String(className || "").replace(/\./g, "/") + ";";
}

function parameterTypes(bytes, offset, types) {
    var output = [];
    var count;
    var i;
    if (!offset) {
        return output;
    }
    count = safeCount(u4(bytes, offset), 256, "parameter count");
    bounds(bytes, Number(offset) + 4, count * 2);
    for (i = 0; i < count; i += 1) {
        output.push(String(types[u2(bytes, Number(offset) + 4 + i * 2)] || "?"));
    }
    return output;
}

function dexTables(bytes) {
    var table = {};
    var stringCount = safeCount(u4(bytes, 56), 4096, "string_ids_size");
    var stringOffset = u4(bytes, 60);
    var typeCount = safeCount(u4(bytes, 64), 4096, "type_ids_size");
    var typeOffset = u4(bytes, 68);
    var protoCount = safeCount(u4(bytes, 72), 2048, "proto_ids_size");
    var protoOffset = u4(bytes, 76);
    var methodCount = safeCount(u4(bytes, 88), 8192, "method_ids_size");
    var methodOffset = u4(bytes, 92);
    var classCount = safeCount(u4(bytes, 96), 2048, "class_defs_size");
    var classOffset = u4(bytes, 100);
    var i;
    var offset;
    var params;
    var returnType;
    table.strings = [];
    table.types = [];
    table.protos = [];
    table.methods = [];
    table.classes = {};
    bounds(bytes, stringOffset, stringCount * 4);
    bounds(bytes, typeOffset, typeCount * 4);
    bounds(bytes, protoOffset, protoCount * 12);
    bounds(bytes, methodOffset, methodCount * 8);
    bounds(bytes, classOffset, classCount * 32);
    for (i = 0; i < stringCount; i += 1) {
        table.strings.push(asciiString(bytes, u4(bytes, stringOffset + i * 4)));
    }
    for (i = 0; i < typeCount; i += 1) {
        table.types.push(String(table.strings[u4(bytes, typeOffset + i * 4)] || ""));
    }
    for (i = 0; i < protoCount; i += 1) {
        offset = protoOffset + i * 12;
        params = parameterTypes(bytes, u4(bytes, offset + 8), table.types);
        returnType = String(table.types[u4(bytes, offset + 4)] || "?");
        table.protos.push({
            returnType: returnType,
            parameters: params,
            descriptor: "(" + params.join("") + ")" + returnType
        });
    }
    for (i = 0; i < methodCount; i += 1) {
        offset = methodOffset + i * 8;
        table.methods.push({
            classDescriptor: String(table.types[u2(bytes, offset)] || ""),
            name: String(table.strings[u4(bytes, offset + 4)] || ""),
            proto: table.protos[u2(bytes, offset + 2)] || {
                returnType: "?",
                parameters: [],
                descriptor: "(?)?"
            }
        });
    }
    for (i = 0; i < classCount; i += 1) {
        offset = classOffset + i * 32;
        table.classes[String(table.types[u4(bytes, offset)] || "")] = {
            classDataOffset: u4(bytes, offset + 24)
        };
    }
    return table;
}

function skipEncodedFields(bytes, position, count) {
    var i;
    var value;
    for (i = 0; i < count; i += 1) {
        value = uleb(bytes, position);
        position = value.next;
        value = uleb(bytes, position);
        position = value.next;
    }
    return position;
}

function encodedMethods(bytes, classDataOffset, table) {
    var output = [];
    var position = Number(classDataOffset);
    var value;
    var staticFields;
    var instanceFields;
    var directMethods;
    var virtualMethods;
    var methodIndex;
    if (!position) {
        return output;
    }
    value = uleb(bytes, position);
    staticFields = safeCount(value.value, 1024, "static fields");
    position = value.next;
    value = uleb(bytes, position);
    instanceFields = safeCount(value.value, 1024, "instance fields");
    position = value.next;
    value = uleb(bytes, position);
    directMethods = safeCount(value.value, 1024, "direct methods");
    position = value.next;
    value = uleb(bytes, position);
    virtualMethods = safeCount(value.value, 1024, "virtual methods");
    position = value.next;
    position = skipEncodedFields(bytes, position, staticFields);
    position = skipEncodedFields(bytes, position, instanceFields);

    function parsePart(count) {
        var i;
        var delta;
        var accessFlags;
        var codeOffset;
        methodIndex = 0;
        for (i = 0; i < count; i += 1) {
            value = uleb(bytes, position);
            delta = value.value;
            position = value.next;
            methodIndex += delta;
            value = uleb(bytes, position);
            accessFlags = value.value;
            position = value.next;
            value = uleb(bytes, position);
            codeOffset = value.value;
            position = value.next;
            output.push({
                methodIndex: methodIndex,
                accessFlags: accessFlags,
                codeOffset: codeOffset,
                method: table.methods[methodIndex]
            });
        }
    }

    parsePart(directMethods);
    parsePart(virtualMethods);
    return output;
}

function findMain(bytes, table, classDescriptor) {
    var classDef = table.classes[classDescriptor];
    var methods;
    var i;
    if (!classDef) {
        return null;
    }
    methods = encodedMethods(bytes, classDef.classDataOffset, table);
    for (i = 0; i < methods.length; i += 1) {
        if (methods[i].method &&
                methods[i].method.name === "main" &&
                methods[i].method.proto.descriptor === "([Ljava/lang/String;)V") {
            return methods[i];
        }
    }
    return null;
}

function instructionWidth(bytes, insnsOffset, pc) {
    var first = u2(bytes, insnsOffset + pc * 2);
    var opcode = first & 255;
    var payloadId;
    var count;
    var elementWidth;
    var elementCount;
    if (opcode === 0) {
        payloadId = first >>> 8;
        if (payloadId === 1) {
            count = u2(bytes, insnsOffset + (pc + 1) * 2);
            return 4 + count * 2;
        }
        if (payloadId === 2) {
            count = u2(bytes, insnsOffset + (pc + 1) * 2);
            return 2 + count * 4;
        }
        if (payloadId === 3) {
            elementWidth = u2(bytes, insnsOffset + (pc + 1) * 2);
            elementCount = u4(bytes, insnsOffset + (pc + 2) * 2);
            return 4 + Math.ceil(elementWidth * elementCount / 2);
        }
        return 1;
    }
    if (opcode === 0x18) {
        return 5;
    }
    if (opcode === 0x03 || opcode === 0x06 || opcode === 0x09 ||
            opcode === 0x14 || opcode === 0x17 || opcode === 0x1b ||
            (opcode >= 0x24 && opcode <= 0x26) ||
            (opcode >= 0x2a && opcode <= 0x2c) ||
            (opcode >= 0x6e && opcode <= 0x72) ||
            (opcode >= 0x74 && opcode <= 0x78) ||
            opcode === 0xee || opcode === 0xef || opcode === 0xf0 ||
            opcode === 0xf8 || opcode === 0xf9 ||
            opcode === 0xfc || opcode === 0xfd) {
        return 3;
    }
    if (opcode === 0xfa || opcode === 0xfb) {
        return 4;
    }
    if (opcode === 0x02 || opcode === 0x05 || opcode === 0x08 ||
            opcode === 0x13 || opcode === 0x15 || opcode === 0x16 ||
            opcode === 0x19 || opcode === 0x1a || opcode === 0x1c ||
            opcode === 0x1f || opcode === 0x20 || opcode === 0x22 ||
            opcode === 0x23 || (opcode >= 0x2d && opcode <= 0x3d) ||
            (opcode >= 0x44 && opcode <= 0x6d) ||
            (opcode >= 0x90 && opcode <= 0xaf) ||
            (opcode >= 0xd0 && opcode <= 0xeb) ||
            opcode === 0xed || (opcode >= 0xf2 && opcode <= 0xf7) ||
            opcode === 0xfe || opcode === 0xff) {
        return 2;
    }
    return 1;
}

function safeLiteral(value) {
    value = String(value || "");
    if (!value || value.length > 160 || /[\r\n\t\0]/.test(value) ||
            /^[A-Fa-f0-9]{24,}$/.test(value) ||
            /^[A-Za-z0-9+/=_-]{32,}$/.test(value)) {
        return "";
    }
    return value;
}

function value(kind, data) {
    var output = { kind: kind };
    var key;
    data = data || {};
    for (key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            output[key] = data[key];
        }
    }
    return output;
}

function expression(item, depth) {
    var keys;
    var i;
    var parts;
    depth = Number(depth || 0);
    if (!item) {
        return "unknown";
    }
    if (depth > 5) {
        return "...";
    }
    if (item.kind === "arg") {
        return "arg[" + item.index + "]";
    }
    if (item.kind === "mainArgs") {
        return "mainArgs";
    }
    if (item.kind === "string") {
        return "string:" + item.value;
    }
    if (item.kind === "int") {
        return "int:" + item.value;
    }
    if (item.kind === "line") {
        return item.role + "." + item.channel + "Line[" + item.index + "]";
    }
    if (item.kind === "compare") {
        return item.method + "(" +
            expression(item.left, depth + 1) + "," +
            expression(item.right, depth + 1) + ")";
    }
    if (item.kind === "object") {
        parts = [];
        for (i = 0; i < (item.initArgs || []).length; i += 1) {
            parts.push(expression(item.initArgs[i], depth + 1));
        }
        return "new " + item.type + "(" + parts.join(",") + ")";
    }
    if (item.kind === "array") {
        keys = [];
        for (i = 0; i < Number(item.length || 0); i += 1) {
            keys.push(expression(item.items[String(i)], depth + 1));
        }
        return "array[" + keys.join(",") + "]";
    }
    if (item.kind === "concat") {
        parts = [];
        for (i = 0; i < (item.parts || []).length; i += 1) {
            parts.push(expression(item.parts[i], depth + 1));
        }
        return "concat(" + parts.join(",") + ")";
    }
    if (item.kind === "call") {
        return "call:" + item.signature + "#" + Number(item.index || 0);
    }
    if (item.kind === "type") {
        return "type:" + item.value;
    }
    if (item.kind === "length") {
        return "length(" + expression(item.source, depth + 1) + ")";
    }
    return item.kind + ":" + String(item.value || "");
}

function copyValue(item) {
    return item || null;
}

function registerList35c(first, third) {
    var count = (first >>> 12) & 15;
    var g = (first >>> 8) & 15;
    var output = [];
    if (count > 0) {
        output.push(third & 15);
    }
    if (count > 1) {
        output.push((third >>> 4) & 15);
    }
    if (count > 2) {
        output.push((third >>> 8) & 15);
    }
    if (count > 3) {
        output.push((third >>> 12) & 15);
    }
    if (count > 4) {
        output.push(g);
    }
    return output;
}

function registerList3rc(first, firstRegister) {
    var count = first >>> 8;
    var output = [];
    var i;
    for (i = 0; i < count && i < 64; i += 1) {
        output.push(firstRegister + i);
    }
    return output;
}

function addArgumentUsage(map, item, usage) {
    var index;
    var i;
    if (!item) {
        return;
    }
    if (item.kind === "arg") {
        index = Number(item.index);
        if (!map[String(index)]) {
            map[String(index)] = [];
        }
        pushUnique(map[String(index)], usage, 64);
        return;
    }
    if (item.kind === "object") {
        for (i = 0; i < (item.initArgs || []).length; i += 1) {
            addArgumentUsage(map, item.initArgs[i], usage);
        }
    } else if (item.kind === "array") {
        for (i = 0; i < Number(item.length || 0); i += 1) {
            addArgumentUsage(map, item.items[String(i)], usage);
        }
    } else if (item.kind === "concat") {
        for (i = 0; i < (item.parts || []).length; i += 1) {
            addArgumentUsage(map, item.parts[i], usage);
        }
    } else if (item.kind === "compare") {
        addArgumentUsage(map, item.left, usage);
        addArgumentUsage(map, item.right, usage);
    }
}

function mapToArray(map) {
    var output = [];
    var keys = [];
    var key;
    var i;
    for (key in map) {
        if (Object.prototype.hasOwnProperty.call(map, key)) {
            keys.push(Number(key));
        }
    }
    keys.sort(function (a, b) { return a - b; });
    for (i = 0; i < keys.length; i += 1) {
        output.push({
            index: keys[i],
            usages: map[String(keys[i])] || []
        });
    }
    return output;
}

function invocationSignature(method) {
    if (!method) {
        return "";
    }
    return method.classDescriptor + "->" + method.name +
        method.proto.descriptor;
}

function traceMain(bytes, encodedMethod, table, role) {
    var codeOffset = Number(encodedMethod.codeOffset);
    var registersSize = u2(bytes, codeOffset);
    var insSize = u2(bytes, codeOffset + 2);
    var outsSize = u2(bytes, codeOffset + 4);
    var insnsSize = u4(bytes, codeOffset + 12);
    var insnsOffset = codeOffset + 16;
    var pc = 0;
    var registers = {};
    var lastReturn = null;
    var calls = [];
    var reads = [];
    var writes = [];
    var branches = [];
    var comparisons = [];
    var socketSources = [];
    var fileEffects = [];
    var execEvidence = [];
    var processEvidence = [];
    var argumentUsage = {};
    var writeLine = 0;
    var readLine = 0;
    var connectionCount = 0;
    var closeCount = 0;
    var instructionCount = 0;
    var first;
    var opcode;
    var width;
    var a;
    var b;
    var c;
    var index;
    var second;
    var third;
    var method;
    var signature;
    var registerNumbers;
    var arguments;
    var i;
    var receiver;
    var result;
    var offset;
    var condition;
    var event;
    var literal;
    var arrayValue;
    var target;
    var branchKind;

    bounds(bytes, insnsOffset, insnsSize * 2);
    if ((encodedMethod.accessFlags & 8) !== 0 && insSize > 0) {
        registers[String(registersSize - insSize)] = value("mainArgs");
    }

    function reg(number) {
        return registers[String(number)] || value("unknown", { value: "v" + number });
    }

    function setReg(number, item) {
        registers[String(number)] = item;
    }

    function recordCall(pcValue, sig, args) {
        var item = {
            pc: pcValue,
            signature: sig,
            arguments: []
        };
        var j;
        for (j = 0; j < args.length; j += 1) {
            item.arguments.push(expression(args[j]));
        }
        if (calls.length < 192) {
            calls.push(item);
        }
    }

    while (pc < insnsSize) {
        instructionCount += 1;
        if (instructionCount > 1024) {
            throw new Error("Instruction safety limit exceeded");
        }
        first = u2(bytes, insnsOffset + pc * 2);
        opcode = first & 255;
        width = instructionWidth(bytes, insnsOffset, pc);
        if (width < 1 || pc + width > insnsSize) {
            throw new Error("Invalid instruction width at pc " + pc);
        }

        if (opcode === 0x01 || opcode === 0x04 || opcode === 0x07) {
            a = (first >>> 8) & 15;
            b = first >>> 12;
            setReg(a, copyValue(reg(b)));
        } else if (opcode === 0x02 || opcode === 0x05 || opcode === 0x08) {
            a = first >>> 8;
            b = u2(bytes, insnsOffset + (pc + 1) * 2);
            setReg(a, copyValue(reg(b)));
        } else if (opcode === 0x03 || opcode === 0x06 || opcode === 0x09) {
            a = u2(bytes, insnsOffset + (pc + 1) * 2);
            b = u2(bytes, insnsOffset + (pc + 2) * 2);
            setReg(a, copyValue(reg(b)));
        } else if (opcode >= 0x0a && opcode <= 0x0c) {
            a = first >>> 8;
            setReg(a, lastReturn || value("unknown", { value: "move-result" }));
        } else if (opcode === 0x12) {
            a = (first >>> 8) & 15;
            b = first >>> 12;
            setReg(a, value("int", { value: (b & 8) ? b - 16 : b }));
        } else if (opcode === 0x13) {
            a = first >>> 8;
            setReg(a, value("int", {
                value: signed16(u2(bytes, insnsOffset + (pc + 1) * 2))
            }));
        } else if (opcode === 0x14) {
            a = first >>> 8;
            setReg(a, value("int", {
                value: signed32(
                    u2(bytes, insnsOffset + (pc + 1) * 2) +
                    u2(bytes, insnsOffset + (pc + 2) * 2) * 65536
                )
            }));
        } else if (opcode === 0x15) {
            a = first >>> 8;
            setReg(a, value("int", {
                value: signed16(u2(bytes, insnsOffset + (pc + 1) * 2)) * 65536
            }));
        } else if (opcode === 0x1a || opcode === 0x1b) {
            a = first >>> 8;
            index = opcode === 0x1a ?
                u2(bytes, insnsOffset + (pc + 1) * 2) :
                u4(bytes, insnsOffset + (pc + 1) * 2);
            literal = safeLiteral(table.strings[index]);
            setReg(a, value("string", { value: literal || "<filtered>" }));
        } else if (opcode === 0x1c) {
            a = first >>> 8;
            index = u2(bytes, insnsOffset + (pc + 1) * 2);
            setReg(a, value("type", { value: table.types[index] || "" }));
        } else if (opcode === 0x1f) {
            a = first >>> 8;
        } else if (opcode === 0x21) {
            a = (first >>> 8) & 15;
            b = first >>> 12;
            setReg(a, value("length", { source: reg(b) }));
        } else if (opcode === 0x22) {
            a = first >>> 8;
            index = u2(bytes, insnsOffset + (pc + 1) * 2);
            setReg(a, value("object", {
                type: table.types[index] || "",
                initArgs: []
            }));
        } else if (opcode === 0x23) {
            a = (first >>> 8) & 15;
            b = first >>> 12;
            index = u2(bytes, insnsOffset + (pc + 1) * 2);
            arrayValue = value("array", {
                type: table.types[index] || "",
                length: reg(b).kind === "int" ? Number(reg(b).value) : 0,
                items: {}
            });
            setReg(a, arrayValue);
        } else if (opcode === 0x24 || opcode === 0x25) {
            index = u2(bytes, insnsOffset + (pc + 1) * 2);
            third = u2(bytes, insnsOffset + (pc + 2) * 2);
            registerNumbers = opcode === 0x24 ?
                registerList35c(first, third) :
                registerList3rc(first, third);
            arrayValue = value("array", {
                type: table.types[index] || "",
                length: registerNumbers.length,
                items: {}
            });
            for (i = 0; i < registerNumbers.length; i += 1) {
                arrayValue.items[String(i)] = reg(registerNumbers[i]);
            }
            lastReturn = arrayValue;
        } else if (opcode === 0x46) {
            a = first >>> 8;
            second = u2(bytes, insnsOffset + (pc + 1) * 2);
            b = second & 255;
            c = second >>> 8;
            if (reg(b).kind === "mainArgs" && reg(c).kind === "int") {
                result = value("arg", { index: Number(reg(c).value) });
                setReg(a, result);
                addArgumentUsage(argumentUsage, result, "loaded@pc" + pc);
            } else if (reg(b).kind === "array" && reg(c).kind === "int") {
                setReg(a, reg(b).items[String(reg(c).value)] ||
                    value("unknown", { value: "array-item" }));
            } else {
                setReg(a, value("unknown", { value: "aget-object" }));
            }
        } else if (opcode === 0x4d) {
            a = first >>> 8;
            second = u2(bytes, insnsOffset + (pc + 1) * 2);
            b = second & 255;
            c = second >>> 8;
            if (reg(b).kind === "array" && reg(c).kind === "int") {
                reg(b).items[String(reg(c).value)] = reg(a);
                addArgumentUsage(argumentUsage, reg(a),
                    "array-write@pc" + pc + "[" + reg(c).value + "]");
            }
        } else if ((opcode >= 0x6e && opcode <= 0x72) ||
                (opcode >= 0x74 && opcode <= 0x78)) {
            index = u2(bytes, insnsOffset + (pc + 1) * 2);
            third = u2(bytes, insnsOffset + (pc + 2) * 2);
            method = table.methods[index];
            registerNumbers = opcode >= 0x74 ?
                registerList3rc(first, third) :
                registerList35c(first, third);
            arguments = [];
            for (i = 0; i < registerNumbers.length; i += 1) {
                arguments.push(reg(registerNumbers[i]));
            }
            signature = invocationSignature(method);
            recordCall(pc, signature, arguments);
            lastReturn = value("call", {
                signature: signature,
                index: calls.length
            });

            if (method && method.name === "<init>" && arguments.length > 0) {
                receiver = arguments[0];
                if (receiver && receiver.kind === "object") {
                    receiver.initArgs = arguments.slice(1);
                }
                if (method.classDescriptor === "Landroid/net/LocalSocketAddress;") {
                    event = {
                        role: role,
                        pc: pc,
                        source: expression(arguments[1]),
                        constructor: signature
                    };
                    socketSources.push(event);
                    addArgumentUsage(argumentUsage, arguments[1],
                        "LocalSocketAddress.name@pc" + pc);
                } else if (method.classDescriptor === "Landroid/net/LocalServerSocket;") {
                    event = {
                        role: role,
                        pc: pc,
                        source: expression(arguments[1]),
                        constructor: signature
                    };
                    socketSources.push(event);
                    addArgumentUsage(argumentUsage, arguments[1],
                        "LocalServerSocket.name@pc" + pc);
                } else if (method.classDescriptor === "Ljava/io/File;") {
                    addArgumentUsage(argumentUsage, arguments[1],
                        "File.path@pc" + pc);
                }
            }

            if (method && method.classDescriptor === "Landroid/net/LocalSocket;" &&
                    method.name === "connect") {
                connectionCount += 1;
                addArgumentUsage(argumentUsage, arguments[1],
                    "LocalSocket.connect.address@pc" + pc);
            }
            if (method && method.classDescriptor === "Landroid/net/LocalSocket;" &&
                    method.name === "close") {
                closeCount += 1;
            }

            if (method && method.classDescriptor === "Ljava/io/BufferedReader;" &&
                    method.name === "readLine") {
                result = value("line", {
                    role: role,
                    channel: role === "client" ? "response" : "request",
                    index: readLine
                });
                event = {
                    role: role,
                    pc: pc,
                    lineIndex: readLine,
                    value: expression(result),
                    operation: "readLine"
                };
                reads.push(event);
                readLine += 1;
                lastReturn = result;
            } else if (method &&
                    method.classDescriptor === "Ljava/io/BufferedWriter;" &&
                    method.name === "write") {
                event = {
                    role: role,
                    pc: pc,
                    lineIndex: writeLine,
                    operation: "write",
                    value: expression(arguments[1])
                };
                writes.push(event);
                addArgumentUsage(argumentUsage, arguments[1],
                    "BufferedWriter.write.line" + writeLine + "@pc" + pc);
            } else if (method &&
                    method.classDescriptor === "Ljava/io/BufferedWriter;" &&
                    method.name === "newLine") {
                writes.push({
                    role: role,
                    pc: pc,
                    lineIndex: writeLine,
                    operation: "newLine"
                });
                writeLine += 1;
            } else if (method &&
                    method.classDescriptor === "Ljava/io/BufferedWriter;" &&
                    method.name === "flush") {
                writes.push({
                    role: role,
                    pc: pc,
                    lineIndex: writeLine,
                    operation: "flush"
                });
            } else if (method &&
                    method.classDescriptor === "Ljava/lang/String;" &&
                    (method.name === "equals" ||
                    method.name === "equalsIgnoreCase" ||
                    method.name === "startsWith" ||
                    method.name === "endsWith" ||
                    method.name === "contains") &&
                    arguments.length >= 2) {
                result = value("compare", {
                    method: method.name,
                    left: arguments[0],
                    right: arguments[1],
                    pc: pc
                });
                comparisons.push({
                    role: role,
                    pc: pc,
                    method: method.name,
                    left: expression(arguments[0]),
                    right: expression(arguments[1])
                });
                addArgumentUsage(argumentUsage, arguments[0],
                    "String." + method.name + ".left@pc" + pc);
                addArgumentUsage(argumentUsage, arguments[1],
                    "String." + method.name + ".right@pc" + pc);
                lastReturn = result;
            } else if (method &&
                    method.classDescriptor === "Ljava/lang/String;" &&
                    method.name === "concat" &&
                    arguments.length >= 2) {
                lastReturn = value("concat", {
                    parts: [arguments[0], arguments[1]]
                });
            } else if (method &&
                    method.classDescriptor === "Ljava/lang/StringBuilder;" &&
                    method.name === "append" &&
                    arguments.length >= 2) {
                receiver = arguments[0];
                if (receiver && receiver.kind === "object") {
                    if (!receiver.appendParts) {
                        receiver.appendParts = [];
                    }
                    receiver.appendParts.push(arguments[1]);
                    lastReturn = receiver;
                }
            } else if (method &&
                    method.classDescriptor === "Ljava/lang/StringBuilder;" &&
                    method.name === "toString" &&
                    arguments.length >= 1) {
                receiver = arguments[0];
                lastReturn = value("concat", {
                    parts: receiver && receiver.appendParts ?
                        receiver.appendParts : []
                });
            } else if (method &&
                    method.classDescriptor === "Ljava/io/File;" &&
                    method.name === "createNewFile") {
                receiver = arguments[0];
                event = {
                    role: role,
                    pc: pc,
                    operation: "createNewFile",
                    path: receiver && receiver.kind === "object" &&
                        receiver.initArgs && receiver.initArgs.length ?
                        expression(receiver.initArgs[0]) : expression(receiver)
                };
                fileEffects.push(event);
                addArgumentUsage(argumentUsage,
                    receiver && receiver.initArgs ? receiver.initArgs[0] : receiver,
                    "File.createNewFile@pc" + pc);
            } else if (method &&
                    method.classDescriptor === "Ljava/lang/Runtime;" &&
                    method.name === "exec") {
                event = {
                    role: role,
                    pc: pc,
                    command: expression(arguments[1])
                };
                execEvidence.push(event);
                addArgumentUsage(argumentUsage, arguments[1],
                    "Runtime.exec.command@pc" + pc);
            } else if (method &&
                    ((method.classDescriptor === "Ljava/lang/Process;" &&
                    (method.name === "destroy" ||
                    method.name === "waitFor" ||
                    method.name === "isAlive")) ||
                    (method.classDescriptor === "Ljava/lang/Thread;" &&
                    method.name === "sleep"))) {
                processEvidence.push({
                    role: role,
                    pc: pc,
                    operation: signature,
                    arguments: arguments.map(function (item) {
                        return expression(item);
                    })
                });
            }
        }

        if (opcode >= 0x32 && opcode <= 0x37) {
            a = (first >>> 8) & 15;
            b = first >>> 12;
            offset = signed16(u2(bytes, insnsOffset + (pc + 1) * 2));
            target = pc + offset;
            branchKind = [
                "if-eq", "if-ne", "if-lt", "if-ge", "if-gt", "if-le"
            ][opcode - 0x32];
            condition = {
                kind: branchKind,
                left: expression(reg(a)),
                right: expression(reg(b))
            };
            branches.push({
                role: role,
                pc: pc,
                opcode: branchKind,
                left: condition.left,
                right: condition.right,
                targetPc: target,
                fallthroughPc: pc + width
            });
        } else if (opcode >= 0x38 && opcode <= 0x3d) {
            a = first >>> 8;
            offset = signed16(u2(bytes, insnsOffset + (pc + 1) * 2));
            target = pc + offset;
            branchKind = [
                "if-eqz", "if-nez", "if-ltz", "if-gez", "if-gtz", "if-lez"
            ][opcode - 0x38];
            condition = reg(a);
            event = {
                role: role,
                pc: pc,
                opcode: branchKind,
                condition: expression(condition),
                targetPc: target,
                fallthroughPc: pc + width
            };
            if (condition && condition.kind === "compare") {
                event.comparisonPc = condition.pc;
                event.comparisonMethod = condition.method;
                event.comparisonLeft = expression(condition.left);
                event.comparisonRight = expression(condition.right);
                if (branchKind === "if-eqz" && target > pc) {
                    event.matchRangeStartPc = pc + width;
                    event.matchRangeEndPc = target;
                }
            }
            branches.push(event);
        }

        pc += width;
    }

    return {
        role: role,
        registersSize: registersSize,
        insSize: insSize,
        outsSize: outsSize,
        insnsSize: insnsSize,
        instructionCount: instructionCount,
        argumentMap: mapToArray(argumentUsage),
        callTrace: calls,
        readSequence: reads,
        writeSequence: writes,
        comparisons: comparisons,
        branches: branches,
        socketSources: socketSources,
        fileEffects: fileEffects,
        execEvidence: execEvidence,
        processEvidence: processEvidence,
        connectionCount: connectionCount,
        closeCount: closeCount
    };
}

function valueLineIndex(text) {
    var match = /(?:request|response)Line\[(\d+)\]/.exec(String(text || ""));
    return match ? Number(match[1]) : -1;
}

function literalFromComparison(left, right) {
    if (/^string:/.test(left)) {
        return left.substring(7);
    }
    if (/^string:/.test(right)) {
        return right.substring(7);
    }
    return "";
}

function lineFromComparison(left, right) {
    var leftIndex = valueLineIndex(left);
    var rightIndex = valueLineIndex(right);
    return leftIndex >= 0 ? leftIndex : rightIndex;
}

function argumentIndex(text) {
    var match = /^arg\[(\d+)\]$/.exec(String(text || ""));
    return match ? Number(match[1]) : -1;
}

function writesForLine(sequence, lineIndex) {
    var output = [];
    var i;
    for (i = 0; i < sequence.length; i += 1) {
        if (sequence[i].operation === "write" &&
                Number(sequence[i].lineIndex) === Number(lineIndex)) {
            output.push(sequence[i]);
        }
    }
    return output;
}

function responseWritesInRange(sequence, startPc, endPc) {
    var output = [];
    var i;
    for (i = 0; i < sequence.length; i += 1) {
        if (sequence[i].operation === "write" &&
                Number(sequence[i].pc) >= Number(startPc) &&
                Number(sequence[i].pc) < Number(endPc)) {
            pushUnique(output, sequence[i].value, 32);
        }
    }
    return output;
}

function inferContract(result, client, server, evidence) {
    var i;
    var branch;
    var literal;
    var lineIndex;
    var expected;
    var compare;
    var leftArg;
    var rightArg;
    var clientWrites;
    var candidate;
    var commandLineIndexes = {};
    var authLineIndexes = {};

    result.clientArgumentMap = client.argumentMap;
    result.serverArgumentMap = server.argumentMap;
    result.clientCallTrace = client.callTrace;
    result.serverCallTrace = server.callTrace;
    result.requestWriteSequence = client.writeSequence;
    result.serverReadSequence = server.readSequence;
    result.responseWriteSequence = server.writeSequence;
    result.clientReadSequence = client.readSequence;
    result.clientSocketAddressSources = client.socketSources;
    result.serverSocketNameSources = server.socketSources;
    result.fileCreateSideEffects =
        client.fileEffects.concat(server.fileEffects);
    result.runtimeExecEvidence =
        client.execEvidence.concat(server.execEvidence);
    result.processControlEvidence =
        client.processEvidence.concat(server.processEvidence);
    result.stringComparisonEvidence =
        client.comparisons.concat(server.comparisons);
    result.branchEvidence =
        client.branches.concat(server.branches);

    if (client.socketSources.length > 0) {
        result.socketAddressSource = client.socketSources[0];
    }

    for (i = 0; i < server.branches.length; i += 1) {
        branch = server.branches[i];
        if (!branch.comparisonMethod) {
            continue;
        }
        literal = literalFromComparison(
            branch.comparisonLeft,
            branch.comparisonRight
        ).toUpperCase();
        lineIndex = lineFromComparison(
            branch.comparisonLeft,
            branch.comparisonRight
        );
        if (literal && lineIndex >= 0) {
            expected = [];
            if (branch.matchRangeStartPc !== undefined) {
                expected = responseWritesInRange(
                    server.writeSequence,
                    branch.matchRangeStartPc,
                    branch.matchRangeEndPc
                );
            }
            candidate = {
                command: literal,
                requestLineIndex: lineIndex,
                comparisonPc: branch.comparisonPc,
                branchPc: branch.pc,
                branchOpcode: branch.opcode,
                matchRangeStartPc: branch.matchRangeStartPc,
                matchRangeEndPc: branch.matchRangeEndPc,
                expectedResponseWrites: expected
            };
            result.commandBranches.push(candidate);
            commandLineIndexes[String(lineIndex)] = literal;
            if (literal === "PING") {
                result.pingRequestLine = lineIndex;
                for (leftArg = 0; leftArg < expected.length; leftArg += 1) {
                    pushUnique(result.pingExpectedResponses, expected[leftArg], 16);
                }
            }
        }
    }

    for (i = 0; i < server.comparisons.length; i += 1) {
        compare = server.comparisons[i];
        lineIndex = lineFromComparison(compare.left, compare.right);
        if (lineIndex < 0) {
            continue;
        }
        literal = literalFromComparison(compare.left, compare.right);
        leftArg = argumentIndex(compare.left);
        rightArg = argumentIndex(compare.right);
        if (!literal && (leftArg >= 0 || rightArg >= 0)) {
            authLineIndexes[String(lineIndex)] =
                leftArg >= 0 ? leftArg : rightArg;
            result.authenticationCarrierCandidates.push({
                serverRequestLineIndex: lineIndex,
                serverArgumentIndex: leftArg >= 0 ? leftArg : rightArg,
                comparisonPc: compare.pc,
                method: compare.method
            });
        }
    }

    for (i = 0; i < client.writeSequence.length; i += 1) {
        candidate = client.writeSequence[i];
        if (candidate.operation !== "write") {
            continue;
        }
        lineIndex = Number(candidate.lineIndex);
        leftArg = argumentIndex(candidate.value);
        if (commandLineIndexes[String(lineIndex)] !== undefined) {
            result.commandCarrierCandidates.push({
                requestLineIndex: lineIndex,
                clientArgumentIndex: leftArg,
                clientValue: candidate.value,
                serverCommandLiteral:
                    commandLineIndexes[String(lineIndex)],
                writePc: candidate.pc
            });
        }
        if (authLineIndexes[String(lineIndex)] !== undefined) {
            result.authenticationCarrierCandidates.push({
                requestLineIndex: lineIndex,
                clientArgumentIndex: leftArg,
                clientValue: candidate.value,
                serverArgumentIndex:
                    authLineIndexes[String(lineIndex)],
                writePc: candidate.pc
            });
        }
    }

    if (result.commandCarrierCandidates.length > 0) {
        result.commandCarrier = result.commandCarrierCandidates[0];
        result.commandCarrierState =
            result.commandCarrier.clientArgumentIndex >= 0 ?
            "exact_main_argument_identified" :
            "request_line_identified_argument_unknown";
    } else {
        result.commandCarrierState = result.commandBranches.length > 0 ?
            "server_command_line_identified_client_source_unknown" :
            "unknown";
    }

    if (result.authenticationCarrierCandidates.length > 0) {
        for (i = 0; i < result.authenticationCarrierCandidates.length; i += 1) {
            candidate = result.authenticationCarrierCandidates[i];
            if (candidate.clientArgumentIndex !== undefined &&
                    candidate.serverArgumentIndex !== undefined) {
                result.authenticationCarrier = candidate;
                break;
            }
        }
        result.authenticationCarrierState =
            result.authenticationCarrier ?
            "exact_request_line_arguments_identified" :
            "server_auth_comparison_identified";
    } else {
        result.authenticationCarrierState =
            evidence.tokenDeclared ?
            "endpoint_token_declared_code_carrier_not_identified" :
            "no_authentication_evidence";
    }

    result.lineFramingConfirmed =
        client.writeSequence.some(function (item) {
            return item.operation === "newLine";
        }) &&
        server.readSequence.length > 0 &&
        server.writeSequence.some(function (item) {
            return item.operation === "newLine";
        }) &&
        client.readSequence.length > 0;
    result.framingState = result.lineFramingConfirmed ?
        "line_delimited_text_confirmed" : "unknown";

    result.oneConnectionOneResponseConfirmed =
        client.connectionCount === 1 &&
        client.readSequence.length === 1 &&
        client.closeCount >= 1;

    result.correlationState =
        result.oneConnectionOneResponseConfirmed ?
        "connection_scoped_request_response_no_id_required" :
        "no_explicit_correlation_evidence";

    if (result.pingRequestLine !== null) {
        clientWrites = writesForLine(
            client.writeSequence,
            result.pingRequestLine
        );
        if (clientWrites.length === 1) {
            result.pingRequestLine = {
                lineIndex: result.pingRequestLine,
                clientValue: clientWrites[0].value,
                clientWritePc: clientWrites[0].pc
            };
        }
    }

    if (result.pingExpectedResponses.length > 0) {
        result.pingContractState = "ping_branch_and_response_identified";
    } else if (result.commandBranches.some(function (item) {
            return item.command === "PING";
        })) {
        result.pingContractState = "ping_branch_identified_response_unknown";
    } else {
        result.pingContractState = "ping_branch_not_identified";
    }

    result.readOnlyProbeContractReady =
        result.socketAddressSource !== null &&
        result.commandCarrier !== null &&
        (!evidence.tokenDeclared || result.authenticationCarrier !== null) &&
        result.lineFramingConfirmed &&
        result.oneConnectionOneResponseConfirmed &&
        result.pingContractState === "ping_branch_and_response_identified";

    result.dataflowEvidenceAvailable =
        result.clientMainCodeFound &&
        result.serverMainCodeFound &&
        result.clientCallTrace.length > 0 &&
        result.serverCallTrace.length > 0;

    result.state = result.readOnlyProbeContractReady ?
        "readonly_ping_contract_ready" :
        (result.dataflowEvidenceAvailable ?
            "protocol_dataflow_identified" :
            "protocol_dataflow_incomplete");
}

function decodeDex(bytes, evidence, result) {
    var magic = "";
    var i;
    var fileSize;
    var headerSize;
    var table;
    var clientMain;
    var serverMain;
    var client;
    var server;

    for (i = 0; i < 8; i += 1) {
        magic += String.fromCharCode(u1(bytes, i));
    }
    if (magic.substring(0, 4) !== "dex\n" || u1(bytes, 7) !== 0) {
        throw new Error("Invalid DEX magic");
    }
    result.dexVersion = magic.substring(4, 7);
    fileSize = u4(bytes, 32);
    headerSize = u4(bytes, 36);
    if (fileSize !== Number(bytes.length) || headerSize < 112) {
        throw new Error("Invalid DEX header");
    }

    table = dexTables(bytes);
    clientMain = findMain(
        bytes,
        table,
        descriptor(evidence.clientClass)
    );
    serverMain = findMain(
        bytes,
        table,
        descriptor(evidence.serverClass)
    );

    result.clientMainCodeFound =
        !!(clientMain && clientMain.codeOffset);
    result.serverMainCodeFound =
        !!(serverMain && serverMain.codeOffset);

    if (!result.clientMainCodeFound ||
            !result.serverMainCodeFound) {
        result.state = "main_code_unavailable";
        return;
    }

    client = traceMain(bytes, clientMain, table, "client");
    server = traceMain(bytes, serverMain, table, "server");
    inferContract(result, client, server, evidence);
}

function save(result) {
    if (!result || result.checking === true) {
        return;
    }
    cache = result;
    cacheKey = String(result.inputKey || "");
    try {
        SBH.files.writeJson(cacheFile, result);
    } catch (error) {
        SBH.log.warn(
            "dex.protocol.dataflow.cache",
            SBH.util.errorText(error)
        );
    }
}

function inspect(status, force) {
    var evidence = endpointEvidence();
    var key = inputKey(evidence, status);
    var runtimeRoot = status ?
        String(status.runtimeRoot || "") : "";
    var result;
    var shellResult;
    var shellMap;
    var bytes;

    if (!evidence) {
        return blank(
            status && status.checking === true ?
                "checking" : "endpoint_evidence_unavailable",
            null
        );
    }
    if (!validJar(evidence.runtimeJar) ||
            !validClass(evidence.clientClass) ||
            !validClass(evidence.serverClass)) {
        result = blank(
            "dex_protocol_dataflow_evidence_invalid",
            "runtimeJar/clientClass/serverClass evidence is invalid"
        );
        result.inputKey = key;
        save(result);
        return result;
    }
    if (!force && cache && cache.stale !== true &&
            cacheKey === key) {
        return cache;
    }

    result = blank("dex_protocol_dataflow_failed", null);
    result.checking = false;
    result.runtimeJarDeclared = true;
    result.runtimeJarPath = evidence.runtimeJar;
    result.clientClassName = evidence.clientClass;
    result.serverClassName = evidence.serverClass;
    result.inputKey = key;

    try {
        shellResult = runShell(
            shellCommand(runtimeRoot, evidence)
        );
        shellMap = parseShellMap(shellResult.out);
        result.shellExitCode = shellResult.code;
        result.shellError = shellResult.err;
        result.runtimeJarExists = isOne(shellMap.exists);
        result.runtimeJarCanonicalPathMatched =
            isOne(shellMap.pathMatched);
        result.runtimeJarPath =
            shellMap.realPath || evidence.runtimeJar;
        result.runtimeJarSize =
            numberOr(shellMap.jarSize, -1);
        result.runtimeJarSha256Prefix =
            String(shellMap.jarSha || "").substring(0, 16);
        result.dexPayloadStatus =
            shellMap.payloadStatus || "unknown";
        result.dexBytesTransferred =
            numberOr(shellMap.dexSize, 0);

        if (!result.runtimeJarExists) {
            result.state = "runtime_jar_missing";
        } else if (!result.runtimeJarCanonicalPathMatched) {
            result.state = "runtime_jar_path_mismatch";
        } else if (result.dexPayloadStatus !== "ok" ||
                !shellMap.dexData) {
            result.state = "dex_payload_unavailable";
        } else {
            bytes = Base64.decode(
                String(shellMap.dexData),
                Base64.DEFAULT
            );
            result.dexBytesTransferred =
                Number(bytes.length);
            decodeDex(bytes, evidence, result);
        }

        result.stale = false;
        result.checkedAt = SBH.util.now();
        save(result);
        return result;
    } catch (error) {
        result.state = "dex_protocol_dataflow_parse_failed";
        result.error = SBH.util.errorText(error);
        result.stale = false;
        result.checkedAt = SBH.util.now();
        save(result);
        return result;
    }
}

function attach(status, contract) {
    var plan;
    status = status || {};
    contract = contract || cache || blank("checking", null);
    status.runtimeDexProtocolDataflow = contract;
    plan = status.protocolAdapterPlan;
    if (plan) {
        plan.runtimeDexProtocolDataflowState =
            String(contract.state || "checking");
        plan.dataflowEvidenceAvailable =
            contract.dataflowEvidenceAvailable === true;
        plan.commandCarrierState =
            contract.commandCarrierState;
        plan.authenticationCarrierState =
            contract.authenticationCarrierState;
        plan.framingState =
            contract.framingState;
        plan.correlationState =
            contract.correlationState;
        plan.pingContractState =
            contract.pingContractState;
        plan.readOnlyProbeContractReady =
            contract.readOnlyProbeContractReady === true;
        plan.socketAddressSource =
            contract.socketAddressSource;
        plan.commandCarrier =
            contract.commandCarrier;
        plan.authenticationCarrier =
            contract.authenticationCarrier;
        plan.pingExpectedResponses =
            contract.pingExpectedResponses || [];
        plan.adapterInvocationEnabled = false;
        plan.writeOperationsLocked = true;
        plan.destructiveOperations = false;
    }
    if (status.writeGate) {
        status.writeGate.runtimeDexProtocolDataflow =
            contract;
    }
    return status;
}

function install() {
    var runtime = SBH.runtime;
    var oldStatus = runtime.status;
    var oldRefresh = runtime.refresh;
    var oldRequest = runtime.request;
    var oldStart = SBH.app.start;

    runtime.status = function () {
        return attach(oldStatus(), cache);
    };

    runtime.refresh = function () {
        var status = oldRefresh();
        var contract = inspect(status, false);
        return attach(status, contract);
    };

    runtime.request = function (request) {
        var command = request && request.command ?
            String(request.command) : "";
        var requestId = request && request.requestId ?
            String(request.requestId) : "";
        var status;
        var contract;
        var response;

        if (command === "runtime.dex_protocol_dataflow") {
            status = oldRefresh();
            contract = inspect(status, true);
            status = attach(status, contract);
            return {
                ok: contract.error === null &&
                    contract.dexPayloadStatus === "ok",
                requestId: requestId,
                code: "RUNTIME_DEX_PROTOCOL_DATAFLOW",
                stateBefore: status.coreRunning ?
                    "running" : "stopped",
                stateAfter: status.coreRunning ?
                    "running" : "stopped",
                message: "Runtime DEX 协议数据流静态识别完成",
                data: contract
            };
        }

        response = oldRequest(request);
        try {
            status = runtime.status();
            if (response && response.data &&
                    status.runtimeDexProtocolDataflow) {
                response.data.runtimeDexProtocolDataflow =
                    status.runtimeDexProtocolDataflow;
            }
        } catch (ignored) {}
        return response;
    };

    runtime.dexProtocolDataflow = function () {
        return runtime.request({
            requestId: "sbh-dex-protocol-dataflow-" +
                SBH.util.now(),
            command: "runtime.dex_protocol_dataflow"
        });
    };

    SBH.app.start = function () {
        var output = oldStart();
        var status;
        var contract;
        try {
            status = runtime.status();
            contract = status.runtimeDexProtocolDataflow ||
                blank("checking", null);
            output.runtimeDexProtocolDataflow =
                String(contract.state || "checking");
            output.runtimeDexProtocolDataflowDetails =
                contract;
            if (status.protocolAdapterPlan) {
                output.runtimeProtocolAdapterPlan =
                    String(status.protocolAdapterPlan.state ||
                        "checking");
                output.runtimeProtocolAdapterPlanDetails =
                    status.protocolAdapterPlan;
            }
        } catch (error) {
            contract = blank(
                "dex_protocol_dataflow_status_unavailable",
                SBH.util.errorText(error)
            );
            output.runtimeDexProtocolDataflow =
                contract.state;
            output.runtimeDexProtocolDataflowDetails =
                contract;
        }
        output.writeOperationsLocked = true;
        output.destructiveOperations = false;
        return output;
    };
}

if (!cache || Number(cache.schemaVersion) !== SCHEMA) {
    cache = null;
} else {
    cacheKey = String(cache.inputKey || "");
    cache.stale = true;
    cache.source = "persisted_cache";
}

install();
}());
