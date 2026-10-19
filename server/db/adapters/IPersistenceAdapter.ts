import { DatabaseState } from '../database';

export interface QueryFilter<T> {
  where?: Partial<Record<keyof T, any>> | ((item: T) => boolean);
  orderBy?: { field: keyof T; direction: 'ASC' | 'DESC' };
  limit?: number;
  offset?: number;
}

export interface IRepository<T extends { id: string }> {
  findById(id: string): Promise<T | null>;
  findOne(filter: (item: T) => boolean): Promise<T | null>;
  findMany(filter?: (item: T) => boolean): Promise<T[]>;
  create(entity: T): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
  count(filter?: (item: T) => boolean): Promise<number>;
}

export interface IPersistenceAdapter {
  getState(): DatabaseState;
  save(): Promise<void>;
  beginTransaction(): void;
  commit(): void;
  rollback(): void;
  runInTransaction<R>(work: () => R): R;
  isHealthy(): Promise<boolean>;
}
