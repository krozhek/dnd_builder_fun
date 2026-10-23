const FOUNDRY_SKILLS={acrobatics:'acr',animal:'ani',arcana:'arc',athletics:'ath',deception:'dec',history:'his',insight:'ins',intimidation:'itm',investigation:'inv',medicine:'med',nature:'nat',perception:'prc',performance:'prf',persuasion:'per',religion:'rel',sleight:'slt',stealth:'ste',survival:'sur'};
const FOUNDRY_LANGUAGES={'Общий':'common','Дварфийский':'dwarvish','Эльфийский':'elvish','Великаний':'giant','Гномий':'gnomish','Гоблинский':'goblin','Полуросликов':'halfling','Орочий':'orc','Бездны':'abyssal','Небесный':'celestial','Драконий':'draconic','Глубинный':'deep','Инфернальный':'infernal','Первичный':'primordial','Сильван':'sylvan','Подземный':'undercommon'};
const FOUNDRY_SCHOOLS={'ограждение':'abj','преграждение':'abj','вызов':'con','прорицание':'div','очарование':'enc','воплощение':'evo','иллюзия':'ill','некромантия':'nec','преобразование':'trs'};
const FOUNDRY_DAMAGE={'дробящий':'bludgeoning','колющий':'piercing','рубящий':'slashing','кислотой':'acid','холодом':'cold','огнём':'fire','огнем':'fire','силовым полем':'force','молнией':'lightning','некротической энергией':'necrotic','ядом':'poison','психической энергией':'psychic','излучением':'radiant','громом':'thunder'};
function foundryId(){return Array.from({length:16},()=>Math.floor(Math.random()*16).toString(16)).join('')}
function foundryHtml(value){return esc(String(value||'')).replace(/\r?\n/g,'<br>')}
function foundryItem(name,type,system,img='icons/svg/item-bag.svg'){
  return {_id:foundryId(),name,type,img,system,effects:[],flags:{}};
}
function foundryDescription(value){return {value:value?`<p>${foundryHtml(value)}</p>`:'',chat:''}}
function foundryWeight(value){
  const match=String(value||'').match(/(\d+(?:[.,]\d+)?|\d+\/\d+|\d+½)\s*(?:фн|lb)?/i);
  if(!match)return 0;
  if(match[1].includes('/')){const [a,b]=match[1].split('/').map(Number);return b?a/b:0}
  return parseFloat(match[1].replace(',','.').replace('½','.5'))||0;
}
function foundryPrice(value){
  const match=String(value||'').match(/([\d.,]+)\s*(зм|см|мм)/);if(!match)return 0;
  const amount=parseFloat(match[1].replace(',','.'));
  return Math.round(amount*(match[2]==='зм'?1:match[2]==='см'?.1:.01)*100)/100;
}
function foundryPhysical(quantity,weight,price){return {quantity:quantity||1,weight:{value:foundryWeight(weight),units:'lb'},price:{value:foundryPrice(price),denomination:'gp'},rarity:''}}
function foundryWeaponProperties(text){
  const map=[['Боеприпас','amm'],['Фехтовальное','fin'],['Лёгкое','lgt'],['Тяжёлое','hvy'],['Заряжание','lod'],['Перезарядка','lod'],['Досягаемость','rch'],['Особое','spc'],['Метательное','thr'],['Двуручное','two'],['Универсальное','ver']];
  return map.filter(([label])=>text.includes(label)).map(([,key])=>key);
}
function foundryWeaponItem(item){
  const row=WEAPONS.find(w=>w[0]===item.id);if(!row)return foundryItem(itemName(item),'loot',{...foundryPhysical(item.qty),description:foundryDescription('Не удалось сопоставить данные оружия из конструктора.')});
  const [id,name,price,damage,weight,properties,rangeType,category]=row;
  const roll=damage.match(/(\d+)(?:к|d)(\d+)/i),damageType=Object.keys(FOUNDRY_DAMAGE).find(type=>damage.includes(type));
  const versatile=properties.match(/универсальное\s*\((\d+)[кd](\d+)\)/i);
  const damageParts=roll&&damageType?[[`${roll[1]}d${roll[2]}`,FOUNDRY_DAMAGE[damageType]]]:[];
  const distance=properties.match(/(?:боеприпас|метательное)\s*\((\d+)\s*\/\s*(\d+)\)/i);
  const type=`${category}${rangeType==='ranged'?'R':'M'}`;
  return foundryItem(name,'weapon',{
    description:foundryDescription(properties),type:{value:type,subtype:'',baseItem:id},...foundryPhysical(item.qty,weight,price),
    equipped:!!item.wielded,attunement:'',attuned:false,proficient:weaponProf(id)?1:0,magicalBonus:0,
    properties:foundryWeaponProperties(properties),actionType:rangeType==='ranged'?'rwak':'mwak',ability:null,
    attack:{bonus:'',flat:false},damage:{parts:damageParts,versatile:versatile?`${versatile[1]}d${versatile[2]}`:''},
    range:{value:distance?Number(distance[1]):0,long:distance?Number(distance[2]):0,units:distance?'ft':''}
  },'icons/svg/sword.svg');
}
function foundryEquipmentItem(item){
  const row=ARMORS.find(a=>a[0]===item.id);if(!row)return foundryItem(itemName(item),'loot',{...foundryPhysical(item.qty),description:foundryDescription('')});
  const [id,name,price,ac,dex,strength,stealth,weight,category]=row;
  const isShield=category==='shield',equipmentType=isShield?'shield':category;
  return foundryItem(name,'equipment',{
    description:foundryDescription(stealth==='помеха'?'Помеха к проверкам Скрытности.':''),type:{value:equipmentType,subtype:'',baseItem:id},
    ...foundryPhysical(item.qty,weight,price),equipped:!!item.equipped,attunement:'',attuned:false,
    armor:{value:ac,dex:dex===true?null:dex==='max2'?2:dex||0,magicalBonus:0},properties:[],
    speed:{value:0,conditions:''},strength:strength||0,proficient:armorProficient(id)?1:0
  },'icons/svg/shield.svg');
}
function foundryLootItem(item){
  const gear=GEAR.find(g=>g[0]===item.id),pack=PACKS[item.id];
  const description=gear?'':pack?.[0]||item.name||item.id;
  return foundryItem(itemName(item),'loot',{
    description:foundryDescription(description),type:{value:'',subtype:''},...foundryPhysical(item.qty,gear?.[3],gear?.[2])
  });
}
function foundrySpellItem(spell,cls,mode,prepared){
  const components=[],componentText=spell.comp.split('(')[0];
  if(componentText.includes('В'))components.push('vocal');
  if(componentText.includes('С'))components.push('somatic');
  if(componentText.includes('М'))components.push('material');
  const durationText=spell.dur.toLowerCase(),duration=spell.dur.match(/(\d+)\s*(?:раунд|round|минут|minut|час|hour|день|day)/i);
  const durationUnits=durationText.includes('раунд')||durationText.includes('round')?'round':durationText.includes('минут')||durationText.includes('minut')?'minute':durationText.includes('час')||durationText.includes('hour')?'hour':durationText.includes('день')||durationText.includes('day')?'day':durationText.includes('рассеян')?'disp':durationText.includes('сработает')?'dstr':durationText.includes('special')?'spec':'inst';
  if(spell.ritual)components.push('ritual');
  if(durationText.includes('концентрация')||durationText.includes('concentration'))components.push('concentration');
  const range=spell.range.match(/(\d+)\s*(?:фут|фт)/i),school=FOUNDRY_SCHOOLS[spell.school.toLowerCase()]||'evo';
  const time=spell.time.toLowerCase(),activationType=time.includes('бонус')?'bonus':time.includes('реакц')?'reaction':time.includes('мину')?'minute':time.includes('час')?'hour':'action';
  const material=spell.comp.match(/М\s*\(([^)]+)\)/i)?.[1]||'';
  return foundryItem(spell.ru,'spell',{
    description:foundryDescription(spell.full),level:spell.lvl,school,sourceClass:cls||'',properties:components,
    materials:{value:material,consumed:false,cost:0,supply:0},
    preparation:{mode,prepared:!!prepared},scaling:{mode:'none',formula:null},
    activation:{type:activationType,cost:1,condition:''},range:{value:range?Number(range[1]):0,long:0,units:range?'ft':spell.range.toLowerCase().includes('касание')?'touch':'self'},
    duration:{value:duration?Number(duration[1]):null,units:durationUnits}
  },'icons/svg/book.svg');
}
function foundrySpellItems(){
  const items=[],seen=new Set(),add=(id,cls,mode,prepared=false)=>{
    const spell=SPELLS.find(s=>s.id===id),key=`${id}:${cls||''}`;if(!spell||seen.has(key))return;seen.add(key);items.push(foundrySpellItem(spell,cls,mode,prepared));
  };
  C.classes.forEach(c=>{
    (C.cantrips[c.cls]||[]).forEach(id=>add(id,c.cls,'always',true));
    (C.spellsKnown[c.cls]||[]).forEach(id=>add(id,c.cls,'always',true));
    (C.spellsPrepared[c.cls]||[]).forEach(id=>add(id,c.cls,'prepared',true));
    if(c.cls==='wizard')(C.spellbook||[]).forEach(id=>add(id,c.cls,'prepared',(C.spellsPrepared[c.cls]||[]).includes(id)));
    domainSpellsOf(c).forEach(spell=>add(spell.id,c.cls,'always',true));
  });
  racialSpellEntries().forEach(({spell})=>add(spell.id,'','innate',true));
  primalAwarenessSpells().forEach(({id})=>add(id,'ranger','innate',true));
  Object.entries(C.arcanum||{}).forEach(([level,id])=>{if(id)add(id,'warlock','innate',true)});
  return items;
}
function foundryFeatureItems(){
  const features=[...availableFeats(),...chosenTashaFeatures()];
  for(const value of Object.values(C.asi||{}))if(value?.type==='feat'&&value.id){const feat=FEATS.find(row=>row[0]===value.id);if(feat)features.push({name:feat[1],desc:feat[2]})}
  const backgroundFeat=FEATS.find(row=>row[0]===BACKGROUNDS[C.bg]?.feat);if(backgroundFeat)features.push({name:backgroundFeat[1],desc:backgroundFeat[2]});
  const race=RACES[C.race],subrace=race.subs?.[C.subrace];
  for(const trait of [...(race.traits||[]),...(subrace?.traits||[])])features.push({name:trait,desc:''});
  const seen=new Set();
  return features.filter(feature=>{const key=`${feature.name}:${feature.desc}`;if(seen.has(key))return false;seen.add(key);return true})
    .map(feature=>foundryItem(feature.name,'feat',{description:foundryDescription(feature.desc),type:{value:'',subtype:''},requirements:''},'icons/svg/upgrade.svg'));
}
function foundryActorData(){
  if(!C)return null;
  const classes=C.classes.map(c=>{
    const id=foundryId(),data=CLASSES[c.cls],spellType=spellTypeOf(c)||'none';
    return {id,item:foundryItem(data.name,'class',{
      description:foundryDescription('Класс и уровень экспортированы из конструктора D&D 5e 2014.'),identifier:c.cls,levels:c.lvl,
      hitDice:`d${data.hd}`,hitDiceUsed:hitDiceUsedByClass()[c.cls]||0,advancement:[],startingEquipment:[],
      spellcasting:{progression:spellType,ability:spellType==='third'?spellAbilityOf(c.cls):data.spellAbility||''},wealth:''
    },'icons/svg/item-bag.svg')};
  });
  const classItems=classes.map(x=>{x.item._id=x.id;return x.item});
  const subclassItems=C.classes.filter(c=>SUBCLASSES[c.sub]).map(c=>foundryItem(SUBCLASSES[c.sub].name,'subclass',{
    description:foundryDescription((SUBCLASSES[c.sub].feats||[]).map(f=>`${f[0]} ур. ${f[1]}: ${f[2]}`).join('\n')),
    identifier:c.sub,classIdentifier:c.cls,advancement:[],spellcasting:{progression:'none',ability:''}
  },'icons/svg/item-bag.svg'));
  const inventory=(C.inventory||[]).map(item=>item.type==='weapon'?foundryWeaponItem(item):item.type==='armor'||item.type==='shield'?foundryEquipmentItem(item):foundryLootItem(item));
  const saves=saveMods(),abilityData={};
  ABILS.forEach(([id])=>abilityData[id]={value:abil(id),proficient:saves[id].prof?1:0});
  const skills={};
  SKILLS.forEach(([id,,ability])=>{
    const proficient=profSkills().includes(id),expert=expertiseSkills().includes(id),jack=C.classes.some(c=>c.cls==='bard'&&c.lvl>=2),athlete=C.classes.some(c=>c.cls==='fighter'&&c.sub==='champion'&&c.lvl>=7);
    const value=expert?2:proficient?1:jack||athlete&&['str','dex','con'].includes(ability)?0.5:0;
    skills[FOUNDRY_SKILLS[id]]={value,ability};
  });
  const levels=spellSlots()||[],spells={};
  levels.forEach((max,index)=>{if(max)spells[`spell${index+1}`]={value:Math.max(0,max-(C.game.slotsUsed?.[index]||0)),override:max}});
  const pact=pactSlots();if(pact)spells.pact={value:Math.max(0,pact.count-(C.game.pactUsed||0)),override:pact.count};
  const languages=[...new Set([...(raceOf().langs||[]),...(C.extraLangs||[]).filter(Boolean),...(C.languages||[])])];
  if(C.classes.some(c=>c.cls==='druid'))languages.push('Друидический');if(C.classes.some(c=>c.cls==='rogue'))languages.push('Воровской жаргон');
  const languageValues=languages.map(language=>FOUNDRY_LANGUAGES[language]).filter(Boolean);
  const specialLanguages=[...new Set(languages.filter(language=>!FOUNDRY_LANGUAGES[language]))].join('; ');
  const appearance=C.appearance||{},personality=C.personality||{},game=C.game||{},max=maxHp();
  const notes=[['Предыстория',C.backstory],['Союзники и организации',C.allies],['Цели',C.goals],['Дополнительные умения',C.featuresNotes],['Сокровища',C.treasure],['Владения инструментами',toolProficiencies().join(', ')],['Состояния',game.conditions],['Заметки',game.notes],['Настройка на магические предметы',(C.attunement||[]).filter(Boolean).join(', ')],['Использования классовых ресурсов',classResources().map(resource=>`${resource.name}: ${Math.max(0,resource.max-(game.resources?.[resource.id]||0))}/${resource.max}`).join('; ')],['Выборы конструктора',JSON.stringify(C.choices||{})]];
  const biography=notes.filter(([,text])=>text).map(([title,text])=>`<h3>${foundryHtml(title)}</h3><p>${foundryHtml(text)}</p>`).join('');
  const raceText=`${raceOf().name}${subraceOf()?` (${subraceOf().name})`:''}`;
  const copper=Math.round((C.gold||0)*100);
  const actor={
    name:C.name,type:'character',img:C.portrait||'icons/svg/mystery-man.svg',folder:null,sort:0,ownership:{default:0},flags:{},effects:[],
    system:{
      abilities:abilityData,attributes:{ac:{flat:armorClass(),calc:'flat',formula:''},hp:{value:game.hpCur==null?max:game.hpCur,max, temp:game.hpTemp||0,tempmax:0,bonuses:{level:'',overall:''}},death:{success:game.dsOk||0,failure:game.dsFail||0},inspiration:!!game.insp,exhaustion:game.exh||0,movement:{walk:speed(),burrow:0,climb:0,fly:0,swim:0,units:'ft',hover:false},init:{ability:'dex',bonus:initiative()===am('dex')?'':String(initiative()-am('dex'))},spellcasting:spellcasterClasses()[0]?spellAbilityOf(spellcasterClasses()[0].cls):'int'},
      details:{alignment:C.align,background:BACKGROUNDS[C.bg].name,race:raceText,originalClass:classes[0]?.id||'',xp:{value:C.xp||0},appearance:appearance.details||'',age:appearance.age||'',height:appearance.height||'',weight:appearance.weight||'',eyes:appearance.eyes||'',skin:appearance.skin||'',hair:appearance.hair||'',trait:personality.traits||'',ideal:personality.ideals||'',bond:personality.bonds||'',flaw:personality.flaws||'',biography:{value:biography,public:''}},
      traits:{size:{'Крошечный':'tiny','Маленький':'sm','Средний':'med','Большой':'lg','Огромный':'huge'}[C.size]||'med',weaponProf:{value:[],custom:weaponProficiencyText()},armorProf:{value:[],custom:armorProficiencyText()},languages:{value:languageValues,custom:specialLanguages}},
      skills,spells,currency:{pp:0,gp:Math.floor(copper/100),ep:0,sp:Math.floor(copper%100/10),cp:copper%10}
    },items:[...classItems,...subclassItems,...foundryFeatureItems(),...foundrySpellItems(),...inventory]
  };
  return actor;
}
function exportFoundryJson(){
  if(!validCharacter(C)){alert('Исправьте некорректные значения персонажа перед экспортом.');return}
  const blob=new Blob([JSON.stringify(foundryActorData(),null,1)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`${(C.name||'character').replace(/[\\/:*?"<>|]/g,'_')}-foundry-v12-dnd5e-3.3.1.json`;a.click();URL.revokeObjectURL(a.href);
}
