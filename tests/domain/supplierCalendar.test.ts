import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SqlitePersistenceAdapter } from '../../server/db/sqlite/SqlitePersistenceAdapter';
import { initializeCmsSchema } from '../../server/db/sqlite/cmsSchema';
import { db } from '../../server/db/database';
import { supplierCalendarService } from '../../server/services/supplierCalendarService';

/**
 * Supplier availability calendar (blueprint row #12).
 *
 * Suppliers block date ranges when they cannot fulfil bookings.
 * Tests cover: create/delete blocks, date overlap detection,
 * monthly calendar view, and validation rules.
 */

let dir: string;
let adapter: SqlitePersistenceAdapter;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-calendar-'));
  const dbFile = path.join(dir, 'test.sqlite');
  adapter = new SqlitePersistenceAdapter(dbFile);
  db.setAdapter(adapter);
  initializeCmsSchema();

  db.suppliers.push({
    id: 'SUP-DIVE',
    businessName: 'Red Sea Divers',
    businessNameAr: 'غواصين البحر الأحمر',
    category: 'diving',
    tier: 'Tier 1 Certified',
    status: 'Active',
    area: 'masbat',
  } as any);
});

afterEach(() => {
  adapter.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('supplierCalendarService', () => {
  describe('createBlock', () => {
    it('creates a block with auto-generated id and timestamp', () => {
      const block = supplierCalendarService.createBlock({
        supplierId: 'SUP-DIVE',
        startDate: '2026-10-01',
        endDate: '2026-10-05',
        reason: 'Annual maintenance',
        createdBy: 'USR-OPS',
      });
      expect(block.id).toMatch(/^BLK-/);
      expect(block.supplierId).toBe('SUP-DIVE');
      expect(block.startDate).toBe('2026-10-01');
      expect(block.endDate).toBe('2026-10-05');
      expect(block.reason).toBe('Annual maintenance');
      expect(block.createdBy).toBe('USR-OPS');
      expect(block.createdAt).toBeDefined();
    });

    it('rejects blocks with invalid date range', () => {
      expect(() =>
        supplierCalendarService.createBlock({
          supplierId: 'SUP-DIVE',
          startDate: '2026-10-10',
          endDate: '2026-10-01',
          reason: 'Wrong order',
          createdBy: 'USR-OPS',
        })
      ).toThrow(/startDate must not be after endDate/i);
    });

    it('rejects blocks with missing supplier', () => {
      expect(() =>
        supplierCalendarService.createBlock({
          supplierId: 'SUP-FAKE',
          startDate: '2026-10-01',
          endDate: '2026-10-05',
          reason: 'Test',
          createdBy: 'USR-OPS',
        })
      ).toThrow(/Supplier not found/i);
    });

    it('rejects blocks with empty reason', () => {
      expect(() =>
        supplierCalendarService.createBlock({
          supplierId: 'SUP-DIVE',
          startDate: '2026-10-01',
          endDate: '2026-10-05',
          reason: '  ',
          createdBy: 'USR-OPS',
        })
      ).toThrow(/reason is required/i);
    });

    it('rejects blocks with invalid date format', () => {
      expect(() =>
        supplierCalendarService.createBlock({
          supplierId: 'SUP-DIVE',
          startDate: '01-10-2026',
          endDate: '2026-10-05',
          reason: 'Bad format',
          createdBy: 'USR-OPS',
        })
      ).toThrow(/startDate must be YYYY-MM-DD/i);
    });

    it('allows overlapping blocks (they stack)', () => {
      supplierCalendarService.createBlock({
        supplierId: 'SUP-DIVE',
        startDate: '2026-10-01',
        endDate: '2026-10-10',
        reason: 'Holiday',
        createdBy: 'USR-OPS',
      });
      const second = supplierCalendarService.createBlock({
        supplierId: 'SUP-DIVE',
        startDate: '2026-10-05',
        endDate: '2026-10-15',
        reason: 'Weather',
        createdBy: 'USR-SYS',
      });
      expect(second.id).toBeDefined();
      expect(db.supplierAvailabilityBlocks.filter(b => b.supplierId === 'SUP-DIVE')).toHaveLength(2);
    });
  });

  describe('deleteBlock', () => {
    it('removes a block by id', () => {
      const block = supplierCalendarService.createBlock({
        supplierId: 'SUP-DIVE',
        startDate: '2026-10-01',
        endDate: '2026-10-05',
        reason: 'Test',
        createdBy: 'USR-OPS',
      });
      expect(supplierCalendarService.deleteBlock(block.id)).toBe(true);
      expect(db.supplierAvailabilityBlocks).toHaveLength(0);
    });

    it('returns false for unknown id', () => {
      expect(supplierCalendarService.deleteBlock('BLK-FAKE')).toBe(false);
    });

    it('respects supplier scope when provided', () => {
      const block = supplierCalendarService.createBlock({
        supplierId: 'SUP-DIVE',
        startDate: '2026-10-01',
        endDate: '2026-10-05',
        reason: 'Test',
        createdBy: 'USR-OPS',
      });
      expect(supplierCalendarService.deleteBlock(block.id, 'SUP-OTHER')).toBe(false);
      expect(db.supplierAvailabilityBlocks).toHaveLength(1);
    });
  });

  describe('isDateBlocked', () => {
    it('returns true for a date within a block range', () => {
      supplierCalendarService.createBlock({
        supplierId: 'SUP-DIVE',
        startDate: '2026-10-01',
        endDate: '2026-10-05',
        reason: 'Holiday',
        createdBy: 'USR-OPS',
      });
      expect(supplierCalendarService.isDateBlocked('SUP-DIVE', '2026-10-03')).toBe(true);
    });

    it('returns true for boundary dates', () => {
      supplierCalendarService.createBlock({
        supplierId: 'SUP-DIVE',
        startDate: '2026-10-01',
        endDate: '2026-10-05',
        reason: 'Holiday',
        createdBy: 'USR-OPS',
      });
      expect(supplierCalendarService.isDateBlocked('SUP-DIVE', '2026-10-01')).toBe(true);
      expect(supplierCalendarService.isDateBlocked('SUP-DIVE', '2026-10-05')).toBe(true);
    });

    it('returns false for dates outside the block range', () => {
      supplierCalendarService.createBlock({
        supplierId: 'SUP-DIVE',
        startDate: '2026-10-01',
        endDate: '2026-10-05',
        reason: 'Holiday',
        createdBy: 'USR-OPS',
      });
      expect(supplierCalendarService.isDateBlocked('SUP-DIVE', '2026-09-30')).toBe(false);
      expect(supplierCalendarService.isDateBlocked('SUP-DIVE', '2026-10-06')).toBe(false);
    });

    it('returns false for different suppliers', () => {
      supplierCalendarService.createBlock({
        supplierId: 'SUP-DIVE',
        startDate: '2026-10-01',
        endDate: '2026-10-05',
        reason: 'Holiday',
        createdBy: 'USR-OPS',
      });
      expect(supplierCalendarService.isDateBlocked('SUP-OTHER', '2026-10-03')).toBe(false);
    });
  });

  describe('isRangeBlocked', () => {
    it('detects overlapping ranges', () => {
      supplierCalendarService.createBlock({
        supplierId: 'SUP-DIVE',
        startDate: '2026-10-05',
        endDate: '2026-10-10',
        reason: 'Holiday',
        createdBy: 'USR-OPS',
      });
      // Requested range overlaps the block
      expect(supplierCalendarService.isRangeBlocked('SUP-DIVE', '2026-10-01', '2026-10-07')).toBe(true);
      // Requested range fully contains the block
      expect(supplierCalendarService.isRangeBlocked('SUP-DIVE', '2026-10-01', '2026-10-20')).toBe(true);
      // Block fully contains the requested range
      expect(supplierCalendarService.isRangeBlocked('SUP-DIVE', '2026-10-06', '2026-10-09')).toBe(true);
    });

    it('returns false for non-overlapping ranges', () => {
      supplierCalendarService.createBlock({
        supplierId: 'SUP-DIVE',
        startDate: '2026-10-05',
        endDate: '2026-10-10',
        reason: 'Holiday',
        createdBy: 'USR-OPS',
      });
      expect(supplierCalendarService.isRangeBlocked('SUP-DIVE', '2026-10-01', '2026-10-04')).toBe(false);
      expect(supplierCalendarService.isRangeBlocked('SUP-DIVE', '2026-10-11', '2026-10-20')).toBe(false);
    });
  });

  describe('monthlyAvailability', () => {
    it('returns a 30-day map with blocked days flagged', () => {
      supplierCalendarService.createBlock({
        supplierId: 'SUP-DIVE',
        startDate: '2026-10-03',
        endDate: '2026-10-07',
        reason: 'Maintenance',
        createdBy: 'USR-OPS',
      });
      const map = supplierCalendarService.monthlyAvailability('SUP-DIVE', '2026-10-01');
      const keys = Object.keys(map);
      expect(keys).toHaveLength(30);
      // Blocked days
      expect(map['2026-10-03']?.blocked).toBe(true);
      expect(map['2026-10-05']?.blocked).toBe(true);
      expect(map['2026-10-07']?.blocked).toBe(true);
      expect(map['2026-10-03']?.reason).toBe('Maintenance');
      // Free days
      expect(map['2026-10-01']?.blocked).toBe(false);
      expect(map['2026-10-15']?.blocked).toBe(false);
    });
  });

  describe('blocksForSupplier', () => {
    it('returns only blocks for the specified supplier', () => {
      supplierCalendarService.createBlock({
        supplierId: 'SUP-DIVE',
        startDate: '2026-10-01',
        endDate: '2026-10-05',
        reason: 'A',
        createdBy: 'USR-OPS',
      });
      supplierCalendarService.createBlock({
        supplierId: 'SUP-DIVE',
        startDate: '2026-11-01',
        endDate: '2026-11-05',
        reason: 'B',
        createdBy: 'USR-OPS',
      });
      expect(supplierCalendarService.blocksForSupplier('SUP-DIVE')).toHaveLength(2);
      expect(supplierCalendarService.blocksForSupplier('SUP-OTHER')).toHaveLength(0);
    });
  });

  describe('supplierExists', () => {
    it('is true for a seeded supplier', () => {
      expect(supplierCalendarService.supplierExists('SUP-DIVE')).toBe(true);
    });

    it('is false for an unknown supplier (the public availability route 404s on this)', () => {
      expect(supplierCalendarService.supplierExists('SUP-NONEXISTENT')).toBe(false);
    });
  });
});
