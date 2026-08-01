/* SingBoxHub base module. Rhino ES5 only. */
SBH.versions.base = 1;

(function () {
    var P = Packages;
    var Build = P.android.os.Build;
    var Color = P.android.graphics.Color;
    var Handler = P.android.os.Handler;
    var Looper = P.android.os.Looper;
    var System = P.java.lang.System;

    SBH.P = P;
    SBH.Build = Build;
    SBH.Color = Color;
    SBH.handler = new Handler(Looper.getMainLooper());
    SBH.ctx = SBH.context;
    SBH.density = Number(SBH.ctx.getResources().getDisplayMetrics().density || 1);

    SBH.util = {
        now: function () {
            return Number(System.currentTimeMillis());
        },

        dp: function (value) {
            if (Number(value) === 0) {
                return 0;
            }
            return Math.max(1, Math.round(Number(value) * SBH.density));
        },

        color: function (value) {
            return Color.parseColor(String(value));
        },

        errorText: function (error) {
            try {
                if (error && error.javaException) {
                    return String(error.javaException.getClass().getName()) +
                        ": " + String(error);
                }
            } catch (ignored) {}
            return String(error);
        },

        runUi: function (fn) {
            if (Looper.myLooper() === Looper.getMainLooper()) {
                return fn();
            }
            SBH.handler.post(new JavaAdapter(P.java.lang.Runnable, {
                run: function () {
                    try {
                        fn();
                    } catch (error) {
                        try {
                            SBH.log.error("ui", error);
                        } catch (ignored) {}
                    }
                }
            }));
            return null;
        },

        toast: function (message) {
            try {
                P.android.widget.Toast.makeText(
                    SBH.ctx,
                    String(message),
                    P.android.widget.Toast.LENGTH_SHORT
                ).show();
            } catch (ignored) {}
        },

        randomToken: function () {
            var uuid = String(P.java.util.UUID.randomUUID().toString())
                .replace(/[^A-Za-z0-9]/g, "");
            return String(SBH.util.now()) + uuid;
        }
    };
}());
