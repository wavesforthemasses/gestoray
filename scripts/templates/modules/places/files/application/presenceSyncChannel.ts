/**
 * Canale di sincronizzazione multi-tab per gli eventi di presenza geolocalizzata.
 * Previene la duplicazione dei prompt e sincronizza lo stato del Sentinel tra schede del browser aperte.
 */

export type PresenceSyncEvent =
  | { type: 'CHECK_IN'; payload: { placeId: string; logId: string; placeName: string } }
  | { type: 'CHECK_OUT'; payload: { logId: string } }
  | { type: 'DISMISS_PROMPT'; payload: { placeId: string; timestamp: number } }
  | { type: 'PAUSE_SHIFT'; payload: { placeId: string; logId: string } };

export class PresenceSyncChannel {
  private channel: BroadcastChannel | null = null;

  constructor(private onMessage: (event: PresenceSyncEvent) => void) {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('gestoray_presence_sync');
        this.channel.onmessage = (e: MessageEvent<PresenceSyncEvent>) => {
          if (e && e.data && e.data.type) {
            this.onMessage(e.data);
          }
        };
      } catch (err) {
        console.warn('[PresenceSyncChannel] BroadcastChannel non supportato:', err);
      }
    }
  }

  notifyCheckIn(placeId: string, logId: string, placeName: string) {
    this.channel?.postMessage({
      type: 'CHECK_IN',
      payload: { placeId, logId, placeName }
    });
  }

  notifyCheckOut(logId: string) {
    this.channel?.postMessage({
      type: 'CHECK_OUT',
      payload: { logId }
    });
  }

  notifyDismiss(placeId: string) {
    this.channel?.postMessage({
      type: 'DISMISS_PROMPT',
      payload: { placeId, timestamp: Date.now() }
    });
  }

  notifyPause(placeId: string, logId: string) {
    this.channel?.postMessage({
      type: 'PAUSE_SHIFT',
      payload: { placeId, logId }
    });
  }

  close() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }

  destroy() {
    this.close();
  }
}
