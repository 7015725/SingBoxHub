/* SingBoxHub file module. Rhino ES5 only. */
SBH.versions.files = 1;

(function () {
    var P = Packages;
    var File = P.java.io.File;
    var FIS = P.java.io.FileInputStream;
    var FOS = P.java.io.FileOutputStream;
    var BAOS = P.java.io.ByteArrayOutputStream;
    var JavaString = P.java.lang.String;
    var ReflectArray = P.java.lang.reflect.Array;
    var JavaByte = P.java.lang.Byte;
    var MessageDigest = P.java.security.MessageDigest;

    function closeQuietly(value) {
        try {
            if (value !== null && value !== undefined) {
                value.close();
            }
        } catch (ignored) {}
    }

    function ensureDir(value) {
        var dir = value instanceof File ? value : new File(String(value));
        if (!dir.exists() && !dir.mkdirs() && !dir.isDirectory()) {
            throw new Error("Cannot create directory: " + dir.getAbsolutePath());
        }
        if (!dir.isDirectory()) {
            throw new Error("Not a directory: " + dir.getAbsolutePath());
        }
        return dir;
    }

    function readBytes(stream) {
        var out = new BAOS();
        var buffer = ReflectArray.newInstance(JavaByte.TYPE, 8192);
        var count;
        try {
            while ((count = stream.read(buffer)) >= 0) {
                if (count > 0) {
                    out.write(buffer, 0, count);
                }
            }
            return out.toByteArray();
        } finally {
            closeQuietly(stream);
            closeQuietly(out);
        }
    }

    function readUtf8(file) {
        return String(new JavaString(readBytes(new FIS(file)), "UTF-8"));
    }

    function writeUtf8(file, text) {
        var out = null;
        try {
            ensureDir(file.getParentFile());
            out = new FOS(file, false);
            out.write(new JavaString(String(text)).getBytes("UTF-8"));
            out.flush();
            try {
                out.getFD().sync();
            } catch (syncError) {
                throw new Error("File sync failed: " + syncError);
            }
        } finally {
            closeQuietly(out);
        }
    }

    function writeAtomic(file, text) {
        var temp = new File(file.getAbsolutePath() + ".tmp");
        var backup = new File(file.getAbsolutePath() + ".bak");
        ensureDir(file.getParentFile());
        if (temp.exists()) {
            temp.delete();
        }
        writeUtf8(temp, text);
        if (backup.exists()) {
            backup.delete();
        }
        if (file.exists() && !file.renameTo(backup)) {
            temp.delete();
            throw new Error("Cannot back up: " + file.getAbsolutePath());
        }
        if (!temp.renameTo(file)) {
            if (!file.exists() && backup.exists()) {
                backup.renameTo(file);
            }
            throw new Error("Cannot install: " + file.getAbsolutePath());
        }
        if (backup.exists()) {
            backup.delete();
        }
    }

    function deleteTree(file) {
        var children;
        var i;
        if (!file.exists()) {
            return true;
        }
        if (file.isDirectory()) {
            children = file.listFiles();
            if (children !== null) {
                for (i = 0; i < children.length; i += 1) {
                    deleteTree(children[i]);
                }
            }
        }
        return !file.exists() || file.delete();
    }

    function sha256Text(text) {
        var digest = MessageDigest.getInstance("SHA-256");
        var bytes = new JavaString(String(text)).getBytes("UTF-8");
        var result = digest.digest(bytes);
        var out = [];
        var i;
        var value;
        var hex;
        for (i = 0; i < result.length; i += 1) {
            value = Number(result[i]);
            if (value < 0) {
                value += 256;
            }
            hex = value.toString(16);
            out.push(hex.length === 1 ? "0" + hex : hex);
        }
        return out.join("");
    }

    function readJson(file, fallback) {
        try {
            if (!file.exists()) {
                return fallback;
            }
            return JSON.parse(readUtf8(file));
        } catch (error) {
            SBH.log.warn("files", "JSON read failed: " + error);
            return fallback;
        }
    }

    function writeJson(file, value) {
        writeAtomic(file, JSON.stringify(value, null, 2) + "\n");
    }

    SBH.files = {
        File: File,
        ensureDir: ensureDir,
        readUtf8: readUtf8,
        writeUtf8: writeUtf8,
        writeAtomic: writeAtomic,
        deleteTree: deleteTree,
        sha256Text: sha256Text,
        readJson: readJson,
        writeJson: writeJson
    };

    ensureDir(SBH.paths.dataDir);
    ensureDir(SBH.paths.cacheDir);
    ensureDir(SBH.paths.logsDir);
    ensureDir(SBH.paths.stateDir);
}());
