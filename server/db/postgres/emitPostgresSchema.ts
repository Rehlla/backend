/**
 * Writes the generated PostgreSQL DDL to server/db/sql/postgres-schema.sql.
 *
 *   npm run db:schema:pg
 *
 * Mirrors db:schema (SQLite): the file is not used at runtime — the migration
 * runner in server/db/postgres/pgDdl.ts builds statements from the same
 * TableSpec[] — it exists so schema changes show up in review as SQL.
 */
import fs from 'fs';
import path from 'path';
import { buildPostgresSchemaDdl } from './pgDdl';
import { TABLE_SPECS } from '../sqlite/tableSpecs';

const OUT = path.join(process.cwd(), 'server', 'db', 'sql', 'postgres-schema.sql');

const ddl = buildPostgresSchemaDdl();
fs.writeFileSync(OUT, ddl, 'utf-8');

const tables = TABLE_SPECS.length;
const indexes = (ddl.match(/CREATE INDEX/g) || []).length;
const fks = (ddl.match(/REFERENCES /g) || []).length;

console.log(`${OUT}`);
console.log(`  ${tables} tables · ${indexes} indexes · ${fks} foreign keys`);
