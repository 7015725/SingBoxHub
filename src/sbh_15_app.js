/* SingBoxHub app coordinator module. Rhino ES5 only. */
SBH.versions.app = 2;

(function () {
    var File = Packages.java.io.File;

    function start() {
        var endpointFile = new File(
            SBH.paths.cacheDir,
            "control_endpoint.json"
        );
        var statusFile = new File(
            SBH.paths.cacheDir,
            "ui_status.json"
        );
        var now = SBH.util.now();
        var status = {
            schemaVersion: 1,
            command: "safe_bootstrap",
            updatedAt: now,
            moduleSetVersion: SBH.bootstrap.moduleSetVersion,
            runtimeAttached: false,
            safeMode: true,
            coordinatorStarted: false,
            windowOperationsEnabled: false,
            uiVisible: false,
            attached: false,
            page: 0
        };

        /*
         * A previous device reboot may leave a stale endpoint file. Remove it
         * without broadcasting or touching WindowManager.
         */
        try {
            if (endpointFile.exists()) {
                endpointFile.delete();
            }
        } catch (ignoredDelete) {}

        SBH.files.writeJson(statusFile, status);

        SBH.global.__SBH_APP__ = {
            safeMode: true,
            stop: function () {
                return true;
            }
        };

        SBH.log.warn(
            "app",
            "Safe bootstrap active; coordinator and WindowManager are disabled"
        );

        return {
            ok: true,
            started: true,
            status: "safe_bootstrap_ready",
            safeMode: true,
            coordinatorStarted: false,
            windowOperationsEnabled: false,
            uiVisible: false,
            runtimeAttached: false,
            controlAction: null,
            controlEndpointPath: null,
            moduleSetVersion: SBH.bootstrap.moduleSetVersion
        };
    }

    SBH.app = {
        start: start
    };
}());
