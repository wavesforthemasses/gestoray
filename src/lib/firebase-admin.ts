import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('src/lib/mock-db.json');

function readDb() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ users: {}, login_pins: {}, sessions: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
}

function writeDb(data: any) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

class MockAdminFirestore {
  collection(name: string) {
    return {
      doc: (id: string) => {
        return {
          set: async (data: any) => {
            const db = readDb();
            if (!db[name]) db[name] = {};
            db[name][id] = data;
            writeDb(db);
          },
          get: async () => {
            const db = readDb();
            const docData = db[name]?.[id];
            return {
              exists: docData !== undefined,
              data: () => docData
            };
          },
          delete: async () => {
            const db = readDb();
            if (db[name] && db[name][id]) {
              delete db[name][id];
              writeDb(db);
            }
          }
        };
      },
      where: (field: string, operator: string, value: any) => {
        return {
          get: async () => {
            const db = readDb();
            const col = db[name] || {};
            const docs: any[] = [];
            
            Object.keys(col).forEach((id) => {
              const data = col[id];
              if (operator === '==' && data[field] === value) {
                docs.push({
                  id,
                  data: () => data
                });
              }
            });
            
            return {
              empty: docs.length === 0,
              docs
            };
          }
        };
      },
      get: async () => {
        const db = readDb();
        const col = db[name] || {};
        const docs: any[] = [];
        Object.keys(col).forEach((id) => {
          docs.push({
            id,
            data: () => col[id]
          });
        });
        return {
          forEach: (callback: any) => docs.forEach(callback)
        };
      }
    };
  }
}

class MockAdminAuth {
  async getUserByEmail(email: string) {
    const db = readDb();
    const users = db.users || {};
    const uid = Object.keys(users).find(id => users[id].email === email);
    if (!uid) {
      const err = new Error('User not found');
      (err as any).code = 'auth/user-not-found';
      throw err;
    }
    return { uid, email };
  }

  async createUser(properties: any) {
    const uid = 'uid_' + Math.random().toString(36).substring(2, 11);
    return { uid, email: properties.email };
  }

  async updateUser(uid: string, properties: any) {
    return { uid, email: properties.email };
  }

  async createCustomToken(uid: string) {
    return `mock-token-${uid}`;
  }
}

export const adminAuth = new MockAdminAuth();
export const adminDb = new MockAdminFirestore();
