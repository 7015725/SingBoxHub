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

    try {
        if (typeof context !== "undefined" && context !== null) {
            contextValue = context;
        }
    } catch (ignored1) {}
    if (contextValue === null) {
        try {
            contextValue = P.android.app.ActivityThread.currentApplication();
        } catch (ignored2) {}
    }
    if (contextValue === null) {
        throw new Error("Android Context unavailable");
    }
    try {
        contextValue = contextValue.getApplicationContext() || contextValue;
    } catch (ignored3) {}

    if (typeof shortx === "undefined" ||
            shortx === null ||
            typeof shortx.getShortXDir !== "function") {
        throw new Error("shortx.getShortXDir() unavailable");
    }

    var endpointFile = new File(
        String(shortx.getShortXDir()),
        "SingBoxHub/cache/control_endpoint.json"
    );
    if (!endpointFile.isFile()) {
        return JSON.stringify({
            ok: false,
            sent: false,
            code: "COORDINATOR_NOT_RUNNING",
            message: "请先运行 SingBoxHub 主任务"
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
        moduleSetVersion: endpoint.moduleSetVersion
    });
}());
