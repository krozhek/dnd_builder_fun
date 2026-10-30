function pruneAsiChoices(){
  const need=C.classes.reduce((total,c)=>total+CLASSES[c.cls].asiLvls.filter(level=>level<=c.lvl).length,0);
  for(const key of Object.keys(C.asi||[])){const match=/^asi(\d+)$/.exec(key);if(!match||+match[1]>=need)delete C.asi[key]}
}
function discardClassHitDice(cls){
  const used=syncHitDice(),count=used[cls]||0;
  delete used[cls];C.game.hdUsedByClass=used;C.game.hdUsed=Math.max(0,C.game.hdUsed-count);
}
function pruneHunterChoices(maxLevel=0){for(const key of Object.keys(C.choices)){const match=/^hunter_(\d+)$/.exec(key);if(match&&+match[1]>maxLevel)delete C.choices[key]}}
function clearClassSelections(cls){
  for(const key of ['classSkills','cantrips','spellsKnown','spellsPrepared'])delete C[key]?.[cls];
  delete C.choices.classTools?.[cls];delete C.choices.fightingStyles?.[cls];delete C.choices.tashaFeatures?.[cls];
  if(cls==='wizard')C.spellbook=[];
  if(cls==='ranger'){
    delete C.choices.favoredEnemy;delete C.choices.favoredTerrain;delete C.choices.deftExplorerSkill;delete C.choices.deftExplorerMode;delete C.choices.deftExplorerTool;
    pruneHunterChoices();
  }
  if(cls==='druid')delete C.choices.druidLand;
  if(cls==='sorcerer'){delete C.choices.draconicType;delete C.choices.metamagic}
  if(cls==='warlock'){delete C.choices.pactBoon;delete C.choices.invocations;C.arcanum={}}
}
function pruneExpertise(){
  const max=expertiseAvailable()-(deftExplorerActive()?1:0);
  C.expertise=(C.expertise||[]).filter(id=>profSkills().includes(id)&&id!==deftExplorerSkill()).slice(0,max);
}
function pruneSkillChoices(){
  C.classSkills=C.classSkills||{};C.raceSkills=C.raceSkills||[];
  const prof=new Set([...bgSkills(),...raceFixedSkillProfs()]),raceLimit=raceSkillChoiceCount(),raceOptions=raceSkillChoiceOptions();
  C.raceSkills=C.raceSkills.filter(id=>raceOptions.includes(id)&&!prof.has(id)).slice(0,raceLimit);C.raceSkills.forEach(id=>prof.add(id));
  C.classes.forEach((c,index)=>{
    const picks=(C.classSkills[c.cls]||[]).filter(id=>CLASSES[c.cls].skillList.includes(id)&&!prof.has(id)).slice(0,classSkillChoiceCount(index,c.cls));
    C.classSkills[c.cls]=picks;picks.forEach(id=>prof.add(id));
  });
  if(C.choices.deftExplorerSkill&&(!deftExplorerActive()||!prof.has(C.choices.deftExplorerSkill)))delete C.choices.deftExplorerSkill;
  pruneExpertise();
}
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
function pruneGameTrackers(){
  const game=C.game,slots=spellSlots()||[],resources=new Map(classResources().map(resource=>[resource.id,resource.max]));
  game.slotsUsed=Object.fromEntries(Object.entries(game.slotsUsed||{}).filter(([level])=>/^[0-8]$/.test(level)&&slots[+level]).map(([level,used])=>[level,Math.min(slots[+level],Math.max(0,Math.floor(used||0)))]));
  game.resources=Object.fromEntries(Object.entries(game.resources||{}).filter(([id])=>resources.has(id)).map(([id,used])=>[id,Math.min(resources.get(id),Math.max(0,Math.floor(used||0)))]));
  if(game.hpCur!=null)game.hpCur=Math.min(game.hpCur,maxHp());
}
function pruneExtraLanguages(){
  const old=C.extraLangs||[],count=languageChoiceCount(),used=new Set(raceKnownLanguages());
  C.extraLangs=Array.from({length:count},(_,index)=>{
    const value=old[index]||'',allowed=index<baseLanguageChoiceCount()?raceExtraLanguageOptions(index):LANGS;
    if(!value||!allowed.includes(value)||used.has(value))return '';
    used.add(value);return value;
  });
}
function setCharacterRace(race){
  if(!RACES[race])return false;
  C.race=race;C.subrace='';C.size=raceSizeOptions(race,'').includes(C.size)?C.size:RACES[race].size||'Средний';C.raceSkills=[];C.halfElfPicks=[];C.raceAsiMode='two';C.raceAsiPicks=[];C.extraLangs=[];C.racialSpells={};delete C.choices.raceTools;
  pruneSkillChoices();pruneGameTrackers();return true;
}
function setCharacterBackground(background){
  if(!BACKGROUNDS[background])return false;
  C.bg=background;C.choices.backgroundTools=[];pruneExtraLanguages();pruneSkillChoices();return true;
}
function setCharacterClass(index,cls){
  if(!CLASSES[cls])return 'Неизвестный класс.';
  if(C.classes.some((c,i)=>i!==index&&c.cls===cls))return 'Этот класс уже добавлен.';
  if(C.classes.length>1){const error=multiclassRequirementError(cls,index);if(error)return error}
  const current=C.classes[index];if(!current)return 'Класс не найден.';
  const previous=current.cls;if(previous===cls)return '';
  discardClassHitDice(previous);current.cls=cls;current.sub=CLASSES[cls].sub||'';
  clearClassSelections(previous);pruneAsiChoices();
  if(previous==='ranger')delete C.choices.deftExplorerMode;
  pruneExtraLanguages();pruneExpertise();pruneGameTrackers();return '';
}
function pruneWarlockInvocations(){
  const warlock=C.classes.find(characterClass=>characterClass.cls==='warlock'),max=warlock?TABLES.warlock.invocations[warlock.lvl-1]||0:0;
  C.choices.invocations=(C.choices.invocations||[]).filter(id=>!invocationPrerequisiteError(id,warlock)).slice(0,max);
}
function pruneClassTools(cls){
  const index=C.classes.findIndex(characterClass=>characterClass.cls===cls);if(index<0)return;
  const selected=(C.choices.classTools||{})[cls]||[],kept=[];let offset=0;
  for(const group of classToolChoiceGroups(C.classes[index],index)){
    kept.push(...selected.slice(offset,offset+group.count).filter(value=>group.options.includes(value)));offset+=group.count;
  }
  if(kept.length)C.choices.classTools[cls]=kept;else delete C.choices.classTools?.[cls];
}
function pruneClassLevelChoices(characterClass){
  const {cls,lvl,sub}=characterClass,selected=(C.choices.tashaFeatures||{})[cls]||[];
  pruneClassTools(cls);
  if(selected.length){
    const eligible=selected.filter(id=>(TASHA_FEATURES[cls]||[]).some(([option,required])=>option===id&&required<=lvl));
    if(eligible.length)C.choices.tashaFeatures[cls]=eligible;else delete C.choices.tashaFeatures[cls];
  }
  if(cls==='ranger')pruneHunterChoices(lvl);
  if(cls==='druid'&&sub==='land'&&lvl<2)delete C.choices.druidLand;
  if(cls==='fighter'&&sub==='champion'&&lvl<10)delete C.choices.fightingStyles?.championExtra;
  if(cls==='sorcerer'){
    const max=lvl>=17?4:lvl>=10?3:lvl>=3?2:0;
    if(max)C.choices.metamagic=(C.choices.metamagic||[]).slice(0,max);else delete C.choices.metamagic;
  }
  if(cls==='warlock'){
    if(lvl<3)delete C.choices.pactBoon;
    pruneWarlockInvocations();
    C.arcanum=Object.fromEntries(Object.entries(C.arcanum||{}).filter(([spellLevel])=>arcanumLevels(lvl).includes(+spellLevel)));
  }
}
function setCharacterLevel(index,value){
  const current=C.classes[index],level=Number(value);
  if(!current||!Number.isInteger(level)||level<1||level>20||totalLvl()-current.lvl+level>20)return {error:'Общий уровень персонажа не может превышать 20.'};
  const used=syncHitDice();current.lvl=level;
  used[current.cls]=Math.min(used[current.cls]||0,level);
  C.game.hdUsedByClass=used;C.game.hdUsed=Object.values(used).reduce((sum,n)=>sum+n,0);
  pruneClassLevelChoices(current);pruneExpertise();pruneExtraLanguages();
  const removed=pruneClassSpells(current.cls);pruneAsiChoices();pruneGameTrackers();return {removed};
}
function setCharacterSubclass(index,subclass){
  const current=C.classes[index];if(!current||current.sub===subclass)return null;
  if(subclass&&SUBCLASSES[subclass]?.cls!==current.cls)return null;
  current.sub=subclass;pruneClassTools(current.cls);
  if(current.cls==='ranger')pruneHunterChoices(subclass==='hunter'?current.lvl:0);
  if(current.cls==='druid'&&subclass!=='land')delete C.choices.druidLand;
  if(current.cls==='sorcerer'&&subclass!=='draconic')delete C.choices.draconicType;
  if(current.cls==='fighter'&&subclass!=='champion')delete C.choices.fightingStyles?.championExtra;
  const removed=pruneClassSpells(current.cls);pruneGameTrackers();return {removed};
}
function addCharacterClass(){
  if(totalLvl()>=20)return 'Общий уровень персонажа уже равен 20.';
  const used=C.classes.map(c=>c.cls),available=Object.keys(CLASSES).filter(cls=>!used.includes(cls));
  const cls=available.find(value=>!multiclassRequirementError(value));
  if(!cls)return available.length?multiclassRequirementError(available[0]):'Все классы уже добавлены.';
  C.classes.push({cls,lvl:1,sub:CLASSES[cls].sub||''});pruneGameTrackers();return '';
}
function setCharacterArcanum(level,id){
  const warlock=C.classes.find(c=>c.cls==='warlock');
  if(!warlock||!arcanumLevels(warlock.lvl).includes(level)||id&&!SPELLS.some(s=>s.id===id&&s.lvl===level&&s.cls.includes('warlock')))return false;
  if(id)C.arcanum[level]=id;else delete C.arcanum[level];
  return true;
}
function setCharacterSpellSelection(store,cls,id,on){
  if(!['cantrips','spellsKnown','spellsPrepared'].includes(store))return 'Недопустимый список заклинаний.';
  const caster=C.classes.find(c=>c.cls===cls),spell=SPELLS.find(s=>s.id===id),limit=store==='cantrips'?cantripLimit(cls):store==='spellsKnown'?knownLimit(cls):prepLimit(cls);
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
  pruneExpertise();pruneGameTrackers();return true;
}
function setCharacterAbilityMethod(method){if(!['standard','point','manual'].includes(method))return false;C.abilityMethod=method;return true}
function setCharacterStandardAbility(ability,value){
  if(!ABILS.some(([id])=>id===ability)||![15,14,13,12,10,8].includes(+value))return false;
  const base=C.bases.standard,other=ABILS.map(([id])=>id).find(id=>id!==ability&&base[id]===+value);
  if(other)base[other]=base[ability];base[ability]=+value;return true;
}
function stepCharacterPointAbility(ability,delta){
  if(!ABILS.some(([id])=>id===ability)||![-1,1].includes(delta))return false;
  const base=C.bases.point,value=(base[ability]??8)+delta;
  if(value<8||value>15||delta>0&&pointBuySpent(base)-(POINT_COST[base[ability]??8]??0)+(POINT_COST[value]??0)>27)return false;
  base[ability]=value;return true;
}
function setCharacterManualAbility(ability,value){if(!ABILS.some(([id])=>id===ability))return false;C.bases.manual[ability]=Math.max(3,Math.min(18,+value||10));return true}
function setCharacterRaceAsiMode(mode){if(!raceFlexibleAsi()||!['two','three'].includes(mode))return false;C.raceAsiMode=mode;C.raceAsiPicks=[];return true}
function setCharacterRaceAsi(index,ability){
  const count=C.raceAsiMode==='three'?3:2;
  if(!raceFlexibleAsi()||!Number.isInteger(index)||index<0||index>=count||ability&&(!ABILS.some(([id])=>id===ability)||(C.raceAsiPicks||[]).some((id,i)=>i!==index&&id===ability)))return false;
  C.raceAsiPicks=C.raceAsiPicks||[];C.raceAsiPicks[index]=ability;return true;
}
function toggleCharacterHalfElfAbility(ability,on){
  C.halfElfPicks=C.halfElfPicks||[];const choice=raceAsiChoice();
  if(on){
    if(!choice||!ABILS.some(([id])=>id===ability)||choice.exclude.includes(ability)||C.halfElfPicks.includes(ability)||C.halfElfPicks.length>=choice.count)return 'Недопустимый бонус характеристики.';
    C.halfElfPicks.push(ability);
  }else C.halfElfPicks=C.halfElfPicks.filter(id=>id!==ability);
  return '';
}
function setCharacterAsiType(index,type){if(!Number.isInteger(index)||index<0||!['asi','feat'].includes(type))return false;C.asi['asi'+index]=type==='feat'?{type:'feat',id:'',bonus:''}:{type:'asi',vals:[]};return true}
function setCharacterAsiFeat(index,id){
  if(!Number.isInteger(index)||index<0||id&&!FEATS.some(([feat])=>feat===id))return false;
  if(id){const error=featPrerequisiteError(id);if(error)return error;if(Object.entries(C.asi||{}).some(([key,value])=>key!==`asi${index}`&&value?.type==='feat'&&value.id===id))return 'Эту черту нельзя выбрать повторно.'}
  C.asi['asi'+index]={type:'feat',id,bonus:''};return true;
}
function setCharacterAsiFeatBonus(index,ability){
  const feat=C.asi['asi'+index],definition=FEATS.find(([id])=>id===feat?.id);
  if(!feat||!definition?.[3]||ability&&!definition[3].includes(ability))return false;feat.bonus=ability;return true;
}
function setCharacterAsiValues(index,values){
  if(!Number.isInteger(index)||index<0||!Array.isArray(values)||values.length>2||values.some(id=>!ABILS.some(([ability])=>ability===id)))return false;
  const vals=values.length===1?[values[0],values[0]]:values;C.asi['asi'+index]={type:'asi',vals};return true;
}
function resetCharacterSkillChoices(){C.classSkills={};C.raceSkills=[];C.expertise=[];delete C.choices.deftExplorerSkill}
function toggleCharacterRaceSkill(id,on){
  C.raceSkills=C.raceSkills||[];const max=raceSkillChoiceCount(),options=raceSkillChoiceOptions();
  if(on){if(!options.includes(id)||profSkills().includes(id))return 'Навык уже выбран из другого источника.';if(C.raceSkills.length>=max)return 'Максимум '+max;C.raceSkills.push(id)}
  else C.raceSkills=C.raceSkills.filter(skill=>skill!==id);
  return '';
}
function toggleCharacterClassSkill(cls,id,on){
  const index=C.classes.findIndex(characterClass=>characterClass.cls===cls),definition=CLASSES[cls];
  if(index<0||!definition)return 'Неизвестный класс.';
  const max=classSkillChoiceCount(index,cls);
  C.classSkills[cls]=C.classSkills[cls]||[];
  if(on){if(!definition.skillList.includes(id))return 'Неизвестный навык.';if(profSkills().includes(id))return 'Навык уже выбран из другого источника';if(C.classSkills[cls].length>=max)return 'Максимум '+max;C.classSkills[cls].push(id)}
  else C.classSkills[cls]=C.classSkills[cls].filter(skill=>skill!==id);
  return '';
}
function toggleCharacterExpertise(id,on){
  const max=expertiseAvailable();
  C.expertise=C.expertise||[];
  if(on){if(C.expertise.includes(id)||deftExplorerSkill()===id)return '';if(!profSkills().includes(id))return 'Компетентность доступна только для навыка, которым вы владеете.';if(expertiseSkills().length>=max)return 'Максимум '+max;C.expertise.push(id)}
  else C.expertise=C.expertise.filter(skill=>skill!==id);
  return '';
}
function priceToGold(price){const match=String(price).match(/([\d.,]+)\s*(зм|см|мм)/);if(!match)return 0;const value=parseFloat(match[1].replace(',','.'));return match[2]==='зм'?value:match[2]==='см'?value/10:value/100}
function setCharacterEquipmentMode(mode){if(!['equipment','gold'].includes(mode))return false;C.goldMode=mode;return true}
function setCharacterEquipmentChoice(cls,name){if(!STARTING_EQUIPMENT[cls]?.choices?.some(choice=>choice.name===name))return false;C.equipChoice[cls]=name;return true}
function setCharacterGold(value){if(!Number.isFinite(+value))return false;C.gold=Math.max(0,+value);return true}
function setCharacterAttunement(index,value){if(!Number.isInteger(index)||index<0||index>=3)return false;C.attunement[index]=String(value).slice(0,500);return true}
function addCharacterItem(type,id,qty=1){
  if(!Number.isInteger(qty)||qty<1)return false;
  C.inventory=C.inventory||[];
  const existing=C.inventory.find(item=>item.type===type&&item.id===id&&type!=='armor'&&type!=='shield'&&!(type==='weapon'&&item.wielded));
  if(existing)existing.qty=(existing.qty||1)+qty;else C.inventory.push({type,id,qty,equipped:false});
  return true;
}
function buyCharacterItem(type,id,cost){
  if(C.goldMode==='gold'){
    if(!Number.isFinite(cost)||cost<0)return 'Некорректная цена.';
    if((C.gold||0)<cost)return 'Не хватает золота';
    C.gold=Math.round((C.gold-cost)*100)/100;
  }
  addCharacterItem(type,id,1);return '';
}
function sellCharacterItem(index){
  const item=C.inventory[index];if(!item)return false;
  if(item.equipped)item.equipped=false;
  if(C.goldMode==='gold'){
    let price=0;
    if(item.type==='weapon')price=priceToGold((WEAPONS.find(row=>row[0]===item.id)||[])[2]||0);
    if(item.type==='armor'||item.type==='shield')price=priceToGold((ARMORS.find(row=>row[0]===item.id)||[])[2]||0);
    if(item.type==='gear')price=priceToGold((GEAR.find(row=>row[0]===item.id)||[])[2]||0);
    C.gold=Math.round(((C.gold||0)+price/2*(item.qty||1))*100)/100;
  }
  if((item.qty||1)>1)item.qty--;else C.inventory.splice(index,1);
  return true;
}
function removeCharacterItem(index){if(!C.inventory[index])return false;C.inventory.splice(index,1);return true}
function toggleCharacterEquipItem(index){
  const item=C.inventory[index];if(!item||!['armor','shield'].includes(item.type))return false;
  if(item.type==='armor'||item.type==='shield')C.inventory.forEach(other=>{if(other.type===item.type)other.equipped=false});
  item.equipped=!item.equipped;return true;
}
function toggleCharacterWieldWeapon(index){
  const item=C.inventory[index];if(!item||item.type!=='weapon')return false;
  if(item.wielded)item.wielded=false;
  else if((item.qty||1)>1){item.qty--;C.inventory.splice(index,0,{...item,qty:1,wielded:true,grip:'one-handed'})}
  else item.wielded=true;
  return true;
}
function setCharacterWeaponGrip(index,grip){
  const item=C.inventory[index],weapon=item&&WEAPONS.find(row=>row[0]===item.id);
  if(!weapon||!weapon[5].includes('Универсальное')||!['one-handed','two-handed'].includes(grip))return false;
  item.grip=grip;return true;
}
function applyCharacterStartingKit(replace=false){
  const characterClass=C.classes[0],equipment=STARTING_EQUIPMENT[characterClass?.cls];if(!equipment)return false;
  if(replace)C.inventory=[];
  const choice=(C.equipChoice[characterClass.cls]||'а'),selected=equipment.choices.find(item=>item.name===choice)||equipment.choices[0];
  for(const [kind,a,b] of [...(selected?.items||[]),...(equipment.defaults||[])]){
    if(kind==='weapon')addCharacterItem('weapon',a,typeof b==='number'?b:1);
    else if(kind==='weaponAny'){
      const category=a.includes('martial')?'martial':'simple',melee=a.includes('melee'),weapon=WEAPONS.find(row=>row[7]===category&&(melee?row[6]==='melee':true));
      if(weapon)addCharacterItem('weapon',weapon[0],1);
    }else if(kind==='armor')addCharacterItem('armor',a,1);
    else if(kind==='shield')addCharacterItem('shield','shield',1);
    else if(kind==='ammo'||kind==='gear')addCharacterItem('gear',a,1);
    else if(kind==='pack')addCharacterItem('pack',a,1);
    else if(kind==='instrument')addCharacterItem('instrument',a,1);
  }
  if(!C.inventory.some(item=>item.type==='armor'&&item.equipped)){
    const armor=C.inventory.find(item=>item.type==='armor');if(armor)armor.equipped=true;
  }
  return true;
}
function setCharacterField(key,value){
  if(key==='subrace'){
    if(value&&!RACES[C.race]?.subs?.[value])return false;
    const changed=C.subrace!==value;C.subrace=value;
    if(changed){C.halfElfPicks=[];C.raceAsiPicks=[];C.raceAsiMode='two'}
    if(!raceSizeOptions().includes(C.size))C.size=raceSizeOptions()[0];
    if(C.race==='elf'&&value!=='high'&&C.racialSpells){delete C.racialSpells.highelf;delete C.racialSpells.highelfAbility}
    pruneSkillChoices();pruneExtraLanguages();
  }
  else if(key==='dragonColor'){if(!['black','blue','brass','bronze','copper','gold','green','red','silver','white'].includes(value))return false;C.dragonColor=value}
  else if(key==='align'){if(!ALIGN.includes(value))return false;C.align=value}
  else if(key==='size'){if(!raceSizeOptions().includes(value))return false;C.size=value}
  else if(key==='name'){C.name=String(value).slice(0,100)}
  else if(key==='xp'){const xp=Number(value);if(!Number.isFinite(xp)||xp<0)return false;C.xp=xp}
  else if(key==='goals'){C.goals=String(value).slice(0,5000)}
  else return false;
  return true;
}
function setCharacterAppearance(key,value){
  if(!['age','height','weight','eyes','skin','hair','details'].includes(key))return false;
  C.appearance=C.appearance||{};C.appearance[key]=String(value).slice(0,500);return true;
}
function setCharacterPortrait(portrait){if(typeof portrait!=='string'||portrait.length>MAX_PORTRAIT_DATA||portrait&&!portrait.startsWith('data:image/'))return false;C.portrait=portrait;return true}
function setCharacterPersonality(key,value){if(!['traits','ideals','bonds','flaws'].includes(key))return false;C.personality[key]=String(value);return true}
function addCharacterPersonality(key,value){if(!['traits','ideals','bonds','flaws'].includes(key))return false;C.personality[key]=(C.personality[key]?C.personality[key]+'\n':'')+String(value);return true}
function setCharacterRaceTool(value){
  const choice=raceToolChoiceGroup();if(!choice||value&&!choice.options.includes(value))return false;
  if(value)C.choices.raceTools=value;else delete C.choices.raceTools;return true;
}
function setCharacterBackgroundTool(index,value){
  const groups=backgroundToolChoiceGroups().choices;if(!Number.isInteger(index)||index<0||index>=groups.length)return false;
  C.choices.backgroundTools=C.choices.backgroundTools||[];C.choices.backgroundTools[index]=groups[index].options.includes(value)?value:'';return true;
}
function setCharacterClassTools(cls,values){
  const index=C.classes.findIndex(characterClass=>characterClass.cls===cls);if(index<0||!Array.isArray(values))return false;
  const groups=classToolChoiceGroups(C.classes[index],index),max=groups.reduce((sum,group)=>sum+group.count,0),options=groups.flatMap(group=>group.options);
  C.choices.classTools=C.choices.classTools||{};C.choices.classTools[cls]=values.filter(value=>options.includes(value)).slice(0,max);return true;
}
function setCharacterExtraLanguage(index,value){
  if(!Number.isInteger(index)||index<0||index>=languageChoiceCount()||value&&!raceExtraLanguageOptions(index).includes(value))return false;
  const used=[...raceKnownLanguages(),...(C.extraLangs||[]).filter((lang,i)=>i!==index&&lang)];if(value&&used.includes(value))return false;
  C.extraLangs=C.extraLangs||[];while(C.extraLangs.length<=index)C.extraLangs.push('');C.extraLangs[index]=value;return true;
}
function setCharacterChoice(key,value){
  const allowed={favoredEnemy:FAVORED_ENEMIES,favoredTerrain:FAVORED_TERRAIN,druidLand:Object.keys(SUBCLASSES.land.lands),draconicType:['black','blue','brass','bronze','copper','gold','green','red','silver','white'],pactBoon:['blade','chain','tome','talisman']};
  if(!allowed[key]||value&&!allowed[key].includes(value))return false;
  const available=key==='favoredEnemy'||key==='favoredTerrain'?C.classes.some(characterClass=>characterClass.cls==='ranger'):key==='druidLand'?C.classes.some(characterClass=>characterClass.cls==='druid'&&characterClass.sub==='land'&&characterClass.lvl>=2):key==='draconicType'?C.classes.some(characterClass=>characterClass.cls==='sorcerer'&&characterClass.sub==='draconic'):C.classes.some(characterClass=>characterClass.cls==='warlock'&&characterClass.lvl>=3);
  if(!available)return false;
  if(value)C.choices[key]=value;else delete C.choices[key];if(key==='pactBoon')pruneWarlockInvocations();return true;
}
function setCharacterHunterChoice(level,id){
  const current=C.classes.find(characterClass=>characterClass.cls==='ranger'),choice=SUBCLASSES[current?.sub]?.choices?.[level];
  if(!choice||current.lvl<+level||id&&!choice.opts.some(([option])=>option===id))return false;
  const key='hunter_'+level;if(id)C.choices[key]=id;else delete C.choices[key];return true;
}
function setCharacterFightingStyle(key,value){
  const options=key==='championExtra'?FIGHTING_STYLES.fighter:FIGHTING_STYLES[key];
  if(!options||!activeFightingStyleKeys().includes(key)||value&&!options.some(([id])=>id===value))return false;
  const styles=C.choices.fightingStyles||{};
  if(value&&activeFightingStyleKeys().some(other=>other!==key&&styles[other]===value))return 'Боевой стиль уже выбран.';
  C.choices.fightingStyles=C.choices.fightingStyles||{};if(value)C.choices.fightingStyles[key]=value;else delete C.choices.fightingStyles[key];return '';
}
function toggleCharacterInvocation(id,on){
  const warlock=C.classes.find(characterClass=>characterClass.cls==='warlock'),error=invocationPrerequisiteError(id,warlock);
  if(error)return error;
  const max=TABLES.warlock.invocations[warlock.lvl-1]||0,selected=C.choices.invocations||[];
  if(on){if(selected.includes(id))return '';if(selected.length>=max)return 'Максимум '+max;C.choices.invocations=[...selected,id]}
  else C.choices.invocations=selected.filter(option=>option!==id);
  return '';
}
function toggleCharacterMetamagic(id,on){
  const sorcerer=C.classes.find(characterClass=>characterClass.cls==='sorcerer');
  if(!sorcerer||sorcerer.lvl<3||!METAMAGIC.some(([option])=>option===id))return 'Недоступное умение Метамагии.';
  const max=sorcerer.lvl>=17?4:sorcerer.lvl>=10?3:2,selected=C.choices.metamagic||[];
  if(on){if(selected.includes(id))return '';if(selected.length>=max)return 'Максимум '+max;C.choices.metamagic=[...selected,id]}
  else C.choices.metamagic=selected.filter(option=>option!==id);
  return '';
}
function toggleCharacterTashaFeature(cls,id,on){
  const characterClass=C.classes.find(entry=>entry.cls===cls),feature=(TASHA_FEATURES[cls]||[]).find(([option])=>option===id);
  if(!characterClass||!feature||feature[1]>characterClass.lvl)return false;
  C.choices.tashaFeatures=C.choices.tashaFeatures||{};
  const selected=new Set(C.choices.tashaFeatures[cls]||[]);if(on)selected.add(id);else selected.delete(id);C.choices.tashaFeatures[cls]=[...selected];
  if(cls==='ranger'&&id==='deft_explorer'){
    if(on)delete C.choices.deftExplorerMode;
    else{delete C.choices.deftExplorerSkill;delete C.choices.deftExplorerMode;delete C.choices.deftExplorerTool}
  }
  if(cls==='ranger')pruneExtraLanguages();
  return true;
}
function setCharacterDeftExplorerSkill(skill){
  if(!deftExplorerActive()||skill&&!profSkills().includes(skill))return false;
  C.choices.deftExplorerSkill=skill;if(skill)C.expertise=(C.expertise||[]).filter(id=>id!==skill);return true;
}
function setCharacterDeftExplorerMode(mode){
  if(!deftExplorerActive())return false;mode=mode||'';
  if(mode&&!['two_languages','language_tool'].includes(mode))return false;
  const base=baseLanguageChoiceCount(),langs=C.extraLangs||[],count=mode==='two_languages'?2:mode==='language_tool'?1:0;
  C.extraLangs=mode?Array.from({length:base+count},(_,i)=>langs[i]||''):langs.slice(0,base);
  if(mode)C.choices.deftExplorerMode=mode;else delete C.choices.deftExplorerMode;
  if(mode!=='language_tool')delete C.choices.deftExplorerTool;
  pruneExtraLanguages();return true;
}
function setCharacterDeftExplorerTool(tool){
  if(!deftExplorerActive()||C.choices.deftExplorerMode!=='language_tool'||tool&&!TOOL_PROFICIENCIES.includes(tool)||tool&&tool!==C.choices.deftExplorerTool&&toolProficiencies().includes(tool))return false;
  if(tool)C.choices.deftExplorerTool=tool;else delete C.choices.deftExplorerTool;return true;
}
function setCharacterGameField(field,value){
  const game=C.game;
  if(field==='hpTemp'){const n=Number(value);if(!Number.isFinite(n))return false;game.hpTemp=Math.max(0,n)}
  else if(field==='insp')game.insp=!!value;
  else if(field==='exh'){const n=Number(value);if(!Number.isFinite(n))return false;game.exh=Math.min(6,Math.max(0,n))}
  else if(field==='conditions'||field==='notes')game[field]=String(value);
  else return false;
  return true;
}
function restoreDeathSavesAfterHealing(previousHp){if(previousHp<=0&&C.game.hpCur>0){C.game.dsOk=0;C.game.dsFail=0}}
function changeCharacterHp(amount,healing){
  const game=C.game,mhp=maxHp();if(!Number.isFinite(amount)||amount<=0)return false;
  const previousHp=game.hpCur??mhp;
  if(healing)game.hpCur=Math.min(mhp,previousHp+amount);
  else{
    let damage=amount;
    const temporary=Math.min(game.hpTemp||0,damage);game.hpTemp=Math.max(0,(game.hpTemp||0)-temporary);damage-=temporary;
    game.hpCur=Math.max(0,previousHp-damage);
  }
  if(healing)restoreDeathSavesAfterHealing(previousHp);
  return true;
}
function setCharacterFullHp(){const previous=C.game.hpCur??maxHp();C.game.hpCur=maxHp();restoreDeathSavesAfterHealing(previous)}
function setCharacterDeathSaves(kind,value){if(!['dsOk','dsFail'].includes(kind)||!Number.isInteger(value))return false;C.game[kind]=Math.max(0,Math.min(3,value));return true}
function toggleCharacterTracker(kind,id,index){
  if(!Number.isInteger(index)||index<0)return false;
  let used,max;
  if(kind==='slot'){
    max=(spellSlots()||[])[id];if(!Number.isInteger(max)||index>=max)return false;
    C.game.slotsUsed=C.game.slotsUsed||{};used=C.game.slotsUsed[id]||0;C.game.slotsUsed[id]=used===index+1?index:index+1;
  }else if(kind==='pact'||kind==='resource'){
    const resource=classResources().find(item=>item.id===id);if(!resource||index>=Math.min(resource.max,30))return false;
    C.game.resources=C.game.resources||{};used=C.game.resources[id]||0;C.game.resources[id]=used===index+1?index:index+1;
  }else return false;
  return true;
}
function reduceCharacterHitDiceUsed(){
  const used=syncHitDice();
  for(const characterClass of [...C.classes].reverse())if(used[characterClass.cls]){used[characterClass.cls]--;break}
  C.game.hdUsedByClass=used;C.game.hdUsed=Object.values(used).reduce((sum,count)=>sum+count,0);
}
function spendCharacterHitDie(cls,roll){
  const used=syncHitDice(),characterClass=C.classes.find(item=>item.cls===cls);
  if(!characterClass||used[cls]>=characterClass.lvl)return {error:'Все кости хитов этого класса потрачены'};
  const hitDie=CLASSES[cls].hd;if(!Number.isInteger(roll)||roll<1||roll>hitDie)return {error:'Некорректный бросок кости хитов'};
  used[cls]++;C.game.hdUsedByClass=used;C.game.hdUsed=Object.values(used).reduce((sum,count)=>sum+count,0);
  const previousHp=C.game.hpCur??maxHp(),healing=Math.max(1,roll+am('con'));C.game.hpCur=Math.min(maxHp(),previousHp+healing);restoreDeathSavesAfterHealing(previousHp);
  return {healing,hitDie};
}
function shortRestCharacter(){
  const game=C.game;
  if(game.resources){
    for(const id of ['pact','ki','secondwind','surge','wildshape','channel','paladinChannel','luck'])if(game.resources[id]!=null)game.resources[id]=0;
    if(game.resources.insp!=null&&C.classes.find(c=>c.cls==='bard'&&c.lvl>=5))game.resources.insp=0;
    if(C.classes.some(c=>c.cls==='sorcerer'&&c.lvl>=20)&&game.resources.sorc!=null)game.resources.sorc=Math.max(0,game.resources.sorc-4);
  }
}
function longRestCharacter(){
  const game=C.game;game.hpCur=maxHp();game.hpTemp=0;
  const used=syncHitDice(),remaining=Math.min(Object.values(used).reduce((sum,count)=>sum+count,0),Math.max(1,Math.floor(totalLvl()/2)));
  let recover=remaining;
  for(const characterClass of C.classes){const restored=Math.min(used[characterClass.cls]||0,recover);used[characterClass.cls]-=restored;recover-=restored}
  game.hdUsedByClass=used;game.hdUsed=Object.values(used).reduce((sum,count)=>sum+count,0);
  game.slotsUsed={};game.resources={};game.dsOk=0;game.dsFail=0;
}
