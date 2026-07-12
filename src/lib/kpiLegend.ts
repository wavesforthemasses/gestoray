export const KPI_LEGEND: Record<string, { label: string; description: string }> = {
  VSS: { label: 'Venduto Netto', description: 'Valore dei contratti venduti o approvati.' },
  GI: { label: 'Incassato Netto', description: 'Valore dei pagamenti effettivamente incassati.' },
  NA: { label: 'Nuove Anagrafiche', description: 'Totale dei nuovi clienti o lead (anagrafiche) inseriti a sistema.' },
  NNCF: { label: 'Primi Ordini', description: 'Nuovi clienti che hanno effettuato il loro primo ordine.' },
  TF: { label: 'Telefonate Fatte', description: 'Numero totale di telefonate loggate a sistema.' },
  IF: { label: 'Incontri Fatti', description: 'Numero totale di incontri loggati a sistema.' },
  AF: { label: 'Appuntamenti Fissati', description: 'Numero totale di appuntamenti loggati a sistema.' },
  PM: { label: 'Provvigioni Maturate', description: 'Totale delle provvigioni calcolate sui contratti incassati.' }
};
