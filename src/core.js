const CHARACTER_SCHEMA=2;
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
    game:{hpCur:null,hpTemp:0,hdUsed:0,slotsUsed:{},pactUsed:0,resources:{},dsOk:0,dsFail:0,conditions:'',notes:'',insp:false,exh:0},
    personality:{traits:'',ideals:'',bonds:'',flaws:''}, allies:'', backstory:'', treasure:'', featuresNotes:'',
    created:Date.now(), updated:Date.now()
  };
}

let LIB=[], C=null, TAB='home', THEME=localStorage.getItem(LS_THEME)||'dark', SHEET_VERSION=localStorage.getItem(LS_SHEET)==='2024'?'2024':'2014', STORAGE_WARNING_SHOWN=false;

function loadLib(){
  try{LIB=JSON.parse(localStorage.getItem(LS_KEY)||'[]')}catch(e){LIB=[]}
  if(!Array.isArray(LIB))LIB=[];
}
function warnStorage(){
  if(STORAGE_WARNING_SHOWN)return;
  STORAGE_WARNING_SHOWN=true;
  alert('Не удалось сохранить данные персонажей в браузере. Скачайте резервную копию и проверьте свободное место в хранилище.');
}
function saveLib(){
  try{localStorage.setItem(LS_KEY,JSON.stringify(LIB));STORAGE_WARNING_SHOWN=false;return true}
  catch(e){console.error('Не удалось сохранить библиотеку персонажей',e);warnStorage();return false}
}
function persist(){
  if(!C)return;
  C.updated=Date.now();
  const i=LIB.findIndex(c=>c.id===C.id);
  const snap=JSON.parse(JSON.stringify(C));
  if(i>=0)LIB[i]=snap;else LIB.push(snap);
  if(!saveLib())return;
  try{localStorage.setItem(LS_CUR,C.id)}catch(e){console.error('Не удалось сохранить текущего персонажа',e);warnStorage()}
}
function openChar(id){
  const f=LIB.find(c=>c.id===id);
  if(!f)return;
  C=migrate(JSON.parse(JSON.stringify(f)));
  TAB='main';
  render();
}
function migrate(ch){
  const d=newChar();
  const m={...d,...ch};
  m.bases={...d.bases,...(ch.bases||{})};
  ['standard','point','manual'].forEach(k=>{
    m.bases[k]={...(k==='standard'?(()=>{const s={};ABILS.forEach(([a],i)=>s[a]=STD_SET[i]);return s})():k==='point'?(()=>{const s={};ABILS.forEach(([a])=>s[a]=8);return s})():(()=>{const s={};ABILS.forEach(([a])=>s[a]=10);return s})()), ...(ch.bases&&ch.bases[k]&&!Array.isArray(ch.bases[k])?ch.bases[k]:{})};
  });
  m.game={...d.game,...(ch.game||{})};
  m.personality={...d.personality,...(ch.personality||{})};
  m.choices={...d.choices,...(isRecord(ch.choices)?ch.choices:{})};
  m.race=RACES[m.race]?m.race:d.race;
  m.bg=BACKGROUNDS[m.bg]?m.bg:d.bg;
  if(!['standard','point','manual'].includes(m.abilityMethod))m.abilityMethod=d.abilityMethod;
  for(const key of ['asi','classSkills','cantrips','spellsKnown','spellsPrepared','arcanum','racialSpells','equipChoice'])m[key]={...d[key],...(isRecord(ch[key])?ch[key]:{})};
  for(const key of ['halfElfPicks','raceSkills','raceAsiPicks','expertise','languages','extraLangs','spellbook','inventory','attunement'])m[key]=Array.isArray(ch[key])?ch[key]:d[key];
  if(!Array.isArray(m.classes)||!m.classes.length)m.classes=[{cls:'fighter',lvl:1,sub:'champion'}];
  if(typeof m.id!=='string'||!m.id)m.id=uid();
  m.schemaVersion=CHARACTER_SCHEMA;
  return m;
}

// ---------- производные ----------
const totalLvl=()=>C.classes.reduce((s,c)=>s+c.lvl,0);
const pb=()=>PB_BY_LVL[Math.min(20,totalLvl())-1];
function raceOf(){return RACES[C.race]||RACES.human}
function subraceOf(){const r=raceOf();return r.subs&&C.subrace?r.subs[C.subrace]:null}
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
function abil(a){
  const base=(C.bases[C.abilityMethod]&&C.bases[C.abilityMethod][a]!=null)?C.bases[C.abilityMethod][a]:10;
  return Math.max(1,base+racialAsi()[a]+asiBonus()[a]);
}
const am=a=>mod(abil(a));
// владения навыками
function bgSkills(){return (BACKGROUNDS[C.bg]||{}).skills||[]}
function raceSkills(){
  const r=raceOf(),s=subraceOf(),out=[...(r.skillProf||[])];
  if(r.skillChoice)out.push(...(C.raceSkills||[]).slice(0,r.skillChoice));
  return out;
}
function classSkills(){let o=[];C.classes.forEach(c=>{o=o.concat(C.classSkills[c.cls]||[])});return [...new Set(o)]}
function profSkills(){return [...new Set([...bgSkills(),...raceSkills(),...classSkills()])]}
function deftExplorerActive(){return C.classes.some(c=>c.cls==='ranger'&&selectedTashaFeatures(c).some(f=>f[0]==='deft_explorer'))}
function deftExplorerSkill(){const skill=C.choices.deftExplorerSkill;return deftExplorerActive()&&profSkills().includes(skill)?skill:''}
function expertiseSkills(){const selected=[...(C.expertise||[])],tasha=deftExplorerSkill();if(tasha&&profSkills().includes(tasha))selected.push(tasha);return [...new Set(selected)]}
function toolProficiencies(){const tools=[...(BACKGROUNDS[C.bg]?.tools||[])];C.classes.forEach(c=>{const value=CLASSES[c.cls].tools;if(value&&value!=='—')tools.push(...value.split(', '))});if(deftExplorerActive()&&TOOL_PROFICIENCIES.includes(C.choices.deftExplorerTool)&&C.choices.deftExplorerMode==='language_tool')tools.push(C.choices.deftExplorerTool);return [...new Set(tools)]}
function skillMod(sk){
  const [id,,ab]=SKILLS.find(s=>s[0]===sk);
  let m=am(ab);
  if(profSkills().includes(id))m+=pb()*(expertiseSkills().includes(id)?2:1);
  // bard jack of all trades
  const bard=C.classes.find(c=>c.cls==='bard');
  if(bard&&bard.lvl>=2&&!profSkills().includes(id))m+=Math.floor(pb()/2);
  // champion remarkable athlete
  const f=C.classes.find(c=>c.cls==='fighter'&&c.sub==='champion'&&c.lvl>=7);
  if(f&&['str','dex','con'].includes(ab)&&!profSkills().includes(id))m+=Math.floor(pb()/2);
  return m;
}
function saveMods(){
  const clsProf=[...new Set(C.classes.map(c=>CLASSES[c.cls].saves).flat())];
  const out={};
  ABILS.forEach(([a])=>{
    let m=am(a)+(clsProf.includes(a)?pb():0);
    // паладин: аура защиты 6+
    const p=C.classes.find(c=>c.cls==='paladin');
    if(p&&p.lvl>=6)m+=Math.max(1,am('cha'));
    out[a]={mod:m,prof:clsProf.includes(a)};
  });
  return out;
}
function passivePerception(){return 10+skillMod('perception')}
function initiative(){return am('dex')}
function speed(){const s=subraceOf();return (s&&s.speed)||raceOf().speed||30}

// хиты
function maxHp(){
  let hp=0;
  C.classes.forEach((c,i)=>{
    const hd=CLASSES[c.cls].hd;
    // первый уровень первого класса — максимум куба
    if(i===0){hp+=hd+am('con');for(let l=1;l<c.lvl;l++)hp+=Math.floor(hd/2)+1+am('con')}
    else{for(let l=0;l<c.lvl;l++)hp+=Math.floor(hd/2)+1+am('con')}
  });
  const r=raceOf(),s=subraceOf();
  if(C.race==='dwarf'&&C.subrace==='hill')hp+=totalLvl(); // дварфская выносливость
  if(C.classes.find(c=>c.cls==='sorcerer'&&c.sub==='draconic'))hp+=C.classes.find(c=>c.cls==='sorcerer').lvl;
  return Math.max(1,hp);
}
function hitDiceStr(){const m={};C.classes.forEach(c=>{const d='к'+CLASSES[c.cls].hd;m[d]=(m[d]||0)+c.lvl});return Object.entries(m).map(([d,n])=>n+d).join(' + ')}

// ячейки заклинаний (мультикласс по правилам 2014)
function casterContribution(){
  let full=0,half=0,third=0;
  C.classes.forEach(c=>{
    const t=spellTypeOf(c);
    if(t==='full')full+=c.lvl;
    else if(t==='half')half+=c.lvl;
    else if(t==='third')third+=c.lvl;
  });
  return {full,half:Math.floor(half/2),third:Math.floor(third/3)};
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
function knownLimit(cls){
  const c=C.classes.find(x=>x.cls===cls);if(!c)return 0;
  const t=TABLES[cls];
  if(t.known&&t.known.length)return t.known[c.lvl-1];
  return 0;
}
function cantripLimit(cls){
  const c=C.classes.find(x=>x.cls===cls);if(!c)return 0;
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
function spellcasterClasses(){return C.classes.filter(c=>spellTypeOf(c))}
function spellsForClass(cls,lvl){const l=(cls==='fighter'||cls==='rogue')?'wizard':cls;return SPELLS.filter(s=>s.lvl===lvl&&s.cls.includes(l))}

// КД
function equippedArmor(){return C.inventory.find(i=>i.type==='armor'&&i.equipped)}
function hasShield(){return C.inventory.some(i=>i.type==='shield'&&i.equipped)}
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
    if(monk)ac=Math.max(ac,10+am('dex')+am('wis'));
    if(barb)ac=Math.max(ac,10+am('dex')+am('con')+(hasShield()?2:0));
    if(sorc)ac=Math.max(ac,13+am('dex'));
  }
  if(hasShield()&&!(C.classes.find(c=>c.cls==='barbarian')&&!arm))ac+=2;
  // стиль Защита
  if((C.choices.fightingStyle==='defense'||C.choices.fightingStyle2==='defense')&&arm)ac+=1;
  return ac;
}
function weaponProf(weaponId){
  const w=WEAPONS.find(x=>x[0]===weaponId);if(!w)return false;
  const cat=w[7];
  return C.classes.some(c=>{
    const cl=CLASSES[c.cls];
    if(cat==='simple')return true; // все классы SRD владеют простым
    // воинское: воин, паладин, следопыт, варвар
    return ['fighter','paladin','ranger','barbarian'].includes(c.cls);
  });
}
function weaponAttack(w){
  const finesse=w[5].includes('Фехтовальное');
  const ranged=w[6]==='ranged';
  let ab=ranged?am('dex'):(finesse?Math.max(am('str'),am('dex')):am('str'));
  // монах: монашеское оружие — Лов
  const monk=C.classes.find(c=>c.cls==='monk');
  if(monk&&w[7]==='simple'&&!w[5].includes('Двуручное')&&!w[5].includes('Тяжёлое'))ab=Math.max(ab,am('dex'));
  let bonus=ab+(weaponProf(w[0])?pb():0);
  if(ranged&&(C.choices.fightingStyle==='archery'||C.choices.fightingStyle2==='archery'))bonus+=2;
  return bonus;
}
function weaponDamage(w){
  const finesse=w[5].includes('Фехтовальное');
  const ranged=w[6]==='ranged';
  let ab=ranged?am('dex'):(finesse?Math.max(am('str'),am('dex')):am('str'));
  const monk=C.classes.find(c=>c.cls==='monk');
  if(monk&&w[7]==='simple'&&!w[5].includes('Двуручное')&&!w[5].includes('Тяжёлое'))ab=Math.max(ab,am('dex'));
  let bonus=ab,dice=w[3];
  if(C.choices.fightingStyle==='dueling'||C.choices.fightingStyle2==='dueling'){if(!w[5].includes('Двуручное')&&w[6]==='melee')bonus+=2}
  if(bonus!==0)return dice+' '+fmtMod(bonus);
  return dice;
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
    if(cls==='paladin')out.push({id:'layhands',name:'Наложение рук',max:5*L});
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
  return PRIMAL_AWARENESS_SPELLS.filter(([level])=>ranger.lvl>=level).map(([level,id,name,spellLevel])=>({level,id,name,spellLevel,spell:SPELLS.find(s=>s.id===id)||null}));
}
function chosenTashaFeatures(){const features=C.classes.flatMap(c=>selectedTashaFeatures(c).map(f=>({cls:c.cls,lvl:f[1],name:f[2]+' (Таша)',desc:f[3]})));if(C.choices.pactBoon==='talisman')features.push({cls:'warlock',lvl:3,name:'Талисман договора (Таша)',desc:'Носитель может добавить к4 к проверке характеристики; число применений = БМ за долгий отдых.'});return features}
function updateTashaChoice(cls,update){
  const selector=`[data-tasha-features="${cls}"]`,wasOpen=$(selector)?.open;
  update();persist();render();
  if(wasOpen){const details=$(selector);if(details)details.open=true}
}
function toggleTashaFeature(cls,id,on){
  C.choices.tashaFeatures=C.choices.tashaFeatures||{};
  updateTashaChoice(cls,()=>{
    const selected=new Set(C.choices.tashaFeatures[cls]||[]);
    if(on)selected.add(id);else selected.delete(id);
    C.choices.tashaFeatures[cls]=[...selected];
    if(cls==='ranger'&&id==='deft_explorer'){
      if(on)C.choices.deftExplorerMode='';
      else{delete C.choices.deftExplorerSkill;delete C.choices.deftExplorerMode;delete C.choices.deftExplorerTool;C.extraLangs=(C.extraLangs||[]).slice(0,baseLanguageChoiceCount())}
    }
  });
}
function tashaFeaturePicker(c){
  const options=TASHA_FEATURES[c.cls]||[];if(!options.length)return '';
  const selected=(C.choices.tashaFeatures||{})[c.cls]||[];
  const activeDeft=c.cls==='ranger'&&selected.includes('deft_explorer'),mode=C.choices.deftExplorerMode||'',knownTools=toolProficiencies();
  const deftExplorer=activeDeft?`<div class="card"><label>Навык для компетентности<select onchange="setDeftExplorerSkill(this.value)"><option value="">— выберите владение —</option>${profSkills().map(id=>`<option value="${id}"${C.choices.deftExplorerSkill===id?' selected':''}>${SKILLS.find(s=>s[0]===id)?.[1]||id}</option>`).join('')}</select></label><label>Дополнительные владения<select onchange="setDeftExplorerMode(this.value)"><option value="">— выберите вариант —</option><option value="two_languages"${mode==='two_languages'?' selected':''}>Два языка</option><option value="language_tool"${mode==='language_tool'?' selected':''}>Один язык и один инструмент</option></select></label>${mode==='language_tool'?`<label>Инструмент<select onchange="setDeftExplorerTool(this.value)"><option value="">— выберите —</option>${TOOL_PROFICIENCIES.filter(t=>!knownTools.includes(t)||t===C.choices.deftExplorerTool).map(t=>`<option${C.choices.deftExplorerTool===t?' selected':''}>${t}</option>`).join('')}</select></label>`:''}${mode==='two_languages'?'<p class="muted small">Языки выберите на вкладке «Основное».</p>':mode==='language_tool'?'<p class="muted small">Язык выберите на вкладке «Основное».</p>':''}</div>`:'';
  return `<details data-tasha-features="${c.cls}"><summary>Умения из «Котла Таши» · выбрано ${selectedTashaFeatures(c).length}</summary>${deftExplorer}<div class="col-list">${options.map(([id,lvl,name,desc])=>`<label class="chk wide"><input type="checkbox" ${selected.includes(id)?'checked':''}${lvl>c.lvl?' disabled':''} onchange="toggleTashaFeature('${c.cls}','${id}',this.checked)"><span><b>${name}</b> (${lvl} ур.) <span class="tag">Таша</span><br><span class="muted small">${desc}</span></span></label>`).join('')}</div><p class="muted small">Выбор сохраняется; компетентность «Искусного исследователя» применяется автоматически, остальные эффекты не пересчитываются.</p></details>`;
}
function setDeftExplorerSkill(skill){
  if(!deftExplorerActive()||skill&&!profSkills().includes(skill))return;
  updateTashaChoice('ranger',()=>{C.choices.deftExplorerSkill=skill;if(skill)C.expertise=(C.expertise||[]).filter(id=>id!==skill)});
}
function setDeftExplorerMode(mode){
  if(!deftExplorerActive()||!['two_languages','language_tool'].includes(mode))return;
  updateTashaChoice('ranger',()=>{
    const base=baseLanguageChoiceCount(),langs=C.extraLangs||[],count=mode==='two_languages'?2:1;
    C.extraLangs=Array.from({length:base+count},(_,i)=>langs[i]||'');
    C.choices.deftExplorerMode=mode;
    if(mode==='two_languages')delete C.choices.deftExplorerTool;
  });
}
function setDeftExplorerTool(tool){
  if(!deftExplorerActive()||C.choices.deftExplorerMode!=='language_tool'||tool&&!TOOL_PROFICIENCIES.includes(tool)||tool&&tool!==C.choices.deftExplorerTool&&toolProficiencies().includes(tool))return;
  updateTashaChoice('ranger',()=>{C.choices.deftExplorerTool=tool});
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
  if(r.subs&&!C.subrace)add('main','Выберите подрасу.');
  if(r.asiChoice&&(C.halfElfPicks||[]).filter(Boolean).length<r.asiChoice.count)add('abil',`Выберите ещё ${r.asiChoice.count-(C.halfElfPicks||[]).filter(Boolean).length} бонуса характеристики от расы.`);
  if(r.flexibleAsi){const count=C.raceAsiMode==='three'?3:2,picks=(C.raceAsiPicks||[]).filter(Boolean);if(new Set(picks).size<count)add('abil',`Распределите расовые бонусы характеристик: выберите ${count} разные характеристики.`)}
  if(r.skillChoice&&(C.raceSkills||[]).length<r.skillChoice)add('skills',`Выберите ещё ${r.skillChoice-(C.raceSkills||[]).length} расовых навыка.`);
  const langs=C.extraLangs||[],langCount=languageChoiceCount(),chosenLangs=langs.slice(0,langCount).filter(Boolean);
  if(chosenLangs.length<langCount)add('main',`Выберите ещё ${langCount-chosenLangs.length} язык(а).`);
  if(new Set(chosenLangs).size<chosenLangs.length)add('main','Уберите повторяющиеся языки.');
  for(const choice of racialCantripChoices())if(!(C.racialSpells||{})[choice.key])add('spells',`Выберите расовый заговор: ${choice.name}.`);
  for(const c of C.classes){
    const cl=CLASSES[c.cls],picks=(C.classSkills||{})[c.cls]||[];
    if(picks.length<cl.skillCount)add('skills',`${cl.name}: выберите ещё ${cl.skillCount-picks.length} навыка класса.`);
    if(cl.sub&&c.lvl>=cl.subLvl&&!c.sub)add('main',`Выберите подкласс для класса «${cl.name}».`);
    const subcl=SUBCLASSES[c.sub];
    if(subcl?.choices)for(const [lvl,block] of Object.entries(subcl.choices))if(c.lvl>=+lvl&&!C.choices[`hunter_${lvl}`])add('cls',`Выберите умение «${block.name}» (${lvl} ур.).`);
    if(c.cls==='ranger'&&c.lvl>=1){const variants=(C.choices.tashaFeatures||{}).ranger||[];if(!C.choices.favoredEnemy&&!variants.includes('favored_foe'))add('cls','Выберите «Избранного врага» или вариант из «Котла Таши».');if(!C.choices.favoredTerrain&&!variants.includes('deft_explorer'))add('cls','Выберите «Избранную местность» или вариант «Искусный исследователь» из «Котла Таши».');if(variants.includes('deft_explorer')){if(!deftExplorerSkill())add('cls','Выберите навык для компетентности «Искусного исследователя».');if(!['two_languages','language_tool'].includes(C.choices.deftExplorerMode))add('cls','Выберите дополнительные владения «Искусного исследователя».');if(C.choices.deftExplorerMode==='language_tool'&&!TOOL_PROFICIENCIES.includes(C.choices.deftExplorerTool))add('cls','Выберите инструмент для «Искусного исследователя».')}}
    if(c.cls==='druid'&&c.sub==='land'&&c.lvl>=2&&!C.choices.druidLand)add('cls','Выберите местность для круга друида.');
    if(c.cls==='sorcerer'&&c.sub==='draconic'&&!C.choices.draconicType)add('cls','Выберите тип дракона-прародителя.');
    if(c.cls==='warlock'){
      if(c.lvl>=3&&!C.choices.pactBoon)add('cls','Выберите договорный дар колдуна.');
      const invMax=TABLES.warlock.invocations[c.lvl-1]||0;if((C.choices.invocations||[]).length<invMax)add('cls',`Выберите мистические откровения: ${(C.choices.invocations||[]).length}/${invMax}.`);
      if(c.lvl>=11){const arcLvl=c.lvl>=17?9:c.lvl>=15?8:c.lvl>=13?7:6;if(!C.arcanum[arcLvl])add('cls',`Выберите мистический арканум ${arcLvl}-го круга.`)}
    }
    if(c.cls==='sorcerer'&&c.lvl>=3){const max=c.lvl>=17?4:c.lvl>=10?3:2;if((C.choices.metamagic||[]).length<max)add('cls',`Выберите приёмы Метамагии: ${(C.choices.metamagic||[]).length}/${max}.`)}
    const cantrips=cantripLimit(c.cls),selectedCantrips=(C.cantrips||{})[c.cls]||[];if(cantrips>selectedCantrips.length)add('spells',`${cl.name}: выберите заговоры (${selectedCantrips.length}/${cantrips}).`);
    const known=knownLimit(c.cls),knownSelected=(C.spellsKnown||{})[c.cls]||[];if(known>knownSelected.length)add('spells',`${cl.name}: выберите известные заклинания (${knownSelected.length}/${known}).`);
    if(c.cls==='wizard'){const min=6+(c.lvl-1)*2;if((C.spellbook||[]).length<min)add('spells',`Книга волшебника: рекомендуется не менее ${min} заклинаний.`,true)}
  }
  const expertiseMax=expertiseAvailable(),deftSkill=deftExplorerSkill(),manualExpertise=(C.expertise||[]).filter(id=>!deftSkill||id!==deftSkill).length,manualExpertiseMax=expertiseMax-(deftExplorerActive()?1:0);
  if(manualExpertise<manualExpertiseMax)add('skills',`Выберите ещё ${manualExpertiseMax-manualExpertise} компетентности.`);
  const styleRequired=C.classes.some(c=>(c.cls==='fighter'&&c.lvl>=1)||(['paladin','ranger'].includes(c.cls)&&c.lvl>=2));
  if(styleRequired&&!C.choices.fightingStyle)add('cls','Выберите боевой стиль.');
  const {need}=asiPending();
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
