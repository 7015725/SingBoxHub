/* SingBoxHub base module. Rhino ES5 only. */
SBH.versions.base = 2;

(function () {
    var P = Packages;
    var Build = P.android.os.Build;
    var Color = P.android.graphics.Color;
    var Handler = P.android.os.Handler;
    var Looper = P.android.os.Looper;
    var Runnable = P.java.lang.Runnable;
    var Thread = P.java.lang.Thread;
    var System = P.java.lang.System;
    var backgroundSequence = 0;

    SBH.P = P;
    SBH.Build = Build;
    SBH.Color = Color;
    SBH.handler = new Handler(Looper.getMainLooper());
    SBH.ctx = SBH.context;
    SBH.density = Number(
        SBH.ctx.getResources().getDisplayMetrics().density || 1
    );

    function errorText(error) {
        try {
            if (error && error.javaException) {
                return String(error.javaException.getClass().getName()) +
                    ": " + String(error);
            }
        } catch (ignored) {}
        return String(error);
    }

    function runUi(fn) {
        if (Looper.myLooper() === Looper.getMainLooper()) {
            return fn();
        }
        SBH.handler.post(new JavaAdapter(Runnable, {
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
    }

    function runBg(fn, callback, name) {
        var sequence = backgroundSequence + 1;
        var thread;
        backgroundSequence = sequence;
        thread = new Thread(
            new JavaAdapter(Runnable, {
                run: function () {
                    var startedAt = Number(System.currentTimeMillis());
                    var value = null;
                    var failure = null;
                    try {
                        value = fn();
                    } catch (error) {
                        failure = error;
                    }
                    if (typeof callback === "function") {
                        runUi(function () {
                            callback(
                                value,
                                failure,
                                Number(System.currentTimeMillis()) - startedAt
                            );
                        });
                    } else if (failure !== null) {
                        try {
                            SBH.log.error("background", failure);
                        } catch (ignoredLog) {}
                    }
                }
            }),
            String(name || "SingBoxHub-bg") + "-" + String(sequence)
        );
        try {
            thread.setDaemon(true);
        } catch (ignoredDaemon) {}
        thread.start();
        return thread;
    }

    SBH.util = {
        now: function () {
            return Number(System.currentTimeMillis());
        },

        dp: function (value) {
            if (Number(value) === 0) {
                return 0;
            }
            return Math.max(
                1,
                Math.round(Number(value) * SBH.density)
            );
        },

        color: function (value) {
            return Color.parseColor(String(value));
        },

        errorText: errorText,

        isUiThread: function () {
            return Looper.myLooper() === Looper.getMainLooper();
        },

        runUi: runUi,

        runBg: runBg,

        toast: function (message) {
            runUi(function () {
                try {
                    P.android.widget.Toast.makeText(
                        SBH.ctx,
                        String(message),
                        P.android.widget.Toast.LENGTH_SHORT
                    ).show();
                } catch (ignored) {}
            });
        },

        randomToken: function () {
            var uuid = String(P.java.util.UUID.randomUUID().toString())
                .replace(/[^A-Za-z0-9]/g, "");
            return String(SBH.util.now()) + uuid;
        }
    };
}());
