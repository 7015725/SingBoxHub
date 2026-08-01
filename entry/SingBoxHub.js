/*
 * SingBoxHub local module evaluation probe.
 * ShortX / Rhino ES5.
 *
 * Safety boundary:
 * - reads the previously downloaded and verified local probe module set
 * - verifies SHA-256 again
 * - evaluates modules in dependency order with durable checkpoints
 * - does not call SBH.app.start()
 * - does not register receivers or create Android Views
 * - does not call WindowManager
 * - does not execute shell commands or control sing-box
 */
(function (global) {
    "use strict";

    var P = Packages;
    var File = P.java.io.File;
    var FIS = P.java.io.FileInputStream;
    var FOS = P.java.io.FileOutputStream;
    var BAOS = P.java.io.ByteArrayOutputStream;
    var ReflectArray = P.java.lang.reflect.Array;
    var JavaByte = P.java.lang.Byte;
    var JavaString = P.java.lang.String;
    var MessageDigest = P.java.security.MessageDigest;
    var System = P.java.lang.System;

    var PROJECT = "SingBoxHub";
    var ENTRY_VERSION = 7;
    var EXPECTED_REF = "agent/modular-ui-bootstrap-20260801";
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

    var CHECKPOINT_FILE = null;
    var CURRENT_STAGE = "initializing";
    var CURRENT_INDEX = -1;
    var CURRENT_NAME = null;

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
        if (!file.isFile()) {
            throw new Error("Missing file: " + file.getAbsolutePath());
        }
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
            throw new Error("Cannot replace checkpoint file");
        }
        if (!temp.renameTo(file)) {
            throw new Error("Cannot install checkpoint file");
        }
    }

    function readJson(file) {
        return JSON.parse(readUtf8(file));
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
            probe = new File(dir, ".sbh-eval-probe-" + now());
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

    function validateManifest(manifest) {
        var i;
        var item;
        if (!manifest ||
                Number(manifest.schemaVersion) !== 1 ||
                String(manifest.sourceRef || "") !== EXPECTED_REF ||
                !manifest.moduleSetVersion ||
                !manifest.modules ||
                Number(manifest.modules.length) !== MODULE_NAMES.length) {
            throw new Error("Invalid local module manifest");
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
                throw new Error("Invalid local module item: " + i);
            }
        }
        return manifest;
    }

    function checkpoint(value) {
        if (CHECKPOINT_FILE !== null) {
            writeJson(CHECKPOINT_FILE, value);
        }
    }

    function collectVersions(versions) {
        var output = {};
        var key;
        for (key in versions) {
            if (versions.hasOwnProperty(key)) {
                output[String(key)] = Number(versions[key]);
            }
        }
        return output;
    }

    function registeredCapabilities(SBH) {
        return {
            base: !!SBH.util,
            log: !!SBH.log,
            files: !!SBH.files,
            database: !!SBH.database,
            theme: !!SBH.theme,
            widgets: !!SBH.widgets,
            windowFactory: !!(
                SBH.window &&
                typeof SBH.window.createController === "function"
            ),
            navigation: !!SBH.navigation,
            home: !!SBH.home,
            subscriptions: !!SBH.subscriptions,
            nodes: !!SBH.nodes,
            runtimeLogs: !!SBH.runtimeLogs,
            automation: !!SBH.automation,
            runtimeClient: !!SBH.runtime,
            appStartRegistered: !!(
                SBH.app &&
                typeof SBH.app.start === "function"
            )
        };
    }

    function run() {
        var startedAt = now();
        var contextValue = getContext();
        var resolved = resolveRoot(contextValue);
        var root = resolved.root;
        var bootstrap = ensureDir(new File(root, "bootstrap"));
        var probeStateFile = new File(
            bootstrap,
            "module_probe_state.json"
        );
        var probeState = readJson(probeStateFile);
        var version = String(probeState.moduleSetVersion || "");
        var probeDir;
        var manifest;
        var SBH;
        var results = [];
        var source;
        var wrapped;
        var actualHash;
        var item;
        var moduleStartedAt;
        var databaseClosed = false;
        var databaseFileExists = false;
        var i;

        if (String(probeState.status || "") !== "module_probe_passed" ||
                Number(probeState.modulesDownloaded || 0) !== 15 ||
                Number(probeState.modulesCompiled || 0) !== 15 ||
                !version) {
            throw new Error(
                "A successful entryVersion 6 probe is required"
            );
        }

        probeDir = new File(
            new File(root, "modules/probe"),
            version
        );
        manifest = validateManifest(
            readJson(new File(probeDir, "module-manifest.json"))
        );

        if (String(manifest.moduleSetVersion) !== version) {
            throw new Error("Probe state and manifest version mismatch");
        }

        CHECKPOINT_FILE = new File(
            bootstrap,
            "module_eval_state.json"
        );

        SBH = {
            global: global,
            context: contextValue,
            state: {},
            services: {},
            versions: {},
            bootstrap: {
                project: PROJECT,
                entryVersion: ENTRY_VERSION,
                moduleSetVersion: version,
                sourceRef: EXPECTED_REF,
                storageMode: resolved.storageMode,
                safeMode: true
            },
            paths: {
                rootDir: root,
                bootstrapDir: bootstrap,
                modulesDir: ensureDir(new File(root, "modules")),
                setsDir: ensureDir(new File(root, "modules/sets")),
                dataDir: ensureDir(new File(root, "data")),
                cacheDir: ensureDir(new File(root, "cache")),
                logsDir: ensureDir(new File(root, "logs")),
                stateDir: ensureDir(new File(root, "state"))
            }
        };

        CURRENT_STAGE = "evaluation_start";
        checkpoint({
            schemaVersion: 1,
            entryVersion: ENTRY_VERSION,
            status: "running",
            stage: CURRENT_STAGE,
            moduleSetVersion: version,
            modulesEvaluated: 0,
            coordinatorStarted: false,
            windowOperationsEnabled: false,
            updatedAt: now()
        });

        for (i = 0; i < manifest.modules.length; i += 1) {
            item = manifest.modules[i];
            CURRENT_INDEX = i;
            CURRENT_NAME = String(item.name);
            moduleStartedAt = now();

            CURRENT_STAGE = "verify_local_module";
            checkpoint({
                schemaVersion: 1,
                entryVersion: ENTRY_VERSION,
                status: "running",
                stage: CURRENT_STAGE,
                moduleIndex: i,
                moduleName: CURRENT_NAME,
                completedCount: results.length,
                moduleSetVersion: version,
                coordinatorStarted: false,
                windowOperationsEnabled: false,
                updatedAt: now()
            });

            source = readUtf8(new File(probeDir, CURRENT_NAME));
            actualHash = sha256(source);
            if (actualHash !== String(item.sha256)) {
                throw new Error(
                    "Local SHA-256 mismatch: " + CURRENT_NAME
                );
            }

            CURRENT_STAGE = "evaluate_before";
            checkpoint({
                schemaVersion: 1,
                entryVersion: ENTRY_VERSION,
                status: "running",
                stage: CURRENT_STAGE,
                moduleIndex: i,
                moduleName: CURRENT_NAME,
                completedCount: results.length,
                moduleSetVersion: version,
                coordinatorStarted: false,
                windowOperationsEnabled: false,
                updatedAt: now()
            });

            wrapped =
                "(function (SBH) {\n" +
                source +
                "\n}(SBH));";
            eval(wrapped);

            CURRENT_STAGE = "evaluate_after";
            results.push({
                index: i,
                name: CURRENT_NAME,
                durationMs: now() - moduleStartedAt,
                registeredVersion: null
            });
            checkpoint({
                schemaVersion: 1,
                entryVersion: ENTRY_VERSION,
                status: "running",
                stage: CURRENT_STAGE,
                moduleIndex: i,
                moduleName: CURRENT_NAME,
                completedCount: results.length,
                moduleSetVersion: version,
                versions: collectVersions(SBH.versions),
                coordinatorStarted: false,
                windowOperationsEnabled: false,
                updatedAt: now()
            });
        }

        databaseFileExists = new File(
            SBH.paths.dataDir,
            "singboxhub.db"
        ).isFile();

        try {
            if (SBH.database &&
                    typeof SBH.database.open === "function") {
                var db = SBH.database.open();
                if (db !== null && db.isOpen()) {
                    db.close();
                    databaseClosed = true;
                }
            }
        } catch (databaseCloseError) {
            throw new Error(
                "Database close failed: " +
                errorText(databaseCloseError)
            );
        }

        CURRENT_STAGE = "complete";
        checkpoint({
            schemaVersion: 1,
            entryVersion: ENTRY_VERSION,
            status: "module_evaluation_passed",
            stage: CURRENT_STAGE,
            moduleSetVersion: version,
            modulesEvaluated: results.length,
            versions: collectVersions(SBH.versions),
            capabilities: registeredCapabilities(SBH),
            databaseFileExists: databaseFileExists,
            databaseClosed: databaseClosed,
            appStartInvoked: false,
            coordinatorStarted: false,
            receiverRegistered: false,
            viewsCreated: false,
            windowOperationsEnabled: false,
            completedAt: now()
        });

        return {
            ok: true,
            project: PROJECT,
            entryVersion: ENTRY_VERSION,
            started: false,
            status: "module_evaluation_passed",
            moduleSetVersion: version,
            safeMode: true,
            modulesDownloaded: 0,
            modulesCompiled: 0,
            modulesEvaluated: results.length,
            versions: collectVersions(SBH.versions),
            capabilities: registeredCapabilities(SBH),
            databaseFileExists: databaseFileExists,
            databaseClosed: databaseClosed,
            appStartRegistered: !!(
                SBH.app &&
                typeof SBH.app.start === "function"
            ),
            appStartInvoked: false,
            coordinatorStarted: false,
            receiverRegistered: false,
            viewsCreated: false,
            windowOperationsEnabled: false,
            runtimeAttached: false,
            destructiveOperations: false,
            checkpointPath: CHECKPOINT_FILE.getAbsolutePath(),
            probeDirectory: probeDir.getAbsolutePath(),
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
                status: "module_evaluation_failed",
                stage: CURRENT_STAGE,
                moduleIndex: CURRENT_INDEX,
                moduleName: CURRENT_NAME,
                appStartInvoked: false,
                coordinatorStarted: false,
                receiverRegistered: false,
                viewsCreated: false,
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
            status: "module_evaluation_failed",
            stage: CURRENT_STAGE,
            moduleIndex: CURRENT_INDEX,
            moduleName: CURRENT_NAME,
            safeMode: true,
            appStartInvoked: false,
            coordinatorStarted: false,
            receiverRegistered: false,
            viewsCreated: false,
            windowOperationsEnabled: false,
            runtimeAttached: false,
            destructiveOperations: false,
            error: errorText(fatal),
            timestamp: now()
        });
    }
}(this));
