import { db, Database } from '../database';
import { IRepository } from '../adapters/IPersistenceAdapter';

export abstract class BaseRepository<T extends { id: string }> implements IRepository<T> {
  protected constructor(
    protected readonly collectionGetter: (database: Database) => T[]
  ) {}

  protected get collection(): T[] {
    return this.collectionGetter(db);
  }

  public async findById(id: string): Promise<T | null> {
    const item = this.collection.find(i => i.id === id);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  public async findOne(filter: (item: T) => boolean): Promise<T | null> {
    const item = this.collection.find(filter);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  public async findMany(filter?: (item: T) => boolean): Promise<T[]> {
    const items = filter ? this.collection.filter(filter) : this.collection;
    return JSON.parse(JSON.stringify(items));
  }

  public async create(entity: T): Promise<T> {
    const exists = this.collection.findIndex(i => i.id === entity.id);
    if (exists >= 0) {
      throw new Error(`Entity with ID ${entity.id} already exists.`);
    }
    const cloned = JSON.parse(JSON.stringify(entity));
    this.collection.push(cloned);
    db.saveToDisk();
    return cloned;
  }

  public async update(id: string, patch: Partial<T>): Promise<T | null> {
    const idx = this.collection.findIndex(i => i.id === id);
    if (idx < 0) return null;
    this.collection[idx] = { ...this.collection[idx], ...patch };
    db.saveToDisk();
    return JSON.parse(JSON.stringify(this.collection[idx]));
  }

  public async delete(id: string): Promise<boolean> {
    const idx = this.collection.findIndex(i => i.id === id);
    if (idx < 0) return false;
    this.collection.splice(idx, 1);
    db.saveToDisk();
    return true;
  }

  public async count(filter?: (item: T) => boolean): Promise<number> {
    if (!filter) return this.collection.length;
    return this.collection.filter(filter).length;
  }
}
