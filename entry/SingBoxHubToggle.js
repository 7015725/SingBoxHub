/*
 * SingBoxHub UI toggle command.
 * Run this as a separate ShortX ExecuteJS task.
 */
(function () {
    "use strict";

    var P = Packages;
    var File = P.java.io.File;
    var FIS = P.java.io.FileInputStream;
    var BAOS = P.java.io.ByteArrayOutputStream;
    var ReflectArray = P.java.lang.reflect.Array;
    var JavaByte = P.java.lang.Byte;
    var JavaString = P.java.lang.String;
    var Intent = P.android.content.Intent;
    var contextValue = null;

    function closeQuietly(value) {
        try {
            if (value) {
                value.close();
            }
        } catch (ignored) {}
    }

    function readUtf8(file) {
        var input = new FIS(file);
        var output = new BAOS();
        var buffer = ReflectArray.newInstance(JavaByte.TYPE, 4096);
        var count;
        try {
            while ((count = input.read(buffer)) >= 0) {
                if (count > 0) {
                    output.write(buffer, 0, count);
                }
            }
            return String(new JavaString(output.toByteArray(), "UTF-8"));
        } finally {
            closeQuietly(input);
            closeQuietly(output);
        }
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

    function findEndpoint(base, contextObject) {
        var candidates = [
            new File(base, "SingBoxHubClient/cache/control_endpoint.json"),
            new File(base, "SingBoxHub-UI/cache/control_endpoint.json")
        ];
        var filesDir = null;
        var i;
        try {
            filesDir = contextObject.getFilesDir();
        } catch (ignored) {}
        if (filesDir !== null) {
            candidates.push(new File(
                filesDir,
                "SingBoxHubClient/cache/control_endpoint.json"
            ));
        }
        for (i = 0; i < candidates.length; i += 1) {
            if (candidates[i].isFile()) {
                return candidates[i];
            }
        }
        return null;
    }

    contextValue = getContext();

    if (typeof shortx === "undefined" ||
            shortx === null ||
            typeof shortx.getShortXDir !== "function") {
        throw new Error("shortx.getShortXDir() unavailable");
    }

    var shortxDir = new File(String(shortx.getShortXDir()));
    var endpointFile = findEndpoint(shortxDir, contextValue);
    if (endpointFile === null) {
        return JSON.stringify({
            ok: false,
            sent: false,
            code: "COORDINATOR_NOT_RUNNING",
            message: "请先运行 SingBoxHub 主任务",
            searchedRoots: [
                new File(shortxDir, "SingBoxHubClient").getAbsolutePath(),
                new File(shortxDir, "SingBoxHub-UI").getAbsolutePath()
            ]
        });
    }

    var endpoint = JSON.parse(readUtf8(endpointFile));
    var intent = new Intent(String(endpoint.action));
    intent.setPackage(contextValue.getPackageName());
    intent.putExtra("token", String(endpoint.token));
    intent.putExtra("command", "toggle");
    contextValue.sendBroadcast(intent);

    return JSON.stringify({
        ok: true,
        sent: true,
        command: "toggle",
        moduleSetVersion: endpoint.moduleSetVersion,
        endpointPath: endpointFile.getAbsolutePath()
    });
}());
