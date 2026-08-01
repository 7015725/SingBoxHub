/*
 * SingBoxHub modular UI bootstrap.
 * ShortX / Rhino ES5.
 */
(function (global) {
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
    var ENTRY_VERSION = 14;
    var REF = "agent/runtime-client-readonly-20260802";
    var RAW_BASE = "https://raw.githubusercontent.com/7015725/SingBoxHub/" + REF + "/";
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
        "sbh_15_app.js",
        "sbh_16_runtime_status_home.js"
    ];

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
                return String(error.javaException.getClass().getName()) + ": " + String(error);
            }
        } catch (ignored) {}
        return String(error);
    }

    function ensureDir(dir) {
        if (!dir.exists() && !dir.mkdirs() && !dir.isDirectory()) {
            throw new Error("Cannot create directory: " + dir.getAbsolutePath());
        }
        if (!dir.isDirectory()) {
            throw new Error("Not a directory: " + dir.getAbsolutePath());
        }
        return dir;
    }

    function getContext() {
        var value = null;
        try {
            if (typeof context !== "undefined" && context !== null) {
                value = context;
            }
        } catch (ignoredContext) {}
        if (value === null) {
            try {
                value = P.android.app.ActivityThread.currentApplication();
            } catch (ignoredActivityThread) {}
        }
        if (value === null) {
            try {
                value = P.android.app.AppGlobals.getInitialApplication();
            } catch (ignoredAppGlobals) {}
        }
        if (value === null) {
            throw new Error("Android Context unavailable");
        }
        try {
            return value.getApplicationContext() || value;
        } catch (ignoredApplicationContext) {
            return value;
        }
    }

    function shortxRoot() {
        if (typeof shortx === "undefined" || shortx === null ||
                typeof shortx.getShortXDir !== "function") {
            throw new Error("shortx.getShortXDir() unavailable");
        }
        return new File(String(shortx.getShortXDir()));
    }

    function probeWritable(dir) {
        var file = null;
        var output = null;
        try {
            ensureDir(dir);
            file = new File(dir, ".sbh-write-" + now());
            output = new FOS(file, false);
            output.write(new JavaString("ok").getBytes("UTF-8"));
            output.flush();
            closeQuietly(output);
            output = null;
            return file.isFile() && (file.delete() || !file.exists());
        } catch (ignored) {
            return false;
        } finally {
            closeQuietly(output);
            try {
                if (file !== null && file.exists()) {
                    file.delete();
                }
            } catch (ignoredDelete) {}
        }
    }

    function resolveRoot(ctx) {
        var base = shortxRoot();
        var candidates = [
            { mode: "shortx_client", dir: new File(base, "SingBoxHubClient") },
            { mode: "shortx_ui_fallback", dir: new File(base, "SingBoxHub-UI") }
        ];
        var filesDir = null;
        var i;
        try {
            filesDir = ctx.getFilesDir();
        } catch (ignoredFilesDir) {}
        if (filesDir !== null) {
            candidates.push({
                mode: "app_files_fallback",
                dir: new File(filesDir, "SingBoxHubClient")
            });
        }
        for (i = 0; i < candidates.length; i += 1) {
            if (probeWritable(candidates[i].dir)) {
                return candidates[i];
            }
        }
        throw new Error("No writable SingBoxHub client directory");
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
            output.write(new JavaString(String(text)).getBytes("UTF-8"));
            output.flush();
            try {
                output.getFD().sync();
            } catch (ignoredSync) {}
        } finally {
            closeQuietly(output);
        }
    }

    function writeAtomic(file, text) {
        var temp = new File(file.getAbsolutePath() + ".tmp");
        if (temp.exists()) {
            temp.delete();
        }
        writeUtf8(temp, text);
        if (file.exists() && !file.delete()) {
            temp.delete();
            throw new Error("Cannot replace: " + file.getAbsolutePath());
        }
        if (!temp.renameTo(file)) {
            throw new Error("Cannot install: " + file.getAbsolutePath());
        }
    }

    function writeJson(file, value) {
        writeAtomic(file, JSON.stringify(value, null, 2) + "\n");
    }

    function readJson(file, fallback) {
        try {
            if (!file.isFile()) {
                return fallback;
            }
            return JSON.parse(readUtf8(file));
        } catch (ignored) {
            return fallback;
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
        var result = digest.digest(new JavaString(String(text)).getBytes("UTF-8"));
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

    function fetchText(path) {
        var connection = null;
        var code;
        var stream;
        var text;
        try {
            connection = new URL(
                RAW_BASE + String(path) + "?entry=" + ENTRY_VERSION + "-" + now()
            ).openConnection();
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(30000);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept-Encoding", "identity");
            connection.setRequestProperty("Cache-Control", "no-cache");
            connection.setRequestProperty(
                "User-Agent",
                "SingBoxHub-ShortX/" + ENTRY_VERSION
            );
            code = Number(connection.getResponseCode());
            stream = code >= 200 && code < 300 ?
                connection.getInputStream() : connection.getErrorStream();
            text = String(new JavaString(readBytes(stream), "UTF-8"));
            if (code < 200 || code >= 300) {
                throw new Error("HTTP " + code + " for " + path);
            }
            if (text.length > 2 * 1024 * 1024) {
                throw new Error("Response too large: " + path);
            }
            return text;
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
        if (!manifest || Number(manifest.schemaVersion) !== 1 ||
                String(manifest.sourceRef || "") !== REF ||
                Number(manifest.entryMinVersion || 0) > ENTRY_VERSION ||
                !manifest.moduleSetVersion || !manifest.modules ||
                Number(manifest.modules.length) !== MODULE_NAMES.length) {
            throw new Error("Invalid module manifest");
        }
        for (i = 0; i < MODULE_NAMES.length; i += 1) {
            item = manifest.modules[i];
            if (!item || String(item.name || "") !== MODULE_NAMES[i] ||
                    String(item.path || "") !== "src/" + MODULE_NAMES[i] ||
                    !/^[0-9a-f]{64}$/.test(String(item.sha256 || ""))) {
                throw new Error("Invalid module item: " + i);
            }
        }
        return manifest;
    }

    function compileOnly(source, name) {
        var current = RhinoContext.getCurrentContext();
        if (current === null) {
            throw new Error("Rhino Context unavailable");
        }
        current.compileString(
            "(function(SBH){\n" + source + "\n}(SBH));",
            String(name),
            1,
            null
        );
    }

    function buildPaths(resolved) {
        var root = resolved.dir;
        var bootstrap = ensureDir(new File(root, "bootstrap"));
        var modules = ensureDir(new File(root, "modules"));
        return {
            rootDir: root,
            storageMode: resolved.mode,
            bootstrapDir: bootstrap,
            modulesDir: modules,
            setsDir: ensureDir(new File(modules, "sets")),
            dataDir: ensureDir(new File(root, "data")),
            cacheDir: ensureDir(new File(root, "cache")),
            logsDir: ensureDir(new File(root, "logs")),
            stateDir: ensureDir(new File(root, "state")),
            activeFile: new File(bootstrap, "active.json"),
            lastGoodFile: new File(bootstrap, "last_good.json"),
            updateStateFile: new File(bootstrap, "update_state.json")
        };
    }

    function setDir(paths, version) {
        return new File(paths.setsDir, String(version));
    }

    function localManifest(paths, version) {
        var file = new File(setDir(paths, version), "module-manifest.json");
        if (!file.isFile()) {
            throw new Error("Local manifest missing: " + version);
        }
        return validateManifest(JSON.parse(readUtf8(file)));
    }

    function verifySet(paths, manifest) {
        var dir = setDir(paths, manifest.moduleSetVersion);
        var i;
        var item;
        var file;
        if (!dir.isDirectory()) {
            return false;
        }
        for (i = 0; i < manifest.modules.length; i += 1) {
            item = manifest.modules[i];
            file = new File(dir, item.name);
            if (!file.isFile() ||
                    sha256(readUtf8(file)) !== String(item.sha256)) {
                return false;
            }
        }
        return true;
    }

    function prepareSet(paths, manifest) {
        var version = String(manifest.moduleSetVersion);
        var finalDir = setDir(paths, version);
        var stage = new File(paths.setsDir, version + ".tmp-" + now());
        var item;
        var source;
        var i;

        if (verifySet(paths, manifest)) {
            return {
                version: version,
                reused: true,
                downloadedCount: 0
            };
        }

        deleteTree(stage);
        ensureDir(stage);
        try {
            for (i = 0; i < manifest.modules.length; i += 1) {
                item = manifest.modules[i];
                source = fetchText(item.path);
                if (sha256(source) !== String(item.sha256)) {
                    throw new Error("SHA-256 mismatch: " + item.name);
                }
                compileOnly(source, item.name);
                writeUtf8(new File(stage, item.name), source);
            }
            writeUtf8(
                new File(stage, "module-manifest.json"),
                JSON.stringify(manifest, null, 2) + "\n"
            );
            if (finalDir.exists()) {
                deleteTree(finalDir);
            }
            if (!stage.renameTo(finalDir)) {
                throw new Error("Cannot activate module set: " + version);
            }
            return {
                version: version,
                reused: false,
                downloadedCount: manifest.modules.length
            };
        } catch (error) {
            deleteTree(stage);
            throw error;
        }
    }

    function loadSet(paths, version, ctx, syncInfo) {
        var manifest = localManifest(paths, version);
        var dir = setDir(paths, version);
        var namespace = {
            global: global,
            context: ctx,
            state: {},
            services: {},
            versions: {},
            bootstrap: {
                project: PROJECT,
                entryVersion: ENTRY_VERSION,
                moduleSetVersion: String(version),
                sourceRef: REF,
                storageMode: paths.storageMode,
                sync: syncInfo
            },
            paths: {
                rootDir: paths.rootDir,
                bootstrapDir: paths.bootstrapDir,
                modulesDir: paths.modulesDir,
                setsDir: paths.setsDir,
                dataDir: paths.dataDir,
                cacheDir: paths.cacheDir,
                logsDir: paths.logsDir,
                stateDir: paths.stateDir
            }
        };
        var i;
        var item;
        var source;
        var SBH = namespace;

        for (i = 0; i < manifest.modules.length; i += 1) {
            item = manifest.modules[i];
            source = readUtf8(new File(dir, item.name));
            if (sha256(source) !== String(item.sha256)) {
                throw new Error("Local module corrupted: " + item.name);
            }
            eval("(function(SBH){\n" + source + "\n}(SBH));");
        }
        if (!SBH.app || typeof SBH.app.start !== "function") {
            throw new Error("App module did not register start()");
        }
        return {
            namespace: SBH,
            result: SBH.app.start()
        };
    }

    function pointerVersion(pointer) {
        return pointer && pointer.moduleSetVersion ?
            String(pointer.moduleSetVersion) : "";
    }

    function runtimeAttached(loaded) {
        try {
            if (loaded && loaded.result &&
                    loaded.result.runtimeAttached === true) {
                return true;
            }
            if (loaded && loaded.namespace && loaded.namespace.runtime &&
                    typeof loaded.namespace.runtime.isAttached === "function") {
                return loaded.namespace.runtime.isAttached() === true;
            }
        } catch (ignored) {}
        return false;
    }

    function run() {
        var startedAt = now();
        var ctx = getContext();
        var resolved = resolveRoot(ctx);
        var paths = buildPaths(resolved);
        var active = readJson(paths.activeFile, null);
        var lastGood = readJson(paths.lastGoodFile, null);
        var syncInfo = {
            remoteAvailable: false,
            updated: false,
            downloadedCount: 0,
            fallback: false,
            warning: null,
            sourceRef: REF,
            storageMode: paths.storageMode
        };
        var candidate = "";
        var remoteManifest;
        var prepared;
        var loaded;
        var fallback;
        var stamp = now();
        var attached;

        try {
            remoteManifest = validateManifest(
                JSON.parse(fetchText("module-manifest.json"))
            );
            syncInfo.remoteAvailable = true;
            prepared = prepareSet(paths, remoteManifest);
            candidate = prepared.version;
            syncInfo.updated = !prepared.reused;
            syncInfo.downloadedCount = prepared.downloadedCount;
        } catch (syncError) {
            syncInfo.warning = errorText(syncError);
            candidate = pointerVersion(active) || pointerVersion(lastGood);
        }

        if (!candidate) {
            throw new Error(
                "No verified module set available: " +
                String(syncInfo.warning || "unknown")
            );
        }

        try {
            loaded = loadSet(paths, candidate, ctx, syncInfo);
        } catch (loadError) {
            fallback = pointerVersion(lastGood);
            if (!fallback || fallback === candidate) {
                throw loadError;
            }
            syncInfo.fallback = true;
            syncInfo.warning = errorText(loadError);
            candidate = fallback;
            loaded = loadSet(paths, candidate, ctx, syncInfo);
        }

        attached = runtimeAttached(loaded);

        writeJson(paths.activeFile, {
            schemaVersion: 1,
            moduleSetVersion: candidate,
            sourceRef: REF,
            storageMode: paths.storageMode,
            activatedAt: stamp
        });
        writeJson(paths.lastGoodFile, {
            schemaVersion: 1,
            moduleSetVersion: candidate,
            sourceRef: REF,
            storageMode: paths.storageMode,
            lastSuccessfulStartAt: stamp
        });
        writeJson(paths.updateStateFile, {
            schemaVersion: 2,
            entryVersion: ENTRY_VERSION,
            updatedAt: stamp,
            sync: syncInfo,
            runtimeAttached: attached,
            status: "full_ui_started"
        });

        global.__SBH_NAMESPACE__ = loaded.namespace;

        return {
            ok: true,
            project: PROJECT,
            entryVersion: ENTRY_VERSION,
            moduleSetVersion: candidate,
            started: true,
            status: "full_ui_started",
            runtimeAttached: attached,
            destructiveOperations: false,
            sync: syncInfo,
            app: loaded.result,
            rootDir: paths.rootDir.getAbsolutePath(),
            storageMode: paths.storageMode,
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
            entryVersion: ENTRY_VERSION,
            started: false,
            status: "full_ui_bootstrap_failed",
            runtimeAttached: false,
            destructiveOperations: false,
            error: errorText(fatal),
            timestamp: now()
        });
    }
}(this));
