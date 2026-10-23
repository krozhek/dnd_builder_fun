const CHARACTER_SCHEMA=5;
const MAX_PORTRAIT_DATA=200000;
function newChar(){
  const ab={};ABILS.forEach(([k])=>ab[k]=10);
  const ab8={};ABILS.forEach(([k])=>ab8[k]=8);
  const std={};ABILS.forEach(([k],i)=>std[k]=STD_SET[i]);
  return {
    schemaVersion:CHARACTER_SCHEMA,
    id:uid(), name:'Новый герой', race:'human', subrace:'', dragonColor:'red',
    classes:[{cls:'fighter',lvl:1,sub:'champion'}],
    bg:'soldier', align:'Истинно нейтральный', size:'Средний', xp:0,
    abilityMethod:'standard', bases:{standard:{...std}, point:{...ab8}, manual:{...ab}},
    asi:{}, halfElfPicks:[], raceAsiMode:'two', raceAsiPicks:[], feat:{},
    classSkills:{}, raceSkills:[], expertise:[],
    languages:['Общий'], extraLangs:[],
    choices:{}, // fightingStyle, favoredEnemy, favoredTerrain, hunter{3,7,11,15}, pactBoon, druidLand, metamagic[], invocations[]
    cantrips:{}, spellsKnown:{}, spellsPrepared:{}, spellbook:[], arcanum:{}, racialSpells:{},
    equipChoice:{}, goldMode:'equipment', gold:0, inventory:[], attunement:['','',''],
    game:{hpCur:null,hpTemp:0,hdUsed:0,hdUsedByClass:{},slotsUsed:{},pactUsed:0,resources:{},dsOk:0,dsFail:0,conditions:'',notes:'',insp:false,exh:0},
    personality:{traits:'',ideals:'',bonds:'',flaws:''}, allies:'', backstory:'', goals:'', appearance:{age:'',height:'',weight:'',eyes:'',skin:'',hair:'',details:''}, portrait:'', treasure:'', featuresNotes:'',
    created:Date.now(), updated:Date.now()
  };
}

let STORAGE_WARNING_SHOWN=false, STORAGE_CORRUPT=false;
function readStorage(key){try{return {value:localStorage.getItem(key)}}catch(error){console.error(`Не удалось прочитать ${key}`,error);return {error}}}
function writeStorage(key,value){try{localStorage.setItem(key,value);return true}catch(error){console.error(`Не удалось записать ${key}`,error);return false}}
const storedTheme=readStorage(LS_THEME).value, storedSheet=readStorage(LS_SHEET).value;
let LIB=[], C=null, TAB='home', THEME=storedTheme==='light'?'light':'dark', SHEET_VERSION=storedSheet==='2024'?'2024':'2014';
function hasUniqueCharacterIds(characters){const ids=characters.map(c=>c?.id).filter(Boolean);return new Set(ids).size===ids.length}
function loadLib(){
  const {value,error}=readStorage(LS_KEY);
  if(error){LIB=[];STORAGE_CORRUPT=true;warnStorage();return}
  if(value==null){LIB=[];return}
  try{
    const saved=JSON.parse(value);
    if(!Array.isArray(saved)||!saved.every(c=>validCharacter(c,false))||!hasUniqueCharacterIds(saved))throw new Error('Некорректная библиотека персонажей');
    LIB=saved.map(migrate);
  }catch(error){LIB=[];STORAGE_CORRUPT=true;console.error('Не удалось восстановить библиотеку персонажей',error);warnStorage()}
}
function warnStorage(){
  if(STORAGE_WARNING_SHOWN)return;
  STORAGE_WARNING_SHOWN=true;
  alert(STORAGE_CORRUPT
    ?'Библиотека персонажей повреждена или недоступна. Исходные данные оставлены без изменений; новые изменения не сохраняются. Восстановите библиотеку из резервной копии.'
    :'Не удалось сохранить данные персонажей в браузере. Скачайте резервную копию и проверьте свободное место в хранилище.');
}
function saveLib(replaceCorrupt=false){
  if(STORAGE_CORRUPT&&!replaceCorrupt){warnStorage();return false}
  if(!Array.isArray(LIB)||!hasUniqueCharacterIds(LIB)||!LIB.every(c=>validCharacter(c,false)))return false;
  if(!writeStorage(LS_KEY,JSON.stringify(LIB))){if(replaceCorrupt)STORAGE_WARNING_SHOWN=false;warnStorage();return false}
  STORAGE_CORRUPT=false;STORAGE_WARNING_SHOWN=false;return true;
}
function persist(){
  if(!C)return;
  const previous=LIB.find(c=>c.id===C.id);
  if(!validCharacterTransition(C,previous)){
    if(previous){C=migrate(JSON.parse(JSON.stringify(previous)));render()}
    alert('Некорректное изменение отменено; восстановлено последнее сохранённое состояние.');
    return false;
  }
  if(STORAGE_CORRUPT){warnStorage();return}
  C.updated=Date.now();
  const i=LIB.findIndex(c=>c.id===C.id);
  const snap=JSON.parse(JSON.stringify(C));
  if(i>=0)LIB[i]=snap;else LIB.push(snap);
  if(!saveLib())return;
  if(!writeStorage(LS_CUR,C.id))warnStorage();
}
function openChar(id){
  const f=LIB.find(c=>c.id===id);
  if(!f)return;
  C=migrate(JSON.parse(JSON.stringify(f)));
  TAB='main';
  render();
}
// ponytail: legacy versions share migrate()'s normalization; add a version step only when a schema change needs a distinct transform.
const SCHEMA_MIGRATIONS={
  4:character=>{
    const used={...(character.game.hdUsedByClass||{})};
    if(!Object.keys(used).length){
      let remaining=Math.max(0,Math.floor(character.game.hdUsed||0));
      for(const cls of character.classes){const count=Math.min(cls.lvl,remaining);if(count)used[cls.cls]=count;remaining-=count}
    }
    return {...character,game:{...character.game,hdUsedByClass:used}};
  }
};
function migrate(ch){
  const d=newChar();
  const m={...d,...Object.fromEntries(Object.entries(ch).filter(([key])=>Object.hasOwn(d,key)))};
  m.bases={...d.bases,...(ch.bases||{})};
  ['standard','point','manual'].forEach(k=>{
    m.bases[k]={...(k==='standard'?(()=>{const s={};ABILS.forEach(([a],i)=>s[a]=STD_SET[i]);return s})():k==='point'?(()=>{const s={};ABILS.forEach(([a])=>s[a]=8);return s})():(()=>{const s={};ABILS.forEach(([a])=>s[a]=10);return s})()), ...(ch.bases&&ch.bases[k]&&!Array.isArray(ch.bases[k])?ch.bases[k]:{})};
  });
  m.game={...d.game,...(ch.game||{})};
  m.game.hdUsedByClass=isRecord(ch.game?.hdUsedByClass)?ch.game.hdUsedByClass:{};
  m.personality={...d.personality,...(ch.personality||{})};
  m.appearance={...d.appearance,...(isRecord(ch.appearance)?ch.appearance:{})};
  m.choices={...d.choices,...(isRecord(ch.choices)?ch.choices:{})};
  m.race=RACES[m.race]?m.race:d.race;
  m.bg=BACKGROUNDS[m.bg]?m.bg:d.bg;
  if(!['standard','point','manual'].includes(m.abilityMethod))m.abilityMethod=d.abilityMethod;
  for(const key of ['asi','classSkills','cantrips','spellsKnown','spellsPrepared','arcanum','racialSpells','equipChoice'])m[key]={...d[key],...(isRecord(ch[key])?ch[key]:{})};
  for(const key of ['halfElfPicks','raceSkills','raceAsiPicks','expertise','languages','extraLangs','spellbook','inventory','attunement'])m[key]=Array.isArray(ch[key])?ch[key]:d[key];
  if(!Array.isArray(m.classes)||!m.classes.length)m.classes=[{cls:'fighter',lvl:1,sub:'champion'}];
  const styles={...(isRecord(m.choices.fightingStyles)?m.choices.fightingStyles:{})};
  if(!Object.keys(styles).length&&m.choices.fightingStyle){
    const source=m.classes.find(c=>FIGHTING_STYLES[c.cls]&&c.lvl>=(c.cls==='fighter'?1:2)&&FIGHTING_STYLES[c.cls].some(([id])=>id===m.choices.fightingStyle));
    if(source)styles[source.cls]=m.choices.fightingStyle;
  }
  if(m.choices.fightingStyle2&&m.classes.some(c=>c.cls==='fighter'&&c.sub==='champion'&&c.lvl>=10)&&m.choices.fightingStyle2!==styles.fighter)styles.championExtra=m.choices.fightingStyle2;
  m.choices.fightingStyles=styles;
  delete m.choices.fightingStyle;delete m.choices.fightingStyle2;
  if(typeof m.id!=='string'||!m.id)m.id=uid();
  let version=Number.isInteger(ch.schemaVersion)?ch.schemaVersion:1;
  while(version<CHARACTER_SCHEMA){
    if(SCHEMA_MIGRATIONS[version])Object.assign(m,SCHEMA_MIGRATIONS[version](m));
    version++;
  }
  m.schemaVersion=CHARACTER_SCHEMA;
  return m;
}

// ---------- производные ----------
const totalLvl=()=>C.classes.reduce((s,c)=>s+c.lvl,0);
const pb=()=>PB_BY_LVL[Math.min(20,totalLvl())-1];
function raceOf(){return RACES[C.race]||RACES.human}
function subraceOf(){const r=raceOf();return r.subs&&C.subrace?r.subs[C.subrace]:null}
function baseLanguageChoiceCount(){const r=raceOf(),s=subraceOf(),bg=BACKGROUNDS[C.bg]||{};return (r.extraLang||0)+(s?.extraLang||0)+(bg.langs||0)}
function racialAsi(){
  const out={str:0,dex:0,con:0,int:0,wis:0,cha:0};
  const r=raceOf(), s=subraceOf();
  const add=o=>{for(const k in o)out[k]+=o[k]};
  add(r.asi||{}); if(s)add(s.asi||{});
  if(r.flexibleAsi){
    const picks=(C.raceAsiPicks||[]).filter(Boolean);
    if(C.raceAsiMode==='three')picks.slice(0,3).forEach(a=>{if(out[a]!=null)out[a]++});
    else{if(out[picks[0]]!=null)out[picks[0]]+=2;if(out[picks[1]]!=null)out[picks[1]]++}
  }
  if(r.asiChoice){(C.halfElfPicks||[]).slice(0,r.asiChoice.count).forEach(a=>{if(!r.asiChoice.exclude.includes(a))out[a]+=r.asiChoice.val})}
  return out;
}
function asiBonus(){
  const out={str:0,dex:0,con:0,int:0,wis:0,cha:0};
  for(const key in (C.asi||{})){
    const a=C.asi[key];
    if(Array.isArray(a))a.forEach(x=>{if(out[x]!=null)out[x]+=1}); // старый формат
    else if(a&&a.type==='asi')(a.vals||[]).forEach(x=>{if(out[x]!=null)out[x]+=1});
    else if(a&&a.type==='feat'&&a.bonus&&out[a.bonus]!=null)out[a.bonus]+=1;
  }
  return out;
}
function hasFeat(id){return BACKGROUNDS[C.bg]?.feat===id||Object.values(C.asi||{}).some(a=>a?.type==='feat'&&a.id===id)}
function featBonusAbility(id){return Object.values(C.asi||{}).find(a=>a?.type==='feat'&&a.id===id)?.bonus||''}
function abil(a){
  const base=(C.bases[C.abilityMethod]&&C.bases[C.abilityMethod][a]!=null)?C.bases[C.abilityMethod][a]:10;
  const primal=C.classes.some(c=>c.cls==='barbarian'&&c.lvl>=20)&&['str','con'].includes(a);
  return Math.max(1,Math.min(primal?24:20,base+racialAsi()[a]+asiBonus()[a]+(primal?4:0)));
}
const am=a=>mod(abil(a));
// владения навыками
function bgSkills(){return (BACKGROUNDS[C.bg]||{}).skills||[]}
function raceSkills(){
  const r=raceOf(),s=subraceOf(),out=[...(r.skillProf||[])];
  if(r.skillChoice)out.push(...(C.raceSkills||[]).slice(0,r.skillChoice));
  return out;
}
function classSkills(){return [...new Set(C.classes.flatMap(c=>C.classSkills[c.cls]||[]))]}
function classSkillChoiceCount(index,cls){const cl=CLASSES[cls];return index===0?cl.skillCount:(cl.multiclassSkillCount||0)}
function multiclassRequirementError(cls,skipIndex=-1){
  const existing=C.classes.filter((_,i)=>i!==skipIndex);
  const meets=id=>(MULTICLASS_PREREQUISITES[id]||[]).every(req=>req.any?Object.entries(req.any).some(([a,n])=>abil(a)>=n):Object.entries(req).every(([a,n])=>abil(a)>=n));
  const unmet=existing.find(c=>!meets(c.cls));
  if(unmet)return `Не выполнены требования мультиклассирования для текущего класса «${CLASSES[unmet.cls].name}».`;
  if(existing.length&&!meets(cls))return `Для добавления класса «${CLASSES[cls].name}» не выполнены требования к характеристикам.`;
  return '';
}
function profSkills(){return [...new Set([...bgSkills(),...raceSkills(),...classSkills()])]}
function deftExplorerActive(){return C.classes.some(c=>c.cls==='ranger'&&selectedTashaFeatures(c).some(f=>f[0]==='deft_explorer'))}
function deftExplorerSkill(){const skill=C.choices.deftExplorerSkill;return deftExplorerActive()&&profSkills().includes(skill)?skill:''}
function expertiseSkills(){const selected=[...(C.expertise||[])],tasha=deftExplorerSkill();if(tasha&&profSkills().includes(tasha))selected.push(tasha);return [...new Set(selected)]}
function raceWeaponProfile(){
  const profile=RACE_WEAPON_PROFICIENCIES[C.race];
  return Array.isArray(profile)?profile:profile?.[C.subrace]||[];
}
function classWeaponProfile(c,index){
  const profiles=CLASS_WEAPON_PROFICIENCIES[c.cls];
  return profiles&&(index===0?profiles.starting:profiles.multiclass)||{};
}
function classWeaponProficiencies(c,index){
  const profile=classWeaponProfile(c,index),subclass=SUBCLASSES[c.sub]?.weaponProficiencies,names=[];
  if(profile.simple||subclass?.simple)names.push('Простое оружие');if(profile.martial||subclass?.martial)names.push('Воинское оружие');
  for(const id of new Set([...(profile.extra||[]),...(subclass?.extra||[])])){const weapon=WEAPONS.find(w=>w[0]===id);if(weapon)names.push(weapon[1])}
  return names;
}
function classArmorProficiencies(c,index){
  const profs=new Set(CLASS_ARMOR_PROFICIENCIES[c.cls]?.[index===0?'starting':'multiclass']||[]);
  if(c.cls==='cleric'&&c.lvl>=CLASSES.cleric.subLvl&&['life','nature','tempest','war'].includes(c.sub))profs.add('heavy');
  return profs;
}
function armorProficiencies(){
  const profs=new Set();
  C.classes.forEach((c,index)=>classArmorProficiencies(c,index).forEach(p=>profs.add(p)));
  (RACE_ARMOR_PROFICIENCIES[C.race]?.[C.subrace]||[]).forEach(p=>profs.add(p));
  const featIds=Object.values(C.asi||{}).filter(a=>a?.type==='feat').map(a=>a.id);
  if(featIds.includes('lightly_armored'))profs.add('light');
  if(featIds.includes('moderately_armored'))['light','medium','shield'].forEach(p=>profs.add(p));
  if(featIds.includes('heavily_armored'))profs.add('heavy');
  return profs;
}
function classArmorProficiencyText(c,index){
  const names=[['light','лёгкие'],['medium','средние'],['heavy','тяжёлые'],['shield','щиты']].filter(([id])=>classArmorProficiencies(c,index).has(id)).map(([,name])=>name);
  return names.join(', ')||'—';
}
function armorProficient(armorId){
  const armor=ARMORS.find(a=>a[0]===armorId);if(!armor)return false;
  return armorProficiencies().has(armor[8]);
}
function armorProficiencyText(){
  const profs=armorProficiencies(),names=[['light','Лёгкие'],['medium','Средние'],['heavy','Тяжёлые'],['shield','Щиты']].filter(([id])=>profs.has(id)).map(([,name])=>name);
  return names.join(', ')||'—';
}
function classToolProficiencyText(c,index){
  const spec=CLASS_TOOL_PROFICIENCIES[c.cls]?.[index===0?'starting':'multiclass']||{},groups=classToolChoiceGroups(c,index),selected=(C.choices.classTools||{})[c.cls]||[],names=[...(spec.fixed||[])];
  let offset=0;for(const group of groups){const picks=selected.slice(offset,offset+group.count).filter(value=>group.options.includes(value));names.push(...picks);if(picks.length<group.count)names.push(`${group.count-picks.length} на выбор`);offset+=group.count}
  return names.join(', ')||'—';
}
function weaponProficiencyText(){
  const profiles=C.classes.map((c,i)=>({...classWeaponProfile(c,i),...SUBCLASSES[c.sub]?.weaponProficiencies})),names=[];
  if(profiles.some(p=>p.simple))names.push('Простое оружие');if(profiles.some(p=>p.martial))names.push('Воинское оружие');
  const extra=new Set([...profiles.flatMap(p=>p.extra||[]),...raceWeaponProfile()]);
  for(const id of extra){const weapon=WEAPONS.find(w=>w[0]===id);if(weapon)names.push(weapon[1])}
  return names.join(', ')||'—';
}
function backgroundToolChoiceGroups(bgId=C.bg){
  const fixed=[],choices=[];
  for(const value of BACKGROUNDS[bgId]?.tools||[]){
    if(TOOL_PROFICIENCIES.includes(value)){fixed.push(value);continue}
    if(value==='Транспорт (наземный)'){fixed.push('Наземный транспорт');continue}
    if(value==='Транспорт (водный)'){fixed.push('Водный транспорт');continue}
    if(value==='Транспорт (космический)'){fixed.push('Космический транспорт');continue}
    let options=[];
    if(value.includes('Игровой набор'))options=TOOL_CHOICE_OPTIONS.gaming;
    else if(value.includes('Музыкальный инструмент'))options=TOOL_CHOICE_OPTIONS.instrument;
    else if(value.includes('Ремесленные инструменты')&&value.includes('музыкальный инструмент'))options=TOOL_CHOICE_OPTIONS.artisanOrInstrument;
    else if(value.includes('Ремесленные инструменты'))options=TOOL_CHOICE_OPTIONS.artisan;
    if(options.length)choices.push({label:value,options,count:1});
  }
  return {fixed,choices};
}
function classToolChoiceGroups(c,index){
  const spec=CLASS_TOOL_PROFICIENCIES[c.cls]?.[index===0?'starting':'multiclass']||{},groups=[];
  if(spec.choice)groups.push({label:spec.count===1?'Инструмент на выбор':`Музыкальные инструменты (${spec.count} на выбор)`,options:TOOL_CHOICE_OPTIONS[spec.choice],count:spec.count});
  if(c.cls==='fighter'&&c.sub==='battlemaster'&&c.lvl>=3)groups.push({label:'Инструменты ученика войны (1 на выбор)',options:TOOL_CHOICE_OPTIONS.artisan,count:1});
  return groups;
}
function toolProficiencies(){
  const {fixed:backgroundTools,choices:backgroundChoices}=backgroundToolChoiceGroups();
  const tools=[...backgroundTools,...(C.choices.backgroundTools||[]).flatMap((value,i)=>backgroundChoices[i]?.options.includes(value)?[value]:[])];
  C.classes.forEach((c,index)=>{
    const spec=CLASS_TOOL_PROFICIENCIES[c.cls]?.[index===0?'starting':'multiclass']||{};
    tools.push(...(spec.fixed||[]));
    const groups=classToolChoiceGroups(c,index),selected=(C.choices.classTools||{})[c.cls]||[];
    groups.forEach((group,i)=>tools.push(...selected.slice(i*group.count,(i+1)*group.count).filter(value=>group.options.includes(value))));
  });
  if(deftExplorerActive()&&TOOL_PROFICIENCIES.includes(C.choices.deftExplorerTool)&&C.choices.deftExplorerMode==='language_tool')tools.push(C.choices.deftExplorerTool);
  return [...new Set(tools)];
}
function skillMod(sk){
  const [id,,ab]=SKILLS.find(s=>s[0]===sk);
  let m=am(ab);
  if(profSkills().includes(id))m+=pb()*(expertiseSkills().includes(id)?2:1);
  const proficient=profSkills().includes(id),jack=C.classes.some(c=>c.cls==='bard'&&c.lvl>=2),athlete=C.classes.some(c=>c.cls==='fighter'&&c.sub==='champion'&&c.lvl>=7);
  if(!proficient&&athlete&&['str','dex','con'].includes(ab))m+=Math.ceil(pb()/2);
  else if(!proficient&&jack)m+=Math.floor(pb()/2);
  return m;
}
function saveMods(){
  const profs=new Set(CLASSES[C.classes[0].cls].saves),resilient=featBonusAbility('resilient');
  if(C.classes.some(c=>c.cls==='monk'&&c.lvl>=14))ABILS.forEach(([a])=>profs.add(a));
  if(C.classes.some(c=>c.cls==='rogue'&&c.lvl>=15))profs.add('wis');
  if(resilient)profs.add(resilient);
  const out={};
  ABILS.forEach(([a])=>{
    let m=am(a)+(profs.has(a)?pb():0);
    const p=C.classes.find(c=>c.cls==='paladin');
    if(p&&p.lvl>=6)m+=Math.max(1,am('cha'));
    out[a]={mod:m,prof:profs.has(a)};
  });
  return out;
}
function passivePerception(){return 10+skillMod('perception')+(hasFeat('observant')?5:0)}
function passiveInvestigation(){return 10+skillMod('investigation')+(hasFeat('observant')?5:0)}
function initiative(){
  let bonus=am('dex');
  const jack=C.classes.some(c=>c.cls==='bard'&&c.lvl>=2),athlete=C.classes.some(c=>c.cls==='fighter'&&c.sub==='champion'&&c.lvl>=7);
  if(jack||athlete)bonus+=athlete?Math.ceil(pb()/2):Math.floor(pb()/2);
  if(hasFeat('alert'))bonus+=5;
  return bonus;
}
function rovingActive(){
  return C.classes.some(c=>c.cls==='ranger'&&c.lvl>=6&&selectedTashaFeatures(c).some(f=>f[0]==='deft_explorer'));
}
function speed(){
  const s=subraceOf(),armor=equippedArmor(),armorData=armor&&ARMORS.find(a=>a[0]===armor.id),heavy=armorData?.[8]==='heavy';
  const monk=C.classes.find(c=>c.cls==='monk'),barbarian=C.classes.find(c=>c.cls==='barbarian');
  return calculateMovementSpeed({
    base:(s&&s.speed)||raceOf().speed||30,
    monkBonus:monk&&monk.lvl>=2&&!armor&&!hasShield()?10+Math.floor((monk.lvl-2)/4)*5:0,
    barbarianBonus:barbarian&&barbarian.lvl>=5&&!heavy?10:0,
    rovingBonus:rovingActive()?5:0,
    mobileBonus:hasFeat('mobile')?10:0,
    heavyArmorPenalty:heavy&&armorData[5]&&abil('str')<armorData[5]?10:0,
  });
}
function speedText(){
  const walking=speed();
  return `${walking} фт${rovingActive()?` · лазание/плавание ${walking} фт`:''}`;
}

// хиты
function maxHp(){
  let bonus=0;
  if(C.race==='dwarf'&&C.subrace==='hill')bonus+=totalLvl();
  const draconic=C.classes.find(c=>c.cls==='sorcerer'&&c.sub==='draconic');
  if(draconic)bonus+=draconic.lvl;
  if(hasFeat('tough'))bonus+=2*totalLvl();
  return calculateMaxHp(C.classes.map(c=>({level:c.lvl,hitDie:CLASSES[c.cls].hd})),am('con'),bonus);
}
function hitDiceUsedByClass(){
  const g=C.game||{},used={};
  C.classes.forEach(c=>used[c.cls]=Math.min(c.lvl,Math.max(0,Math.floor(g.hdUsedByClass?.[c.cls]||0))));
  let remaining=Math.max(0,Math.floor(g.hdUsed||0)-Object.values(used).reduce((sum,n)=>sum+n,0));
  for(const c of C.classes){const add=Math.min(c.lvl-used[c.cls],remaining);used[c.cls]+=add;remaining-=add}
  return used;
}
function syncHitDice(){
  const used=hitDiceUsedByClass();C.game.hdUsedByClass=used;C.game.hdUsed=Object.values(used).reduce((sum,n)=>sum+n,0);return used;
}
function hitDiceStr(){const m={};C.classes.forEach(c=>{const d='к'+CLASSES[c.cls].hd;m[d]=(m[d]||0)+c.lvl});return Object.entries(m).map(([d,n])=>n+d).join(' + ')}

// ячейки заклинаний (мультикласс по правилам 2014)
function casterContribution(){
  let full=0,half=0,third=0;
  C.classes.forEach(c=>{
    const t=spellTypeOf(c);
    if(t==='full')full+=c.lvl;
    else if(t==='half')half+=Math.floor(c.lvl/2);
    else if(t==='third')third+=Math.floor(c.lvl/3);
  });
  return {full,half,third};
}
function spellSlots(){
  const {full,half,third}=casterContribution();
  const eff=full+half+third;
  if(!eff)return null;
  const casters=C.classes.filter(c=>['full','half','third'].includes(spellTypeOf(c)));
  if(casters.length===1){
    // один заклинательный класс — его таблица
    const c=casters[0];
    return TABLES[c.cls].slots[c.lvl-1].slice();
  }
  // мультикласс: таблица полного заклинателя по эффективному уровню
  const lvl=Math.min(20,eff);
  return TABLES.wizard.slots[lvl-1].slice();
}
function pactSlots(){
  const w=C.classes.find(c=>c.cls==='warlock');
  if(!w)return null;
  const t=TABLES.warlock;
  return {count:t.pactSlots[w.lvl-1],level:t.pactLevel[w.lvl-1]};
}
function spellAbilityOf(cls){if(cls==='fighter'||cls==='rogue')return 'int';return CLASSES[cls].spellAbility}
function spellSaveDcForAbility(ability){return 8+pb()+am(ability)}
function spellAttackForAbility(ability){return pb()+am(ability)}
function spellSaveDc(cls){return spellSaveDcForAbility(spellAbilityOf(cls))}
function spellAttack(cls){return spellAttackForAbility(spellAbilityOf(cls))}
function knownSpellSelection(ids){return [...new Set((Array.isArray(ids)?ids:[]).filter(id=>SPELL_IDS.has(id)))]}
function knownLimit(cls){
  const c=C.classes.find(x=>x.cls===cls);if(!c)return 0;
  return classKnownLimit(c);
}
function cantripLimit(cls){
  const c=C.classes.find(x=>x.cls===cls);if(!c)return 0;
  if(spellTypeOf(c)==='third')return (cls==='fighter'?[0,0,2,2,2,2,2,2,2,3,3,3,3,3,3,3,3,3,3,3]:[0,0,3,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4])[c.lvl-1];
  const t=TABLES[cls];
  return (t.cantrips||[])[c.lvl-1]||0;
}
function prepLimit(cls){
  const c=C.classes.find(x=>x.cls===cls);if(!c)return 0;
  if(cls==='cleric'||cls==='druid'||cls==='wizard')return Math.max(1,c.lvl+am(spellAbilityOf(cls)));
  if(cls==='paladin')return Math.max(1,Math.floor(c.lvl/2)+am(spellAbilityOf(cls)));
  return 0;
}
function spellTypeOf(c){
  if((c.cls==='fighter'&&c.sub==='eldritchknight')||(c.cls==='rogue'&&c.sub==='arcanetrickster'))return 'third';
  return CLASSES[c.cls].spell;
}
function classMaxSpellLevel(c){
  const type=spellTypeOf(c);
  if(type==='pact')return TABLES.warlock.pactLevel[c.lvl-1]||0;
  if(!type)return 0;
  const slots=TABLES[c.cls].slots?.[c.lvl-1]||[];
  let level=0;slots.forEach((count,index)=>{if(count>0)level=index+1});return level;
}
function classKnownLimit(c){
  if(spellTypeOf(c)==='third')return [0,0,3,4,4,4,5,6,6,7,8,8,9,10,10,11,11,11,12,13][c.lvl-1]||0;
  return (TABLES[c.cls].known||[])[c.lvl-1]||0;
}
function thirdCasterSpellSelectionsValid(c,ids){
  if(spellTypeOf(c)!=='third')return true;
  const schools=c.cls==='fighter'?['ограждение','воплощение']:['очарование','иллюзия'];
  const unrestricted=1+(c.lvl>=8)+(c.lvl>=14)+(c.lvl>=20);
  return ids.filter(id=>{const spell=SPELLS.find(s=>s.id===id);return spell?.lvl>0&&!schools.includes(spell.school)}).length<=unrestricted;
}
function classCantripLimit(c){return cantripLimit(c.cls)}
function spellClassAllowed(c,id){
  const spell=SPELLS.find(s=>s.id===id);if(!spell)return false;
  const listClass=c.cls==='fighter'||c.cls==='rogue'?'wizard':c.cls;
  if(spell.cls.includes(listClass))return true;
  const expanded=SUBCLASSES[c.sub]?.expSpells||{};
  return Object.entries(expanded).some(([level,ids])=>+level<=classMaxSpellLevel(c)&&ids.includes(id));
}
const MYSTIC_ARCANUM_LEVELS=[[11,6],[13,7],[15,8],[17,9]];
function arcanumLevels(level){return MYSTIC_ARCANUM_LEVELS.filter(([required])=>level>=required).map(([,spellLevel])=>spellLevel)}
function invocationPrerequisiteError(id,warlock=C.classes.find(c=>c.cls==='warlock')){
  if(!INVOCATIONS.some(([option])=>option===id))return 'Недоступное мистическое воззвание.';
  const requirement=INVOCATION_PREREQUISITES[id]||{},level=Math.max(2,requirement.level||0);
  if(!warlock||warlock.lvl<level)return `Требуется колдун ${level} уровня.`;
  if(requirement.pact&&C.choices.pactBoon!==requirement.pact)return `Требуется Договор «${{blade:'Клинка',chain:'Цепи',tome:'Гримуара'}[requirement.pact]}».`;
  return '';
}
function spellcasterClasses(){return C.classes.filter(c=>spellTypeOf(c))}
function spellsForClass(cls,lvl){
  const listClass=cls==='fighter'||cls==='rogue'?'wizard':cls,base=SPELLS.filter(s=>s.lvl===lvl&&s.cls.includes(listClass));
  const caster=C.classes.find(c=>c.cls===cls),expanded=(SUBCLASSES[caster?.sub]?.expSpells||{})[lvl]||[];
  return [...new Set([...base.map(s=>s.id),...expanded])].map(id=>SPELLS.find(s=>s.id===id)).filter(Boolean);
}

// КД
function activeFightingStyleKeys(){
  const keys=C.classes.filter(c=>FIGHTING_STYLES[c.cls]&&c.lvl>=(c.cls==='fighter'?1:2)).map(c=>c.cls);
  if(C.classes.some(c=>c.cls==='fighter'&&c.sub==='champion'&&c.lvl>=10))keys.push('championExtra');
  return keys;
}
function hasFightingStyle(id){return activeFightingStyleKeys().some(key=>(C.choices.fightingStyles||{})[key]===id)}
function equippedArmor(){return C.inventory.find(i=>i.type==='armor'&&i.equipped)}
function hasShield(){return C.inventory.some(i=>i.type==='shield'&&i.equipped)}
function dualWielding(){const weapons=C.inventory.filter(i=>i.type==='weapon'&&i.wielded).map(i=>WEAPONS.find(w=>w[0]===i.id));return weapons.length===2&&weapons.every(w=>w?.[6]==='melee')}
function armorClass(){
  const arm=equippedArmor();
  let ac;
  const monk=C.classes.find(c=>c.cls==='monk'), barb=C.classes.find(c=>c.cls==='barbarian'), sorc=C.classes.find(c=>c.cls==='sorcerer'&&c.sub==='draconic');
  if(arm){
    const A=ARMORS.find(a=>a[0]===arm.id);
    if(A){
      const [, , ,base,dexRule]=[A[0],A[1],A[2],A[3],A[4]];
      let dexBonus=am('dex');
      if(dexRule==='max2')dexBonus=Math.min(2,dexBonus);
      if(dexRule===false)dexBonus=0;
      ac=base+dexBonus;
    }else ac=10+am('dex');
  }else{
    ac=10+am('dex');
    if(monk&&!hasShield())ac=Math.max(ac,10+am('dex')+am('wis'));
    if(barb)ac=Math.max(ac,10+am('dex')+am('con'));
    if(sorc)ac=Math.max(ac,13+am('dex'));
    if(C.race==='autognome')ac=Math.max(ac,13+am('dex'));
  }
  if(hasShield())ac+=2;
  // стиль Защита
  if(hasFightingStyle('defense')&&arm)ac+=1;
  if(hasFeat('dual_wielder')&&dualWielding())ac+=1;
  return ac;
}
function weaponProfileProficient(profile,w){return !!profile&&(profile[w[7]]===true||profile.extra?.includes(w[0]))}
function weaponProf(weaponId){
  const w=WEAPONS.find(x=>x[0]===weaponId);if(!w)return false;
  return raceWeaponProfile().includes(weaponId)||C.classes.some((c,i)=>weaponProfileProficient(classWeaponProfile(c,i),w)||weaponProfileProficient(SUBCLASSES[c.sub]?.weaponProficiencies,w));
}
function isMonkWeapon(w){return w[0]==='shortsword'||(w[7]==='simple'&&w[6]==='melee'&&!w[5].includes('Двуручное')&&!w[5].includes('Тяжёлое'))}
function monkMartialArtsActive(){
  const monk=C.classes.find(c=>c.cls==='monk');
  return !!monk&&!equippedArmor()&&!hasShield()&&C.inventory.filter(i=>i.type==='weapon'&&i.wielded).every(i=>{const weapon=WEAPONS.find(w=>w[0]===i.id);return weapon&&isMonkWeapon(weapon)});
}
function weaponAttack(w){
  const finesse=w[5].includes('Фехтовальное');
  const ranged=w[6]==='ranged';
  let ab=ranged?am('dex'):(finesse?Math.max(am('str'),am('dex')):am('str'));
  if(monkMartialArtsActive()&&isMonkWeapon(w))ab=Math.max(ab,am('dex'));
  let bonus=ab+(weaponProf(w[0])?pb():0);
  if(ranged&&hasFightingStyle('archery'))bonus+=2;
  return bonus;
}
function wieldedWeaponCount(){return C.inventory.filter(i=>i.type==='weapon'&&i.wielded).length}
function weaponDamage(w,item=null){
  const finesse=w[5].includes('Фехтовальное');
  const ranged=w[6]==='ranged';
  let ab=ranged?am('dex'):(finesse?Math.max(am('str'),am('dex')):am('str'));
  const martialArts=monkMartialArtsActive()&&isMonkWeapon(w);
  if(martialArts)ab=Math.max(ab,am('dex'));
  let bonus=ab;
  const versatile=w[5].match(/Универсальное \(([^)]+)\)/i);
  let dice=item?.grip==='two-handed'&&versatile?`${versatile[1]} ${w[3].replace(/^\S+\s*/, '')}`:w[3];
  if(martialArts){
    const die=TABLES.monk.ma[C.classes.find(c=>c.cls==='monk').lvl-1],currentDie=dice.split(' ')[0];
    if(Number(die.split('к')[1])>Number(currentDie.split('к')[1]))dice=die+dice.slice(currentDie.length);
  }
  if(w[6]==='melee'&&C.classes.some(c=>c.cls==='paladin'&&c.lvl>=11))dice+=' + 1к8 излучением';
  const dueling=hasFightingStyle('dueling')&&item?.wielded&&w[6]==='melee'&&!w[5].includes('Двуручное')&&wieldedWeaponCount()===1;
  if(dueling&&!(item.grip==='two-handed'&&versatile))bonus+=2;
  const damage=bonus!==0?dice+' '+fmtMod(bonus):dice;
  if(!hasFightingStyle('thrown')||!w[5].includes('Метательное')||w[3]==='—')return damage;
  return `${damage} (при броске: ${w[3]} ${fmtMod(ab+2+(dueling?2:0))})`;
}

// ресурсы классов для игрового режима
function classResources(){
  const out=[];
  C.classes.forEach(c=>{
    const L=c.lvl, cls=c.cls;
    if(cls==='barbarian')out.push({id:'rage',name:'Ярость',max:TABLES.barbarian.rages[L-1]});
    if(cls==='bard')out.push({id:'insp',name:'Вдохновение барда',max:Math.max(1,am('cha'))});
    if(cls==='cleric')out.push({id:'channel',name:'Божественный канал',max:L>=18?3:L>=6?2:1});
    if(cls==='druid')out.push({id:'wildshape',name:'Дикая форма',max:2});
    if(cls==='fighter'){out.push({id:'secondwind',name:'Второе дыхание',max:1});out.push({id:'surge',name:'Всплеск действий',max:L>=17?2:1});if(L>=9)out.push({id:'indom',name:'Несгибаемость',max:L>=17?3:L>=13?2:1});}
    if(cls==='monk')out.push({id:'ki',name:'Ци',max:TABLES.monk.ki[L-1]});
    if(cls==='paladin'){if(L>=3&&c.sub)out.push({id:'paladinChannel',name:'Божественный канал',max:1});out.push({id:'layhands',name:'Наложение рук',max:5*L})}
    if(cls==='sorcerer')out.push({id:'sorc',name:'Единицы чародейства',max:TABLES.sorcerer.sorcPoints[L-1]});
    if(cls==='rogue'&&L>=20)out.push({id:'luck',name:'Удар удачи',max:1});
    if(cls==='warlock'){const p=pactSlots();if(p)out.push({id:'pact',name:'Ячейки договора ('+p.level+' круг)',max:p.count});}
    if(cls==='wizard')out.push({id:'arcrec',name:'Магическое восстановление',max:1});
  });
  return out;
}
function selectedTashaFeatures(c){
  const ids=(C.choices.tashaFeatures||{})[c.cls]||[];
  return (TASHA_FEATURES[c.cls]||[]).filter(f=>ids.includes(f[0])&&f[1]<=c.lvl);
}
function primalAwarenessSpells(){
  const ranger=C.classes.find(c=>c.cls==='ranger');
  if(!ranger||!(C.choices.tashaFeatures?.ranger||[]).includes('primal_awareness'))return [];
  return PRIMAL_AWARENESS_SPELLS.filter(([level])=>ranger.lvl>=level).map(([level,id,spellLevel])=>{const spell=SPELLS.find(s=>s.id===id);return {level,id,name:spell.ru,spellLevel,spell}});
}
function chosenTashaFeatures(){const features=C.classes.flatMap(c=>selectedTashaFeatures(c).map(f=>({cls:c.cls,lvl:f[1],name:f[2]+' (Таша)',desc:f[3]})));if(C.choices.pactBoon==='talisman')features.push({cls:'warlock',lvl:3,name:'Талисман договора (Таша)',desc:'Носитель может добавить к4 к проверке характеристики; число применений = БМ за долгий отдых.'});return features}
function tashaFeaturePicker(c){
  const options=TASHA_FEATURES[c.cls]||[];if(!options.length)return '';
  const selected=(C.choices.tashaFeatures||{})[c.cls]||[];
  const activeDeft=c.cls==='ranger'&&selected.includes('deft_explorer'),mode=C.choices.deftExplorerMode||'',knownTools=toolProficiencies();
  const deftExplorer=activeDeft?`<div class="card"><label>Навык для компетентности<select onchange="setDeftExplorerSkill(this.value)"><option value="">— выберите владение —</option>${profSkills().map(id=>`<option value="${id}"${C.choices.deftExplorerSkill===id?' selected':''}>${SKILLS.find(s=>s[0]===id)?.[1]||id}</option>`).join('')}</select></label><label>Дополнительные владения<select onchange="setDeftExplorerMode(this.value)"><option value="">— выберите вариант —</option><option value="two_languages"${mode==='two_languages'?' selected':''}>Два языка</option><option value="language_tool"${mode==='language_tool'?' selected':''}>Один язык и один инструмент</option></select></label>${mode==='language_tool'?`<label>Инструмент<select onchange="setDeftExplorerTool(this.value)"><option value="">— выберите —</option>${TOOL_PROFICIENCIES.filter(t=>!knownTools.includes(t)||t===C.choices.deftExplorerTool).map(t=>`<option${C.choices.deftExplorerTool===t?' selected':''}>${t}</option>`).join('')}</select></label>`:''}${mode==='two_languages'?'<p class="muted small">Языки выберите на вкладке «Основное».</p>':mode==='language_tool'?'<p class="muted small">Язык выберите на вкладке «Основное».</p>':''}</div>`:'';
  return `<details data-tasha-features="${c.cls}"><summary>Умения из «Котла Таши» · выбрано ${selectedTashaFeatures(c).length}</summary>${deftExplorer}<div class="col-list">${options.map(([id,lvl,name,desc])=>`<label class="chk wide"><input type="checkbox" ${selected.includes(id)?'checked':''}${lvl>c.lvl?' disabled':''} onchange="toggleTashaFeature('${c.cls}','${id}',this.checked)"><span><b>${name}</b> (${lvl} ур.) <span class="tag">Таша</span><br><span class="muted small">${desc}</span></span></label>`).join('')}</div><p class="muted small">Выбор сохраняется; компетентность «Искусного исследователя» применяется автоматически, остальные эффекты не пересчитываются.</p></details>`;
}
// классовые умения, доступные на уровне
function availableFeats(){
  const out=[];
  C.classes.forEach(c=>{
    const cl=CLASSES[c.cls],replaced=selectedTashaFeatures(c).flatMap(f=>f[4]||[]);
    cl.feats.forEach(([l,n,d])=>{if(l<=c.lvl&&!replaced.includes(n))out.push({cls:c.cls,lvl:l,name:n,desc:d})});
    const sub=SUBCLASSES[c.sub];
    if(sub)sub.feats.forEach(([l,n,d])=>{if(l<=c.lvl)out.push({cls:c.cls,lvl:l,name:n,desc:d,sub:sub.name})});
  });
  return out.sort((a,b)=>a.lvl-b.lvl);
}
function asiLevelsFor(cls){return CLASSES[cls].asiLvls}
function asiPending(){
  // сколько ASI доступно vs выбрано
  let need=0;
  C.classes.forEach(c=>{need+=CLASSES[c.cls].asiLvls.filter(l=>l<=c.lvl).length});
  const have=Object.keys(C.asi||{}).length;
  return {need,have};
}
function characterReadiness(){
  const issues=[],add=(tab,text,recommended=false)=>issues.push({tab,text,recommended}),r=raceOf(),sub=subraceOf();
  if(totalLvl()>20)add('main','Общий уровень персонажа не может превышать 20.');
  if(!validMulticlassCharacter(C))add('main','Исправьте требования к характеристикам для мультиклассирования.');
  if(!validAbilityBases(C))add('abil','Исправьте значения характеристик: соблюдайте правила выбранного метода (покупка очками — максимум 27).');
  if(!validRacialAbilityChoices(C))add('abil','Исправьте недопустимые или повторяющиеся расовые бонусы характеристик.');
  if(!validSkillChoices(C))add('skills','Исправьте недопустимые или повторяющиеся выборы навыков и компетентностей.');
  if(r.subs&&!C.subrace)add('main','Выберите подрасу.');
  if(r.asiChoice&&(C.halfElfPicks||[]).filter(Boolean).length<r.asiChoice.count)add('abil',`Выберите ещё ${r.asiChoice.count-(C.halfElfPicks||[]).filter(Boolean).length} бонуса характеристики от расы.`);
  if(r.flexibleAsi){const count=C.raceAsiMode==='three'?3:2,picks=(C.raceAsiPicks||[]).filter(Boolean);if(new Set(picks).size<count)add('abil',`Распределите расовые бонусы характеристик: выберите ${count} разные характеристики.`)}
  if(r.skillChoice&&(C.raceSkills||[]).length<r.skillChoice)add('skills',`Выберите ещё ${r.skillChoice-(C.raceSkills||[]).length} расовых навыка.`);
  const langs=C.extraLangs||[],langCount=languageChoiceCount(),chosenLangs=langs.slice(0,langCount).filter(Boolean);
  if(chosenLangs.length<langCount)add('main',`Выберите ещё ${langCount-chosenLangs.length} язык(а).`);
  if(new Set(chosenLangs).size<chosenLangs.length)add('main','Уберите повторяющиеся языки.');
  const bgToolGroups=backgroundToolChoiceGroups().choices,bgToolPicks=C.choices.backgroundTools||[];
  if(bgToolPicks.length<bgToolGroups.length||bgToolGroups.some((group,index)=>!group.options.includes(bgToolPicks[index])))add('main','Выберите инструменты, предоставляемые предысторией.');
  const wornArmor=equippedArmor();if(wornArmor&&!armorProficient(wornArmor.id))add('equip',`Нет владения доспехом «${itemName(wornArmor)}»: помеха к проверкам и спасброскам Силы/Ловкости, атакам с этими характеристиками и нельзя накладывать заклинания.`);
  if(hasShield()&&!armorProficient('shield'))add('equip','Нет владения щитами: помеха к проверкам и спасброскам Силы/Ловкости, атакам с этими характеристиками и нельзя накладывать заклинания.');
  for(const choice of racialCantripChoices())if(!choice.spells.some(s=>s.id===(C.racialSpells||{})[choice.key]))add('spells',`Выберите расовый заговор: ${choice.name}.`);
  const storedSpellIds=[...Object.values(C.cantrips||{}).flat(),...Object.values(C.spellsKnown||{}).flat(),...Object.values(C.spellsPrepared||{}).flat(),...(C.spellbook||[]),...Object.values(C.arcanum||{}),...Object.entries(C.racialSpells||{}).filter(([key])=>!key.endsWith('Ability')).map(([,id])=>id)];
  const unknownSpellCount=storedSpellIds.filter(id=>!SPELL_IDS.has(id)).length;
  if(unknownSpellCount)add('spells',`Удалите неизвестные заклинания (${unknownSpellCount}).`);
  for(const [classIndex,c] of C.classes.entries()){
    const cl=CLASSES[c.cls],picks=(C.classSkills||{})[c.cls]||[],skillCount=classSkillChoiceCount(classIndex,c.cls);
    const otherPicks=C.classes.filter((_,i)=>i!==classIndex).flatMap(x=>(C.classSkills||{})[x.cls]||[]);
    const validPicks=new Set(picks.filter(id=>cl.skillList.includes(id)&&!bgSkills().includes(id)&&!raceSkills().includes(id)&&!otherPicks.includes(id)));
    if(picks.length!==skillCount||validPicks.size!==skillCount){
      const message=picks.length>skillCount?`уберите лишние навыки (выбрано ${picks.length}, максимум ${skillCount})`:picks.length<skillCount?`выберите ещё ${skillCount-picks.length} навыка`:'уберите повторяющиеся или недопустимые навыки';
      add('skills',`${cl.name}: ${message}.`);
    }
    const toolGroups=classToolChoiceGroups(c,classIndex),toolPicks=(C.choices.classTools||{})[c.cls]||[],toolCount=toolGroups.reduce((n,g)=>n+g.count,0);
    let toolOffset=0,validToolPicks=true;for(const group of toolGroups){const picksInGroup=toolPicks.slice(toolOffset,toolOffset+group.count);if(picksInGroup.length!==group.count||picksInGroup.some(tool=>!group.options.includes(tool)))validToolPicks=false;toolOffset+=group.count}
    if(toolPicks.length!==toolCount||!validToolPicks)add('main',`${cl.name}: выберите инструменты (${toolPicks.length}/${toolCount}).`);
    if(cl.sub&&c.lvl>=cl.subLvl&&!c.sub)add('main',`Выберите подкласс для класса «${cl.name}».`);
    const subcl=SUBCLASSES[c.sub];
    if(subcl?.choices)for(const [lvl,block] of Object.entries(subcl.choices))if(c.lvl>=+lvl&&!C.choices[`hunter_${lvl}`])add('cls',`Выберите умение «${block.name}» (${lvl} ур.).`);
    if(c.cls==='ranger'&&c.lvl>=1){const variants=(C.choices.tashaFeatures||{}).ranger||[];if(!C.choices.favoredEnemy&&!variants.includes('favored_foe'))add('cls','Выберите «Избранного врага» или вариант из «Котла Таши».');if(!C.choices.favoredTerrain&&!variants.includes('deft_explorer'))add('cls','Выберите «Избранную местность» или вариант «Искусный исследователь» из «Котла Таши».');if(variants.includes('deft_explorer')){if(!deftExplorerSkill())add('cls','Выберите навык для компетентности «Искусного исследователя».');if(!['two_languages','language_tool'].includes(C.choices.deftExplorerMode))add('cls','Выберите дополнительные владения «Искусного исследователя».');if(C.choices.deftExplorerMode==='language_tool'&&!TOOL_PROFICIENCIES.includes(C.choices.deftExplorerTool))add('cls','Выберите инструмент для «Искусного исследователя».')}}
    if(c.cls==='druid'&&c.sub==='land'&&c.lvl>=2&&!C.choices.druidLand)add('cls','Выберите местность для круга друида.');
    if(c.cls==='sorcerer'&&c.sub==='draconic'&&!C.choices.draconicType)add('cls','Выберите тип дракона-прародителя.');
    if(c.cls==='warlock'){
      if(c.lvl>=3&&!C.choices.pactBoon)add('cls','Выберите договорный дар колдуна.');
      const invocations=C.choices.invocations||[],invMax=TABLES.warlock.invocations[c.lvl-1]||0,invalidInvocations=invocations.filter(id=>invocationPrerequisiteError(id));
      if(invalidInvocations.length)add('cls','Замените мистические откровения, требования которых не выполнены.');
      if(invocations.length>invMax)add('cls',`Удалите лишние мистические откровения: ${invocations.length}/${invMax}.`);
      else if(invocations.length<invMax)add('cls',`Выберите мистические откровения: ${invocations.length}/${invMax}.`);
      for(const arcLvl of arcanumLevels(c.lvl))if(!C.arcanum[arcLvl])add('cls',`Выберите мистический арканум ${arcLvl}-го круга.`);
    }
    if(c.cls==='sorcerer'&&c.lvl>=3){const max=c.lvl>=17?4:c.lvl>=10?3:2;if((C.choices.metamagic||[]).length<max)add('cls',`Выберите приёмы Метамагии: ${(C.choices.metamagic||[]).length}/${max}.`)}
    const cantrips=cantripLimit(c.cls),selectedCantrips=knownSpellSelection((C.cantrips||{})[c.cls]);if(cantrips>selectedCantrips.length)add('spells',`${cl.name}: выберите заговоры (${selectedCantrips.length}/${cantrips}).`);if(selectedCantrips.length>cantrips)add('spells',`${cl.name}: удалите лишние заговоры (${selectedCantrips.length}/${cantrips}).`);if(selectedCantrips.some(id=>{const s=SPELLS.find(x=>x.id===id);return !spellClassAllowed(c,id)||s?.lvl!==0}))add('spells',`${cl.name}: есть заговоры не из доступного списка.`);if(c.cls==='rogue'&&c.sub==='arcanetrickster'&&c.lvl>=3&&!selectedCantrips.includes('mage_hand'))add('spells','Мистический ловкач: выберите обязательный заговор «Волшебная рука».');
    const known=knownLimit(c.cls),knownSelected=knownSpellSelection((C.spellsKnown||{})[c.cls]);if(known>knownSelected.length)add('spells',`${cl.name}: выберите известные заклинания (${knownSelected.length}/${known}).`);if(knownSelected.length>known)add('spells',`${cl.name}: удалите лишние известные заклинания (${knownSelected.length}/${known}).`);if(knownSelected.some(id=>{const s=SPELLS.find(x=>x.id===id);return !spellClassAllowed(c,id)||s?.lvl<1||s?.lvl>classMaxSpellLevel(c)})||!thirdCasterSpellSelectionsValid(c,knownSelected))add('spells',`${cl.name}: есть заклинания не из доступного списка, круга или разрешённой школы.`);
    const prepared=knownSpellSelection((C.spellsPrepared||{})[c.cls]),preparedLimit=prepLimit(c.cls);if(prepared.length>preparedLimit)add('spells',`${cl.name}: подготовлено слишком много заклинаний (${prepared.length}/${preparedLimit}).`);if(prepared.some(id=>{const s=SPELLS.find(x=>x.id===id);return !spellClassAllowed(c,id)||s?.lvl<1||s?.lvl>classMaxSpellLevel(c)||(c.cls==='wizard'&&!(C.spellbook||[]).includes(id))}))add('spells',`${cl.name}: есть неподходящие подготовленные заклинания.`);
    if(c.cls==='wizard'){const min=6+(c.lvl-1)*2;if(knownSpellSelection(C.spellbook).length<min)add('spells',`Книга волшебника: рекомендуется не менее ${min} заклинаний.`,true);if((C.spellbook||[]).some(id=>{const s=SPELLS.find(x=>x.id===id);return !s||s.lvl<1||s.lvl>classMaxSpellLevel(c)||!spellClassAllowed(c,id)}))add('spells','В книге есть заклинания не из списка волшебника или недоступного круга.');}
  }
  const expertiseMax=expertiseAvailable(),deftSkill=deftExplorerSkill(),manualExpertise=(C.expertise||[]).filter(id=>!deftSkill||id!==deftSkill).length,manualExpertiseMax=expertiseMax-(deftExplorerActive()?1:0);
  if(manualExpertise<manualExpertiseMax)add('skills',`Выберите ещё ${manualExpertiseMax-manualExpertise} компетентности.`);
  const styleChoices=C.choices.fightingStyles||{};
  for(const key of activeFightingStyleKeys())if(!styleChoices[key])add('cls',key==='championExtra'?'Выберите второй боевой стиль (Чемпион 10).':`Выберите боевой стиль для класса «${CLASSES[key].name}».`);
  const {need,have}=asiPending();
  if(have>need)add('abil','Удалите ASI/черты, которые больше не доступны на текущих уровнях классов.');
  for(let i=0;i<need;i++){
    const a=(C.asi||{})['asi'+i];let complete=false;
    if(Array.isArray(a))complete=a.length===2;
    else if(a?.type==='asi')complete=(a.vals||[]).length===2;
    else if(a?.type==='feat'&&a.id){const feat=FEATS.find(f=>f[0]===a.id);complete=!!feat&&(!feat[3]||!!a.bonus)}
    if(!complete)add('abil',`Заполните увеличение характеристики или черту #${i+1}.`);
  }
  return issues;
}
function renderReadiness(){
  const issues=characterReadiness(),required=issues.filter(i=>!i.recommended),recommended=issues.filter(i=>i.recommended);
  const rows=[...required,...recommended].map(i=>`<li>${i.recommended?'Рекомендуется: ':''}<button class="btn ghost sm" onclick="setTab('${i.tab}')">${esc(i.text)}</button></li>`).join('');
  return `<div class="card"><h3>Проверка заполнения</h3>${issues.length?`<p class="warn">Незавершённых выборов: ${required.length}${recommended.length?` · рекомендаций: ${recommended.length}`:''}</p><ul>${rows}</ul><p class="muted small">Это подсказки: они не блокируют сохранение и печать.</p>`:'<p class="ok-t">Обязательные выборы заполнены.</p>'}</div>`;
}
