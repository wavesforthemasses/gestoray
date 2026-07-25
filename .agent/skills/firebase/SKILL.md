---
name: "Firebase & Firestore Best Practices"
description: "Rules for updating firestore.rules, indexes, and document size safeguards (1MB limit) in Firebase/Firestore."
---

# Firebase & Firestore Best Practices

When working on features that interact with Firebase and Firestore, you MUST adhere to the following rules:

## 1. Always Update Firestore Rules
Whenever you create a new Firestore collection or modify the data access patterns of an existing collection, you MUST update the `firestore.rules` file to reflect the security requirements.
- Never assume a collection will just work. By default, it will be blocked if not defined in `firestore.rules`.
- Make sure to define `allow read` and `allow write` (or `create`, `update`, `delete`) based on the application's role-based access control (RBAC).
- Typical roles to check are `isAuth()`, `isAdmin()`, `hasRole('superadmin')`, or document-level ownership (e.g. `resource.data.createdBy == request.auth.uid`).

## 2. Always Manage Indexes
If you introduce a query that filters or sorts on multiple fields (e.g., `where('status', '==', 'active')` combined with `orderBy('createdAt', 'desc')`), Firestore requires a composite index.
- If you write a new complex query in the frontend or backend, you MUST add the necessary index definition to `firestore.indexes.json`.
- Do not wait for the application to crash in production to realize an index is missing.

## 3. Strict 1MB Document Limit Safeguard & Subcollections
Firestore imposes a hard limit of **1 MB per single document** (1,048,576 bytes).
- **NEVER store unbound arrays** inside a document (e.g., historical change logs, payment history, activity comments, sub-items).
- **ALWAYS use Subcollections** for unbound relations (e.g. `clients/{id}/history`, `contracts/{id}/installments`).
- **ALWAYS use Sharded Chunking (`CacheLookupService`)** for lookup caches (`system_cache/{type}_chunk_{n}` with max 200 items per doc).

## 4. Verify Security Before Completing the Task
Before concluding your work on any feature involving data modeling, double-check that both `firestore.rules` and `firestore.indexes.json` are up to date. The feature is NOT complete until the security rules are in place.
