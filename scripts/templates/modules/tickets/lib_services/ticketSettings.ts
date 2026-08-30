import { db, doc, getDoc, setDoc } from '$lib/firebase';

export interface TicketCategoryConfig {
  id: string;
  label: string;
  enabled?: boolean;
  defaultAssigneeUid?: string;
}

export interface CannedResponseConfig {
  id: string;
  title: string;
  content: string;
}

export interface TicketSlaConfig {
  urgente: number;
  alta: number;
  media: number;
  bassa: number;
}

export interface TicketSettingsConfig {
  allowInternalOnly: boolean;
  allowPublicGenericLink: boolean;
  allowClientDedicatedLink: boolean;
  allowEmailNotifications: boolean;
  allowInboundEmailTickets: boolean;
  webhookSecret: string;
  inboundWebhookToken?: string;
  categories: TicketCategoryConfig[];
  slaHours: TicketSlaConfig;
  cannedResponses: CannedResponseConfig[];
}

export const DEFAULT_TICKET_SETTINGS: TicketSettingsConfig = {
  allowInternalOnly: true,
  allowPublicGenericLink: true,
  allowClientDedicatedLink: true,
  allowEmailNotifications: true,
  allowInboundEmailTickets: true,
  webhookSecret: '',
  inboundWebhookToken: '',
  categories: [
    { id: 'generale', label: 'Generale' },
    { id: 'tecnico', label: 'Supporto Tecnico' },
    { id: 'amministrativo', label: 'Amministrazione / Fatturazione' },
    { id: 'commerciale', label: 'Commerciale' }
  ],
  slaHours: {
    urgente: 4,
    alta: 12,
    media: 24,
    bassa: 48
  },
  cannedResponses: [
    {
      id: '1',
      title: 'Presa in carico',
      content: 'Gentile cliente,\nabbiamo preso in carico la sua segnalazione e il nostro team sta già lavorando alla risoluzione.\nDistinti saluti.'
    },
    {
      id: '2',
      title: 'In attesa di informazioni',
      content: 'Gentile cliente,\nper poter procedere necessitiamo di ulteriori dettagli riguardo al problema riscontrato.\nRestiamo in attesa di un suo riscontro.'
    },
    {
      id: '3',
      title: 'Risoluzione confermata',
      content: 'Gentile cliente,\nle confermiamo che il problema segnalato è stato risolto con successo.\nPuò procedere con le verifiche del caso.'
    }
  ]
};

export const TicketSettingsService = {
  async getSettings(): Promise<TicketSettingsConfig> {
    try {
      const docRef = doc(db, 'settings', 'tickets');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { ...DEFAULT_TICKET_SETTINGS, ...snap.data() };
      }
      return DEFAULT_TICKET_SETTINGS;
    } catch (e) {
      console.error('Errore getSettings Ticket:', e);
      return DEFAULT_TICKET_SETTINGS;
    }
  },

  async saveSettings(config: TicketSettingsConfig): Promise<void> {
    const docRef = doc(db, 'settings', 'tickets');
    await setDoc(docRef, { ...config, updatedAt: new Date().toISOString() }, { merge: true });
  }
};
