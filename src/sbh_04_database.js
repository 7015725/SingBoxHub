/* SingBoxHub database module. Rhino ES5 only. */
SBH.versions.database = 1;

(function () {
    var SQLiteDatabase = Packages.android.database.sqlite.SQLiteDatabase;
    var dbFile = new Packages.java.io.File(
        SBH.paths.dataDir,
        "singboxhub.db"
    );
    var db = null;

    function open() {
        if (db !== null && db.isOpen()) {
            return db;
        }
        db = SQLiteDatabase.openOrCreateDatabase(dbFile, null);
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS settings (" +
            "key TEXT PRIMARY KEY NOT NULL," +
            "value TEXT NOT NULL," +
            "updated_at INTEGER NOT NULL)"
        );
        return db;
    }

    function get(key, fallback) {
        var cursor = null;
        try {
            cursor = open().rawQuery(
                "SELECT value FROM settings WHERE key=? LIMIT 1",
                [String(key)]
            );
            if (cursor.moveToFirst()) {
                return String(cursor.getString(0));
            }
        } catch (error) {
            SBH.log.error("database", error);
        } finally {
            try {
                if (cursor !== null) {
                    cursor.close();
                }
            } catch (ignored) {}
        }
        return fallback;
    }

    function put(key, value) {
        var statement = null;
        try {
            statement = open().compileStatement(
                "INSERT OR REPLACE INTO settings(key,value,updated_at) " +
                "VALUES(?,?,?)"
            );
            statement.bindString(1, String(key));
            statement.bindString(2, String(value));
            statement.bindLong(3, SBH.util.now());
            statement.executeInsert();
            return true;
        } catch (error) {
            SBH.log.error("database", error);
            return false;
        } finally {
            try {
                if (statement !== null) {
                    statement.close();
                }
            } catch (ignored) {}
        }
    }

    function getBoolean(key, fallback) {
        var value = get(key, fallback ? "1" : "0");
        return String(value) === "1";
    }

    function putBoolean(key, value) {
        return put(key, value ? "1" : "0");
    }

    SBH.database = {
        open: open,
        get: get,
        put: put,
        getBoolean: getBoolean,
        putBoolean: putBoolean
    };

    open();
}());
