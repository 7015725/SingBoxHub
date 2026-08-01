/*
 * SingBoxHub modular bootstrap.
 * ShortX / Rhino ES5.
 *
 * Responsibilities:
 * - fetch and validate module manifest
 * - download modules to an immutable local set
 * - verify SHA-256 and Rhino syntax
 * - load only local verified modules
 * - fall back to last known good set
 *
 * This entry does not execute shell commands or control sing-box.
 */
(function (global) {
    "use strict";

    var P = Packages;
    var File = P.java.io.File;
    var URL = P.java.net.URL;
    var URLEncoder = P.java.net.URLEncoder;
    var FIS = P.java.io.FileInputStream;
    var FOS = P.java.io.FileOutputStream;
    var BAOS = P.java.io.ByteArrayOutputStream;
    var ReflectArray = P.java.lang.reflect.Array;
    var JavaByte = P.java.lang.Byte;
    var JavaString = P.java.lang.String;
    var MessageDigest = P.java.security.MessageDigest;
    var System = P.java.lang.System;
    var ContextClass = P.org.mozilla.javascript.Context;

    var PROJECT = "SingBoxHub";
    var ENTRY_VERSION = 3;
    var OWNER = "7015725";
    var REPO = "SingBoxHub";
    var DEFAULT_REF = "agent/modular-ui-bootstrap-20260801";
    var MANIFEST_PATH = "module-manifest.json";
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
        var value = "";
        if (typeof shortx !== "undefined" &&
                shortx !== null &&
                typeof shortx.getShortXDir === "function") {
            value = String(shortx.getShortXDir() || "");
        }
        if (!value) {
            throw new Error("shortx.getShortXDir() unavailable");
        }
        return new File(value);
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

    function readBytes(stream) {
        var out = new BAOS();
        var buffer = ReflectArray.newInstance(JavaByte.TYPE, 8192);
        var count;
        try {
            while ((count = stream.read(buffer)) >= 0) {
                if (count > 0) {
                    out.write(buffer, 0, count);
                }
            }
            return out.toByteArray();
        } finally {
            closeQuietly(stream);
            closeQuietly(out);
        }
    }

    function readUtf8(file) {
        return String(new JavaString(readBytes(new FIS(file)), "UTF-8"));
    }

    function writeUtf8(file, text) {
        var out = null;
        ensureDir(file.getParentFile());
        try {
            out = new FOS(file, false);
            out.write(new JavaString(String(text)).getBytes("UTF-8"));
            out.flush();
            try {
                out.getFD().sync();
            } catch (syncError) {
                throw new Error("File sync failed: " + syncError);
            }
        } finally {
            closeQuietly(out);
        }
    }

    function writeAtomic(file, text) {
        var temp = new File(file.getAbsolutePath() + ".tmp");
        var backup = new File(file.getAbsolutePath() + ".bak");
        ensureDir(file.getParentFile());
        if (temp.exists()) {
            temp.delete();
        }
        writeUtf8(temp, text);
        if (backup.exists()) {
            backup.delete();
        }
        if (file.exists() && !file.renameTo(backup)) {
            temp.delete();
            throw new Error("Cannot back up: " + file.getAbsolutePath());
        }
        if (!temp.renameTo(file)) {
            if (!file.exists() && backup.exists()) {
                backup.renameTo(file);
            }
            throw new Error("Cannot install: " + file.getAbsolutePath());
        }
        if (backup.exists()) {
            backup.delete();
        }
    }

    function writeJson(file, value) {
        writeAtomic(file, JSON.stringify(value, null, 2) + "\n");
    }

    function readJson(file, fallback) {
        try {
            if (!file.exists()) {
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

    function sha256Text(text) {
        var digest = MessageDigest.getInstance("SHA-256");
        var bytes = new JavaString(String(text)).getBytes("UTF-8");
        var result = digest.digest(bytes);
        var out = [];
        var i;
        var value;
        var hex;
        for (i = 0; i < result.length; i += 1) {
            value = Number(result[i]);
            if (value < 0) {
                value += 256;
            }
            hex = value.toString(16);
            out.push(hex.length === 1 ? "0" + hex : hex);
        }
        return out.join("");
    }

    function encodeSegment(value) {
        return String(URLEncoder.encode(String(value), "UTF-8"))
            .replace(/\+/g, "%20");
    }

    function encodePath(path) {
        var parts = String(path).split("/");
        var result = [];
        var i;
        for (i = 0; i < parts.length; i += 1) {
            result.push(encodeSegment(parts[i]));
        }
        return result.join("/");
    }

    function rawUrl(path, ref) {
        return "https://raw.githubusercontent.com/" +
            OWNER + "/" + REPO + "/" +
            encodeSegment(ref) + "/" + encodePath(path) +
            "?sbh=" + ENTRY_VERSION + "-" + Number(System.currentTimeMillis());
    }

    function fetchText(path, ref) {
        var connection = null;
        var code;
        var bytes;
        var response;
        try {
            connection = new URL(rawUrl(path, ref)).openConnection();
            connection.setConnectTimeout(12000);
            connection.setReadTimeout(25000);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept", "text/plain, */*");
            connection.setRequestProperty("Accept-Encoding", "identity");
            connection.setRequestProperty("Cache-Control", "no-cache");
            connection.setRequestProperty(
                "User-Agent",
                "SingBoxHub-ShortX/" + ENTRY_VERSION
            );
            code = Number(connection.getResponseCode());
            bytes = readBytes(
                code >= 200 && code < 300 ?
                    connection.getInputStream() :
                    connection.getErrorStream()
            );
            response = String(new JavaString(bytes, "UTF-8"));
            if (code < 200 || code >= 300) {
                throw new Error(
                    "HTTP " + code + " for " + path + ": " +
                    response.substring(0, 240)
                );
            }
            if (response.indexOf("<html") >= 0 ||
                    response.indexOf("<!DOCTYPE") >= 0) {
                throw new Error("HTML response for " + path);
            }
            if (response.length > 2 * 1024 * 1024) {
                throw new Error("Response too large: " + path);
            }
            return response;
        } finally {
            try {
                if (connection !== null) {
                    connection.disconnect();
                }
            } catch (ignored) {}
        }
    }

    function validateManifest(manifest, expectedRef) {
        var seen = {};
        var i;
        var item;
        if (!manifest ||
                Number(manifest.schemaVersion) !== 1 ||
                !manifest.moduleSetVersion ||
                !manifest.modules ||
                manifest.modules.length !== MODULE_NAMES.length) {
            throw new Error("Invalid module manifest");
        }
        if (Number(manifest.entryMinVersion || 0) > ENTRY_VERSION) {
            throw new Error("SingBoxHub entry must be updated");
        }
        if (String(manifest.sourceRef || "") !== String(expectedRef)) {
            throw new Error(
                "Manifest ref mismatch: " + manifest.sourceRef +
                " != " + expectedRef
            );
        }
        for (i = 0; i < manifest.modules.length; i += 1) {
            item = manifest.modules[i];
            if (!item ||
                    String(item.name) !== MODULE_NAMES[i] ||
                    !item.path ||
                    !/^[0-9a-f]{64}$/.test(String(item.sha256 || ""))) {
                throw new Error("Invalid module item at " + i);
            }
            if (seen[item.name]) {
                throw new Error("Duplicate module: " + item.name);
            }
            seen[item.name] = true;
        }
        return manifest;
    }

    function compileCheck(source, name) {
        var current = ContextClass.getCurrentContext();
        var wrapped =
            "(function (SBH) {\n" +
            String(source) +
            "\n}(SBH));";
        current.compileString(wrapped, String(name), 1, null);
    }

    function paths() {
        var root = ensureDir(new File(shortxRoot(), "SingBoxHub"));
        var bootstrap = ensureDir(new File(root, "bootstrap"));
        var modules = ensureDir(new File(root, "modules"));
        var sets = ensureDir(new File(modules, "sets"));
        return {
            rootDir: root,
            bootstrapDir: bootstrap,
            modulesDir: modules,
            setsDir: sets,
            dataDir: ensureDir(new File(root, "data")),
            cacheDir: ensureDir(new File(root, "cache")),
            logsDir: ensureDir(new File(root, "logs")),
            stateDir: ensureDir(new File(root, "state")),
            activeFile: new File(bootstrap, "active.json"),
            lastGoodFile: new File(bootstrap, "last_good.json"),
            updateStateFile: new File(bootstrap, "update_state.json")
        };
    }

    function setDir(pathSet, version) {
        return new File(pathSet.setsDir, String(version));
    }

    function verifySet(pathSet, manifest) {
        var dir = setDir(pathSet, manifest.moduleSetVersion);
        var i;
        var item;
        var file;
        var text;
        if (!dir.isDirectory()) {
            return false;
        }
        for (i = 0; i < manifest.modules.length; i += 1) {
            item = manifest.modules[i];
            file = new File(dir, item.name);
            if (!file.isFile()) {
                return false;
            }
            text = readUtf8(file);
            if (sha256Text(text) !== String(item.sha256)) {
                return false;
            }
        }
        return true;
    }

    function prepareSet(pathSet, manifest, ref) {
        var version = String(manifest.moduleSetVersion);
        var finalDir = setDir(pathSet, version);
        var stageDir = new File(
            pathSet.setsDir,
            version + ".tmp-" + Number(System.currentTimeMillis())
        );
        var i;
        var item;
        var source;
        var target;

        if (verifySet(pathSet, manifest)) {
            return {
                version: version,
                downloadedCount: 0,
                reused: true
            };
        }

        deleteTree(stageDir);
        ensureDir(stageDir);

        try {
            for (i = 0; i < manifest.modules.length; i += 1) {
                item = manifest.modules[i];
                source = fetchText(item.path, ref);
                if (sha256Text(source) !== String(item.sha256)) {
                    throw new Error("SHA-256 mismatch: " + item.name);
                }
                compileCheck(source, item.name);
                target = new File(stageDir, item.name);
                writeUtf8(target, source);
            }
            writeUtf8(
                new File(stageDir, "module-manifest.json"),
                JSON.stringify(manifest, null, 2) + "\n"
            );
            var previousDir = new File(
                pathSet.setsDir,
                version + ".previous-" + Number(System.currentTimeMillis())
            );
            if (finalDir.exists() && !finalDir.renameTo(previousDir)) {
                throw new Error("Cannot back up previous module directory");
            }
            if (!stageDir.renameTo(finalDir)) {
                if (!finalDir.exists() && previousDir.exists()) {
                    previousDir.renameTo(finalDir);
                }
                throw new Error("Cannot activate module directory");
            }
            if (previousDir.exists()) {
                deleteTree(previousDir);
            }
            return {
                version: version,
                downloadedCount: manifest.modules.length,
                reused: false
            };
        } catch (error) {
            deleteTree(stageDir);
            throw error;
        }
    }

    function manifestForLocalSet(pathSet, version) {
        var file = new File(
            setDir(pathSet, version),
            "module-manifest.json"
        );
        if (!file.isFile()) {
            throw new Error("Local manifest missing: " + version);
        }
        return validateManifest(JSON.parse(readUtf8(file)), DEFAULT_REF);
    }

    function loadSet(pathSet, version, contextValue, syncInfo) {
        var manifest = manifestForLocalSet(pathSet, version);
        var dir = setDir(pathSet, version);
        var SBH = {
            global: global,
            context: contextValue,
            state: {},
            services: {},
            versions: {},
            bootstrap: {
                project: PROJECT,
                entryVersion: ENTRY_VERSION,
                moduleSetVersion: String(version),
                sourceRef: DEFAULT_REF,
                sync: syncInfo
            },
            paths: {
                rootDir: pathSet.rootDir,
                bootstrapDir: pathSet.bootstrapDir,
                modulesDir: pathSet.modulesDir,
                setsDir: pathSet.setsDir,
                dataDir: pathSet.dataDir,
                cacheDir: pathSet.cacheDir,
                logsDir: pathSet.logsDir,
                stateDir: pathSet.stateDir
            }
        };
        var i;
        var item;
        var file;
        var source;
        var wrapped;

        for (i = 0; i < manifest.modules.length; i += 1) {
            item = manifest.modules[i];
            file = new File(dir, item.name);
            source = readUtf8(file);
            if (sha256Text(source) !== String(item.sha256)) {
                throw new Error("Local module corrupted: " + item.name);
            }
            wrapped =
                "(function (SBH) {\n" +
                source +
                "\n}(SBH));";
            eval(wrapped);
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
        if (!pointer || !pointer.moduleSetVersion) {
            return "";
        }
        return String(pointer.moduleSetVersion);
    }

    function run() {
        var contextValue = getContext();
        var pathSet = paths();
        var active = readJson(pathSet.activeFile, null);
        var lastGood = readJson(pathSet.lastGoodFile, null);
        var syncInfo = {
            remoteAvailable: false,
            updated: false,
            downloadedCount: 0,
            fallback: false,
            warning: null,
            sourceRef: DEFAULT_REF
        };
        var candidateVersion = "";
        var remoteManifest;
        var prepared;
        var loaded;
        var fallbackVersion;
        var now = Number(System.currentTimeMillis());

        try {
            remoteManifest = validateManifest(
                JSON.parse(fetchText(MANIFEST_PATH, DEFAULT_REF)),
                DEFAULT_REF
            );
            syncInfo.remoteAvailable = true;
            prepared = prepareSet(pathSet, remoteManifest, DEFAULT_REF);
            candidateVersion = prepared.version;
            syncInfo.updated = !prepared.reused;
            syncInfo.downloadedCount = prepared.downloadedCount;
        } catch (syncError) {
            syncInfo.warning = errorText(syncError);
            candidateVersion = pointerVersion(active) ||
                pointerVersion(lastGood);
        }

        if (!candidateVersion) {
            throw new Error(
                "No verified module set available: " +
                String(syncInfo.warning || "unknown")
            );
        }

        try {
            loaded = loadSet(
                pathSet,
                candidateVersion,
                contextValue,
                syncInfo
            );
        } catch (candidateError) {
            fallbackVersion = pointerVersion(lastGood);
            if (!fallbackVersion || fallbackVersion === candidateVersion) {
                throw candidateError;
            }
            syncInfo.fallback = true;
            syncInfo.warning = errorText(candidateError);
            loaded = loadSet(
                pathSet,
                fallbackVersion,
                contextValue,
                syncInfo
            );
            candidateVersion = fallbackVersion;
        }

        writeJson(pathSet.activeFile, {
            schemaVersion: 1,
            moduleSetVersion: candidateVersion,
            sourceRef: DEFAULT_REF,
            activatedAt: now
        });
        writeJson(pathSet.lastGoodFile, {
            schemaVersion: 1,
            moduleSetVersion: candidateVersion,
            sourceRef: DEFAULT_REF,
            successfulStarts: Number(
                lastGood && lastGood.moduleSetVersion === candidateVersion ?
                    lastGood.successfulStarts || 0 : 0
            ) + 1,
            lastSuccessfulStartAt: now
        });
        writeJson(pathSet.updateStateFile, {
            schemaVersion: 1,
            updatedAt: now,
            sync: syncInfo
        });

        global.__SBH_NAMESPACE__ = loaded.namespace;

        return {
            ok: true,
            project: PROJECT,
            entryVersion: ENTRY_VERSION,
            moduleSetVersion: candidateVersion,
            started: true,
            status: "modular_ui_started",
            runtimeAttached: false,
            destructiveOperations: false,
            sync: syncInfo,
            app: loaded.result,
            rootDir: pathSet.rootDir.getAbsolutePath(),
            timestamp: now
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
            status: "bootstrap_failed",
            runtimeAttached: false,
            destructiveOperations: false,
            error: errorText(fatal),
            timestamp: Number(System.currentTimeMillis())
        });
    }
}(this));
