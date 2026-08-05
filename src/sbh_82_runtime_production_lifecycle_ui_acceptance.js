/* SingBoxHub Stage55 production lifecycle UI acceptance packed module. Rhino ES5 only. */
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
