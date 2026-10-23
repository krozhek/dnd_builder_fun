#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const template = read('src/index.template.html');
if (template.split('{{STYLES}}').length !== 2 || template.split('{{APP}}').length !== 2) throw new Error('Build template must contain each placeholder exactly once');
const styles = read('src/styles.css');
const data = read('src/data.js');
const spellMarker = '/*SPELL_CATALOG*/[]';
if (data.split(spellMarker).length !== 2) throw new Error('Data source must contain the spell catalog placeholder exactly once');
const spells = JSON.parse(read('data/spells.json'));
const spellTextFields = ['id', 'ru', 'en', 'school', 'time', 'range', 'comp', 'dur', 'desc', 'full'];
const validSpell = spell => !!spell && typeof spell === 'object' && !Array.isArray(spell)
  && spellTextFields.every(key => typeof spell[key] === 'string') && !!spell.id
  && Number.isInteger(spell.lvl) && spell.lvl >= 0 && spell.lvl <= 9
  && typeof spell.ritual === 'boolean'
  && Array.isArray(spell.cls) && spell.cls.length && spell.cls.every(cls => typeof cls === 'string' && cls.length)
  && (spell.src == null || typeof spell.src === 'string')
  && (spell.translationSource == null || typeof spell.translationSource === 'string');
if (!Array.isArray(spells) || !spells.length || spells.some(spell => !validSpell(spell)) || new Set(spells.map(spell => spell.id)).size !== spells.length) {
  throw new Error('Invalid spell catalog structure');
}
const app = [data.replace(spellMarker, () => JSON.stringify(spells)), read('src/rules.js'), read('src/core.js'), read('src/validation.js'), read('src/state.js'), read('src/foundry.js'), read('src/ui.js')].join('');
const html = template.replace('{{STYLES}}', () => styles).replace('{{APP}}', () => app);
const output = path.join(root, 'dnd_builder.html');

if (process.argv.includes('--check')) {
  if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== html) {
    console.error('dnd_builder.html is out of date; run node scripts/build.cjs');
    process.exitCode = 1;
  }
} else {
  fs.writeFileSync(output, html);
  console.log(`Built ${path.relative(root, output)}`);
}
