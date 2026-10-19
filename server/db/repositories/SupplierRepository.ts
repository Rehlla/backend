import { BaseRepository } from './BaseRepository';
import { SupplierEntity, ProductSkuEntity } from '../schema';
import { db } from '../database';

export class SupplierRepository extends BaseRepository<SupplierEntity> {
  constructor() {
    super(database => database.suppliers);
  }

  public async findByLicense(licenseNumber: string): Promise<SupplierEntity | null> {
    return this.findOne(s => s.licenseNumber === licenseNumber || (s as any).cdwsLicenseNumber === licenseNumber);
  }

  public async getSkusForSupplier(supplierId: string): Promise<ProductSkuEntity[]> {
    const skus = db.productSkus.filter(s => s.supplierId === supplierId);
    return JSON.parse(JSON.stringify(skus));
  }
}

export const supplierRepository = new SupplierRepository();
