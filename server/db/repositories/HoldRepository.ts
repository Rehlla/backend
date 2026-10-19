import { BaseRepository } from './BaseRepository';
import { HoldEntity, InventorySlotEntity } from '../schema';
import { db } from '../database';

export class HoldRepository extends BaseRepository<HoldEntity> {
  constructor() {
    super(database => database.holds);
  }

  public async findByToken(holdToken: string): Promise<HoldEntity | null> {
    return this.findOne(h => h.holdToken === holdToken);
  }

  public async findActiveHoldsForSku(skuId: string): Promise<HoldEntity[]> {
    const now = new Date().toISOString();
    return this.findMany(h => 
      h.skuId === skuId && 
      h.status === 'ACTIVE' && 
      h.expiresAt > now
    );
  }

  public async getInventorySlot(skuId: string, date: string, timeSlot: string): Promise<InventorySlotEntity | null> {
    const slot = db.inventorySlots.find(s => s.skuId === skuId && s.date === date && s.timeSlot === timeSlot);
    return slot ? JSON.parse(JSON.stringify(slot)) : null;
  }
}

export const holdRepository = new HoldRepository();
