// ================= Рендер интерфейса =================
const TABS=[['home','Герои'],['main','Основное'],['abil','Характеристики'],['skills','Навыки','Здесь выбираются владения навыками (от класса, расы, предыстории) и компетентность плута/барда.\nКаждое владение добавляет бонус мастерства к проверкам навыка, меняет модификаторы в быстрых проверках (Игра) и на листе персонажа.'],['cls','Класс'],['spells','Заклинания'],['equip','Снаряжение'],['game','Игра'],['sheet','Лист']];
function setTab(t){TAB=t;render();window.scrollTo(0,0)}
function setField(k,v){C[k]=v;persist()}
function setText(k,v){C[k]=v;persist()} // без ререндера
function setNested(k,sub,v){C[k][sub]=v;persist()}
function setChoice(k,v){C.choices[k]=v;persist();render()}
function toggleTheme(){THEME=THEME==='dark'?'light':'dark';writeStorage(LS_THEME,THEME);applyTheme()}
function applyTheme(){document.documentElement.dataset.theme=THEME;const b=$('#themeBtn');if(b)b.textContent=THEME==='dark'?'☀️ Светлая тема':'🌙 Тёмная тема'}

function render(){
  applyTheme();
  const app=$('#app');
  if(!app.dataset.characterActions){
    app.addEventListener('click',event=>{
      const button=event.target.closest('[data-character-action]');if(!button)return;
      const {characterAction:action,characterId:id}=button.dataset;
      if(action==='open')openChar(id);else if(action==='duplicate')dupChar(id);else if(action==='delete')delChar(id);
    });
    app.dataset.characterActions='bound';
  }
  if(!C){TAB='home'}
  let h=`<header class="topbar">
    <div class="brand" onclick="goHome()">⚔️ <b>D&D 5e 2014</b> · Конструктор персонажей</div>
    <div class="top-actions">
      <button class="btn ghost" id="themeBtn" onclick="toggleTheme()"></button>
      ${C?`<button class="btn ghost" onclick="exportJson()">⬇ JSON</button>
      <label class="btn ghost" for="importFile">⬆ Импорт</label><input type="file" id="importFile" accept=".json" hidden onchange="importJson(this)">`:''}
    </div>
  </header>`;
  if(C){
    h+=`<nav class="tabs">${TABS.map(([id,name,tip])=>{
      if(id==='home')return '';
      const dis=(id==='game'||id==='sheet')&&!C.classes.length?' disabled':'';
      return `<button class="tab${TAB===id?' active':''}${dis}"${tip?` data-tip="${tip}"`:''} onclick="setTab('${id}')">${name}</button>`}).join('')}
      <span class="tab-char">${esc(C.name)} · ${C.classes.map(c=>CLASSES[c.cls].name+' '+c.lvl).join(' / ')} · ${esc(raceOf().name)}</span>
    </nav>`;
  }
  h+='<main id="main" class="tab-'+TAB+'">'+renderTab()+'</main>';
  const openDet=[...document.querySelectorAll('details.spell-lvl[open],details.shop-sec[open]')].map(d=>d.dataset.key);
  app.innerHTML=h;
  applyTheme();
  if(TAB==='spells')filterSpellRows();
  openDet.forEach(k=>{const d=document.querySelector(`details[data-key="${k}"]`);if(d)d.open=true});
  if(TAB==='game')drawGameTrackers();
}
function goHome(){persist();C=null;TAB='home';render()}

function renderTab(){
  switch(TAB){
    case 'home':return renderHome();
    case 'main':return renderMain();
    case 'abil':return renderAbil();
    case 'skills':return renderSkills();
    case 'cls':return renderClass();
    case 'spells':return renderSpells();
    case 'equip':return renderEquip();
    case 'game':return renderGame();
    case 'sheet':return renderSheet();
  }
  return '';
}

// ---------- Библиотека ----------
function renderHome(){
  const cards=LIB.map(c=>{
    const cls=(c.classes||[]).map(x=>`${CLASSES[x.cls]?CLASSES[x.cls].name:x.cls} ${x.lvl}`).join(' / ');
    const race=RACES[c.race]?RACES[c.race].name:(c.race||'—');
    return `<div class="card char-card">
      <div class="char-card-name">${esc(c.name)}</div>
      <div class="muted">${esc(race)} · ${esc(cls)}</div>
      <div class="muted small">изменён: ${new Date(c.updated||c.created).toLocaleString('ru')}</div>
      <div class="row gap wrap">
        <button class="btn" data-character-action="open" data-character-id="${esc(c.id)}">Открыть</button>
        <button class="btn ghost" data-character-action="duplicate" data-character-id="${esc(c.id)}">Дублировать</button>
        <button class="btn danger ghost" data-character-action="delete" data-character-id="${esc(c.id)}">Удалить</button>
      </div>
    </div>`}).join('');
  return `<div class="page">
    <h1>Мои герои</h1>
    <div class="row gap wrap">
      <button class="btn primary" onclick="createChar()">＋ Новый персонаж</button>
      <button class="btn ghost" onclick="exportLibrary()" ${LIB.length?'':'disabled'}>⬇ Резервная копия</button>
      <label class="btn" for="importFile2">⬆ Импорт персонажа / копии</label><input type="file" id="importFile2" accept=".json" hidden onchange="importJson(this)">
    </div>
    <div class="grid cards">${cards||'<p class="muted">Пока пусто. Создайте первого героя!</p>'}</div>
    <footer class="foot muted small">D&D 5e (2014) · SRD 5.1 и дополнительные материалы PHB/«Котла Таши»/AAG · источники: README · Работает офлайн, данные хранятся в браузере</footer>
  </div>`;
}
function createChar(){C=newChar();persist();TAB='main';render()}
function dupChar(id){
  const f=LIB.find(c=>c.id===id);if(!f)return;
  const copy=JSON.parse(JSON.stringify(f));
  copy.id=uid();copy.name=f.name+' (копия)';copy.updated=Date.now();
  LIB.push(copy);saveLib();render();
}
function delChar(id){
  const f=LIB.find(c=>c.id===id);
  if(!confirm('Удалить персонажа «'+(f?f.name:'')+'»?'))return;
  LIB=LIB.filter(c=>c.id!==id);saveLib();render();
}
function exportJson(){
  if(!validCharacter(C)){alert('Исправьте некорректные значения персонажа перед экспортом.');return}
  const blob=new Blob([JSON.stringify(C,null,1)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=(C.name||'character').replace(/[\\/:*?"<>|]/g,'_')+'.json';
  a.click();URL.revokeObjectURL(a.href);
}
function exportLibrary(){
  if(!LIB.every(c=>validCharacter(c))){alert('В библиотеке есть некорректный персонаж; резервная копия не создана.');return}
  const backup={format:'dnd-builder-backup',version:1,exportedAt:new Date().toISOString(),characters:LIB};
  const blob=new Blob([JSON.stringify(backup,null,1)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`dnd-builder-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();URL.revokeObjectURL(a.href);
}
function importJson(inp){
  const f=inp.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const data=JSON.parse(r.result);
      if(data&&data.format==='dnd-builder-backup'){
        if(data.version!==1||!Array.isArray(data.characters)||!data.characters.every(validCharacter)||!hasUniqueCharacterIds(data.characters))throw new Error('Некорректная резервная копия');
        if(!confirm(`Заменить текущую библиотеку резервной копией (${data.characters.length} персонажей)?`)){inp.value='';return}
        const previous=LIB;
        LIB=data.characters.map(migrate);
        if(!saveLib(true)){LIB=previous;return}
        C=null;TAB='home';render();
        alert(`Восстановлено персонажей: ${LIB.length}`);
      }else{
        if(!validCharacter(data))throw new Error('Файл не содержит корректного персонажа или резервной копии');
        const ch=migrate(data);
        ch.id=uid();ch.updated=Date.now();
        LIB.push(ch);if(!saveLib()){LIB.pop();return}
        if(C&&TAB!=='home'){openChar(ch.id)}else{render()}
        alert('Персонаж «'+ch.name+'» импортирован');
      }
    }catch(e){alert('Не удалось прочитать файл: '+e.message)}
    inp.value='';
  };
  r.readAsText(f);
}

// ---------- Основное ----------
function baseLanguageChoiceCount(){const r=raceOf(),s=subraceOf(),bg=BACKGROUNDS[C.bg]||{};return (r.extraLang||0)+(s?.extraLang||0)+(bg.langs||0)}
function languageChoiceCount(){const mode=C.choices.deftExplorerMode;return baseLanguageChoiceCount()+(deftExplorerActive()?(mode==='two_languages'?2:mode==='language_tool'?1:0):0)}
function setExtraLang(index,value){C.extraLangs=C.extraLangs||[];while(C.extraLangs.length<=index)C.extraLangs.push('');C.extraLangs[index]=value;persist();render()}
function languageChoiceFields(){
  const r=raceOf(),langs=C.extraLangs||[],base=baseLanguageChoiceCount();
  return Array.from({length:languageChoiceCount()},(_,i)=>{
    const selected=langs[i]||'',used=[...(r.langs||[]),...langs.filter((l,j)=>j!==i&&l)],label=i>=base?`Язык «Искусного исследователя» ${i-base+1}`:`Язык на выбор ${i+1}`;
    return `<label>${label}<select onchange="setExtraLang(${i},this.value)"><option value="">— выберите —</option>${LANGS.filter(l=>!used.includes(l)||l===selected).map(l=>`<option${selected===l?' selected':''}>${l}</option>`).join('')}</select></label>`;
  }).join('');
}
function backgroundToolChoiceFields(){
  const groups=backgroundToolChoiceGroups(),selected=C.choices.backgroundTools||[];
  return groups.choices.map((group,index)=>`<label>${group.label}<select onchange="setBackgroundToolChoices(${index},this)"><option value="">— выберите —</option>${group.options.map(tool=>`<option value="${esc(tool)}"${selected[index]===tool?' selected':''}>${esc(tool)}</option>`).join('')}</select></label>`).join('');
}
function classToolChoiceFields(c,index){
  return classToolChoiceGroups(c,index).map(group=>{
    const selected=(C.choices.classTools||{})[c.cls]||[],count=classToolChoiceGroups(c,index).reduce((n,g)=>n+g.count,0);
    return `<label>${group.label}<select multiple size="${Math.min(4,group.options.length)}" onchange="setClassToolChoices('${c.cls}',this)">${group.options.map(tool=>`<option value="${esc(tool)}"${selected.includes(tool)?' selected':''}>${esc(tool)}</option>`).join('')}</select><span class="muted small">Выбрано ${selected.length}/${count}</span></label>`;
  }).join('');
}
function setBackgroundToolChoices(index,select){
  const groups=backgroundToolChoiceGroups().choices;
  C.choices.backgroundTools=C.choices.backgroundTools||[];
  C.choices.backgroundTools[index]=groups[index]?.options.includes(select.value)?select.value:'';persist();render();
}
function setClassToolChoices(cls,select){
  const index=C.classes.findIndex(c=>c.cls===cls),groups=index<0?[]:classToolChoiceGroups(C.classes[index],index),max=groups.reduce((n,g)=>n+g.count,0);
  C.choices.classTools=C.choices.classTools||{};C.choices.classTools[cls]=[...select.selectedOptions].map(option=>option.value).slice(0,max);persist();render();
}
function renderMain(){
  const r=raceOf(), s=subraceOf();
  const raceOpts=Object.entries(RACES).map(([id,x])=>`<option value="${id}"${C.race===id?' selected':''}>${x.name}${x.src?' ('+x.src+')':''}</option>`).join('');
  const subOpts=r.subs?`<label>Подраса<select onchange="setField('subrace',this.value);render()"><option value="">—</option>${Object.entries(r.subs).map(([id,x])=>`<option value="${id}"${C.subrace===id?' selected':''}>${x.name}</option>`).join('')}</select>`:'';
  const bgOpts=Object.entries(BACKGROUNDS).map(([id,x])=>`<option value="${id}"${C.bg===id?' selected':''}>${x.name}${x.src?' ('+x.src+')':''}</option>`).join('');
  const bg=BACKGROUNDS[C.bg];
  let classRows=C.classes.map((c,i)=>`
    <div class="card class-row">
      <div class="row gap wrap">
        <label>Класс<select onchange="changeClass(${i},this.value)">${Object.entries(CLASSES).map(([id,x])=>`<option value="${id}"${c.cls===id?' selected':''}>${x.name}</option>`).join('')}</select></label>
        <label>Уровень<select onchange="changeLvl(${i},this.value)">${Array.from({length:20},(_,l)=>`<option value="${l+1}"${c.lvl===l+1?' selected':''}>${l+1}</option>`).join('')}</select></label>
        ${CLASSES[c.cls].sub?`<label>Подкласс<select onchange="changeSub(${i},this.value)">${subclassOpts(c)}</select></label>`:''}
        ${C.classes.length>1?`<button class="btn danger ghost" onclick="removeClass(${i})">✕</button>`:''}
      </div>
      ${c.lvl<CLASSES[c.cls].subLvl?`<div class="warn small">Подкласс открывается на ${CLASSES[c.cls].subLvl} уровне</div>`:''}
      ${classToolChoiceFields(c,i)}
    </div>`).join('');
  return `<div class="page"><h1>Основное</h1>
    ${renderReadiness()}
    <div class="grid two">
      <div class="card">
        <h3>Личность</h3>
        <label>Имя персонажа<input maxlength="100" value="${esc(C.name)}" oninput="setText('name',this.value);updTabChar()"></label>
        <div class="grid two">
          <label>Раса<select onchange="changeRace(this.value)">${raceOpts}</select></label>
          ${subOpts||'<span></span>'}
        </div>
        ${C.race==='dragonborn'?`<label>Прародитель-дракон<select onchange="setField('dragonColor',this.value);render()">${DRAGONS.map((d,i)=>`<option value="${['black','blue','brass','bronze','copper','gold','green','red','silver','white'][i]}"${C.dragonColor===['black','blue','brass','bronze','copper','gold','green','red','silver','white'][i]?' selected':''}>${d[0][0].toUpperCase()+d[0].slice(1)} (${d[1]}, ${d[2]})</option>`).join('')}</select>`:''}
        <label>Предыстория<select onchange="changeBackground(this.value)">${bgOpts}</select></label>
        ${backgroundToolChoiceFields()}
        <div class="bg-desc" onclick="openBgModal('${C.bg}')">📖 ${esc(bg.name)}${bg.src?' ('+bg.src+')':''} — нажмите для описания</div>
        <div class="grid two">
          <label>Мировоззрение<select onchange="setField('align',this.value)">${ALIGN.map(a=>`<option${C.align===a?' selected':''}>${a}</option>`).join('')}</select></label>
          <label>Размер<select onchange="setField('size',this.value)">${['Крошечный','Маленький','Средний','Большой','Огромный'].map(a=>`<option${C.size===a?' selected':''}>${a}</option>`).join('')}</select></label>
        </div>
        <label>Опыт (XP)<input type="number" min="0" value="${C.xp||0}" oninput="setText('xp',+this.value||0)"></label>
      </div>
      <div class="card">
        <h3>Расовые черты${r.src?' ('+r.src+')':''}</h3>
        <ul class="traits">${r.traits.map(t=>`<li>${esc(t)}</li>`).join('')}${s?s.traits.map(t=>`<li>${esc(t)}</li>`).join(''):''}</ul>
        <div class="muted small">Скорость: ${speedText()} · Языки: ${[...r.langs,...(C.extraLangs||[]).filter(Boolean)].map(esc).join(', ')||'—'}</div>
        <div class="grid two">${languageChoiceFields()}</div>
        ${r.asiChoice?`<div class="hint">Полуэльф: +1 к двум характеристикам (кроме Хар) — выберите на вкладке «Характеристики»</div>`:''}
      </div>
    </div>
    <h2>Данные листа</h2>
    <div class="card">
      <div class="grid three">${[['age','Возраст'],['height','Рост'],['weight','Вес'],['eyes','Глаза'],['skin','Кожа'],['hair','Волосы']].map(([key,label])=>`<label>${label}<input maxlength="80" value="${esc(C.appearance[key]||'')}" oninput="setAppearance('${key}',this.value)"></label>`).join('')}</div>
      <label>Цели и задачи<textarea rows="3" maxlength="5000" oninput="setText('goals',this.value)">${esc(C.goals||'')}</textarea></label>
      <label>Дополнительное описание внешности<textarea rows="3" maxlength="500" oninput="setAppearance('details',this.value)">${esc(C.appearance.details||'')}</textarea></label>
      <div class="row gap wrap"><label>Портрет (изображение будет сжато локально)<input id="portraitFile" type="file" accept="image/*" onchange="setPortraitFile(this)"></label>${C.portrait?'<button class="btn danger ghost" onclick="removePortrait()">Удалить портрет</button>':''}</div>
      ${C.portrait?`<img class="sheet-portrait-preview" src="${esc(C.portrait)}" alt="Портрет персонажа">`:''}
      <p class="muted small">Портрет хранится в этой библиотеке и резервной копии; изображение сжимается до 640 × 800 px и не более 150 КБ.</p>
    </div>
    <h2>Классы</h2>
    ${classRows}
    <button class="btn" onclick="addClass()">＋ Добавить класс (мультикласс)</button>
    <h2>Личность (по предыстории)</h2>
    <div class="grid two">
      ${['traits','ideals','bonds','flaws'].map(k=>{
        const names={traits:'Черты характера',ideals:'Идеалы',bonds:'Привязанности',flaws:'Слабости'};
        const sugg=(bg[k]||[]);
        return `<div class="card"><h4>${names[k]}</h4>
          <textarea rows="3" oninput="C.personality.${k}=this.value;persist()">${esc(C.personality[k]||'')}</textarea>
          ${sugg.length?`<div class="chips">${sugg.map(x=>`<span class="chip" onclick="addPersonality('${k}',this.textContent)">${esc(x)}</span>`).join('')}</div>`:''}
        </div>`}).join('')}
    </div>
  </div>`;
}
function updTabChar(){const el=$('.tab-char');if(el)el.innerHTML=`${esc(C.name)} · ${C.classes.map(c=>CLASSES[c.cls].name+' '+c.lvl).join(' / ')} · ${esc(raceOf().name)}`}
function setAppearance(key,value){if(!['age','height','weight','eyes','skin','hair','details'].includes(key))return;C.appearance=C.appearance||{};C.appearance[key]=value.slice(0,500);persist()}
function removePortrait(){C.portrait='';persist();render()}
function setPortraitFile(input){
  const file=input.files?.[0];if(!file)return;
  if(!file.type.startsWith('image/')||file.size>20*1024*1024){alert('Выберите изображение размером не более 20 МБ.');input.value='';return}
  const url=URL.createObjectURL(file),image=new Image();
  image.onload=()=>{
    URL.revokeObjectURL(url);
    try{
      const scale=Math.min(1,640/image.naturalWidth,800/image.naturalHeight),canvas=document.createElement('canvas');
      canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      let portrait='';
      for(const quality of [.82,.65,.48]){portrait=canvas.toDataURL('image/jpeg',quality);if(portrait.length<=MAX_PORTRAIT_DATA)break}
      input.value='';
      if(portrait.length>MAX_PORTRAIT_DATA){alert('Не удалось сжать изображение до 150 КБ. Выберите другое.');return}
      C.portrait=portrait;persist();render();
    }catch(error){input.value='';alert('Не удалось обработать изображение.')}
  };
  image.onerror=()=>{URL.revokeObjectURL(url);input.value='';alert('Не удалось открыть изображение.')};
  image.src=url;
}
function addPersonality(k,v){C.personality[k]=(C.personality[k]?C.personality[k]+'\n':'')+v;persist();render()}
function changeRace(v){if(setCharacterRace(v)){persist();render()}}
function changeBackground(v){if(setCharacterBackground(v)){persist();render()}}
function changeClass(i,v){const error=setCharacterClass(i,v);if(error){alert(error);render();return}persist();render()}
function changeLvl(i,v){
  const result=setCharacterLevel(i,v);
  if(result.error){alert(result.error);render();return}
  if(result.removed)alert(`Удалено недоступных заклинаний: ${result.removed}.`);
  persist();render()
}
function changeSub(i,v){
  const result=setCharacterSubclass(i,v);if(!result)return;
  if(result.removed)alert(`Удалено заклинаний, недоступных для нового подкласса: ${result.removed}.`);
  persist();render()
}
function addClass(){const error=addCharacterClass();if(error){alert(error);return}persist();render()}
function removeClass(i){if(removeCharacterClass(i)){persist();render()}}
function subclassOpts(c){
  return Object.entries(SUBCLASSES).filter(([,s])=>s.cls===c.cls)
    .map(([id,s])=>`<option value="${id}"${c.sub===id?' selected':''}>${s.name}${s.src?' ('+s.src+')':''}</option>`).join('');
}
function openBgModal(id){
  const bg=BACKGROUNDS[id];if(!bg)return;
  showModal(`<h2>${esc(bg.name)}${bg.src?' ('+bg.src+')':''}</h2>
    <p>${esc(bg.desc)}</p>
    ${bg.feat&&FEATS.find(f=>f[0]===bg.feat)?`<p><b>Черта предыстории:</b> ${esc(FEATS.find(f=>f[0]===bg.feat)[1])}</p>`:''}
    <p><b>Навыки:</b> ${bg.skills.map(s=>SKILLS.find(x=>x[0]===s)[1]).join(', ')||'—'}</p>
    <p><b>Инструменты:</b> ${bg.tools.join(', ')||'—'} · <b>Языки:</b> ${bg.langs||'—'}</p>`);
}
function showModal(html){let m=$('#modal');m.innerHTML=`<div class="modal-back" onclick="closeModal(event)"><div class="modal" onclick="event.stopPropagation()"><button class="modal-x" onclick="closeModal()">✕</button>${html}</div></div>`;m.style.display='block'}
function closeModal(e){if(e&&e.target&&!e.target.classList.contains('modal-back'))return;$('#modal').style.display='none'}

// ---------- Характеристики ----------
function renderAbil(){
  const r=raceOf();
  const method=C.abilityMethod;
  const B=C.bases[method]||{};
  const racial=racialAsi(), asib=asiBonus();
  const {need,have}=asiPending();
  let methodHtml='';
  if(method==='standard'){
    methodHtml=`<p class="hint">Распределите значения 15, 14, 13, 12, 10, 8 — каждое один раз.</p><div class="grid six">${ABILS.map(([a,n])=>{
      return `<label>${n}<select onchange="setStd('${a}',+this.value)">${STD_SET.map(v=>`<option value="${v}"${B[a]===v?' selected':''}>${v}</option>`).join('')}</select></label>`}).join('')}</div>`;
  }else if(method==='point'){
    const spent=pointBuySpent(B);
    methodHtml=`<p class="hint">27 очков. Стоимость: 9→1, 10→2, 11→3, 12→4, 13→5, 14→7, 15→9. Осталось: <b class="${27-spent<0?'bad':''}">${27-spent}</b></p>
    <div class="grid six">${ABILS.map(([a,n])=>{
      const v=B[a]??8,upSpent=spent-(POINT_COST[v]??0)+(POINT_COST[v+1]??0);
      return `<div class="abil-box"><div class="abil-name">${n}</div><div class="stepper"><button class="btn sm"${v<=8?' disabled':''} onclick="stepPoint('${a}',-1)">−</button><b>${v}</b><button class="btn sm"${v>=15||upSpent>27?' disabled':''} onclick="stepPoint('${a}',1)">＋</button></div><div class="muted small">цена ${POINT_COST[v]??'—'}</div></div>`}).join('')}</div>`;
  }else{
    methodHtml=`<p class="hint">Введите значения от 3 до 18 (например, результат бросков 4к6).</p><div class="grid six">${ABILS.map(([a,n])=>{
      const v=B[a]??10;
      return `<label>${n}<input type="number" min="3" max="18" value="${v}" onchange="setManual('${a}',this.value)"></label>`}).join('')}</div>`;
  }
  const asiBlock=need>0?`<div class="card"><h3>Увеличение характеристик (ASI)</h3>
    <p class="hint">Доступно улучшений: ${need}, распределено: ${have}. Каждое ASI: +2 к одной или +1 к двум характеристикам.</p>
    ${Array.from({length:need},(_,i)=>asiPicker(i)).join('')}</div>`:'';
  const halfElf=r.asiChoice?`<div class="card"><h3>Бонус полуэльфа: +1 к двум характеристикам</h3>
    <div class="row gap wrap">${ABILS.filter(([a])=>!r.asiChoice.exclude.includes(a)).map(([a,n])=>`<label class="chk"><input type="checkbox" ${(C.halfElfPicks||[]).includes(a)?'checked':''} onchange="toggleHalfElf('${a}',this.checked)"> ${n}</label>`).join('')}</div></div>`:'';
  const flexibleAsi=r.flexibleAsi?(()=>{const mode=C.raceAsiMode==='three'?'three':'two',count=mode==='three'?3:2,picks=C.raceAsiPicks||[];return `<div class="card"><h3>Бонусы характеристик (${r.src})</h3><p class="hint">Гибкое распределение по правилу «Котла Таши»: +2 к одной и +1 к другой характеристике либо +1 к трём.</p><label>Распределение<select onchange="setRaceAsiMode(this.value)"><option value="two"${mode==='two'?' selected':''}>+2 и +1</option><option value="three"${mode==='three'?' selected':''}>+1 к трём</option></select></label><div class="row gap wrap">${Array.from({length:count},(_,i)=>`<label>${mode==='two'?(i===0?'+2 к':'+1 к'):'+1 к'}<select onchange="setRaceAsi(${i},this.value)"><option value="">—</option>${ABILS.map(([a,n])=>`<option value="${a}"${picks[i]===a?' selected':''}${picks.includes(a)&&picks[i]!==a?' disabled':''}>${n}</option>`).join('')}</select></label>`).join('')}</div></div>`})():'';
  return `<div class="page"><h1>Характеристики</h1>
    <div class="card">
      <div class="row gap wrap">
        ${[['standard','Стандартный набор (15/14/13/12/10/8)'],['point','Покупка очками (27 очков)'],['manual','Ручной ввод (3–18)']].map(([id,n])=>`<button class="btn${method===id?' primary':''}" onclick="C.abilityMethod='${id}';persist();render()">${n}</button>`).join('')}
      </div>
      <p class="muted small">У каждого метода — свой сохраняемый набор значений: переключение ничего не сбрасывает.</p>
      ${methodHtml}
    </div>
    ${halfElf}
    ${flexibleAsi}
    ${asiBlock}
    <div class="card"><h3>Итог</h3>
    <div class="table-scroll"><table class="tbl"><tr><th>Характеристика</th><th>База</th><th>Раса</th><th>ASI</th><th>Итог</th><th>Модификатор</th></tr>
    ${ABILS.map(([a,n])=>`<tr><td>${n}</td><td>${B[a]??'—'}</td><td>${racial[a]?fmtMod(racial[a]):'—'}</td><td>${asib[a]?fmtMod(asib[a]):'—'}</td><td><b>${abil(a)}</b></td><td><b>${fmtMod(am(a))}</b></td></tr>`).join('')}</table></div>
    <p class="muted small">Бонус мастерства: <b>${fmtMod(pb())}</b> · Инициатива: <b>${fmtMod(initiative())}</b> · Пассивное Восприятие: <b>${passivePerception()}</b> · Пассивное Расследование: <b>${passiveInvestigation()}</b></p>
    </div>
  </div>`;
}
function setStd(a,v){
  const B=C.bases.standard;
  // если значение занято — меняем местами
  const other=ABILS.map(x=>x[0]).find(k=>k!==a&&B[k]===v);
  if(other)B[other]=B[a];
  B[a]=v;persist();render();
}
function stepPoint(a,d){
  const B=C.bases.point,v=(B[a]??8)+d;
  if(!ABILS.some(([id])=>id===a)||v<8||v>15||d>0&&pointBuySpent(B)-(POINT_COST[B[a]??8]??0)+(POINT_COST[v]??0)>27)return;
  B[a]=v;persist();render();
}
function setManual(a,v){C.bases.manual[a]=Math.max(3,Math.min(18,+v||10));persist();render()}
function setRaceAsiMode(v){if(!raceOf().flexibleAsi||!['two','three'].includes(v))return;C.raceAsiMode=v;C.raceAsiPicks=[];persist();render()}
function setRaceAsi(i,v){
  const count=C.raceAsiMode==='three'?3:2;
  if(!raceOf().flexibleAsi||!Number.isInteger(i)||i<0||i>=count||v&&(!ABILS.some(([id])=>id===v)||(C.raceAsiPicks||[]).some((id,index)=>index!==i&&id===v)))return;
  C.raceAsiPicks=C.raceAsiPicks||[];C.raceAsiPicks[i]=v;persist();render();
}
function toggleHalfElf(a,on){
  C.halfElfPicks=C.halfElfPicks||[];
  const choice=raceOf().asiChoice;
  if(on){if(!choice||!ABILS.some(([id])=>id===a)||choice.exclude.includes(a)||C.halfElfPicks.includes(a)||C.halfElfPicks.length>=choice.count){alert('Недопустимый бонус характеристики.');render();return}C.halfElfPicks.push(a)}
  else C.halfElfPicks=C.halfElfPicks.filter(x=>x!==a);
  persist();render();
}
function asiPicker(i){
  const cur=C.asi['asi'+i];
  const isFeat=cur&&cur.type==='feat';
  const vals=Array.isArray(cur)?cur:(cur&&cur.vals)||[];
  const opts=ABILS.map(([a,n])=>`<option value="${a}"${vals.includes(a)?' selected':''}>${n}</option>`).join('');
  const featOpts=(typeof FEATS!=='undefined'?FEATS:[]).map(([id,n])=>`<option value="${id}"${isFeat&&cur.id===id?' selected':''}>${n}</option>`).join('');
  const featDef=isFeat&&typeof FEATS!=='undefined'?FEATS.find(f=>f[0]===cur.id):null;
  const bonusOpts=featDef&&featDef[3]?`<label>+1 к<select onchange="C.asi['asi${i}'].bonus=this.value;persist();render()"><option value="">—</option>${featDef[3].map(a=>`<option value="${a}"${cur.bonus===a?' selected':''}>${ABIL_RU_FULL[a]}</option>`).join('')}</select></label>`:'';
  return `<div class="asi-row"><div class="row gap wrap"><b>#${i+1}</b>
    <label class="chk"><input type="radio" name="asit${i}" ${!isFeat?'checked':''} onchange="setAsiType(${i},'asi')"> +2 / +1 к характеристикам</label>
    <label class="chk"><input type="radio" name="asit${i}" ${isFeat?'checked':''} onchange="setAsiType(${i},'feat')"> Черта (Котёл Таши)</label></div>
    ${!isFeat?`<div class="row gap wrap"><select multiple size="3" onchange="setAsi(${i},[...this.selectedOptions].map(o=>o.value))">${opts}</select>
    <span class="muted small">выберите одну (тогда +2) или две (+1 каждой)</span></div>`
    :`<div class="row gap wrap"><select onchange="setAsiFeat(${i},this.value)"><option value="">— выберите черту —</option>${featOpts}</select>${bonusOpts}</div>
    ${featDef?`<p class="hint">${esc(featDef[2])}</p>`:''}`}</div>`;
}
function setAsiType(i,t){
  C.asi['asi'+i]=t==='feat'?{type:'feat',id:'',bonus:''}:{type:'asi',vals:[]};
  persist();render();
}
function setAsiFeat(i,id){
  C.asi['asi'+i]={type:'feat',id,bonus:''};
  persist();render();
}
function setAsi(i,vals){
  if(vals.length>2){alert('Не больше двух');render();return}
  if(vals.length===1)vals=[vals[0],vals[0]]; // +2 к одной
  C.asi['asi'+i]={type:'asi',vals};persist();render();
}

// ---------- Навыки ----------
function renderSkills(){
  const bg=bgSkills(), race=raceSkills(),invalidChoices=!validSkillChoices(C);
  const expertAv=expertiseAvailable(),expertSelected=expertiseSkills();
  return `<div class="page"><h1>Навыки</h1>
    <p class="hint">Отметьте владения от класса (и расы — для полуэльфа). Владение добавляет <b>бонус мастерства (${fmtMod(pb())})</b> к проверкам навыка, компетентность (◈) — удвоенный бонус. Итог отображается в таблице ниже, на листе и в быстрых проверках игрового режима.</p>
    ${invalidChoices?'<div class="warn">В сохранённых данных есть недопустимые выборы навыков или компетентностей. Их можно сбросить и выбрать заново.</div><button class="btn danger" onclick="resetSkillChoices()">Сбросить выборы навыков</button>':''}
    <div class="card"><h3>Владения от предыстории и расы</h3>
      <p>${[...bg.map(s=>SKILLS.find(x=>x[0]===s)?.[1]||esc(s)),...race.map(s=>SKILLS.find(x=>x[0]===s)?.[1]||esc(s))].join(', ')||'—'}</p>
      ${raceOf().skillChoice?`<p class="hint">Полуэльф: выберите ${raceOf().skillChoice} навыка:</p><div class="row gap wrap">${SKILLS.map(([id,n])=>`<label class="chk"><input type="checkbox" ${(C.raceSkills||[]).includes(id)?'checked':''}${!(C.raceSkills||[]).includes(id)&&profSkills().includes(id)?' disabled':''} onchange="toggleRaceSkill('${id}',this.checked)"> ${n}</label>`).join('')}</div>`:''}
    </div>
    ${C.classes.map((c,i)=>{
      const cl=CLASSES[c.cls];
      const picks=C.classSkills[c.cls]||[];
      const skillCount=classSkillChoiceCount(i,c.cls);
      const otherPicks=C.classes.filter((_,j)=>j!==i).flatMap(x=>C.classSkills[x.cls]||[]);
      const free=cl.skillList.filter(s=>picks.includes(s)||(!bg.includes(s)&&!race.includes(s)&&!otherPicks.includes(s)));
      return `<div class="card"><h3>Навыки класса «${cl.name}» — выбрано ${picks.length}/${skillCount}</h3>
      ${skillCount||picks.length?`<div class="row gap wrap">${free.map(s=>{
        const n=SKILLS.find(x=>x[0]===s)[1];
        return `<label class="chk"><input type="checkbox" ${picks.includes(s)?'checked':''} onchange="toggleClassSkill('${c.cls}',${skillCount},'${s}',this.checked)"> ${n}</label>`}).join('')}</div>`:'<p class="muted small">Мультиклассирование в этот класс не даёт выбора навыков.</p>'}
      ${picks.length<skillCount?`<div class="warn small">выберите ещё ${skillCount-picks.length}</div>`:picks.length>skillCount?`<div class="warn small">уберите ${picks.length-skillCount} лишних навыка</div>`:''}</div>`}).join('')}
    ${expertAv>0?`<div class="card"><h3>Компетентность (удвоенный бонус мастерства)</h3>
      <p class="hint">Доступно: ${expertAv}, выбрано: ${expertSelected.length}</p>
      <div class="row gap wrap">${profSkills().map(s=>`<label class="chk"><input type="checkbox" ${expertSelected.includes(s)?'checked':''}${deftExplorerSkill()===s?' disabled':''} onchange="toggleExpertise('${s}',${expertAv},this.checked)"> ${SKILLS.find(x=>x[0]===s)?.[1]||esc(s)}${deftExplorerSkill()===s?' (Искусный исследователь)':''}</label>`).join('')}</div></div>`:''}
    <div class="card"><h3>Итоговые модификаторы</h3>
    <table class="tbl"><tr><th>Навык</th><th>Хар-ка</th><th>Мод.</th></tr>
    ${SKILLS.map(([id,n,a])=>{const p=profSkills().includes(id),e=expertiseSkills().includes(id);
      return `<tr class="${p?'prof-row':''}"><td>${e?'◈':p?'●':'○'} ${n}</td><td class="muted">${ABIL_RU_FULL[a].slice(0,3)}</td><td><b>${fmtMod(skillMod(id))}</b></td></tr>`}).join('')}</table></div>
  </div>`;
}
function expertiseAvailable(){
  let n=0;
  C.classes.forEach(c=>{
    if(c.cls==='rogue'){if(c.lvl>=1)n+=2;if(c.lvl>=6)n+=2}
    if(c.cls==='bard'){if(c.lvl>=3)n+=2;if(c.lvl>=10)n+=2}
  });
  if(deftExplorerActive())n++;
  return n;
}
function resetSkillChoices(){
  if(!confirm('Сбросить выборы навыков и компетентностей? Вы сможете выбрать их заново.'))return;
  C.classSkills={};C.raceSkills=[];C.expertise=[];delete C.choices.deftExplorerSkill;persist();render();
}
function toggleRaceSkill(id,on){
  C.raceSkills=C.raceSkills||[];
  const max=raceOf().skillChoice||0;
  if(on){if(!SKILLS.some(s=>s[0]===id)||profSkills().includes(id)){alert('Навык уже выбран из другого источника.');render();return}if(C.raceSkills.length>=max){alert('Максимум '+max);render();return}C.raceSkills.push(id)}
  else C.raceSkills=C.raceSkills.filter(x=>x!==id);
  persist();render();
}
function toggleClassSkill(cls,max,id,on){
  C.classSkills[cls]=C.classSkills[cls]||[];
  if(on){if(profSkills().includes(id)){alert('Навык уже выбран из другого источника');render();return}if(C.classSkills[cls].length>=max){alert('Максимум '+max);render();return}C.classSkills[cls].push(id)}
  else C.classSkills[cls]=C.classSkills[cls].filter(x=>x!==id);
  persist();render();
}
function toggleExpertise(id,max,on){
  C.expertise=C.expertise||[];
  if(on){if(deftExplorerSkill()===id)return;if(expertiseSkills().length>=max){alert('Максимум '+max);render();return}C.expertise.push(id)}
  else C.expertise=C.expertise.filter(x=>x!==id);
  persist();render();
}
// ================= Вкладка Класс =================
function availableFightingStyles(key,options){
  const styles=C.choices.fightingStyles||{},used=new Set(activeFightingStyleKeys().filter(other=>other!==key).map(other=>styles[other]).filter(Boolean));
  return options.filter(([id])=>id===styles[key]||!used.has(id));
}
function setFightingStyle(key,value){
  const options=key==='championExtra'?FIGHTING_STYLES.fighter:FIGHTING_STYLES[key];
  if(!options||!activeFightingStyleKeys().includes(key)||value&&!options.some(([id])=>id===value))return;
  C.choices.fightingStyles=C.choices.fightingStyles||{};
  if(value&&activeFightingStyleKeys().some(other=>other!==key&&C.choices.fightingStyles[other]===value)){alert('Боевой стиль уже выбран.');render();return}
  if(value)C.choices.fightingStyles[key]=value;else delete C.choices.fightingStyles[key];
  persist();render();
}
function renderClass(){
  return `<div class="page"><h1>Класс и умения</h1>
  ${C.classes.map((c,i)=>{
    const cl=CLASSES[c.cls], sub=SUBCLASSES[c.sub];
    const styleAv=FIGHTING_STYLES[c.cls],styleLevel=c.cls==='fighter'?1:2,styles=C.choices.fightingStyles||{};
    const replaced=selectedTashaFeatures(c).flatMap(f=>f[4]||[]);
    return `<div class="card">
      <h3>${cl.name} ${c.lvl}${sub?' · '+sub.name:''}</h3>
      <p class="muted small">Кость хитов: к${cl.hd} · Спасброски: ${cl.saves.map(a=>ABIL_RU_FULL[a]).join(', ')} · Доспехи: ${classArmorProficiencyText(c,i)} · Оружие: ${classWeaponProficiencies(c,i).join(', ')||'—'} · Инструменты: ${classToolProficiencyText(c,i)}</p>
      ${styleAv&&c.lvl>=styleLevel?`<label>Боевой стиль<span class="tip-i" data-tip="Боевой стиль. В расчётах листа автоматически учитываются только Защита (КД), Стрельба (атака) и Дуэлянт (урон); эффекты остальных стилей показаны как справка.">ⓘ</span><select onchange="setFightingStyle('${c.cls}',this.value)"><option value="">—</option>${availableFightingStyles(c.cls,styleAv).map(([id,d])=>`<option value="${id}"${styles[c.cls]===id?' selected':''}>${d}</option>`).join('')}</select></label>`:''}
      ${c.cls==='fighter'&&c.sub==='champion'&&c.lvl>=10?`<label>Второй боевой стиль (Чемпион 10)<select onchange="setFightingStyle('championExtra',this.value)"><option value="">—</option>${availableFightingStyles('championExtra',FIGHTING_STYLES.fighter).map(([id,d])=>`<option value="${id}"${styles.championExtra===id?' selected':''}>${d}</option>`).join('')}</select></label>`:''}
      ${c.cls==='ranger'?`
        <label>Избранный враг<span class="tip-i" data-tip="Тип существ, против которых следопыт особенно эффективен: преимущество при выслеживании и на проверки Мудрости (Выживание) по следу.">ⓘ</span><select onchange="setChoice('favoredEnemy',this.value)"><option value="">—</option>${FAVORED_ENEMIES.map(e=>`<option${C.choices.favoredEnemy===e?' selected':''}>${e}</option>`).join('')}</select></label>
        <label>Избранная местность<span class="tip-i" data-tip="Тип местности, где следопыт ориентируется лучше: двойной бонус мастерства к проверкам, связанным с местностью, и преимущества при путешествии.">ⓘ</span><select onchange="setChoice('favoredTerrain',this.value)"><option value="">—</option>${FAVORED_TERRAIN.map(e=>`<option${C.choices.favoredTerrain===e?' selected':''}>${e}</option>`).join('')}</select></label>`:''}
      ${c.cls==='druid'&&c.sub==='land'&&c.lvl>=2?`<label>Земля круга (заклинания круга)<span class="tip-i" data-tip="Выбранная местность определяет список заклинаний круга — они всегда считаются подготовленными и не входят в лимит.">ⓘ</span><select onchange="setChoice('druidLand',this.value)"><option value="">—</option>${Object.entries(SUBCLASSES.land.lands).map(([id,n])=>`<option value="${id}"${C.choices.druidLand===id?' selected':''}>${n}</option>`).join('')}</select></label>`:''}
      ${c.cls==='sorcerer'&&c.sub==='draconic'?`<label>Прародитель (наследие дракона)<span class="tip-i" data-tip="Тип дракона-прародителя определяет вид урона для сопротивления (6 ур.) и крыльев (14 ур.).">ⓘ</span><select onchange="setChoice('draconicType',this.value)"><option value="">—</option>${DRAGONS.map((d,ix)=>`<option value="${['black','blue','brass','bronze','copper','gold','green','red','silver','white'][ix]}"${C.choices.draconicType===['black','blue','brass','bronze','copper','gold','green','red','silver','white'][ix]?' selected':''}>${d[0][0].toUpperCase()+d[0].slice(1)} (${d[1]})</option>`).join('')}</select></label>`:''}
      ${c.cls==='warlock'?warlockChoices(c):''}
      ${c.cls==='sorcerer'&&c.lvl>=3?sorcererChoices(c):''}
      ${sub&&sub.choices?Object.entries(sub.choices).map(([lvl,block])=>{
        if(c.lvl<+lvl)return '';
        return `<label>${block.name} (${lvl} ур.)<select onchange="C.choices['hunter_${lvl}']=this.value;persist();render()"><option value="">—</option>${block.opts.map(([id,d])=>`<option value="${id}"${C.choices['hunter_'+lvl]===id?' selected':''}>${d}</option>`).join('')}</select></label>`}).join(''):''}
      <h4>Умения</h4>
      <ul class="feats">${cl.feats.filter(([l,n])=>l<=c.lvl&&!replaced.includes(n)).map(([l,n,d])=>`<li><b>${l} ур. ${n}.</b> ${esc(d)}</li>`).join('')}
      ${sub?sub.feats.filter(([l])=>l<=c.lvl).map(([l,n,d])=>`<li class="sub-feat"><b>${l} ур. ${n}</b> <span class="tag">${esc(sub.name)}</span><br>${esc(d)}</li>`).join(''):''}
      ${selectedTashaFeatures(c).map(([,l,n,d])=>`<li class="sub-feat"><b>${l} ур. ${n}</b> <span class="tag">Таша</span><br>${esc(d)}</li>`).join('')}
      ${c.cls==='warlock'&&C.choices.pactBoon==='talisman'?`<li class="sub-feat"><b>3 ур. Талисман договора</b> <span class="tag">Таша</span><br>Носитель может добавить к4 к проверке характеристики; число применений = БМ за долгий отдых.</li>`:''}</ul>
      ${c.lvl<20?`<details><summary>Будущие умения</summary><ul class="feats muted">${cl.feats.filter(([l])=>l>c.lvl).map(([l,n])=>`<li>${l} ур. ${n}</li>`).join('')}${sub?sub.feats.filter(([l])=>l>c.lvl).map(([l,n])=>`<li>${l} ур. ${n} (${esc(sub.name)})</li>`).join(''):''}</ul></details>`:''}
      ${tashaFeaturePicker(c)}
    </div>`}).join('')}
  </div>`;
}
function warlockChoices(c){
  const invMax=TABLES.warlock.invocations[c.lvl-1];
  const inv=C.choices.invocations||[];
  return `
  ${c.lvl>=3?`<label>Договорный дар<span class="tip-i" data-tip="Особый дар покровителя: магическое оружие (Клинок), особый фамильяр (Цепь), гримуар с заговорами (Гримуар) или талисман (Таша).">ⓘ</span><select onchange="setChoice('pactBoon',this.value)"><option value="">—</option>
    <option value="blade"${C.choices.pactBoon==='blade'?' selected':''}>Клинок договора: создание магического оружия</option>
    <option value="chain"${C.choices.pactBoon==='chain'?' selected':''}>Цепь договора: особый фамильяр</option>
    <option value="tome"${C.choices.pactBoon==='tome'?' selected':''}>Гримуар договора: 3 заговора любых классов</option>
    <option value="talisman"${C.choices.pactBoon==='talisman'?' selected':''}>Талисман договора (Таша): носитель добавляет к4 к проверкам</option></select></label>`:''}
  ${c.lvl>=2?`<div class="hint">Мистические откровения: ${inv.length}/${invMax}</div>
  <div class="row gap wrap col-list">${INVOCATIONS.map(([id,d])=>`<label class="chk wide"><input type="checkbox" ${inv.includes(id)?'checked':''} onchange="toggleInvocation('${id}',${invMax},this.checked)"> ${d}</label>`).join('')}</div>`:''}`;
}
function toggleInvocation(id,max,on){
  C.choices.invocations=C.choices.invocations||[];
  if(on){if(C.choices.invocations.length>=max){alert('Максимум '+max);render();return}C.choices.invocations.push(id)}
  else C.choices.invocations=C.choices.invocations.filter(x=>x!==id);
  persist();render();
}
function sorcererChoices(c){
  const max=c.lvl>=17?4:c.lvl>=10?3:2;
  const sel=C.choices.metamagic||[];
  return `<div class="hint">Метамагия: ${sel.length}/${max}</div>
  <div class="row gap wrap col-list">${METAMAGIC.map(([id,d])=>`<label class="chk wide"><input type="checkbox" ${sel.includes(id)?'checked':''} onchange="toggleMetamagic('${id}',${max},this.checked)"> ${d}</label>`).join('')}</div>`;
}
function toggleMetamagic(id,max,on){
  C.choices.metamagic=C.choices.metamagic||[];
  if(on){if(C.choices.metamagic.length>=max){alert('Максимум '+max);render();return}C.choices.metamagic.push(id)}
  else C.choices.metamagic=C.choices.metamagic.filter(x=>x!==id);
  persist();render();
}

// ================= Вкладка Заклинания =================
const LVL_NAMES=['Заговоры','1 круг','2 круг','3 круг','4 круг','5 круг','6 круг','7 круг','8 круг','9 круг'];
let SPELL_QUERY='';
const SPELL_FILTERS={cls:'',level:'',ritual:false,concentration:false};
function spellSearchData(s){return esc([s.ru,s.en,s.school,s.ritual?'ритуал':''].join(' ').toLocaleLowerCase('ru'))}
function setSpellQuery(value){SPELL_QUERY=value;filterSpellRows()}
function setSpellFilter(key,value){if(!Object.hasOwn(SPELL_FILTERS,key))return;SPELL_FILTERS[key]=value;filterSpellRows()}
function filterSpellRows(){
  const q=SPELL_QUERY.trim().toLocaleLowerCase('ru'),cls=C?.classes.find(c=>c.cls===SPELL_FILTERS.cls);
  $$('.spell-row').forEach(row=>{
    const spell=SPELLS.find(s=>s.id===row.dataset.spellId);
    row.hidden=!!q&&!row.dataset.search.includes(q)||SPELL_FILTERS.level!==''&&spell?.lvl!==+SPELL_FILTERS.level||SPELL_FILTERS.ritual&&!spell?.ritual||SPELL_FILTERS.concentration&&!/концентрац/i.test(spell?.dur||'')||!!SPELL_FILTERS.cls&&(!cls||!spell||spell.lvl>classMaxSpellLevel(cls)||spell.lvl===0&&!cantripLimit(cls.cls)||!spellClassAllowed(cls,spell.id));
  });
  $$('.spell-lvl').forEach(group=>{
    const hasMatch=!!group.querySelector('.spell-row:not([hidden])');
    group.hidden=!!q&&!hasMatch||!!SPELL_FILTERS.cls&&!hasMatch||SPELL_FILTERS.level!==''&&!hasMatch||SPELL_FILTERS.ritual&&!hasMatch||SPELL_FILTERS.concentration&&!hasMatch;
    if(q&&hasMatch)group.open=true;
  });
  const active=!!q||!!SPELL_FILTERS.cls||SPELL_FILTERS.level!==''||SPELL_FILTERS.ritual||SPELL_FILTERS.concentration,empty=$('#spellNoResults');
  if(empty)empty.hidden=!active||$$('.spell-row').some(row=>!row.hidden);
}
function racialCantripChoices(){
  const choices=[];
  if(C.race==='astralelf')choices.push({key:'astralelf',name:'Астральный огонь',ids:['dancing_lights','light','sacred_flame'],abilities:['int','wis','cha'],defaultAbility:'wis'});
  if(C.race==='elf'&&C.subrace==='high')choices.push({key:'highelf',name:'Заговор высшего эльфа',spells:SPELLS.filter(s=>s.lvl===0&&s.cls.includes('wizard')),ability:'int'});
  return choices.map(c=>({...c,spells:c.spells||c.ids.map(id=>SPELLS.find(s=>s.id===id)).filter(Boolean)}));
}
function racialSpellEntries(){
  const entries=[],add=(id,ability,minLevel=1,usage='Постоянно')=>{const spell=SPELLS.find(s=>s.id===id);if(spell&&totalLvl()>=minLevel)entries.push({spell,ability,usage,saveDc:spellSaveDcForAbility(ability),attackBonus:spellAttackForAbility(ability)})};
  for(const choice of racialCantripChoices()){
    const id=(C.racialSpells||{})[choice.key],ability=(C.racialSpells||{})[choice.key+'Ability']||choice.defaultAbility||choice.ability;
    if(id&&choice.spells.some(s=>s.id===id))add(id,ability,1,'Заговор');
  }
  if(C.race==='elf'&&C.subrace==='drow'){
    add('dancing_lights','cha');add('faerie_fire','cha',3,'1/долгий отдых');add('darkness','cha',5,'1/долгий отдых');
  }
  if(C.race==='gnome'&&C.subrace==='forest')add('minor_illusion','int',1,'Заговор');
  if(C.race==='tiefling'){
    add('thaumaturgy','cha',1,'Заговор');add('hellish_rebuke','cha',3,'1/долгий отдых · 2-й круг');add('darkness','cha',5,'1/долгий отдых');
  }
  return entries;
}
function setRacialSpell(key,id){const choice=racialCantripChoices().find(c=>c.key===key);if(!choice||!choice.spells.some(s=>s.id===id))return;C.racialSpells=C.racialSpells||{};C.racialSpells[key]=id;if(choice.defaultAbility&&!C.racialSpells[key+'Ability'])C.racialSpells[key+'Ability']=choice.defaultAbility;persist();render()}
function setRacialSpellAbility(key,ability){const choice=racialCantripChoices().find(c=>c.key===key);if(!choice||!choice.abilities?.includes(ability))return;C.racialSpells=C.racialSpells||{};C.racialSpells[key+'Ability']=ability;persist();render()}
function renderRacialSpells(){
  const choices=racialCantripChoices(),entries=racialSpellEntries();if(!choices.length&&!entries.length)return '';
  const abilityName=id=>ABIL_RU_FULL[id]||id;
  return `<div class="card"><h3>Заклинания, дарованные расой</h3><p class="hint">Эти заговоры и заклинания получены от вида и не расходуют лимит выбора класса.</p>
    ${choices.map(c=>{const selected=(C.racialSpells||{})[c.key]||'',ability=(C.racialSpells||{})[c.key+'Ability']||c.defaultAbility||c.ability,spell=entries.find(e=>e.spell.id===selected);return `<h4>${c.name} — выберите один заговор</h4>${c.abilities?`<label>Базовая характеристика<select onchange="setRacialSpellAbility('${c.key}',this.value)">${c.abilities.map(a=>`<option value="${a}"${ability===a?' selected':''}>${abilityName(a)}</option>`).join('')}</select></label>`:''}<div class="spell-grid">${c.spells.map(s=>`<div class="spell-row${selected===s.id?' picked':''}" data-spell-id="${s.id}" data-search="${spellSearchData(s)}"><label class="chk"><input type="radio" name="racial_${c.key}" ${selected===s.id?'checked':''} onchange="setRacialSpell('${c.key}','${s.id}')"><span class="spell-name" onclick="spellNameClick(event,'${s.id}')">${esc(s.ru)}</span></label><span class="tag">Дар расы</span></div>`).join('')}</div>${spell?`<p class="muted small">${abilityName(spell.ability)} · КС ${spell.saveDc} · бонус атаки ${fmtMod(spell.attackBonus)}</p>`:''}`}).join('')}
    ${entries.filter(e=>!choices.some(c=>(C.racialSpells||{})[c.key]===e.spell.id)).map(e=>`<div class="spell-row" data-spell-id="${e.spell.id}" data-search="${spellSearchData(e.spell)}"><span class="spell-name" onclick="spellNameClick(event,'${e.spell.id}')">${esc(e.spell.ru)}</span><span class="muted small">${e.usage}${e.ability?' · '+abilityName(e.ability):''}${e.ability?` · КС ${e.saveDc} · атака ${fmtMod(e.attackBonus)}`:''}</span><span class="tag">Дар расы</span></div>`).join('')}
  </div>`;
}
function renderSpells(){
  const casters=spellcasterClasses(),racial=renderRacialSpells();
  if(SPELL_FILTERS.cls&&!casters.some(c=>c.cls===SPELL_FILTERS.cls))SPELL_FILTERS.cls='';
  if(!casters.length&&!racial)return `<div class="page"><h1>Заклинания</h1><p class="muted">У выбранных классов и расы нет магии.</p></div>`;
  return `<div class="page"><h1>Заклинания</h1>
  <label>Поиск по названию, языковому названию или школе<input type="search" aria-label="Поиск заклинаний" value="${esc(SPELL_QUERY)}" oninput="setSpellQuery(this.value)"></label>
  <div class="spell-filterbar"><label>Класс персонажа<select aria-label="Фильтр по классу" onchange="setSpellFilter('cls',this.value)"><option value="">Все классы</option>${casters.map(c=>`<option value="${c.cls}"${SPELL_FILTERS.cls===c.cls?' selected':''}>${esc(CLASSES[c.cls].name)} · ${c.lvl} ур.</option>`).join('')}</select></label><label>Круг<select aria-label="Фильтр по кругу" onchange="setSpellFilter('level',this.value)"><option value="">Все круги</option>${LVL_NAMES.map((name,level)=>`<option value="${level}"${SPELL_FILTERS.level===String(level)?' selected':''}>${name}</option>`).join('')}</select></label><label class="chk"><input type="checkbox"${SPELL_FILTERS.ritual?' checked':''} onchange="setSpellFilter('ritual',this.checked)">Ритуал</label><label class="chk"><input type="checkbox"${SPELL_FILTERS.concentration?' checked':''} onchange="setSpellFilter('concentration',this.checked)">Концентрация</label></div>
  <p id="spellNoResults" class="muted" hidden>Заклинания не найдены. Измените поиск или фильтры.</p>
  ${racial}
  ${casters.map(c=>renderCasterBlock(c)).join('')}
  </div>`;
}

function renderCasterBlock(c){
  const cls=c.cls, cl=CLASSES[cls], abilRu=ABIL_RU_FULL[spellAbilityOf(cls)];
  const maxLvl=maxSpellLvlFor(c);
  let head=`<div class="card"><h3>${cl.name} · базовая характеристика: ${abilRu} · КС ${spellSaveDc(cls)} · атака ${fmtMod(spellAttack(cls))}</h3>`;
  // ячейки
  if(spellTypeOf(c)==='pact'){
    const p=pactSlots();
    head+=`<p class="hint">Ячейки договора: ${p.count} × ${p.level} круг (восстанавливаются на коротком отдыхе)</p>`;
  }else{
    const slots=clsSlotsFor(c);
    if(slots)head+=`<p class="hint">Ячейки: ${slots.map((n,i)=>n?`${i+1} круг — ${n}`:null).filter(Boolean).join(', ')||'—'}${isMulticlassed()?' <span class="warn small">(мультикласс: общие ячейки)</span>':''}</p>`;
  }
  const cantrips=cantripLimit(cls),selectedCantrips=C.cantrips[cls]||[];
  if(cantrips)head+=`<h4>Заговоры — ${selectedCantrips.length}/${cantrips}</h4>${spellPicker(cls,0,selectedCantrips,cantrips,'cantrips')}`;
  // заклинания по типу класса
  if(cls==='wizard'){
    head+=renderWizardSpells(c,maxLvl);
  }else if(['cleric','druid','paladin'].includes(cls)){
    const sel=C.spellsPrepared[cls]||[];
    const limit=prepLimit(cls);
    let bonus=domainSpellsOf(c);
    if(bonus.length)head+=`<p class="hint">Доменные/клятвенные/круговые (всегда подготовлены, не считаются в лимит): ${bonus.map(s=>s.ru).join(', ')}</p>`;
    head+=`<h4>Подготовленные — ${sel.length}/${limit}</h4>`;
    for(let l=1;l<=maxLvl;l++)head+=spellPicker(cls,l,sel,limit,'spellsPrepared',bonus.map(s=>s.id));
  }else{
    // известные: бард, чародей, следопыт, колдун, мистический рыцарь, мистический ловкач
    const sel=C.spellsKnown[cls]||[];
    const limit=knownLimit(cls),additional=cls==='ranger'?primalAwarenessSpells():[],additionalIds=additional.map(s=>s.id);
    if(cls==='ranger'){
      if(additional.length)head+=`<h4>Изначальная осведомлённость</h4><p class="hint">Эти заклинания известны дополнительно и не входят в лимит. Каждое можно один раз наложить без ячейки до долгого отдыха.</p><div class="spell-grid">${additional.map(({id,spellLevel,spell})=>`<div class="spell-row" data-spell-id="${id}" data-search="${spellSearchData(spell)}"><span class="spell-name" onclick="spellNameClick(event,'${id}')">${esc(spell.ru)}</span><span class="muted small">${spellLevel}-й круг</span></div>`).join('')}</div>`;
    }
    if(cls==='fighter'||cls==='rogue')head+=`<p class="hint">Заклинания из списка волшебника (Мистический рыцарь: преимущественно ограждение и воплощение; Мистический ловкач: очарование и иллюзия).</p>`;
    head+=`<h4>Известные заклинания — ${sel.filter(id=>!additionalIds.includes(id)).length}/${limit}</h4>`;
    for(let l=1;l<=maxLvl;l++)head+=spellPicker(cls,l,sel,limit,'spellsKnown',additionalIds);
    if(cls==='warlock'&&c.lvl>=11){
      const arcLvl=c.lvl>=17?9:c.lvl>=15?8:c.lvl>=13?7:6;
      const cur=C.arcanum[arcLvl];
      head+=`<label>Мистический арканум (${arcLvl} круг)<select onchange="C.arcanum['${arcLvl}']=this.value;persist();render()"><option value="">—</option>${SPELLS.filter(s=>s.lvl===arcLvl&&s.cls.includes('warlock')).map(s=>`<option value="${s.id}"${cur===s.id?' selected':''}>${s.ru}</option>`).join('')}</select></label>`;
    }
  }
  return head+'</div>';
}
function isMulticlassed(){return spellcasterClasses().length>1}
function maxSpellLvlFor(c){return classMaxSpellLevel(c)}
function clsSlotsFor(c){
  if(isMulticlassed())return spellSlots();
  return TABLES[c.cls].slots[c.lvl-1];
}
function domainSpellsOf(c){
  const out=[];
  const sub=SUBCLASSES[c.sub];
  const byId=id=>SPELLS.find(s=>s.id===id);
  if(sub&&sub.domainSpells){
    Object.entries(sub.domainSpells).forEach(([clLvl,ids])=>{if(c.lvl>=+clLvl)ids.forEach(id=>{const s=byId(id);if(s&&!out.includes(s))out.push(s)})});
  }
  if(sub&&sub.oathSpells){
    Object.entries(sub.oathSpells).forEach(([plLvl,ids])=>{if(c.lvl>=+plLvl)ids.forEach(id=>{const s=byId(id);if(s&&!out.includes(s))out.push(s)})});
  }
  if(c.cls==='druid'&&c.sub==='land'&&C.choices.druidLand){
    const cs=SUBCLASSES.land.circleSpells[C.choices.druidLand]||{};
    Object.entries(cs).forEach(([druidLvl,ids])=>{if(c.lvl>=+druidLvl)ids.forEach(id=>{const s=byId(id);if(s&&!out.includes(s))out.push(s)})});
  }
  return out;
}
function spellPicker(cls,lvl,sel,limit,store,bonusIds=[]){
  const list=spellsForClass(cls,lvl);
  if(!list.length)return '';
  return `<details class="spell-lvl" data-key="${cls}-${lvl}"${lvl===0?' open':''}><summary>${LVL_NAMES[lvl]} <span class="muted">(${list.length})</span></summary>
  <div class="spell-grid">${list.map(s=>{
    const checked=sel.includes(s.id),bonus=bonusIds.includes(s.id),caster=C.classes.find(c=>c.cls===cls);
    const unavailable=store==='spellsKnown'&&!checked&&caster&&spellTypeOf(caster)==='third'&&!thirdCasterSpellSelectionsValid(caster,[...sel,s.id]);
    return `<div class="spell-row${checked?' picked':''}${bonus?' bonus':''}" data-spell-id="${s.id}" data-search="${spellSearchData(s)}">
      <label class="chk"><input type="checkbox" ${checked?'checked':''} ${bonus||unavailable?'disabled':''}${unavailable?' title="Нет свободного выбора для этой школы заклинаний"':''} onchange="toggleSpell('${store}','${cls}',${limit},'${s.id}',this.checked)">
      <span class="spell-name" onclick="spellNameClick(event,'${s.id}')">${esc(s.ru)}</span></label>
      <span class="muted small">${esc(s.school)}${s.ritual?' · ритуал':''}</span>
    </div>`}).join('')}</div></details>`;
}
function toggleSpell(store,cls,limit,id,on){
  C[store][cls]=C[store][cls]||[];
  const arr=C[store][cls];
  if(on){
    const caster=C.classes.find(c=>c.cls===cls);
    if(store==='spellsKnown'&&caster&&spellTypeOf(caster)==='third'&&!thirdCasterSpellSelectionsValid(caster,[...arr,id])){alert('Для этого заклинания нет свободного выбора вне ограниченных школ.');render();return}
    const freeIds=store==='spellsKnown'&&cls==='ranger'?new Set(primalAwarenessSpells().map(s=>s.id)):null,count=freeIds?arr.filter(x=>!freeIds.has(x)).length:arr.length;if(count>=limit){alert('Лимит: '+limit);render();return}arr.push(id)
  }
  else C[store][cls]=arr.filter(x=>x!==id);
  persist();render();
}
function renderWizardSpells(c,maxLvl){
  const book=C.spellbook||[];
  const minBook=6+(c.lvl-1)*2;
  const prep=C.spellsPrepared.wizard||[];
  const limit=prepLimit('wizard');
  let h=`<h4>Книга заклинаний — ${book.length} (рекомендуется минимум ${minBook})</h4>`;
  for(let l=1;l<=maxLvl;l++){
    h+=`<details class="spell-lvl" data-key="wizard-book-${l}"><summary>${LVL_NAMES[l]}</summary>
    <div class="spell-grid">${spellsForClass('wizard',l).map(s=>{
      const inBook=book.includes(s.id), prepped=prep.includes(s.id);
      return `<div class="spell-row${inBook?' picked':''}" data-spell-id="${s.id}" data-search="${spellSearchData(s)}">
        <label class="chk"><input type="checkbox" ${inBook?'checked':''} onchange="toggleSpellbook('${s.id}',this.checked)"><span class="spell-name" onclick="spellNameClick(event,'${s.id}')">${esc(s.ru)}</span></label>
        ${inBook?`<label class="chk prep"><input type="checkbox" ${prepped?'checked':''} onchange="toggleSpell('spellsPrepared','wizard',${limit},'${s.id}',this.checked)"> подг.</label>`:'<span class="muted small">не в книге</span>'}
      </div>`}).join('')}</div></details>`;
  }
  h+=`<p class="hint">Подготовлено: ${prep.length}/${limit}. Заговоры выбираются выше, книга и подготовка — здесь.</p>`;
  return h;
}
function toggleSpellbook(id,on){
  C.spellbook=C.spellbook||[];
  if(on)C.spellbook.push(id);else{
    C.spellbook=C.spellbook.filter(x=>x!==id);
    C.spellsPrepared.wizard=(C.spellsPrepared.wizard||[]).filter(x=>x!==id);
  }
  persist();render();
}
function spellNameClick(event,id){event.preventDefault();event.stopPropagation();openSpellModal(id)}
function openSpellModal(id){
  const s=SPELLS.find(x=>x.id===id);if(!s)return;
  showModal(`<h2>${esc(s.ru)}</h2><p class="muted">${esc(s.en)}</p>
  <p><b>${s.lvl===0?'Заговор':s.lvl+' круг'}, ${esc(s.school)}${s.ritual?' (ритуал)':''}</b>${s.src?` <span class="muted small">· Источник: ${s.src}</span>`:''}</p>
  <table class="tbl">
    <tr><td>Время накладывания</td><td>${esc(s.time)}</td></tr>
    <tr><td>Дистанция</td><td>${esc(s.range)}</td></tr>
    <tr><td>Компоненты</td><td>${esc(s.comp)}</td></tr>
    <tr><td>Длительность</td><td>${esc(s.dur)}</td></tr>
    <tr><td>Классы</td><td>${s.cls.map(c=>CLASSES[c].name).join(', ')}</td></tr>
  </table>
  ${s.desc?`<p class="hint">Механика: ${esc(s.desc)}</p>`:''}
  ${s.full?`<div class="spell-full">${esc(s.full)}</div>`:''}`);
}

// ================= Вкладка Снаряжение =================
function armorProficiencyWarnings(){
  const armor=equippedArmor(),warnings=[];
  if(armor&&!armorProficient(armor.id))warnings.push(`Нет владения доспехом «${esc(itemName(armor))}»: помеха к проверкам и спасброскам Силы/Ловкости, атакам с этими характеристиками и нельзя накладывать заклинания.`);
  if(hasShield()&&!armorProficient('shield'))warnings.push('Нет владения щитами: помеха к проверкам и спасброскам Силы/Ловкости, атакам с этими характеристиками и нельзя накладывать заклинания.');
  return warnings.map(message=>`<p class="warn small">${message}</p>`).join('');
}
function renderEquip(){
  const inv=C.inventory||[];
  return `<div class="page"><h1>Снаряжение</h1>
    <div class="card"><h3>Стартовое снаряжение или золото</h3>
      <div class="row gap">
        <button class="btn${C.goldMode==='equipment'?' primary':''}" onclick="C.goldMode='equipment';persist();render()">Комплект класса</button>
        <button class="btn${C.goldMode==='gold'?' primary':''}" onclick="C.goldMode='gold';persist();render()">Покупка за золото</button>
      </div>
      ${C.goldMode==='equipment'?C.classes.map(c=>{
        const se=STARTING_EQUIPMENT[c.cls];
        const opts=se?se.choices:null;
        if(!opts)return '';
        return `<div class="row gap wrap"><b>${CLASSES[c.cls].name}:</b>${opts.map(o=>`<button class="btn sm${C.equipChoice[c.cls]===o.name?' primary':''}" onclick="C.equipChoice['${c.cls}']='${o.name}';persist();render()">${o.name}</button>`).join('')}</div>`}).join('')
      :`<div class="row gap wrap">${C.classes.map(c=>`<span>${CLASSES[c.cls].name}: <b>${STARTING_GOLD[c.cls]}</b> зм <button class="btn sm" onclick="rollGold('${c.cls}')">🎲</button></span>`).join('')}
        <label>Текущее золото (зм)<input type="number" min="0" value="${C.gold||0}" onchange="C.gold=+this.value||0;persist();render()"></label></div>`}
      ${C.goldMode==='equipment'?`<button class="btn" onclick="applyStartingKit()">Применить комплект в инвентарь</button>`:''}
    </div>
    <div class="grid two">
      <div class="card"><h3>Магазин</h3>
        <div class="row gap"><input id="shopSearch" placeholder="поиск…" oninput="renderShop(this.value)"></div>
        <div id="shopList">${shopListHtml('')}</div>
      </div>
      <div class="card"><h3>Инвентарь <span class="muted small">КД: ${armorClass()}${hasShield()?' (щит надет)':''}</span></h3>
        ${inv.length?`<table class="tbl"><tr><th>Предмет</th><th>Кол-во</th><th></th></tr>
        ${inv.map((it,i)=>`<tr><td>${esc(itemName(it))}</td><td>${it.qty||1}</td>
          <td class="nowrap">
          ${it.type==='armor'||it.type==='shield'?`<button class="btn sm${it.equipped?' primary':''}" onclick="toggleEquipItem(${i})">${it.equipped?'надето':'надеть'}</button>`:''}
          ${it.type==='weapon'?`<button class="btn sm${it.wielded?' primary':''}" onclick="toggleWieldWeapon(${i})">${it.wielded?'в руке':'взять в руку'}</button>${WEAPONS.find(w=>w[0]===it.id)?.[5].includes('Универсальное')?`<select aria-label="Хват оружия" onchange="setWeaponGrip(${i},this.value)"><option value="one-handed"${it.grip!=='two-handed'?' selected':''}>1 рука</option><option value="two-handed"${it.grip==='two-handed'?' selected':''}>2 руки</option></select>`:''}`:''}
          <button class="btn sm ghost" onclick="sellItem(${i})">продать</button>
          <button class="btn sm danger ghost" onclick="delItem(${i})">✕</button></td></tr>`).join('')}</table>`:'<p class="muted">Пусто.</p>'}
        ${armorProficiencyWarnings()}
        <h4>Атаки</h4>${attacksHtml()}
      </div>
    </div>
    <div class="card"><h3>Настройка на магические предметы (3 слота)</h3>
      <div class="grid three">${[0,1,2].map(i=>`<input placeholder="предмет…" value="${esc((C.attunement||[])[i]||'')}" oninput="C.attunement[${i}]=this.value;persist()">`).join('')}</div>
    </div>
  </div>`;
}
function itemName(it){
  if(it.type==='weapon'){const w=WEAPONS.find(x=>x[0]===it.id);return w?w[1]:it.id}
  if(it.type==='armor'||it.type==='shield'){const a=ARMORS.find(x=>x[0]===it.id);return a?a[1]:it.id}
  if(it.type==='gear'){const g=GEAR.find(x=>x[0]===it.id);return g?g[1]:it.id}
  if(it.type==='pack'){return (PACKS[it.id]?PACKS[it.id][0].split(':')[0]:it.id)}
  if(it.type==='instrument')return it.id;
  return it.name||it.id;
}
function shopListHtml(q){
  q=(q||'').toLowerCase();
  const sec=(key,title,rows)=>`<details class="shop-sec" open data-key="shop-${key}"><summary>${title} <span class="muted small">(${rows.length})</span></summary><div class="shop-body">${rows.length?rows.join(''):'<p class="muted small" style="padding:6px 0">Ничего не найдено</p>'}</div></details>`;
  const wrows=WEAPONS.filter(w=>w[1].toLowerCase().includes(q)).map(w=>`<div class="shop-row"><span>${w[1]} <span class="muted small">${w[3]} · ${w[5]}</span></span><span class="nowrap"><b>${w[2]}</b> <button class="btn sm" onclick="buyItem('weapon','${w[0]}','${w[2]}')">купить</button></span></div>`);
  const arows=ARMORS.filter(a=>a[1].toLowerCase().includes(q)).map(a=>`<div class="shop-row"><span>${a[1]} <span class="muted small">КД ${a[3]}${a[4]===true?' + Лов':a[4]==='max2'?' + Лов (макс 2)':''}</span></span><span class="nowrap"><b>${a[2]}</b> <button class="btn sm" onclick="buyItem('${a[9]==='shield'?'shield':'armor'}','${a[0]}','${a[2]}')">купить</button></span></div>`);
  const grows=GEAR.filter(g=>g[1].toLowerCase().includes(q)).map(g=>`<div class="shop-row"><span>${g[1]}</span><span class="nowrap"><b>${g[2]}</b> <button class="btn sm" onclick="buyItem('gear','${g[0]}','${g[2]}')">купить</button></span></div>`);
  return sec('weapons','🗡 Оружие',wrows)+sec('armors','🛡 Доспехи и щиты',arows)+sec('gear','🎒 Снаряжение и инструменты',grows);
}
function renderShop(q){const open=[...document.querySelectorAll('details.shop-sec[open]')].map(d=>d.dataset.key);$('#shopList').innerHTML=shopListHtml(q);open.forEach(k=>{const d=document.querySelector(`details.shop-sec[data-key="${k}"]`);if(d)d.open=true})}
function priceToGold(p){ // "10 зм"/"5 см"/"1 мм" -> золото
  const m=String(p).match(/([\d.,]+)\s*(зм|см|мм)/);
  if(!m)return 0;
  const v=parseFloat(m[1].replace(',','.'));
  return m[2]==='зм'?v:m[2]==='см'?v/10:v/100;
}
function buyItem(type,id,price){
  if(C.goldMode==='gold'){
    const cost=priceToGold(price);
    if((C.gold||0)<cost){alert('Не хватает золота');return}
    C.gold=Math.round((C.gold-cost)*100)/100;
  }
  addItem(type,id,1);
  persist();render();
}
function addItem(type,id,qty){
  C.inventory=C.inventory||[];
  const ex=C.inventory.find(i=>i.type===type&&i.id===id&&i.type!=='armor'&&i.type!=='shield'&&!(type==='weapon'&&i.wielded));
  if(ex)ex.qty=(ex.qty||1)+qty;else C.inventory.push({type,id,qty,equipped:false});
}
function sellItem(i){
  const it=C.inventory[i];
  if(it.equipped)it.equipped=false;
  if(C.goldMode==='gold'){
    let p=0;
    if(it.type==='weapon')p=priceToGold((WEAPONS.find(x=>x[0]===it.id)||[])[2]||0);
    if(it.type==='armor'||it.type==='shield')p=priceToGold((ARMORS.find(x=>x[0]===it.id)||[])[2]||0);
    if(it.type==='gear')p=priceToGold((GEAR.find(x=>x[0]===it.id)||[])[2]||0);
    C.gold=Math.round(((C.gold||0)+p/2*(it.qty||1))*100)/100;
  }
  if((it.qty||1)>1)it.qty--;else C.inventory.splice(i,1);
  persist();render();
}
function delItem(i){C.inventory.splice(i,1);persist();render()}
function toggleEquipItem(i){
  const it=C.inventory[i];
  if(it.type==='armor')C.inventory.forEach(x=>{if(x.type==='armor')x.equipped=false});
  if(it.type==='shield')C.inventory.forEach(x=>{if(x.type==='shield')x.equipped=false});
  it.equipped=!it.equipped;persist();render();
}
function toggleWieldWeapon(i){
  const it=C.inventory[i];if(!it||it.type!=='weapon')return;
  if(it.wielded)it.wielded=false;
  else if((it.qty||1)>1){it.qty--;C.inventory.splice(i,0,{...it,qty:1,wielded:true,grip:'one-handed'})}
  else it.wielded=true;
  persist();render();
}
function setWeaponGrip(i,grip){
  const it=C.inventory[i],w=it&&WEAPONS.find(x=>x[0]===it.id);
  if(!w||!w[5].includes('Универсальное')||!['one-handed','two-handed'].includes(grip))return;
  it.grip=grip;persist();render();
}
function applyStartingKit(){
  if(!confirm('Добавить стартовое снаряжение классов в инвентарь?'))return;
  C.inventory=[];
  C.classes.forEach(c=>{
    const choice=(C.equipChoice[c.cls]||'а');
    const se=STARTING_EQUIPMENT[c.cls];
    if(!se)return;
    const opts=se.choices;
    const chosen=opts.find(o=>o.name===choice)||opts[0];
    const all=[...(chosen?chosen.items:[]),...(se.defaults||[])];
    all.forEach(entry=>{
      const [kind,a,b]=entry;
      if(kind==='weapon')addItem('weapon',a,typeof b==='number'?b:1);
      else if(kind==='weaponAny'){ // берём первый подходящий
        const [cat,melee]=[a.includes('martial')?'martial':'simple',a.includes('melee')];
        const w=WEAPONS.find(x=>x[7]===cat&&(melee?x[6]==='melee':true));
        if(w)addItem('weapon',w[0],1);
      }
      else if(kind==='armor')addItem('armor',a,1);
      else if(kind==='shield')addItem('shield','shield',1);
      else if(kind==='ammo')addItem('gear',a,1);
      else if(kind==='gear')addItem('gear',a,1);
      else if(kind==='pack')addItem('pack',a,1);
      else if(kind==='instrument')addItem('instrument',a,1);
    });
  });
  // надеть первый доспех
  const arm=C.inventory.find(i=>i.type==='armor');if(arm)arm.equipped=true;
  persist();render();
}
function attacksHtml(){
  const weapons=(C.inventory||[]).filter(i=>i.type==='weapon');
  const monk=C.classes.find(c=>c.cls==='monk');
  let rows=weapons.map(it=>{
    const w=WEAPONS.find(x=>x[0]===it.id);if(!w)return '';
    return `<tr><td>${w[1]}</td><td>${fmtMod(weaponAttack(w))}</td><td>${weaponDamage(w,it)}</td><td class="muted small">${w[5]}</td></tr>`;
  }).join('');
  if(monk){
    const martial=monkMartialArtsActive(),ability=martial?Math.max(am('str'),am('dex')):am('str'),damage=martial?`${TABLES.monk.ma[monk.lvl-1]} ${fmtMod(ability)}`:`1 ${fmtMod(ability)}`;
    rows+=`<tr><td>Безоружный удар</td><td>${fmtMod(ability+pb())}</td><td>${damage}</td><td class="muted small">монашеский</td></tr>`;
  }
  if(!rows)return '<p class="muted">Нет оружия в инвентаре.</p>';
  return `<table class="tbl"><tr><th>Название</th><th>Бонус</th><th>Урон</th><th>Свойства</th></tr>${rows}</table>`;
}
// ================= Вкладка Игра =================
function renderGame(){
  const g=C.game;
  const mh=maxHp();
  if(g.hpCur==null)g.hpCur=mh;
  const slots=spellSlots();
  const res=classResources();
  return `<div class="page"><h1>Игровой режим</h1>
  <div class="grid two">
    <div class="card">
      <h3>Хиты</h3>
      <div class="hp-big"><b>${esc(g.hpCur)}</b><span class="muted">/ ${mh}</span></div>
      <div class="row gap wrap">
        <input type="number" id="hpDelta" placeholder="±" style="width:80px">
        <button class="btn danger" onclick="chgHp(-1)">Урон</button>
        <button class="btn ok" onclick="chgHp(1)">Лечение</button>
        <button class="btn ghost" onclick="C.game.hpCur=maxHp();persist();render()">Полное</button>
      </div>
      <label>Временные хиты<input type="number" min="0" value="${esc(g.hpTemp||0)}" onchange="C.game.hpTemp=+this.value||0;persist();render()"></label>
      <div class="row gap wrap" style="margin-top:8px">
        <span>Кости хитов: <b>${hitDiceStr()}</b></span>
        ${C.classes.length>1?`<label>Кость класса<select id="hdClass">${C.classes.map(c=>`<option value="${c.cls}">${CLASSES[c.cls].name} · к${CLASSES[c.cls].hd} (${hitDiceUsedByClass()[c.cls]||0}/${c.lvl})</option>`).join('')}</select></label>`:''}
        <span class="muted">потрачено: ${esc(g.hdUsed||0)} / ${totalLvl()}</span>
        <button class="btn sm" onclick="spendHd()">Потратить кость</button>
        <button class="btn sm ghost" onclick="C.game.hdUsed=Math.max(0,(C.game.hdUsed||0)-1);persist();render()">−1</button>
      </div>
      <h4>Спасброски от смерти</h4>
      <div class="row gap">
        <span>Успехи: ${[0,1,2].map(i=>`<span class="pip${g.dsOk>i?' on':''}" onclick="C.game.dsOk=${g.dsOk>i?i:i+1};persist();render()"></span>`).join('')}</span>
        <span>Провалы: ${[0,1,2].map(i=>`<span class="pip fail${g.dsFail>i?' on':''}" onclick="C.game.dsFail=${g.dsFail>i?i:i+1};persist();render()"></span>`).join('')}</span>
      </div>
      <label class="chk"><input type="checkbox" ${g.insp?'checked':''} onchange="C.game.insp=this.checked;persist()"> Вдохновение</label>
      <label>Истощение (0–6)<input type="number" min="0" max="6" value="${esc(g.exh||0)}" onchange="C.game.exh=Math.min(6,Math.max(0,+this.value||0));persist();render()"></label>
    </div>
    <div class="card">
      <h3>Ячейки заклинаний</h3>
      ${slots?`<div class="slots">${slots.map((n,i)=>n?`<div class="slot-row"><b>${i+1} круг</b><span class="pips" id="slotPips${i}"></span></div>`:'').join('')}</div>`:'<p class="muted">Нет ячеек</p>'}
      <div class="row gap" style="margin-top:8px">
        <button class="btn sm" onclick="shortRest()">Короткий отдых</button>
        <button class="btn sm primary" onclick="longRest()">Длинный отдых</button>
      </div>
      <h3>Ресурсы класса</h3>
      ${res.length?res.map(r=>`<div class="slot-row"><b>${r.name}</b><span class="pips" data-res="${r.id}"></span></div>`).join(''):'<p class="muted">Нет расходуемых ресурсов</p>'}
      <label>Состояния<input value="${esc(g.conditions||'')}" placeholder="отравлен, оглушён…" oninput="C.game.conditions=this.value;persist()"></label>
    </div>
  </div>
  <div class="card">
    <h3>Кубы</h3>
    <div class="row gap wrap">
      ${[4,6,8,10,12,20].map(d=>`<button class="btn die" onclick="rollDice(1,${d},0,'к'+${d})">к${d}</button>`).join('')}
      <input type="number" id="diceN" value="1" min="1" style="width:56px"> ×
      <select id="diceD">${[4,6,8,10,12,20,100].map(d=>`<option${d===20?' selected':''}>к${d}</option>`).join('')}</select>
      <input type="number" id="diceM" value="0" style="width:64px" placeholder="±мод">
      <button class="btn primary" onclick="rollCustom()">Бросить</button>
    </div>
    <h4>Быстрые проверки</h4>
    <div class="row gap wrap">
      ${ABILS.map(([a,n])=>`<button class="btn sm" onclick="rollCheck('abil','${a}','${n}')">${n} ${fmtMod(am(a))}</button>`).join('')}
    </div>
    <div class="row gap wrap">
      ${SKILLS.map(([id,n])=>`<button class="btn sm ghost" onclick="rollCheck('skill','${id}','${n}')">${n} ${fmtMod(skillMod(id))}</button>`).join('')}
    </div>
    <h4>Спасброски</h4>
    <div class="row gap wrap">
      ${ABILS.map(([a,n])=>`<button class="btn sm ghost" onclick="rollCheck('save','${a}','${n}')">${n} ${fmtMod(saveMods()[a].mod)}</button>`).join('')}
    </div>
    <div id="diceLog" class="dice-log"></div>
  </div>
  <div class="card"><h3>Заметки</h3><textarea rows="4" oninput="C.game.notes=this.value;persist()">${esc(g.notes||'')}</textarea></div>
  </div>`;
}
function drawGameTrackers(){
  const g=C.game;
  const slots=spellSlots();
  if(slots)slots.forEach((n,i)=>{
    if(!n)return;
    const used=(g.slotsUsed||{})[i]||0;
    const el=document.getElementById('slotPips'+i);
    if(el)el.innerHTML=Array.from({length:n},(_,k)=>`<span class="pip${k<used?' on':''}" onclick="useSlot(${i},${k},${n})"></span>`).join('');
  });
  const pact=pactSlots();
  if(pact){
    const el=document.getElementById('pactPips');
    if(el)el.innerHTML=Array.from({length:pact.count},(_,k)=>`<span class="pip${k<(g.pactUsed||0)?' on':''}" onclick="C.game.pactUsed=(C.game.pactUsed===${k+1}?${k}:${k+1});persist();drawGameTrackers()"></span>`).join('');
  }
  classResources().forEach(r=>{
    const el=document.querySelector(`[data-res="${r.id}"]`);
    if(el){
      const used=(g.resources||{})[r.id]||0;
      el.innerHTML=Array.from({length:Math.min(r.max,30)},(_,k)=>`<span class="pip${k<used?' on':''}" onclick="useRes('${r.id}',${k})"></span>`).join('')+(r.max>30?` <span class="muted">${esc(used)}/${r.max}</span>`:'');
    }
  });
}
function useSlot(i,k,n){C.game.slotsUsed=C.game.slotsUsed||{};C.game.slotsUsed[i]=(C.game.slotsUsed[i]===k+1)?k:k+1;persist();drawGameTrackers()}
function useRes(id,k){C.game.resources=C.game.resources||{};C.game.resources[id]=(C.game.resources[id]===k+1)?k:k+1;persist();drawGameTrackers()}
function chgHp(sign){
  const d=+($('#hpDelta').value)||0;if(!d)return;
  const g=C.game, mh=maxHp();
  if(sign<0){
    let dmg=d;
    if(g.hpTemp>0){const t=Math.min(g.hpTemp,dmg);g.hpTemp-=t;dmg-=t}
    g.hpCur=Math.max(0,g.hpCur-dmg);
  }else g.hpCur=Math.min(mh,g.hpCur+d);
  persist();render();
}
function spendHd(selectedClass){
  const g=C.game,used=syncHitDice(),cls=selectedClass||$('#hdClass')?.value||C.classes[0].cls,c=C.classes.find(x=>x.cls===cls);
  if(!c||used[cls]>=c.lvl){alert('Все кости хитов этого класса потрачены');return}
  used[cls]++;g.hdUsedByClass=used;g.hdUsed=Object.values(used).reduce((sum,n)=>sum+n,0);
  const hd=CLASSES[cls].hd,heal=Math.floor(Math.random()*hd)+1+am('con');
  g.hpCur=Math.min(maxHp(),(g.hpCur??maxHp())+Math.max(1,heal));
  logRoll('Кость хитов к'+hd+': +'+Math.max(1,heal)+' хитов');
  persist();render();
}
function shortRest(){
  const g=C.game;
  g.pactUsed=0;
  // колдун восстанавливает ячейки договора на коротком отдыхе
  if(g.resources){
    if(g.resources.pact!=null)g.resources.pact=0;
    if(g.resources.ki!=null)g.resources.ki=0;
    if(g.resources.insp!=null&&C.classes.find(c=>c.cls==='bard'&&c.lvl>=5))g.resources.insp=0;
    if(g.resources.secondwind!=null)g.resources.secondwind=0;
    if(g.resources.surge!=null)g.resources.surge=0;
    if(g.resources.wildshape!=null)g.resources.wildshape=0;
    if(g.resources.channel!=null)g.resources.channel=0;
    const sorc=C.classes.find(c=>c.cls==='sorcerer'&&c.lvl>=20);
    if(sorc&&g.resources.sorc!=null)g.resources.sorc=Math.max(0,g.resources.sorc-4);
    g.resources.luck=0;
  }
  persist();render();
}
function longRest(){
  const g=C.game;
  g.hpCur=maxHp();g.hpTemp=0;
  const used=syncHitDice(),remaining=Math.min(Object.values(used).reduce((sum,n)=>sum+n,0),Math.max(1,Math.floor(totalLvl()/2)));
  let recover=remaining;
  for(const c of C.classes){const restored=Math.min(used[c.cls]||0,recover);used[c.cls]-=restored;recover-=restored}
  g.hdUsedByClass=used;g.hdUsed=Object.values(used).reduce((sum,n)=>sum+n,0);
  g.slotsUsed={};g.pactUsed=0;g.resources={};g.dsOk=0;g.dsFail=0;
  persist();render();
}
function rollDice(n,d,m,label){
  const rolls=Array.from({length:n},()=>Math.floor(Math.random()*d)+1);
  const sum=rolls.reduce((a,b)=>a+b,0)+m;
  logRoll(`${label}: [${rolls.join(', ')}]${m?fmtMod(m):''} = <b>${sum}</b>`);
  return sum;
}
function rollCustom(){
  const n=+$('#diceN').value||1, d=+$('#diceD').value.replace('к',''), m=+$('#diceM').value||0;
  rollDice(Math.min(50,n),d,m,`${n}к${d}${m?fmtMod(m):''}`);
}
function rollCheck(kind,id,name){
  let bonus=0;
  if(kind==='abil')bonus=am(id);
  if(kind==='skill')bonus=skillMod(id);
  if(kind==='save')bonus=saveMods()[id].mod;
  const r=Math.floor(Math.random()*20)+1;
  const crit=r===20?' <span class="ok-t">КРИТ!</span>':r===1?' <span class="bad">ПРОВАЛ!</span>':'';
  logRoll(`${name}: к20=${r} ${fmtMod(bonus)} = <b>${r+bonus}</b>${crit}`);
}
function logRoll(html){
  const log=$('#diceLog');if(!log)return;
  const div=document.createElement('div');
  div.className='log-entry';
  div.innerHTML=`<span class="muted small">${new Date().toLocaleTimeString('ru')}</span> ${html}`;
  log.prepend(div);
  while(log.children.length>30)log.lastChild.remove();
}
// ================= Лист персонажа (2014) =================
function renderSheet2014(){
  const r=raceOf(), sub=subraceOf(), game=C.game||{}, saves=saveMods(), appearance=C.appearance||{};
  const clsText=C.classes.map(c=>CLASSES[c.cls].name).join(' / ');
  const abilityBlocks=ABILS.map(([id,name])=>`<div class="p14-ability"><span class="pdf-cap">${name}</span><div class="pdf-row"><strong class="mod">${fmtMod(am(id))}</strong><span class="score">${abil(id)}</span></div></div>`).join('');
  const saveRows=ABILS.map(([id,name])=>`<div class="p14-skill"><span>${saves[id].prof?'●':'○'}</span><b>${fmtMod(saves[id].mod)}</b><span>${name}</span></div>`).join('');
  const skillRows=SKILLS.map(([id,name])=>`<div class="p14-skill"><span>${profSkills().includes(id)?(expertiseSkills().includes(id)?'◈':'●'):'○'}</span><b>${fmtMod(skillMod(id))}</b><span>${name}</span></div>`).join('');
  const feats=availableFeats();
  if(typeof FEATS!=='undefined')for(const key in (C.asi||[])){const a=C.asi[key];if(a&&a.type==='feat'&&a.id){const f=FEATS.find(x=>x[0]===a.id);if(f)feats.push({cls:'',lvl:99,name:f[1],desc:f[2]})}}
  const bgFeat=FEATS.find(f=>f[0]===BACKGROUNDS[C.bg]?.feat);if(bgFeat)feats.push({cls:'',lvl:99,name:bgFeat[1]+' (AAG)',desc:bgFeat[2]});
  feats.push(...chosenTashaFeatures());
  const weaponRows=(C.inventory||[]).filter(i=>i.type==='weapon').map(it=>{const w=WEAPONS.find(x=>x[0]===it.id);return w?`<tr><td>${esc(w[1])}</td><td>${fmtMod(weaponAttack(w))}</td><td>${weaponDamage(w,it)}</td><td>${esc(w[5].split(',')[0])}</td></tr>`:''}).join('');
  const tools=new Set(toolProficiencies());
  const langs=[...(r.langs||[])];
  for(let i=0;i<languageChoiceCount();i++)langs.push((C.extraLangs||[])[i]||'на выбор');
  if(C.classes.some(c=>c.cls==='druid'))langs.push('Друидический');
  if(C.classes.some(c=>c.cls==='rogue'))langs.push('Воровской жаргон');
  const casters=spellcasterClasses(), slots=spellSlots()||[], racialSpells=racialSpellEntries();
  const racialSpellIds=new Set(racialSpells.map(x=>x.spell.id)),primalSpells=primalAwarenessSpells(),primalSpellIds=new Set(primalSpells.map(x=>x.id));
  const spellIds=[...new Set([...casters.flatMap(c=>[...(C.cantrips[c.cls]||[]),...(C.spellsKnown[c.cls]||[]),...(C.spellsPrepared[c.cls]||[]),...(c.cls==='wizard'?(C.spellbook||[]):[])]),...racialSpells.map(x=>x.spell.id),...primalSpells.map(x=>x.id)])];
  const spells=spellIds.map(id=>SPELLS.find(sp=>sp.id===id)).filter(Boolean);
  const spellGroup=level=>`<section class="pdf-box p14-spellgroup" data-level="${level}"><div class="pdf-title" data-level="${level}">${level===0?'Заговоры':`${level}-й круг`}${level?` · ячеек ${slots[level-1]||0}`:''}</div>${spells.filter(sp=>sp.lvl===level).map(sp=>`<div class="p14-spellrow">${esc(sp.ru)}${racialSpellIds.has(sp.id)?' · дар расы':''}${primalSpellIds.has(sp.id)?' · Изначальная осведомлённость: 1/долгий отдых без ячейки':''}</div>`).join('')}${Array.from({length:level===0?14:12},()=>'<div class="p14-spellrow"></div>').join('')}</section>`;
  const personality=C.personality||{};
  return `<div class="pdf-sheet">
    <div class="no-print-bar"><button class="btn primary" onclick="window.print()">🖨 Печать / PDF</button><span class="muted small">лист D&D 2014</span></div>
    <section class="pdf-page pdf-page14 p14-page1" data-sheet-page="1">
      <header class="p14-header"><div class="p14-name"><div class="pdf-cap">имя персонажа</div><strong>${esc(C.name)}</strong></div><div class="p14-id">
        <div><div class="pdf-cap">класс и уровень</div><b>${esc(clsText)} · ${totalLvl()}</b></div><div><div class="pdf-cap">предыстория</div><b>${esc(BACKGROUNDS[C.bg].name)}</b></div><div><div class="pdf-cap">игрок</div><div class="pdf-line"></div></div>
        <div><div class="pdf-cap">вид</div><b>${esc(r.name)}${sub?' ('+esc(sub.name)+')':''}</b></div><div><div class="pdf-cap">мировоззрение</div><b>${esc(C.align)}</b></div><div><div class="pdf-cap">опыт</div><b>${C.xp||0}</b></div>
      </div></header>
      <div class="p14-body">
        <div class="p14-col"><div class="p14-leftsplit"><div class="p14-abilities">${abilityBlocks}</div><div class="p14-col p14-leftside"><div class="pdf-box p14-insp"><span class="pdf-cap">вдохновение</span><div>${game.insp?'●':'○'}</div></div><div class="pdf-box p14-pb"><strong>${fmtMod(pb())}</strong><span class="pdf-cap">бонус владения</span></div><div class="pdf-box p14-saves"><div class="pdf-title">спасброски</div><div class="p14-list">${saveRows}</div></div><div class="pdf-box p14-skills"><div class="pdf-title">навыки</div><div class="p14-list">${skillRows}</div></div></div></div>
          <div class="pdf-box p14-passive"><strong>${passivePerception()}</strong><span>пассивная мудрость (восприятие)</span><div class="pdf-small">Пассивное Расследование: ${passiveInvestigation()}</div></div><div class="pdf-box" style="flex:1"><div class="pdf-title">прочие владения и языки</div><div class="pdf-small"><b>Доспехи:</b> ${armorProficiencyText()}<br><b>Оружие:</b> ${weaponProficiencyText()}<br><b>Инструменты:</b> ${esc([...tools].join(', ')||'—')}<br><b>Языки:</b> ${esc([...new Set(langs)].join(', ')||'—')}</div></div></div>
        <div class="p14-col"><div class="p14-status"><div class="pdf-box"><span class="pdf-cap">КЗ</span><strong>${armorClass()}</strong></div><div class="pdf-box"><span class="pdf-cap">инициатива</span><strong>${fmtMod(initiative())}</strong></div><div class="pdf-box"><span class="pdf-cap">скорость</span><strong>${speed()}</strong>${rovingActive()?`<span class="pdf-small">лазание/плавание ${speed()} фт</span>`:''}</div></div>
          <div class="pdf-box p14-hp"><div class="pdf-title">максимум хитов</div><div class="pdf-value">${maxHp()}</div><div class="pdf-small">Кость хитов: ${hitDiceStr()}</div></div>
          <div class="pdf-box p14-currenthp"><div class="pdf-title">текущие хиты</div><div class="pdf-row"><span>текущие</span><b>${esc(game.hpCur!=null?game.hpCur:maxHp())}</b></div><div class="pdf-row"><span>временные</span><b>${esc(game.hpTemp||0)}</b></div><div class="pdf-lines" style="flex:1"></div></div>
          <div class="p14-status p14-dice"><div class="pdf-box"><div class="pdf-title">кости хитов</div><div class="pdf-value">${totalLvl()} · ${hitDiceStr()}</div></div><div class="pdf-box"><div class="pdf-title">спасброски от смерти</div><div class="pdf-small">Успехи ${[0,1,2].map(i=>esc(game.dsOk>i?'●':'○')).join(' ')}<br>Провалы ${[0,1,2].map(i=>esc(game.dsFail>i?'●':'○')).join(' ')}</div></div></div>
          <div class="pdf-box p14-attacks"><div class="pdf-title">атаки и заклинания</div><table class="p24-table"><tr><th>название</th><th>бонус атаки</th><th>урон / вид</th><th>заметки</th></tr>${weaponRows||'<tr><td colspan="4">—</td></tr>'}</table><div class="pdf-lines"></div></div>
          <div class="pdf-box p14-equipment"><div class="pdf-row pdf-small">${['ММ','СМ','ЗМ','ЭМ','ПМ'].map(c=>`<span>${c}<br>${c==='ЗМ'?C.gold||0:''}</span>`).join('')}</div><div class="pdf-small">${(C.inventory||[]).map(it=>`${esc(itemName(it))}${(it.qty||1)>1?' ×'+it.qty:''}`).join('<br>')||'—'}</div><div class="pdf-lines"></div><div class="pdf-title">снаряжение</div></div>
        </div>
        <div class="p14-col"><div class="p14-personality">${[['Черты характера',personality.traits],['Идеалы',personality.ideals],['Привязанности',personality.bonds],['Слабости',personality.flaws]].map(([h,v])=>`<div class="pdf-box"><div class="pdf-lines">${esc(v||'')}</div><div class="pdf-title">${h}</div></div>`).join('')}</div><div class="pdf-box p14-features"><div class="pdf-title">умения и способности</div><ul>${feats.map(f=>`<li><b>${f.lvl===99?'':f.lvl+' ур. '}${esc(f.name)}</b> — ${esc(f.desc)}</li>`).join('')||'<li>—</li>'}</ul><div class="pdf-small">${[...(r.traits||[]),...(sub?.traits||[])].map(esc).join('<br>')}</div></div></div>
      </div>
    </section>
    <section class="pdf-page pdf-page14 p14-page2" data-sheet-page="2">
      <header class="p14-header"><div class="p14-name"><div class="pdf-cap">имя персонажа</div><strong>${esc(C.name)}</strong></div><div class="p14-id">${[['возраст',appearance.age],['рост',appearance.height],['вес',appearance.weight],['цвет глаз',appearance.eyes],['цвет кожи',appearance.skin],['цвет волос',appearance.hair]].map(([n,v])=>`<div><div class="pdf-cap">${n}</div><div class="pdf-line">${esc(v||'')}</div></div>`).join('')}</div></header>
      <div class="p14-page2grid"><div class="pdf-box story"><div class="pdf-lines" style="height:93%">${esc(C.backstory||'')}</div><div class="pdf-title">предыстория персонажа</div></div><div class="pdf-box goals"><div class="pdf-lines" style="height:93%">${esc(C.goals||'')}</div><div class="pdf-title">цели и задачи</div></div><div class="detail-stack"><div class="pdf-box"><div class="pdf-lines" style="height:92%">${esc(C.allies||'')}</div><div class="pdf-title">союзники и организации</div></div><div class="pdf-box"><div class="pdf-lines" style="height:92%">${esc(C.featuresNotes||'')}</div><div class="pdf-title">дополнительные способности и умения</div></div><div class="pdf-box"><div class="pdf-lines" style="height:92%">${esc(C.treasure||'')}</div><div class="pdf-title">сокровища</div></div></div></div>
    </section>
    <section class="pdf-page pdf-page14 p14-page3" data-sheet-page="3"><div class="p14-notes-header"><div class="p14-name"><div class="pdf-cap">имя персонажа</div><strong>${esc(C.name)}</strong></div></div><div class="p14-notes-grid">${Array.from({length:6},(_,i)=>`<div class="pdf-box"><div class="pdf-title">Заметки${i===0?' · '+esc(C.name):''}</div><div class="pdf-lines"></div></div>`).join('')}</div></section>
    <section class="pdf-page pdf-page14 p14-page4" data-sheet-page="4">
      <div class="p14-spellhead"><div class="pdf-line"><span class="pdf-cap">класс заклинателя</span><br><b>${casters.map(c=>CLASSES[c.cls].name).join(', ')||''}</b></div><div class="pdf-line"><span class="pdf-cap">характеристика</span><br><b>${casters.map(c=>ABIL_RU_FULL[CLASSES[c.cls].spellAbility]).join(', ')||''}</b></div><div class="pdf-box"><span class="pdf-cap">сложность спасброска</span><br><b>${casters.map(c=>spellSaveDc(c.cls)).join(' / ')||''}</b></div><div class="pdf-box"><span class="pdf-cap">бонус атаки</span><br><b>${casters.map(c=>fmtMod(spellAttack(c.cls))).join(' / ')||''}</b></div></div>
      <div class="p14-spellcols"><div class="p14-spellcol">${spellGroup(0)}${spellGroup(1)}${spellGroup(2)}</div><div class="p14-spellcol">${spellGroup(3)}${spellGroup(4)}${spellGroup(5)}</div><div class="p14-spellcol">${spellGroup(6)}${spellGroup(7)}${spellGroup(8)}${spellGroup(9)}</div></div>
    </section>
  </div>`;
}
function setSheetVersion(version){
  SHEET_VERSION=version==='2024'?'2024':'2014';
  writeStorage(LS_SHEET,SHEET_VERSION);
  render();
}

function renderSheet(){
  return `<div class="sheet-choice"><label>Оформление листа <select onchange="setSheetVersion(this.value)"><option value="2014"${SHEET_VERSION==='2014'?' selected':''}>D&D 2014</option><option value="2024"${SHEET_VERSION==='2024'?' selected':''}>D&D 2024</option></select></label><span class="muted small">Меняется только вид листа; расчёты остаются по правилам 2014 года.</span></div>${SHEET_VERSION==='2024'?renderSheet2024():renderSheet2014()}`;
}

function renderSheet2024(){
  const race=raceOf(), sub=subraceOf(), game=C.game||{}, saves=saveMods(), appearance=C.appearance||{};
  const clsText=C.classes.map(c=>`${CLASSES[c.cls].name} ${c.lvl}`).join(' / ');
  const subText=C.classes.map(c=>SUBCLASSES[c.sub]?.name?`${CLASSES[c.cls].name}: ${SUBCLASSES[c.sub].name}`:'').filter(Boolean).join(' / ');
  const ability=(id,name)=>`<div class="pdf-box p24-ability"><div class="p24-ability-head"><strong>${name}</strong><span class="p24-mod">${fmtMod(am(id))}</span></div><div class="pdf-small">Значение ${abil(id)} · спасбросок ${fmtMod(saves[id].mod)}</div>${SKILLS.filter(x=>x[2]===id).map(([skillId,skillName])=>`<div class="p24-skill"><i class="p24-check${profSkills().includes(skillId)?' on':''}"></i><b>${fmtMod(skillMod(skillId))}</b><span>${skillName}</span></div>`).join('')}</div>`;
  const bgFeat=FEATS.find(f=>f[0]===BACKGROUNDS[C.bg]?.feat);
  const asiFeats=Object.values(C.asi||{}).flatMap(a=>{const feat=a?.type==='feat'&&FEATS.find(f=>f[0]===a.id);return feat?[{lvl:99,name:feat[1],desc:feat[2]}]:[]});
  const features=[...availableFeats(),...asiFeats,...chosenTashaFeatures(),...(bgFeat?[{lvl:99,name:bgFeat[1]+' (AAG)',desc:bgFeat[2]}]:[])].map(f=>`<li><b>${f.lvl===99?'':f.lvl+' ур. '}${esc(f.name)}</b> — ${esc(f.desc)}</li>`).join('')||'<li>—</li>';
  const tools=new Set(toolProficiencies());
  const langs=[...(race.langs||[])];
  for(let i=0;i<languageChoiceCount();i++)langs.push((C.extraLangs||[])[i]||'на выбор');
  const profs=`Доспехи: ${armorProficiencyText()}.<br>Оружие: ${weaponProficiencyText()}.<br>Инструменты: ${esc([...tools].join(', ')||'—')}<br>Языки: ${esc([...new Set(langs)].join(', ')||'—')}`;
  const casters=spellcasterClasses(), slots=spellSlots()||[], racialSpells=racialSpellEntries();
  const racialSpellIds=new Set(racialSpells.map(x=>x.spell.id)),primalSpells=primalAwarenessSpells(),primalSpellIds=new Set(primalSpells.map(x=>x.id));
  const domainSpellIds=new Set(casters.flatMap(c=>domainSpellsOf(c).map(s=>s.id)));
  const knownSpellIds=new Set(casters.flatMap(c=>C.spellsKnown[c.cls]||[])),preparedSpellIds=new Set(casters.flatMap(c=>C.spellsPrepared[c.cls]||[]));
  const wizardBook=new Set(C.spellbook||[]);
  const spellIds=[...new Set([...casters.flatMap(c=>[...(C.cantrips[c.cls]||[]),...(C.spellsKnown[c.cls]||[]),...(C.spellsPrepared[c.cls]||[]),...domainSpellsOf(c).map(s=>s.id),...(c.cls==='wizard'?(C.spellbook||[]):[])]),...racialSpells.map(x=>x.spell.id),...primalSpells.map(x=>x.id)])];
  const spells=spellIds.map(id=>SPELLS.find(s=>s.id===id)).filter(Boolean);
  const spellStatus=s=>s.lvl===0?'Заговор':preparedSpellIds.has(s.id)?'Подгот.':domainSpellIds.has(s.id)?'Всегда':knownSpellIds.has(s.id)?'Известно':wizardBook.has(s.id)?'Книга':'';
  const spellRow=s=>`<div class="p24-spellrow"><span>${s.lvl===0?'0':s.lvl}</span><b>${esc(s.ru)}</b><span>${esc(s.time)}</span><span>${esc(s.range)}</span><span>◇ К</span><span>◇ Р</span><span>◇ М</span><span>${[spellStatus(s),racialSpellIds.has(s.id)?'Дар расы':'',primalSpellIds.has(s.id)?'Осведомл. · 1/долг.':''].filter(Boolean).join(' · ')}</span></div>`;
  const SPELLS_PER_PAGE=35,firstPageSpells=spells.slice(0,SPELLS_PER_PAGE);
  const spellPad=Array.from({length:Math.max(0,SPELLS_PER_PAGE-firstPageSpells.length)},()=>'<div class="p24-spellrow"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>').join('');
  const overflowSpellPages=Array.from({length:Math.ceil(Math.max(0,spells.length-SPELLS_PER_PAGE)/SPELLS_PER_PAGE)},(_,index)=>{
    const page=spells.slice(SPELLS_PER_PAGE+index*SPELLS_PER_PAGE,SPELLS_PER_PAGE+(index+1)*SPELLS_PER_PAGE);
    return `<section class="pdf-page pdf-page24 p24-spell-cont" data-sheet-page="${5+index}"><div class="p24-frame"></div><div class="pdf-box p24-cont-title"><div class="pdf-title">${esc(C.name)} · продолжение списка заклинаний</div></div><div class="pdf-box p24-spell-cont-table"><div class="p24-spellrow head"><span>ур.</span><span>название</span><span>время</span><span>дистанция</span><span>конц.</span><span>ритуал</span><span>матер.</span><span>заметки</span></div>${page.map(spellRow).join('')}</div></section>`;
  }).join('');
  const cantripAttackRow=(spell,attackBonus,saveDc,source)=>{
    const desc=spell.desc||'',dice=desc.match(/урон\s+(\d+)d(\d+)/i);
    if(!dice)return '';
    const level=totalLvl(),scale=level>=17?4:level>=11?3:level>=5?2:1;
    const damageType=desc.match(/урон\s+\d+d\d+\s*(\([^;]+\))/i)?.[1]||'';
    const damage=spell.id==='eldritch_blast'?`${dice[1]}d${dice[2]}/луч · ${scale} луча`:`урон ${+dice[1]*scale}d${dice[2]}${damageType?` ${damageType}`:''}`;
    const attack=/атака заклинанием/i.test(desc)?fmtMod(attackBonus):/спасбросок/i.test(desc)?`КС ${saveDc}`:'';
    return attack?`<tr><td>${esc(spell.ru)}</td><td>${attack}</td><td>${esc(damage)}</td><td>Заговор · ${esc(source)}</td></tr>`:'';
  };
  const cantripAttacks=casters.flatMap(c=>(C.cantrips[c.cls]||[]).map(id=>SPELLS.find(s=>s.id===id)).filter(Boolean).map(s=>cantripAttackRow(s,spellAttack(c.cls),spellSaveDc(c.cls),CLASSES[c.cls].name)));
  cantripAttacks.push(...racialSpells.filter(x=>x.spell.lvl===0).map(x=>cantripAttackRow(x.spell,x.attackBonus,x.saveDc,'дар расы')));
  const weapons=[...(C.inventory||[]).filter(i=>i.type==='weapon').map(it=>{const w=WEAPONS.find(x=>x[0]===it.id);return w?`<tr><td>${esc(w[1])}</td><td>${fmtMod(weaponAttack(w))}</td><td>${weaponDamage(w,it)}</td><td>${esc(w[5].split(',')[0])}</td></tr>`:''}),...cantripAttacks].join('')||'<tr><td colspan="4">—</td></tr>';
  const personality=C.personality||{};
  return `<div class="pdf-sheet">
    <div class="no-print-bar"><button class="btn primary" onclick="window.print()">🖨 Печать / PDF</button><span class="muted small">лист D&D 2024 · визуальный вариант</span></div>
    <section class="pdf-page pdf-page24 p24-page1" data-sheet-page="1"><div class="p24-frame"></div>
      <header class="p24-header"><div class="pdf-box p24-id"><div class="wide"><div class="pdf-cap">имя персонажа</div><b class="pdf-value">${esc(C.name)}</b></div><div><div class="pdf-cap">предыстория</div><b>${esc(BACKGROUNDS[C.bg].name)}</b></div><div><div class="pdf-cap">класс</div><b>${esc(clsText)}</b></div><div><div class="pdf-cap">вид</div><b>${esc(race.name)}${sub?` (${esc(sub.name)})`:''}</b></div><div><div class="pdf-cap">подкласс</div><b>${esc(subText||'—')}</b></div></div>
        <div class="pdf-box p24-stat p24-level"><span class="pdf-cap">уровень</span><strong>${totalLvl()}</strong><span class="pdf-cap">опыт ${C.xp||0}</span></div><div class="pdf-box p24-stat p24-ac"><span class="pdf-cap">класс защиты</span><strong>${armorClass()}</strong><span class="pdf-cap">${hasShield()?'щит ◇':''}</span></div><div class="pdf-box p24-stat p24-hp"><span class="pdf-cap">хиты</span><div class="pdf-row"><b>${esc(game.hpCur!=null?game.hpCur:maxHp())}</b><span>текущие</span></div><div class="pdf-row"><b>${esc(game.hpTemp||0)}</b><span>временные</span></div><div class="pdf-small">максимум ${maxHp()}</div></div><div class="pdf-box p24-stat"><span class="pdf-cap">кости хитов</span><strong>${esc(totalLvl()-(game.hdUsed||0))} / ${totalLvl()}</strong><span class="pdf-cap">${hitDiceStr()}</span></div><div class="pdf-box p24-stat p24-death"><span class="pdf-cap">спасброски от смерти</span><span class="pdf-small">Успехи ${[0,1,2].map(i=>esc(game.dsOk>i?'◆':'◇')).join(' ')}</span><span class="pdf-small">Провалы ${[0,1,2].map(i=>esc(game.dsFail>i?'◆':'◇')).join(' ')}</span></div>
      </header>
      <div class="p24-body"><div class="p24-col"><div class="pdf-box p24-pb"><span class="pdf-cap">бонус владения</span><strong>${fmtMod(pb())}</strong></div>${ABILS.slice(0,3).map(([id,n])=>ability(id,n)).join('')}<div class="pdf-box"><div class="pdf-title">истощение</div>${Array.from({length:6},(_,i)=>`<span class="p24-check${(game.exh||0)>i?' on':''}" style="display:inline-block;margin:2px 4px"></span>`).join('')}</div><div class="pdf-box"><div class="pdf-title">Героическое вдохновение</div>${game.insp?'●':'○'}</div><div class="pdf-box"><div class="pdf-title">владение снаряжением и умения</div><div class="pdf-small">${profs}</div></div></div>
        <div class="p24-col">${ABILS.slice(3).map(([id,n])=>ability(id,n)).join('')}</div>
        <div class="p24-col"><div class="p24-minirow p24-overview"><div class="pdf-box p24-mini"><span class="pdf-cap">инициатива</span><strong>${fmtMod(initiative())}</strong></div><div class="pdf-box p24-mini"><span class="pdf-cap">скорость</span><strong>${speed()}</strong>${rovingActive()?`<span class="pdf-cap">лазание/плавание ${speed()} фт</span>`:''}</div><div class="pdf-box p24-mini"><span class="pdf-cap">п. восприятие</span><strong>${passivePerception()}</strong><span class="pdf-cap">п. расследование ${passiveInvestigation()}</span></div><div class="pdf-box p24-mini"><span class="pdf-cap">состояния</span><strong>${esc(game.conditions||'')}</strong></div></div>
          <div class="pdf-box p24-weapons"><div class="pdf-title">оружие и боевые заговоры</div><table class="p24-table"><tr><th>название</th><th>бонус / сложность</th><th>урон / вид</th><th>заметки</th></tr>${weapons}</table></div><div class="pdf-box p24-features"><div class="pdf-title">умения и способности</div><ul>${features}</ul></div><div class="p24-notegrid"><div class="pdf-box"><div class="pdf-title">атаки и заклинания</div></div><div class="pdf-box"><div class="pdf-title">черты</div><div class="pdf-small">${[...(race.traits||[]),...(sub?.traits||[])].map(esc).join('<br>')||'—'}</div></div></div></div>
      </div>
    </section>
    <section class="pdf-page pdf-page24 p24-page2" data-sheet-page="2"><div class="p24-frame"></div><div class="pdf-box portrait"><div class="pdf-title">портрет</div>${C.portrait?`<img class="portrait-image" src="${esc(C.portrait)}" alt="Портрет персонажа">`:''}</div><div class="pdf-box allies"><div class="pdf-title">союзники и организации</div><div class="pdf-lines" style="height:92%">${esc(C.allies||'')}</div></div><div class="pdf-box goals"><div class="pdf-title">цели и задачи</div><div class="pdf-lines" style="height:93%">${esc(C.goals||'')}</div></div><div class="pdf-box extra"><div class="pdf-title">дополнительные способности и умения</div><div class="pdf-lines" style="height:90%">${esc(C.featuresNotes||'')}</div></div><div class="pdf-box treasure"><div class="pdf-title">сокровища</div><div class="pdf-lines" style="height:90%">${esc(C.treasure||'')}</div></div></section>
    <section class="pdf-page pdf-page24 p24-page3" data-sheet-page="3"><div class="p24-frame"></div>${Array.from({length:6},()=>`<div class="pdf-box"><div class="pdf-title">заметки</div></div>`).join('')}</section>
    <section class="pdf-page pdf-page24 p24-page4" data-sheet-page="4"><div class="p24-frame"></div>
      <div class="p24-spellhead"><div class="pdf-box p24-spell-main"><div class="pdf-cap">характеристика</div><b class="pdf-value">${casters.map(c=>ABIL_RU_FULL[CLASSES[c.cls].spellAbility]).join(', ')||''}</b><div class="pdf-title">ячейки заклинаний</div><div class="p24-slot-grid">${Array.from({length:3},(_,col)=>Array.from({length:3},(_,row)=>{const level=col*3+row+1;return `<span>${level}-й · ${slots[level-1]||0}</span>`}).join('')).join('')}</div></div>
        <div class="p24-statboxes">${[['размер',race.size],['грузоподъёмность',`${abil('str')*15} фун.`],['прыжок в высоту',`${Math.max(0,3+am('str'))} фт.`],['прыжок в длину',`${abil('str')} фт.`]].map(([label,value])=>`<div class="pdf-box p24-stat"><span class="pdf-cap">${label}</span><strong>${value}</strong></div>`).join('')}</div>
        <div class="pdf-box p24-appearance"><div class="pdf-title">внешность</div><div class="pdf-small">${[['Возраст',appearance.age],['Рост',appearance.height],['Вес',appearance.weight],['Глаза',appearance.eyes],['Кожа',appearance.skin],['Волосы',appearance.hair]].filter(([,value])=>value).map(([label,value])=>`${label}: ${esc(value)}`).join(' · ')}</div><div class="pdf-lines">${esc(appearance.details||'')}</div></div>
      </div>
      <div class="p24-spellbody"><div class="pdf-box p24-spelltable"><div class="pdf-title">список заклинаний персонажа</div><div class="p24-spellrow head"><span>ур.</span><span>название</span><span>время</span><span>дистанция</span><span>конц.</span><span>ритуал</span><span>матер.</span><span>заметки</span></div>${firstPageSpells.map(spellRow).join('')}${spellPad}</div>
        <div class="p24-spellside"><div class="pdf-box detail"><div class="pdf-title">предыстория и личные качества</div><div class="pdf-small">${esc(C.backstory||'')}<br>${Object.values(personality).map(v=>esc(v||'')).filter(Boolean).join('<br>')}</div></div><div class="pdf-box detail"><div class="pdf-title">снаряжение</div><div class="pdf-small">${(C.inventory||[]).map(i=>`${esc(itemName(i))}${(i.qty||1)>1?' ×'+i.qty:''}`).join('<br>')}</div></div><div class="p24-coinrow">${[['ММ',0],['СМ',0],['ЗМ',C.gold||0],['ЭМ',0],['ПМ',0]].map(([name,value])=>`<div class="pdf-box"><div class="pdf-title">${name}</div><b>${value||''}</b></div>`).join('')}</div></div>
      </div>
    </section>
    ${overflowSpellPages}
  </div>`;
}
// ================= Инициализация =================
loadLib();
const {value:_curId,error:_curError}=readStorage(LS_CUR);
if(!_curError&&_curId&&LIB.find(c=>c.id===_curId)){C=migrate(JSON.parse(JSON.stringify(LIB.find(c=>c.id===_curId))));TAB='main'}
render();
