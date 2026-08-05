/* SingBoxHub Stage37 subscription repository. Rhino ES5 only. */
SBH.versions.subscriptionRepository = 1;

(function () {
    "use strict";

    var P = Packages;
    var URL = P.java.net.URL;
    var URI = P.java.net.URI;
    var originalStart = SBH.app.start;
    var TABLE = "subscriptions";
    var SCHEMA_VERSION = 1;
    var MAX_NAME = 64;
    var MAX_URL = 2048;
    var MAX_REMARK = 256;
    var schemaEnsured = false;
    var schemaCreated = false;

    function text(value) {
        return String(
            value === null || value === undefined ?
                "" : value
        );
    }

    function trim(value) {
        return text(value).replace(/^\s+|\s+$/g, "");
    }

    function closeQuietly(value) {
        try {
            if (value !== null && value !== undefined) {
                value.close();
            }
        } catch (ignored) {}
    }

    function tableExists() {
        var cursor = null;
        try {
            cursor = SBH.database.open().rawQuery(
                "SELECT name FROM sqlite_master " +
                "WHERE type='table' AND name=? LIMIT 1",
                [TABLE]
            );
            return cursor.moveToFirst();
        } finally {
            closeQuietly(cursor);
        }
    }

    function ensureSchema() {
        var existed = tableExists();
        var db = SBH.database.open();

        db.execSQL(
            "CREATE TABLE IF NOT EXISTS subscriptions (" +
            "id INTEGER PRIMARY KEY AUTOINCREMENT," +
            "name TEXT NOT NULL," +
            "url TEXT NOT NULL COLLATE NOCASE UNIQUE," +
            "enabled INTEGER NOT NULL DEFAULT 1," +
            "remark TEXT NOT NULL DEFAULT ''," +
            "node_count INTEGER NOT NULL DEFAULT 0," +
            "last_checked_at INTEGER," +
            "last_error TEXT," +
            "created_at INTEGER NOT NULL," +
            "updated_at INTEGER NOT NULL)"
        );
        db.execSQL(
            "CREATE INDEX IF NOT EXISTS " +
            "idx_subscriptions_updated_at " +
            "ON subscriptions(updated_at DESC, id DESC)"
        );
        schemaEnsured = true;
        schemaCreated = !existed;
        return true;
    }

    function validateUrl(value) {
        var urlText = trim(value);
        var parsed;
        var uri;
        var protocol;
        var host;

        if (!urlText || urlText.length > MAX_URL) {
            throw new Error("订阅地址长度无效");
        }

        parsed = new URL(urlText);
        protocol = String(parsed.getProtocol() || "")
            .toLowerCase();
        host = String(parsed.getHost() || "");

        if (protocol !== "https" && protocol !== "http") {
            throw new Error("订阅地址仅支持 HTTP 或 HTTPS");
        }
        if (!host) {
            throw new Error("订阅地址缺少主机名");
        }

        uri = new URI(urlText);
        if (uri.getUserInfo() !== null) {
            throw new Error("订阅地址不能包含用户名或密码");
        }

        return urlText;
    }

    function normalize(input) {
        var value = input || {};
        var name = trim(value.name);
        var url = validateUrl(value.url);
        var remark = trim(value.remark);
        var enabled = value.enabled === false ? 0 : 1;

        if (!name || name.length > MAX_NAME) {
            throw new Error("订阅名称长度应为 1–64 个字符");
        }
        if (remark.length > MAX_REMARK) {
            throw new Error("备注不能超过 256 个字符");
        }

        return {
            name: name,
            url: url,
            remark: remark,
            enabled: enabled
        };
    }

    function rowFromCursor(cursor) {
        return {
            id: Number(cursor.getLong(0)),
            name: String(cursor.getString(1)),
            url: String(cursor.getString(2)),
            enabled: Number(cursor.getInt(3)) === 1,
            remark: String(cursor.getString(4) || ""),
            nodeCount: Number(cursor.getLong(5)),
            lastCheckedAt: cursor.isNull(6) ?
                null : Number(cursor.getLong(6)),
            lastError: cursor.isNull(7) ?
                null : String(cursor.getString(7)),
            createdAt: Number(cursor.getLong(8)),
            updatedAt: Number(cursor.getLong(9))
        };
    }

    function list() {
        var cursor = null;
        var rows = [];
        ensureSchema();

        try {
            cursor = SBH.database.open().rawQuery(
                "SELECT id,name,url,enabled,remark,node_count," +
                "last_checked_at,last_error,created_at,updated_at " +
                "FROM subscriptions " +
                "ORDER BY updated_at DESC,id DESC",
                []
            );
            while (cursor.moveToNext()) {
                rows.push(rowFromCursor(cursor));
            }
            return rows;
        } finally {
            closeQuietly(cursor);
        }
    }

    function get(id) {
        var cursor = null;
        ensureSchema();

        try {
            cursor = SBH.database.open().rawQuery(
                "SELECT id,name,url,enabled,remark,node_count," +
                "last_checked_at,last_error,created_at,updated_at " +
                "FROM subscriptions WHERE id=? LIMIT 1",
                [String(Number(id))]
            );
            return cursor.moveToFirst() ?
                rowFromCursor(cursor) : null;
        } finally {
            closeQuietly(cursor);
        }
    }

    function create(input) {
        var value = normalize(input);
        var statement = null;
        var timestamp = SBH.util.now();
        var id;

        ensureSchema();

        try {
            statement = SBH.database.open().compileStatement(
                "INSERT INTO subscriptions(" +
                "name,url,enabled,remark,node_count," +
                "last_checked_at,last_error,created_at,updated_at" +
                ") VALUES(?,?,?,?,0,NULL,NULL,?,?)"
            );
            statement.bindString(1, value.name);
            statement.bindString(2, value.url);
            statement.bindLong(3, value.enabled);
            statement.bindString(4, value.remark);
            statement.bindLong(5, timestamp);
            statement.bindLong(6, timestamp);
            id = Number(statement.executeInsert());
            if (id <= 0) {
                throw new Error("订阅记录写入失败");
            }
            return get(id);
        } catch (error) {
            if (/UNIQUE|constraint/i.test(String(error))) {
                throw new Error("该订阅地址已经存在");
            }
            throw error;
        } finally {
            closeQuietly(statement);
        }
    }

    function update(id, input) {
        var value = normalize(input);
        var statement = null;
        var changed;

        ensureSchema();

        if (get(id) === null) {
            throw new Error("订阅记录不存在");
        }

        try {
            statement = SBH.database.open().compileStatement(
                "UPDATE subscriptions SET " +
                "name=?,url=?,enabled=?,remark=?,updated_at=? " +
                "WHERE id=?"
            );
            statement.bindString(1, value.name);
            statement.bindString(2, value.url);
            statement.bindLong(3, value.enabled);
            statement.bindString(4, value.remark);
            statement.bindLong(5, SBH.util.now());
            statement.bindLong(6, Number(id));
            changed = Number(statement.executeUpdateDelete());
            if (changed !== 1) {
                throw new Error("订阅记录更新失败");
            }
            return get(id);
        } catch (error) {
            if (/UNIQUE|constraint/i.test(String(error))) {
                throw new Error("该订阅地址已经存在");
            }
            throw error;
        } finally {
            closeQuietly(statement);
        }
    }

    function setEnabled(id, enabled) {
        var statement = null;
        var changed;

        ensureSchema();

        try {
            statement = SBH.database.open().compileStatement(
                "UPDATE subscriptions SET enabled=?,updated_at=? " +
                "WHERE id=?"
            );
            statement.bindLong(1, enabled === true ? 1 : 0);
            statement.bindLong(2, SBH.util.now());
            statement.bindLong(3, Number(id));
            changed = Number(statement.executeUpdateDelete());
            if (changed !== 1) {
                throw new Error("订阅记录不存在");
            }
            return get(id);
        } finally {
            closeQuietly(statement);
        }
    }

    function remove(id) {
        var statement = null;
        var changed;

        ensureSchema();

        try {
            statement = SBH.database.open().compileStatement(
                "DELETE FROM subscriptions WHERE id=?"
            );
            statement.bindLong(1, Number(id));
            changed = Number(statement.executeUpdateDelete());
            return changed === 1;
        } finally {
            closeQuietly(statement);
        }
    }

    function count() {
        var cursor = null;
        ensureSchema();

        try {
            cursor = SBH.database.open().rawQuery(
                "SELECT COUNT(*) FROM subscriptions",
                []
            );
            return cursor.moveToFirst() ?
                Number(cursor.getLong(0)) : 0;
        } finally {
            closeQuietly(cursor);
        }
    }

    function safeSource(row) {
        var uri = new URI(String(row.url));
        var scheme = String(uri.getScheme() || "");
        var host = String(uri.getHost() || "");
        var port = Number(uri.getPort());
        var path = String(uri.getRawPath() || "/");
        var queryPresent = uri.getRawQuery() !== null;
        var portText = port >= 0 ? ":" + port : "";

        return {
            scheme: scheme,
            host: host,
            port: port >= 0 ? port : null,
            path: path,
            queryPresent: queryPresent,
            queryMasked: queryPresent,
            displayUrl:
                scheme + "://" + host + portText + path +
                (queryPresent ? "?<masked>" : "")
        };
    }

    function preview(id) {
        var row = get(id);
        var source;

        if (row === null) {
            throw new Error("订阅记录不存在");
        }

        source = safeSource(row);

        return {
            schemaVersion: 1,
            mode: "readonly_subscription_preview",
            subscription: {
                id: row.id,
                name: row.name,
                enabled: row.enabled,
                remark: row.remark,
                source: source,
                nodeCount: row.nodeCount,
                lastCheckedAt: row.lastCheckedAt,
                lastError: row.lastError
            },
            plannedActions: {
                downloadSubscription: false,
                parseNodes: false,
                writeRuntimeConfig: false,
                reloadRuntime: false,
                startCore: false,
                createTun: false,
                modifyRoutes: false
            },
            networkAccessed: false,
            runtimeFilesModified: false,
            configModified: false,
            destructiveOperations: false
        };
    }

    ensureSchema();

    SBH.subscriptionRepository = {
        schemaVersion: SCHEMA_VERSION,
        ensureSchema: ensureSchema,
        list: list,
        get: get,
        create: create,
        update: update,
        setEnabled: setEnabled,
        remove: remove,
        count: count,
        preview: preview
    };

    if (typeof originalStart !== "function") {
        throw new Error("Original app.start unavailable");
    }

    SBH.app.start = function () {
        var output = originalStart();

        output.subscriptionRepositoryVersion = 1;
        output.subscriptionRepositoryReady = schemaEnsured;
        output.subscriptionSchemaVersion = SCHEMA_VERSION;
        output.subscriptionSchemaCreated = schemaCreated;
        output.subscriptionCount = count();
        output.subscriptionNetworkAccessed = false;
        output.subscriptionRuntimeConfigModified = false;
        output.subscriptionCoreInvoked = false;
        output.subscriptionTunCreated = false;
        output.subscriptionRouteModified = false;
        output.writeOperationsLocked = true;
        output.destructiveOperations = false;
        return output;
    };
}());
