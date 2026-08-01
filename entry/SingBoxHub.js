/*
 * SingBoxHub module download and compile probe.
 * ShortX / Rhino ES5.
 *
 * Safety boundary:
 * - downloads modules and verifies SHA-256
 * - compiles module source without evaluating it
 * - does not register receivers
 * - does not create Android Views or call WindowManager
 * - does not execute shell commands or control sing-box
 */
(function () {
    "use strict";

    var P = Packages;
    var File = P.java.io.File;
    var URL = P.java.net.URL;
    var FIS = P.java.io.FileInputStream;
    var FOS = P.java.io.FileOutputStream;
    var BAOS = P.java.io.ByteArrayOutputStream;
    var ReflectArray = P.java.lang.reflect.Array;
    var JavaByte = P.java.lang.Byte;
    var JavaString = P.java.lang.String;
    var MessageDigest = P.java.security.MessageDigest;
    var System = P.java.lang.System;
    var RhinoContext = P.org.mozilla.javascript.Context;

    var PROJECT = "SingBoxHub";
    var ENTRY_VERSION = 6;
    var REF = "agent/modular-ui-bootstrap-20260801";
    var RAW_BASE =
        "https://raw.githubusercontent.com/7015725/SingBoxHub/" +
        REF + "/";
    var MODULE_NAMES = [
        "sbh_01_base.js",
        "sbh_02_log.js",
        "sbh_03_files.js",
        "sbh_04_database.js",
        "sbh_05_theme.js",
        "sbh_06_widgets.js",
        "sbh_07_window.js",
        "sbh_08_navigation.js",
        "sbh_09_home.js",
        "sbh_10_subscriptions.js",
        "sbh_11_nodes.js",
        "sbh_12_runtime_logs.js",
        "sbh_13_automation.js",
        "sbh_14_runtime_client.js",
        "sbh_15_app.js"
    ];

    var CURRENT_STAGE = "initializing";
    var CURRENT_INDEX = -1;
    var CURRENT_NAME = null;
    var STATE_FILE = null;

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

    function ensureDir(dir) {
        if (!dir.exists() && !dir.mkdirs() && !dir.isDirectory()) {
            throw new Error(
                "Cannot create directory: " + dir.getAbsolutePath()
            );
        }
        if (!dir.isDirectory()) {
            throw new Error("Not a directory: " + dir.getAbsolutePath());
        }
        return dir;
    }

    function readBytes(stream) {
        var output = new BAOS();
        var buffer = ReflectArray.newInstance(JavaByte.TYPE, 8192);
        var count;
        try {
            while ((count = stream.read(buffer)) >= 0) {
                if (count > 0) {
                    output.write(buffer, 0, count);
                }
            }
            return output.toByteArray();
        } finally {
            closeQuietly(stream);
            closeQuietly(output);
        }
    }

    function readUtf8(file) {
        return String(new JavaString(readBytes(new FIS(file)), "UTF-8"));
    }

    function writeUtf8(file, text) {
        var output = null;
        ensureDir(file.getParentFile());
        try {
            output = new FOS(file, false);
            output.write(
                new JavaString(String(text)).getBytes("UTF-8")
            );
            output.flush();
            try {
                output.getFD().sync();
            } catch (ignoredSync) {}
        } finally {
            closeQuietly(output);
        }
    }

    function writeJson(file, value) {
        var temp = new File(file.getAbsolutePath() + ".tmp");
        writeUtf8(temp, JSON.stringify(value, null, 2) + "\n");
        if (file.exists() && !file.delete()) {
            temp.delete();
            throw new Error("Cannot replace state file");
        }
        if (!temp.renameTo(file)) {
            throw new Error("Cannot install state file");
        }
    }

    function deleteTree(file) {
        var children;
        var i;
        if (!file.exists()) {
            return true;
        }
        if (file.isDirectory()) {
            children = file.listFiles();
            if (children !== null) {
                for (i = 0; i < children.length; i += 1) {
                    deleteTree(children[i]);
                }
            }
        }
        return !file.exists() || file.delete();
    }

    function sha256(text) {
        var digest = MessageDigest.getInstance("SHA-256");
        var result = digest.digest(
            new JavaString(String(text)).getBytes("UTF-8")
        );
        var output = [];
        var i;
        var value;
        var hex;
        for (i = 0; i < result.length; i += 1) {
            value = Number(result[i]);
            if (value < 0) {
                value += 256;
            }
            hex = value.toString(16);
            output.push(hex.length === 1 ? "0" + hex : hex);
        }
        return output.join("");
    }

    function getContext() {
        var value = null;
        try {
            if (typeof context !== "undefined" && context !== null) {
                value = context;
            }
        } catch (ignored1) {}
        if (value === null) {
            try {
                value = P.android.app.ActivityThread.currentApplication();
            } catch (ignored2) {}
        }
        if (value === null) {
            try {
                value = P.android.app.AppGlobals.getInitialApplication();
            } catch (ignored3) {}
        }
        if (value === null) {
            throw new Error("Android Context unavailable");
        }
        try {
            return value.getApplicationContext() || value;
        } catch (ignored4) {
            return value;
        }
    }

    function shortxRoot() {
        if (typeof shortx === "undefined" ||
                shortx === null ||
                typeof shortx.getShortXDir !== "function") {
            throw new Error("shortx.getShortXDir() unavailable");
        }
        return new File(String(shortx.getShortXDir()));
    }

    function probeWritable(dir) {
        var probe = null;
        var output = null;
        try {
            ensureDir(dir);
            probe = new File(dir, ".sbh-probe-" + now());
            output = new FOS(probe, false);
            output.write(new JavaString("ok").getBytes("UTF-8"));
            output.flush();
            closeQuietly(output);
            output = null;
            return probe.isFile() && (probe.delete() || !probe.exists());
        } catch (ignored) {
            return false;
        } finally {
            closeQuietly(output);
            try {
                if (probe !== null && probe.exists()) {
                    probe.delete();
                }
            } catch (ignoredDelete) {}
        }
    }

    function resolveRoot(contextValue) {
        var shortxDir = shortxRoot();
        var candidates = [
            {
                mode: "shortx_client",
                dir: new File(shortxDir, "SingBoxHubClient")
            },
            {
                mode: "shortx_ui_fallback",
                dir: new File(shortxDir, "SingBoxHub-UI")
            }
        ];
        var filesDir = null;
        var i;
        try {
            filesDir = contextValue.getFilesDir();
        } catch (ignored) {}
        if (filesDir !== null) {
            candidates.push({
                mode: "app_files_fallback",
                dir: new File(filesDir, "SingBoxHubClient")
            });
        }
        for (i = 0; i < candidates.length; i += 1) {
            if (probeWritable(candidates[i].dir)) {
                return {
                    root: candidates[i].dir,
                    storageMode: candidates[i].mode
                };
            }
        }
        throw new Error("No writable client directory");
    }

    function fetchText(relativePath) {
        var connection = null;
        var code;
        var response;
        var stream;
        try {
            connection = new URL(
                RAW_BASE + relativePath +
                "?probe=" + ENTRY_VERSION + "-" + now()
            ).openConnection();
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(30000);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept-Encoding", "identity");
            connection.setRequestProperty("Cache-Control", "no-cache");
            connection.setRequestProperty(
                "User-Agent",
                "SingBoxHub-ModuleProbe/" + ENTRY_VERSION
            );
            code = Number(connection.getResponseCode());
            stream = code >= 200 && code < 300 ?
                connection.getInputStream() :
                connection.getErrorStream();
            response = String(
                new JavaString(readBytes(stream), "UTF-8")
            );
            if (code < 200 || code >= 300) {
                throw new Error(
                    "HTTP " + code + " for " + relativePath
                );
            }
            if (response.length > 2 * 1024 * 1024) {
                throw new Error("Response too large: " + relativePath);
            }
            return response;
        } finally {
            try {
                if (connection !== null) {
                    connection.disconnect();
                }
            } catch (ignoredDisconnect) {}
        }
    }

    function validateManifest(manifest) {
        var i;
        var item;
        if (!manifest ||
                Number(manifest.schemaVersion) !== 1 ||
                String(manifest.sourceRef || "") !== REF ||
                !manifest.moduleSetVersion ||
                !manifest.modules ||
                Number(manifest.modules.length) !== MODULE_NAMES.length) {
            throw new Error("Invalid module manifest");
        }
        for (i = 0; i < MODULE_NAMES.length; i += 1) {
            item = manifest.modules[i];
            if (!item ||
                    String(item.name || "") !== MODULE_NAMES[i] ||
                    String(item.path || "") !==
                        "src/" + MODULE_NAMES[i] ||
                    !/^[0-9a-f]{64}$/.test(
                        String(item.sha256 || "")
                    )) {
                throw new Error("Invalid module item: " + i);
            }
        }
        return manifest;
    }

    function checkpoint(value) {
        if (STATE_FILE !== null) {
            writeJson(STATE_FILE, value);
        }
    }

    function compileOnly(source, fileName) {
        var current = RhinoContext.getCurrentContext();
        var wrapped;
        if (current === null) {
            throw new Error("Rhino Context unavailable");
        }
        wrapped =
            "(function (SBH) {\n" +
            String(source) +
            "\n}(SBH));";
        current.compileString(wrapped, String(fileName), 1, null);
    }

    function run() {
        var startedAt = now();
        var contextValue = getContext();
        var resolved = resolveRoot(contextValue);
        var root = resolved.root;
        var bootstrap = ensureDir(new File(root, "bootstrap"));
        var probeBase = ensureDir(new File(root, "modules/probe"));
        var manifest;
        var probeDir;
        var results = [];
        var item;
        var source;
        var actualHash;
        var moduleStartedAt;
        var i;

        STATE_FILE = new File(bootstrap, "module_probe_state.json");
        CURRENT_STAGE = "fetch_manifest";
        checkpoint({
            schemaVersion: 1,
            entryVersion: ENTRY_VERSION,
            status: "running",
            stage: CURRENT_STAGE,
            modulesEvaluated: false,
            windowOperationsEnabled: false,
            updatedAt: now()
        });

        manifest = validateManifest(
            JSON.parse(fetchText("module-manifest.json"))
        );
        probeDir = new File(
            probeBase,
            String(manifest.moduleSetVersion)
        );
        deleteTree(probeDir);
        ensureDir(probeDir);

        for (i = 0; i < manifest.modules.length; i += 1) {
            item = manifest.modules[i];
            CURRENT_INDEX = i;
            CURRENT_NAME = String(item.name);
            CURRENT_STAGE = "download";
            moduleStartedAt = now();
            checkpoint({
                schemaVersion: 1,
                entryVersion: ENTRY_VERSION,
                status: "running",
                stage: CURRENT_STAGE,
                moduleIndex: i,
                moduleName: CURRENT_NAME,
                completedCount: results.length,
                moduleSetVersion: String(manifest.moduleSetVersion),
                modulesEvaluated: false,
                windowOperationsEnabled: false,
                updatedAt: now()
            });

            source = fetchText(String(item.path));
            CURRENT_STAGE = "hash";
            actualHash = sha256(source);
            if (actualHash !== String(item.sha256)) {
                throw new Error(
                    "SHA-256 mismatch: " + CURRENT_NAME +
                    ", expected=" + item.sha256 +
                    ", actual=" + actualHash
                );
            }

            CURRENT_STAGE = "compile";
            checkpoint({
                schemaVersion: 1,
                entryVersion: ENTRY_VERSION,
                status: "running",
                stage: CURRENT_STAGE,
                moduleIndex: i,
                moduleName: CURRENT_NAME,
                completedCount: results.length,
                moduleSetVersion: String(manifest.moduleSetVersion),
                modulesEvaluated: false,
                windowOperationsEnabled: false,
                updatedAt: now()
            });
            compileOnly(source, CURRENT_NAME);

            CURRENT_STAGE = "write_probe_copy";
            writeUtf8(new File(probeDir, CURRENT_NAME), source);
            results.push({
                index: i,
                name: CURRENT_NAME,
                bytes: Number(
                    new JavaString(source).getBytes("UTF-8").length
                ),
                sha256: actualHash,
                durationMs: now() - moduleStartedAt
            });
        }

        writeUtf8(
            new File(probeDir, "module-manifest.json"),
            JSON.stringify(manifest, null, 2) + "\n"
        );

        CURRENT_STAGE = "complete";
        checkpoint({
            schemaVersion: 1,
            entryVersion: ENTRY_VERSION,
            status: "module_probe_passed",
            stage: CURRENT_STAGE,
            moduleSetVersion: String(manifest.moduleSetVersion),
            modulesDownloaded: results.length,
            modulesCompiled: results.length,
            modulesEvaluated: false,
            coordinatorStarted: false,
            windowOperationsEnabled: false,
            results: results,
            completedAt: now()
        });

        return {
            ok: true,
            project: PROJECT,
            entryVersion: ENTRY_VERSION,
            started: false,
            status: "module_probe_passed",
            moduleSetVersion: String(manifest.moduleSetVersion),
            safeMode: true,
            modulesDownloaded: results.length,
            modulesCompiled: results.length,
            modulesEvaluated: false,
            coordinatorStarted: false,
            windowOperationsEnabled: false,
            runtimeAttached: false,
            destructiveOperations: false,
            probeDirectory: probeDir.getAbsolutePath(),
            checkpointPath: STATE_FILE.getAbsolutePath(),
            rootDir: root.getAbsolutePath(),
            storageMode: resolved.storageMode,
            durationMs: now() - startedAt,
            results: results,
            timestamp: now()
        };
    }

    try {
        return JSON.stringify(run());
    } catch (fatal) {
        try {
            checkpoint({
                schemaVersion: 1,
                entryVersion: ENTRY_VERSION,
                status: "module_probe_failed",
                stage: CURRENT_STAGE,
                moduleIndex: CURRENT_INDEX,
                moduleName: CURRENT_NAME,
                modulesEvaluated: false,
                coordinatorStarted: false,
                windowOperationsEnabled: false,
                error: errorText(fatal),
                failedAt: now()
            });
        } catch (ignoredCheckpoint) {}
        return JSON.stringify({
            ok: false,
            project: PROJECT,
            entryVersion: ENTRY_VERSION,
            started: false,
            status: "module_probe_failed",
            safeMode: true,
            stage: CURRENT_STAGE,
            moduleIndex: CURRENT_INDEX,
            moduleName: CURRENT_NAME,
            modulesEvaluated: false,
            coordinatorStarted: false,
            windowOperationsEnabled: false,
            runtimeAttached: false,
            destructiveOperations: false,
            checkpointPath: STATE_FILE !== null ?
                STATE_FILE.getAbsolutePath() : null,
            error: errorText(fatal),
            timestamp: now()
        });
    }
}());
