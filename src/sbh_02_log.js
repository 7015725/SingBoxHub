/* SingBoxHub log module. Rhino ES5 only. */
SBH.versions.log = 1;

(function () {
    var memory = [];

    function push(level, message, moduleName) {
        var item = {
            at: SBH.util.now(),
            level: String(level || "INFO"),
            message: String(message || ""),
            module: String(moduleName || "app")
        };
        memory.push(item);
        while (memory.length > 160) {
            memory.shift();
        }
        return item;
    }

    SBH.log = {
        push: push,

        info: function (moduleName, message) {
            return push("INFO", message, moduleName);
        },

        ok: function (moduleName, message) {
            return push("OK", message, moduleName);
        },

        warn: function (moduleName, message) {
            return push("WARN", message, moduleName);
        },

        error: function (moduleName, error) {
            return push("ERROR", SBH.util.errorText(error), moduleName);
        },

        list: function () {
            return memory.slice(0);
        }
    };

    push("INFO", "Rhino ES5 modules loaded", "bootstrap");
}());
