const { readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = readFileSync(path.join(__dirname, '..', 'dnd_builder.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'inline application script exists');
const initAt = script.indexOf('// ================= Инициализация =================');
assert.notEqual(initAt, -1, 'initialization marker exists');

const dom = { rows: [], levels: [], empty: { hidden: true }, modal: { style: {} } };
const storageData = new Map();
const alerts = [];
let storageReadError = false, storageWriteError = false;
const localStorage = {
  getItem(key) { if (storageReadError) throw new Error('storage blocked'); return storageData.get(key) ?? null; },
  setItem(key, value) { if (storageWriteError) throw new Error('storage blocked'); storageData.set(key, String(value)); },
};
const context = vm.createContext({
  localStorage,
  document: {
    querySelector: selector => selector === '#spellNoResults' ? dom.empty : selector === '#modal' ? dom.modal : selector.startsWith('[data-res=') ? dom.resource : null,
    querySelectorAll: selector => selector === '.spell-row' ? dom.rows : selector === '.spell-lvl' ? dom.levels : [],
    getElementById: () => null,
  },
  console: { error() {} },
  alerts,
  alert: message => alerts.push(message),
});
vm.runInContext(`${script.slice(0, initAt)}
globalThis.api = {
  newChar, migrate, totalLvl, pb, am, abil, maxHp, skillMod, saveMods, passivePerception, passiveInvestigation, stepPoint, pointBuySpent, spellSlots, armorClass, speed, initiative, weaponProf, weaponAttack, weaponDamage, armorProficiencies, armorProficient, armorProficiencyText, weaponProficiencyText, classArmorProficiencyText, classWeaponProficiencies, classToolProficiencyText, WEAPONS, ARMORS, toggleWieldWeapon, setWeaponGrip, hasFightingStyle, setFightingStyle, validCharacter, loadLib, saveLib,
  get library() { return LIB; }, setLibrary(value) { LIB = value; }, get storageCorrupt() { return STORAGE_CORRUPT; }, hasUniqueCharacterIds,
  expertiseAvailable, expertiseSkills, deftExplorerSkill, renderSkills, toolProficiencies, TOOL_PROFICIENCIES,
  primalAwarenessSpells, knownLimit,
  setSpellQuery, setSpellFilter,
  spellPicker, renderWizardSpells, toggleSpell, spellNameClick, SPELLS,
  renderSpells, racialCantripChoices, racialSpellEntries,
  renderMain, renderHome, renderEquip, renderGame, setLib: value => { LIB = value; }, renderAbil, renderClass, renderSheet, domainSpellsOf,
  renderSheet2014,
  attacksHtml,
  shortRest, drawGameTrackers,
  renderSheet2024,
  RACES, BACKGROUNDS, racialAsi, TASHA_FEATURES, availableFeats, characterReadiness, languageChoiceCount, classSkillChoiceCount, multiclassRequirementError,
  addClass, changeClass, setDeftExplorerMode, alerts, get renderFn() { return render; }, setRenderFn(fn) { render = fn; },
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

test('offline HTML is generated from the modular source files', () => {
  execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'build.cjs'), '--check']);
});

test('proficiency bonus and modifiers follow total character level', () => {
  const c = character();
  assert.equal(api.totalLvl(), 1);
  assert.equal(api.pb(), 2);
  assert.equal(api.am('dex'), 2); // Human +1: 15 Dexterity
  c.classes[0].lvl = 5;
  assert.equal(api.pb(), 3);
});

test('Dueling requires a single wielded one-handed weapon and grip affects versatile damage', () => {
  const c = character();
  c.classes = [{ cls: 'fighter', lvl: 1, sub: 'champion' }];
  c.bases.manual.str = 18;
  c.choices.fightingStyles = { fighter: 'dueling' };
  c.inventory = [{ type: 'weapon', id: 'longsword', qty: 2, equipped: false }];
  api.setChar(c);
  const oldRender = api.renderFn;
  api.setRenderFn(() => {});
  const longsword = api.WEAPONS.find(w => w[0] === 'longsword');
  api.toggleWieldWeapon(0);
  assert.equal(c.inventory[0].qty, 1);
  assert.equal(c.inventory[0].wielded, true);
  assert.equal(c.inventory[1].qty, 1);
  assert.equal(api.weaponDamage(longsword, c.inventory[0]), '1к8 рубящий +6');
  api.setWeaponGrip(0, 'two-handed');
  assert.equal(api.weaponDamage(longsword, c.inventory[0]), '1к10 рубящий +4');
  api.setWeaponGrip(0, 'one-handed');
  api.toggleWieldWeapon(1);
  assert.equal(api.weaponDamage(longsword, c.inventory[0]), '1к8 рубящий +4');
  c.inventory[1].wielded = false;
  c.inventory.push({ type: 'shield', id: 'shield', equipped: true });
  assert.equal(api.weaponDamage(longsword, c.inventory[0]), '1к8 рубящий +6');
  assert.match(api.renderEquip(), /Хват оружия/);
  assert.equal(api.validCharacter({ ...c, inventory: [{ type: 'weapon', id: 'longsword', qty: 2, wielded: true }] }), false);
  api.setRenderFn(oldRender);
});

test('Improved Divine Smite adds radiant damage only to paladin melee weapons at level 11', () => {
  const c = character();
  c.classes = [{ cls: 'paladin', lvl: 10, sub: 'devotion' }];
  c.bases.manual.str = 16;
  api.setChar(c);
  const longsword = api.WEAPONS.find(w => w[0] === 'longsword');
  const crossbow = api.WEAPONS.find(w => w[0] === 'lightcrossbow');
  assert.equal(api.weaponDamage(longsword), '1к8 рубящий +3');
  c.classes[0].lvl = 11;
  api.setChar(c);
  assert.equal(api.weaponDamage(longsword), '1к8 рубящий + 1к8 излучением +3');
  assert.equal(api.weaponDamage(crossbow), '1к8 колющий +2');
});

test('Thrown Weapon Fighting shows the +2 damage on the ranged-thrown attack', () => {
  const c = character();
  c.classes = [{ cls: 'fighter', lvl: 1, sub: 'champion' }, { cls: 'ranger', lvl: 2, sub: 'hunter' }];
  c.choices.fightingStyles = { fighter: 'thrown', ranger: 'dueling' };
  c.bases.manual.str = 16;
  c.inventory = [{ type: 'weapon', id: 'javelin', qty: 1, wielded: true }];
  api.setChar(c);
  const javelin = api.WEAPONS.find(w => w[0] === 'javelin');
  assert.equal(api.weaponDamage(javelin, c.inventory[0]), '1к6 колющий +5 (при броске: 1к6 колющий +7)');
  c.inventory[0] = { type: 'weapon', id: 'spear', qty: 1, wielded: true, grip: 'two-handed' };
  api.setChar(c);
  const spear = api.WEAPONS.find(w => w[0] === 'spear');
  assert.equal(api.weaponDamage(spear, c.inventory[0]), '1к8 колющий +3 (при броске: 1к6 колющий +7)');
  assert.equal(api.weaponDamage(api.WEAPONS.find(w => w[0] === 'longsword')), '1к8 рубящий +3');
});

test('fighting styles are selected separately and readiness checks every source', () => {
  const c = character();
  c.classes = [{ cls: 'fighter', lvl: 2, sub: 'champion' }, { cls: 'paladin', lvl: 2, sub: 'devotion' }];
  c.choices.fightingStyles = { fighter: 'archery', paladin: 'defense' };
  api.setChar(c);
  assert.equal(api.hasFightingStyle('archery'), true);
  assert.equal(api.hasFightingStyle('defense'), true);
  assert.equal(api.characterReadiness().some(i => i.tab === 'cls' && i.text.includes('боевой стиль')), false);
  assert.match(api.renderClass(), /setFightingStyle\('fighter'/);
  assert.match(api.renderClass(), /эффекты остальных стилей показаны как справка/);
  assert.match(api.renderClass(), /setFightingStyle\('paladin'/);

  const oldRender = api.renderFn;
  api.setRenderFn(() => {});
  c.classes = [{ cls: 'fighter', lvl: 10, sub: 'champion' }];
  c.choices.fightingStyles = { fighter: 'defense' };
  api.setChar(c);
  assert.ok(api.characterReadiness().some(i => i.text.includes('второй боевой стиль')));
  api.setFightingStyle('championExtra', 'dueling');
  assert.equal(api.characterReadiness().some(i => i.text.includes('боевой стиль')), false);
  alerts.length = 0;
  api.setFightingStyle('fighter', 'dueling');
  assert.equal(c.choices.fightingStyles.fighter, 'defense');
  assert.match(alerts.at(-1), /уже выбран/);
  api.setRenderFn(oldRender);
});

test('weapon proficiencies follow class and multiclass tables', () => {
  const c = character();
  c.classes = [{ cls: 'bard', lvl: 1, sub: 'lore' }];
  api.setChar(c);
  assert.equal(api.weaponProf('rapier'), true);
  assert.equal(api.weaponProf('greatsword'), false);
  c.classes = [{ cls: 'wizard', lvl: 1, sub: 'evocation' }];
  api.setChar(c);
  assert.equal(api.weaponProf('dagger'), true);
  assert.equal(api.weaponProf('mace'), false);
  c.classes = [{ cls: 'wizard', lvl: 1, sub: 'evocation' }, { cls: 'bard', lvl: 1, sub: 'lore' }];
  api.setChar(c);
  assert.equal(api.weaponProf('rapier'), false);
  c.classes = [{ cls: 'cleric', lvl: 1, sub: 'tempest' }];
  api.setChar(c);
  assert.equal(api.weaponProf('rapier'), true);
  c.classes = [{ cls: 'druid', lvl: 1, sub: 'land' }];
  api.setChar(c);
  assert.equal(api.weaponProf('scimitar'), true);
  assert.equal(api.weaponProf('lightcrossbow'), false);
});

test('armor and weapon proficiencies include multiclass, subclass, and racial rules', () => {
  const c = character();
  c.classes = [{ cls: 'fighter', lvl: 1, sub: 'champion' }];
  api.setChar(c);
  assert.equal(api.armorProficient('plate'), true);
  c.classes = [{ cls: 'wizard', lvl: 1, sub: 'evocation' }, { cls: 'fighter', lvl: 1, sub: 'champion' }];
  api.setChar(c);
  assert.equal(api.armorProficient('chainshirt'), true);
  assert.equal(api.armorProficient('plate'), false);
  assert.equal(api.armorProficient('shield'), true);

  c.classes = [{ cls: 'wizard', lvl: 1, sub: 'evocation' }, { cls: 'cleric', lvl: 1, sub: 'tempest' }];
  api.setChar(c);
  assert.equal(api.armorProficient('plate'), true);
  assert.equal(api.weaponProf('greatsword'), true);

  c.classes = [{ cls: 'wizard', lvl: 1, sub: 'evocation' }];
  c.race = 'dwarf'; c.subrace = 'mountain';
  api.setChar(c);
  assert.equal(api.armorProficient('chainshirt'), true);
  assert.equal(api.armorProficient('plate'), false);
  assert.equal(api.weaponProf('battleaxe'), true);
  assert.equal(api.weaponProf('lighthammer'), true);

  c.race = 'elf'; c.subrace = 'high';
  api.setChar(c);
  assert.equal(api.weaponProf('longbow'), true);
  assert.equal(api.weaponProf('rapier'), false);
  c.subrace = 'drow'; api.setChar(c);
  assert.equal(api.weaponProf('rapier'), true);
});

test('multiclass and background tool proficiencies resolve real choices', () => {
  const c = character();
  c.bg = 'soldier';
  c.classes = [{ cls: 'fighter', lvl: 1, sub: 'champion' }, { cls: 'bard', lvl: 1, sub: 'lore' }];
  c.choices.backgroundTools = ['Игровой набор (кости)'];
  c.choices.classTools = { bard: ['Лютня'] };
  c.abilityMethod = 'manual';
  c.bases.manual.cha = 12;
  api.setChar(c);
  assert.deepEqual(Array.from(api.toolProficiencies()), ['Наземный транспорт', 'Игровой набор (кости)', 'Лютня']);
  assert.doesNotMatch(api.renderClass(), /3 музыкальных инструмента/);
  assert.equal(api.validCharacter(c), true);

  c.classes = [{ cls: 'bard', lvl: 1, sub: 'lore' }];
  c.bg = 'charlatan';
  c.choices.backgroundTools = [];
  c.choices.classTools = { bard: ['Лютня', 'Флейта', 'Волынка'] };
  api.setChar(c);
  assert.ok(api.toolProficiencies().includes('Лютня'));
  assert.ok(api.toolProficiencies().includes('Набор для грима'));
  assert.doesNotMatch(api.renderMain(), /Бард:.*3 музыкальных инструмента/);
  assert.equal(api.characterReadiness().some(i => i.text.includes('Бард: выберите инструменты')), false);
  assert.equal(api.validCharacter({ ...c, choices: { ...c.choices, classTools: { bard: ['Космический транспорт'] } } }), false);
});

test('nonproficient armor and shields keep AC but report their rules penalties', () => {
  const c = character();
  c.classes = [{ cls: 'wizard', lvl: 1, sub: 'evocation' }];
  c.inventory = [{ type: 'armor', id: 'plate', qty: 1, equipped: true }, { type: 'shield', id: 'shield', qty: 1, equipped: true }];
  api.setChar(c);
  assert.equal(api.armorClass(), 20);
  const issues = api.characterReadiness().map(i => i.text);
  assert.ok(issues.some(text => text.includes('Нет владения доспехом')));
  assert.ok(issues.some(text => text.includes('Нет владения щитами')));
  assert.match(api.renderEquip(), /нельзя накладывать заклинания/);
});

test('monk weapons are melee only and allow shortswords', () => {
  const c = character();
  c.classes = [{ cls: 'monk', lvl: 1, sub: 'openhand' }];
  c.bases.manual.str = 18;
  c.bases.manual.dex = 10;
  api.setChar(c);
  const weapon = id => api.WEAPONS.find(w => w[0] === id);
  assert.equal(api.weaponProf('shortsword'), true);
  assert.equal(api.weaponAttack(weapon('shortsword')), 6);
  assert.equal(api.weaponAttack(weapon('quarterstaff')), 6);
  assert.equal(api.weaponAttack(weapon('lightcrossbow')), 2);

  c.classes[0].lvl = 11;
  c.bases.manual.str = 10;
  c.bases.manual.dex = 16;
  c.inventory = [{ type: 'weapon', id: 'shortsword', qty: 1, wielded: true }];
  api.setChar(c);
  assert.equal(api.weaponAttack(weapon('shortsword')), 7);
  assert.equal(api.weaponDamage(weapon('shortsword'), c.inventory[0]), '1к8 колющий +3');
  assert.match(api.attacksHtml(), /Безоружный удар[\s\S]*1к8 \+3/);

  c.inventory.push({ type: 'armor', id: 'leather', qty: 1, equipped: true });
  api.setChar(c);
  assert.equal(api.weaponAttack(weapon('shortsword')), 4); // без БИ — Сила
  assert.equal(api.weaponDamage(weapon('shortsword'), c.inventory[0]), '1к6 колющий');
  assert.match(api.attacksHtml(), /Безоружный удар[\s\S]*1 \+0/);
  c.inventory = [{ type: 'weapon', id: 'greatsword', qty: 1, wielded: true }];
  api.setChar(c);
  assert.equal(api.weaponAttack(weapon('shortsword')), 4);
});

test('class skill choices use the starting or multiclass progression', () => {
  assert.equal(api.classSkillChoiceCount(0, 'bard'), 3);
  assert.equal(api.classSkillChoiceCount(1, 'bard'), 1);
  assert.equal(api.classSkillChoiceCount(1, 'fighter'), 0);

  const c = character();
  c.classes = [{ cls: 'fighter', lvl: 1, sub: 'champion' }, { cls: 'bard', lvl: 1, sub: 'lore' }];
  c.classSkills.fighter = ['history', 'perception'];
  c.classSkills.bard = ['arcana'];
  api.setChar(c);
  assert.match(api.renderSkills(), /Навыки класса «Бард» — выбрано 1\/1/);
  assert.equal(api.characterReadiness().some(i => i.tab === 'skills' && i.text.startsWith('Бард:')), false);

  const c2 = character();
  c2.classes = [{ cls: 'bard', lvl: 1, sub: 'lore' }, { cls: 'fighter', lvl: 1, sub: 'champion' }];
  c2.classSkills.bard = ['arcana', 'history', 'perception'];
  api.setChar(c2);
  assert.match(api.renderSkills(), /Мультиклассирование в этот класс не даёт выбора навыков/);

  c.classSkills.bard.push('nature');
  api.setChar(c);
  assert.ok(api.characterReadiness().some(i => i.tab === 'skills' && i.text.includes('Бард: уберите лишние навыки')));
});

test('multiclass prerequisites check the new and existing classes', () => {
  const c = character();
  c.classes = [{ cls: 'fighter', lvl: 1, sub: 'champion' }];
  c.bases.manual = { str: 12, dex: 10, con: 10, int: 10, wis: 10, cha: 11 };
  api.setChar(c);
  assert.match(api.multiclassRequirementError('bard'), /добавления класса «Бард»/);
  c.bases.manual.cha = 12;
  api.setChar(c);
  assert.equal(api.multiclassRequirementError('bard'), '');

  c.bases.manual.str = 11;
  c.bases.manual.dex = 11;
  api.setChar(c);
  assert.match(api.multiclassRequirementError('bard'), /текущего класса «Воин»/);

  c.bases.manual.str = 14;
  c.bases.manual.dex = 12;
  c.bases.manual.wis = 11;
  api.setChar(c);
  assert.match(api.multiclassRequirementError('monk'), /класса «Монах»/);
  c.bases.manual.wis = 12;
  api.setChar(c);
  assert.equal(api.multiclassRequirementError('monk'), '');

  const oldRender = api.renderFn;
  api.setRenderFn(() => {});
  c.classes.push({ cls: 'wizard', lvl: 1, sub: 'evocation' });
  c.bases.manual.int = 13;
  c.bases.manual.cha = 11;
  api.setChar(c);
  alerts.length = 0;
  api.changeClass(1, 'bard');
  assert.equal(c.classes[1].cls, 'wizard');
  assert.match(alerts.at(-1), /добавления класса «Бард»/);
  api.setRenderFn(oldRender);

  c.classes.splice(1);
  c.bases.manual.str = 8;
  c.bases.manual.dex = 8;
  api.setChar(c);
  alerts.length = 0;
  api.addClass();
  assert.equal(c.classes.length, 1);
  assert.match(alerts.at(-1), /текущего класса «Воин»/);
});

test('multiclass keeps only the starting class saving throw proficiencies', () => {
  const c = character();
  c.classes = [{ cls: 'fighter', lvl: 1, sub: '' }, { cls: 'wizard', lvl: 1, sub: '' }];
  api.setChar(c);
  const saves = api.saveMods();
  assert.equal(saves.str.prof, true);
  assert.equal(saves.con.prof, true);
  assert.equal(saves.int.prof, false);
  assert.equal(saves.wis.prof, false);
});

test('initiative includes Jack of All Trades and Remarkable Athlete bonuses', () => {
  const c = character();
  c.bases.manual.dex = 14;
  c.classes = [{ cls: 'bard', lvl: 2, sub: 'lore' }];
  api.setChar(c);
  assert.equal(api.initiative(), 3); // Dex +2, Jack of All Trades +1

  c.classes = [{ cls: 'bard', lvl: 2, sub: 'lore' }, { cls: 'fighter', lvl: 3, sub: 'champion' }];
  api.setChar(c);
  assert.equal(api.initiative(), 3); // PB 3: Bard rounds half down

  c.classes = [{ cls: 'fighter', lvl: 7, sub: 'champion' }];
  api.setChar(c);
  assert.equal(api.initiative(), 4); // PB 3: Champion rounds half up

  c.classes = [{ cls: 'bard', lvl: 2, sub: 'lore' }, { cls: 'fighter', lvl: 7, sub: 'champion' }];
  api.setChar(c);
  assert.equal(api.initiative(), 4); // Half-proficiency features do not stack
  assert.equal(api.skillMod('acrobatics'), 4); // Remarkable Athlete rounds the shared bonus up
});

test('Remarkable Athlete rounds half proficiency bonus up for unproficient Strength checks', () => {
  const c = character();
  c.bg = 'sage';
  c.classes = [{ cls: 'fighter', lvl: 7, sub: 'champion' }];
  api.setChar(c);
  assert.equal(api.pb(), 3);
  assert.equal(api.skillMod('athletics'), 2);
});

test('ability scores cap at 20 and Primal Champion adds +4 to Strength and Constitution at barbarian 20', () => {
  const c = character();
  c.race = 'halforc';
  c.bases.manual.str = 18;
  c.bases.manual.con = 18;
  c.classes = [{ cls: 'barbarian', lvl: 19, sub: 'berserk' }];
  c.asi = { asi0: { type: 'asi', vals: ['str', 'str'] }, asi1: { type: 'asi', vals: ['con', 'con'] } };
  api.setChar(c);
  assert.equal(api.abil('str'), 20);
  assert.equal(api.am('str'), 5);
  assert.equal(api.abil('con'), 20);

  c.classes[0].lvl = 20;
  api.setChar(c);
  assert.equal(api.abil('str'), 24);
  assert.equal(api.abil('con'), 24);
  assert.equal(api.am('str'), 7);
  assert.equal(api.abil('dex'), 14);

  c.classes[0].lvl = 19;
  c.classes[0].cls = 'fighter';
  api.setChar(c);
  assert.equal(api.abil('str'), 20);
});

test('fighter hit points use maximum first hit die and average thereafter', () => {
  const c = character();
  c.classes = [{ cls: 'fighter', lvl: 3, sub: 'champion' }];
  assert.equal(api.maxHp(), 22); // 10 + 6 + 6; Constitution 11 gives +0
});

test('ASI feats update their corresponding calculated stats', () => {
  const withFeat = (id, bonus) => {
    const c = character();
    c.classes = [{ cls: 'fighter', lvl: 4, sub: 'champion' }];
    c.asi = { asi0: { type: 'feat', id, bonus } };
    api.setChar(c);
    return c;
  };

  withFeat('alert');
  assert.equal(api.initiative(), 7);
  withFeat('tough');
  assert.equal(api.maxHp(), 36);
  withFeat('observant');
  assert.equal(api.passivePerception(), 15);
  assert.equal(api.passiveInvestigation(), 18);
  assert.ok(api.renderAbil().includes('Пассивное Расследование: <b>18</b>'));
  withFeat('resilient', 'wis');
  assert.equal(api.saveMods().wis.mod, 3);
  assert.equal(api.saveMods().wis.prof, true);
  withFeat('mobile');
  assert.equal(api.speed(), 40);

  const dualWielder = withFeat('dual_wielder');
  dualWielder.inventory = [
    { type: 'weapon', id: 'shortsword', qty: 1, wielded: true },
    { type: 'weapon', id: 'dagger', qty: 1, wielded: true },
  ];
  api.setChar(dualWielder);
  assert.equal(api.armorClass(), 13);
  dualWielder.inventory.pop();
  api.setChar(dualWielder);
  assert.equal(api.armorClass(), 12);
});

test('expertise adds proficiency bonus twice to a proficient skill', () => {
  const c = character();
  c.classes[0].lvl = 5;
  c.classSkills.fighter = ['athletics'];
  c.expertise = ['athletics'];
  assert.equal(api.skillMod('athletics'), 6);
});

test('Circle of the Land spells unlock by druid class level', () => {
  const c = character();
  c.classes = [{ cls: 'druid', lvl: 2, sub: 'land' }];
  c.choices.druidLand = 'arctic';
  const spellsAt = level => {
    c.classes[0].lvl = level;
    api.setChar(c);
    return Array.from(api.domainSpellsOf(c.classes[0]), s => s.id).sort();
  };
  assert.deepEqual(spellsAt(2), []);
  assert.deepEqual(spellsAt(3), ['hold_person', 'spike_growth'].sort());
  assert.deepEqual(spellsAt(5), ['hold_person', 'spike_growth', 'sleet_storm', 'slow'].sort());
  assert.deepEqual(spellsAt(7), ['hold_person', 'spike_growth', 'sleet_storm', 'slow', 'freedom_of_movement', 'ice_storm'].sort());
  assert.deepEqual(spellsAt(9), ['hold_person', 'spike_growth', 'sleet_storm', 'slow', 'freedom_of_movement', 'ice_storm', 'commune_with_nature', 'cone_of_cold'].sort());
  delete c.choices.druidLand;
  api.setChar(c);
  assert.deepEqual(Array.from(api.domainSpellsOf(c.classes[0])), []);
});

test('multiclass spell slots use the combined caster level table', () => {
  const c = character();
  c.classes = [
    { cls: 'wizard', lvl: 3, sub: 'evocation' },
    { cls: 'cleric', lvl: 2, sub: 'life' },
  ];
  assert.deepEqual(Array.from(api.spellSlots()).slice(0, 4), [4, 3, 2, 0]);
  c.classes = [
    { cls: 'paladin', lvl: 3, sub: 'devotion' },
    { cls: 'ranger', lvl: 3, sub: 'hunter' },
  ];
  api.setChar(c);
  assert.deepEqual(Array.from(api.spellSlots()).slice(0, 4), [3, 0, 0, 0]);
  c.classes = [
    { cls: 'paladin', lvl: 3, sub: 'devotion' },
    { cls: 'ranger', lvl: 1, sub: 'hunter' },
  ];
  api.setChar(c);
  assert.deepEqual(Array.from(api.spellSlots()).slice(0, 4), [2, 0, 0, 0]);
});

test('third-caster class levels expose their own cantrip and known spell progression', () => {
  const c = character();
  c.classes = [{ cls: 'fighter', lvl: 3, sub: 'eldritchknight' }];
  api.setChar(c);
  assert.match(api.renderSpells(), /Заговоры — 0\/2/);
  assert.match(api.renderSpells(), /Известные заклинания — 0\/3/);
  c.spellsKnown.fighter = ['scorching_ray'];
  api.setChar(c);
  assert.equal(api.validCharacter(c), false);
  assert.doesNotMatch(api.renderSpells(), /Палящий луч/);
  c.classes = [{ cls: 'rogue', lvl: 3, sub: 'arcanetrickster' }];
  c.spellsKnown = {};
  api.setChar(c);
  assert.match(api.renderSpells(), /Заговоры — 0\/3/);
  assert.match(api.renderSpells(), /Известные заклинания — 0\/3/);
});

test('third casters enforce school exceptions and Arcane Trickster requires Mage Hand', () => {
  const c = character();
  c.classes = [{ cls: 'fighter', lvl: 3, sub: 'eldritchknight' }];
  c.spellsKnown.fighter = ['shield', 'magic_missile', 'charm_person'];
  api.setChar(c);
  assert.equal(api.validCharacter(c), true); // one unrestricted spell at level 3
  c.spellsKnown.fighter.push('disguise_self');
  assert.equal(api.validCharacter(c), false);
  assert.ok(api.characterReadiness().some(issue => issue.text.includes('разрешённой школы')));
  assert.match(api.spellPicker('fighter', 1, ['shield', 'charm_person'], 3, 'spellsKnown'), /Нет свободного выбора для этой школы/);

  c.spellsKnown.fighter = ['shield', 'charm_person'];
  api.setChar(c);
  const oldRender = api.renderFn;
  api.setRenderFn(() => {});
  alerts.length = 0;
  api.toggleSpell('spellsKnown', 'fighter', 3, 'disguise_self', true);
  assert.deepEqual(Array.from(c.spellsKnown.fighter), ['shield', 'charm_person']);
  assert.match(alerts.at(-1), /нет свободного выбора/);
  api.setRenderFn(oldRender);

  c.classes = [{ cls: 'rogue', lvl: 3, sub: 'arcanetrickster' }];
  c.spellsKnown = { rogue: ['shield', 'magic_missile', 'charm_person'] };
  c.cantrips = { rogue: ['acid_splash', 'chill_touch', 'ray_of_frost'] };
  api.setChar(c);
  assert.ok(api.characterReadiness().some(issue => issue.text.includes('обязательный заговор «Волшебная рука»')));
});

test('speed includes monk, barbarian, and Deft Explorer bonuses with armor conditions', () => {
  const c = character();
  c.classes = [{ cls: 'monk', lvl: 2, sub: 'openhand' }];
  api.setChar(c);
  assert.equal(api.speed(), 40);
  c.classes[0].lvl = 6;
  api.setChar(c);
  assert.equal(api.speed(), 45);
  c.inventory = [{ type: 'shield', id: 'shield', equipped: true }];
  api.setChar(c);
  assert.equal(api.speed(), 30);
  c.inventory = [{ type: 'armor', id: 'leather', equipped: true }];
  api.setChar(c);
  assert.equal(api.speed(), 30);

  c.classes = [{ cls: 'barbarian', lvl: 5, sub: 'berserk' }];
  c.inventory = [];
  api.setChar(c);
  assert.equal(api.speed(), 40);
  c.inventory = [{ type: 'armor', id: 'scalemail', equipped: true }];
  api.setChar(c);
  assert.equal(api.speed(), 40);
  c.inventory = [{ type: 'armor', id: 'chainmail', equipped: true }];
  api.setChar(c);
  assert.equal(api.speed(), 30);

  c.classes = [{ cls: 'ranger', lvl: 6, sub: 'hunter' }];
  c.inventory = [];
  c.choices.tashaFeatures = { ranger: ['deft_explorer'] };
  api.setChar(c);
  assert.equal(api.speed(), 35);
});

test('armor class includes Dexterity and an equipped shield', () => {
  const c = character();
  c.inventory = [
    { type: 'armor', id: 'studded', equipped: true },
    { type: 'shield', id: 'shield', equipped: true },
  ];
  assert.equal(api.armorClass(), 16); // 12 + 2 Dex + 2 shield
});

test('Autognome casing grants 13 + Dexterity when unarmored and stacks with a shield', () => {
  const c = character();
  c.race = 'autognome';
  c.inventory = [];
  api.setChar(c);
  assert.equal(api.armorClass(), 15);
  c.inventory = [{ type: 'shield', id: 'shield', equipped: true }];
  api.setChar(c);
  assert.equal(api.armorClass(), 17);
  c.classes = [{ cls: 'barbarian', lvl: 1, sub: 'berserk' }];
  api.setChar(c);
  assert.equal(api.armorClass(), 17);
  c.inventory = [{ type: 'armor', id: 'studded', equipped: true }, { type: 'shield', id: 'shield', equipped: true }];
  api.setChar(c);
  assert.equal(api.armorClass(), 16);
});

test('monk Unarmored Defense stops applying with armor or a shield', () => {
  const c = character();
  c.classes = [{ cls: 'monk', lvl: 1, sub: 'openhand' }];
  c.bases.manual.dex = 14;
  c.bases.manual.wis = 16;
  c.inventory = [];
  api.setChar(c);
  assert.equal(api.armorClass(), 15);
  c.inventory = [{ type: 'shield', id: 'shield', equipped: true }];
  api.setChar(c);
  assert.equal(api.armorClass(), 14);
  c.inventory = [{ type: 'armor', id: 'leather', equipped: true }];
  api.setChar(c);
  assert.equal(api.armorClass(), 13);

  c.classes = [{ cls: 'barbarian', lvl: 1, sub: 'berserk' }];
  c.bases.manual.con = 14;
  c.inventory = [{ type: 'shield', id: 'shield', equipped: true }];
  api.setChar(c);
  assert.equal(api.armorClass(), 16);
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

test('spell filters combine class access, circle, ritual, concentration, and text search', () => {
  const c = character();
  c.classes = [{ cls: 'druid', lvl: 3, sub: 'land' }];
  api.setChar(c);
  const rows = ['detect_magic', 'entangle', 'cure_wounds', 'acid_splash', 'call_lightning'].map(id => {
    const spell = api.SPELLS.find(s => s.id === id);
    return { dataset: { spellId: id, search: [spell.ru, spell.en, spell.school].join(' ').toLocaleLowerCase('ru') }, hidden: false };
  });
  const group = { hidden: false, open: false, querySelector: () => rows.find(row => !row.hidden) || null };
  dom.rows = rows;
  dom.levels = [group];
  assert.match(api.renderSpells(), /Класс персонажа/);
  assert.match(api.renderSpells(), /Концентрация/);

  api.setSpellFilter('cls', 'druid');
  assert.deepEqual(rows.filter(row => !row.hidden).map(row => row.dataset.spellId), ['detect_magic', 'entangle', 'cure_wounds']);
  assert.equal(rows.find(row => row.dataset.spellId === 'call_lightning').hidden, true); // 3rd circle is above druid 3 access
  api.setSpellFilter('concentration', true);
  assert.deepEqual(rows.filter(row => !row.hidden).map(row => row.dataset.spellId), ['detect_magic', 'entangle']);
  api.setSpellFilter('ritual', true);
  assert.deepEqual(rows.filter(row => !row.hidden).map(row => row.dataset.spellId), ['detect_magic']);
  api.setSpellFilter('level', '2');
  assert.equal(dom.empty.hidden, false);
  api.setSpellQuery('неизвестное');
  assert.equal(dom.empty.hidden, false);
  api.setSpellQuery('');
  api.setSpellFilter('level', '');
  api.setSpellFilter('ritual', false);
  api.setSpellFilter('concentration', false);
  api.setSpellFilter('cls', '');
  dom.rows = [];
  dom.levels = [];
});

test('clicking a spell name opens its details without selecting it', () => {
  const c = character();
  c.classes = [{ cls: 'wizard', lvl: 1, sub: 'evocation' }];
  api.setChar(c);
  const spell = api.SPELLS.find(s => s.lvl === 1 && s.cls.includes('wizard'));
  const knownPicker = api.spellPicker('wizard', 1, [], 4, 'spellsKnown');
  assert.match(knownPicker, /onchange="toggleSpell\('spellsKnown'/);
  assert.match(knownPicker, /onclick="spellNameClick\(event,/);

  const event = { prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
  api.spellNameClick(event, spell.id);
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.deepEqual(c.spellsKnown.wizard || [], []);
  assert.equal(dom.modal.style.display, 'block');
  assert.ok(dom.modal.innerHTML.includes(spell.ru));
  const beastSenseEvent = { prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
  api.spellNameClick(beastSenseEvent, 'beast_sense');
  assert.ok(dom.modal.innerHTML.includes('Чутьё зверя'));
  assert.ok(dom.modal.innerHTML.includes('Касание'));
  assert.deepEqual(c.spellsKnown.wizard || [], []);

  const bookPicker = api.renderWizardSpells(c, 1);
  assert.match(bookPicker, /onchange="toggleSpellbook\(/);
  assert.match(bookPicker, /onclick="spellNameClick\(event,/);
});

test('ability methods enforce legal scores and the 27-point budget', () => {
  const c = character();
  const point = { str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 };
  c.abilityMethod = 'point';
  c.bases.point = point;
  assert.equal(api.pointBuySpent(point), 27);
  assert.equal(api.validCharacter(c), true);
  assert.equal(api.validCharacter({ ...c, bases: { ...c.bases, point: { ...point, int: 9 } } }), false);
  assert.equal(api.validCharacter({ ...c, bases: { ...c.bases, point: { ...point, str: 16 } } }), false);
  assert.equal(api.validCharacter({ ...c, abilityMethod: 'standard', bases: { ...c.bases, standard: { str: 15, dex: 15, con: 13, int: 12, wis: 10, cha: 8 } } }), false);
  assert.equal(api.validCharacter({ ...c, abilityMethod: 'manual', bases: { ...c.bases, manual: { ...c.bases.manual, str: 19 } } }), false);

  api.setChar(c);
  const oldRender = api.renderFn;
  api.setRenderFn(() => {});
  api.stepPoint('int', 1);
  assert.equal(c.bases.point.int, 8);
  api.stepPoint('str', -1);
  api.stepPoint('int', 1);
  assert.equal(c.bases.point.int, 9);
  assert.equal(api.pointBuySpent(c.bases.point), 26);
  api.setRenderFn(oldRender);
});

test('import rejects invalid skill choices but storage can still open old drafts', () => {
  const c = character();
  c.classSkills.fighter = ['history', 'perception'];
  assert.equal(api.validCharacter(c), true);
  assert.equal(api.validCharacter({ ...c, classSkills: { fighter: ['history', 'history'] } }), false);
  assert.equal(api.validCharacter({ ...c, classSkills: { fighter: ['arcana'] } }), false);
  assert.equal(api.validCharacter({ ...c, expertise: ['arcana'] }), false);

  const halfElf = { ...c, race: 'halfelf', raceSkills: ['nature', 'arcana'] };
  assert.equal(api.validCharacter(halfElf), true);
  assert.equal(api.validCharacter({ ...halfElf, raceSkills: ['nature', 'nature'] }), false);
  assert.equal(api.validCharacter({ ...halfElf, raceSkills: ['athletics', 'nature'] }), false);

  const oldDraft = api.newChar();
  oldDraft.abilityMethod = 'point';
  oldDraft.bases.point = { str: 15, dex: 15, con: 15, int: 15, wis: 15, cha: 15 };
  oldDraft.classSkills = { fighter: ['unknown_skill'] };
  storageData.set('dnd5e2014_chars_v1', JSON.stringify([oldDraft]));
  api.loadLib();
  assert.equal(api.storageCorrupt, false);
  assert.equal(api.library.length, 1);
  api.setChar(api.library[0]);
  assert.match(api.renderSkills(), /Сбросить выборы навыков/);
  api.setLibrary([]);
  storageData.delete('dnd5e2014_chars_v1');
});

test('short rest preserves ordinary spell slots and restores pact slots', () => {
  const c = character();
  c.classes = [{ cls: 'wizard', lvl: 5, sub: 'evocation' }];
  c.game.slotsUsed = { 0: 2, 1: 1 };
  api.setChar(c);
  api.setLibrary([c]);
  const oldRender = api.renderFn;
  api.setRenderFn(() => {});
  api.shortRest();
  assert.deepEqual(c.game.slotsUsed, { 0: 2, 1: 1 });

  c.classes = [{ cls: 'warlock', lvl: 3, sub: 'fiend' }];
  c.game.pactUsed = 2;
  c.game.resources.pact = 2;
  api.shortRest();
  assert.equal(c.game.pactUsed, 0);
  assert.equal(c.game.resources.pact, 0);
  api.setRenderFn(oldRender);
  api.setLibrary([]);
});

test('stored long character names remain loadable while new input respects the limit', () => {
  const c = character();
  c.name = 'x'.repeat(101);
  assert.equal(api.validCharacter(c), false);
  assert.equal(api.validCharacter(c, false), true);
  storageData.set('dnd5e2014_chars_v1', JSON.stringify([c]));
  api.loadLib();
  assert.equal(api.storageCorrupt, false);
  assert.equal(api.library.length, 1);
  api.setChar(api.library[0]);
  assert.match(api.renderMain(), /Имя персонажа<input maxlength="100"/);
  api.setLibrary([]);
  storageData.delete('dnd5e2014_chars_v1');
});

test('backup libraries require unique character ids', () => {
  assert.equal(api.hasUniqueCharacterIds([{ id: 'one' }, { id: 'two' }]), true);
  assert.equal(api.hasUniqueCharacterIds([{ id: 'same' }, { id: 'same' }]), false);
  assert.equal(api.hasUniqueCharacterIds([{}, {}]), true);
});

test('import validation rejects malformed character data and migration fills legacy defaults', () => {
  const c = character();
  assert.equal(api.validCharacter(c), true);
  assert.equal(api.validCharacter({ name: 'Future', schemaVersion: 99, classes: [{ cls: 'fighter', lvl: 1 }] }), false);
  assert.equal(api.validCharacter({ name: 'Broken', classes: [{ cls: 'unknown', lvl: 1 }] }), false);
  assert.equal(api.validCharacter({ name: 'Broken', classes: [{ cls: 'fighter', lvl: 1, sub: 'life' }] }), false);
  assert.equal(api.validCharacter({ name: 'Broken', race: 'human', subrace: 'high', classes: [{ cls: 'fighter', lvl: 1 }] }), false);
  assert.equal(api.validCharacter({ name: 'Broken', classes: [{ cls: 'fighter', lvl: 1 }], choices: [] }), false);
  assert.equal(api.validCharacter({ name: 'Broken', classes: [{ cls: 'fighter', lvl: 1 }], choices: { deftExplorerMode: 'unknown' } }), false);
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const unsafe = JSON.parse(`{"name":"Broken","classes":[{"cls":"fighter","lvl":1}],"choices":{"${key}":[]}}`);
    assert.equal(api.validCharacter(unsafe), false);
  }
  assert.equal(api.validCharacter({ name: 'Broken', classes: [{ cls: 'fighter', lvl: 1 }], game: { slotsUsed: [] } }), false);
  assert.equal(api.validCharacter({ ...c, game: { ...c.game, hpCur: '<img src=x onerror=alert(1)>' } }), false);
  assert.equal(api.validCharacter({ ...c, game: { ...c.game, dsOk: '<svg onload=alert(1)>' } }), false);
  assert.equal(api.validCharacter({ name: 'Broken', classes: [{ cls: 'fighter', lvl: 1 }], inventory: [{ type: 'weapon', id: 'sword', qty: 'many' }] }), false);
  assert.equal(api.validCharacter({ ...c, asi: { asi0: { type: 'feat', id: 'lucky', bonus: 'str' } } }), false);
  assert.equal(api.validCharacter({ ...c, asi: { asi0: { type: 'asi', vals: ['str', 'str'] } } }), false);
  const profiled = { ...c, goals: 'Найти родной дом', appearance: { ...c.appearance, age: '120 лет', details: 'Шрам над бровью' }, portrait: 'data:image/jpeg;base64,AA==' };
  assert.equal(api.validCharacter(profiled), true);
  assert.equal(api.validCharacter({ ...profiled, portrait: 'data:image/svg+xml;base64,PHN2Zy8+' }), false);
  assert.equal(api.validCharacter({ ...profiled, appearance: { ...profiled.appearance, unknown: 'x' } }), false);
  assert.equal(api.validCharacter({ ...profiled, portrait: 'data:image/jpeg;base64,' + 'A'.repeat(200000) }), false);
  const fighterWithAsi = { ...c, classes: [{ cls: 'fighter', lvl: 4, sub: 'champion' }], asi: { asi0: { type: 'asi', vals: ['str', 'str'] } } };
  assert.equal(api.validCharacter(fighterWithAsi), true);
  assert.equal(api.validCharacter({ ...fighterWithAsi, asi: { ...fighterWithAsi.asi, asi1: { type: 'asi', vals: ['dex', 'dex'] } } }), false);
  assert.equal(api.validCharacter({ ...fighterWithAsi, asi: { asi99: { type: 'asi', vals: ['str', 'str'] } } }), false);
  const multiclass = { ...c, abilityMethod: 'manual', bases: { ...c.bases, manual: { str: 13, dex: 13, con: 10, int: 13, wis: 13, cha: 10 } }, classes: [{ cls: 'wizard', lvl: 1, sub: 'evocation' }, { cls: 'fighter', lvl: 1, sub: 'champion' }] };
  assert.equal(api.validCharacter(multiclass), true);
  assert.equal(api.validCharacter({ ...multiclass, bases: { ...multiclass.bases, manual: { ...multiclass.bases.manual, int: 11 } } }), false);
  assert.equal(api.validCharacter(null), false);

  const legacy = api.migrate({ name: 'Старый герой', classes: [{ cls: 'fighter', lvl: 3 }], race: null, bg: null, choices: null, game: null, injected: '<svg onload=alert(1)>' });
  assert.ok(legacy.id);
  assert.equal(legacy.race, 'human');
  assert.equal(legacy.bg, 'soldier');
  assert.equal(legacy.abilityMethod, 'standard');
  assert.equal(legacy.schemaVersion, 4);
  assert.equal(Object.hasOwn(legacy, 'injected'), false);
  assert.ok(Array.isArray(legacy.extraLangs));
  assert.ok(legacy.racialSpells && typeof legacy.racialSpells === 'object');
  assert.deepEqual({ ...legacy.appearance }, { age: '', height: '', weight: '', eyes: '', skin: '', hair: '', details: '' });
  assert.equal(legacy.goals, '');
  assert.equal(legacy.portrait, '');
  assert.equal(api.validCharacter(legacy), true);
  const legacyStyles = api.migrate({ name: 'Старый воин', classes: [{ cls: 'fighter', lvl: 10, sub: 'champion' }], choices: { fightingStyle: 'defense', fightingStyle2: 'dueling' } });
  assert.equal(legacyStyles.choices.fightingStyles.fighter, 'defense');
  assert.equal(legacyStyles.choices.fightingStyles.championExtra, 'dueling');
  assert.equal(Object.hasOwn(legacyStyles.choices, 'fightingStyle'), false);
});

test('import and readiness reject unknown or duplicate spell ids', () => {
  const c = character();
  const validSpellId = api.SPELLS[0].id;
  assert.equal(api.validCharacter(c), true);
  for (const changed of [
    { ...c, cantrips: { bard: ['unknown_spell'] } },
    { ...c, spellsKnown: { bard: ['unknown_spell'] } },
    { ...c, spellsPrepared: { wizard: ['unknown_spell'] } },
    { ...c, spellbook: ['unknown_spell'] },
    { ...c, arcanum: { 6: 'unknown_spell' } },
    { ...c, racialSpells: { elf: 'unknown_spell' } },
    { ...c, spellbook: [validSpellId, validSpellId] },
  ]) assert.equal(api.validCharacter(changed), false);

  c.classes = [{ cls: 'bard', lvl: 1, sub: 'lore' }];
  c.classSkills.bard = ['arcana', 'history', 'insight'];
  c.cantrips.bard = ['unknown_1', 'unknown_2'];
  c.spellsKnown.bard = ['unknown_1', 'unknown_2', 'unknown_3', 'unknown_4'];
  api.setChar(c);
  const spellIssues = api.characterReadiness().filter(i => i.tab === 'spells').map(i => i.text);
  assert.ok(spellIssues.some(text => text.includes('неизвестные заклинания')));
  assert.ok(spellIssues.some(text => text.includes('заговоры (0/2)')));
  assert.ok(spellIssues.some(text => text.includes('известные заклинания (0/4)')));
});

test('spell import checks class lists and level access while readiness reports excess selections', () => {
  const c = api.newChar();
  c.classes = [{ cls: 'bard', lvl: 1, sub: 'lore' }];
  const wizardSpell = api.SPELLS.find(s => s.lvl === 1 && s.cls.includes('wizard') && !s.cls.includes('bard'));
  c.spellsKnown = { bard: [wizardSpell.id] };
  assert.equal(api.validCharacter(c), false);

  const higherLevelBardSpell = api.SPELLS.find(s => s.lvl === 2 && s.cls.includes('bard'));
  c.spellsKnown = { bard: [higherLevelBardSpell.id] };
  assert.equal(api.validCharacter(c), false);

  const wizard = api.newChar();
  wizard.classes = [{ cls: 'wizard', lvl: 1, sub: 'evocation' }];
  wizard.spellsPrepared = { wizard: ['mage_armor'] };
  assert.equal(api.validCharacter(wizard), false); // prepared wizard spells must be in the spellbook

  const warlock = api.newChar();
  warlock.classes = [{ cls: 'warlock', lvl: 11, sub: 'fiend' }];
  warlock.arcanum = { 6: api.SPELLS.find(s => s.lvl === 6 && s.cls.includes('warlock')).id };
  assert.equal(api.validCharacter(warlock), true);

  const bard = api.newChar();
  bard.classes = [{ cls: 'bard', lvl: 1, sub: 'lore' }];
  bard.spellsKnown = { bard: api.SPELLS.filter(s => s.lvl === 1 && s.cls.includes('bard')).slice(0, 5).map(s => s.id) };
  api.setChar(bard);
  assert.ok(api.characterReadiness().some(i => i.text.includes('удалите лишние известные заклинания (5/4)')));

  const cleric = api.newChar();
  cleric.classes = [{ cls: 'cleric', lvl: 1, sub: 'life' }];
  cleric.spellsPrepared = { cleric: api.SPELLS.filter(s => s.lvl === 1 && s.cls.includes('cleric')).slice(0, 2).map(s => s.id) };
  api.setChar(cleric);
  assert.ok(api.characterReadiness().some(i => i.text.includes('подготовлено слишком много заклинаний (2/1)')));
});

test('corrupt local libraries remain untouched until explicit backup replacement', () => {
  const key = 'dnd5e2014_chars_v1';
  for (const raw of ['{broken', JSON.stringify([{ name: 'Broken', classes: [] }])]) {
    storageData.set(key, raw);
    api.loadLib();
    assert.equal(api.library.length, 0);
    assert.equal(api.storageCorrupt, true);
    assert.equal(api.saveLib(), false);
    assert.equal(storageData.get(key), raw);
    api.setLibrary([api.newChar()]);
    assert.equal(api.saveLib(true), true);
    assert.equal(api.storageCorrupt, false);
    assert.equal(JSON.parse(storageData.get(key)).length, 1);
  }
});

test('localStorage access failures are caught without throwing or overwriting data', () => {
  const key = 'dnd5e2014_chars_v1';
  const raw = storageData.get(key);
  storageReadError = true;
  api.loadLib();
  assert.equal(api.storageCorrupt, true);
  storageReadError = false;
  api.setLibrary([api.newChar()]);
  storageWriteError = true;
  assert.equal(api.saveLib(true), false);
  assert.equal(storageData.get(key), raw);
  storageWriteError = false;
  assert.equal(api.saveLib(true), true);
  assert.equal(api.storageCorrupt, false);
});

test('untrusted import identifiers and languages cannot become executable markup', () => {
  const c = character();
  c.id = "');window.__xssFired=true;//";
  assert.equal(api.validCharacter(c), false);
  c.id = 'safe-id';
  c.extraLangs = ['<img src=x onerror="window.__xssFired=true">'];
  assert.equal(api.validCharacter(c), false);
  api.setChar(c);
  const main = api.renderMain();
  assert.doesNotMatch(main, /<img src=x/);
  assert.match(main, /&lt;img src=x onerror=/);
  c.inventory = [{ type: 'instrument', id: '<img src=x onerror="window.__xssFired=true">', qty: 1 }];
  const equipment = api.renderEquip();
  assert.doesNotMatch(equipment, /<img src=x/);
  assert.match(equipment, /&lt;img src=x onerror=/);
  api.setLib([c]);
  const home = api.renderHome();
  assert.match(home, /data-character-action="open" data-character-id="safe-id"/);
  assert.doesNotMatch(home, /data-character-action="(?:open|duplicate|delete)"[^>]*onclick=/);
});

test('untrusted game values are rejected and escaped by sheet renderers', () => {
  const c = character();
  c.classes = [{ cls: 'paladin', lvl: 7, sub: 'devotion' }];
  c.game.hpCur = '<img src=x onerror="window.__xss=true">';
  c.game.exh = '<img src=x onerror="window.__xss=true">';
  c.game.resources.layhands = '<img src=x onerror="window.__xss=true">';
  assert.equal(api.validCharacter(c), false);
  api.setChar(c);
  const outputs = [api.renderGame(), api.renderSheet2014(), api.renderSheet2024()];
  for (const output of outputs) {
    assert.doesNotMatch(output, /<img src=x onerror=/);
    assert.match(output, /&lt;img src=x onerror=/);
  }
  dom.resource = { innerHTML: '' };
  api.drawGameTrackers();
  assert.doesNotMatch(dom.resource.innerHTML, /<img src=x onerror=/);
  assert.match(dom.resource.innerHTML, /&lt;img src=x onerror=/);
  dom.resource = null;
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

test('character goals, appearance, and portrait fill matching sheet fields', () => {
  const c = character();
  c.goals = 'Найти родной дом';
  c.appearance = { ...c.appearance, age: '120 лет', height: '170 см', eyes: 'зелёные', details: 'Шрам над бровью' };
  c.portrait = 'data:image/jpeg;base64,AA==';
  api.setChar(c);
  const sheet2024 = api.renderSheet2024();
  assert.match(sheet2024, /Найти родной дом/);
  assert.match(sheet2024, /120 лет/);
  assert.match(sheet2024, /Шрам над бровью/);
  assert.match(sheet2024, /<img class="portrait-image" src="data:image\/jpeg;base64,AA=="/);
  const sheet2014 = api.renderSheet2014();
  assert.match(sheet2014, /Найти родной дом/);
  assert.match(sheet2014, /170 см/);
});

test('2024 sheet labels spell selection status and lists damaging cantrips as attacks', () => {
  const c = character();
  c.classes = [{ cls: 'wizard', lvl: 5, sub: 'evocation' }];
  c.cantrips.wizard = ['fire_bolt', 'acid_splash', 'mending'];
  c.spellbook = ['mage_armor', 'silent_image'];
  c.spellsPrepared.wizard = ['mage_armor'];
  api.setChar(c);
  const html = api.renderSheet2024();
  assert.match(html, /<td>Огненный снаряд<\/td><td>\+6<\/td><td>урон 2d10 \(огнём\)<\/td>/);
  assert.match(html, /<td>Брызги кислоты<\/td><td>КС 14<\/td><td>урон 2d6 \(кислотой\)<\/td>/);
  assert.doesNotMatch(html.match(/<div class="p24-weapons">[\s\S]*?<\/table>/)?.[0] || '', /<td>Починка<\/td>/);
  assert.match(html, /<b>Доспехи мага<\/b>[\s\S]*?<span>Подгот\.<\/span>/);
  assert.match(html, /<b>Безмолвный образ<\/b>[\s\S]*?<span>Книга<\/span>/);
  assert.match(html, /<b>Починка<\/b>[\s\S]*?<span>Заговор<\/span>/);
});

test('2024 sheet scales damaging cantrips by total level and tracks Eldritch Blast beams', () => {
  const c = character();
  c.classes = [{ cls: 'wizard', lvl: 17, sub: 'evocation' }];
  c.cantrips.wizard = ['fire_bolt'];
  api.setChar(c);
  assert.match(api.renderSheet2024(), /<td>Огненный снаряд<\/td><td>\+9<\/td><td>урон 4d10 \(огнём\)<\/td>/);

  c.classes = [{ cls: 'warlock', lvl: 17, sub: 'fiend' }];
  c.cantrips = { warlock: ['eldritch_blast'] };
  api.setChar(c);
  assert.match(api.renderSheet2024(), /<td>Мистический заряд<\/td><td>\+6<\/td><td>1d10\/луч · 4 луча<\/td>/);
});

test('2024 sheet adds continuation pages when the spell list exceeds one page', () => {
  const c = character();
  c.classes = [{ cls: 'wizard', lvl: 1, sub: 'evocation' }];
  const wizardSpells = api.SPELLS.filter(spell => spell.lvl > 0 && spell.cls.includes('wizard')).slice(0, 36);
  assert.equal(wizardSpells.length, 36);
  c.spellbook = wizardSpells.map(spell => spell.id);
  api.setChar(c);
  const html = api.renderSheet2024();
  assert.equal([...html.matchAll(/data-sheet-page="\d+"/g)].length, 5);
  assert.match(html, new RegExp(`<b>${wizardSpells[35].ru.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<\\/b>`));
});

test('warlock expanded spell lists offer choices but do not grant spells automatically', () => {
  const c = character();
  c.classes = [{ cls: 'warlock', lvl: 1, sub: 'fiend' }];
  api.setChar(c);
  assert.equal(api.domainSpellsOf(c.classes[0]).length, 0);
  assert.match(api.renderSpells(), /Огненные ладони/);
  assert.doesNotMatch(api.renderSheet2024(), /<b>Огненные ладони<\/b>/);

  c.spellsKnown.warlock = ['burning_hands'];
  api.setChar(c);
  assert.equal(api.validCharacter(c), true);
  assert.match(api.renderSheet2024(), /<b>Огненные ладони<\/b>[\s\S]*?<span>Известно<\/span>/);
});

test('ASI-selected feats appear on the 2024 sheet', () => {
  const c = character();
  c.classes = [{ cls: 'fighter', lvl: 4, sub: 'champion' }];
  c.asi = { asi0: { type: 'feat', id: 'alert' } };
  api.setChar(c);
  assert.match(api.renderSheet2014(), /Бдительный/);
  assert.match(api.renderSheet2024(), /Бдительный/);
});

test('2024 sheet separates species/subspecies from class/subclass in its header', () => {
  const c = character();
  c.race = 'elf';
  c.subrace = 'high';
  c.classes = [{ cls: 'wizard', lvl: 5, sub: 'evocation' }];
  api.setChar(c);
  const html = api.renderSheet2024();
  assert.match(html, /<div class="pdf-cap">вид<\/div><b>Эльф \(Высший эльф\)<\/b>/);
  assert.match(html, /<div class="pdf-cap">класс<\/div><b>Волшебник 5<\/b>/);
  assert.match(html, /<div class="pdf-cap">подкласс<\/div><b>Волшебник: Школа Воплощения<\/b>/);
});

test('racial spell choices are separate from class limits and appear on sheets', () => {
  const c = character();
  c.classes = [{ cls: 'fighter', lvl: 1, sub: 'champion' }];
  c.race = 'astralelf';
  api.setChar(c);
  const html = api.renderSpells();
  assert.match(html, /Астральный огонь/);
  assert.match(html, /name="racial_astralelf"/);
  assert.match(html, /Дар расы/);
  assert.equal(api.racialCantripChoices()[0].spells.length, 3);

  c.racialSpells.astralelf = 'sacred_flame';
  c.racialSpells.astralelfAbility = 'cha';
  api.setChar(c);
  const entries = api.racialSpellEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].spell.id, 'sacred_flame');
  assert.equal(entries[0].ability, 'cha');
  assert.equal(entries[0].saveDc, 10);
  assert.equal(entries[0].attackBonus, 2);
  assert.match(api.renderSpells(), /КС 10 · бонус атаки \+2/);
  assert.equal(c.cantrips.fighter, undefined);
  assert.match(api.renderSheet2014(), /Священное пламя.*дар расы/);
  assert.match(api.renderSheet2024(), /Священное пламя/);

  c.race = 'tiefling';
  c.racialSpells = {};
  api.setChar(c);
  assert.equal(api.racialSpellEntries().map(x => x.spell.id).join(','), 'thaumaturgy');
  assert.equal(api.racialSpellEntries()[0].saveDc, 11);
  assert.equal(api.racialSpellEntries()[0].attackBonus, 3);
  c.classes[0].lvl = 3;
  assert.ok(api.racialSpellEntries().some(x => x.spell.id === 'hellish_rebuke'));
  c.classes[0].lvl = 5;
  assert.ok(api.racialSpellEntries().some(x => x.spell.id === 'darkness'));
  c.race = 'elf';
  c.subrace = 'drow';
  api.setChar(c);
  assert.ok(api.racialSpellEntries().some(x => x.spell.id === 'faerie_fire'));
  c.race = 'gnome';
  c.subrace = 'forest';
  api.setChar(c);
  assert.ok(api.racialSpellEntries().some(x => x.spell.id === 'minor_illusion'));
  c.race = 'elf';
  c.subrace = 'high';
  api.setChar(c);
  assert.ok(api.racialCantripChoices()[0].spells.length > 0);
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
  assert.equal(api.validCharacter(c), true);
  assert.equal(api.validCharacter({ ...c, raceAsiPicks: ['dex', 'dex', 'cha'] }), false);
  assert.equal(api.validCharacter({ ...c, raceAsiMode: 'unknown' }), false);
  const halfElf = { ...c, race: 'halfelf', raceAsiPicks: [], halfElfPicks: ['str', 'wis'] };
  assert.equal(api.validCharacter(halfElf), true);
  assert.equal(api.validCharacter({ ...halfElf, halfElfPicks: ['str', 'str'] }), false);
  assert.equal(api.validCharacter({ ...halfElf, halfElfPicks: ['str', 'cha'] }), false);
});

test('AAG background feat appears on both character-sheet styles', () => {
  const c = character();
  c.bg = 'astraldrifter';
  api.setChar(c);
  assert.match(api.renderSheet2014(), /Посвящённый в магию: жрец \(PHB\) \(AAG\)/);
  assert.match(api.renderSheet2024(), /Посвящённый в магию: жрец \(PHB\) \(AAG\)/);
});

test('readiness checklist reports missing race, language, skill, and class choices', () => {
  const c = character();
  c.race = 'halfelf';
  c.bg = 'acolyte';
  api.setChar(c);
  const issues = api.characterReadiness();
  assert.equal(api.languageChoiceCount(), 3);
  assert.ok(issues.some(i => i.tab === 'main' && i.text.includes('язык')));
  assert.ok(issues.some(i => i.tab === 'abil' && i.text.includes('характеристики')));
  assert.ok(issues.some(i => i.tab === 'skills' && i.text.includes('навыка')));
  assert.ok(issues.some(i => i.tab === 'cls' && i.text.includes('боевой стиль')));
  const html = api.renderMain();
  assert.match(html, /Проверка заполнения/);
  assert.equal((html.match(/Язык на выбор/g) || []).length, 3);
  assert.match(html, /не блокируют сохранение и печать/);
});

test('content source audit reports untagged records without inventing sources', () => {
  const report = execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'audit-content-sources.cjs')], { encoding: 'utf8' });
  assert.match(report, /SPELLS\s+319\s+Source not recorded/);
  assert.match(report, /без источника на записи: 355/);
});

test('Deft Explorer grants expertise to a selected proficient skill', () => {
  const c = character();
  c.classes = [{ cls: 'ranger', lvl: 1, sub: 'hunter' }];
  c.classSkills.ranger = ['survival'];
  c.choices.tashaFeatures = { ranger: ['deft_explorer'] };
  api.setChar(c);
  assert.equal(api.expertiseAvailable(), 1);
  assert.ok(api.characterReadiness().some(i => i.text.includes('навык для компетентности')));

  c.choices.deftExplorerSkill = 'survival';
  api.setChar(c);
  assert.deepEqual(Array.from(api.expertiseSkills()), ['survival']);
  assert.equal(api.skillMod('survival'), 4);
  assert.equal(api.characterReadiness().some(i => i.text.includes('навык для компетентности')), false);
  assert.match(api.renderClass(), /Навык для компетентности/);
  assert.match(api.renderClass(), /value="survival" selected/);
  assert.match(api.renderSkills(), /Искусный исследователь/);
});

test('Primal Awareness grants additional spells by ranger level without using the known-spell limit', () => {
  const c = character();
  c.classes = [{ cls: 'ranger', lvl: 3, sub: 'hunter' }];
  c.choices.tashaFeatures = { ranger: ['primal_awareness'] };
  api.setChar(c);
  assert.deepEqual(Array.from(api.primalAwarenessSpells(), s => s.id), ['speak_with_animals']);
  const ranger3Limit = api.knownLimit('ranger');

  c.classes = [{ cls: 'ranger', lvl: 3, sub: 'hunter' }, { cls: 'wizard', lvl: 5, sub: 'evocation' }];
  api.setChar(c);
  assert.deepEqual(Array.from(api.primalAwarenessSpells(), s => s.id), ['speak_with_animals']);
  c.classes[0].lvl = 5;
  api.setChar(c);
  const additional = api.primalAwarenessSpells();
  assert.deepEqual(Array.from(additional, s => s.id), ['speak_with_animals', 'beast_sense']);
  assert.equal(additional[1].spell.id, 'beast_sense');
  assert.equal(additional[1].spell.src, 'PHB');
  assert.equal(additional[1].spell.lvl, 2);
  assert.equal(additional[1].spell.ritual, true);
  assert.match(additional[1].spell.full, /согласного зверя/);
  assert.deepEqual(Array.from(additional[1].spell.cls), ['druid', 'ranger']);
  assert.equal(api.knownLimit('ranger'), ranger3Limit + 1);
  c.spellsKnown.ranger = ['speak_with_animals'];
  api.setChar(c);
  const spellUi = api.renderSpells();
  assert.match(spellUi, /Известные заклинания — 0\/4/);
  assert.match(spellUi, /type="checkbox" checked disabled onchange="toggleSpell\('spellsKnown','ranger',4,'speak_with_animals',this.checked\)"/);
  assert.doesNotMatch(spellUi, /описание отсутствует в библиотеке/);

  c.classes = [{ cls: 'ranger', lvl: 17, sub: 'hunter' }];
  api.setChar(c);
  assert.equal(api.primalAwarenessSpells().length, 5);
  const knownLimitWithFeature = api.knownLimit('ranger');
  c.choices.tashaFeatures.ranger = [];
  api.setChar(c);
  assert.equal(api.knownLimit('ranger'), knownLimitWithFeature);
  assert.equal(api.primalAwarenessSpells().length, 0);

  c.choices.tashaFeatures.ranger = ['primal_awareness'];
  api.setChar(c);
  for (const name of ['Разговор с животными', 'Чутьё зверя', 'Разговор с растениями', 'Поиск существа', 'Общение с природой']) {
    assert.ok(api.renderSheet2014().includes(name), `2014 sheet includes ${name}`);
    assert.ok(api.renderSheet2024().includes(name), `2024 sheet includes ${name}`);
  }
});

test('clearing Deft Explorer mode removes only its extra language and tool choices', () => {
  const c = character();
  c.classes = [{ cls: 'ranger', lvl: 1, sub: 'hunter' }];
  c.choices.tashaFeatures = { ranger: ['deft_explorer'] };
  c.choices.deftExplorerMode = 'language_tool';
  c.choices.deftExplorerTool = api.TOOL_PROFICIENCIES[0];
  c.extraLangs = ['Эльфийский', 'Дварфийский'];
  api.setChar(c);
  const oldRender = api.renderFn;
  api.setRenderFn(() => {});
  assert.equal(api.languageChoiceCount(), 2);
  api.setDeftExplorerMode('');
  assert.equal(Object.hasOwn(c.choices, 'deftExplorerMode'), false);
  assert.equal(Object.hasOwn(c.choices, 'deftExplorerTool'), false);
  assert.deepEqual(Array.from(c.extraLangs), ['Эльфийский']);
  assert.equal(api.languageChoiceCount(), 1);
  assert.ok(api.characterReadiness().some(i => i.text.includes('Выберите дополнительные владения «Искусного исследователя»')));
  assert.equal(api.validCharacter(c), true);
  api.setDeftExplorerMode('two_languages');
  assert.equal(api.languageChoiceCount(), 3);
  assert.equal(c.extraLangs.length, 3);
  api.setDeftExplorerMode(null);
  assert.equal(api.languageChoiceCount(), 1);
  assert.equal(c.extraLangs.length, 1);
  api.setRenderFn(oldRender);
});

test('Tasha Canny language and tool alternatives count toward readiness and character sheets', () => {
  const c = character();
  c.classes = [{ cls: 'ranger', lvl: 1, sub: 'hunter' }];
  c.classSkills.ranger = ['survival'];
  c.choices.tashaFeatures = { ranger: ['deft_explorer'] };
  c.choices.deftExplorerSkill = 'survival';
  c.choices.deftExplorerMode = 'two_languages';
  c.extraLangs = ['Эльфийский', 'Драконий', 'Гномий'];
  api.setChar(c);
  assert.equal(api.languageChoiceCount(), 3);
  assert.match(api.renderMain(), /Язык «Искусного исследователя» 2/);
  assert.equal(api.characterReadiness().some(i => i.text.includes('дополнительные владения «Искусного исследователя»')), false);

  c.choices.deftExplorerMode = 'language_tool';
  c.choices.deftExplorerTool = 'Инструменты алхимика';
  c.extraLangs = ['Эльфийский', 'Драконий'];
  api.setChar(c);
  assert.equal(api.languageChoiceCount(), 2);
  assert.ok(api.toolProficiencies().includes('Инструменты алхимика'));
  assert.equal(api.characterReadiness().some(i => i.text.includes('Выберите инструмент для «Искусного исследователя»')), false);
  assert.match(api.renderSheet2014(), /Инструменты алхимика/);
  assert.match(api.renderSheet2024(), /Инструменты алхимика/);
});

test('Tasha optional class features can be selected and appear on character sheets', () => {
  const c = character();
  c.classes = [{ cls: 'barbarian', lvl: 7, sub: 'berserk' }];
  c.choices.tashaFeatures = { barbarian: ['primal_knowledge', 'instinctive_pounce'] };
  api.setChar(c);
  const html = api.renderClass();
  assert.match(html, /data-tasha-features="barbarian"/);
  assert.match(html, /type="checkbox" checked onchange="toggleTashaFeature\('barbarian','primal_knowledge',this.checked\)"/);
  assert.match(html, /Умения из «Котла Таши»/);
  assert.match(api.renderSheet2014(), /Природные знания \(Таша\)/);
  assert.match(api.renderSheet2024(), /Инстинктивный бросок \(Таша\)/);

  c.classes = [{ cls: 'ranger', lvl: 1, sub: 'hunter' }];
  c.choices.tashaFeatures = { ranger: ['deft_explorer', 'favored_foe'] };
  api.setChar(c);
  assert.equal(api.availableFeats().some(f => f.name === 'Естественный исследователь' || f.name === 'Избранный враг'), false);
  assert.equal(api.TASHA_FEATURES.ranger.length, 6);
});
