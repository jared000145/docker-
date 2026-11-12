// Reconstruct a conservative baseline from the supplied TypeScript database contract.
// Business defaults and policies are maintained separately in reviewed migrations.
import ts from 'typescript';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const source = ts.createSourceFile('types.ts', await readFile('src/integrations/supabase/types.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const db = source.statements.find(s => ts.isTypeAliasDeclaration(s) && s.name.text === 'Database').type;
const member = (node, name) => node.members.find(m => m.name?.getText(source).replaceAll('"', '') === name)?.type;
const schema = member(db, 'public');
const tables = member(schema, 'Tables');
const enums = member(schema, 'Enums');
const quote = value => '"' + value.replaceAll('"', '""') + '"';
const literal = value => "'" + value.replaceAll("'", "''") + "'";
let sql = '-- Reconstructed baseline. See docs/BACKEND.md for assumptions.\n';
for (const item of enums.members) {
  const values = item.type.getText(source).match(/"([^"]+)"/g).map(v => JSON.parse(v));
  sql += `create type public.${quote(item.name.getText(source))} as enum (${values.map(literal).join(', ')});\n`;
}
const all = [];
for (const table of tables.members) {
  const name = table.name.getText(source);
  const row = member(table.type, 'Row');
  const insert = member(table.type, 'Insert');
  const columns = [];
  for (const field of row.members) {
    const column = field.name.getText(source);
    const raw = field.type.getText(source);
    const nullable = /\bnull\b/.test(raw);
    const optional = !!insert.members.find(f => f.name.getText(source) === column)?.questionToken;
    const enumName = raw.match(/Enums"\]\["([^"]+)"/);
    let type = enumName ? `public.${quote(enumName[1])}` : raw.includes('Json') ? 'jsonb' : raw.includes('number') ? 'numeric' : raw.includes('boolean') ? 'boolean' : 'text';
    if (type === 'text' && (column === 'id' || column === 'user_id' || column.endsWith('_id'))) type = 'uuid';
    if (type === 'text' && /^(created_at|updated_at|deleted_at|read_at|paid_at|expires_at)$/.test(column)) type = 'timestamptz';
    if (raw.includes('[]')) type += '[]';
    let fallback = '';
    if (column === 'id' && type === 'uuid') fallback = ' default gen_random_uuid()';
    else if (['created_at', 'updated_at'].includes(column)) fallback = ' default now()';
    else if (optional && !nullable) {
      if (type.endsWith('[]')) fallback = ` default '{}'`;
      else if (type === 'boolean') fallback = ` default ${['is_active', 'accepts_applications'].includes(column) ? 'true' : 'false'}`;
      else if (type === 'numeric') fallback = ' default 0';
      else if (type === 'jsonb') fallback = ` default '{}'::jsonb`;
      else if (type === 'text') fallback = ` default ''`;
      else if (enumName) fallback = ` default ${literal(enumName[1] === 'app_role' ? 'user' : 'role_personnalise')}`;
    }
    columns.push(`  ${quote(column)} ${type}${fallback}${column === 'id' ? ' primary key' : nullable ? '' : ' not null'}`);
  }
  sql += `\ncreate table public.${quote(name)} (\n${columns.join(',\n')}\n);\n`;
  all.push({ name, columns: row.members.map(f => f.name.getText(source)), relationships: member(table.type, 'Relationships')?.getText(source) || '' });
}
const uniqueReferences = new Set();
for (const table of all) {
  for (const match of table.relationships.matchAll(/referencedRelation:\s*"([^"]+)"\s+referencedColumns:\s*\[([^\]]+)\]/g)) {
    if (match[2] !== '"id"' && all.some(t => t.name === match[1])) uniqueReferences.add(`${match[1]}|${match[2]}`);
  }
}
for (const reference of uniqueReferences) {
  const [table, columns] = reference.split('|');
  sql += `alter table public.${quote(table)} add unique (${columns});\n`;
}
for (const table of all) {
  const regex = /foreignKeyName:\s*"([^"]+)"\s+columns:\s*\[([^\]]+)\]\s+isOneToOne:\s*(?:true|false)\s+referencedRelation:\s*"([^"]+)"\s+referencedColumns:\s*\[([^\]]+)\]/g;
  for (const match of table.relationships.matchAll(regex)) {
    if (!all.some(t => t.name === match[3])) continue;
    sql += `alter table public.${quote(table.name)} add constraint ${quote(match[1])} foreign key (${match[2]}) references public.${quote(match[3])} (${match[4]});\n`;
  }
  sql += `alter table public.${quote(table.name)} enable row level security;\n`;
  if (table.columns.includes('institution_id')) sql += `create index on public.${quote(table.name)} (institution_id);\n`;
  if (table.columns.includes('user_id')) sql += `create index on public.${quote(table.name)} (user_id);\n`;
}
await mkdir('supabase/migrations', { recursive: true });
await writeFile('supabase/migrations/202611080001_schema.sql', sql);
await writeFile('scripts/schema-contract.json', JSON.stringify(all.map(({ name, columns }) => ({ name, columns })), null, 2) + '\n');
console.log(`Reconstructed ${all.length} tables. RLS enabled; no access until policy migration.`);
