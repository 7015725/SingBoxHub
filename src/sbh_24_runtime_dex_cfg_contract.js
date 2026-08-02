/* SingBoxHub Runtime DEX CFG-aware read-only PING contract inspection. Rhino ES5 only. */
SBH.versions.runtimeDexCfgContract = 1;
(function () {
var P = Packages;
var File = P.java.io.File;
var JavaString = P.java.lang.String;
var Base64 = P.android.util.Base64;
var ShellCommand = P.tornaco.apps.shortx.core.proto.action.ShellCommand;
var SCHEMA = 1;
var MAX_DEX = 131072;
var MAX_PATH_STATES = 4096;
var MAX_PATH_STEPS = 1200;
var MAX_VALUES = 8;
var cacheFile = new File(SBH.paths.cacheDir, "runtime_dex_cfg_contract.json");
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
clientCfg: null,
serverCfg: null,
requestSchema: null,
responseSchema: null,
tokenValidationEvidence: [],
commandValidationEvidence: [],
correlationEchoEvidence: [],
clientSuccessMarkerEvidence: [],
serverBootstrapMarkerEvidence: [],
pingPathEvidence: [],
pingExpectedResponses: [],
pingSideEffectEvidence: [],
startPathEvidence: [],
exceptionResponseEvidence: [],
staticFieldEvidence: [],
cfgDiagnostics: [],
socketAddressSource: null,
authenticationCarrier: null,
correlationCarrier: null,
commandCarrier: null,
lineFramingConfirmed: false,
tokenValidationConfirmed: false,
commandCarrierConfirmed: false,
correlationEchoConfirmed: false,
oneRequestOneResponseConfirmed: false,
pingBranchConfirmed: false,
pingResponseStatusResolved: false,
pingSideEffectFree: false,
correlationState: "unknown",
commandCarrierState: "unknown",
authenticationCarrierState: "unknown",
framingState: "unknown",
pingContractState: "unknown",
readOnlyPingContractReady: false,
minimumProbeImplementation: "custom_local_socket_client_required",
cfgEvidenceAvailable: false,
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
adapterImplementationAllowed: false,
adapterInvocationEnabled: false,
readyForExplicitDryRun: false,
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
.setId("JS#SingBoxHubRuntimeDexCfgContract")
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
} catch (ignoredProbe) {}
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
return /^\/data\/system\/shortx_[A-Za-z0-9_-]+\/SingBoxHub\/runtime\/core\/SingBoxHubCoreRuntime\.jar$/
.test(value) && value.indexOf("/../") < 0 && value.indexOf("//") < 0;
}
function validClass(value) {
return /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)+$/
.test(String(value || ""));
}
function inputKey(evidence, status) {
var archive = status ? status.runtimeArchiveInventory : null;
var contract = status ? status.runtimeDexContract : null;
var code = status ? status.runtimeDexCodeContract : null;
var dataflow = status ? status.runtimeDexProtocolDataflow : null;
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
code ? code.state : "",
dataflow ? dataflow.state : ""
].join("|");
}
function shellCommand(evidence) {
var lines = [
"T=/system/bin/toybox",
"J=" + quote(evidence.runtimeJar),
"printf 'exists\\t0\\npathMatched\\t0\\npayloadStatus\\tnot_requested\\n'",
"[ -f \"$J\" ] || exit 0",
"R=\"$($T readlink -f \"$J\" 2>/dev/null)\"",
"printf 'exists\\t1\\nrealPath\\t%s\\n' \"$R\"",
"[ \"$R\" = \"$J\" ] || { printf 'payloadStatus\\tpath_mismatch\\n'; exit 0; }",
"printf 'pathMatched\\t1\\n'",
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
return "/system/bin/toybox timeout 12 /system/bin/sh -c " + quote(lines.join("\n"));
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
function signed4(value) {
value = Number(value) & 15;
return value & 8 ? value - 16 : value;
}
function signed8(value) {
value = Number(value) & 255;
return value & 128 ? value - 256 : value;
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
function sleb(bytes, offset) {
var result = 0;
var shift = 0;
var position = Number(offset);
var value;
var count = 0;
do {
value = u1(bytes, position);
position += 1;
result |= (value & 127) << shift;
shift += 7;
count += 1;
if (count > 5) {
throw new Error("Invalid SLEB128");
}
} while ((value & 128) !== 0);
if (shift < 32 && (value & 64) !== 0) {
result |= -1 << shift;
}
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
if (!value || list.length >= Number(maximum || 128)) {
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
var fieldCount = safeCount(u4(bytes, 80), 4096, "field_ids_size");
var fieldOffset = u4(bytes, 84);
var methodCount = safeCount(u4(bytes, 88), 8192, "method_ids_size");
var methodOffset = u4(bytes, 92);
var classCount = safeCount(u4(bytes, 96), 2048, "class_defs_size");
var classOffset = u4(bytes, 100);
var i;
var offset;
var params;
var returnType;
var className;
var typeName;
var fieldName;
table.strings = [];
table.types = [];
table.protos = [];
table.fields = [];
table.methods = [];
table.classes = {};
bounds(bytes, stringOffset, stringCount * 4);
bounds(bytes, typeOffset, typeCount * 4);
bounds(bytes, protoOffset, protoCount * 12);
bounds(bytes, fieldOffset, fieldCount * 8);
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
for (i = 0; i < fieldCount; i += 1) {
offset = fieldOffset + i * 8;
className = String(table.types[u2(bytes, offset)] || "?");
typeName = String(table.types[u2(bytes, offset + 2)] || "?");
fieldName = String(table.strings[u4(bytes, offset + 4)] || "?");
table.fields.push({
classDescriptor: className,
typeDescriptor: typeName,
name: fieldName,
signature: className + "->" + fieldName + ":" + typeName
});
}
for (i = 0; i < methodCount; i += 1) {
offset = methodOffset + i * 8;
table.methods.push({
classDescriptor: String(table.types[u2(bytes, offset)] || ""),
protoIndex: u2(bytes, offset + 2),
name: String(table.strings[u4(bytes, offset + 4)] || "")
});
table.methods[i].proto = table.protos[table.methods[i].protoIndex] || {
returnType: "?",
parameters: [],
descriptor: "(?)?"
};
table.methods[i].signature = table.methods[i].classDescriptor + "->" +
table.methods[i].name + table.methods[i].proto.descriptor;
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
var position = Number(classDataOffset || 0);
var value;
var staticFields;
var instanceFields;
var directMethods;
var virtualMethods;
var methodIndex;
function readPart(count) {
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
readPart(directMethods);
readPart(virtualMethods);
return output;
}
function findMainMethod(bytes, table, classDescriptor) {
var classInfo = table.classes[classDescriptor];
var methods;
var i;
if (!classInfo) {
return null;
}
methods = encodedMethods(bytes, classInfo.classDataOffset, table);
for (i = 0; i < methods.length; i += 1) {
if (methods[i].method && methods[i].method.name === "main" &&
methods[i].method.proto.descriptor === "([Ljava/lang/String;)V") {
return methods[i];
}
}
return null;
}
function instructionWidth(bytes, insnsOffset, pc) {
var first = u2(bytes, insnsOffset + pc * 2);
var opcode = first & 255;
var ident;
var size;
var elementWidth;
var elementCount;
if (opcode === 0) {
ident = first >>> 8;
if (ident === 1) {
size = u2(bytes, insnsOffset + (pc + 1) * 2);
return 4 + size * 2;
}
if (ident === 2) {
size = u2(bytes, insnsOffset + (pc + 1) * 2);
return 2 + size * 4;
}
if (ident === 3) {
elementWidth = u2(bytes, insnsOffset + (pc + 1) * 2);
elementCount = u4(bytes, insnsOffset + (pc + 2) * 2);
return 4 + Math.ceil(elementWidth * elementCount / 2);
}
return 1;
}
if (opcode === 0x18) {
return 5;
}
if (opcode === 0xfa || opcode === 0xfb) {
return 4;
}
if (opcode === 0x03 || opcode === 0x06 || opcode === 0x09 ||
opcode === 0x14 || opcode === 0x17 || opcode === 0x1b ||
opcode === 0x24 || opcode === 0x25 || opcode === 0x26 ||
opcode === 0x2a || opcode === 0x2b || opcode === 0x2c ||
(opcode >= 0x6e && opcode <= 0x72) ||
(opcode >= 0x74 && opcode <= 0x78)) {
return 3;
}
if (opcode === 0x02 || opcode === 0x05 || opcode === 0x08 ||
opcode === 0x13 || opcode === 0x15 || opcode === 0x16 ||
opcode === 0x19 || opcode === 0x1a || opcode === 0x1c ||
opcode === 0x1f || opcode === 0x20 || opcode === 0x22 ||
opcode === 0x23 || opcode === 0x29 ||
(opcode >= 0x2d && opcode <= 0x3d) ||
(opcode >= 0x44 && opcode <= 0x6d) ||
(opcode >= 0x90 && opcode <= 0xaf) ||
(opcode >= 0xd0 && opcode <= 0xe2) ||
opcode === 0xed || (opcode >= 0xf2 && opcode <= 0xf7) ||
opcode === 0xfe || opcode === 0xff) {
return 2;
}
return 1;
}
function invokeRegisters(first, third, rangeStart, isRange) {
var output = [];
var count;
var g;
var c;
var d;
var e;
var f;
var i;
if (isRange) {
count = first >>> 8;
for (i = 0; i < count && i < 64; i += 1) {
output.push(rangeStart + i);
}
return output;
}
count = (first >>> 12) & 15;
g = (first >>> 8) & 15;
c = third & 15;
d = (third >>> 4) & 15;
e = (third >>> 8) & 15;
f = (third >>> 12) & 15;
if (count > 0) { output.push(c); }
if (count > 1) { output.push(d); }
if (count > 2) { output.push(e); }
if (count > 3) { output.push(f); }
if (count > 4) { output.push(g); }
return output;
}
function parseCatchHandlers(bytes, codeOffset, insnsSize, triesSize) {
var output = [];
var triesOffset;
var handlerListOffset;
var position;
var listSize;
var value;
var handlerMap = {};
var i;
var j;
var relative;
var count;
var absCount;
var addresses;
var typeIndex;
var address;
var start;
var length;
var handlerOffset;
if (!triesSize) {
return output;
}
triesOffset = codeOffset + 16 + insnsSize * 2 + (insnsSize % 2 ? 2 : 0);
handlerListOffset = triesOffset + triesSize * 8;
position = handlerListOffset;
value = uleb(bytes, position);
listSize = safeCount(value.value, 256, "catch handler count");
position = value.next;
for (i = 0; i < listSize; i += 1) {
relative = position - handlerListOffset;
value = sleb(bytes, position);
count = value.value;
position = value.next;
absCount = Math.abs(count);
addresses = [];
for (j = 0; j < absCount; j += 1) {
value = uleb(bytes, position);
typeIndex = value.value;
position = value.next;
value = uleb(bytes, position);
address = value.value;
position = value.next;
addresses.push({ typeIndex: typeIndex, address: address });
}
if (count <= 0) {
value = uleb(bytes, position);
addresses.push({ typeIndex: -1, address: value.value });
position = value.next;
}
handlerMap[String(relative)] = addresses;
}
for (i = 0; i < triesSize; i += 1) {
start = u4(bytes, triesOffset + i * 8);
length = u2(bytes, triesOffset + i * 8 + 4);
handlerOffset = u2(bytes, triesOffset + i * 8 + 6);
output.push({
startPc: start,
endPc: start + length,
handlers: handlerMap[String(handlerOffset)] || []
});
}
return output;
}
function decodeMethod(bytes, method, table, role) {
var codeOffset = Number(method.codeOffset || 0);
var registersSize;
var insSize;
var outsSize;
var triesSize;
var insnsSize;
var insnsOffset;
var instructions = [];
var byPc = {};
var pc = 0;
var width;
var first;
var opcode;
var second;
var third;
var item;
var i;
var targetOffset;
var payloadPc;
var payloadIdent;
var payloadSize;
var firstKey;
var key;
var switchTarget;
if (!codeOffset) {
return null;
}
registersSize = u2(bytes, codeOffset);
insSize = u2(bytes, codeOffset + 2);
outsSize = u2(bytes, codeOffset + 4);
triesSize = u2(bytes, codeOffset + 6);
insnsSize = u4(bytes, codeOffset + 12);
insnsOffset = codeOffset + 16;
bounds(bytes, insnsOffset, insnsSize * 2);
while (pc < insnsSize) {
first = u2(bytes, insnsOffset + pc * 2);
opcode = first & 255;
width = instructionWidth(bytes, insnsOffset, pc);
if (width < 1 || pc + width > insnsSize) {
throw new Error("Invalid instruction width at pc " + pc);
}
second = width > 1 ? u2(bytes, insnsOffset + (pc + 1) * 2) : 0;
third = width > 2 ? u2(bytes, insnsOffset + (pc + 2) * 2) : 0;
item = {
pc: pc,
opcode: opcode,
first: first,
second: second,
third: third,
width: width,
nextPc: pc + width,
successors: [],
exceptionSuccessors: [],
payload: false,
role: role
};
if (opcode === 0) {
payloadIdent = first >>> 8;
if (payloadIdent !== 0) {
item.payload = true;
item.payloadIdent = payloadIdent;
}
}
instructions.push(item);
byPc[String(pc)] = item;
pc += width;
}
for (i = 0; i < instructions.length; i += 1) {
item = instructions[i];
opcode = item.opcode;
if (item.payload) {
continue;
}
if (opcode === 0x0e || opcode === 0x0f || opcode === 0x10 ||
opcode === 0x11 || opcode === 0x27) {
continue;
}
if (opcode === 0x28) {
item.successors.push(item.pc + signed8(item.first >>> 8));
continue;
}
if (opcode === 0x29) {
item.successors.push(item.pc + signed16(item.second));
continue;
}
if (opcode === 0x2a) {
item.successors.push(item.pc + signed32(item.second + item.third * 65536));
continue;
}
if (opcode >= 0x32 && opcode <= 0x3d) {
item.successors.push(item.nextPc);
item.successors.push(item.pc + signed16(item.second));
continue;
}
if (opcode === 0x2b || opcode === 0x2c) {
targetOffset = signed32(item.second + item.third * 65536);
payloadPc = item.pc + targetOffset;
item.successors.push(item.nextPc);
if (opcode === 0x2b) {
payloadIdent = u2(bytes, insnsOffset + payloadPc * 2);
if (payloadIdent === 0x0100) {
payloadSize = u2(bytes, insnsOffset + (payloadPc + 1) * 2);
firstKey = signed32(u4(bytes, insnsOffset + (payloadPc + 2) * 2));
for (key = 0; key < payloadSize; key += 1) {
switchTarget = signed32(u4(bytes,
insnsOffset + (payloadPc + 4 + key * 2) * 2));
item.successors.push(item.pc + switchTarget);
}
item.switchFirstKey = firstKey;
}
} else {
payloadIdent = u2(bytes, insnsOffset + payloadPc * 2);
if (payloadIdent === 0x0200) {
payloadSize = u2(bytes, insnsOffset + (payloadPc + 1) * 2);
for (key = 0; key < payloadSize; key += 1) {
switchTarget = signed32(u4(bytes,
insnsOffset + (payloadPc + 2 + payloadSize * 2 + key * 2) * 2));
item.successors.push(item.pc + switchTarget);
}
}
}
continue;
}
if (byPc[String(item.nextPc)]) {
item.successors.push(item.nextPc);
}
}
item = parseCatchHandlers(bytes, codeOffset, insnsSize, triesSize);
for (i = 0; i < item.length; i += 1) {
var j;
var k;
var instruction;
for (j = 0; j < instructions.length; j += 1) {
instruction = instructions[j];
if (instruction.pc >= item[i].startPc && instruction.pc < item[i].endPc &&
((instruction.opcode >= 0x6e && instruction.opcode <= 0x78) ||
instruction.opcode === 0x27)) {
for (k = 0; k < item[i].handlers.length; k += 1) {
instruction.exceptionSuccessors.push(item[i].handlers[k].address);
}
}
}
}
return {
role: role,
codeOffset: codeOffset,
registersSize: registersSize,
insSize: insSize,
outsSize: outsSize,
triesSize: triesSize,
insnsSize: insnsSize,
insnsOffset: insnsOffset,
instructions: instructions,
byPc: byPc,
catchRegions: item
};
}
function copyList(list) {
return list ? list.slice(0) : [];
}
function copyMapOfLists(map) {
var output = {};
var key;
for (key in map) {
if (Object.prototype.hasOwnProperty.call(map, key)) {
output[key] = copyList(map[key]);
}
}
return output;
}
function copySimpleMap(map) {
var output = {};
var key;
for (key in map) {
if (Object.prototype.hasOwnProperty.call(map, key)) {
output[key] = map[key];
}
}
return output;
}
function copyNestedMap(map) {
var output = {};
var key;
var inner;
var innerKey;
for (key in map) {
if (Object.prototype.hasOwnProperty.call(map, key)) {
inner = {};
for (innerKey in map[key]) {
if (Object.prototype.hasOwnProperty.call(map[key], innerKey)) {
inner[innerKey] = copyList(map[key][innerKey]);
}
}
output[key] = inner;
}
}
return output;
}
function copyObjectMeta(map) {
var output = {};
var key;
var value;
for (key in map) {
if (Object.prototype.hasOwnProperty.call(map, key)) {
value = map[key];
output[key] = {
type: value.type,
constructor: value.constructor || "",
args: value.args ? value.args.slice(0) : []
};
}
}
return output;
}
function cloneState(state) {
return {
regs: copyMapOfLists(state.regs),
staticFields: copyMapOfLists(state.staticFields),
arrays: copyNestedMap(state.arrays),
objects: copyObjectMeta(state.objects),
readerLines: copySimpleMap(state.readerLines),
writerLines: copySimpleMap(state.writerLines),
lastResult: copyList(state.lastResult),
conditions: copyList(state.conditions),
exceptionPath: state.exceptionPath === true,
steps: Number(state.steps || 0)
};
}
function valueList(value) {
if (value === null || value === undefined) {
return [];
}
if (Object.prototype.toString.call(value) === "[object Array]") {
return value.slice(0);
}
return [String(value)];
}
function unionValues(left, right) {
var output = [];
var all = valueList(left).concat(valueList(right));
var i;
var j;
var exists;
for (i = 0; i < all.length && output.length < MAX_VALUES; i += 1) {
exists = false;
for (j = 0; j < output.length; j += 1) {
if (output[j] === all[i]) {
exists = true;
break;
}
}
if (!exists) {
output.push(String(all[i]));
}
}
return output;
}
function regGet(state, registerIndex) {
var value = state.regs[String(registerIndex)];
return value && value.length ? value.slice(0) : ["unknown:v" + registerIndex];
}
function regSet(state, registerIndex, values) {
state.regs[String(registerIndex)] = unionValues([], values);
}
function staticGet(state, signature) {
var value = state.staticFields[String(signature)];
return value && value.length ? value.slice(0) : ["static:" + signature + ":unknown"];
}
function staticSet(state, signature, values) {
state.staticFields[String(signature)] = unionValues([], values);
}
function firstObjectId(values) {
var i;
for (i = 0; i < values.length; i += 1) {
if (String(values[i]).indexOf("obj:") === 0) {
return String(values[i]);
}
}
return "";
}
function firstArrayId(values) {
var i;
for (i = 0; i < values.length; i += 1) {
if (String(values[i]).indexOf("array:") === 0) {
return String(values[i]);
}
}
return "";
}
function renderValues(values) {
return valueList(values).join(" | ");
}
function addCondition(state, condition) {
pushUnique(state.conditions, condition, 32);
}
function conditionKey(conditions) {
var copy = conditions.slice(0);
copy.sort();
return copy.join("&&");
}
function stateSignature(pc, state) {
var regKeys = [];
var fieldKeys = [];
var key;
var parts = [String(pc), conditionKey(state.conditions), state.exceptionPath ? "E" : "N"];
for (key in state.regs) {
if (Object.prototype.hasOwnProperty.call(state.regs, key)) {
regKeys.push(key);
}
}
regKeys.sort(function (a, b) { return Number(a) - Number(b); });
for (key = 0; key < regKeys.length; key += 1) {
parts.push("r" + regKeys[key] + "=" + state.regs[regKeys[key]].join(","));
}
for (key in state.staticFields) {
if (Object.prototype.hasOwnProperty.call(state.staticFields, key)) {
fieldKeys.push(key);
}
}
fieldKeys.sort();
for (key = 0; key < fieldKeys.length; key += 1) {
parts.push("f" + fieldKeys[key] + "=" + state.staticFields[fieldKeys[key]].join(","));
}
fieldKeys = [];
for (key in state.readerLines) {
if (Object.prototype.hasOwnProperty.call(state.readerLines, key)) {
fieldKeys.push(key);
}
}
fieldKeys.sort();
for (key = 0; key < fieldKeys.length; key += 1) {
parts.push("rd" + fieldKeys[key] + "=" + state.readerLines[fieldKeys[key]]);
}
fieldKeys = [];
for (key in state.writerLines) {
if (Object.prototype.hasOwnProperty.call(state.writerLines, key)) {
fieldKeys.push(key);
}
}
fieldKeys.sort();
for (key = 0; key < fieldKeys.length; key += 1) {
parts.push("wr" + fieldKeys[key] + "=" + state.writerLines[fieldKeys[key]]);
}
return parts.join("|");
}
function decodeInvokeRegisters(instruction) {
var isRange = instruction.opcode >= 0x74 && instruction.opcode <= 0x78;
return invokeRegisters(
instruction.first,
instruction.third,
isRange ? instruction.third : 0,
isRange
);
}
function comparisonExpression(methodName, leftValues, rightValues) {
return methodName + "(" + renderValues(leftValues) + "," + renderValues(rightValues) + ")";
}
function branchTruth(opcode, takeTarget) {
if (opcode === 0x38 || opcode === 0x32) {
return !takeTarget;
}
if (opcode === 0x39 || opcode === 0x33) {
return takeTarget;
}
return null;
}
function instructionCanThrow(opcode) {
return (opcode >= 0x44 && opcode <= 0x6d) ||
(opcode >= 0x6e && opcode <= 0x78) ||
opcode === 0x1d || opcode === 0x1e || opcode === 0x1f ||
opcode === 0x20 || opcode === 0x21 || opcode === 0x22 ||
opcode === 0x23 || opcode === 0x24 || opcode === 0x25 ||
opcode === 0x27;
}
function analyzeMethod(bytes, decoded, table) {
var role = decoded.role;
var initial = {
regs: {},
staticFields: {},
arrays: {},
objects: {},
readerLines: {},
writerLines: {},
lastResult: [],
conditions: [],
exceptionPath: false,
steps: 0
};
var argsRegister = decoded.registersSize - decoded.insSize;
var queue = [];
var seen = {};
var processed = 0;
var terminated = 0;
var limitReached = false;
var writes = [];
var reads = [];
var calls = [];
var branches = [];
var sideEffects = [];
var argumentUses = {};
var staticFields = [];
var leaders = { "0": true };
var edges = {};
var i;
var j;
var instruction;
var successor;
var state;
var item;
var signature;
regSet(initial, argsRegister, ["mainArgs"]);
queue.push({ pc: 0, state: initial });
for (i = 0; i < decoded.instructions.length; i += 1) {
instruction = decoded.instructions[i];
for (j = 0; j < instruction.successors.length; j += 1) {
successor = instruction.successors[j];
leaders[String(successor)] = true;
edges[String(instruction.pc) + ">" + String(successor)] = true;
}
for (j = 0; j < instruction.exceptionSuccessors.length; j += 1) {
successor = instruction.exceptionSuccessors[j];
leaders[String(successor)] = true;
edges[String(instruction.pc) + "!>" + String(successor)] = true;
}
if (instruction.successors.length > 1 && decoded.byPc[String(instruction.nextPc)]) {
leaders[String(instruction.nextPc)] = true;
}
}
function noteArg(index, usage) {
var key = String(index);
if (!argumentUses[key]) {
argumentUses[key] = [];
}
pushUnique(argumentUses[key], usage, 64);
}
function valuesContain(values, prefix) {
var index;
for (index = 0; index < values.length; index += 1) {
if (String(values[index]).indexOf(prefix) === 0) {
return true;
}
}
return false;
}
function mapArgUsage(values, usage) {
var index;
var match;
for (index = 0; index < values.length; index += 1) {
match = /^arg:(\d+)$/.exec(String(values[index]));
if (match) {
noteArg(Number(match[1]), usage);
}
}
}
function recordCall(pc, method, args, currentState) {
calls.push({
pc: pc,
signature: method.signature,
arguments: args.map(renderValues),
conditions: currentState.conditions.slice(0),
exceptionPath: currentState.exceptionPath === true
});
}
function enqueue(pc, nextState) {
if (!decoded.byPc[String(pc)]) {
return;
}
if (nextState.steps > MAX_PATH_STEPS || processed + queue.length >= MAX_PATH_STATES) {
limitReached = true;
return;
}
queue.push({ pc: pc, state: nextState });
}
function constructorUpdate(currentState, objectValues, method, args) {
var objectId = firstObjectId(objectValues);
if (objectId && currentState.objects[objectId]) {
currentState.objects[objectId].constructor = method.signature;
currentState.objects[objectId].args = args.slice(1).map(renderValues);
}
}
function invokeResult(currentState, method, args, pc) {
var objectId;
var line;
var result;
if (method.name === "<init>") {
constructorUpdate(currentState, args[0] || [], method, args);
return [];
}
if (method.signature.indexOf("Ljava/io/BufferedReader;->readLine()Ljava/lang/String;") >= 0) {
objectId = firstObjectId(args[0] || []);
line = Number(currentState.readerLines[objectId] || 0);
currentState.readerLines[objectId] = line + 1;
result = role + ".readLine[" + line + "]";
reads.push({
role: role,
pc: pc,
lineIndex: line,
value: result,
conditions: currentState.conditions.slice(0),
exceptionPath: currentState.exceptionPath === true
});
return [result];
}
if (method.classDescriptor === "Ljava/lang/String;" &&
(method.name === "equals" || method.name === "equalsIgnoreCase")) {
return ["bool:" + comparisonExpression(method.name, args[0] || [], args[1] || [])];
}
if (method.signature.indexOf("Ljava/lang/Process;->isAlive()Z") >= 0) {
return ["bool:isAlive(" + renderValues(args[0] || []) + ")"];
}
if (method.signature.indexOf("Ljava/lang/Process;->waitFor()I") >= 0) {
return ["int:waitFor(" + renderValues(args[0] || []) + ")"];
}
if (method.signature.indexOf("Ljava/lang/Runtime;->getRuntime()Ljava/lang/Runtime;") >= 0) {
return ["runtime:singleton"];
}
if (method.signature.indexOf("Ljava/lang/Runtime;->exec([Ljava/lang/String;)Ljava/lang/Process;") >= 0) {
return ["process:exec@" + pc];
}
if (method.signature.indexOf("Landroid/net/LocalServerSocket;->accept()Landroid/net/LocalSocket;") >= 0) {
return ["obj:Landroid/net/LocalSocket;@accept" + pc];
}
if (method.proto.returnType && method.proto.returnType !== "V") {
return ["call:" + method.signature + "@" + pc];
}
return [];
}
while (queue.length > 0) {
item = queue.shift();
state = item.state;
instruction = decoded.byPc[String(item.pc)];
if (!instruction) {
continue;
}
state.steps += 1;
signature = stateSignature(item.pc, state);
if (seen[signature]) {
continue;
}
seen[signature] = true;
processed += 1;
if (processed > MAX_PATH_STATES) {
limitReached = true;
break;
}
var opcode = instruction.opcode;
var first = instruction.first;
var second = instruction.second;
var third = instruction.third;
var a;
var b;
var c;
var index;
var value;
var values;
var sourceValues;
var objectId;
var arrayId;
var method;
var registers;
var args;
var callResult;
var field;
var nextState;
var targetState;
var targetPc;
var fallthroughPc;
var truth;
var condition;
var lineIndex;
var writerId;
if (opcode === 0x01 || opcode === 0x04 || opcode === 0x07) {
a = (first >>> 8) & 15;
b = first >>> 12;
regSet(state, a, regGet(state, b));
} else if (opcode === 0x02 || opcode === 0x05 || opcode === 0x08) {
a = first >>> 8;
b = second;
regSet(state, a, regGet(state, b));
} else if (opcode === 0x03 || opcode === 0x06 || opcode === 0x09) {
a = second;
b = third;
regSet(state, a, regGet(state, b));
} else if (opcode === 0x0a || opcode === 0x0b || opcode === 0x0c) {
a = first >>> 8;
regSet(state, a, state.lastResult);
state.lastResult = [];
} else if (opcode === 0x0d) {
a = first >>> 8;
regSet(state, a, ["exception"]);
} else if (opcode === 0x12) {
a = (first >>> 8) & 15;
regSet(state, a, ["int:" + signed4(first >>> 12)]);
} else if (opcode === 0x13) {
a = first >>> 8;
regSet(state, a, ["int:" + signed16(second)]);
} else if (opcode === 0x14) {
a = first >>> 8;
regSet(state, a, ["int:" + signed32(second + third * 65536)]);
} else if (opcode === 0x15) {
a = first >>> 8;
regSet(state, a, ["int:" + (signed16(second) * 65536)]);
} else if (opcode === 0x1a || opcode === 0x1b) {
a = first >>> 8;
index = opcode === 0x1a ? second : second + third * 65536;
regSet(state, a, ["string:" + String(table.strings[index] || "")]);
} else if (opcode === 0x1c) {
a = first >>> 8;
regSet(state, a, ["class:" + String(table.types[second] || "?")]);
} else if (opcode === 0x1f) {
a = first >>> 8;
sourceValues = regGet(state, a);
regSet(state, a, sourceValues);
} else if (opcode === 0x20) {
a = (first >>> 8) & 15;
b = first >>> 12;
regSet(state, a, ["bool:instanceof(" + renderValues(regGet(state, b)) + "," +
String(table.types[second] || "?") + ")"]);
} else if (opcode === 0x21) {
a = (first >>> 8) & 15;
b = first >>> 12;
regSet(state, a, ["int:length(" + renderValues(regGet(state, b)) + ")"]);
} else if (opcode === 0x22) {
a = first >>> 8;
objectId = "obj:" + String(table.types[second] || "?") + "@" + instruction.pc;
regSet(state, a, [objectId]);
state.objects[objectId] = {
type: String(table.types[second] || "?"),
constructor: "",
args: []
};
} else if (opcode === 0x23) {
a = (first >>> 8) & 15;
b = first >>> 12;
arrayId = "array:" + String(table.types[second] || "?") + "@" + instruction.pc;
regSet(state, a, [arrayId]);
state.arrays[arrayId] = {};
state.arrays[arrayId].length = regGet(state, b);
} else if (opcode === 0x24 || opcode === 0x25) {
registers = decodeInvokeRegisters(instruction);
arrayId = "array:filled@" + instruction.pc;
state.arrays[arrayId] = {};
for (i = 0; i < registers.length; i += 1) {
state.arrays[arrayId][String(i)] = regGet(state, registers[i]);
}
state.lastResult = [arrayId];
} else if (opcode === 0x46) {
a = first >>> 8;
b = second & 255;
c = second >>> 8;
sourceValues = regGet(state, b);
values = regGet(state, c);
if (valuesContain(sourceValues, "mainArgs") && values.length === 1 &&
String(values[0]).indexOf("int:") === 0) {
index = Number(String(values[0]).substring(4));
regSet(state, a, ["arg:" + index]);
noteArg(index, "loaded@pc" + instruction.pc);
} else {
arrayId = firstArrayId(sourceValues);
if (arrayId && state.arrays[arrayId]) {
index = values.length === 1 && String(values[0]).indexOf("int:") === 0 ?
Number(String(values[0]).substring(4)) : -1;
regSet(state, a, index >= 0 && state.arrays[arrayId][String(index)] ?
state.arrays[arrayId][String(index)] : ["array-item:" + arrayId]);
} else {
regSet(state, a, ["array-item:" + renderValues(sourceValues)]);
}
}
} else if (opcode === 0x4d) {
a = first >>> 8;
b = second & 255;
c = second >>> 8;
arrayId = firstArrayId(regGet(state, b));
values = regGet(state, c);
if (arrayId && state.arrays[arrayId] && values.length === 1 &&
String(values[0]).indexOf("int:") === 0) {
index = Number(String(values[0]).substring(4));
state.arrays[arrayId][String(index)] = regGet(state, a);
}
} else if (opcode >= 0x52 && opcode <= 0x58) {
a = (first >>> 8) & 15;
field = table.fields[second];
regSet(state, a, ["instance-field:" + (field ? field.signature : second)]);
} else if (opcode >= 0x59 && opcode <= 0x5f) {
field = table.fields[second];
sideEffects.push({
role: role,
pc: instruction.pc,
operation: "instance-field-write",
field: field ? field.signature : String(second),
values: regGet(state, (first >>> 8) & 15),
conditions: state.conditions.slice(0),
exceptionPath: state.exceptionPath === true
});
} else if (opcode >= 0x60 && opcode <= 0x66) {
a = first >>> 8;
field = table.fields[second];
regSet(state, a, staticGet(state, field ? field.signature : String(second)));
pushUnique(staticFields, field ? field.signature : String(second), 64);
} else if (opcode >= 0x67 && opcode <= 0x6d) {
a = first >>> 8;
field = table.fields[second];
staticSet(state, field ? field.signature : String(second), regGet(state, a));
pushUnique(staticFields, field ? field.signature : String(second), 64);
sideEffects.push({
role: role,
pc: instruction.pc,
operation: "static-field-write",
field: field ? field.signature : String(second),
values: regGet(state, a),
conditions: state.conditions.slice(0),
exceptionPath: state.exceptionPath === true
});
} else if ((opcode >= 0x6e && opcode <= 0x72) ||
(opcode >= 0x74 && opcode <= 0x78)) {
index = second;
method = table.methods[index];
registers = decodeInvokeRegisters(instruction);
args = [];
for (i = 0; i < registers.length; i += 1) {
args.push(regGet(state, registers[i]));
}
if (method) {
recordCall(instruction.pc, method, args, state);
for (i = 0; i < args.length; i += 1) {
mapArgUsage(args[i], method.signature + ".arg" + i + "@pc" + instruction.pc);
}
if (method.signature.indexOf("Ljava/io/BufferedWriter;->write(Ljava/lang/String;)V") >= 0) {
writerId = firstObjectId(args[0] || []);
lineIndex = Number(state.writerLines[writerId] || 0);
writes.push({
role: role,
pc: instruction.pc,
writer: writerId,
lineIndex: lineIndex,
values: (args[1] || []).slice(0),
conditions: state.conditions.slice(0),
exceptionPath: state.exceptionPath === true
});
mapArgUsage(args[1] || [], "BufferedWriter.write.line" + lineIndex + "@pc" + instruction.pc);
} else if (method.signature.indexOf("Ljava/io/BufferedWriter;->newLine()V") >= 0) {
writerId = firstObjectId(args[0] || []);
state.writerLines[writerId] = Number(state.writerLines[writerId] || 0) + 1;
} else if (method.signature.indexOf("Ljava/io/File;->createNewFile()Z") >= 0) {
objectId = firstObjectId(args[0] || []);
sideEffects.push({
role: role,
pc: instruction.pc,
operation: "createNewFile",
target: objectId && state.objects[objectId] ? state.objects[objectId].args : [],
conditions: state.conditions.slice(0),
exceptionPath: state.exceptionPath === true
});
} else if (method.signature.indexOf("Ljava/lang/Runtime;->exec([Ljava/lang/String;)Ljava/lang/Process;") >= 0) {
arrayId = firstArrayId(args[1] || []);
sideEffects.push({
role: role,
pc: instruction.pc,
operation: "Runtime.exec",
command: arrayId && state.arrays[arrayId] ? state.arrays[arrayId] : {},
conditions: state.conditions.slice(0),
exceptionPath: state.exceptionPath === true
});
} else if (method.signature.indexOf("Ljava/lang/Process;->destroy()V") >= 0) {
sideEffects.push({
role: role,
pc: instruction.pc,
operation: "Process.destroy",
target: args[0] || [],
conditions: state.conditions.slice(0),
exceptionPath: state.exceptionPath === true
});
} else if (method.signature.indexOf("Landroid/net/LocalSocketAddress;-><init>(Ljava/lang/String;)V") >= 0 ||
method.signature.indexOf("Landroid/net/LocalServerSocket;-><init>(Ljava/lang/String;)V") >= 0) {
mapArgUsage(args[1] || [], method.signature + "@pc" + instruction.pc);
}
callResult = invokeResult(state, method, args, instruction.pc);
state.lastResult = callResult;
}
}
if (!((opcode >= 0x6e && opcode <= 0x72) ||
(opcode >= 0x74 && opcode <= 0x78) ||
opcode === 0x0a || opcode === 0x0b || opcode === 0x0c ||
opcode === 0x24 || opcode === 0x25)) {
state.lastResult = [];
}
if (opcode === 0x0e || opcode === 0x0f || opcode === 0x10 ||
opcode === 0x11 || opcode === 0x27) {
terminated += 1;
} else if (opcode === 0x28 || opcode === 0x29 || opcode === 0x2a) {
if (instruction.successors.length) {
enqueue(instruction.successors[0], cloneState(state));
}
} else if (opcode >= 0x32 && opcode <= 0x3d) {
fallthroughPc = instruction.nextPc;
targetPc = instruction.pc + signed16(instruction.second);
nextState = cloneState(state);
targetState = cloneState(state);
if (opcode >= 0x38 && opcode <= 0x3d) {
a = first >>> 8;
values = regGet(state, a);
condition = renderValues(values);
truth = branchTruth(opcode, false);
if (truth !== null) {
addCondition(nextState, condition + "=" + String(truth));
addCondition(targetState, condition + "=" + String(!truth));
branches.push({
role: role,
pc: instruction.pc,
opcode: opcode,
condition: condition,
fallthroughPc: fallthroughPc,
targetPc: targetPc,
fallthroughTruth: truth,
targetTruth: !truth
});
} else {
addCondition(nextState, "branch@" + instruction.pc + "=fallthrough");
addCondition(targetState, "branch@" + instruction.pc + "=target");
}
} else {
a = (first >>> 8) & 15;
b = first >>> 12;
condition = "compare(" + renderValues(regGet(state, a)) + "," +
renderValues(regGet(state, b)) + ")";
addCondition(nextState, condition + "=fallthrough");
addCondition(targetState, condition + "=target");
branches.push({
role: role,
pc: instruction.pc,
opcode: opcode,
condition: condition,
fallthroughPc: fallthroughPc,
targetPc: targetPc
});
}
enqueue(fallthroughPc, nextState);
enqueue(targetPc, targetState);
} else if (instruction.successors.length) {
for (i = 0; i < instruction.successors.length; i += 1) {
enqueue(instruction.successors[i], cloneState(state));
}
} else {
terminated += 1;
}
if (instructionCanThrow(opcode) && instruction.exceptionSuccessors.length) {
for (i = 0; i < instruction.exceptionSuccessors.length; i += 1) {
nextState = cloneState(state);
nextState.exceptionPath = true;
addCondition(nextState, "exception@pc" + instruction.pc);
enqueue(instruction.exceptionSuccessors[i], nextState);
}
}
}
var argumentMap = [];
var keys = [];
var edgeCount = 0;
var blockCount = 0;
for (i in argumentUses) {
if (Object.prototype.hasOwnProperty.call(argumentUses, i)) {
keys.push(i);
}
}
keys.sort(function (left, right) { return Number(left) - Number(right); });
for (i = 0; i < keys.length; i += 1) {
argumentMap.push({ index: Number(keys[i]), usages: argumentUses[keys[i]] });
}
for (i in edges) {
if (Object.prototype.hasOwnProperty.call(edges, i)) {
edgeCount += 1;
}
}
for (i in leaders) {
if (Object.prototype.hasOwnProperty.call(leaders, i)) {
blockCount += 1;
}
}
return {
role: role,
registersSize: decoded.registersSize,
insSize: decoded.insSize,
outsSize: decoded.outsSize,
triesSize: decoded.triesSize,
insnsSize: decoded.insnsSize,
instructionCount: decoded.instructions.length,
basicBlockCount: blockCount,
edgeCount: edgeCount,
processedPathStates: processed,
terminatedPathStates: terminated,
stateLimitReached: limitReached,
argumentMap: argumentMap,
calls: calls,
reads: reads,
writes: writes,
branches: branches,
sideEffects: sideEffects,
staticFields: staticFields
};
}
function hasCondition(conditions, regex) {
var i;
for (i = 0; i < conditions.length; i += 1) {
if (regex.test(String(conditions[i]))) {
return true;
}
}
return false;
}
function valuesWithPrefix(values, prefix) {
var output = [];
var i;
var value;
for (i = 0; i < values.length; i += 1) {
value = String(values[i]);
if (value.indexOf(prefix) === 0) {
pushUnique(output, value.substring(prefix.length), 32);
}
}
return output;
}
function findWrite(writes, role, lineIndex, valuePattern) {
var output = [];
var i;
var joined;
for (i = 0; i < writes.length; i += 1) {
if (writes[i].role !== role || writes[i].lineIndex !== lineIndex) {
continue;
}
joined = writes[i].values.join("|");
if (!valuePattern || valuePattern.test(joined)) {
output.push(writes[i]);
}
}
return output;
}
function summarize(bytes, evidence, result) {
var magic = "";
var i;
var fileSize;
var headerSize;
var table;
var clientMethod;
var serverMethod;
var clientDecoded;
var serverDecoded;
var client;
var server;
var clientWrites;
var serverReads;
var clientReads;
var serverWrites;
var requestLines = {};
var responseLines = {};
var requestLineCount = 0;
var responseLineCount = 0;
var tokenWrites;
var correlationWrites;
var commandWrites;
var tokenCompare = [];
var commandCompare = [];
var correlationEcho = [];
var clientMarker = [];
var serverMarker = [];
var pingStatuses = [];
var pingPaths = [];
var pingSideEffects = [];
var startPaths = [];
var exceptionWrites = [];
var write;
var sideEffect;
var values;
var valueIndex;
var request1 = "server.readLine[1]";
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
clientMethod = findMainMethod(bytes, table, descriptor(evidence.clientClass));
serverMethod = findMainMethod(bytes, table, descriptor(evidence.serverClass));
result.clientMainCodeFound = !!(clientMethod && clientMethod.codeOffset);
result.serverMainCodeFound = !!(serverMethod && serverMethod.codeOffset);
if (!result.clientMainCodeFound || !result.serverMainCodeFound) {
result.state = "main_code_unavailable";
return;
}
clientDecoded = decodeMethod(bytes, clientMethod, table, "client");
serverDecoded = decodeMethod(bytes, serverMethod, table, "server");
client = analyzeMethod(bytes, clientDecoded, table);
server = analyzeMethod(bytes, serverDecoded, table);
result.clientCfg = {
instructionCount: client.instructionCount,
basicBlockCount: client.basicBlockCount,
edgeCount: client.edgeCount,
processedPathStates: client.processedPathStates,
terminatedPathStates: client.terminatedPathStates,
stateLimitReached: client.stateLimitReached,
argumentMap: client.argumentMap
};
result.serverCfg = {
instructionCount: server.instructionCount,
basicBlockCount: server.basicBlockCount,
edgeCount: server.edgeCount,
processedPathStates: server.processedPathStates,
terminatedPathStates: server.terminatedPathStates,
stateLimitReached: server.stateLimitReached,
argumentMap: server.argumentMap
};
clientWrites = client.writes;
serverReads = server.reads;
clientReads = client.reads;
serverWrites = server.writes;
for (i = 0; i < clientWrites.length; i += 1) {
if (!clientWrites[i].exceptionPath) {
requestLines[String(clientWrites[i].lineIndex)] = unionValues(
requestLines[String(clientWrites[i].lineIndex)] || [],
clientWrites[i].values
);
}
}
for (i in requestLines) {
if (Object.prototype.hasOwnProperty.call(requestLines, i)) {
requestLineCount = Math.max(requestLineCount, Number(i) + 1);
}
}
for (i = 0; i < serverWrites.length; i += 1) {
responseLines[String(serverWrites[i].lineIndex)] = unionValues(
responseLines[String(serverWrites[i].lineIndex)] || [],
serverWrites[i].values
);
}
for (i in responseLines) {
if (Object.prototype.hasOwnProperty.call(responseLines, i)) {
responseLineCount = Math.max(responseLineCount, Number(i) + 1);
}
}
result.requestSchema = {
lineCount: requestLineCount,
lines: requestLines,
authenticationLineIndex: 0,
correlationLineIndex: 1,
commandLineIndex: 2
};
result.responseSchema = {
lineCount: responseLineCount,
lines: responseLines,
statusLineIndex: 0,
correlationLineIndex: 1
};
tokenWrites = findWrite(clientWrites, "client", 0, /^arg:1$/);
correlationWrites = findWrite(clientWrites, "client", 1, /^arg:2$/);
commandWrites = findWrite(clientWrites, "client", 2, /^arg:3$/);
for (i = 0; i < server.branches.length; i += 1) {
if (/equals\(arg:1,server\.readLine\[0\]\)|equals\(server\.readLine\[0\],arg:1\)/
.test(server.branches[i].condition)) {
tokenCompare.push(server.branches[i]);
}
if (/equals\(string:PING,server\.readLine\[2\]\)|equals\(server\.readLine\[2\],string:PING\)/
.test(server.branches[i].condition)) {
commandCompare.push(server.branches[i]);
}
}
result.tokenValidationEvidence = tokenCompare;
result.commandValidationEvidence = commandCompare;
for (i = 0; i < serverWrites.length; i += 1) {
write = serverWrites[i];
if (write.lineIndex === 1 && valuesWithPrefix(write.values, request1).length > 0) {
correlationEcho.push(write);
}
if (write.exceptionPath) {
exceptionWrites.push(write);
}
if (write.lineIndex === 0 && !write.exceptionPath &&
hasCondition(write.conditions, /equals\(string:PING,server\.readLine\[2\]\)=true/) &&
hasCondition(write.conditions, /equals\(arg:1,server\.readLine\[0\]\)=true/)) {
values = valuesWithPrefix(write.values, "string:");
for (valueIndex = 0; valueIndex < values.length; valueIndex += 1) {
if (/^(PONG|RUNNING)$/.test(values[valueIndex])) {
pushUnique(pingStatuses, values[valueIndex], 8);
}
}
pingPaths.push(write);
}
if (write.lineIndex === 0 && !write.exceptionPath &&
hasCondition(write.conditions, /equals\(string:START,server\.readLine\[2\]\)=true/)) {
startPaths.push(write);
}
}
for (i = 0; i < client.sideEffects.length; i += 1) {
sideEffect = client.sideEffects[i];
if (sideEffect.operation === "createNewFile") {
clientMarker.push(sideEffect);
}
}
for (i = 0; i < server.sideEffects.length; i += 1) {
sideEffect = server.sideEffects[i];
if (sideEffect.operation === "createNewFile") {
serverMarker.push(sideEffect);
}
if (!sideEffect.exceptionPath &&
hasCondition(sideEffect.conditions, /equals\(string:PING,server\.readLine\[2\]\)=true/) &&
(sideEffect.operation === "Runtime.exec" ||
sideEffect.operation === "Process.destroy" ||
sideEffect.operation === "instance-field-write" ||
sideEffect.operation === "static-field-write")) {
pingSideEffects.push(sideEffect);
}
}
result.correlationEchoEvidence = correlationEcho;
result.clientSuccessMarkerEvidence = clientMarker;
result.serverBootstrapMarkerEvidence = serverMarker;
result.pingPathEvidence = pingPaths;
result.pingExpectedResponses = pingStatuses;
result.pingSideEffectEvidence = pingSideEffects;
result.startPathEvidence = startPaths;
result.exceptionResponseEvidence = exceptionWrites;
result.staticFieldEvidence = server.staticFields;
result.socketAddressSource = tokenWrites.length && client.argumentMap.length ? {
clientArgumentIndex: 0,
source: "arg[0]",
transport: "android.net.LocalSocketAddress"
} : null;
result.authenticationCarrier = tokenWrites.length && tokenCompare.length ? {
requestLineIndex: 0,
clientArgumentIndex: 1,
serverArgumentIndex: 1,
serverRequestLineIndex: 0
} : null;
result.correlationCarrier = correlationWrites.length ? {
requestLineIndex: 1,
clientArgumentIndex: 2,
responseLineIndex: 1,
echoedByServer: correlationEcho.length > 0
} : null;
result.commandCarrier = commandWrites.length && commandCompare.length ? {
requestLineIndex: 2,
clientArgumentIndex: 3,
serverRequestLineIndex: 2,
safeReadOnlyCommand: "PING"
} : null;
result.lineFramingConfirmed = requestLineCount === 3 && serverReads.length >= 3 &&
clientReads.length >= 2 && responseLineCount >= 2;
result.tokenValidationConfirmed = tokenWrites.length > 0 && tokenCompare.length > 0;
result.commandCarrierConfirmed = commandWrites.length > 0 && commandCompare.length > 0;
result.correlationEchoConfirmed = correlationWrites.length > 0 && correlationEcho.length > 0;
result.oneRequestOneResponseConfirmed = result.lineFramingConfirmed &&
clientReads.length >= 2 && serverReads.length >= 3;
result.pingBranchConfirmed = commandCompare.length > 0 && pingPaths.length > 0;
result.pingResponseStatusResolved = pingStatuses.length > 0;
result.pingSideEffectFree = pingSideEffects.length === 0;
result.correlationState = result.correlationEchoConfirmed ?
"request_line_1_response_line_1_echo_confirmed" : "correlation_echo_unresolved";
result.commandCarrierState = result.commandCarrierConfirmed ?
"request_line_2_client_arg_3_confirmed" : "command_carrier_unresolved";
result.authenticationCarrierState = result.tokenValidationConfirmed ?
"request_line_0_client_arg_1_server_arg_1_confirmed" : "authentication_carrier_unresolved";
result.framingState = result.lineFramingConfirmed ?
"three_line_request_two_line_response_confirmed" : "line_framing_incomplete";
result.readOnlyPingContractReady = result.tokenValidationConfirmed &&
result.commandCarrierConfirmed && result.correlationEchoConfirmed &&
result.lineFramingConfirmed && result.pingBranchConfirmed &&
result.pingResponseStatusResolved && result.pingSideEffectFree &&
!client.stateLimitReached && !server.stateLimitReached;
result.pingContractState = result.readOnlyPingContractReady ?
"readonly_ping_contract_ready" :
(result.pingResponseStatusResolved ? "ping_response_resolved_contract_incomplete" :
"ping_response_unresolved");
result.cfgEvidenceAvailable = true;
result.adapterImplementationAllowed = result.readOnlyPingContractReady;
result.readyForExplicitDryRun = false;
result.state = result.readOnlyPingContractReady ?
"readonly_ping_contract_ready" : "cfg_protocol_contract_identified";
if (client.stateLimitReached || server.stateLimitReached) {
result.cfgDiagnostics.push("PATH_STATE_LIMIT_REACHED");
}
if (!result.correlationEchoConfirmed) {
result.cfgDiagnostics.push("CORRELATION_ECHO_NOT_CONFIRMED");
}
if (!result.pingResponseStatusResolved) {
result.cfgDiagnostics.push("PING_RESPONSE_STATUS_NOT_RESOLVED");
}
if (!result.pingSideEffectFree) {
result.cfgDiagnostics.push("PING_PATH_SIDE_EFFECT_FOUND");
}
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
SBH.log.warn("dex.cfg.contract.cache", SBH.util.errorText(error));
}
}
function inspect(status, force) {
var evidence = endpointEvidence();
var key = inputKey(evidence, status);
var result;
var shell;
var fields;
var bytes;
if (!evidence) {
return blank(status && status.checking === true ? "checking" :
"endpoint_evidence_unavailable", null);
}
if (!validJar(evidence.runtimeJar) || !validClass(evidence.clientClass) ||
!validClass(evidence.serverClass)) {
result = blank("cfg_evidence_invalid", "Invalid Runtime endpoint evidence");
result.runtimeJarDeclared = !!evidence.runtimeJar;
result.runtimeJarPath = String(evidence.runtimeJar || "");
result.clientClassName = String(evidence.clientClass || "");
result.serverClassName = String(evidence.serverClass || "");
result.inputKey = key;
save(result);
return result;
}
if (!force && cache && cache.stale !== true && cacheKey === key) {
return cache;
}
result = blank("cfg_inspection_failed", null);
result.checking = false;
result.runtimeJarDeclared = true;
result.runtimeJarPath = evidence.runtimeJar;
result.clientClassName = evidence.clientClass;
result.serverClassName = evidence.serverClass;
result.inputKey = key;
try {
shell = runShell(shellCommand(evidence));
fields = parseShellMap(shell.out);
result.shellExitCode = shell.code;
result.shellError = shell.err;
result.runtimeJarExists = isOne(fields.exists);
result.runtimeJarCanonicalPathMatched = isOne(fields.pathMatched);
result.runtimeJarPath = fields.realPath || evidence.runtimeJar;
result.runtimeJarSize = numberOr(fields.jarSize, -1);
result.runtimeJarSha256Prefix = String(fields.jarSha || "").substring(0, 16);
result.dexPayloadStatus = fields.payloadStatus || "unknown";
result.dexBytesTransferred = numberOr(fields.dexSize, 0);
if (!result.runtimeJarExists) {
result.state = "runtime_jar_missing";
} else if (!result.runtimeJarCanonicalPathMatched) {
result.state = "runtime_jar_path_mismatch";
} else if (result.dexPayloadStatus !== "ok" || !fields.dexData) {
result.state = "dex_payload_unavailable";
} else {
bytes = Base64.decode(String(fields.dexData), Base64.DEFAULT);
result.dexBytesTransferred = Number(bytes.length);
summarize(bytes, evidence, result);
}
result.stale = false;
result.checkedAt = SBH.util.now();
save(result);
return result;
} catch (error) {
result.state = "cfg_parse_failed";
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
status.runtimeDexCfgContract = contract;
plan = status.protocolAdapterPlan;
if (plan) {
plan.runtimeDexCfgContractState = String(contract.state || "checking");
plan.cfgEvidenceAvailable = contract.cfgEvidenceAvailable === true;
plan.commandCarrierState = String(contract.commandCarrierState || "unknown");
plan.authenticationCarrierState = String(contract.authenticationCarrierState || "unknown");
plan.correlationState = String(contract.correlationState || "unknown");
plan.framingState = String(contract.framingState || "unknown");
plan.pingContractState = String(contract.pingContractState || "unknown");
plan.pingExpectedResponses = contract.pingExpectedResponses || [];
plan.pingResponseStatusResolved = contract.pingResponseStatusResolved === true;
plan.correlationEchoConfirmed = contract.correlationEchoConfirmed === true;
plan.readOnlyPingContractReady = contract.readOnlyPingContractReady === true;
plan.commandCarrierResolvedByStaticCfg = contract.commandCarrierConfirmed === true;
plan.correlationResolvedByStaticCfg = contract.correlationEchoConfirmed === true;
plan.blockersAfterStaticCfg = contract.readOnlyPingContractReady ? [] :
(contract.cfgDiagnostics || []).slice(0);
plan.adapterImplementationAllowed = contract.readOnlyPingContractReady === true;
plan.adapterInvocationEnabled = false;
plan.readyForExplicitDryRun = false;
plan.writeOperationsLocked = true;
plan.destructiveOperations = false;
}
if (status.writeGate) {
status.writeGate.runtimeDexCfgContract = contract;
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
var command = request && request.command ? String(request.command) : "";
var requestId = request && request.requestId ? String(request.requestId) : "";
var status;
var contract;
var response;
if (command === "runtime.dex_cfg_contract") {
status = oldRefresh();
contract = inspect(status, true);
status = attach(status, contract);
return {
ok: contract.error === null && contract.dexPayloadStatus === "ok",
requestId: requestId,
code: "RUNTIME_DEX_CFG_CONTRACT",
stateBefore: status.coreRunning ? "running" : "stopped",
stateAfter: status.coreRunning ? "running" : "stopped",
message: "Runtime DEX CFG 只读 PING 契约静态识别完成",
data: contract
};
}
response = oldRequest(request);
try {
status = runtime.status();
if (response && response.data && status.runtimeDexCfgContract) {
response.data.runtimeDexCfgContract = status.runtimeDexCfgContract;
}
} catch (ignored) {}
return response;
};
runtime.dexCfgContract = function () {
return runtime.request({
requestId: "sbh-dex-cfg-contract-" + SBH.util.now(),
command: "runtime.dex_cfg_contract"
});
};
SBH.app.start = function () {
var output = oldStart();
var status;
var contract;
try {
status = runtime.status();
contract = status.runtimeDexCfgContract || blank("checking", null);
output.runtimeDexCfgContract = String(contract.state || "checking");
output.runtimeDexCfgContractDetails = contract;
if (status.protocolAdapterPlan) {
output.runtimeProtocolAdapterPlan = String(
status.protocolAdapterPlan.state || "checking"
);
output.runtimeProtocolAdapterPlanDetails = status.protocolAdapterPlan;
}
} catch (error) {
contract = blank("cfg_contract_status_unavailable", SBH.util.errorText(error));
output.runtimeDexCfgContract = contract.state;
output.runtimeDexCfgContractDetails = contract;
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
