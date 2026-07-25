---
name: "Analytics and Business Intelligence Architecture"
description: "Rules for implementing scalable, cost-effective dashboards and analytics using Event-Driven Materialized Views and the Diff pattern in Firebase/Firestore."
---

# Analytics & Business Intelligence Architecture (Gestoray)

When implementing analytics, dashboards, or any kind of numerical aggregation in Gestoray, **DO NOT** use on-demand `GET` or `aggregate()` queries for large datasets (e.g., fetching all documents to sum them up on the fly). This is slow, expensive, and unscalable.

Instead, you MUST use the **Event-Driven Materialized Views** pattern combined with the **Diff Strategy**, and document it using a **Lambda Architecture** structure.

## Core Principles

1. **The Stats Collection**: All aggregated data should live in a dedicated Firestore root collection (e.g., `analytics_monthly`).
2. **Subcollections for Dimensions**: To avoid exceeding the 1MB document limit, use subcollections for breaking down the data by specific dimensions.
   - Example structure: `analytics_monthly/{YYYY_MM}/consultants/{consultantId}`
   - Example structure: `analytics_monthly/{YYYY_MM}/clients/{clientId}`
3. **Event-Driven Updates (The Diff Pattern)**:
   - Listen to `onWrite` events for the primary collection (e.g., `interventions`, `contracts`).
   - Calculate the numeric differences (Diff) between the `before` data and the `after` data.
   - Apply those diffs to the specific stats documents using `FieldValue.increment()`.

## Implementation Skeleton (The Diff Pattern)

When writing Cloud Functions for analytics, follow this structure:

```typescript
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export const aggregateInterventionStats = onDocumentWritten('interventions/{docId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  
  // 1. Calculate the numeric Diffs
  let diffRevenue = 0;
  let diffHours = 0;
  
  if (before) {
    diffRevenue -= (before.totalPrice || 0);
    diffHours -= (before.actualHours || 0);
  }
  if (after) {
    diffRevenue += (after.totalPrice || 0);
    diffHours += (after.actualHours || 0);
  }
  
  if (diffRevenue === 0 && diffHours === 0) return; // No change

  const db = getFirestore();
  const month = getMonthString(after?.date || before?.date); // e.g., '2026-07'
  const consultantId = after?.consultantId || before?.consultantId;
  
  // 2. Build the Increment payload
  const updatePayload = {
    totalRevenue: FieldValue.increment(diffRevenue),
    totalHours: FieldValue.increment(diffHours)
  };

  // 3. Apply the Diff to the specific Dimension Documents
  const batch = db.batch();
  
  // General Monthly Total
  const generalRef = db.collection('analytics_monthly').doc(month);
  batch.set(generalRef, updatePayload, { merge: true });
  
  // Consultant Specific Total
  if (consultantId) {
    const consultantRef = generalRef.collection('consultants').doc(consultantId);
    batch.set(consultantRef, updatePayload, { merge: true });
  }

  await batch.commit();
});
```

## Resilience (Lambda Architecture)

Because `onWrite` functions can occasionally fail or be retried incorrectly, you MUST ensure there is a mechanism to heal the data.
1. The realtime function (above) is the **Speed Layer**.
2. If requested by the user, you should also design a **Batch Layer**: a scheduled function (`onSchedule`) that runs nightly, recalculates the exact sums from the raw collection using `aggregate()` queries, and overwrites the `analytics_monthly` documents for the current month, ensuring absolute data integrity.
