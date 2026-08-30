export type PresenceVerificationMode = 
  | 'self_gps'          // L1: Auto-timbratura con GPS istantaneo on-demand
  | 'proximity_radar'   // L2: Rilevamento automatico ad app aperta (Foreground)
  | 'team_leader'       // L3: Timbratura effettuata dal caposquadra per un membro
  | 'self_manual';      // L4: Auto-dichiarazione manuale senza vincolo GPS

export type PresenceStatus = 
  | 'active'            // Turno attualmente in corso
  | 'completed'         // Turno regolarmente chiuso dall'utente o da nuovo check-in
  | 'auto_closed';       // Turno chiuso dal sistema predittivo per dimenticanza

export interface PlacePresenceGeoVerification {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  distanceFromCenterMeters: number;
  isWithinRadius: boolean;
  geofenceRadiusMeters: number;
}

export interface PlacePresenceLog {
  id: string;
  orgId: string;
  
  // 1. Riferimento al Luogo
  placeId: string;
  placeName: string;
  placeCode?: string;
  parentId?: string | null;           // Se è un lotto, ID del cantiere principale
  parentName?: string;
  
  // 2. Contesto Operativo & Task
  activityId?: string;
  activityName?: string;
  activityCode?: string;
  teamId?: string;
  teamName?: string;
  
  // 3. Utente Lavoratore
  userId: string;
  userName: string;
  userEmail?: string;
  
  // 4. Autore della Registrazione (Audit Trail & Anti-Spoofing)
  verifiedBy: PresenceVerificationMode;
  verifiedByUserId: string;          // Uguale a userId o ID del caposquadra
  verifiedByUserName?: string;
  
  // 5. Telemetria Geospaziale
  geoVerification?: PlacePresenceGeoVerification;

  // 6. Timestamps Resilienti & Offline Sync
  clientEnteredAt: string;            // ISO 8601 catturato localmente
  serverEnteredAt?: any;             // Firestore serverTimestamp()
  clientLeftAt?: string | null;
  serverLeftAt?: any;
  
  // 7. Durata & Chiusura Predittiva
  durationMinutes?: number;
  status: PresenceStatus;
  isEstimatedClosing?: boolean;       // true se chiuso predittivamente per mancato check-out
  
  // 8. Flag di Resilienza & Note
  isOfflineSync?: boolean;
  notes?: string;
  
  createdAt: string;
  updatedAt: string;
}

/**
 * Documento di puntatore deterministico per lock atomico O(1):
 * Path: /organizations/{orgId}/user_active_presences/{userId}
 */
export interface UserActivePresenceSlot {
  activeLogId: string;
  placeId: string;
  placeName: string;
  clientEnteredAt: string;
  activityId?: string;
  activityName?: string;
  updatedAt: string;
}

export type CheckInPromptMode = 
  | 'prompt'    // Semi-automatico (Default): toast/notifica "Arrivo rilevato: Inizia Turno"
  | 'auto'      // 100% Automatico: check-in silenzioso con notifica di conferma
  | 'dock_only' // Minimale/Dock laterale: nessun popup invasivo in sovrimpressione
  | 'manual';   // Solo manuale esplicito

export interface PresenceSettings {
  presenceTrackingEnabled: boolean;  // Master switch aziendale
  defaultMode: PresenceVerificationMode;
  checkInPromptMode: CheckInPromptMode;      // 'prompt' | 'auto' | 'dock_only' | 'manual'
  autoCheckoutOnExit: boolean;              // Se true, esegue checkout automatico all'uscita dal perimetro
  checkoutCooldownMinutes: number;          // Minuti di silenzio dopo il checkout prima di riproporre il check-in (default: 15 min)
  allowManualCheckIn: boolean;              // Consente fallback manuale senza GPS
  requireGpsValidation: boolean;     // Se true, blocca timbratura fuori raggio
  gpsToleranceMeters: number;        // Tolleranza errore GPS (default: 25m)
  allowTeamLeaderCheckin: boolean;   // Consente a foreman/leader di timbrare per il team
  
  // Configurazione Chiusura Predittiva Turni
  predictiveAutoCloseEnabled: boolean;
  defaultMaxShiftHours: number;      // default: 10 ore
  autoCloseGraceMinutes: number;     // default: 60 minuti oltre l'orario attività
}
