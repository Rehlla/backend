/**
 * Writes the generated DDL to server/db/sql/sqlite-schema.sql.
 *
 *   npm run db:schema
 *
 * The adapter creates its schema from tableSpecs.ts directly, so this file is
 * not used at runtime. It exists to be readable and diffable: a schema change
 * should show up in a pull request as SQL, not only as a spec edit.
 */
import fs from 'fs';
import path from 'path';
import { buildSchemaDdl } from './schemaBuilder';
import { TABLE_SPECS } from './tableSpecs';

const OUT = path.join(process.cwd(), 'server', 'db', 'sql', 'sqlite-schema.sql');

const ddl = buildSchemaDdl();
fs.writeFileSync(OUT, ddl, 'utf-8');

const tables = TABLE_SPECS.length;
const indexes = (ddl.match(/CREATE INDEX/g) || []).length;
const fks = (ddl.match(/REFERENCES /g) || []).length;

console.log(`${OUT}`);
console.log(`  ${tables} tables · ${indexes} indexes · ${fks} foreign keys`);
