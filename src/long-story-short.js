function longStoryShortExport(){
  const id=()=>`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g,char=>{const value=Math.random()*16|0;return (char==='x'?value:value&3|8).toString(16)});
  const objectId=()=>Array.from({length:24},()=>Math.floor(Math.random()*16).toString(16)).join('');
  const field=(name,value)=>({name,value}),textDoc=value=>({type:'doc',content:value?String(value).split('\n').map(line=>({type:'paragraph',content:line?[{type:'text',text:line}]:undefined})): [{type:'paragraph'}]});
  const characterClass=C.classes.map(item=>CLASSES[item.cls].name).join(' / '),subclass=C.classes.map(item=>SUBCLASSES[item.sub]?.name).filter(Boolean).join(' / '),race=raceOf(),subrace=race.subs?.[C.subrace],mainCaster=spellcasterClasses()[0],resourceId=`resource-${id()}`;
  const skills=Object.fromEntries(SKILLS.map(([skill,,ability])=>{
    const name=skill==='sleight'?'sleight of hand':skill==='animal'?'animal handling':skill;
    return [name,{baseStat:ability,name,...(profSkills().includes(skill)?{isProf:1}:{})}];
  }));
  const saves=Object.fromEntries(ABILS.map(([ability])=>[ability,{name:ability,isProf:saveMods()[ability].prof}]));
  const weapons=(C.inventory||[]).filter(item=>item.type==='weapon').map(item=>{
    const weapon=WEAPONS.find(row=>row[0]===item.id);return weapon?{id:`weapon-${id()}`,name:{value:weapon[1]},dmg:{value:weaponDamage(weapon,item)}}:null;
  }).filter(Boolean);
  const traitText=[...(race.traits||[]),...(subrace?.traits||[]),C.featuresNotes].filter(Boolean).join('\n');
  const attacksText=[...weapons.map(weapon=>`${weapon.name.value}: ${weapon.dmg.value}`),C.backstory,C.allies].filter(Boolean).join('\n'),attunements=(C.attunement||[]).filter(Boolean).map(value=>({id:`attunement-${id()}`,checked:false,value}));
  const data={
    jsonType:'character',template:'default',name:{value:C.name},
    info:{charClass:field('charClass',characterClass),charSubclass:field('charSubclass',subclass),level:field('level',totalLvl()),background:field('background',BACKGROUNDS[C.bg]?.name||''),playerName:field('playerName',''),race:field('race',`${race.name}${subrace?` (${subrace.name})`:''}`),alignment:field('alignment',C.align||''),experience:field('experience',C.xp?String(C.xp):'')},
    subInfo:{age:field('age',C.appearance.age&&Number.isFinite(Number(C.appearance.age))?Number(C.appearance.age):C.appearance.age||''),height:field('height',C.appearance.height||''),weight:field('weight',C.appearance.weight||''),eyes:field('eyes',C.appearance.eyes||''),skin:field('skin',C.appearance.skin||''),hair:field('hair',C.appearance.hair||'')},
    spellsInfo:{base:field('base',mainCaster?ABIL_RU_FULL[spellAbilityOf(mainCaster.cls)]||spellAbilityOf(mainCaster.cls):''),save:field('save',mainCaster?spellSaveDc(mainCaster.cls):''),mod:field('mod',mainCaster?spellAttack(mainCaster.cls):'')},
    spells:{},spellsPact:{},bonuses:[],proficiency:pb(),
    stats:Object.fromEntries(ABILS.map(([ability])=>[ability,{name:ability,score:abil(ability)}])),saves,skills,
    vitality:{'hp-dice-current':{value:Math.max(0,totalLvl()-(C.game.hdUsed||0))},'hp-dice-multi':{},darkvision:{value:raceDarkvision()},initiative:{value:initiative()},speed:{value:String(speed())}},
    attunementsList:attunements.length?attunements:[{id:`attunement-${id()}`,checked:false,value:''}],
    weaponsList:weapons.length?weapons:[{id:`weapon-${id()}`,name:{value:''},dmg:{value:''}}],
    text:{attacks:{value:{data:textDoc(attacksText)}},traits:{value:{data:{type:'doc',content:[{type:'resource',attrs:{id:resourceId,textName:'traits',source:null,sourceRev:null,removed:false}},{type:'paragraph'},...(traitText?[{type:'paragraph',content:[{type:'text',text:traitText}]}]:[]),{type:'spoiler',attrs:{open:false,source:null,sourceLabel:null,sourceRev:null,blockId:null,removed:false,tag:null,tone:null},content:[{type:'spoilerSummary'},{type:'spoilerContent',content:[{type:'paragraph'}]}]}]}}}},
    coins:{},resources:{[resourceId]:{id:resourceId,name:'',current:0,resolvedMax:1,location:'traits'}},conditions:(C.game.conditions||'').split(/[\n,]+/).map(value=>value.trim()).filter(Boolean),createdAt:new Date().toISOString()
  };
  const session=`${Date.now()}-${Math.random().toString(36).slice(2,12)}`;
  return {tags:[],rooms:[],disabledBlocks:{'info-left':[],'info-right':[],'subinfo-left':[],'subinfo-right':[],'notes-left':[],'notes-right':[],_id:objectId()},edition:'2024',sheetEdition:'2024',spells:{mode:'cards',prepared:[],book:[],slotless:[],edition:'2024',granted:[]},linkAccess:'view',data:JSON.stringify(data),lastWriterSessionId:session,wizard:{},jsonType:'character',version:'2'};
}
function exportLongStoryShortJson(){
  if(!validCharacter(C)){alert('Исправьте некорректные данные персонажа перед экспортом.');return}
  const blob=new Blob([JSON.stringify(longStoryShortExport(),null,1)],{type:'application/json'}),anchor=document.createElement('a');
  anchor.href=URL.createObjectURL(blob);anchor.download=`${(C.name||'character').replace(/[\\/:*?"<>|]/g,'_')}-long-story-short.json`;anchor.click();URL.revokeObjectURL(anchor.href);
}
