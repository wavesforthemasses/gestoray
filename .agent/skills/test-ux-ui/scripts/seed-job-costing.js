import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, connectAuthEmulator } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "fake-api-key",
  authDomain: "gesto-ray.firebaseapp.com",
  projectId: "gesto-ray",
  storageBucket: "gesto-ray.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
connectAuthEmulator(auth, 'http://localhost:9099');
connectFirestoreEmulator(db, 'localhost', 8080);

async function main() {
  console.log('Autenticazione come test-super@app.local...');
  await signInWithEmailAndPassword(auth, 'test-super@app.local', 'password123');
  console.log('Autenticato! Seeding dati di test Job Costing negli emulatori...');

  // 1. Cantiere
  const placeId = 'place_aurora_01';
  await setDoc(doc(db, 'places', placeId), {
    id: placeId,
    code: 'PLC-2026-088',
    name: 'Cantiere Aurora - Torre Residenziale',
    address: 'Via della Libertà 45',
    city: 'Milano',
    province: 'MI',
    status: 'active',
    type: 'cantiere',
    createdAt: '2026-01-15T09:00:00Z'
  });

  // 2. Cliente
  const clientId = 'client_aurora_spa';
  await setDoc(doc(db, 'clients', clientId), {
    id: clientId,
    name: 'Immobiliare Aurora S.p.A.',
    ragioneSociale: 'Immobiliare Aurora S.p.A.',
    piva: 'IT01239874561',
    codiceFiscale: '01239874561',
    address: 'Piazza Duomo 10, Milano'
  });

  // 3. Contratto
  const contractId = 'contract_aurora_appalto';
  await setDoc(doc(db, 'contracts', contractId), {
    id: contractId,
    code: 'CTR-2026-088',
    title: 'Appalto Riqualificazione Energetica Torre A',
    clientId,
    placeId,
    totalAmount: 95000,
    status: 'in_corso'
  });

  // 4. Commessa Principale in Utile (COMM-2026-001)
  const proj1Id = 'job_aurora_001';
  await setDoc(doc(db, 'job_costing_projects', proj1Id), {
    id: proj1Id,
    code: 'COMM-2026-001',
    title: 'Riqualificazione Energetica & Impianti Torre Aurora',
    description: 'Intervento completo cappotto termico 14cm, sostituzione infissi e centrale termica',
    placeId,
    placeName: 'Cantiere Aurora - Torre Residenziale',
    includeSubPlaces: true,
    clientId,
    clientName: 'Immobiliare Aurora S.p.A.',
    contractId,
    contractTitle: 'Appalto Riqualificazione Energetica Torre A',
    status: 'in_corso',
    startDate: '2026-03-01',
    expectedEndDate: '2026-11-30',
    budget: {
      labor: 28000,
      materials: 22000,
      equipment: 8000,
      subcontractor: 12000,
      other: 3000,
      total: 73000
    },
    actuals: {
      labor: 19500,
      materials: 15400,
      equipment: 5200,
      subcontractor: 9000,
      other: 1500,
      total: 50600,
      laborHoursTotal: 650,
      materialsCountTotal: 120
    },
    revenues: {
      contractValue: 95000,
      invoicedTotal: 60000,
      paidTotal: 45000
    },
    profitability: {
      grossMarginAmount: 44400,
      grossMarginPercent: 46.7,
      realizedMarginAmount: 9400,
      budgetVarianceAmount: -22400,
      budgetVariancePercent: -30.7,
      isOverBudget: false,
      isLossMaking: false,
      healthStatus: 'healthy'
    },
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: new Date().toISOString()
  });

  // Sub-collezione cost_items per COMM-2026-001
  const costItems = [
    {
      id: 'cost_01',
      date: '2026-04-15',
      category: 'labor',
      description: 'Manodopera squadra edile e carpentieri (250h)',
      sourceType: 'intervention',
      quantity: 250,
      unitCost: 30,
      totalCost: 7500,
      workerOrSupplierName: 'Squadra Edile Alfa'
    },
    {
      id: 'cost_02',
      date: '2026-05-02',
      category: 'materials',
      description: 'Pannelli EPS grafite 14cm + Collante rasante (scarico FIFO)',
      sourceType: 'warehouse_movement',
      quantity: 80,
      unitCost: 110,
      totalCost: 8800,
      workerOrSupplierName: 'Magazzino Centrale'
    },
    {
      id: 'cost_03',
      date: '2026-05-20',
      category: 'equipment',
      description: 'Nolo piattaforma aerea articolata 28m con operatore',
      sourceType: 'manual',
      quantity: 4,
      unitCost: 850,
      totalCost: 3400,
      workerOrSupplierName: 'NoloMezzi Express Srl'
    },
    {
      id: 'cost_04',
      date: '2026-06-10',
      category: 'subcontractor',
      description: 'Posa in opera canalizzazioni e cablaggi quadro primario',
      sourceType: 'manual',
      quantity: 1,
      unitCost: 6500,
      totalCost: 6500,
      workerOrSupplierName: 'ElettroImpianti Srl'
    },
    {
      id: 'cost_05',
      date: '2026-06-25',
      category: 'other',
      description: 'Oneri di sicurezza e smaltimento macerie cantiere',
      sourceType: 'manual',
      quantity: 1,
      unitCost: 1500,
      totalCost: 1500,
      workerOrSupplierName: 'EcoSmaltimenti SpA'
    }
  ];

  for (const ci of costItems) {
    await setDoc(doc(db, 'job_costing_projects', proj1Id, 'cost_items', ci.id), ci);
  }

  // 5. Commessa Secondaria in Allerta / Attenzione Margine (COMM-2026-002)
  const proj2Id = 'job_tetto_002';
  await setDoc(doc(db, 'job_costing_projects', proj2Id), {
    id: proj2Id,
    code: 'COMM-2026-002',
    title: 'Manutenzione Straordinaria Copertura Industriale',
    description: 'Bonifica guaina bituminosa e lattonerie capannone nord',
    placeId,
    placeName: 'Cantiere Aurora - Torre Residenziale',
    includeSubPlaces: false,
    clientId,
    clientName: 'Immobiliare Aurora S.p.A.',
    status: 'in_corso',
    startDate: '2026-04-10',
    expectedEndDate: '2026-07-31',
    budget: {
      labor: 8000,
      materials: 6000,
      equipment: 2000,
      subcontractor: 1000,
      other: 500,
      total: 17500
    },
    actuals: {
      labor: 9200,
      materials: 6800,
      equipment: 2200,
      subcontractor: 1200,
      other: 400,
      total: 19800,
      laborHoursTotal: 290,
      materialsCountTotal: 45
    },
    revenues: {
      contractValue: 22000,
      invoicedTotal: 22000,
      paidTotal: 15000
    },
    profitability: {
      grossMarginAmount: 2200,
      grossMarginPercent: 10.0,
      realizedMarginAmount: 2200,
      budgetVarianceAmount: 2300,
      budgetVariancePercent: 13.1,
      isOverBudget: true,
      isLossMaking: false,
      healthStatus: 'warning'
    },
    createdAt: '2026-04-10T08:00:00Z',
    updatedAt: new Date().toISOString()
  });

  console.log('✅ Dati di test Job Costing creati con successo negli emulatori!');
}

main().catch(err => {
  console.error('❌ Errore creazione dati:', err);
  process.exit(1);
});
