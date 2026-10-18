const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = readFileSync(path.join(__dirname, '..', 'dnd_builder.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'inline application script exists');
const initAt = script.indexOf('// ================= Инициализация =================');
assert.notEqual(initAt, -1, 'initialization marker exists');

const dom = { rows: [], levels: [], empty: { hidden: true } };
const context = vm.createContext({
  localStorage: { getItem: () => null, setItem: () => {} },
  document: {
    querySelector: selector => selector === '#spellNoResults' ? dom.empty : null,
    querySelectorAll: selector => selector === '.spell-row' ? dom.rows : selector === '.spell-lvl' ? dom.levels : [],
  },
  console,
  alert: () => {},
});
vm.runInContext(`${script.slice(0, initAt)}
globalThis.api = {
  newChar, totalLvl, pb, am, maxHp, skillMod, spellSlots, armorClass, validCharacter,
  setSpellQuery,
  renderMain, renderAbil, renderSheet,
  renderSheet2014,
  renderSheet2024,
  RACES, BACKGROUNDS, racialAsi,
  setChar: value => { C = value; },
};`, context);
const api = context.api;

function character() {
  const c = api.newChar();
  c.abilityMethod = 'manual';
  c.bases.manual = { str: 10, dex: 14, con: 10, int: 15, wis: 10, cha: 10 };
  api.setChar(c);
  return c;
}

test('proficiency bonus and modifiers follow total character level', () => {
  const c = character();
  assert.equal(api.totalLvl(), 1);
  assert.equal(api.pb(), 2);
  assert.equal(api.am('dex'), 2); // Human +1: 15 Dexterity
  c.classes[0].lvl = 5;
  assert.equal(api.pb(), 3);
});

test('fighter hit points use maximum first hit die and average thereafter', () => {
  const c = character();
  c.classes = [{ cls: 'fighter', lvl: 3, sub: 'champion' }];
  assert.equal(api.maxHp(), 22); // 10 + 6 + 6; Constitution 11 gives +0
});

test('expertise adds proficiency bonus twice to a proficient skill', () => {
  const c = character();
  c.classes[0].lvl = 5;
  c.classSkills.fighter = ['athletics'];
  c.expertise = ['athletics'];
  assert.equal(api.skillMod('athletics'), 6);
});

test('multiclass spell slots use the combined caster level table', () => {
  const c = character();
  c.classes = [
    { cls: 'wizard', lvl: 3, sub: 'evocation' },
    { cls: 'cleric', lvl: 2, sub: 'life' },
  ];
  assert.deepEqual(Array.from(api.spellSlots()).slice(0, 4), [4, 3, 2, 0]);
});

test('armor class includes Dexterity and an equipped shield', () => {
  const c = character();
  c.inventory = [
    { type: 'armor', id: 'studded', equipped: true },
    { type: 'shield', id: 'shield', equipped: true },
  ];
  assert.equal(api.armorClass(), 16); // 12 + 2 Dex + 2 shield
});

test('spell search filters rows and hides empty spell levels', () => {
  const spell = search => ({ dataset: { search }, hidden: false });
  const acid = spell('брызги кислоты acid splash воплощение');
  const mageArmor = spell('доспехи мага mage armor ограждение');
  const cantrips = { hidden: false, open: true, querySelector: () => acid.hidden ? null : acid };
  const firstCircle = { hidden: false, open: false, querySelector: () => mageArmor.hidden ? null : mageArmor };
  dom.rows = [acid, mageArmor];
  dom.levels = [cantrips, firstCircle];

  api.setSpellQuery('кислоты');
  assert.equal(acid.hidden, false);
  assert.equal(mageArmor.hidden, true);
  assert.equal(cantrips.hidden, false);
  assert.equal(firstCircle.hidden, true);
  assert.equal(cantrips.open, true);
  assert.equal(dom.empty.hidden, true);

  api.setSpellQuery('not-a-spell');
  assert.equal(dom.empty.hidden, false);
  api.setSpellQuery('');
  assert.equal(acid.hidden, false);
  assert.equal(mageArmor.hidden, false);
  assert.equal(dom.empty.hidden, true);
});

test('import validation rejects malformed character data', () => {
  const c = character();
  assert.equal(api.validCharacter(c), true);
  assert.equal(api.validCharacter({ name: 'Broken', classes: [{ cls: 'unknown', lvl: 1 }] }), false);
  assert.equal(api.validCharacter(null), false);
});

test('sheet selector keeps 2014 as default and offers 2024', () => {
  character();
  const html = api.renderSheet();
  assert.match(html, /option value="2014" selected/);
  assert.match(html, /option value="2024"/);
});

test('2014 sheet renders the four-page reference layout', () => {
  const c = character();
  c.name = 'Test hero';
  const html = api.renderSheet2014();
  assert.equal([...html.matchAll(/data-sheet-page="\d"/g)].length, 4);
  assert.match(html, /Test hero/);
  assert.match(html, /пассивная мудрость/);
});

test('2024 sheet renders four printable pages with character data', () => {
  const c = character();
  c.name = 'Test hero';
  const html = api.renderSheet2024();
  assert.equal([...html.matchAll(/data-sheet-page="\d"/g)].length, 4);
  assert.match(html, /Test hero/);
  assert.match(html, /Героическое вдохновение/);
  assert.doesNotMatch(html, /Long Story Short/);
});

test('AAG species and backgrounds carry source tags in the builder', () => {
  const c = character();
  c.race = 'astralelf';
  c.bg = 'astraldrifter';
  api.setChar(c);
  const html = api.renderMain();
  assert.match(html, /Астральный эльф \(AAG\)/);
  assert.match(html, /Астральный скиталец \(AAG\)/);
  assert.match(api.renderAbil(), /Бонусы характеристик \(AAG\)/);
  assert.equal(Object.values(api.RACES).filter(r => r.src === 'AAG').length, 6);
  assert.equal(Object.values(api.BACKGROUNDS).filter(b => b.src === 'AAG').length, 2);
});

test('AAG flexible ability increases apply +2/+1 or +1 to three abilities', () => {
  const c = character();
  c.race = 'astralelf';
  c.raceAsiMode = 'two';
  c.raceAsiPicks = ['dex', 'wis'];
  api.setChar(c);
  let asi = api.racialAsi();
  assert.equal(asi.dex, 2);
  assert.equal(asi.wis, 1);
  c.raceAsiMode = 'three';
  c.raceAsiPicks = ['str', 'con', 'cha'];
  api.setChar(c);
  asi = api.racialAsi();
  assert.equal(asi.str, 1);
  assert.equal(asi.con, 1);
  assert.equal(asi.cha, 1);
});

test('AAG background feat appears on both character-sheet styles', () => {
  const c = character();
  c.bg = 'astraldrifter';
  api.setChar(c);
  assert.match(api.renderSheet2014(), /Посвящённый в магию: жрец \(PHB\) \(AAG\)/);
  assert.match(api.renderSheet2024(), /Посвящённый в магию: жрец \(PHB\) \(AAG\)/);
});
