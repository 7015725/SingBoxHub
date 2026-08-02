/*
 * SingBoxHub Stage 34: stabilized read-only UI module-set entry.
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
        "        \"sbh_42_inline_feedback.js\"",
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
                TEMPLATE_URL + "?stage34=" +
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
        "var ENTRY_VERSION = 47;",
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
        "var RAW_BASE = \"https://raw.githubusercontent.com/7015725/SingBoxHub/71fce85a6f63d8ceb71c1c5110010fc65386401f/\";",
        "pinned module commit"
    );

    var result = eval(source);
    if (result && typeof result === "object") {
        result.stage = "runtime_stage34_stabilized_readonly_ui";
        result.systemBackDeferred = true;
        result.systemBackBlocking = false;
        result.customEdgeGestureInstalled = false;
        result.closeButtonRetained = true;
        result.moduleFetchMode = "single_commit_pinned";
        result.pinnedModuleCommit =
            "71fce85a6f63d8ceb71c1c5110010fc65386401f";
        result.expectedModuleSetVersion = "20260803.10";
        result.expectedModuleCount = 21;
    }
    return result;
}());
