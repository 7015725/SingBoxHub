/*
 * SingBoxHub Stage 38: manual subscription fetch and format probe.
 * Uses one pinned module commit for manifest and all modules.
 * ShortX / Rhino ES5.
 */
(function () {
    "use strict";

    var P = Packages;
    var URL = P.java.net.URL;
    var BAOS = P.java.io.ByteArrayOutputStream;
    var ReflectArray = P.java.lang.reflect.Array;
    var JavaByte = P.java.lang.Byte;
    var JavaString = P.java.lang.String;

    var TEMPLATE_COMMIT =
        "333bf86c051f746e1843bdf7ef9d4f2967a7fa52";
    var TEMPLATE_URL =
        "https://raw.githubusercontent.com/7015725/SingBoxHub/" +
        TEMPLATE_COMMIT + "/entry/SingBoxHub.js";

    var OLD_MODULE_BLOCK = [
        "    var MODULE_NAMES = [",
        "        \"sbh_01_base.js\",",
        "        \"sbh_02_log.js\",",
        "        \"sbh_03_files.js\",",
        "        \"sbh_04_database.js\",",
        "        \"sbh_05_theme.js\",",
        "        \"sbh_06_widgets.js\",",
        "        \"sbh_07_window.js\",",
        "        \"sbh_08_navigation.js\",",
        "        \"sbh_09_home.js\",",
        "        \"sbh_10_subscriptions.js\",",
        "        \"sbh_11_nodes.js\",",
        "        \"sbh_12_runtime_logs.js\",",
        "        \"sbh_13_automation.js\",",
        "        \"sbh_14_runtime_client.js\",",
        "        \"sbh_15_app.js\",",
        "        \"sbh_16_runtime_status_home.js\"",
        "    ];"
    ].join("\n");

    var NEW_MODULE_BLOCK = [
        "    var MODULE_NAMES = [",
        "        \"sbh_01_base.js\",",
        "        \"sbh_02_log.js\",",
        "        \"sbh_03_files.js\",",
        "        \"sbh_04_database.js\",",
        "        \"sbh_05_theme.js\",",
        "        \"sbh_06_widgets.js\",",
        "        \"sbh_07_window.js\",",
        "        \"sbh_08_navigation.js\",",
        "        \"sbh_09_home.js\",",
        "        \"sbh_10_subscriptions.js\",",
        "        \"sbh_11_nodes.js\",",
        "        \"sbh_12_runtime_logs.js\",",
        "        \"sbh_13_automation.js\",",
        "        \"sbh_14_runtime_client.js\",",
        "        \"sbh_15_app.js\",",
        "        \"sbh_16_runtime_status_home.js\",",
        "        \"sbh_30_runtime_authenticated_status_adapter.js\",",
        "        \"sbh_33_window_explicit_geometry.js\",",
        "        \"sbh_34_runtime_startup_ui_finalizer.js\",",
        "        \"sbh_35_runtime_sync_ui_actions.js\",",
        "        \"sbh_42_inline_feedback.js\",",
        "        \"sbh_43_subscription_repository.js\",",
        "        \"sbh_45_subscription_fetch_probe.js\",",
        "        \"sbh_44_subscription_crud_ui.js\"",
        "    ];"
    ].join("\n");

    function closeQuietly(value) {
        try {
            if (value !== null && value !== undefined) {
                value.close();
            }
        } catch (ignoredClose) {}
    }

    function readText() {
        var connection = null;
        var input = null;
        var output = new BAOS();
        var buffer = ReflectArray.newInstance(JavaByte.TYPE, 8192);
        var count;
        var code;

        try {
            connection = new URL(
                TEMPLATE_URL + "?stage38=" +
                String(P.java.lang.System.currentTimeMillis())
            ).openConnection();
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(30000);
            connection.setUseCaches(false);
            connection.setRequestProperty(
                "Accept-Encoding",
                "identity"
            );
            connection.setRequestProperty(
                "Cache-Control",
                "no-cache"
            );
            code = Number(connection.getResponseCode());
            input = code >= 200 && code < 300 ?
                connection.getInputStream() :
                connection.getErrorStream();

            while ((count = input.read(buffer)) >= 0) {
                if (count > 0) {
                    output.write(buffer, 0, count);
                }
            }

            if (code < 200 || code >= 300) {
                throw new Error("Template HTTP " + code);
            }

            return String(new JavaString(
                output.toByteArray(),
                "UTF-8"
            ));
        } finally {
            closeQuietly(input);
            closeQuietly(output);
            try {
                if (connection !== null) {
                    connection.disconnect();
                }
            } catch (ignoredDisconnect) {}
        }
    }

    function replaceRequired(source, before, after, name) {
        if (source.indexOf(before) < 0) {
            throw new Error("Template marker missing: " + name);
        }
        return source.replace(before, after);
    }

    var source = readText();

    source = replaceRequired(
        source,
        "var ENTRY_VERSION = 14;",
        "var ENTRY_VERSION = 51;",
        "entry version"
    );
    source = replaceRequired(
        source,
        OLD_MODULE_BLOCK,
        NEW_MODULE_BLOCK,
        "clean module list"
    );
    source = replaceRequired(
        source,
        "var RAW_BASE = \"https://raw.githubusercontent.com/7015725/SingBoxHub/\" + REF + \"/\";",
        "var RAW_BASE = \"https://raw.githubusercontent.com/7015725/SingBoxHub/26e81297e43016c12fe699851732aa55aa0354eb/\";",
        "pinned module commit"
    );
    source = replaceRequired(
        source,
        [
            "        } catch (syncError) {",
            "            syncInfo.warning = errorText(syncError);",
            "            candidate = pointerVersion(active) || pointerVersion(lastGood);",
            "        }"
        ].join("\n"),
        [
            "        } catch (syncError) {",
            "            syncInfo.warning = errorText(syncError);",
            "            throw new Error(\"Strict module sync failed: \" + syncInfo.warning);",
            "        }"
        ].join("\n"),
        "disable sync fallback"
    );
    source = replaceRequired(
        source,
        [
            "        try {",
            "            loaded = loadSet(paths, candidate, ctx, syncInfo);",
            "        } catch (loadError) {",
            "            fallback = pointerVersion(lastGood);",
            "            if (!fallback || fallback === candidate) {",
            "                throw loadError;",
            "            }",
            "            syncInfo.fallback = true;",
            "            syncInfo.warning = errorText(loadError);",
            "            candidate = fallback;",
            "            loaded = loadSet(paths, candidate, ctx, syncInfo);",
            "        }"
        ].join("\n"),
        [
            "        try {",
            "            loaded = loadSet(paths, candidate, ctx, syncInfo);",
            "        } catch (loadError) {",
            "            syncInfo.warning = errorText(loadError);",
            "            throw new Error(\"Strict module load failed: \" + syncInfo.warning);",
            "        }"
        ].join("\n"),
        "disable load fallback"
    );

    var rawResult = eval(source);
    var result = typeof rawResult === "string" ?
        JSON.parse(String(rawResult)) : rawResult;
    result.stage = "subscription_stage38_manual_fetch_probe";
    result.strictModuleActivation = true;
    result.subscriptionStage = 38;
    result.subscriptionCrudExpected = true;
    result.subscriptionFetchExpected = true;
    result.subscriptionFetchManualOnly = true;
    result.subscriptionFetchAutomaticRetry = false;
    result.subscriptionFetchRawBodyPersisted = false;
    result.subscriptionDownloadEnabled = true;
    result.subscriptionDownloadAutomatic = false;
    result.subscriptionRuntimeWriteEnabled = false;
    result.fallbackAllowed = false;
    result.systemBackDeferred = true;
    result.systemBackBlocking = false;
    result.customEdgeGestureInstalled = false;
    result.closeButtonRetained = true;
    result.moduleFetchMode = "single_commit_pinned";
    result.pinnedModuleCommit =
        "26e81297e43016c12fe699851732aa55aa0354eb";
    result.expectedModuleSetVersion = "20260803.12";
    result.expectedModuleCount = 24;
    result.expectedLastModule = "sbh_44_subscription_crud_ui.js";
    result.moduleSetActivated =
        result.ok === true &&
        String(result.moduleSetVersion || "") === "20260803.12" &&
        result.sync &&
        result.sync.warning === null &&
        result.sync.fallback === false;
    return JSON.stringify(result);
}());
