const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const configPath = path.resolve('gestoray.config.json');
const envPath = path.resolve('.env');
const rulesPath = path.resolve('firestore.rules');
const storageRulesPath = path.resolve('storage.rules');

console.log('🚀 Avvio del provisioning di Gestoray su Firebase...');

// 1. Read central configuration
if (!fs.existsSync(configPath)) {
  console.error('❌ Errore: File gestoray.config.json non trovato!');
  process.exit(1);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} catch (e) {
  console.error('❌ Errore: Il file gestoray.config.json non è un JSON valido!', e.message);
  process.exit(1);
}

const { projectId, locationId } = config;

if (!projectId || !locationId) {
  console.error('❌ Errore: projectId e locationId sono richiesti in gestoray.config.json!');
  process.exit(1);
}

console.log(`📌 Configurazione rilevata:`);
console.log(`   - Project ID: ${projectId}`);
console.log(`   - Location:   ${locationId}`);

async function run() {
  try {
    // 2. Select active project
    console.log(`\n🔄 Collegamento al progetto Firebase "${projectId}"...`);
    execSync(`npx firebase use ${projectId}`, { stdio: 'inherit' });

    // 3. Initialize Firestore Database (if not already initialized)
    console.log('\n🗄️  Verifica e attivazione del database Firestore...');
    try {
      execSync(`npx firebase firestore:databases:create "(default)" --location ${locationId} --project ${projectId}`, { stdio: 'inherit' });
      console.log('✅ Database Firestore inizializzato con successo.');
    } catch (e) {
      console.log('ℹ️  Nota: Il database Firestore (default) potrebbe essere già attivo o inizializzato.');
    }

    // 4. Check for Web Apps or create one
    console.log('\n🌐 Verifica delle applicazioni Web registrate nel progetto...');
    let appsJson;
    try {
      const output = execSync(`npx firebase apps:list --project ${projectId} --json`, { encoding: 'utf-8' });
      appsJson = JSON.parse(output);
    } catch (e) {
      console.warn('⚠️  Impossibile elencare le app tramite JSON. Tentativo di recupero configurazione...');
    }

    let webApp = null;
    if (appsJson && appsJson.result) {
      webApp = appsJson.result.find(app => app.platform === 'WEB');
    }

    if (!webApp) {
      console.log('➕ Nessuna app Web trovata. Creazione dell\'app "gestoray-web-app"...');
      try {
        execSync(`npx firebase apps:create web gestoray-web-app --project ${projectId}`, { stdio: 'inherit' });
        console.log('✅ Applicazione Web "gestoray-web-app" registrata.');
      } catch (e) {
        console.error('❌ Errore durante la creazione dell\'app Web:', e.message);
      }
    } else {
      console.log(`✅ App Web esistente rilevata: ${webApp.displayName} (${webApp.appId})`);
    }

    // 5. Fetch SDK Config and write .env
    console.log('\n🔑 Recupero delle credenziali SDK di Firebase...');
    const sdkOutput = execSync(`npx firebase apps:sdkconfig WEB --project ${projectId}`, { encoding: 'utf-8' });
    
    // Find JSON block in output
    const jsonStart = sdkOutput.indexOf('{');
    const jsonEnd = sdkOutput.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('Impossibile decodificare le credenziali SDK di Firebase.');
    }
    
    const sdkConfig = JSON.parse(sdkOutput.substring(jsonStart, jsonEnd + 1));
    
    // Create .env file content
    const envContent = `# Configurazione di Produzione Firebase - Generata Automaticamente
VITE_FIREBASE_API_KEY=${sdkConfig.apiKey}
VITE_FIREBASE_AUTH_DOMAIN=${sdkConfig.authDomain}
VITE_FIREBASE_PROJECT_ID=${sdkConfig.projectId}
VITE_FIREBASE_STORAGE_BUCKET=${sdkConfig.storageBucket}
VITE_FIREBASE_MESSAGING_SENDER_ID=${sdkConfig.messagingSenderId}
VITE_FIREBASE_APP_ID=${sdkConfig.appId}
`;

    fs.writeFileSync(envPath, envContent, 'utf-8');
    console.log('✅ File .env configurato ed esportato con successo in root del progetto.');

    // 6. Deploy Firestore & Storage Security Rules (Gracefully)
    console.log('\n🛡️  Distribuzione delle regole di sicurezza...');
    if (fs.existsSync(rulesPath)) {
      try {
        console.log('   - Caricamento regole Firestore...');
        execSync(`npx firebase deploy --only firestore:rules --project ${projectId}`, { stdio: 'inherit' });
        console.log('   ✅ Regole Firestore attivate.');
      } catch (err) {
        console.error('   ❌ Errore durante il deploy delle regole Firestore:', err.message);
      }
    }
    if (fs.existsSync(storageRulesPath)) {
      try {
        console.log('   - Caricamento regole Storage...');
        execSync(`npx firebase deploy --only storage:rules --project ${projectId}`, { stdio: 'inherit' });
        console.log('   ✅ Regole Storage attivate.');
      } catch (err) {
        console.warn('   ⚠️  Nota: Non è stato possibile caricare le regole dello Storage.');
        console.warn('      Questo succede se non hai ancora attivato Cloud Storage nella console di Firebase.');
        console.warn(`      Vai su: https://console.firebase.google.com/project/${projectId}/storage e clicca su "Inizia".`);
      }
    }

    // 7. Cloud Functions Instructions
    console.log('\n⚡ PROSSIMO PASSO: Deploy delle Cloud Functions');
    console.log('   Per far funzionare il login basato su PIN e il seeding dell\'amministratore,');
    console.log('   devi compilare e caricare le Cloud Functions sul tuo progetto reale.');
    console.log('   Esegui questo comando nel terminale per compilarle e caricarle:');
    console.log('\n   👉 npm --prefix functions run build && npx firebase deploy --only functions');

    console.log('\n🎉 PROVISIONING BASE COMPLETATO CON SUCCESSO!');
    console.log('Una volta caricate le Cloud Functions:');
    console.log('1. Avvia l\'app in sviluppo locale: npm run dev');
    console.log('2. Visita la pagina http://localhost:5173/init nel browser.');
    console.log('3. Clicca su "Inizializza Superadmin" per creare il primo utente reale.');

  } catch (err) {
    console.error('\n❌ Errore fatale durante il setup del progetto:', err.message);
    process.exit(1);
  }
}

run();
