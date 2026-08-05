/* SingBoxHub Stage56 production lifecycle write unlock packed module. Rhino ES5 only. */
(function () {
    "use strict";

    var P = Packages;
    var Base64 = P.android.util.Base64;
    var ByteArrayInputStream = P.java.io.ByteArrayInputStream;
    var ByteArrayOutputStream = P.java.io.ByteArrayOutputStream;
    var GZIPInputStream = P.java.util.zip.GZIPInputStream;
    var ReflectArray = P.java.lang.reflect.Array;
    var JavaByte = P.java.lang.Byte;
    var JavaString = P.java.lang.String;
    var DATA =
        "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";
    var compressed = null;
    var input = null;
    var output = null;
    var buffer = null;
    var count;
    var source = null;

    try {
        compressed = Base64.decode(DATA, Base64.DEFAULT);
        input = new GZIPInputStream(
            new ByteArrayInputStream(compressed)
        );
        output = new ByteArrayOutputStream();
        buffer = ReflectArray.newInstance(JavaByte.TYPE, 4096);
        while ((count = input.read(buffer)) > 0) {
            output.write(buffer, 0, count);
        }
        source = String(
            new JavaString(output.toByteArray(), "UTF-8")
        );
        eval(source);
    } finally {
        try {
            if (input !== null) {
                input.close();
            }
        } catch (ignoredInput) {}
        try {
            if (output !== null) {
                output.close();
            }
        } catch (ignoredOutput) {}
        compressed = null;
        buffer = null;
        source = null;
    }
}());
