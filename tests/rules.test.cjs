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
const context = vm.createContext({
  localStorage: { getItem: () => null, setItem: () => {} },
  document: {
    querySelector: selector => selector === '#spellNoResults' ? dom.empty : selector === '#modal' ? dom.modal : null,
    querySelectorAll: selector => selector === '.spell-row' ? dom.rows : selector === '.spell-lvl' ? dom.levels : [],
  },
  console,
  alert: () => {},
});
vm.runInContext(`${script.slice(0, initAt)}
globalThis.api = {
  newChar, migrate, totalLvl, pb, am, maxHp, skillMod, spellSlots, armorClass, validCharacter,
  expertiseAvailable, expertiseSkills, deftExplorerSkill, renderSkills, toolProficiencies, TOOL_PROFICIENCIES,
  primalAwarenessSpells, knownLimit,
  setSpellQuery,
  spellPicker, renderWizardSpells, spellNameClick, SPELLS,
  renderSpells, racialCantripChoices, racialSpellEntries,
  renderMain, renderAbil, renderClass, renderSheet,
  renderSheet2014,
  renderSheet2024,
  RACES, BACKGROUNDS, racialAsi, TASHA_FEATURES, availableFeats, characterReadiness, languageChoiceCount,
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

test('import validation rejects malformed character data and migration fills legacy defaults', () => {
  const c = character();
  assert.equal(api.validCharacter(c), true);
  assert.equal(api.validCharacter({ name: 'Future', schemaVersion: 99, classes: [{ cls: 'fighter', lvl: 1 }] }), false);
  assert.equal(api.validCharacter({ name: 'Broken', classes: [{ cls: 'unknown', lvl: 1 }] }), false);
  assert.equal(api.validCharacter({ name: 'Broken', classes: [{ cls: 'fighter', lvl: 1 }], choices: [] }), false);
  assert.equal(api.validCharacter({ name: 'Broken', classes: [{ cls: 'fighter', lvl: 1 }], choices: { deftExplorerMode: 'unknown' } }), false);
  assert.equal(api.validCharacter({ name: 'Broken', classes: [{ cls: 'fighter', lvl: 1 }], game: { slotsUsed: [] } }), false);
  assert.equal(api.validCharacter({ name: 'Broken', classes: [{ cls: 'fighter', lvl: 1 }], inventory: [{ type: 'weapon', id: 'sword', qty: 'many' }] }), false);
  assert.equal(api.validCharacter(null), false);

  const legacy = api.migrate({ name: 'Старый герой', classes: [{ cls: 'fighter', lvl: 3 }], race: null, bg: null, choices: null, game: null });
  assert.ok(legacy.id);
  assert.equal(legacy.race, 'human');
  assert.equal(legacy.bg, 'soldier');
  assert.equal(legacy.abilityMethod, 'standard');
  assert.equal(legacy.schemaVersion, 2);
  assert.ok(Array.isArray(legacy.extraLangs));
  assert.ok(legacy.racialSpells && typeof legacy.racialSpells === 'object');
  assert.equal(api.validCharacter(legacy), true);
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
