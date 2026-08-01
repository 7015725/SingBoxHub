/*
 * SingBoxHub production Runtime root-assisted read-only inventory v2.
 * ShortX / Rhino ES5.
 *
 * Safety boundary:
 * - resolves the actual su executable through /system/bin/sh
 * - uses su --mount-master only for fixed find/test operations
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
    var ProcessBuilder = P.java.lang.ProcessBuilder;
    var ArrayList = P.java.util.ArrayList;
    var BAOS = P.java.io.ByteArrayOutputStream;
    var ReflectArray = P.java.lang.reflect.Array;
    var JavaByte = P.java.lang.Byte;
    var JavaString = P.java.lang.String;
    var System = P.java.lang.System;

    var PROJECT = "SingBoxHub";
    var PROBE = "runtime_root_readonly_inventory";
    var PROBE_VERSION = 2;
    var MAX_DEPTH = 5;
    var MAX_ENTRIES = 400;
    var TIMEOUT_SECONDS = 15;

    function now() {
        return Number(System.currentTimeMillis());
    }

    function closeQuietly(value) {
        try {
            if (value !== null && value !== undefined) {
                value.close();
            }
        } catch (ignored) {}
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

    function readAll(stream) {
        var output = new BAOS();
        var buffer = ReflectArray.newInstance(JavaByte.TYPE, 8192);
        var count;
        try {
            while ((count = stream.read(buffer)) >= 0) {
                if (count > 0) {
                    output.write(buffer, 0, count);
                }
            }
            return String(new JavaString(output.toByteArray(), "UTF-8"));
        } finally {
            closeQuietly(stream);
            closeQuietly(output);
        }
    }

    function runRootCommand(runtimeRoot) {
        var rootPath = String(runtimeRoot.getAbsolutePath());
        var inner = [
            "TOYBOX=/system/bin/toybox",
            "ROOT=" + shellQuote(rootPath),
            "UID_VALUE=\"$($TOYBOX id -u 2>/dev/null)\"",
            "printf 'M\\tuid\\t%s\\n' \"$UID_VALUE\"",
            "if [ ! -e \"$ROOT\" ]; then printf 'M\\troot\\tmissing\\n'; exit 0; fi",
            "if [ ! -d \"$ROOT\" ]; then printf 'M\\troot\\tnot_directory\\n'; exit 0; fi",
            "printf 'M\\troot\\tdirectory\\n'",
            "$TOYBOX find \"$ROOT\" -mindepth 1 -maxdepth " + MAX_DEPTH + " -print 2>/dev/null |",
            "$TOYBOX head -n " + (MAX_ENTRIES + 1) + " |",
            "while IFS= read -r ITEM; do",
            "  if [ -d \"$ITEM\" ]; then TYPE=d;",
            "  elif [ -f \"$ITEM\" ]; then TYPE=f;",
            "  elif [ -L \"$ITEM\" ]; then TYPE=l;",
            "  else TYPE=o; fi",
            "  printf 'E\\t%s\\t%s\\n' \"$TYPE\" \"$ITEM\"",
            "done"
        ].join("\n");
        var outer = [
            "PATH_VALUE=\"${PATH:-}\"",
            "SU_BIN=\"$(command -v su 2>/dev/null || true)\"",
            "if [ -z \"$SU_BIN\" ]; then",
            "  for CANDIDATE in /system/bin/su /system/xbin/su /sbin/su /debug_ramdisk/su /data/adb/ksu/bin/su; do",
            "    if [ -x \"$CANDIDATE\" ]; then SU_BIN=\"$CANDIDATE\"; break; fi",
            "  done",
            "fi",
            "printf 'M\\tsuPath\\t%s\\n' \"$SU_BIN\"",
            "printf 'M\\tpathEnv\\t%s\\n' \"$PATH_VALUE\"",
            "if [ -z \"$SU_BIN\" ]; then exit 127; fi",
            "exec /system/bin/toybox timeout " + TIMEOUT_SECONDS +
                " \"$SU_BIN\" --mount-master -c " + shellQuote(inner)
        ].join("\n");
        var args = new ArrayList();
        var process;
        var output;
        var exitCode;

        args.add("/system/bin/sh");
        args.add("-c");
        args.add(outer);

        process = new ProcessBuilder(args)
            .redirectErrorStream(true)
            .start();
        output = readAll(process.getInputStream());
        exitCode = Number(process.waitFor());

        return {
            exitCode: exitCode,
            output: output
        };
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
        return /(state|status|pid|lock|socket|endpoint|manifest|version|runtime|health|control|daemon|metadata)/i.test(String(path));
    }

    function parseOutput(runtimeRoot, commandResult) {
        var rootPath = String(runtimeRoot.getAbsolutePath());
        var lines = String(commandResult.output || "").split(/\r?\n/);
        var entries = [];
        var candidates = [];
        var diagnostics = [];
        var rootUid = null;
        var rootState = "unknown";
        var suPath = "";
        var pathEnv = "";
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
                    rootUid = Number(fields[2]);
                } else if (fields[1] === "root") {
                    rootState = String(fields[2]);
                } else if (fields[1] === "suPath") {
                    suPath = String(fields.slice(2).join("\t"));
                } else if (fields[1] === "pathEnv") {
                    pathEnv = String(fields.slice(2).join("\t"));
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

        return {
            suPath: suPath,
            suResolved: suPath.length > 0,
            pathEnv: pathEnv,
            rootUid: rootUid,
            rootGranted: rootUid === 0,
            rootState: rootState,
            maxDepth: MAX_DEPTH,
            maxEntries: MAX_ENTRIES,
            entryCount: entries.length,
            candidateCount: candidates.length,
            truncated: truncated,
            entries: entries,
            candidates: candidates,
            diagnostics: diagnostics,
            commandExitCode: commandResult.exitCode
        };
    }

    function run() {
        var startedAt = now();
        var shortxDir = getShortXDir();
        var runtimeRoot = new File(shortxDir, "SingBoxHub");
        var commandResult = runRootCommand(runtimeRoot);
        var inventory = parseOutput(runtimeRoot, commandResult);

        return {
            ok: commandResult.exitCode === 0 && inventory.rootGranted,
            project: PROJECT,
            probe: PROBE,
            probeVersion: PROBE_VERSION,
            readOnly: true,
            rootRequested: true,
            rootGranted: inventory.rootGranted,
            suResolved: inventory.suResolved,
            suPath: inventory.suPath,
            shellExecuted: true,
            shellPurpose: "resolve_su_then_fixed_find_and_test_only",
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
            rootRequested: true,
            shellExecuted: true,
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
