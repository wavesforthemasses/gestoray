export type PricingUnit = 'ora' | 'forfait' | 'km' | 'pz' | 'mq' | 'mc' | 'quantita' | 'corpo';

export interface TeamItem {
  id?: string;
  name: string;
  leaderUid?: string;
  leaderName?: string;
  memberUids: string[];
  color?: string;
  active?: boolean;
}

export interface VehicleItem {
  id?: string;
  name: string;
  plate: string;
  type?: string;
  status?: string;
}
