/** Future-ride hub. The server owns every price; the client only sends choices. */

export type HubTierId = 'shared' | 'private' | 'premium';
export type HubTripType = 'one' | 'round' | 'multi';
export type HubLuggage = 'small' | 'medium' | 'large';
export type HubMode = 'private' | 'bus';

export interface TransferHubQuoteRequest {
  originId: string;
  destinationId: string;
  tierId: HubTierId;
  tripType: HubTripType;
  stops?: string[];
  date: string;
  time: string;
  returnDate?: string;
  returnTime?: string;
  passengers: number;
  luggage: HubLuggage;
  addonIds: string[];
  mode: HubMode;
  busScheduleId?: string;
}

/** Frozen onto the booking. Supplier cost is ops-only. */
export interface TransferHubQuoteSnapshot {
  originId: string;
  destinationId: string;
  originLabelEn: string;
  originLabelAr: string;
  destinationLabelEn: string;
  destinationLabelAr: string;
  tierId: HubTierId;
  tripType: HubTripType;
  stops: string[];
  mode: HubMode;
  busScheduleId?: string;
  passengers: number;
  luggage: HubLuggage;
  addonIds: string[];
  sellEGP: number;
  supplierCostEGP: number;
  earlyDiscountEGP: number;
  vehicleEGP: number;
  returnEGP: number;
  luggageEGP: number;
  stopsEGP: number;
  addonsEGP: number;
  freeCancelUntil: string | null;
  pickupAt: string;
  returnDate?: string;
  returnTime?: string;
  asap: boolean;
  longHaul: boolean;
  slotId?: string;
  reservedUnits: number;
}

export interface TransferHubPublicQuote extends Omit<TransferHubQuoteSnapshot, 'supplierCostEGP' | 'slotId' | 'reservedUnits'> {
  distanceKm: number;
  durationEn: string;
  durationAr: string;
  busLastMileEGP: number;
  comparison: { privateEGP: number; sharedEGP: number; busLastMileEGP: number };
  tiers: Array<{ id: HubTierId; totalEGP: number }>;
}

export interface TransferHubOpsQuote extends TransferHubPublicQuote {
  supplierCostEGP: number;
  marginEGP: number;
}
