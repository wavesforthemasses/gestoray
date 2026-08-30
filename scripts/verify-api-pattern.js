import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const FORBIDDEN_TOKENS = [
  'getDoc', 'getDocs', 'addDoc', 'updateDoc', 'deleteDoc', 'setDoc',
  'collection', 'doc', 'query', 'where', 'orderBy', 'limit',
  'getCountFromServer', 'getAggregateFromServer'
];

// Directories to scan
const SCAN_DIRS = [
  path.join(ROOT, 'src'),
  path.join(ROOT, 'scripts/templates/modules')
];

// Paths to ignore
const IGNORE_PATTERNS = [
  'node_modules',
  'src/lib/services',         // Services are ALLOWED to query DB
  'lib_services',
  'extra_stores',
  '.service.ts',              // Any service file
  'Service.ts',               // Any service file with Service.ts
  'Settings.ts',
  'SettingsService.ts',
  'Repository.ts',            // Infrastructure Repository Pattern (DDD)
  '.test.ts',                 // Unit & Integration test files
  '.spec.ts',                 // Spec test files
  '.bridge.ts',               // Any bridge file
  '+server.ts',               // Backend API routes
  'src/lib/firebase.ts',      // The firebase init file itself
  'seed-emulators.js'         // Scripts
];

function shouldIgnore(filePath) {
  // Use forward slashes for cross-platform matching consistency if needed, but path.includes works for exact substrings
  const normalized = filePath.replace(/\\/g, '/');
  return IGNORE_PATTERNS.some(pattern => normalized.includes(pattern));
}

function getFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const list = fs.readdirSync(dir);
  for (let file of list) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!shouldIgnore(fullPath)) {
        getFiles(fullPath, files);
      }
    } else {
      if ((fullPath.endsWith('.svelte') || fullPath.endsWith('.ts')) && !shouldIgnore(fullPath)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

let violations = [];

const firebaseImportRegex = /import\s+{([^}]+)}\s+from\s+['"](?:\$lib\/firebase|firebase\/firestore)['"]/g;

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // We match across the whole file to handle multiline imports, then check tokens
  let match;
  while ((match = firebaseImportRegex.exec(content)) !== null) {
    const importedItems = match[1];
    for (const token of FORBIDDEN_TOKENS) {
      // Check if token exists as a whole word in the import block
      const regex = new RegExp(`\\b${token}\\b`);
      if (regex.test(importedItems)) {
        // Find line number
        const lineNum = content.substring(0, match.index).split('\n').length;
        violations.push({
          file: filePath.replace(ROOT, ''),
          line: lineNum,
          token: token
        });
      }
    }
  }
}

// 1. Gather files
let allFiles = [];
for (const dir of SCAN_DIRS) {
  allFiles = allFiles.concat(getFiles(dir));
}

// 2. Analyze
for (const file of allFiles) {
  analyzeFile(file);
}

// 3. Report
if (violations.length > 0) {
  console.error(`\n❌ API PATTERN VIOLATION DETECTED ❌`);
  console.error(`Found ${violations.length} direct database queries in UI components or non-service files.\n`);
  
  const grouped = violations.reduce((acc, v) => {
    if (!acc[v.file]) acc[v.file] = [];
    acc[v.file].push(`Line ${v.line}: '${v.token}'`);
    return acc;
  }, {});

  for (const [file, errors] of Object.entries(grouped)) {
    console.error(`📁 ${file}`);
    for (const err of [...new Set(errors)]) { // remove duplicates if any
      console.error(`   -> ${err}`);
    }
  }
  
  console.error(`\n🚨 REFACTOR REQUIRED: Tutte queste query devono essere spostate nei rispettivi file .service.ts\n`);
  process.exit(1);
} else {
  console.log(`\n✅ API PATTERN VERIFIED ✅`);
  console.log(`Nessuna query diretta al DB trovata nei file frontend.\n`);
  process.exit(0);
}
