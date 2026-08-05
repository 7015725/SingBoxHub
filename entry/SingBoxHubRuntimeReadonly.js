/*
 * SingBoxHub read-only Runtime UI bootstrap.
 * Builds on the verified entryVersion 12 bootstrap without modifying it.
 * ShortX / Rhino ES5.
 */
(function () {
    var P = Packages;
    var URL = P.java.net.URL;
    var BAOS = P.java.io.ByteArrayOutputStream;
    var ReflectArray = P.java.lang.reflect.Array;
    var JavaByte = P.java.lang.Byte;
    var JavaString = P.java.lang.String;
    var TEMPLATE_COMMIT = "42e99eff4bb92d14b04c43f6b1af7ce5b0b38387";
    var RUNTIME_REF = "agent/runtime-client-readonly-20260802";
    var TEMPLATE_URL = "https://raw.githubusercontent.com/7015725/SingBoxHub/" +
        TEMPLATE_COMMIT + "/entry/SingBoxHub.js";

    function closeQuietly(value) {
        try {
            if (value !== null && value !== undefined) {
                value.close();
            }
        } catch (ignored) {}
    }

    function readText() {
        var connection = null;
        var input = null;
        var output = new BAOS();
        var buffer = ReflectArray.newInstance(JavaByte.TYPE, 8192);
        var count;
        var code;
        try {
            connection = new URL(TEMPLATE_URL + "?runtime=13").openConnection();
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(30000);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept-Encoding", "identity");
            connection.setRequestProperty("Cache-Control", "no-cache");
            code = Number(connection.getResponseCode());
            input = code >= 200 && code < 300 ?
                connection.getInputStream() : connection.getErrorStream();
            while ((count = input.read(buffer)) >= 0) {
                if (count > 0) {
                    output.write(buffer, 0, count);
                }
            }
            if (code < 200 || code >= 300) {
                throw new Error("Template HTTP " + code);
            }
            return String(new JavaString(output.toByteArray(), "UTF-8"));
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
        "var ENTRY_VERSION = 12;",
        "var ENTRY_VERSION = 13;",
        "entry version"
    );
    source = replaceRequired(
        source,
        "var REF = \"agent/modular-ui-bootstrap-20260801\";",
        "var REF = \"" + RUNTIME_REF + "\";",
        "source ref"
    );
    source = replaceRequired(
        source,
        "        \"sbh_15_app.js\"\n    ];",
        "        \"sbh_15_app.js\",\n" +
            "        \"sbh_16_runtime_status_home.js\"\n" +
            "    ];",
        "module list"
    );

    return eval(source);
}());
