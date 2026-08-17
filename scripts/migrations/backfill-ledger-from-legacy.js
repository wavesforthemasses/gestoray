#!/usr/bin/env node

/**
 * Script di Migrazione e Backfill Deterministico Idempotente
 * Trasferisce lo storico legacy da /{collection}/{entityId}/history/* a /system_ledger/*
 *
 * Utilizzo:
 *   node scripts/migrations/backfill-ledger-from-legacy.js --dry-run
 *   node scripts/migrations/backfill-ledger-from-legacy.js --tenant-id default
 *   node scripts/migrations/backfill-ledger-from-legacy.js --tenant-id default --module clients
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

let targetTenantId = 'default';
const tenantIdx = args.indexOf('--tenant-id');
if (tenantIdx !== -1 && args[tenantIdx + 1]) {
  targetTenantId = args[tenantIdx + 1];
}

let filterModule = null;
const moduleIdx = args.indexOf('--module');
if (moduleIdx !== -1 && args[moduleIdx + 1]) {
  filterModule = args[moduleIdx + 1];
}

// Inizializza Admin SDK con emulatore o credenziali locali
if (!process.env.FIRESTORE_EMULATOR_HOST && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
}

if (getApps().length === 0) {
  initializeApp({ projectId: 'gestoray-preview' });
}

const db = getFirestore();

function getDateInt(d = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return parseInt(formatter.format(d).replace(/-/g, ''), 10);
}

async function runBackfill() {
  const startedAt = new Date().toISOString();
  console.log(`\n🚀 [BACKFILL LEDGER] Avvio processo di migrazione storico legacy`);
  console.log(`   Tenant Target: '${targetTenantId}'`);
  console.log(`   Modalità: ${isDryRun ? '🔍 DRY-RUN (Nessuna scrittura)' : '⚡ LIVE (Scrittura idempotente con merge)'}`);
  if (filterModule) console.log(`   Filtro Modulo: '${filterModule}'`);

  const manifest = {
    startedAt,
    completedAt: null,
    tenantId: targetTenantId,
    mode: isDryRun ? 'DRY_RUN' : 'LIVE',
    scannedEntities: 0,
    legacyEntriesFound: 0,
    ledgerEntriesWritten: 0,
    failedEntries: 0,
    detailsByCollection: {},
    status: 'IN_PROGRESS'
  };

  const collectionsToScan = filterModule ? [filterModule] : ['clients', 'products', 'contracts', 'tickets'];

  try {
    for (const colName of collectionsToScan) {
      console.log(`\n📂 Scansione entità nella collezione: /${colName}`);
      manifest.detailsByCollection[colName] = { entities: 0, legacyHistoryDocs: 0 };

      const entitySnap = await db.collection(colName).get();
      manifest.detailsByCollection[colName].entities = entitySnap.size;
      manifest.scannedEntities += entitySnap.size;

      for (const entityDoc of entitySnap.docs) {
        const entityId = entityDoc.id;
        const entityData = entityDoc.data() || {};
        const entityLabel = entityData.original?.nome || entityData.original?.name || entityData.original?.ragioneSociale || entityData.nome || entityId;

        const historySnap = await db.collection(colName).doc(entityId).collection('history').get();
        if (historySnap.empty) continue;

        manifest.detailsByCollection[colName].legacyHistoryDocs += historySnap.size;
        manifest.legacyEntriesFound += historySnap.size;

        console.log(`   ↳ Entità [${entityId}] ('${entityLabel}'): trovati ${historySnap.size} log storici legacy`);

        let batch = db.batch();
        let batchCount = 0;
        let runningVersion = 0;

        for (const histDoc of historySnap.docs) {
          const histData = histDoc.data() || {};
          const histId = histDoc.id;
          runningVersion += 1;

          // ID deterministico a prova di collisione ed idempotente
          const deterministicId = `legacy_${colName}_${entityId}_${histId}`;
          const ledgerRef = db.collection('system_ledger').doc(deterministicId);

          const histDate = histData.timestamp ? new Date(histData.timestamp) : (histData.edits?.createdAt ? new Date(histData.edits.createdAt) : new Date());
          const dateInt = getDateInt(histDate);

          const mutationsMap = {};
          const keysChanged = [];

          if (histData.changes && typeof histData.changes === 'object') {
            for (const [k, v] of Object.entries(histData.changes)) {
              keysChanged.push(k);
              mutationsMap[k] = {
                old: (v && v.old !== undefined) ? v.old : (v && v.oldVal !== undefined ? v.oldVal : null),
                new: (v && v.new !== undefined) ? v.new : (v && v.newVal !== undefined ? v.newVal : null),
                semantics: 'DESCRIPTIVE'
              };
            }
          }

          const ledgerPayload = {
            id: deterministicId,
            tenantId: targetTenantId,
            module: colName,
            entityType: colName.replace(/s$/, ''),
            entityId,
            entityLabel,
            eventType: histData.action === 'ANONYMIZED' ? 'ANONYMIZATION' : 'FIELD_MUTATION',
            baseVersion: runningVersion - 1,
            aggregateVersion: runningVersion,
            keysChanged,
            mutations: mutationsMap,
            reason: histData.notes || histData.original?.changes || 'Migrazione storico legacy',
            performedBy: histData.performedBy || histData.updatedBy || histData.original?.updatedBy || 'system:legacy_migration',
            performedByName: histData.updatedEmail || histData.original?.updatedEmail || undefined,
            actorType: 'USER',
            timestamp: Timestamp.fromDate(histDate),
            dateInt,
            isLegacyBackfilled: true
          };

          if (!isDryRun) {
            batch.set(ledgerRef, ledgerPayload, { merge: true });
            batchCount++;

            if (batchCount >= 400) {
              await batch.commit();
              manifest.ledgerEntriesWritten += batchCount;
              batch = db.batch();
              batchCount = 0;
            }
          } else {
            manifest.ledgerEntriesWritten++;
          }
        }

        if (!isDryRun && batchCount > 0) {
          await batch.commit();
          manifest.ledgerEntriesWritten += batchCount;
        }
      }
    }

    manifest.status = 'COMPLETED';
  } catch (err) {
    console.error('❌ Errore critico durante il backfill:', err);
    manifest.status = 'FAILED';
    manifest.error = err.message;
  } finally {
    manifest.completedAt = new Date().toISOString();
    console.log('\n======================================================');
    console.log(`📊 RISULTATO MIGRAZIONE (${manifest.status}):`);
    console.log(`   Entità Scansionate: ${manifest.scannedEntities}`);
    console.log(`   Log Legacy Rilevati: ${manifest.legacyEntriesFound}`);
    console.log(`   Record Ledger Generati: ${manifest.ledgerEntriesWritten}`);
    console.log('======================================================\n');
  }

  return manifest;
}

runBackfill()
  .then((manifest) => {
    if (manifest.status === 'COMPLETED') {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
