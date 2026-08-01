/* SingBoxHub app coordinator module. Rhino ES5 only. */
SBH.versions.app = 1;

(function () {
    var P = Packages;
    var Intent = P.android.content.Intent;
    var IntentFilter = P.android.content.IntentFilter;
    var BroadcastReceiver = P.android.content.BroadcastReceiver;
    var Context = P.android.content.Context;
    var File = P.java.io.File;

    function stopLegacyPrototype() {
        try {
            SBH.ctx.sendBroadcast(
                new Intent("com.singboxhub.prototype.UI_CLOSE")
            );
        } catch (ignored) {}
    }

    function readOldEndpoint() {
        return SBH.files.readJson(
            new File(SBH.paths.cacheDir, "control_endpoint.json"),
            null
        );
    }

    function stopOldCoordinator(endpoint) {
        var intent;
        if (!endpoint || !endpoint.action || !endpoint.token) {
            return;
        }
        try {
            intent = new Intent(String(endpoint.action));
            intent.setPackage(SBH.ctx.getPackageName());
            intent.putExtra("token", String(endpoint.token));
            intent.putExtra("command", "stop_ui");
            SBH.ctx.sendBroadcast(intent);
        } catch (error) {
            SBH.log.warn("app", "Old coordinator stop failed: " + error);
        }
    }

    function start() {
        var oldEndpoint = readOldEndpoint();
        var token = SBH.util.randomToken();
        var action = "com.singboxhub.control." + token;
        var endpointFile = new File(
            SBH.paths.cacheDir,
            "control_endpoint.json"
        );
        var statusFile = new File(
            SBH.paths.cacheDir,
            "ui_status.json"
        );
        var controller;
        var receiver;
        var stopped = false;

        stopLegacyPrototype();
        stopOldCoordinator(oldEndpoint);

        controller = SBH.window.createController();

        function writeStatus(command) {
            var status = controller.status();
            status.schemaVersion = 1;
            status.command = command || "status";
            status.updatedAt = SBH.util.now();
            status.moduleSetVersion = SBH.bootstrap.moduleSetVersion;
            status.runtimeAttached = SBH.runtime.attached;
            SBH.files.writeJson(statusFile, status);
            return status;
        }

        function stopCoordinator() {
            if (stopped) {
                return;
            }
            stopped = true;
            try {
                controller.stop();
            } catch (ignored1) {}
            try {
                SBH.ctx.unregisterReceiver(receiver);
            } catch (ignored2) {}
            try {
                var currentEndpoint = SBH.files.readJson(endpointFile, null);
                if (currentEndpoint &&
                        String(currentEndpoint.token || "") === token &&
                        endpointFile.exists()) {
                    endpointFile.delete();
                }
            } catch (ignored3) {}
            writeStatus("stop_ui");
            SBH.log.info("app", "Coordinator stopped");
        }

        receiver = new JavaAdapter(BroadcastReceiver, {
            onReceive: function (contextValue, intent) {
                var command;
                var receivedToken;
                if (intent === null) {
                    return;
                }
                receivedToken = String(intent.getStringExtra("token") || "");
                if (receivedToken !== token) {
                    SBH.log.warn("app", "Rejected control token");
                    return;
                }
                command = String(intent.getStringExtra("command") || "status");
                if (command === "show") {
                    controller.show();
                } else if (command === "hide") {
                    controller.hide();
                } else if (command === "toggle") {
                    controller.toggle();
                } else if (command === "status") {
                    writeStatus("status");
                } else if (command === "stop_ui") {
                    stopCoordinator();
                    return;
                }
                writeStatus(command);
            }
        });

        if (SBH.Build.VERSION.SDK_INT >= 33) {
            SBH.ctx.registerReceiver(
                receiver,
                new IntentFilter(action),
                Context.RECEIVER_NOT_EXPORTED
            );
        } else {
            SBH.ctx.registerReceiver(receiver, new IntentFilter(action));
        }

        SBH.files.writeJson(endpointFile, {
            schemaVersion: 1,
            action: action,
            token: token,
            commands: ["show", "hide", "toggle", "status", "stop_ui"],
            moduleSetVersion: SBH.bootstrap.moduleSetVersion,
            createdAt: SBH.util.now()
        });

        controller.onHidden = function () {
            writeStatus("hidden");
        };
        SBH.util.runUi(function () {
            controller.open();
            writeStatus("started");
        });

        SBH.global.__SBH_APP__ = {
            controller: controller,
            receiver: receiver,
            stop: stopCoordinator,
            action: action,
            token: token
        };

        SBH.log.ok("app", "Coordinator started");
        return {
            ok: true,
            started: true,
            uiVisible: true,
            runtimeAttached: false,
            controlAction: action,
            controlEndpointPath: endpointFile.getAbsolutePath(),
            moduleSetVersion: SBH.bootstrap.moduleSetVersion
        };
    }

    SBH.app = {
        start: start
    };
}());
