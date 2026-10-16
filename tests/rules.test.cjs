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

const context = vm.createContext({
  localStorage: { getItem: () => null, setItem: () => {} },
  console,
  alert: () => {},
});
vm.runInContext(`${script.slice(0, initAt)}
globalThis.api = {
  newChar, totalLvl, pb, am, maxHp, skillMod, spellSlots, armorClass, validCharacter,
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

test('import validation rejects malformed character data', () => {
  const c = character();
  assert.equal(api.validCharacter(c), true);
  assert.equal(api.validCharacter({ name: 'Broken', classes: [{ cls: 'unknown', lvl: 1 }] }), false);
  assert.equal(api.validCharacter(null), false);
});
