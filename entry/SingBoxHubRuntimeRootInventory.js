/*
 * SingBoxHub production Runtime read-only inventory.
 * ShortX / Rhino ES5.
 *
 * Shell transport:
 * - ShortX ShellCommand + shortx.executeAction()
 *
 * Safety boundary:
 * - fixed find/test/id operations only
 * - no su invocation
 * - no network
 * - no file creation, modification or deletion
 * - no file content reads
 * - no process signals or Runtime controller commands
 * - no TUN, route, firewall, DNS or configuration operations
 */
(function () {
    "use strict";

    var P = Packages;
    var File = P.java.io.File;
    var ShellCommand =
        P.tornaco.apps.shortx.core.proto.action.ShellCommand;
    var System = P.java.lang.System;

    var PROJECT = "SingBoxHub";
    var PROBE = "runtime_shortx_shell_readonly_inventory";
    var PROBE_VERSION = 3;
    var MAX_DEPTH = 5;
    var MAX_ENTRIES = 400;
    var TIMEOUT_SECONDS = 10;

    function now() {
        return Number(System.currentTimeMillis());
    }

    function errorText(error) {
        try {
            if (error && error.javaException) {
                return String(error.javaException.getClass().getName()) +
                    ": " + String(error);
            }
        } catch (ignored) {}
        return String(error);
    }

    function getShortXDir() {
        if (typeof shortx === "undefined" ||
                shortx === null ||
                typeof shortx.getShortXDir !== "function") {
            throw new Error("shortx.getShortXDir() unavailable");
        }
        return new File(String(shortx.getShortXDir()));
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
            .setId("JS#SingBoxHubRuntimeReadonlyInventory")
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

    function buildCommand(runtimeRoot) {
        var rootPath = String(runtimeRoot.getAbsolutePath());
        var inner = [
            "TOYBOX=/system/bin/toybox",
            "ROOT=" + shellQuote(rootPath),
            "UID_VALUE=\"$($TOYBOX id -u 2>/dev/null)\"",
            "printf 'M\\tuid\\t%s\\n' \"$UID_VALUE\"",
            "if [ ! -e \"$ROOT\" ]; then",
            "  printf 'M\\troot\\tmissing\\n'",
            "  exit 0",
            "fi",
            "if [ ! -d \"$ROOT\" ]; then",
            "  printf 'M\\troot\\tnot_directory\\n'",
            "  exit 0",
            "fi",
            "printf 'M\\troot\\tdirectory\\n'",
            "$TOYBOX find \"$ROOT\" -mindepth 1 -maxdepth " +
                MAX_DEPTH + " -print 2>/dev/null |",
            "$TOYBOX head -n " + (MAX_ENTRIES + 1) + " |",
            "while IFS= read -r ITEM; do",
            "  if [ -d \"$ITEM\" ]; then TYPE=d;",
            "  elif [ -f \"$ITEM\" ]; then TYPE=f;",
            "  elif [ -L \"$ITEM\" ]; then TYPE=l;",
            "  else TYPE=o; fi",
            "  printf 'E\\t%s\\t%s\\n' \"$TYPE\" \"$ITEM\"",
            "done"
        ].join("\n");

        return "/system/bin/toybox timeout " + TIMEOUT_SECONDS +
            " /system/bin/sh -c " + shellQuote(inner);
    }

    function relativePath(rootPath, absolutePath) {
        var prefix = rootPath;
        if (absolutePath === rootPath) {
            return ".";
        }
        if (prefix.charAt(prefix.length - 1) !== File.separator) {
            prefix += File.separator;
        }
        if (absolutePath.indexOf(prefix) === 0) {
            return absolutePath.substring(prefix.length);
        }
        return absolutePath;
    }

    function candidate(path) {
        return /(state|status|pid|lock|socket|endpoint|manifest|version|runtime|health|control|daemon|metadata)/i.test(
            String(path)
        );
    }

    function parseOutput(runtimeRoot, shellResult) {
        var rootPath = String(runtimeRoot.getAbsolutePath());
        var lines = String(shellResult.out || "").split(/\r?\n/);
        var entries = [];
        var candidates = [];
        var diagnostics = [];
        var shellUid = null;
        var rootState = "unknown";
        var truncated = false;
        var i;
        var fields;
        var type;
        var absolute;
        var relative;
        var item;

        for (i = 0; i < lines.length; i += 1) {
            if (!lines[i]) {
                continue;
            }
            fields = lines[i].split("\t");
            if (fields[0] === "M" && fields.length >= 3) {
                if (fields[1] === "uid") {
                    shellUid = Number(fields[2]);
                } else if (fields[1] === "root") {
                    rootState = String(fields[2]);
                }
                continue;
            }
            if (fields[0] !== "E" || fields.length < 3) {
                diagnostics.push(lines[i]);
                continue;
            }
            if (entries.length >= MAX_ENTRIES) {
                truncated = true;
                continue;
            }

            type = String(fields[1]);
            absolute = fields.slice(2).join("\t");
            relative = relativePath(rootPath, absolute);
            item = {
                path: relative,
                type: type === "d" ? "directory" :
                    (type === "f" ? "file" :
                        (type === "l" ? "symlink" : "other")),
                candidate: candidate(relative)
            };
            entries.push(item);
            if (item.candidate) {
                candidates.push(item);
            }
        }

        if (shellResult.err) {
            diagnostics.push(String(shellResult.err));
        }

        return {
            shellUid: shellUid,
            rootGranted: shellUid === 0,
            rootState: rootState,
            maxDepth: MAX_DEPTH,
            maxEntries: MAX_ENTRIES,
            entryCount: entries.length,
            candidateCount: candidates.length,
            truncated: truncated,
            entries: entries,
            candidates: candidates,
            diagnostics: diagnostics,
            shellExitCode: shellResult.code
        };
    }

    function run() {
        var startedAt = now();
        var shortxDir = getShortXDir();
        var runtimeRoot = new File(shortxDir, "SingBoxHub");
        var command = buildCommand(runtimeRoot);
        var shellResult = executeShell(command);
        var inventory = parseOutput(runtimeRoot, shellResult);

        return {
            ok: shellResult.code === 0 && inventory.rootGranted,
            project: PROJECT,
            probe: PROBE,
            probeVersion: PROBE_VERSION,
            readOnly: true,
            shellExecuted: true,
            shellTransport: "ShortX ShellCommand / shortx.executeAction",
            shellPurpose: "fixed_find_test_and_id_only",
            shellUid: inventory.shellUid,
            rootGranted: inventory.rootGranted,
            suInvoked: false,
            networkAccessed: false,
            filesModified: false,
            fileContentsRead: false,
            runtimeControllerInvoked: false,
            runtimeOperationsExecuted: false,
            shortxDir: String(shortxDir.getAbsolutePath()),
            runtimeRoot: String(runtimeRoot.getAbsolutePath()),
            inventory: inventory,
            durationMs: now() - startedAt,
            timestamp: now()
        };
    }

    try {
        return JSON.stringify(run());
    } catch (fatal) {
        return JSON.stringify({
            ok: false,
            project: PROJECT,
            probe: PROBE,
            probeVersion: PROBE_VERSION,
            readOnly: true,
            shellExecuted: false,
            shellTransport: "ShortX ShellCommand / shortx.executeAction",
            suInvoked: false,
            networkAccessed: false,
            filesModified: false,
            fileContentsRead: false,
            runtimeControllerInvoked: false,
            runtimeOperationsExecuted: false,
            error: errorText(fatal),
            timestamp: now()
        });
    }
}());
