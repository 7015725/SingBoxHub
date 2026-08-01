/*
 * SingBoxHub recovery bootstrap.
 * ShortX / Rhino ES5.
 *
 * This entry performs recovery only. It does not evaluate modules, register
 * receivers, create views, call WindowManager, execute shell commands or
 * control sing-box.
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
    var System = P.java.lang.System;

    var PROJECT = "SingBoxHub";
    var ENTRY_VERSION = 5;
    var REF = "agent/modular-ui-bootstrap-20260801";
    var MANIFEST_URL =
        "https://raw.githubusercontent.com/7015725/SingBoxHub/" +
        REF + "/module-manifest.json";
    var UNSAFE = {
        "20260801.01": true,
        "20260801.02": true
    };

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
        return String(
            new JavaString(readBytes(new FIS(file)), "UTF-8")
        );
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
        if (temp.exists()) {
            temp.delete();
        }
        writeUtf8(temp, JSON.stringify(value, null, 2) + "\n");
        if (file.exists() && !file.delete()) {
            temp.delete();
            throw new Error("Cannot replace: " + file.getAbsolutePath());
        }
        if (!temp.renameTo(file)) {
            temp.delete();
            throw new Error("Cannot install: " + file.getAbsolutePath());
        }
    }

    function readJson(file) {
        try {
            return file.isFile() ? JSON.parse(readUtf8(file)) : null;
        } catch (ignored) {
            return null;
        }
    }

    function deleteTree(file) {
        var children;
        var index;
        var ok = true;
        if (!file.exists()) {
            return true;
        }
        if (file.isDirectory()) {
            children = file.listFiles();
            if (children !== null) {
                for (index = 0; index < children.length; index += 1) {
                    if (!deleteTree(children[index])) {
                        ok = false;
                    }
                }
            }
        }
        if (file.exists() && !file.delete()) {
            ok = false;
        }
        return ok;
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
        return value;
    }

    function resolveRoot() {
        var base;
        var root;
        var probe;
        var output = null;
        var contextValue;

        if (typeof shortx === "undefined" ||
                shortx === null ||
                typeof shortx.getShortXDir !== "function") {
            throw new Error("shortx.getShortXDir() unavailable");
        }

        base = new File(String(shortx.getShortXDir()));
        root = new File(base, "SingBoxHubClient");

        try {
            ensureDir(root);
            probe = new File(root, ".recovery-write-probe");
            output = new FOS(probe, false);
            output.write(new JavaString("ok").getBytes("UTF-8"));
            output.flush();
            closeQuietly(output);
            output = null;
            if (!probe.delete() && probe.exists()) {
                throw new Error("Cannot delete recovery probe");
            }
            return {
                root: root,
                storageMode: "shortx_client"
            };
        } catch (primaryError) {
            closeQuietly(output);
            contextValue = getContext();
            if (contextValue === null) {
                throw primaryError;
            }
            root = new File(
                contextValue.getFilesDir(),
                "SingBoxHubClient"
            );
            ensureDir(root);
            return {
                root: root,
                storageMode: "app_files_fallback"
            };
        }
    }

    function fetchManifest() {
        var connection = null;
        var code;
        var text;
        try {
            connection = new URL(
                MANIFEST_URL +
                "?recovery=" + ENTRY_VERSION + "-" +
                Number(System.currentTimeMillis())
            ).openConnection();
            connection.setConnectTimeout(12000);
            connection.setReadTimeout(25000);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept-Encoding", "identity");
            connection.setRequestProperty("Cache-Control", "no-cache");
            connection.setRequestProperty("Pragma", "no-cache");
            connection.setRequestProperty(
                "User-Agent",
                "SingBoxHub-Recovery/" + ENTRY_VERSION
            );
            code = Number(connection.getResponseCode());
            text = String(new JavaString(
                readBytes(
                    code >= 200 && code < 300 ?
                        connection.getInputStream() :
                        connection.getErrorStream()
                ),
                "UTF-8"
            ));
            if (code < 200 || code >= 300) {
                throw new Error(
                    "Manifest HTTP " + code + ": " +
                    text.substring(0, 240)
                );
            }
            return JSON.parse(text);
        } finally {
            try {
                if (connection !== null) {
                    connection.disconnect();
                }
            } catch (ignoredDisconnect) {}
        }
    }

    function versionOf(pointer) {
        return pointer && pointer.moduleSetVersion ?
            String(pointer.moduleSetVersion) : "";
    }

    function run() {
        var resolved = resolveRoot();
        var root = resolved.root;
        var bootstrap = ensureDir(new File(root, "bootstrap"));
        var sets = ensureDir(new File(root, "modules/sets"));
        var activeFile = new File(bootstrap, "active.json");
        var lastGoodFile = new File(bootstrap, "last_good.json");
        var endpointFile = new File(root, "cache/control_endpoint.json");
        var stateFile = new File(bootstrap, "recovery_state.json");
        var active = readJson(activeFile);
        var lastGood = readJson(lastGoodFile);
        var quarantined = [];
        var version;
        var manifest;
        var now = Number(System.currentTimeMillis());

        version = versionOf(active);
        if (UNSAFE[version]) {
            activeFile.delete();
            quarantined.push("active:" + version);
        }

        version = versionOf(lastGood);
        if (UNSAFE[version]) {
            lastGoodFile.delete();
            quarantined.push("last_good:" + version);
        }

        for (version in UNSAFE) {
            if (UNSAFE.hasOwnProperty(version)) {
                deleteTree(new File(sets, version));
                quarantined.push("set:" + version);
            }
        }

        try {
            if (endpointFile.exists()) {
                endpointFile.delete();
                quarantined.push("stale_control_endpoint");
            }
        } catch (ignoredEndpoint) {}

        manifest = fetchManifest();
        if (!manifest ||
                Number(manifest.schemaVersion) !== 1 ||
                String(manifest.sourceRef || "") !== REF ||
                !manifest.modules ||
                Number(manifest.modules.length) !== 15 ||
                UNSAFE[String(manifest.moduleSetVersion || "")]) {
            throw new Error("Unsafe or invalid remote manifest");
        }

        writeJson(stateFile, {
            schemaVersion: 1,
            entryVersion: ENTRY_VERSION,
            status: "safe_recovery_ready",
            remoteModuleSetVersion: String(manifest.moduleSetVersion),
            storageMode: resolved.storageMode,
            quarantined: quarantined,
            modulesDownloaded: false,
            modulesEvaluated: false,
            coordinatorStarted: false,
            windowOperationsEnabled: false,
            updatedAt: now
        });

        return {
            ok: true,
            project: PROJECT,
            entryVersion: ENTRY_VERSION,
            started: false,
            status: "safe_recovery_ready",
            remoteModuleSetVersion: String(manifest.moduleSetVersion),
            safeMode: true,
            modulesDownloaded: false,
            modulesEvaluated: false,
            coordinatorStarted: false,
            windowOperationsEnabled: false,
            runtimeAttached: false,
            destructiveOperations: false,
            quarantined: quarantined,
            rootDir: root.getAbsolutePath(),
            storageMode: resolved.storageMode,
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
            status: "safe_recovery_failed",
            safeMode: true,
            modulesEvaluated: false,
            coordinatorStarted: false,
            windowOperationsEnabled: false,
            runtimeAttached: false,
            destructiveOperations: false,
            error: errorText(fatal),
            timestamp: Number(System.currentTimeMillis())
        });
    }
}());
