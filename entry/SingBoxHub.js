/*
 * SingBoxHub ShortX entry scaffold.
 *
 * Runtime startup is intentionally disabled in the repository baseline.
 * This file performs no shell execution, TUN creation, route changes,
 * WindowManager operations, native loading, or persistent process startup.
 *
 * Rhino compatibility: strict ES5 only.
 */
(function () {
    "use strict";

    var PROJECT_NAME = "SingBoxHub";
    var ENTRY_VERSION = 1;
    var MODULE_SET_VERSION = "repository-scaffold-20260731.01";

    function nowMillis() {
        return new Date().getTime();
    }

    function buildResult() {
        return {
            ok: true,
            project: PROJECT_NAME,
            entryVersion: ENTRY_VERSION,
            moduleSetVersion: MODULE_SET_VERSION,
            started: false,
            status: "scaffold_only",
            runtimeAttached: false,
            coreRunning: false,
            destructiveOperations: false,
            timestamp: nowMillis(),
            message: "Repository scaffold initialized; production Runtime modules are not bundled."
        };
    }

    return JSON.stringify(buildResult());
}());
