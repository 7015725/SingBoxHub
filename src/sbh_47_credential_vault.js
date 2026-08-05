/* SingBoxHub Stage40 Android Keystore credential vault probe. Rhino ES5 only. */
SBH.versions.credentialVault = 1;

(function () {
    "use strict";

    var P = Packages;
    var Build = P.android.os.Build;
    var Process = P.android.os.Process;
    var KeyStore = P.java.security.KeyStore;
    var KeyGenerator = P.javax.crypto.KeyGenerator;
    var Cipher = P.javax.crypto.Cipher;
    var SecretKeyFactory = P.javax.crypto.SecretKeyFactory;
    var GCMParameterSpec = P.javax.crypto.spec.GCMParameterSpec;
    var KeyGenParameterSpec = P.android.security.keystore.KeyGenParameterSpec;
    var KeyProperties = P.android.security.keystore.KeyProperties;
    var KeyInfo = P.android.security.keystore.KeyInfo;
    var ReflectArray = P.java.lang.reflect.Array;
    var JavaString = P.java.lang.String;
    var UUID = P.java.util.UUID;
    var Thread = P.java.lang.Thread;
    var Runnable = P.java.lang.Runnable;
    var Base64 = P.android.util.Base64;
    var MessageDigest = P.java.security.MessageDigest;
    var originalStart = SBH.app.start;

    var TABLE = "credential_vault";
    var SCHEMA_VERSION = 1;
    var KEY_ALIAS =
        "SingBoxHub.ClientCredentialVault.AESGCM.v1";
    var TRANSFORMATION = "AES/GCM/NoPadding";
    var KEY_SIZE_BITS = 256;
    var GCM_TAG_BITS = 128;
    var MAX_RECORD_KEY = 160;
    var MAX_PURPOSE = 80;
    var MAX_PLAINTEXT_BYTES = 64 * 1024;

    var initialized = false;
    var ready = false;
    var initError = null;
    var keyCreatedThisRun = false;
    var insideSecureHardware = null;
    var unlockedDeviceRequired = false;
    var schemaCreated = false;

    function now() {
        return Number(P.java.lang.System.currentTimeMillis());
    }

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

    function errorText(error) {
        try {
            return SBH.util.errorText(error);
        } catch (ignored) {
            return String(error);
        }
    }

    function zeroBytes(bytes) {
        var index;
        if (bytes === null || bytes === undefined) {
            return;
        }
        try {
            for (index = 0; index < bytes.length; index += 1) {
                bytes[index] = 0;
            }
        } catch (ignored) {}
    }

    function hex(bytes) {
        var output = [];
        var index;
        var value;
        var part;

        for (index = 0; index < bytes.length; index += 1) {
            value = Number(bytes[index]);
            if (value < 0) {
                value += 256;
            }
            part = value.toString(16);
            output.push(part.length === 1 ? "0" + part : part);
        }
        return output.join("");
    }

    function sha256Bytes(bytes) {
        var digest = MessageDigest.getInstance("SHA-256");
        return hex(digest.digest(bytes));
    }

    function stringArray(value) {
        var output = ReflectArray.newInstance(
            P.java.lang.String,
            1
        );
        output[0] = String(value);
        return output;
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
            "CREATE TABLE IF NOT EXISTS credential_vault (" +
            "record_key TEXT PRIMARY KEY NOT NULL," +
            "purpose TEXT NOT NULL," +
            "iv_b64 TEXT NOT NULL," +
            "cipher_b64 TEXT NOT NULL," +
            "aad_sha256 TEXT NOT NULL," +
            "created_at INTEGER NOT NULL," +
            "updated_at INTEGER NOT NULL)"
        );
        db.execSQL(
            "CREATE INDEX IF NOT EXISTS " +
            "idx_credential_vault_purpose " +
            "ON credential_vault(purpose,updated_at DESC)"
        );

        schemaCreated = !existed;
        return true;
    }

    function schemaAudit() {
        var cursor = null;
        var columns = [];
        var forbidden = [];
        var name;
        var lowerName;

        try {
            cursor = SBH.database.open().rawQuery(
                "PRAGMA table_info(credential_vault)",
                []
            );
            while (cursor.moveToNext()) {
                name = String(cursor.getString(1));
                columns.push(name);
                lowerName = name.toLowerCase();
                if (lowerName === "plaintext" ||
                        lowerName === "secret" ||
                        lowerName === "password" ||
                        lowerName === "uuid" ||
                        lowerName === "token" ||
                        lowerName === "private_key") {
                    forbidden.push(name);
                }
            }
        } finally {
            closeQuietly(cursor);
        }

        return {
            columns: columns,
            forbiddenPlaintextColumns: forbidden,
            plaintextColumnPresent: forbidden.length > 0
        };
    }

    function keyStore() {
        var store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        return store;
    }

    function inspectHardware(key) {
        var factory;
        var info;

        try {
            factory = SecretKeyFactory.getInstance(
                key.getAlgorithm(),
                "AndroidKeyStore"
            );
            info = factory.getKeySpec(key, KeyInfo.class);
            return info.isInsideSecureHardware() === true;
        } catch (ignored) {
            return null;
        }
    }

    function ensureKey() {
        var store = keyStore();
        var key;
        var generator;
        var builder;

        if (store.containsAlias(KEY_ALIAS)) {
            key = store.getKey(KEY_ALIAS, null);
            if (key === null) {
                throw new Error(
                    "Android Keystore alias exists but key is unavailable"
                );
            }
            insideSecureHardware = inspectHardware(key);
            return key;
        }

        generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            "AndroidKeyStore"
        );
        builder = new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            Number(KeyProperties.PURPOSE_ENCRYPT) |
                Number(KeyProperties.PURPOSE_DECRYPT)
        );
        builder.setBlockModes(
            stringArray(KeyProperties.BLOCK_MODE_GCM)
        );
        builder.setEncryptionPaddings(
            stringArray(
                KeyProperties.ENCRYPTION_PADDING_NONE
            )
        );
        builder.setKeySize(KEY_SIZE_BITS);
        builder.setRandomizedEncryptionRequired(true);
        builder.setUserAuthenticationRequired(false);

        if (Build.VERSION.SDK_INT >= 28) {
            try {
                builder.setUnlockedDeviceRequired(true);
                unlockedDeviceRequired = true;
            } catch (ignoredUnlocked) {
                unlockedDeviceRequired = false;
            }
        }

        generator.init(builder.build());
        key = generator.generateKey();
        keyCreatedThisRun = true;
        insideSecureHardware = inspectHardware(key);
        return key;
    }

    function validateRecordKey(value) {
        var output = trim(value);
        if (!output ||
                output.length > MAX_RECORD_KEY ||
                !/^[A-Za-z0-9._:-]+$/.test(output)) {
            throw new Error("保险库记录键格式无效");
        }
        return output;
    }

    function validatePurpose(value) {
        var output = trim(value);
        if (!output || output.length > MAX_PURPOSE) {
            throw new Error("保险库用途格式无效");
        }
        return output;
    }

    function aadText(recordKey, purpose) {
        return [
            "SingBoxHub",
            "credential-vault",
            "v1",
            recordKey,
            purpose
        ].join("|");
    }

    function encode(bytes) {
        return String(
            Base64.encodeToString(bytes, Base64.NO_WRAP)
        );
    }

    function decode(value) {
        return Base64.decode(
            String(value),
            Base64.NO_WRAP
        );
    }

    function encryptBytes(recordKey, purpose, plaintextBytes) {
        var key = ensureKey();
        var cipher = Cipher.getInstance(TRANSFORMATION);
        var aadBytes = new JavaString(
            aadText(recordKey, purpose)
        ).getBytes("UTF-8");
        var encrypted;
        var iv;

        if (plaintextBytes === null ||
                plaintextBytes === undefined ||
                plaintextBytes.length <= 0 ||
                plaintextBytes.length > MAX_PLAINTEXT_BYTES) {
            zeroBytes(aadBytes);
            throw new Error("保险库明文长度无效");
        }

        try {
            cipher.init(Cipher.ENCRYPT_MODE, key);
            cipher.updateAAD(aadBytes);
            encrypted = cipher.doFinal(plaintextBytes);
            iv = cipher.getIV();
            return {
                ivB64: encode(iv),
                cipherB64: encode(encrypted),
                aadSha256: sha256Bytes(aadBytes),
                cipherSha256: sha256Bytes(encrypted)
            };
        } finally {
            zeroBytes(aadBytes);
            zeroBytes(encrypted);
            zeroBytes(iv);
        }
    }

    function decryptBytes(
        recordKey,
        purpose,
        ivB64,
        cipherB64
    ) {
        var key = ensureKey();
        var cipher = Cipher.getInstance(TRANSFORMATION);
        var iv = decode(ivB64);
        var encrypted = decode(cipherB64);
        var aadBytes = new JavaString(
            aadText(recordKey, purpose)
        ).getBytes("UTF-8");
        var spec = new GCMParameterSpec(
            GCM_TAG_BITS,
            iv
        );
        var plaintext;

        try {
            cipher.init(Cipher.DECRYPT_MODE, key, spec);
            cipher.updateAAD(aadBytes);
            plaintext = cipher.doFinal(encrypted);
            return plaintext;
        } finally {
            zeroBytes(iv);
            zeroBytes(encrypted);
            zeroBytes(aadBytes);
        }
    }

    function putText(recordKeyValue, purposeValue, value) {
        var recordKey = validateRecordKey(recordKeyValue);
        var purpose = validatePurpose(purposeValue);
        var plaintext = new JavaString(
            String(value)
        ).getBytes("UTF-8");
        var encrypted = null;
        var statement = null;
        var timestamp = now();
        var existing = exists(recordKey);

        try {
            encrypted = encryptBytes(
                recordKey,
                purpose,
                plaintext
            );
            statement = SBH.database.open().compileStatement(
                "INSERT OR REPLACE INTO credential_vault(" +
                "record_key,purpose,iv_b64,cipher_b64," +
                "aad_sha256,created_at,updated_at" +
                ") VALUES(?,?,?,?,?,?,?)"
            );
            statement.bindString(1, recordKey);
            statement.bindString(2, purpose);
            statement.bindString(3, encrypted.ivB64);
            statement.bindString(4, encrypted.cipherB64);
            statement.bindString(5, encrypted.aadSha256);
            statement.bindLong(6, existing ? createdAt(recordKey) : timestamp);
            statement.bindLong(7, timestamp);
            if (Number(statement.executeInsert()) < 0) {
                throw new Error("保险库密文写入失败");
            }
            return {
                recordKey: recordKey,
                purpose: purpose,
                cipherSha256: encrypted.cipherSha256,
                plaintextPersisted: false,
                plaintextReturned: false,
                updatedAt: timestamp
            };
        } finally {
            zeroBytes(plaintext);
            closeQuietly(statement);
            encrypted = null;
        }
    }

    function readRow(recordKeyValue) {
        var recordKey = validateRecordKey(recordKeyValue);
        var cursor = null;

        try {
            cursor = SBH.database.open().rawQuery(
                "SELECT purpose,iv_b64,cipher_b64," +
                "aad_sha256,created_at,updated_at " +
                "FROM credential_vault WHERE record_key=? LIMIT 1",
                [recordKey]
            );
            if (!cursor.moveToFirst()) {
                return null;
            }
            return {
                recordKey: recordKey,
                purpose: String(cursor.getString(0)),
                ivB64: String(cursor.getString(1)),
                cipherB64: String(cursor.getString(2)),
                aadSha256: String(cursor.getString(3)),
                createdAt: Number(cursor.getLong(4)),
                updatedAt: Number(cursor.getLong(5))
            };
        } finally {
            closeQuietly(cursor);
        }
    }

    function getText(recordKeyValue, purposeValue) {
        var recordKey = validateRecordKey(recordKeyValue);
        var purpose = validatePurpose(purposeValue);
        var row = readRow(recordKey);
        var plaintext;
        var output;

        if (row === null) {
            return null;
        }
        if (row.purpose !== purpose) {
            throw new Error("保险库用途不匹配");
        }

        plaintext = decryptBytes(
            recordKey,
            purpose,
            row.ivB64,
            row.cipherB64
        );
        try {
            output = String(new JavaString(
                plaintext,
                "UTF-8"
            ));
            return output;
        } finally {
            zeroBytes(plaintext);
        }
    }

    function exists(recordKeyValue) {
        var recordKey = validateRecordKey(recordKeyValue);
        var cursor = null;
        try {
            cursor = SBH.database.open().rawQuery(
                "SELECT 1 FROM credential_vault " +
                "WHERE record_key=? LIMIT 1",
                [recordKey]
            );
            return cursor.moveToFirst();
        } finally {
            closeQuietly(cursor);
        }
    }

    function createdAt(recordKeyValue) {
        var row = readRow(recordKeyValue);
        return row === null ? now() : row.createdAt;
    }

    function remove(recordKeyValue) {
        var recordKey = validateRecordKey(recordKeyValue);
        var statement = null;
        try {
            statement = SBH.database.open().compileStatement(
                "DELETE FROM credential_vault WHERE record_key=?"
            );
            statement.bindString(1, recordKey);
            return Number(
                statement.executeUpdateDelete()
            ) === 1;
        } finally {
            closeQuietly(statement);
        }
    }

    function count() {
        var cursor = null;
        try {
            cursor = SBH.database.open().rawQuery(
                "SELECT COUNT(*) FROM credential_vault",
                []
            );
            return cursor.moveToFirst() ?
                Number(cursor.getLong(0)) : 0;
        } finally {
            closeQuietly(cursor);
        }
    }

    function metadata(recordKeyValue) {
        var row = readRow(recordKeyValue);
        if (row === null) {
            return null;
        }
        return {
            recordKey: row.recordKey,
            purpose: row.purpose,
            ivLength: decode(row.ivB64).length,
            cipherByteLength: decode(row.cipherB64).length,
            aadSha256: row.aadSha256,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            plaintextPersisted: false
        };
    }

    function status() {
        var store;
        var aliasExists = false;
        var audit = schemaAudit();

        try {
            store = keyStore();
            aliasExists = store.containsAlias(KEY_ALIAS);
        } catch (ignored) {}

        return {
            version: 1,
            ready: ready,
            initError: initError,
            keyAlias: KEY_ALIAS,
            keyAlgorithm: "AES",
            transformation: TRANSFORMATION,
            keySizeBits: KEY_SIZE_BITS,
            aliasExists: aliasExists,
            keyCreatedThisRun: keyCreatedThisRun,
            insideSecureHardware: insideSecureHardware,
            unlockedDeviceRequired: unlockedDeviceRequired,
            userAuthenticationRequired: false,
            isolationScope: "android_linux_uid",
            processUid: Number(Process.myUid()),
            processPackage: String(
                SBH.ctx.getPackageName()
            ),
            schemaVersion: SCHEMA_VERSION,
            schemaCreated: schemaCreated,
            rowCount: count(),
            schemaColumns: audit.columns,
            plaintextColumnPresent:
                audit.plaintextColumnPresent,
            plaintextPersisted: false,
            automaticSecretImport: false,
            realCredentialsStored: false
        };
    }

    function selfTest() {
        var startedAt = now();
        var suffix = String(UUID.randomUUID())
            .replace(/-/g, "");
        var recordKey =
            "selftest:" + suffix;
        var purpose = "vault_self_test";
        var plaintext =
            "SingBoxHub-Vault-SelfTest-" + suffix;
        var plaintextBytes = new JavaString(
            plaintext
        ).getBytes("UTF-8");
        var plaintextSha256 = sha256Bytes(
            plaintextBytes
        );
        var writeResult;
        var stored;
        var decrypted = null;
        var roundTripMatched = false;
        var ciphertextDiffers = false;
        var removed = false;
        var absentAfterDelete = false;
        var audit;

        try {
            writeResult = putText(
                recordKey,
                purpose,
                plaintext
            );
            stored = readRow(recordKey);
            if (stored === null) {
                throw new Error(
                    "保险库自检密文记录不存在"
                );
            }
            ciphertextDiffers =
                stored.cipherB64.indexOf(plaintext) < 0 &&
                stored.ivB64.indexOf(plaintext) < 0;
            decrypted = getText(
                recordKey,
                purpose
            );
            roundTripMatched =
                decrypted === plaintext;
            removed = remove(recordKey);
            absentAfterDelete =
                !exists(recordKey);
            audit = schemaAudit();

            return {
                ok:
                    roundTripMatched &&
                    ciphertextDiffers &&
                    removed &&
                    absentAfterDelete &&
                    audit.plaintextColumnPresent === false,
                stage:
                    "credential_stage40_keystore_vault_probe",
                keyAlias: KEY_ALIAS,
                aliasExists: true,
                keyCreatedThisRun: keyCreatedThisRun,
                insideSecureHardware:
                    insideSecureHardware,
                unlockedDeviceRequired:
                    unlockedDeviceRequired,
                userAuthenticationRequired: false,
                isolationScope:
                    "android_linux_uid",
                processUid: Number(Process.myUid()),
                processPackage: String(
                    SBH.ctx.getPackageName()
                ),
                plaintextSha256:
                    plaintextSha256,
                cipherSha256:
                    writeResult.cipherSha256,
                ciphertextDiffersFromPlaintext:
                    ciphertextDiffers,
                roundTripMatched:
                    roundTripMatched,
                testRecordDeleted: removed,
                absentAfterDelete:
                    absentAfterDelete,
                plaintextColumnPresent:
                    audit.plaintextColumnPresent,
                plaintextPersisted: false,
                plaintextReturned: false,
                realCredentialsStored: false,
                clientDatabaseModified:
                    true,
                runtimeFilesModified: false,
                configModified: false,
                coreStartInvoked: false,
                tunCreated: false,
                routeModified: false,
                destructiveOperations: false,
                durationMs: now() - startedAt,
                timestamp: now()
            };
        } finally {
            try {
                if (exists(recordKey)) {
                    remove(recordKey);
                }
            } catch (ignoredCleanup) {}
            zeroBytes(plaintextBytes);
            plaintext = null;
            decrypted = null;
            stored = null;
        }
    }

    function postCallback(callback, result) {
        SBH.handler.post(new JavaAdapter(Runnable, {
            run: function () {
                callback(result);
            }
        }));
    }

    function selfTestAsync(callback) {
        if (typeof callback !== "function") {
            throw new Error("保险库自检回调不可用");
        }

        new Thread(
            new JavaAdapter(Runnable, {
                run: function () {
                    var result;
                    try {
                        if (!ready) {
                            throw new Error(
                                initError ||
                                "保险库未就绪"
                            );
                        }
                        result = selfTest();
                    } catch (error) {
                        result = {
                            ok: false,
                            stage:
                                "credential_stage40_keystore_vault_probe",
                            error: errorText(error)
                                .substring(0, 500),
                            keyAlias: KEY_ALIAS,
                            isolationScope:
                                "android_linux_uid",
                            processUid:
                                Number(Process.myUid()),
                            processPackage: String(
                                SBH.ctx.getPackageName()
                            ),
                            plaintextPersisted: false,
                            plaintextReturned: false,
                            realCredentialsStored: false,
                            clientDatabaseModified: false,
                            runtimeFilesModified: false,
                            configModified: false,
                            coreStartInvoked: false,
                            tunCreated: false,
                            routeModified: false,
                            destructiveOperations: false,
                            timestamp: now()
                        };
                    }
                    postCallback(callback, result);
                }
            }),
            "SingBoxHub-CredentialVaultSelfTest"
        ).start();

        return {
            accepted: true,
            manualOnly: true,
            realCredentialsStored: false,
            plaintextPersisted: false
        };
    }

    try {
        ensureSchema();
        ensureKey();
        ready = true;
        initialized = true;
    } catch (error) {
        initialized = true;
        ready = false;
        initError = errorText(error).substring(0, 500);
    }

    SBH.credentialVault = {
        version: 1,
        schemaVersion: SCHEMA_VERSION,
        ready: function () {
            return ready;
        },
        status: status,
        putText: putText,
        getText: getText,
        metadata: metadata,
        exists: exists,
        remove: remove,
        count: count,
        selfTestAsync: selfTestAsync,
        automaticSecretImport: false,
        realCredentialsStored: false,
        plaintextPersisted: false,
        runtimeWriteEnabled: false
    };

    if (typeof originalStart !== "function") {
        throw new Error("Original app.start unavailable");
    }

    SBH.app.start = function () {
        var output = originalStart();
        var value = status();

        output.credentialVaultVersion = 1;
        output.credentialVaultInitialized =
            initialized;
        output.credentialVaultReady =
            value.ready;
        output.credentialVaultInitError =
            value.initError;
        output.credentialVaultAliasExists =
            value.aliasExists;
        output.credentialVaultKeyCreatedThisRun =
            value.keyCreatedThisRun;
        output.credentialVaultInsideSecureHardware =
            value.insideSecureHardware;
        output.credentialVaultUnlockedDeviceRequired =
            value.unlockedDeviceRequired;
        output.credentialVaultUserAuthenticationRequired =
            false;
        output.credentialVaultIsolationScope =
            value.isolationScope;
        output.credentialVaultProcessUid =
            value.processUid;
        output.credentialVaultProcessPackage =
            value.processPackage;
        output.credentialVaultSchemaVersion =
            SCHEMA_VERSION;
        output.credentialVaultSchemaCreated =
            value.schemaCreated;
        output.credentialVaultRowCount =
            value.rowCount;
        output.credentialVaultPlaintextColumnPresent =
            value.plaintextColumnPresent;
        output.credentialVaultPlaintextPersisted =
            false;
        output.credentialVaultAutomaticSecretImport =
            false;
        output.credentialVaultRealCredentialsStored =
            false;
        output.credentialVaultSelfTestManualOnly =
            true;
        output.subscriptionRuntimeConfigModified = false;
        output.subscriptionCoreInvoked = false;
        output.subscriptionTunCreated = false;
        output.subscriptionRouteModified = false;
        output.writeOperationsLocked = true;
        output.destructiveOperations = false;
        return output;
    };
}());
