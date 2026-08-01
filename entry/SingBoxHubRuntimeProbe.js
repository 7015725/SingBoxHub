/*
 * SingBoxHub production Runtime read-only directory probe.
 * ShortX / Rhino ES5.
 *
 * Safety boundary:
 * - no Shell
 * - no network
 * - no file creation, modification or deletion
 * - no configuration, subscription or credential content reads
 * - no process, TUN, route, firewall or DNS operations
 */
(function () {
    "use strict";

    var P = Packages;
    var File = P.java.io.File;
    var System = P.java.lang.System;
    var PROJECT = "SingBoxHub";
    var PROBE = "runtime_readonly_tree_probe";
    var PROBE_VERSION = 1;
    var MAX_DEPTH = 5;
    var MAX_ENTRIES = 400;

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

    function canonicalPath(file) {
        try {
            return String(file.getCanonicalPath());
        } catch (ignored) {
            return String(file.getAbsolutePath());
        }
    }

    function isInside(rootCanonical, childCanonical) {
        var prefix = rootCanonical;
        if (childCanonical === rootCanonical) {
            return true;
        }
        if (prefix.charAt(prefix.length - 1) !== File.separator) {
            prefix += File.separator;
        }
        return childCanonical.indexOf(prefix) === 0;
    }

    function relativePath(rootCanonical, childCanonical) {
        var prefix;
        if (childCanonical === rootCanonical) {
            return ".";
        }
        prefix = rootCanonical;
        if (prefix.charAt(prefix.length - 1) !== File.separator) {
            prefix += File.separator;
        }
        if (childCanonical.indexOf(prefix) === 0) {
            return childCanonical.substring(prefix.length);
        }
        return childCanonical;
    }

    function isCandidateName(name) {
        return /(state|status|pid|lock|socket|endpoint|manifest|version|runtime|health|control|daemon)/i.test(String(name));
    }

    function sortFiles(files) {
        var list = [];
        var i;
        for (i = 0; i < files.length; i += 1) {
            list.push(files[i]);
        }
        list.sort(function (a, b) {
            var left = String(a.getName()).toLowerCase();
            var right = String(b.getName()).toLowerCase();
            if (left < right) {
                return -1;
            }
            if (left > right) {
                return 1;
            }
            return 0;
        });
        return list;
    }

    function describe(file, rootCanonical, depth) {
        var absolute = String(file.getAbsolutePath());
        var canonical = canonicalPath(file);
        var inside = isInside(rootCanonical, canonical);
        var exists = false;
        var directory = false;
        var regularFile = false;
        var bytes = 0;
        var modifiedAt = 0;
        var readable = false;
        var writable = false;
        var executable = false;

        try { exists = Boolean(file.exists()); } catch (ignoredExists) {}
        try { directory = Boolean(file.isDirectory()); } catch (ignoredDirectory) {}
        try { regularFile = Boolean(file.isFile()); } catch (ignoredFile) {}
        try { bytes = regularFile ? Number(file.length()) : 0; } catch (ignoredLength) {}
        try { modifiedAt = Number(file.lastModified()); } catch (ignoredModified) {}
        try { readable = Boolean(file.canRead()); } catch (ignoredReadable) {}
        try { writable = Boolean(file.canWrite()); } catch (ignoredWritable) {}
        try { executable = Boolean(file.canExecute()); } catch (ignoredExecutable) {}

        return {
            path: relativePath(rootCanonical, canonical),
            name: String(file.getName() || "SingBoxHub"),
            depth: Number(depth),
            exists: exists,
            type: directory ? "directory" : (regularFile ? "file" : "other"),
            bytes: bytes,
            modifiedAt: modifiedAt,
            readable: readable,
            writable: writable,
            executable: executable,
            symlinkOrAlias: absolute !== canonical,
            canonicalInsideRoot: inside,
            candidate: isCandidateName(file.getName())
        };
    }

    function scan(root) {
        var rootCanonical = canonicalPath(root);
        var queue = [{ file: root, depth: 0 }];
        var entries = [];
        var candidates = [];
        var warnings = [];
        var truncated = false;
        var item;
        var entry;
        var children;
        var ordered;
        var i;

        while (queue.length > 0) {
            if (entries.length >= MAX_ENTRIES) {
                truncated = true;
                break;
            }

            item = queue.shift();
            entry = describe(item.file, rootCanonical, item.depth);
            entries.push(entry);

            if (entry.candidate) {
                candidates.push({
                    path: entry.path,
                    type: entry.type,
                    bytes: entry.bytes,
                    modifiedAt: entry.modifiedAt,
                    readable: entry.readable
                });
            }

            if (!entry.canonicalInsideRoot) {
                warnings.push("Skipped path outside Runtime root: " + entry.path);
                continue;
            }

            if (entry.type !== "directory" || item.depth >= MAX_DEPTH) {
                continue;
            }

            try {
                children = item.file.listFiles();
            } catch (listError) {
                children = null;
                warnings.push(
                    "Cannot list directory: " + entry.path + ": " +
                    errorText(listError)
                );
            }

            if (children === null) {
                if (entry.readable) {
                    warnings.push("Directory returned no listing: " + entry.path);
                }
                continue;
            }

            ordered = sortFiles(children);
            for (i = 0; i < ordered.length; i += 1) {
                queue.push({
                    file: ordered[i],
                    depth: item.depth + 1
                });
            }
        }

        return {
            rootCanonical: rootCanonical,
            maxDepth: MAX_DEPTH,
            maxEntries: MAX_ENTRIES,
            entryCount: entries.length,
            candidateCount: candidates.length,
            truncated: truncated,
            entries: entries,
            candidates: candidates,
            warnings: warnings
        };
    }

    function run() {
        var startedAt = now();
        var shortxDir = getShortXDir();
        var runtimeRoot = new File(shortxDir, "SingBoxHub");
        var rootExists = Boolean(runtimeRoot.exists());
        var rootDirectory = Boolean(runtimeRoot.isDirectory());
        var result = null;

        if (rootExists && rootDirectory) {
            result = scan(runtimeRoot);
        }

        return {
            ok: true,
            project: PROJECT,
            probe: PROBE,
            probeVersion: PROBE_VERSION,
            readOnly: true,
            shellExecuted: false,
            networkAccessed: false,
            filesModified: false,
            fileContentsRead: false,
            runtimeOperationsExecuted: false,
            shortxDir: String(shortxDir.getAbsolutePath()),
            runtimeRoot: String(runtimeRoot.getAbsolutePath()),
            runtimeRootExists: rootExists,
            runtimeRootDirectory: rootDirectory,
            scan: result,
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
            networkAccessed: false,
            filesModified: false,
            fileContentsRead: false,
            runtimeOperationsExecuted: false,
            error: errorText(fatal),
            timestamp: now()
        });
    }
}());
