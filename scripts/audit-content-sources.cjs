#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'dnd_builder.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!script) throw new Error('Inline application script not found');
const initAt = script.indexOf('// ================= Инициализация =================');
if (initAt < 0) throw new Error('Application initialization marker not found');

const context = vm.createContext({
  localStorage: { getItem: () => null, setItem: () => {} },
  console,
});
vm.runInContext(`${script.slice(0, initAt)}\nglobalThis.auditData={SPELLS,RACES,BACKGROUNDS,SUBCLASSES};`, context, { timeout: 5000 });
const data = context.auditData;
const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'source-registry.json'), 'utf8'));
const records = Object.entries(data).flatMap(([category, entries]) => {
  const list = Array.isArray(entries) ? entries.map((entry, i) => [entry.id || String(i), entry]) : Object.entries(entries);
  return list.map(([id, entry]) => ({ category, id, name: entry.ru || entry.name || id, source: entry.src || 'UNATTRIBUTED' }));
});
const counts = new Map();
let unknownLabels = 0;
for (const record of records) {
  counts.set(`${record.category}\t${record.source}`, (counts.get(`${record.category}\t${record.source}`) || 0) + 1);
  if (!registry[record.source]) unknownLabels++;
}
for (const [key, count] of [...counts].sort(([a], [b]) => a.localeCompare(b, 'ru'))) {
  const [category, source] = key.split('\t');
  console.log(`${category.padEnd(12)} ${String(count).padStart(4)}  ${registry[source]?.title || `UNKNOWN LABEL: ${source}`}`);
}
console.log(`\nВсего записей: ${records.length}; без источника на записи: ${records.filter(r => r.source === 'UNATTRIBUTED').length}`);

if (process.argv.includes('--missing')) {
  console.log('\nЗаписи заклинаний без указанного источника:');
  for (const r of records.filter(r => r.category === 'SPELLS' && r.source === 'UNATTRIBUTED')) console.log(`- ${r.id}: ${r.name}`);
}
if (unknownLabels) {
  console.error(`\nОшибка: ${unknownLabels} записей используют отсутствующую в data/source-registry.json метку.`);
  process.exitCode = 1;
}
