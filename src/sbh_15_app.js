/* SingBoxHub Runtime write gate and app coordinator. Rhino ES5 only. */
SBH.versions.runtimeWriteGate = 1;
SBH.versions.app = 6;
(function () {
var P = Packages;
var File = P.java.io.File;
var JavaString = P.java.lang.String;
var Base64 = P.android.util.Base64;
var ShellCommand = P.tornaco.apps.shortx.core.proto.action.ShellCommand;
var IntentFilter = P.android.content.IntentFilter;
var BroadcastReceiver = P.android.content.BroadcastReceiver;
var Context = P.android.content.Context;
var MAX_ENDPOINT_BYTES = 65536;
var gateCache = null;
var gateCacheAt = 0;
function q(v) { return "'" + String(v).replace(/'/g, "'\\''") + "'"; }
function cv(data, key) {
var value = data.get(String(key));
return value === null || value === undefined ? "" : String(value);
}
function shell(command) {
var action = ShellCommand.newBuilder().setCommand(String(command)).setSingleShot(true).setId("JS#SingBoxHubRuntimeWriteGate").build();
var result = shortx.executeAction(action);
if (!result || !result.contextData) { throw new Error("Shell result unavailable"); }
return {out: cv(result.contextData, "shellOut"), err: cv(result.contextData, "shellErr"), code: Number(result.contextData.get("shellCode"))};
}
function endpointCommand(root) {
var lines = [
"TOYBOX=/system/bin/toybox",
"EP=" + q(String(root) + "/runtime/control/control_endpoint.json"),
"if [ -f \"$EP\" ]; then",
"printf 'exists\\t1\\n'",
"printf 'uid\\t%s\\n' \"$($TOYBOX stat -c '%u' \"$EP\" 2>/dev/null)\"",
"printf 'gid\\t%s\\n' \"$($TOYBOX stat -c '%g' \"$EP\" 2>/dev/null)\"",
"printf 'mode\\t%s\\n' \"$($TOYBOX stat -c '%a' \"$EP\" 2>/dev/null)\"",
"printf 'size\\t%s\\n' \"$($TOYBOX stat -c '%s' \"$EP\" 2>/dev/null)\"",
"printf 'mtime\\t%s\\n' \"$($TOYBOX stat -c '%Y' \"$EP\" 2>/dev/null)\"",
"printf 'real\\t%s\\n' \"$($TOYBOX readlink -f \"$EP\" 2>/dev/null)\"",
"printf 'sha\\t%s\\n' \"$($TOYBOX sha256sum \"$EP\" 2>/dev/null | $TOYBOX awk '{print $1}')\"",
"SIZE=\"$($TOYBOX stat -c '%s' \"$EP\" 2>/dev/null)\"",
"if [ -n \"$SIZE\" ] && [ \"$SIZE\" -gt 0 ] && [ \"$SIZE\" -le " + MAX_ENDPOINT_BYTES + " ]; then",
"DATA=\"$($TOYBOX base64 \"$EP\" 2>/dev/null | $TOYBOX tr -d '\\r\\n')\"",
"printf 'data\\t%s\\n' \"$DATA\"",
"fi",
"else printf 'exists\\t0\\n'; fi",
"printf 'now\\t%s\\n' \"$($TOYBOX date +%s 2>/dev/null)\""
];
return "/system/bin/toybox timeout 8 /system/bin/sh -c " + q(lines.join("\n"));
}
function mapOf(text) {
var out = {}, lines = String(text || "").split(/\r?\n/), i, f;
for (i = 0; i < lines.length; i += 1) {
f = lines[i].split("\t");
if (f.length > 1) { out[String(f[0])] = String(f.slice(1).join("\t")); }
}
return out;
}
function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
function arr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
function unique(out, value) {
var text = String(value || ""), i;
if (!text || text.length > 96 || out.length >= 48) { return; }
for (i = 0; i < out.length; i += 1) { if (out[i] === text) { return; } }
out.push(text);
}
function collect(out, value) {
var i, k;
if (typeof value === "string" || typeof value === "number") { unique(out, value); return; }
if (arr(value)) {
for (i = 0; i < value.length; i += 1) {
if (value[i] && typeof value[i] === "object") { unique(out, value[i].command || value[i].name || value[i].id || value[i].method || ""); }
else { unique(out, value[i]); }
}
return;
}
if (value && typeof value === "object") { for (k in value) { if (own(value, k)) { unique(out, k); } } }
}
function profileOf(endpoint) {
var commands = [], sensitive = [], commandKey = /^(commands|controlCommands|allowedCommands|capabilities|methods|operations|actions|supportedCommands)$/i;
var secretKey = /(token|secret|password|credential|authorization|auth(token|secret|key|file|path)|^auth$|private[_-]?key|nonce)/i;
function walk(value, path, depth) {
var k, child, p;
if (!value || typeof value !== "object" || depth > 4) { return; }
for (k in value) {
if (!own(value, k)) { continue; }
child = value[k];
p = path ? path + "." + k : String(k);
if (commandKey.test(String(k))) { collect(commands, child); }
if (secretKey.test(String(k)) && child !== null && child !== undefined && String(child).length && sensitive.length < 32) { sensitive.push(p); }
if (child && typeof child === "object") { walk(child, p, depth + 1); }
}
}
if (!endpoint || typeof endpoint !== "object") { return {parseOk: false, schemaPresent: false, authPresent: false, commands: [], sensitiveFields: []}; }
walk(endpoint, "", 0);
return {
parseOk: true,
schemaPresent: endpoint.schemaVersion !== undefined || endpoint.protocolVersion !== undefined || endpoint.version !== undefined,
schemaVersion: String(endpoint.schemaVersion !== undefined ? endpoint.schemaVersion : (endpoint.protocolVersion !== undefined ? endpoint.protocolVersion : (endpoint.version !== undefined ? endpoint.version : ""))),
authPresent: sensitive.length > 0,
commands: commands,
sensitiveFields: sensitive
};
}
function norm(v) { return String(v || "").toLowerCase().replace(/\s+/g, "").replace(/_/g, "."); }
function has(commands, values) {
var i, j, c;
for (i = 0; i < commands.length; i += 1) {
c = norm(commands[i]);
for (j = 0; j < values.length; j += 1) { if (c === norm(values[j])) { return true; } }
}
return false;
}
function num(map, key, fallback) { var value = Number(map[key]); return isFinite(value) ? value : fallback; }
function failedGate(state, error) {
return {schemaVersion: 1, state: state, endpointExists: false, endpointValidated: false, commands: [], readyForExplicitDryRun: false, rawEndpointExposed: false, writeOperationsLocked: true, dryRunInvoked: false, destructiveOperations: false, error: error || null, checkedAt: SBH.util.now()};
}
function buildGate(runtime, map, profile) {
var exists = String(map.exists || "0") === "1";
var expected = String(runtime.runtimeRoot || "") + "/runtime/control/control_endpoint.json";
var owner = num(map, "uid", -1);
var modeText = String(map.mode || "");
var mode = /^[0-7]{3,4}$/.test(modeText) ? parseInt(modeText, 8) : -1;
var size = num(map, "size", -1);
var commands = profile.commands || [];
var statusCap = has(commands, ["status", "runtime.status", "core.status"]);
var startCap = has(commands, ["start", "runtime.start", "core.start"]);
var stopCap = has(commands, ["stop", "runtime.stop", "core.stop"]);
var dryCap = has(commands, ["dry-run", "dry_run", "preflight", "runtime.preflight", "core.preflight", "core.start.dry-run", "core.start.dry_run"]);
var trustedOwner = owner === 0 || owner === 1000;
var notWorldWritable = mode >= 0 && (mode & 2) === 0;
var pathOk = String(map.real || "") === expected;
var protocol = commands.length > 0;
var valid = exists && profile.parseOk && profile.schemaPresent && profile.authPresent && protocol && trustedOwner && notWorldWritable && size > 0 && size <= MAX_ENDPOINT_BYTES && pathOk;
var writes = startCap && stopCap;
var ready = valid && writes && dryCap;
var state = !runtime.attached ? "runtime_not_attached" : (!exists ? "endpoint_missing" : (!profile.parseOk ? "endpoint_parse_failed" : (!valid ? "endpoint_review_required" : (!writes ? "write_capabilities_not_declared" : (!dryCap ? "dry_run_not_declared" : "ready_for_explicit_dry_run")))));
return {
schemaVersion: 1,
state: state,
endpointExists: exists,
endpointValidated: valid,
canonicalPathMatched: pathOk,
ownerUid: owner,
ownerGid: num(map, "gid", -1),
ownerTrusted: trustedOwner,
mode: modeText,
notWorldWritable: notWorldWritable,
strictPermissions: mode >= 0 && (mode & 18) === 0,
size: size,
sizeAccepted: size > 0 && size <= MAX_ENDPOINT_BYTES,
mtimeEpochSeconds: num(map, "mtime", 0),
ageSeconds: Math.max(0, num(map, "now", 0) - num(map, "mtime", 0)),
sha256Prefix: String(map.sha || "").substring(0, 16),
parseOk: profile.parseOk === true,
schemaPresent: profile.schemaPresent === true,
endpointSchemaVersion: String(profile.schemaVersion || ""),
protocolDeclared: protocol,
commandCount: commands.length,
commands: commands,
statusCapabilityDeclared: statusCap,
startCapabilityDeclared: startCap,
stopCapabilityDeclared: stopCap,
writeCapabilitiesDiscovered: writes,
dryRunCapabilityDiscovered: dryCap,
readyForExplicitDryRun: ready,
sensitiveFieldCount: (profile.sensitiveFields || []).length,
sensitiveFields: profile.sensitiveFields || [],
authPresent: profile.authPresent === true,
rawEndpointExposed: false,
writeOperationsLocked: true,
dryRunInvoked: false,
destructiveOperations: false,
checkedAt: SBH.util.now()
};
}
function inspectGate(runtime, force) {
var now = SBH.util.now(), result, map, endpoint = null, profile;
if (!force && gateCache && now - gateCacheAt < 1500) { return gateCache; }
if (!runtime || !runtime.runtimeRoot) { gateCache = failedGate("runtime_root_unavailable", "Runtime root unavailable"); gateCacheAt = now; return gateCache; }
try {
result = shell(endpointCommand(runtime.runtimeRoot));
map = mapOf(result.out);
if (String(map.exists || "0") === "1" && map.data) { endpoint = JSON.parse(String(new JavaString(Base64.decode(String(map.data), Base64.DEFAULT), "UTF-8"))); }
profile = profileOf(endpoint);
gateCache = buildGate(runtime, map, profile);
gateCache.shellExitCode = result.code;
gateCache.shellError = result.err;
} catch (error) {
gateCache = failedGate("endpoint_inspection_failed", SBH.util.errorText(error));
}
gateCacheAt = now;
return gateCache;
}
function gateMessage(gate) {
if (gate.readyForExplicitDryRun) { return "写操作门禁通过，可进入显式干运行阶段"; }
if (gate.endpointValidated) { return "控制端点已校验，写操作仍锁定"; }
if (gate.endpointExists) { return "控制端点需要复核，写操作保持锁定"; }
return "未发现生产控制端点，写操作保持锁定";
}
function installGate() {
var runtime = SBH.runtime;
var oldStatus = runtime.status;
var oldRefresh = runtime.refresh;
var oldRequest = runtime.request;
function enrich(status, force) {
status = status || {};
status.writeGate = inspectGate(status, force);
status.writeOperationsLocked = true;
status.destructiveOperations = false;
return status;
}
runtime.status = function () { return enrich(oldStatus(), false); };
runtime.refresh = function () { return enrich(oldRefresh(), true); };
runtime.request = function (request) {
var command = request && request.command ? String(request.command) : "";
var requestId = request && request.requestId ? String(request.requestId) : "";
var status, gate, original;
if (command === "runtime.write_gate") {
status = runtime.refresh();
gate = status.writeGate || {};
return {ok: gate.endpointValidated === true, requestId: requestId, code: gate.readyForExplicitDryRun ? "WRITE_GATE_READY" : (gate.endpointValidated ? "WRITE_GATE_ENDPOINT_VALID" : "WRITE_GATE_BLOCKED"), stateBefore: status.coreRunning ? "running" : "stopped", stateAfter: status.coreRunning ? "running" : "stopped", message: gateMessage(gate), data: gate};
}
if (command === "runtime.status" || command === "core.status" || command === "route.status") {
status = runtime.refresh();
return {ok: status.ok === true, requestId: requestId, code: status.ok ? "READ_ONLY_STATUS" : "RUNTIME_STATUS_UNAVAILABLE", stateBefore: status.coreRunning ? "running" : "stopped", stateAfter: status.coreRunning ? "running" : "stopped", message: status.ok ? "只读 Runtime 状态已刷新" : "无法读取 Runtime 状态", data: status};
}
if (command === "runtime.handshake") { original = oldRequest(request); return original; }
status = runtime.refresh();
return {ok: false, requestId: requestId, code: "WRITE_OPERATIONS_LOCKED", stateBefore: status.coreRunning ? "running" : "stopped", stateAfter: status.coreRunning ? "running" : "stopped", message: "写操作门禁尚未解除，未执行任何 Runtime 写命令", data: status.writeGate || status};
};
runtime.writeGate = function () { return runtime.request({requestId: "sbh-write-gate-" + SBH.util.now(), command: "runtime.write_gate"}); };
runtime.writeOperationsLocked = true;
}
installGate();
function runtimeStatus(force) {
try {
if (force && SBH.runtime && typeof SBH.runtime.refresh === "function") { return SBH.runtime.refresh(); }
if (SBH.runtime && typeof SBH.runtime.status === "function") { return SBH.runtime.status(); }
} catch (error) { SBH.log.warn("app", "Runtime status unavailable: " + error); }
return {attached: false, readOnly: true, transport: "unavailable", runtimeState: "unavailable", writeGate: failedGate("runtime_status_unavailable", null), writeOperationsLocked: true, destructiveOperations: false};
}
function gateState(runtime) { return runtime && runtime.writeGate && runtime.writeGate.state ? String(runtime.writeGate.state) : "unavailable"; }
function start() {
var previous = SBH.global.__SBH_APP__;
var endpointFile = new File(SBH.paths.cacheDir, "control_endpoint.json");
var statusFile = new File(SBH.paths.cacheDir, "ui_status.json");
var token = SBH.util.randomToken();
var action = "com.singboxhub.control." + token;
var controller, receiver = null, receiverRegistered = false, stopped = false;
var initialRuntime;
try { if (previous && typeof previous.stop === "function") { previous.stop(); } } catch (ignoredPrevious) {}
try { if (endpointFile.exists()) { endpointFile.delete(); } } catch (ignoredEndpoint) {}
initialRuntime = runtimeStatus(true);
controller = SBH.window.createController();
function writeStatus(command) {
var status = controller.status();
var runtime = runtimeStatus(false);
status.schemaVersion = 3;
status.command = command || "status";
status.updatedAt = SBH.util.now();
status.moduleSetVersion = SBH.bootstrap.moduleSetVersion;
status.runtimeAttached = runtime.attached === true;
status.runtimeReadOnly = runtime.readOnly !== false;
status.runtimeTransport = String(runtime.transport || "unavailable");
status.runtimeState = String(runtime.runtimeState || "unavailable");
status.runtimeWriteGate = gateState(runtime);
status.runtimeWriteGateDetails = runtime.writeGate || null;
status.writeOperationsLocked = true;
status.destructiveOperations = false;
status.receiverRegistered = receiverRegistered;
try { SBH.files.writeJson(statusFile, status); } catch (ignoredWrite) {}
return status;
}
function removeEndpoint() { try { if (endpointFile.exists()) { endpointFile.delete(); } } catch (ignoredDelete) {} }
function stopCoordinator() {
if (stopped) { return true; }
stopped = true;
try { controller.stop(); } catch (ignoredStop) {}
try { if (receiverRegistered && receiver !== null) { SBH.ctx.unregisterReceiver(receiver); } } catch (ignoredReceiver) {}
receiverRegistered = false;
removeEndpoint();
writeStatus("stop_ui");
SBH.log.info("app", "Coordinator stopped");
return true;
}
receiver = new JavaAdapter(BroadcastReceiver, {onReceive: function (contextValue, intent) {
var command, receivedToken;
if (intent === null || stopped) { return; }
receivedToken = String(intent.getStringExtra("token") || "");
if (receivedToken !== token) { SBH.log.warn("app", "Rejected control token"); return; }
command = String(intent.getStringExtra("command") || "status");
if (command === "show") { controller.show(); }
else if (command === "hide") { controller.hide(); }
else if (command === "toggle") { controller.toggle(); }
else if (command === "refresh_runtime") { runtimeStatus(true); if (typeof controller.refreshRuntimeBadge === "function") { controller.refreshRuntimeBadge(false); } }
else if (command === "stop_ui") { stopCoordinator(); return; }
writeStatus(command);
}});
try {
if (SBH.Build.VERSION.SDK_INT >= 33) { SBH.ctx.registerReceiver(receiver, new IntentFilter(action), Context.RECEIVER_NOT_EXPORTED); }
else { SBH.ctx.registerReceiver(receiver, new IntentFilter(action)); }
receiverRegistered = true;
} catch (receiverError) {
receiverRegistered = false;
SBH.log.warn("app", "Control receiver unavailable: " + receiverError);
}
if (receiverRegistered) {
try {
SBH.files.writeJson(endpointFile, {
schemaVersion: 3,
action: action,
token: token,
commands: ["show", "hide", "toggle", "status", "refresh_runtime", "stop_ui"],
moduleSetVersion: SBH.bootstrap.moduleSetVersion,
runtimeAttached: initialRuntime.attached === true,
runtimeReadOnly: initialRuntime.readOnly !== false,
runtimeWriteGate: gateState(initialRuntime),
runtimeWriteGateDetails: initialRuntime.writeGate || null,
writeOperationsLocked: true,
destructiveOperations: false,
createdAt: SBH.util.now()
});
} catch (endpointError) {
receiverRegistered = false;
try { SBH.ctx.unregisterReceiver(receiver); } catch (ignoredUnregister) {}
removeEndpoint();
SBH.log.warn("app", "Control endpoint unavailable: " + endpointError);
}
}
controller.onHidden = function () { writeStatus("hidden"); };
SBH.global.__SBH_APP__ = {controller: controller, receiver: receiver, stop: stopCoordinator, action: receiverRegistered ? action : null, token: receiverRegistered ? token : null, runtime: SBH.runtime};
controller.open();
writeStatus("opening");
SBH.log.ok("app", "Full UI coordinator started");
return {
ok: true,
started: true,
status: "full_ui_opening",
safeMode: false,
coordinatorStarted: true,
receiverRegistered: receiverRegistered,
windowOperationsEnabled: true,
uiVisible: true,
runtimeAttached: initialRuntime.attached === true,
runtimeReadOnly: initialRuntime.readOnly !== false,
runtimeTransport: String(initialRuntime.transport || "unavailable"),
runtimeState: String(initialRuntime.runtimeState || "unavailable"),
runtimeWriteGate: gateState(initialRuntime),
runtimeWriteGateDetails: initialRuntime.writeGate || null,
writeOperationsLocked: true,
destructiveOperations: false,
controlAction: receiverRegistered ? action : null,
controlEndpointPath: receiverRegistered ? endpointFile.getAbsolutePath() : null,
moduleSetVersion: SBH.bootstrap.moduleSetVersion
};
}
SBH.app = {start: start};
}());
