function isRecord(value){return !!value&&typeof value==='object'&&!Array.isArray(value)}
function hasUnsafeKeys(value){
  const pending=[value];
  while(pending.length){
    const item=pending.pop();
    if(Array.isArray(item)){for(const value of item)pending.push(value);continue}
    if(isRecord(item))for(const [key,child] of Object.entries(item)){if(['__proto__','constructor','prototype'].includes(key))return true;pending.push(child)}
  }
  return false;
}
function optionalRecord(value){return value==null||isRecord(value)}
function stringArray(value,allowBlank=false){return Array.isArray(value)&&value.every(x=>typeof x==='string'||(allowBlank&&(x===null||x==='')))}
function stringArrayMap(value){return value==null||isRecord(value)&&Object.values(value).every(v=>stringArray(v))}
function validSpellArray(value){return stringArray(value)&&value.every(id=>SPELL_IDS.has(id))&&new Set(value).size===value.length}
function validSpellArrayMap(value){return value==null||isRecord(value)&&Object.values(value).every(validSpellArray)}
function validRacialSpellChoices(ch){
  const choices={};
  if(ch.race==='astralelf')choices.astralelf=['dancing_lights','light','sacred_flame'];
  if(ch.race==='elf'&&ch.subrace==='high')choices.highelf=SPELLS.filter(s=>s.lvl===0&&s.cls.includes('wizard')).map(s=>s.id);
  return !ch.racialSpells||Object.entries(ch.racialSpells).every(([key,value])=>{
    if(key==='astralelfAbility')return ch.race==='astralelf'&&['int','wis','cha'].includes(value);
    if(key==='highelfAbility')return ch.race==='elf'&&ch.subrace==='high'&&value==='int';
    return Array.isArray(choices[key])&&choices[key].includes(value);
  });
}
function validSpellSelections(ch,enforceRules=true){
  const previous=C;C=ch;
  try{
    const classes=new Map(ch.classes.map(c=>[c.cls,c]));
    for(const [field,kind] of [['cantrips','cantrip'],['spellsKnown','known'],['spellsPrepared','prepared']]){
      for(const [cls,ids] of Object.entries(ch[field]||{})){
        const c=classes.get(cls);if(!c)return false;if(!ids.length)continue;
        if(!spellTypeOf(c)||kind==='prepared'&&!['cleric','druid','paladin','wizard'].includes(cls)||kind==='known'&&!classKnownLimit(c))return false;
        const limit=kind==='cantrip'?cantripLimit(cls):kind==='known'?knownLimit(cls):prepLimit(cls);
        const free=kind==='known'&&cls==='ranger'&&selectedTashaFeatures(c).some(feature=>feature[0]==='primal_awareness')?new Set(primalAwarenessSpells().map(spell=>spell.id)):new Set();
        if(enforceRules&&ids.filter(id=>!free.has(id)).length>limit)return false;
        if(ids.some(id=>{
          const spell=SPELLS.find(s=>s.id===id);
          return !spell||!spellClassAllowed(c,id)||(kind==='cantrip'?spell.lvl!==0:spell.lvl<1||spell.lvl>classMaxSpellLevel(c))||(kind==='prepared'&&cls==='wizard'&&!(ch.spellbook||[]).includes(id));
        }))return false;
        if(kind==='known'&&!thirdCasterSpellSelectionsValid(c,ids))return false;
      }
    }
    const wizard=classes.get('wizard');
    if((ch.spellbook||[]).length&&wizard&&ch.spellbook.some(id=>{
      const spell=SPELLS.find(s=>s.id===id);return !spell||spell.lvl<1||spell.lvl>classMaxSpellLevel(wizard)||!spellClassAllowed(wizard,id);
    }))return false;
    for(const [level,id] of Object.entries(ch.arcanum||{})){
      const spell=SPELLS.find(s=>s.id===id),warlock=classes.get('warlock'),maxLevel=warlock?(warlock.lvl>=17?9:warlock.lvl>=15?8:warlock.lvl>=13?7:warlock.lvl>=11?6:0):0;
      if(!warlock||!spell||+level!==spell.lvl||+level<6||+level>maxLevel||!spellClassAllowed(warlock,id))return false;
    }
    return validRacialSpellChoices(ch);
  }finally{C=previous}
}
function validRacialSpellChoices(ch){
  const choices={};
  if(ch.race==='astralelf')choices.astralelf=['dancing_lights','light','sacred_flame'];
  if(ch.race==='elf'&&ch.subrace==='high')choices.highelf=SPELLS.filter(s=>s.lvl===0&&s.cls.includes('wizard')).map(s=>s.id);
  return !ch.racialSpells||Object.entries(ch.racialSpells).every(([key,value])=>{
    if(key==='astralelfAbility')return ch.race==='astralelf'&&['int','wis','cha'].includes(value);
    if(key==='highelfAbility')return ch.race==='elf'&&ch.subrace==='high'&&value==='int';
    return Array.isArray(choices[key])&&choices[key].includes(value);
  });
}
function validGameState(ch,enforceRules=true){
  const game=ch.game;if(!game)return true;
  const previous=C;C=ch;
  try{
    if(!enforceRules){
      return !['hpCur','hpTemp','hdUsed','pactUsed','dsOk','dsFail','exh'].some(key=>game[key]!=null&&(!Number.isFinite(game[key])||game[key]<0))&&!Object.values(game.slotsUsed||{}).some(value=>!Number.isFinite(value)||value<0)&&!Object.values(game.resources||{}).some(value=>!Number.isFinite(value)||value<0);
    }
    if(['hpCur','hpTemp','hdUsed','pactUsed','dsOk','dsFail','exh'].some(key=>game[key]!=null&&(!Number.isInteger(game[key])||game[key]<0)))return false;
    if((game.dsOk||0)>3||(game.dsFail||0)>3||(game.exh||0)>6)return false;
    if(ch.schemaVersion>=6&&Object.hasOwn(game,'pactUsed'))return false;
    const slots=spellSlots()||[];
    if(Object.entries(game.slotsUsed||{}).some(([level,used])=>!/^[0-8]$/.test(level)||!Number.isInteger(used)||used<0||used>(slots[+level]||0)))return false;
    const resources=new Map(classResources().map(resource=>[resource.id,resource.max]));
    if(Object.entries(game.resources||{}).some(([id,used])=>!resources.has(id)||!Number.isInteger(used)||used<0||used>resources.get(id)))return false;
    const pact=pactSlots();if(game.pactUsed>0&&(!pact||game.pactUsed>pact.count))return false;
    return true;
  }finally{C=previous}
}
function validToolChoices(ch){
  const choices=ch.choices||{},background=backgroundToolChoiceGroups(ch.bg),backgroundPicks=choices.backgroundTools||[],raceTool=raceToolChoiceGroup(ch.race);
  if(raceTool&&(choices.raceTools!=null&&!raceTool.options.includes(choices.raceTools)))return false;
  if(!raceTool&&choices.raceTools)return false;
  if(backgroundPicks.length>background.choices.length||backgroundPicks.some((value,index)=>value&&!background.choices[index]?.options.includes(value)))return false;
  for(const [index,c] of ch.classes.entries()){
    const groups=classToolChoiceGroups(c,index),selected=(choices.classTools||{})[c.cls]||[],count=groups.reduce((n,g)=>n+g.count,0);
    if(selected.length>count||new Set(selected).size!==selected.length)return false;
    let offset=0;
    for(const group of groups){if(selected.slice(offset,offset+group.count).some(value=>!group.options.includes(value)))return false;offset+=group.count}
  }
  return true;
}
function featPrerequisitesValid(ch,id){const previous=C;C=ch;try{return !featPrerequisiteError(id)}finally{C=previous}}
function validAsiChoices(ch){
  const asi=ch.asi||{},need=ch.classes.reduce((total,c)=>total+CLASSES[c.cls].asiLvls.filter(level=>level<=c.lvl).length,0),abilities=new Set(ABILS.map(([id])=>id)),feats=Object.values(asi).filter(value=>value?.type==='feat'&&value.id).map(value=>value.id);
  if(new Set(feats).size!==feats.length)return false;
  return Object.entries(asi).length<=need&&Object.entries(asi).every(([key,value])=>{
    const index=/^asi(\d+)$/.exec(key);
    if(!index||key!==`asi${+index[1]}`||+index[1]>=need)return false;
    if(Array.isArray(value))return (value.length===0||value.length===2)&&value.every(id=>abilities.has(id));
    if(!isRecord(value))return false;
    if(value.type==='asi')return Array.isArray(value.vals)&&(value.vals.length===0||value.vals.length===2)&&value.vals.every(id=>abilities.has(id));
    if(value.type==='feat'){
      const feat=FEATS.find(([id])=>id===value.id);
      return typeof value.id==='string'&&(value.id===''||!!feat&&featPrerequisitesValid(ch,value.id))&&(!value.bonus||!!feat?.[3]?.includes(value.bonus))&&(!value.bonus||typeof value.bonus==='string');
    }
    return false;
  });
}
function validMulticlassCharacter(ch){
  if(ch.classes.length<2)return true;
  const previous=C;
  try{
    C=ch;
    return ch.classes.every((c,index)=>index===0||!multiclassRequirementError(c.cls,index));
  }finally{C=previous}
}
function pointBuySpent(values){return ABILS.reduce((sum,[id])=>sum+(POINT_COST[values[id]??8]??0),0)}
function validAbilityBases(ch){
  if(!ch.bases)return true;
  const method=ch.abilityMethod||'standard',values=ch.bases[method]||{},abilities=new Set(ABILS.map(([id])=>id));
  if(Object.keys(values).some(id=>!abilities.has(id)))return false;
  const scores=ABILS.map(([id],index)=>values[id]??(method==='standard'?STD_SET[index]:method==='point'?8:10));
  if(scores.some(score=>!Number.isInteger(score)))return false;
  if(method==='standard')return scores.every(score=>STD_SET.includes(score))&&new Set(scores).size===STD_SET.length;
  if(method==='point')return scores.every(score=>Object.hasOwn(POINT_COST,score))&&pointBuySpent(Object.fromEntries(ABILS.map(([id],index)=>[id,scores[index]])))<=27;
  return scores.every(score=>score>=3&&score<=18);
}
function abilityViolationScore(ch){
  const method=ch.abilityMethod||'standard',values=ch.bases?.[method]||{},keys=Object.keys(values),scores=ABILS.map(([id],index)=>values[id]??(method==='standard'?STD_SET[index]:method==='point'?8:10));
  const invalidKeys=keys.filter(id=>!ABILS.some(([ability])=>ability===id)).length;
  if(method==='point')return invalidKeys*1000+scores.filter(score=>!Object.hasOwn(POINT_COST,score)).length*1000+Math.max(0,pointBuySpent(Object.fromEntries(ABILS.map(([id],index)=>[id,scores[index]])))-27);
  if(method==='standard')return invalidKeys+scores.filter(score=>!STD_SET.includes(score)).length+Math.max(0,STD_SET.length-new Set(scores).size);
  return invalidKeys+scores.filter(score=>!Number.isInteger(score)||score<3||score>18).length;
}
function validExtraLanguages(ch){
  const race=RACES[ch.race]||RACES.human,sub=race.subs?.[ch.subrace],racialCount=(race.extraLang||0)+(sub?.extraLang||0),used=new Set(raceKnownLanguages(ch.race,ch.subrace));
  for(const [index,value] of (ch.extraLangs||[]).entries()){
    if(!value)continue;
    if(!LANGS.includes(value)||index<racialCount&&!raceExtraLanguageOptions(index,ch.race,ch.subrace).includes(value)||used.has(value))return false;
    used.add(value);
  }
  return true;
}
function validRacialAbilityChoices(ch){
  const abilities=new Set(ABILS.map(([id])=>id)),raceId=ch.race||'human',subraceId=ch.subrace||'',flexible=ch.raceAsiPicks||[],halfElf=ch.halfElfPicks||[],isFlexible=raceFlexibleAsi(raceId,subraceId),choice=raceAsiChoice(raceId,subraceId);
  if(isFlexible){
    const mode=ch.raceAsiMode||'two',limit=mode==='three'?3:2;
    if(!['two','three'].includes(mode)||flexible.length>limit||flexible.some(id=>id!==''&&!abilities.has(id))||new Set(flexible.filter(Boolean)).size!==flexible.filter(Boolean).length)return false;
  }else if(flexible.some(Boolean))return false;
  if(choice){
    if(halfElf.length>choice.count||halfElf.some(id=>!abilities.has(id)||choice.exclude.includes(id))||new Set(halfElf).size!==halfElf.length)return false;
  }else if(halfElf.length)return false;
  return true;
}
function validSkillChoices(ch){
  const previous=C;
  try{
    C=ch;
    const validIds=new Set(SKILLS.map(([id])=>id)),map=ch.classSkills||{},racePicks=ch.raceSkills||[],racialSkills=raceFixedSkillProfs(),raceOptions=raceSkillChoiceOptions(),raceLimit=raceSkillChoiceCount(),prof=new Set([...bgSkills(),...racialSkills]);
    if(Object.keys(map).some(cls=>!ch.classes.some(c=>c.cls===cls)))return false;
    if(Object.values(map).some(picks=>new Set(picks).size!==picks.length||picks.some(id=>!validIds.has(id))))return false;
    if(racePicks.length>raceLimit||new Set(racePicks).size!==racePicks.length||racePicks.some(id=>!raceOptions.includes(id)||prof.has(id)))return false;
    racePicks.forEach(id=>prof.add(id));
    for(const [index,c] of ch.classes.entries()){
      const picks=map[c.cls]||[],allowed=CLASSES[c.cls].skillList,count=classSkillChoiceCount(index,c.cls);
      if(picks.length>count||picks.some(id=>!allowed.includes(id)||prof.has(id)))return false;
      picks.forEach(id=>prof.add(id));
    }
    const deftSkill=(ch.choices||{}).deftExplorerSkill,expertise=ch.expertise||[],expertiseLimit=expertiseAvailable()-(deftExplorerActive()?1:0);
    return (!deftSkill||validIds.has(deftSkill)&&prof.has(deftSkill))&&expertise.length<=expertiseLimit&&new Set(expertise).size===expertise.length&&expertise.every(id=>validIds.has(id)&&prof.has(id)&&id!==deftSkill);
  }finally{C=previous}
}
const CHARACTER_ID_RE=/^[A-Za-z0-9_-]{1,64}$/;
function validWarlockInvocations(ch){
  const selected=ch.choices?.invocations||[],warlock=ch.classes.find(c=>c.cls==='warlock');
  return Array.isArray(selected)&&new Set(selected).size===selected.length&&(!selected.length||!!warlock&&selected.length<=(TABLES.warlock.invocations[warlock.lvl-1]||0)&&selected.every(id=>{
    if(!INVOCATIONS.some(([option])=>option===id))return false;
    const requirement=INVOCATION_PREREQUISITES[id]||{};
    return warlock.lvl>=Math.max(2,requirement.level||0)&&(!requirement.pact||ch.choices?.pactBoon===requirement.pact);
  }));
}
function validCharacterTransition(ch,previous){
  if(!validCharacter(ch,false)||ch.name.length>100&&ch.name!==previous?.name)return false;
  const checks=[validAbilityBases,validRacialAbilityChoices,validAsiChoices,validMulticlassCharacter,validSkillChoices],current=checks.map(check=>check(ch));
  if(!previous)return current.every(Boolean);
  const old=checks.map(check=>check(previous)),snapshots=[
    character=>({abilityMethod:character.abilityMethod,bases:character.bases}),
    character=>({race:character.race,subrace:character.subrace,raceAsiMode:character.raceAsiMode,raceAsiPicks:character.raceAsiPicks,halfElfPicks:character.halfElfPicks}),
    character=>({classes:character.classes,asi:character.asi}),
    character=>({classes:character.classes,bases:character.bases,asi:character.asi,race:character.race,subrace:character.subrace,raceAsiMode:character.raceAsiMode,raceAsiPicks:character.raceAsiPicks,halfElfPicks:character.halfElfPicks}),
    character=>({classes:character.classes,race:character.race,subrace:character.subrace,bg:character.bg,classSkills:character.classSkills,raceSkills:character.raceSkills,expertise:character.expertise,choices:{deftExplorerSkill:character.choices?.deftExplorerSkill,tashaFeatures:character.choices?.tashaFeatures}})
  ];
  return current.every((valid,index)=>valid||!old[index]&&(index===0?abilityViolationScore(ch)<=abilityViolationScore(previous):JSON.stringify(snapshots[index](ch))===JSON.stringify(snapshots[index](previous))));
}
function validCharacter(ch,enforceRules=true,diagnostic=null){
  const fail=reason=>{if(diagnostic)diagnostic.reason=reason;return false};
  if(diagnostic)diagnostic.reason='';
  if(!isRecord(ch)||hasUnsafeKeys(ch)||typeof ch.name!=='string'||enforceRules&&ch.name.length>100||!Array.isArray(ch.classes)||!ch.classes.length)return fail('Повреждены основные поля персонажа.');
  if(ch.id!=null&&ch.id!==''&&(typeof ch.id!=='string'||!CHARACTER_ID_RE.test(ch.id)))return fail('Некорректный идентификатор персонажа.');
  if(ch.schemaVersion!=null&&(!Number.isInteger(ch.schemaVersion)||ch.schemaVersion<1||ch.schemaVersion>CHARACTER_SCHEMA))return fail('Неподдерживаемая версия схемы персонажа.');
  if(ch.classes.some(c=>!isRecord(c)||!CLASSES[c.cls]||!Number.isInteger(c.lvl)||c.lvl<1||c.lvl>20||(c.sub!=null&&(typeof c.sub!=='string'||c.sub!==''&&SUBCLASSES[c.sub]?.cls!==c.cls))))return fail('Некорректный класс, уровень или подкласс.');
  if(ch.classes.reduce((sum,c)=>sum+c.lvl,0)>20||new Set(ch.classes.map(c=>c.cls)).size!==ch.classes.length)return fail('Уровни классов превышают лимит или класс повторяется.');
  if(ch.race!=null&&!RACES[ch.race]||ch.bg!=null&&!BACKGROUNDS[ch.bg]||ch.subrace!=null&&ch.subrace!==''&&!RACES[ch.race]?.subs?.[ch.subrace])return fail('Неизвестная раса, подраса или предыстория.');
  if(enforceRules&&ch.size!=null&&!raceSizeOptions(ch.race,ch.subrace).includes(ch.size))return fail('Недопустимый размер для выбранной расы.');
  if(ch.abilityMethod!=null&&!['standard','point','manual'].includes(ch.abilityMethod))return fail('Неизвестный способ задания характеристик.');
  if(ch.xp!=null&&(!Number.isFinite(ch.xp)||ch.xp<0)||ch.gold!=null&&(!Number.isFinite(ch.gold)||ch.gold<0))return fail('Некорректное значение опыта или золота.');
  if(ch.goals!=null&&(typeof ch.goals!=='string'||ch.goals.length>5000))return fail('Некорректный текст целей персонажа.');
  if(ch.portrait!=null&&(typeof ch.portrait!=='string'||ch.portrait.length>MAX_PORTRAIT_DATA||ch.portrait!==''&&!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(ch.portrait)))return fail('Некорректный файл портрета.');
  if(ch.appearance!=null&&(!isRecord(ch.appearance)||Object.entries(ch.appearance).some(([key,value])=>!['age','height','weight','eyes','skin','hair','details'].includes(key)||typeof value!=='string'||value.length>500)))return fail('Некорректные поля внешности.');
  for(const key of ['bases','asi','choices','classSkills','cantrips','spellsKnown','spellsPrepared','arcanum','racialSpells','equipChoice','game','personality','appearance'])if(!optionalRecord(ch[key]))return fail(`Некорректная структура поля «${key}».`);
  for(const key of ['raceSkills','halfElfPicks','raceAsiPicks','expertise','languages','attunement'])if(ch[key]!=null&&!stringArray(ch[key]))return fail(`Некорректный список «${key}».`);
  if(ch.extraLangs!=null&&(!stringArray(ch.extraLangs,true)||ch.extraLangs.length>LANGS.length||ch.extraLangs.some(value=>value&&(!LANGS.includes(value)||value.length>32))||!validExtraLanguages(ch)))return fail('Некорректный дополнительный язык.');
  if(!stringArrayMap(ch.classSkills)||!validSpellArrayMap(ch.cantrips)||!validSpellArrayMap(ch.spellsKnown)||!validSpellArrayMap(ch.spellsPrepared)||!validSpellSelections(ch,enforceRules))return fail('Некорректный выбор навыка или заклинания.');
  if(ch.spellbook!=null&&!validSpellArray(ch.spellbook))return fail('Некорректный список заклинаний в книге.');
  if(ch.arcanum&&Object.values(ch.arcanum).some(id=>!SPELL_IDS.has(id)))return fail('Некорректный выбор мистического арканума.');
  if(ch.bases&&Object.values(ch.bases).some(values=>!isRecord(values)||Object.values(values).some(v=>!Number.isFinite(v))))return fail('Некорректные базовые характеристики.');
  if(ch.asi&&Object.values(ch.asi).some(v=>!(isRecord(v)||Array.isArray(v))))return fail('Некорректная структура улучшений характеристик.');
  if(enforceRules&&(!validAbilityBases(ch)||!validRacialAbilityChoices(ch)||!validAsiChoices(ch)||!validMulticlassCharacter(ch)))return fail('Нарушены правила характеристик или мультиклассирования.');
  if(ch.choices&&((ch.choices.metamagic!=null&&!stringArray(ch.choices.metamagic))||(ch.choices.invocations!=null&&!stringArray(ch.choices.invocations))||(ch.choices.tashaFeatures!=null&&!stringArrayMap(ch.choices.tashaFeatures))||(ch.choices.classTools!=null&&!stringArrayMap(ch.choices.classTools))||(ch.choices.backgroundTools!=null&&!stringArray(ch.choices.backgroundTools))||(ch.choices.deftExplorerSkill!=null&&typeof ch.choices.deftExplorerSkill!=='string')||(ch.choices.deftExplorerMode!=null&&!['two_languages','language_tool'].includes(ch.choices.deftExplorerMode))||(ch.choices.deftExplorerTool!=null&&!TOOL_PROFICIENCIES.includes(ch.choices.deftExplorerTool))||!validToolChoices(ch)))return fail('Некорректный выбор класса, инструмента или опционального умения.');
  if(ch.choices&&(ch.choices.pactBoon!=null&&(!['blade','chain','tome','talisman'].includes(ch.choices.pactBoon)||!ch.classes.some(c=>c.cls==='warlock'&&c.lvl>=3))||!validWarlockInvocations(ch)))return fail('Некорректный выбор договора или таинственных воззваний.');
  if(ch.choices&&ch.choices.fightingStyles!=null&&(!isRecord(ch.choices.fightingStyles)||Object.entries(ch.choices.fightingStyles).some(([key,value])=>{
    const options=key==='championExtra'?FIGHTING_STYLES.fighter:FIGHTING_STYLES[key];
    return !options||typeof value!=='string'||(value!==''&&!options.some(([id])=>id===value));
  })))return fail('Некорректный боевой стиль.');
  if(ch.racialSpells&&!validRacialSpellChoices(ch))return fail('Некорректное расовое заклинание.');
  if(ch.game&&(!optionalRecord(ch.game.slotsUsed)||!optionalRecord(ch.game.resources)||!['conditions','notes'].every(key=>ch.game[key]==null||typeof ch.game[key]==='string')||ch.game.insp!=null&&typeof ch.game.insp!=='boolean'||!validGameState(ch,enforceRules)))return fail('Некорректное состояние игровых ресурсов.');
  if(ch.game?.hdUsedByClass!=null&&(!isRecord(ch.game.hdUsedByClass)||Object.entries(ch.game.hdUsedByClass).some(([cls,count])=>!ch.classes.some(c=>c.cls===cls)||!Number.isInteger(count)||count<0||count>ch.classes.find(c=>c.cls===cls).lvl)))return fail('Некорректное распределение использованных костей хитов.');
  if(ch.game&&(ch.game.hdUsed||0)>ch.classes.reduce((sum,c)=>sum+c.lvl,0))return fail('Использовано больше костей хитов, чем уровней классов.');
  if(ch.personality&&Object.values(ch.personality).some(v=>typeof v!=='string'))return fail('Некорректные личные качества персонажа.');
  if(ch.inventory!=null&&(!Array.isArray(ch.inventory)||ch.inventory.some(i=>!isRecord(i)||(i.type!=null&&typeof i.type!=='string')||(i.id!=null&&typeof i.id!=='string')||(i.qty!=null&&(!Number.isFinite(i.qty)||i.qty<0))||(i.equipped!=null&&typeof i.equipped!=='boolean')||(i.wielded!=null&&typeof i.wielded!=='boolean')||(i.grip!=null&&!['one-handed','two-handed'].includes(i.grip))||(i.type==='weapon'&&i.wielded&&i.qty>1))))return fail('Некорректная запись снаряжения.');
  if(enforceRules&&!validSkillChoices(ch))return fail('Нарушены правила выбора навыков и компетентностей.');
  return true;
}
