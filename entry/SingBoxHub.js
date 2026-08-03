/*
 * SingBoxHub Stage 43: in-memory candidate config preflight.
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
        "        \"sbh_46_subscription_node_catalog.js\",",
        "        \"sbh_47_credential_vault.js\",",
        "        \"sbh_44_subscription_crud_ui.js\",",
        "        \"sbh_48_credential_vault_ui.js\",",
        "        \"sbh_49_subscription_credential_import.js\",",
        "        \"sbh_50_subscription_credential_import_ui.js\",",
        "        \"sbh_51_credential_coverage_audit.js\",",
        "        \"sbh_52_credential_coverage_audit_ui.js\",",
        "        \"sbh_53_candidate_config_preflight.js\",",
        "        \"sbh_54_candidate_config_preflight_ui.js\"",
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
                TEMPLATE_URL + "?stage43=" +
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
        "var ENTRY_VERSION = 56;",
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
        "var RAW_BASE = \"https://raw.githubusercontent.com/7015725/SingBoxHub/a0a8f12606effe45985ceb5b80a0c3341504e5ef/\";",
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
    result.stage = "credential_stage43_candidate_config_preflight";
    result.strictModuleActivation = true;
    result.subscriptionStage = 43;
    result.credentialStage = 43;
    result.subscriptionCrudExpected = true;
    result.subscriptionFetchExpected = true;
    result.subscriptionFetchManualOnly = true;
    result.subscriptionFetchAutomaticRetry = false;
    result.subscriptionFetchRawBodyPersisted = false;
    result.subscriptionNodeCatalogExpected = true;
    result.credentialVaultExpected = true;
    result.subscriptionCredentialImportExpected = true;
    result.credentialCoverageAuditExpected = true;
    result.candidateConfigPreflightExpected = true;
    result.candidateConfigPreflightManualOnly = true;
    result.candidateConfigPersisted = false;
    result.candidateConfigBinaryCheckInvoked = false;
    result.candidateConfigRuntimeUsable = false;
    result.credentialCoverageAuditPlaintextRead = false;
    result.credentialCoverageAuditNetworkAccessed = false;
    result.subscriptionCredentialImportManualOnly = true;
    result.subscriptionCredentialPlaintextPersisted = false;
    result.subscriptionCredentialsRuntimeUsable = false;
    result.credentialVaultSelfTestManualOnly = true;
    result.credentialVaultRealCredentialImportEnabled = false;
    result.credentialVaultPlaintextDisplayEnabled = false;
    result.subscriptionNodeCredentialsPersisted = false;
    result.subscriptionNodesRuntimeUsable = false;
    result.subscriptionNodeImportManualOnly = true;
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
        "a0a8f12606effe45985ceb5b80a0c3341504e5ef";
    result.expectedModuleSetVersion = "20260803.17";
    result.expectedModuleCount = 33;
    result.expectedLastModule = "sbh_54_candidate_config_preflight_ui.js";
    result.moduleSetActivated =
        result.ok === true &&
        String(result.moduleSetVersion || "") === "20260803.17" &&
        result.sync &&
        result.sync.warning === null &&
        result.sync.fallback === false;
    return JSON.stringify(result);
}());
