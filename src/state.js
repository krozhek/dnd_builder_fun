function pruneAsiChoices(){
  const need=C.classes.reduce((total,c)=>total+CLASSES[c.cls].asiLvls.filter(level=>level<=c.lvl).length,0);
  for(const key of Object.keys(C.asi||[])){const match=/^asi(\d+)$/.exec(key);if(!match||+match[1]>=need)delete C.asi[key]}
}
function discardClassHitDice(cls){
  const used=syncHitDice(),count=used[cls]||0;
  delete used[cls];C.game.hdUsedByClass=used;C.game.hdUsed=Math.max(0,C.game.hdUsed-count);
}
function clearClassSelections(cls){
  for(const key of ['classSkills','cantrips','spellsKnown','spellsPrepared'])delete C[key]?.[cls];
  delete C.choices.classTools?.[cls];delete C.choices.fightingStyles?.[cls];delete C.choices.tashaFeatures?.[cls];
  if(cls==='wizard')C.spellbook=[];
  if(cls==='ranger'){
    delete C.choices.favoredEnemy;delete C.choices.favoredTerrain;delete C.choices.deftExplorerSkill;delete C.choices.deftExplorerMode;delete C.choices.deftExplorerTool;
    for(const key of Object.keys(C.choices))if(/^hunter_\d+$/.test(key))delete C.choices[key];
  }
  if(cls==='druid')delete C.choices.druidLand;
  if(cls==='sorcerer'){delete C.choices.draconicType;delete C.choices.metamagic}
  if(cls==='warlock'){delete C.choices.pactBoon;delete C.choices.invocations;C.arcanum={}}
}
function pruneExpertise(){C.expertise=(C.expertise||[]).filter(id=>profSkills().includes(id))}
function pruneClassSpells(cls){
  const caster=C.classes.find(c=>c.cls===cls);if(!caster)return 0;
  let removed=0;
  const valid=(id,kind)=>{
    const spell=SPELLS.find(s=>s.id===id);
    return spell&&spellClassAllowed(caster,id)&&(kind==='cantrip'?spell.lvl===0:spell.lvl>0&&spell.lvl<=classMaxSpellLevel(caster))&&!(kind==='prepared'&&cls==='wizard'&&!(C.spellbook||[]).includes(id));
  };
  for(const [field,kind] of [['cantrips','cantrip'],['spellsKnown','known'],['spellsPrepared','prepared']]){
    const old=C[field][cls]||[],limit=kind==='cantrip'?cantripLimit(cls):kind==='known'?knownLimit(cls):['cleric','druid','paladin','wizard'].includes(cls)?prepLimit(cls):0,kept=[];
    for(const id of old){if(!valid(id,kind)||kept.length>=limit||kind==='known'&&!thirdCasterSpellSelectionsValid(caster,[...kept,id]))continue;kept.push(id)}
    removed+=old.length-kept.length;C[field][cls]=kept;
  }
  if(cls==='wizard'){
    const old=C.spellbook||[];C.spellbook=old.filter(id=>valid(id,'known'));removed+=old.length-C.spellbook.length;
    C.spellsPrepared.wizard=(C.spellsPrepared.wizard||[]).filter(id=>C.spellbook.includes(id));
  }
  return removed;
}
function setCharacterRace(race){
  if(!RACES[race])return false;
  C.race=race;C.subrace='';C.raceSkills=[];C.halfElfPicks=[];C.raceAsiPicks=[];C.extraLangs=[];C.racialSpells={};
  if(RACES[race].src==='AAG')C.size=RACES[race].size;
  return true;
}
function setCharacterBackground(background){
  if(!BACKGROUNDS[background])return false;
  C.bg=background;C.choices.backgroundTools=[];C.extraLangs=[];return true;
}
function setCharacterClass(index,cls){
  if(!CLASSES[cls])return 'Неизвестный класс.';
  if(C.classes.some((c,i)=>i!==index&&c.cls===cls))return 'Этот класс уже добавлен.';
  if(C.classes.length>1){const error=multiclassRequirementError(cls,index);if(error)return error}
  const current=C.classes[index];if(!current)return 'Класс не найден.';
  const previous=current.cls;if(previous===cls)return '';
  discardClassHitDice(previous);current.cls=cls;current.sub=CLASSES[cls].sub||'';
  clearClassSelections(previous);pruneAsiChoices();
  if(previous==='ranger')C.extraLangs=(C.extraLangs||[]).slice(0,baseLanguageChoiceCount());
  pruneExpertise();return '';
}
function setCharacterLevel(index,value){
  const current=C.classes[index],level=Number(value);
  if(!current||!Number.isInteger(level)||level<1||level>20||totalLvl()-current.lvl+level>20)return {error:'Общий уровень персонажа не может превышать 20.'};
  const used=syncHitDice();current.lvl=level;
  used[current.cls]=Math.min(used[current.cls]||0,level);
  C.game.hdUsedByClass=used;C.game.hdUsed=Object.values(used).reduce((sum,n)=>sum+n,0);
  const removed=pruneClassSpells(current.cls);pruneAsiChoices();return {removed};
}
function setCharacterSubclass(index,subclass){
  const current=C.classes[index];if(!current||current.sub===subclass)return null;
  if(subclass&&SUBCLASSES[subclass]?.cls!==current.cls)return null;
  current.sub=subclass;
  if(current.cls==='druid'&&subclass!=='land')delete C.choices.druidLand;
  if(current.cls==='sorcerer'&&subclass!=='draconic')delete C.choices.draconicType;
  if(current.cls==='fighter'&&subclass!=='champion')delete C.choices.fightingStyles?.championExtra;
  return {removed:pruneClassSpells(current.cls)};
}
function addCharacterClass(){
  if(totalLvl()>=20)return 'Общий уровень персонажа уже равен 20.';
  const used=C.classes.map(c=>c.cls),available=Object.keys(CLASSES).filter(cls=>!used.includes(cls));
  const cls=available.find(value=>!multiclassRequirementError(value));
  if(!cls)return available.length?multiclassRequirementError(available[0]):'Все классы уже добавлены.';
  C.classes.push({cls,lvl:1,sub:CLASSES[cls].sub||''});return '';
}
function setCharacterArcanum(level,id){
  const warlock=C.classes.find(c=>c.cls==='warlock');
  const maxLevel=warlock?.lvl>=17?9:warlock?.lvl>=15?8:warlock?.lvl>=13?7:warlock?.lvl>=11?6:0;
  if(!warlock||level!==maxLevel||id&&!SPELLS.some(s=>s.id===id&&s.lvl===level&&s.cls.includes('warlock')))return false;
  if(id)C.arcanum[level]=id;else delete C.arcanum[level];
  return true;
}
function setCharacterSpellSelection(store,cls,limit,id,on){
  if(!['cantrips','spellsKnown','spellsPrepared'].includes(store))return 'Недопустимый список заклинаний.';
  const caster=C.classes.find(c=>c.cls===cls),spell=SPELLS.find(s=>s.id===id);
  if(!caster||!spell||spell.lvl>classMaxSpellLevel(caster)||!spellClassAllowed(caster,id)||store==='cantrips'&&spell.lvl!==0||store!=='cantrips'&&spell.lvl===0||!spellsForClass(cls,spell.lvl).some(s=>s.id===id)||store==='spellsPrepared'&&cls==='wizard'&&!(C.spellbook||[]).includes(id))return 'Это заклинание недоступно классу.';
  const arr=C[store][cls]||[];
  if(on){
    if(arr.includes(id))return '';
    if(store==='spellsKnown'&&spellTypeOf(caster)==='third'&&!thirdCasterSpellSelectionsValid(caster,[...arr,id]))return 'Для этого заклинания нет свободного выбора вне ограниченных школ.';
    const freeIds=store==='spellsKnown'&&cls==='ranger'?new Set(primalAwarenessSpells().map(s=>s.id)):null,count=freeIds?arr.filter(x=>!freeIds.has(x)).length:arr.length;
    if(count>=limit)return 'Лимит: '+limit;
    C[store][cls]=[...arr,id];
  }else C[store][cls]=arr.filter(x=>x!==id);
  return '';
}
function setCharacterSpellbook(id,on){
  const caster=C.classes.find(c=>c.cls==='wizard'),spell=SPELLS.find(s=>s.id===id);
  if(!caster||!spell||!spellClassAllowed(caster,id)||spell.lvl===0||spell.lvl>classMaxSpellLevel(caster))return false;
  const book=C.spellbook||[];
  if(on){if(!book.includes(id))C.spellbook=[...book,id]}
  else{
    C.spellbook=book.filter(x=>x!==id);
    C.spellsPrepared.wizard=(C.spellsPrepared.wizard||[]).filter(x=>x!==id);
  }
  return true;
}
function setCharacterRacialSpell(key,id){
  const choice=racialCantripChoices().find(c=>c.key===key);
  if(!choice||!choice.spells.some(s=>s.id===id))return false;
  C.racialSpells=C.racialSpells||{};C.racialSpells[key]=id;
  if(choice.defaultAbility&&!C.racialSpells[key+'Ability'])C.racialSpells[key+'Ability']=choice.defaultAbility;
  return true;
}
function setCharacterRacialSpellAbility(key,ability){
  const choice=racialCantripChoices().find(c=>c.key===key);
  if(!choice||!choice.abilities?.includes(ability))return false;
  C.racialSpells=C.racialSpells||{};C.racialSpells[key+'Ability']=ability;return true;
}
function removeCharacterClass(index){
  if(C.classes.length<=1||!C.classes[index])return false;
  const cls=C.classes[index].cls;
  discardClassHitDice(cls);C.classes.splice(index,1);clearClassSelections(cls);pruneAsiChoices();
  if(cls==='ranger')C.extraLangs=(C.extraLangs||[]).slice(0,baseLanguageChoiceCount());
  pruneExpertise();return true;
}
