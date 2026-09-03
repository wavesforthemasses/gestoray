import { db, collection, getDocs } from '$lib/firebase';
import { roundCurrency } from '$lib/utils/math';
import type { JobCostingProject } from './schema';

export class JobCostingKPIBridge {
  /**
   * Pure domain function: Single Source of Truth (SSOT) per i KPI di Commessa & Controllo di Gestione
   */
  static calculateKPIs(projectsList: any[]) {
    let valoreTotaleCommesse = 0;
    let costiTotaliConsuntivati = 0;
    let ricaviConsolidati = 0;
    let margineLordoCumulato = 0;
    let commesseInAllerta = 0;
    let commesseInPerdita = 0;
    let commesseAttiveCount = 0;

    for (const d of projectsList) {
      if (!d || d?.derived?.deleted || d?.deleted) continue;
      const p = (d.data ? d.data() : d) as JobCostingProject;

      if (p.status === 'sospesa') continue;

      const contractVal = Number(p.revenues?.contractValue || 0);
      const invoicedVal = Number(p.revenues?.invoicedTotal || 0);
      const targetRev = contractVal > 0 ? contractVal : invoicedVal;
      const totalCost = Number(p.actuals?.total || 0);
      const grossMargin = Number(p.profitability?.grossMarginAmount ?? (targetRev - totalCost));

      valoreTotaleCommesse += targetRev;
      costiTotaliConsuntivati += totalCost;
      ricaviConsolidati += targetRev;
      margineLordoCumulato += grossMargin;

      if (p.status === 'in_corso' || p.status === 'pianificata') {
        commesseAttiveCount++;
      }

      if (p.profitability?.healthStatus === 'warning' || p.profitability?.healthStatus === 'critical') {
        commesseInAllerta++;
      }

      if (p.profitability?.isLossMaking || grossMargin < 0) {
        commesseInPerdita++;
      }
    }

    const margineMedioPercent = ricaviConsolidati > 0 
      ? roundCurrency((margineLordoCumulato / ricaviConsolidati) * 100, 1) 
      : 0;

    return {
      valore_totale_commesse: roundCurrency(valoreTotaleCommesse),
      costi_totali_consuntivati: roundCurrency(costiTotaliConsuntivati),
      margine_medio_percent: margineMedioPercent,
      margine_lordo_totale: roundCurrency(margineLordoCumulato),
      commesse_in_allerta: commesseInAllerta,
      commesse_in_perdita: commesseInPerdita,
      commesse_attive_count: commesseAttiveCount
    };
  }

  static async fetchKPIs() {
    try {
      const snap = await getDocs(collection(db, 'job_costing_projects'));
      return this.calculateKPIs(snap.docs);
    } catch (e) {
      console.warn('Errore calcolo KPI job_costing:', e);
      return {
        valore_totale_commesse: 0,
        costi_totali_consuntivati: 0,
        margine_medio_percent: 0,
        margine_lordo_totale: 0,
        commesse_in_allerta: 0,
        commesse_in_perdita: 0,
        commesse_attive_count: 0
      };
    }
  }
}

export async function getJobCostingKpis() {
  return JobCostingKPIBridge.fetchKPIs();
}
