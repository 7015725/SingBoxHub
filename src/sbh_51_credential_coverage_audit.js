/* SingBoxHub Stage42 credential coverage audit. Rhino ES5 only. */
SBH.versions.credentialCoverageAudit = 1;

(function () {
    "use strict";

    var vault = SBH.credentialVault;
    var credentialImport = SBH.subscriptionCredentialImport;
    var originalVaultStatus = vault.status;
    var originalStart = SBH.app.start;
    var MAX_MISSING_DETAILS = 50;

    function closeQuietly(value) {
        try {
            if (value !== null && value !== undefined) {
                value.close();
            }
        } catch (ignored) {}
    }

    function scalar(sql, args) {
        var cursor = null;
        try {
            cursor = SBH.database.open().rawQuery(
                String(sql),
                args || []
            );
            return cursor.moveToFirst() ?
                Number(cursor.getLong(0)) : 0;
        } finally {
            closeQuietly(cursor);
        }
    }

    function missingDetails() {
        var cursor = null;
        var rows = [];
        try {
            cursor = SBH.database.open().rawQuery(
                "SELECT n.subscription_id,s.name,n.name,n.protocol," +
                "n.server,n.port,n.tls,n.transport,n.fingerprint " +
                "FROM subscription_nodes n " +
                "LEFT JOIN subscription_node_credentials c " +
                "ON c.subscription_id=n.subscription_id " +
                "AND c.fingerprint=n.fingerprint " +
                "LEFT JOIN subscriptions s ON s.id=n.subscription_id " +
                "WHERE c.record_key IS NULL " +
                "ORDER BY n.subscription_id,n.protocol,n.name LIMIT " +
                String(MAX_MISSING_DETAILS),
                []
            );
            while (cursor.moveToNext()) {
                rows.push({
                    subscriptionId: Number(cursor.getLong(0)),
                    subscriptionName: String(cursor.getString(1) || ""),
                    nodeName: String(cursor.getString(2) || ""),
                    protocol: String(cursor.getString(3) || ""),
                    server: String(cursor.getString(4) || ""),
                    port: cursor.isNull(5) ? null : Number(cursor.getLong(5)),
                    tls: Number(cursor.getInt(6)) === 1,
                    transport: String(cursor.getString(7) || ""),
                    fingerprint: String(cursor.getString(8) || "")
                });
            }
            return rows;
        } finally {
            closeQuietly(cursor);
        }
    }

    function missingByProtocol() {
        var cursor = null;
        var output = {};
        var protocol;
        try {
            cursor = SBH.database.open().rawQuery(
                "SELECT n.protocol,COUNT(*) FROM subscription_nodes n " +
                "LEFT JOIN subscription_node_credentials c " +
                "ON c.subscription_id=n.subscription_id " +
                "AND c.fingerprint=n.fingerprint " +
                "WHERE c.record_key IS NULL GROUP BY n.protocol " +
                "ORDER BY COUNT(*) DESC,n.protocol",
                []
            );
            while (cursor.moveToNext()) {
                protocol = String(cursor.getString(0) || "unknown");
                output[protocol] = Number(cursor.getLong(1));
            }
            return output;
        } finally {
            closeQuietly(cursor);
        }
    }

    function linkVaultAudit() {
        var cursor = null;
        var checked = 0;
        var missing = 0;
        var missingKeys = [];
        var key;
        try {
            cursor = SBH.database.open().rawQuery(
                "SELECT record_key FROM subscription_node_credentials " +
                "ORDER BY subscription_id,fingerprint",
                []
            );
            while (cursor.moveToNext()) {
                key = String(cursor.getString(0));
                checked += 1;
                try {
                    if (!vault.exists(key)) {
                        missing += 1;
                        if (missingKeys.length < 20) {
                            missingKeys.push(key);
                        }
                    }
                } catch (ignoredExists) {
                    missing += 1;
                    if (missingKeys.length < 20) {
                        missingKeys.push(key);
                    }
                }
            }
        } finally {
            closeQuietly(cursor);
        }
        return {
            checkedLinkCount: checked,
            linkWithoutVaultCount: missing,
            missingVaultRecordKeys: missingKeys
        };
    }

    function audit() {
        var totalNodes = scalar(
            "SELECT COUNT(*) FROM subscription_nodes",
            []
        );
        var encryptedNodes = scalar(
            "SELECT COUNT(*) FROM subscription_nodes " +
            "WHERE credential_state='encrypted_vault'",
            []
        );
        var linkedCredentials = scalar(
            "SELECT COUNT(*) FROM subscription_node_credentials",
            []
        );
        var missingLinks = scalar(
            "SELECT COUNT(*) FROM subscription_nodes n " +
            "LEFT JOIN subscription_node_credentials c " +
            "ON c.subscription_id=n.subscription_id " +
            "AND c.fingerprint=n.fingerprint " +
            "WHERE c.record_key IS NULL",
            []
        );
        var orphanLinks = scalar(
            "SELECT COUNT(*) FROM subscription_node_credentials c " +
            "LEFT JOIN subscription_nodes n " +
            "ON n.subscription_id=c.subscription_id " +
            "AND n.fingerprint=c.fingerprint " +
            "WHERE n.fingerprint IS NULL",
            []
        );
        var vaultRows = Number(vault.count());
        var linkVault = linkVaultAudit();
        var ratio = totalNodes > 0 ?
            linkedCredentials / totalNodes : 0;
        var complete = totalNodes > 0 &&
            missingLinks === 0 &&
            orphanLinks === 0 &&
            linkVault.linkWithoutVaultCount === 0 &&
            linkedCredentials === totalNodes &&
            encryptedNodes === totalNodes;

        return {
            ok: true,
            stage: "credential_stage42_coverage_audit",
            totalNodeCount: totalNodes,
            encryptedNodeCount: encryptedNodes,
            linkedCredentialCount: linkedCredentials,
            vaultRowCount: vaultRows,
            missingCredentialNodeCount: missingLinks,
            orphanCredentialLinkCount: orphanLinks,
            linkWithoutVaultCount: linkVault.linkWithoutVaultCount,
            checkedVaultLinkCount: linkVault.checkedLinkCount,
            estimatedUnlinkedVaultRowCount:
                Math.max(0, vaultRows - linkedCredentials),
            coverageRatio: ratio,
            coveragePercent: Math.round(ratio * 10000) / 100,
            coverageComplete: complete,
            realCredentialsStored: linkedCredentials > 0,
            missingByProtocol: missingByProtocol(),
            missingNodes: missingDetails(),
            missingVaultRecordKeys:
                linkVault.missingVaultRecordKeys,
            plaintextCredentialRead: false,
            plaintextCredentialReturned: false,
            plaintextCredentialPersisted: false,
            networkAccessed: false,
            clientDatabaseModified: false,
            runtimeFilesModified: false,
            configModified: false,
            coreStartInvoked: false,
            tunCreated: false,
            routeModified: false,
            destructiveOperations: false,
            timestamp: Number(SBH.util.now())
        };
    }

    if (!vault || !credentialImport) {
        throw new Error(
            "Credential coverage dependencies unavailable"
        );
    }

    vault.status = function () {
        var value = originalVaultStatus();
        var current = audit();
        value.rowCount = current.vaultRowCount;
        value.realCredentialsStored =
            current.realCredentialsStored;
        value.credentialRecordCount =
            current.linkedCredentialCount;
        value.credentialCoveragePercent =
            current.coveragePercent;
        value.credentialCoverageComplete =
            current.coverageComplete;
        value.credentialMissingNodeCount =
            current.missingCredentialNodeCount;
        return value;
    };

    SBH.credentialCoverageAudit = {
        version: 1,
        audit: audit,
        plaintextCredentialRead: false,
        networkAccessed: false,
        runtimeWriteEnabled: false
    };

    if (typeof originalStart !== "function") {
        throw new Error("Original app.start unavailable");
    }

    SBH.app.start = function () {
        var output = originalStart();
        var current = audit();

        output.credentialCoverageAuditVersion = 1;
        output.credentialCoverageAuditReady = true;
        output.credentialCoverageTotalNodeCount =
            current.totalNodeCount;
        output.credentialCoverageEncryptedNodeCount =
            current.encryptedNodeCount;
        output.credentialCoverageLinkedCredentialCount =
            current.linkedCredentialCount;
        output.credentialCoverageVaultRowCount =
            current.vaultRowCount;
        output.credentialCoverageMissingNodeCount =
            current.missingCredentialNodeCount;
        output.credentialCoverageOrphanLinkCount =
            current.orphanCredentialLinkCount;
        output.credentialCoverageLinkWithoutVaultCount =
            current.linkWithoutVaultCount;
        output.credentialCoveragePercent =
            current.coveragePercent;
        output.credentialCoverageComplete =
            current.coverageComplete;
        output.credentialVaultRealCredentialsStored =
            current.realCredentialsStored;
        output.credentialVaultRowCount =
            current.vaultRowCount;
        output.subscriptionCredentialRecordCount =
            current.linkedCredentialCount;
        output.subscriptionCredentialPlaintextPersisted = false;
        output.subscriptionCredentialPlaintextReturned = false;
        output.subscriptionCredentialsRuntimeUsable = false;
        output.subscriptionRuntimeConfigModified = false;
        output.subscriptionCoreInvoked = false;
        output.subscriptionTunCreated = false;
        output.subscriptionRouteModified = false;
        output.writeOperationsLocked = true;
        output.destructiveOperations = false;
        return output;
    };
}());
