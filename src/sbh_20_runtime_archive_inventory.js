/* SingBoxHub Runtime archive container inventory. Rhino ES5 only. */
SBH.versions.runtimeArchiveInventory = 3;
(function () {
var P = Packages;
var File = P.java.io.File;
var ByteArrayInputStream = P.java.io.ByteArrayInputStream;
var ByteArrayOutputStream = P.java.io.ByteArrayOutputStream;
var ZipInputStream = P.java.util.zip.ZipInputStream;
var ReflectArray = P.java.lang.reflect.Array;
var JavaByte = P.java.lang.Byte;
var JavaString = P.java.lang.String;
var MessageDigest = P.java.security.MessageDigest;
var Base64 = P.android.util.Base64;
var ShellCommand = P.tornaco.apps.shortx.core.proto.action.ShellCommand;
var CACHE_SCHEMA = 3;
var MAX_ENTRIES = 128;
var MAX_MANIFEST_BYTES = 8192;
var MAX_TRANSFER_BYTES = 65536;
var BUFFER_SIZE = 8192;
var cacheFile = new File(SBH.paths.cacheDir, "runtime_archive_inventory.json");
var cachedInventory = SBH.files.readJson(cacheFile, null);
var cachedInputKey = "";

function pendingInventory(state, error) {
return {
schemaVersion: CACHE_SCHEMA,
state: state || "checking",
checking: !state || state === "checking",
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
fileMagicHex: "",
containerKind: "unknown",
readTransport: "shortx_root_shell_base64_memory",
archivePayloadStatus: "not_requested",
archiveBytesTransferred: 0,
archiveTransferLimitBytes: MAX_TRANSFER_BYTES,
archiveListingAvailable: false,
archiveListingTool: "",
archiveEntryCount: 0,
archiveStoredEntryCount: 0,
archiveListingTruncated: false,
archiveUnsafeEntryNameCount: 0,
archiveEntries: [],
entryTypeCounts: {
dex: 0,
classFile: 0,
jar: 0,
zip: 0,
javaSource: 0,
kotlinSource: 0,
shellScript: 0,
json: 0,
properties: 0,
manifest: 0,
nativeLibrary: 0,
directory: 0,
other: 0
},
nestedArchiveCandidates: [],
executableContentCandidates: [],
manifestPresent: false,
manifestEntryName: "",
manifestBytesRead: 0,
manifestTruncated: false,
manifestKeys: [],
manifestSafeFields: [],
targetClassesExpectedExternal: false,
classLoadingPerformed: false,
classInstantiationPerformed: false,
socketConnectionAttempted: false,
methodInvocationPerformed: false,
archiveEntriesExtracted: false,
archiveEntriesExecuted: false,
temporaryFilesCreated: false,
runtimeFilesModified: false,
authenticationValueUsed: false,
authenticationValueExposed: false,
rawEndpointExposed: false,
inventoryOnly: true,
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

function closeQuietly(value) {
try {
if (value !== null && value !== undefined) {
value.close();
}
} catch (ignored) {}
}

function shellQuote(value) {
return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

function contextValue(data, key) {
var value = data.get(String(key));
return value === null || value === undefined ? "" : String(value);
}

function executeShell(command) {
var action = ShellCommand.newBuilder()
.setCommand(String(command))
.setSingleShot(true)
.setId("JS#SingBoxHubRuntimeArchiveInventoryV3")
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
map[String(fields[0])] = String(fields.slice(1).join("\t"));
}
}
return map;
}

function jsonStringField(text, key) {
var escapedKey = String(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
var pattern = new RegExp("\\\"" + escapedKey + "\\\"\\s*:\\s*\\\"((?:\\\\.|[^\\\"\\\\])*)\\\"");
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
text = String(new JavaString(Base64.decode(String(probe.data), Base64.DEFAULT), "UTF-8"));
} catch (ignoredDecode) {
return null;
}
return {
runtimeJar: jsonStringField(text, "runtimeJar"),
clientClass: jsonStringField(text, "clientClass"),
serverClass: jsonStringField(text, "serverClass"),
socketName: jsonStringField(text, "socketName"),
endpointSize: String(probe.size || ""),
endpointMtime: String(probe.mtime || ""),
endpointSha: String(probe.sha || "")
};
}

function validAbsoluteJar(value) {
var text = String(value || "");
return /^\/[A-Za-z0-9_.$+@%:,=~\/-]{1,510}\.jar$/i.test(text) &&
text.indexOf("/../") < 0 && text.indexOf("//") < 0;
}

function validClassName(value) {
return /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)+$/.test(String(value || ""));
}

function validSocketName(value) {
var text = String(value || "");
return text.length > 0 && text.length <= 160 && !/[\r\n\t]/.test(text);
}

function fallbackEvidence(status) {
var inspection = status ? status.runtimeJarStaticInspection : null;
if (!inspection) {
return null;
}
return {
runtimeJar: String(inspection.runtimeJarPath || ""),
clientClass: String(inspection.clientClassName || ""),
serverClass: String(inspection.serverClassName || ""),
socketName: inspection.socketNameDeclared === true ? "declared_socket_name" : "",
endpointSize: "",
endpointMtime: String(inspection.runtimeJarMtimeEpochSeconds || ""),
endpointSha: String(inspection.runtimeJarSha256Prefix || "")
};
}

function evidenceFor(status) {
return endpointEvidence() || fallbackEvidence(status);
}

function inputKey(evidence) {
if (!evidence) {
return "";
}
return [
String(evidence.runtimeJar || ""),
String(evidence.clientClass || ""),
String(evidence.serverClass || ""),
String(evidence.endpointSize || ""),
String(evidence.endpointMtime || ""),
String(evidence.endpointSha || "")
].join("|");
}

function buildCommand(runtimeRoot, evidence) {
var jar = String(evidence.runtimeJar);
var expectedPrefix = String(runtimeRoot || "") + "/";
var lines = [
"TOYBOX=/system/bin/toybox",
"JAR=" + shellQuote(jar),
"EXPECTED_PREFIX=" + shellQuote(expectedPrefix),
"MAX_BYTES=" + MAX_TRANSFER_BYTES,
"if [ ! -f \"$JAR\" ]; then",
"  printf 'jarExists\\t0\\n'",
"  printf 'payloadStatus\\tmissing\\n'",
"  exit 0",
"fi",
"printf 'jarExists\\t1\\n'",
"REAL=\"$($TOYBOX readlink -f \"$JAR\" 2>/dev/null)\"",
"printf 'jarReal\\t%s\\n' \"$REAL\"",
"case \"$REAL\" in \"$EXPECTED_PREFIX\"*) printf 'jarPathMatched\\t1\\n' ;; *) printf 'jarPathMatched\\t0\\n' ;; esac",
"SIZE=\"$($TOYBOX stat -c '%s' \"$JAR\" 2>/dev/null)\"",
"printf 'jarSize\\t%s\\n' \"$SIZE\"",
"printf 'jarMtime\\t%s\\n' \"$($TOYBOX stat -c '%Y' \"$JAR\" 2>/dev/null)\"",
"printf 'jarMode\\t%s\\n' \"$($TOYBOX stat -c '%a' \"$JAR\" 2>/dev/null)\"",
"printf 'jarUid\\t%s\\n' \"$($TOYBOX stat -c '%u' \"$JAR\" 2>/dev/null)\"",
"printf 'jarGid\\t%s\\n' \"$($TOYBOX stat -c '%g' \"$JAR\" 2>/dev/null)\"",
"case \"$SIZE\" in ''|*[!0-9]*) printf 'payloadStatus\\tinvalid_size\\n'; exit 0 ;; esac",
"if [ \"$SIZE\" -gt \"$MAX_BYTES\" ]; then",
"  printf 'payloadStatus\\ttoo_large\\n'",
"  exit 0",
"fi",
"DATA=\"$($TOYBOX base64 \"$JAR\" 2>/dev/null | $TOYBOX tr -d '\\r\\n')\"",
"if [ -z \"$DATA\" ] && [ \"$SIZE\" -gt 0 ]; then",
"  printf 'payloadStatus\\tread_failed\\n'",
"  exit 0",
"fi",
"printf 'payloadStatus\\tok\\n'",
"printf 'archiveData\\t%s\\n' \"$DATA\""
];
return "/system/bin/toybox timeout 12 /system/bin/sh -c " + shellQuote(lines.join("\n"));
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

function safeEntryName(value) {
var text = String(value || "").replace(/^\s+|\s+$/g, "");
var parts;
var i;
if (!text || text.length > 240 || /^[\\/]/.test(text) || /[\r\n\t\0]/.test(text)) {
return "";
}
parts = text.split(/[\\/]/);
for (i = 0; i < parts.length; i += 1) {
if (parts[i] === "..") {
return "";
}
}
return text;
}

function entryType(name, directory) {
var lower = String(name || "").toLowerCase();
if (directory || /\/$/.test(lower)) {
return "directory";
}
if (/(^|\/)meta-inf\/manifest\.mf$/.test(lower)) {
return "manifest";
}
if (/\.dex$/.test(lower)) {
return "dex";
}
if (/\.class$/.test(lower)) {
return "classFile";
}
if (/\.jar$/.test(lower)) {
return "jar";
}
if (/\.zip$/.test(lower)) {
return "zip";
}
if (/\.java$/.test(lower)) {
return "javaSource";
}
if (/\.(kt|kts)$/.test(lower)) {
return "kotlinSource";
}
if (/\.(sh|bash)$/.test(lower)) {
return "shellScript";
}
if (/\.json$/.test(lower)) {
return "json";
}
if (/\.(properties|prop|conf|cfg|ini)$/.test(lower)) {
return "properties";
}
if (/\.so$/.test(lower)) {
return "nativeLibrary";
}
return "other";
}

function addEntry(inventory, entry) {
var raw = String(entry.getName() || "");
var name = safeEntryName(raw);
var type;
inventory.archiveEntryCount += 1;
if (!name) {
inventory.archiveUnsafeEntryNameCount += 1;
return;
}
type = entryType(name, Boolean(entry.isDirectory()));
inventory.entryTypeCounts[type] = Number(inventory.entryTypeCounts[type] || 0) + 1;
if (type === "jar" || type === "zip" || type === "dex") {
unique(inventory.nestedArchiveCandidates, name, 32);
}
if (type === "shellScript" || type === "nativeLibrary") {
unique(inventory.executableContentCandidates, name, 32);
}
if (type === "manifest" && !inventory.manifestEntryName) {
inventory.manifestEntryName = name;
}
if (inventory.archiveEntries.length < MAX_ENTRIES) {
inventory.archiveEntries.push({
name: name,
type: type,
directory: Boolean(entry.isDirectory()),
uncompressedSize: Number(entry.getSize()),
compressedSize: Number(entry.getCompressedSize())
});
}
}

function readCurrentEntryText(stream, limit) {
var output = new ByteArrayOutputStream();
var buffer = ReflectArray.newInstance(JavaByte.TYPE, BUFFER_SIZE);
var left = Number(limit);
var read;
var written = 0;
var truncated = false;
try {
while (left > 0 && (read = Number(stream.read(buffer, 0, Math.min(BUFFER_SIZE, left)))) >= 0) {
if (read > 0) {
output.write(buffer, 0, read);
written += read;
left -= read;
}
}
if (left === 0 && Number(stream.read()) >= 0) {
truncated = true;
}
return {
text: String(new JavaString(output.toByteArray(), "UTF-8")),
bytes: written,
truncated: truncated
};
} finally {
closeQuietly(output);
}
}

function parseManifest(text, inventory) {
var allowed = {
"Manifest-Version": true,
"Main-Class": true,
"Created-By": true,
"Implementation-Title": true,
"Implementation-Version": true,
"Specification-Title": true,
"Specification-Version": true,
"Automatic-Module-Name": true
};
var lines = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
var records = [];
var current = "";
var i;
var index;
var key;
var value;
for (i = 0; i < lines.length; i += 1) {
if (/^ /.test(lines[i]) && current) {
current += lines[i].substring(1);
} else {
if (current) {
records.push(current);
}
current = String(lines[i] || "");
}
}
if (current) {
records.push(current);
}
for (i = 0; i < records.length; i += 1) {
index = records[i].indexOf(":");
if (index <= 0) {
continue;
}
key = records[i].substring(0, index).replace(/^\s+|\s+$/g, "");
value = records[i].substring(index + 1).replace(/^\s+|\s+$/g, "");
if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(key)) {
continue;
}
unique(inventory.manifestKeys, key, 64);
if (allowed[key] === true && value.length <= 160 && !/[\r\n\t\0]/.test(value)) {
inventory.manifestSafeFields.push({key: key, value: value});
}
}
}

function bytesHex(bytes, limit) {
var output = [];
var i;
var value;
var text;
var count = Math.min(Number(bytes.length), Number(limit || bytes.length));
for (i = 0; i < count; i += 1) {
value = Number(bytes[i]) & 255;
text = value.toString(16);
output.push(text.length < 2 ? "0" + text : text);
}
return output.join("");
}

function sha256Prefix(bytes) {
var digest = MessageDigest.getInstance("SHA-256");
digest.update(bytes);
return bytesHex(digest.digest(), 8);
}

function containerKind(magic) {
var value = String(magic || "").toLowerCase();
if (value.indexOf("504b0304") === 0 || value.indexOf("504b0506") === 0 || value.indexOf("504b0708") === 0) {
return "zip_archive";
}
if (value.indexOf("6465780a") === 0) {
return "raw_dex";
}
if (value.indexOf("cafebabe") === 0) {
return "java_class";
}
if (value.indexOf("7f454c46") === 0) {
return "elf_binary";
}
if (value.indexOf("2321") === 0) {
return "script";
}
return value ? "unknown_binary" : "unknown";
}

function countTypes(counts) {
var key;
var total = 0;
for (key in counts) {
if (Object.prototype.hasOwnProperty.call(counts, key)) {
total += Number(counts[key] || 0);
}
}
return total;
}

function classify(inventory) {
var counts = inventory.entryTypeCounts;
if (!inventory.runtimeJarExists) {
return "runtime_jar_missing";
}
if (!inventory.runtimeJarCanonicalPathMatched) {
return "runtime_jar_path_mismatch";
}
if (inventory.archivePayloadStatus === "too_large") {
return "archive_transfer_limit_exceeded";
}
if (inventory.archivePayloadStatus !== "ok") {
return "archive_payload_unavailable";
}
if (inventory.containerKind !== "zip_archive") {
return "non_zip_container_identified";
}
if (!inventory.archiveListingAvailable) {
return "zip_directory_unreadable";
}
if (inventory.archiveEntryCount === 0) {
return "empty_zip_archive";
}
if (counts.dex > 0 || counts.classFile > 0) {
return "class_container_detected";
}
if (inventory.nestedArchiveCandidates.length > 0) {
return "nested_runtime_archive_detected";
}
if (counts.javaSource > 0 || counts.kotlinSource > 0) {
return "source_archive_detected";
}
if (counts.shellScript > 0 || counts.nativeLibrary > 0) {
return "executable_payload_archive_detected";
}
if (inventory.manifestPresent && countTypes(counts) === inventory.archiveEntryCount &&
counts.json + counts.properties + counts.other + counts.directory + counts.manifest === inventory.archiveEntryCount) {
return "metadata_only_archive";
}
return "non_dex_archive_identified";
}

function inspectZipBytes(bytes, inventory) {
var input = null;
var zip = null;
var entry;
var manifestData;
try {
input = new ByteArrayInputStream(bytes);
zip = new ZipInputStream(input);
while ((entry = zip.getNextEntry()) !== null) {
addEntry(inventory, entry);
if (entryType(String(entry.getName() || ""), Boolean(entry.isDirectory())) === "manifest") {
manifestData = readCurrentEntryText(zip, MAX_MANIFEST_BYTES);
inventory.manifestBytesRead = Number(manifestData.bytes || 0);
inventory.manifestTruncated = manifestData.truncated === true;
parseManifest(manifestData.text, inventory);
}
try {
zip.closeEntry();
} catch (ignoredCloseEntry) {}
}
inventory.archiveListingAvailable = true;
inventory.archiveListingTool = "java.util.zip.ZipInputStream(root_shell_bytes)";
inventory.archiveStoredEntryCount = inventory.archiveEntries.length;
inventory.archiveListingTruncated = inventory.archiveEntryCount > MAX_ENTRIES;
inventory.manifestPresent = inventory.entryTypeCounts.manifest > 0;
} finally {
closeQuietly(zip);
closeQuietly(input);
}
}

function applyProtocolCorrection(status, evidence, inventory) {
var discovery = status ? status.protocolDiscovery : null;
var plan = status ? status.protocolAdapterPlan : null;
var validEvidence = evidence && validAbsoluteJar(evidence.runtimeJar) &&
validClassName(evidence.clientClass) && validClassName(evidence.serverClass) && validSocketName(evidence.socketName);
var original;
if (!validEvidence) {
return status;
}
if (discovery && discovery.parseOk === true) {
original = String(discovery.transportKind || "unknown");
discovery.transportKind = "unix_socket";
discovery.transportScore = 14;
discovery.transportAmbiguous = false;
discovery.adapterState = "transport_identified";
discovery.transportCandidates = [{kind: "unix_socket", score: 14}, {kind: "shell_cli", score: 0}];
discovery.transportCorrection = {
applied: original !== "unix_socket",
originalTransport: original,
correctedTransport: "unix_socket",
reason: "JAVA_RUNTIME_SOCKET_BOOTSTRAP_FIELDS"
};
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
plan.runtimeArchiveInventoryState = inventory ? String(inventory.state || "checking") : "checking";
plan.adapterInvocationEnabled = false;
plan.writeOperationsLocked = true;
plan.destructiveOperations = false;
}
if (status && status.writeGate) {
status.writeGate.protocolTransport = "unix_socket";
status.writeGate.runtimeArchiveInventory = inventory;
}
return status;
}

function persist(inventory) {
if (!inventory || inventory.checking === true) {
return;
}
cachedInventory = inventory;
cachedInputKey = String(inventory.inputKey || "");
try {
SBH.files.writeJson(cacheFile, inventory);
} catch (error) {
SBH.log.warn("archive.inventory.cache", SBH.util.errorText(error));
}
}

function inspectBlocking(status, force) {
var evidence = evidenceFor(status);
var key = inputKey(evidence);
var runtimeRoot = status ? String(status.runtimeRoot || "") : "";
var shell;
var map;
var bytes;
var inventory;
if (!evidence) {
return pendingInventory(status && status.checking === true ? "checking" : "endpoint_evidence_unavailable", null);
}
if (!validAbsoluteJar(evidence.runtimeJar)) {
inventory = pendingInventory("runtime_jar_path_invalid", "runtimeJar is not a validated absolute JAR path");
inventory.runtimeJarDeclared = !!evidence.runtimeJar;
inventory.runtimeJarPath = String(evidence.runtimeJar || "");
persist(inventory);
return inventory;
}
if (!force && cachedInventory && cachedInventory.stale !== true && cachedInputKey === key) {
return cachedInventory;
}
inventory = pendingInventory("archive_payload_unavailable", null);
inventory.checking = false;
inventory.runtimeJarDeclared = true;
inventory.inputKey = key;
try {
shell = executeShell(buildCommand(runtimeRoot, evidence));
map = parseMap(shell.out);
inventory.shellExitCode = shell.code;
inventory.shellError = String(shell.err || "");
inventory.runtimeJarPath = String(map.jarReal || evidence.runtimeJar);
inventory.runtimeJarExists = boolValue(map.jarExists);
inventory.runtimeJarCanonicalPathMatched = boolValue(map.jarPathMatched);
inventory.runtimeJarSize = numberValue(map.jarSize, -1);
inventory.runtimeJarMtimeEpochSeconds = numberValue(map.jarMtime, 0);
inventory.runtimeJarMode = String(map.jarMode || "");
inventory.runtimeJarOwnerUid = numberValue(map.jarUid, -1);
inventory.runtimeJarOwnerGid = numberValue(map.jarGid, -1);
inventory.archivePayloadStatus = String(map.payloadStatus || "unknown");
if (inventory.archivePayloadStatus === "ok") {
bytes = Base64.decode(String(map.archiveData || ""), Base64.DEFAULT);
inventory.archiveBytesTransferred = Number(bytes.length);
if (inventory.runtimeJarSize >= 0 && inventory.archiveBytesTransferred !== inventory.runtimeJarSize) {
throw new Error("Runtime archive byte count mismatch: expected " + inventory.runtimeJarSize + ", got " + inventory.archiveBytesTransferred);
}
inventory.fileMagicHex = bytesHex(bytes, 16);
inventory.runtimeJarSha256Prefix = sha256Prefix(bytes);
inventory.containerKind = containerKind(inventory.fileMagicHex);
if (inventory.containerKind === "zip_archive") {
inspectZipBytes(bytes, inventory);
}
}
inventory.targetClassesExpectedExternal = inventory.entryTypeCounts.dex === 0 &&
inventory.entryTypeCounts.classFile === 0 && validClassName(evidence.clientClass) && validClassName(evidence.serverClass);
inventory.state = classify(inventory);
inventory.stale = false;
inventory.checkedAt = SBH.util.now();
persist(inventory);
return inventory;
} catch (error) {
inventory.state = "archive_inventory_failed";
inventory.error = SBH.util.errorText(error);
inventory.stale = false;
inventory.checkedAt = SBH.util.now();
persist(inventory);
return inventory;
}
}

function attach(status, inventory) {
var evidence;
status = status || {};
inventory = inventory || cachedInventory || pendingInventory("checking", null);
status.runtimeArchiveInventory = inventory;
evidence = evidenceFor(status);
return applyProtocolCorrection(status, evidence, inventory);
}

function install() {
var runtime = SBH.runtime;
var oldStatus = runtime.status;
var oldRefresh = runtime.refresh;
var oldRequest = runtime.request;
var oldAppStart = SBH.app.start;
runtime.status = function () {
return attach(oldStatus(), cachedInventory);
};
runtime.refresh = function () {
var status = oldRefresh();
var inventory = inspectBlocking(status, false);
return attach(status, inventory);
};
runtime.request = function (requestValue) {
var command = requestValue && requestValue.command ? String(requestValue.command) : "";
var requestId = requestValue && requestValue.requestId ? String(requestValue.requestId) : "";
var status;
var inventory;
var result;
if (command === "runtime.archive_inventory") {
status = oldRefresh();
inventory = inspectBlocking(status, true);
status = attach(status, inventory);
return {
ok: inventory.runtimeJarExists === true && inventory.error === null,
requestId: requestId,
code: "RUNTIME_ARCHIVE_INVENTORY",
stateBefore: status.coreRunning ? "running" : "stopped",
stateAfter: status.coreRunning ? "running" : "stopped",
message: "Runtime 归档封装只读识别完成",
data: inventory
};
}
result = oldRequest(requestValue);
try {
status = runtime.status();
if (result && result.data && status.runtimeArchiveInventory) {
result.data.runtimeArchiveInventory = status.runtimeArchiveInventory;
}
} catch (ignoredResult) {}
return result;
};
runtime.archiveInventory = function () {
return runtime.request({
requestId: "sbh-archive-inventory-" + SBH.util.now(),
command: "runtime.archive_inventory"
});
};
SBH.app.start = function () {
var result = oldAppStart();
var status;
var inventory;
try {
status = runtime.status();
inventory = status.runtimeArchiveInventory || pendingInventory("checking", null);
result.runtimeArchiveInventory = String(inventory.state || "checking");
result.runtimeArchiveInventoryDetails = inventory;
if (status.protocolDiscovery) {
result.runtimeProtocolDiscovery = String(status.protocolDiscovery.state || "checking");
result.runtimeProtocolDiscoveryDetails = status.protocolDiscovery;
}
if (status.protocolAdapterPlan) {
result.runtimeProtocolAdapterPlan = String(status.protocolAdapterPlan.state || "checking");
result.runtimeProtocolAdapterPlanDetails = status.protocolAdapterPlan;
}
} catch (error) {
inventory = pendingInventory("archive_inventory_status_unavailable", SBH.util.errorText(error));
result.runtimeArchiveInventory = inventory.state;
result.runtimeArchiveInventoryDetails = inventory;
}
result.writeOperationsLocked = true;
result.destructiveOperations = false;
return result;
};
}

if (!cachedInventory || Number(cachedInventory.schemaVersion) !== CACHE_SCHEMA) {
cachedInventory = null;
} else {
cachedInputKey = String(cachedInventory.inputKey || "");
cachedInventory.stale = true;
cachedInventory.source = "persisted_cache";
}
install();
}());
