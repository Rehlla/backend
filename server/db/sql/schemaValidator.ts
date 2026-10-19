import fs from 'fs';
import path from 'path';

export interface SqlValidationResult {
  valid: boolean;
  tableCount: number;
  indexCount: number;
  foreignKeyCount: number;
  tables: string[];
  errors: string[];
}

export function validatePostgreSqlSchema(schemaPath?: string): SqlValidationResult {
  const targetPath = schemaPath || path.join(process.cwd(), 'server', 'db', 'sql', 'schema.sql');
  const sqlContent = fs.readFileSync(targetPath, 'utf8');

  const tables: string[] = [];
  const errors: string[] = [];

  // Match CREATE TABLE statements
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_0-9]+)/gi;
  let match;
  while ((match = tableRegex.exec(sqlContent)) !== null) {
    tables.push(match[1]);
  }

  // Match Indexes
  const indexMatches = sqlContent.match(/CREATE\s+INDEX/gi) || [];

  // Match Foreign Keys
  const fkMatches = sqlContent.match(/REFERENCES\s+([a-z_0-9]+)/gi) || [];

  // Syntax sanity checks
  if (tables.length === 0) {
    errors.push('No CREATE TABLE definitions found in schema.sql');
  }

  const requiredTables = ['users', 'sessions', 'trips', 'trip_items', 'suppliers', 'product_skus', 'inventory_slots', 'holds', 'bookings', 'payments', 'ledger_entries', 'audit_events'];
  for (const reqTable of requiredTables) {
    if (!tables.includes(reqTable)) {
      errors.push(`Missing required core table: ${reqTable}`);
    }
  }

  return {
    valid: errors.length === 0,
    tableCount: tables.length,
    indexCount: indexMatches.length,
    foreignKeyCount: fkMatches.length,
    tables,
    errors
  };
}
