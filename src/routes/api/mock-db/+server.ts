import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('src/lib/mock-db.json');

function readDb() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ users: {}, login_pins: {}, sessions: {} }, null, 2));
  }
  const data = fs.readFileSync(dbPath, 'utf-8');
  return JSON.parse(data);
}

function writeDb(data: any) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

export const GET: RequestHandler = async () => {
  const db = readDb();
  return json(db);
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const db = readDb();
  
  const { action, collection, id, data } = body;
  
  if (action === 'set') {
    if (!db[collection]) db[collection] = {};
    db[collection][id] = data;
    writeDb(db);
    return json({ success: true });
  } else if (action === 'delete') {
    if (db[collection] && db[collection][id]) {
      delete db[collection][id];
      writeDb(db);
    }
    return json({ success: true });
  }
  
  return json({ error: 'Action invalid' }, { status: 400 });
};
