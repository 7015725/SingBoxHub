/* SingBoxHub Monet theme module. Rhino ES5 only. */
SBH.versions.theme = 1;

(function () {
    var GradientDrawable = Packages.android.graphics.drawable.GradientDrawable;
    var ReflectArray = Packages.java.lang.reflect.Array;
    var JavaInt = Packages.java.lang.Integer;
    var C = {
        bg: "#F7F8FA",
        surface: "#FCFDFE",
        surfaceAlt: "#F3F6F8",
        navy: "#14213D",
        text: "#33415C",
        secondary: "#7B879C",
        line: "#E2E7EC",
        green: "#3C9B78",
        greenSoft: "#E9F5EF",
        blue: "#4A79C9",
        blueSoft: "#EAF0FA",
        purple: "#7668B8",
        purpleSoft: "#F0EDFA",
        orange: "#C47A43",
        orangeSoft: "#FAEFE7",
        coral: "#BD665F",
        coralSoft: "#F9ECEB",
        cyan: "#4B9B9A",
        cyanSoft: "#E9F5F4",
        white: "#FFFFFFFF",
        clear: "#00000000"
    };

    function intArray(values) {
        var result = ReflectArray.newInstance(JavaInt.TYPE, values.length);
        var i;
        for (i = 0; i < values.length; i += 1) {
            result[i] = values[i];
        }
        return result;
    }

    function rounded(fill, radius, stroke, strokeWidth) {
        var drawable = new GradientDrawable();
        drawable.setColor(SBH.util.color(fill));
        drawable.setCornerRadius(SBH.util.dp(radius));
        if (stroke && Number(strokeWidth || 0) > 0) {
            drawable.setStroke(
                SBH.util.dp(strokeWidth),
                SBH.util.color(stroke)
            );
        }
        return drawable;
    }

    function gradient(colors, radius, stroke) {
        var values = [];
        var i;
        var drawable;
        for (i = 0; i < colors.length; i += 1) {
            values.push(SBH.util.color(colors[i]));
        }
        drawable = new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            intArray(values)
        );
        drawable.setCornerRadius(SBH.util.dp(radius));
        if (stroke) {
            drawable.setStroke(SBH.util.dp(1), SBH.util.color(stroke));
        }
        return drawable;
    }

    SBH.theme = {
        colors: C,
        rounded: rounded,
        gradient: gradient
    };
}());
