#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const candidates = [process.env.CHROME_BIN, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
const chromePath = candidates.find(fs.existsSync);
if (!chromePath) throw new Error('Chrome not found; set CHROME_BIN to a Chrome/Chromium executable');

const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-backup-e2e-'));
const backupPath = path.join(profile, 'backup.json');
const singlePath = path.join(profile, 'single-character.json');
const duplicateIdsPath = path.join(profile, 'duplicate-ids-backup.json');
const portraitPath = path.join(profile, 'portrait.png');
const maliciousIdPath = path.join(profile, 'malicious-id-backup.json');
const maliciousLanguagePath = path.join(profile, 'malicious-language-backup.json');
const invalidSpellPath = path.join(profile, 'invalid-spell-character.json');
const chrome = spawn(chromePath, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let ws;

try {
  const activePort = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !fs.existsSync(activePort); i++) await sleep(100);
  if (!fs.existsSync(activePort)) throw new Error('Chrome DevTools did not start');
  const port = fs.readFileSync(activePort, 'utf8').split('\n')[0];
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  const events = new Map();
  const dialogResponses = [];
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const waitFor = method => new Promise(resolve => {
    const queue = events.get(method) || [];
    queue.push(resolve);
    events.set(method, queue);
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result?.value;
  };
  const waitForCondition = async expression => {
    for (let i = 0; i < 100; i++) {
      await sleep(100);
      if (await evaluate(expression)) return true;
    }
    return false;
  };
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result || {});
    } else if (message.method) {
      if (message.method === 'Page.javascriptDialogOpening') {
        const accept = dialogResponses.length ? dialogResponses.shift() : true;
        send('Page.handleJavaScriptDialog', { accept }).catch(() => {});
      }
      for (const listener of events.get(message.method) || []) listener(message.params);
      events.set(message.method, []);
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');
  const appUrl = pathToFileURL(path.join(root, 'dnd_builder.html')).href;
  const loaded = waitFor('Page.loadEventFired');
  await send('Page.navigate', { url: appUrl });
  await loaded;

  const portraitData = await evaluate(`(()=>{const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;const ctx=canvas.getContext('2d');ctx.fillStyle='#724';ctx.fillRect(0,0,2,2);return canvas.toDataURL('image/png')})()`);
  fs.writeFileSync(portraitPath, Buffer.from(portraitData.split(',')[1], 'base64'));
  await evaluate("createChar();C.name='Backup E2E';C.goals='Найти родной дом';C.appearance.age='120 лет';C.extraLangs=['Эльфийский'];persist()");
  const documentRoot = await send('DOM.getDocument');
  const portraitInput = await send('DOM.querySelector', { nodeId: documentRoot.root.nodeId, selector: '#portraitFile' });
  if (!portraitInput.nodeId) throw new Error('Portrait upload input not found');
  await send('DOM.setFileInputFiles', { files: [portraitPath], nodeId: portraitInput.nodeId });
  const portraitLoaded = await waitForCondition(`C?.portrait?.startsWith('data:image/jpeg;base64,')&&C.portrait.length<=200000&&!!document.querySelector('.sheet-portrait-preview')`);
  if (!portraitLoaded) throw new Error('Portrait was not compressed and saved');
  const reloaded = waitFor('Page.loadEventFired');
  await send('Page.reload', { ignoreCache: true });
  await reloaded;
  const restoredSession = await evaluate(`(()=>({name:C?.name,id:C?.id,tab:TAB,library:LIB.length,language:C?.extraLangs?.[0],goal:C?.goals,age:C?.appearance?.age,portrait:C?.portrait?.startsWith('data:image/jpeg;base64,')}))()`);
  if (restoredSession.name !== 'Backup E2E' || restoredSession.tab !== 'main' || restoredSession.library !== 1 || restoredSession.language !== 'Эльфийский' || restoredSession.goal !== 'Найти родной дом' || restoredSession.age !== '120 лет' || !restoredSession.portrait) throw new Error('Character data and portrait did not survive page reload');

  await evaluate(`(()=>{
    const create=URL.createObjectURL.bind(URL);
    URL.createObjectURL=blob=>{window.__backupBlob=blob;return create(blob)};
    const click=HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click=function(){
      if(this.download?.startsWith('dnd-builder-backup-')){window.__backupName=this.download;return}
      return click.call(this)
    };
  })()`);
  await evaluate('exportLibrary()');
  const exported = await evaluate(`(async()=>({name:window.__backupName,json:await window.__backupBlob.text()}))()`);
  if (!exported?.json) throw new Error('Backup export produced no JSON blob');
  fs.writeFileSync(backupPath, exported.json);
  const backup = JSON.parse(exported.json);
  if (backup.format !== 'dnd-builder-backup' || backup.characters.length !== 1 || backup.characters[0].name !== 'Backup E2E') throw new Error('Unexpected exported backup contents');
  const single = { ...backup.characters[0], id: 'single-import-e2e', name: 'Single Import E2E' };
  fs.writeFileSync(singlePath, JSON.stringify(single));
  fs.writeFileSync(duplicateIdsPath, JSON.stringify({ ...backup, characters: [backup.characters[0], { ...backup.characters[0], name: 'Duplicate ID' }] }));
  fs.writeFileSync(maliciousIdPath, JSON.stringify({ ...backup, characters: [{ ...backup.characters[0], id: "');window.xssProbe();//" }] }));
  fs.writeFileSync(maliciousLanguagePath, JSON.stringify({ ...backup, characters: [{ ...backup.characters[0], extraLangs: ['<img src=x onerror="window.xssProbe()">'] }] }));
  fs.writeFileSync(invalidSpellPath, JSON.stringify({ ...backup.characters[0], id: 'invalid-spell-e2e', classes: [{ cls: 'bard', lvl: 1, sub: 'lore' }], cantrips: {}, spellsKnown: { bard: ['mage_armor'] }, spellsPrepared: {}, spellbook: [] }));

  await evaluate("createChar();C.name='Should Be Replaced';persist();goHome()");
  const findImportInput = async () => {
    const document = await send('DOM.getDocument');
    const result = await send('DOM.querySelector', { nodeId: document.root.nodeId, selector: '#importFile2' });
    if (!result.nodeId) throw new Error('Import input not found on Heroes page');
    return result.nodeId;
  };
  const submitFile = async file => {
    const nodeId = await findImportInput();
    await send('DOM.setFileInputFiles', { files: [file], nodeId });
  };


  dialogResponses.push(false);
  const canceled = waitFor('Page.javascriptDialogOpening');
  await submitFile(backupPath);
  const cancelDialog = await canceled;
  if (cancelDialog.type !== 'confirm') throw new Error(`Expected restore confirmation, got ${cancelDialog.type}`);
  const canceledInputReset = await waitForCondition(`document.querySelector('#importFile2')?.value===''`);
  if (!canceledInputReset) throw new Error('Canceled restore did not finish processing the selected file');
  const unchanged = await evaluate(`(()=>{const data=JSON.parse(localStorage.getItem('dnd5e2014_chars_v1')||'[]');return data.length===2&&data.some(c=>c.name==='Should Be Replaced')})()`);
  if (!unchanged) throw new Error('Canceling backup restore changed the library');

  const accepted = waitFor('Page.javascriptDialogOpening');
  await submitFile(backupPath);
  const acceptDialog = await accepted;
  if (acceptDialog.type !== 'confirm') throw new Error(`Expected restore confirmation, got ${acceptDialog.type}`);
  const replaced = await waitForCondition(`(()=>{const data=JSON.parse(localStorage.getItem('dnd5e2014_chars_v1')||'[]');return data.length===1&&data[0].name==='Backup E2E'&&data[0].extraLangs[0]==='Эльфийский'})()`);
  const restoredInputReset = await waitForCondition(`document.querySelector('#importFile2')?.value===''`);
  if (!replaced || !restoredInputReset) throw new Error('Accepting backup restore did not replace the library');

  await submitFile(singlePath);
  const imported = await waitForCondition(`(()=>{const data=JSON.parse(localStorage.getItem('dnd5e2014_chars_v1')||'[]');return data.length===2&&data.some(c=>c.name==='Single Import E2E')})()`);
  if (!imported) throw new Error('Importing a single character did not add it to the library');

  const duplicateDialogWait = waitFor('Page.javascriptDialogOpening');
  await submitFile(duplicateIdsPath);
  const duplicateDialog = await duplicateDialogWait;
  if (duplicateDialog.type !== 'alert' || !duplicateDialog.message.includes('Некорректная резервная копия')) throw new Error('Backup with duplicate character IDs was not rejected');
  const duplicateUnchanged = await waitForCondition(`(()=>{const data=JSON.parse(localStorage.getItem('dnd5e2014_chars_v1')||'[]');return data.length===2&&data.every((c,i)=>data.findIndex(other=>other.id===c.id)===i)})()`);
  if (!duplicateUnchanged) throw new Error('Rejecting duplicate IDs changed the character library');

  await evaluate('window.__xssFired=false;window.xssProbe=()=>{window.__xssFired=true}');
  for (const file of [maliciousIdPath, maliciousLanguagePath]) {
    const dialogWait = waitFor('Page.javascriptDialogOpening');
    await submitFile(file);
    const dialog = await dialogWait;
    if (dialog.type !== 'alert' || !dialog.message.includes('Некорректная резервная копия')) throw new Error(`Malicious import was not rejected: ${dialog.message}`);
    const inputReset = await waitForCondition(`document.querySelector('#importFile2')?.value===''`);
    const unchanged = await evaluate(`(()=>{const data=JSON.parse(localStorage.getItem('dnd5e2014_chars_v1')||'[]');return !window.__xssFired&&data.length===2&&data.some(c=>c.name==='Single Import E2E')})()`);
    if (!inputReset || !unchanged) throw new Error('Malicious import executed or changed the character library');
  }
  const invalidSpellDialogWait = waitFor('Page.javascriptDialogOpening');
  await submitFile(invalidSpellPath);
  const invalidSpellDialog = await invalidSpellDialogWait;
  if (invalidSpellDialog.type !== 'alert' || !invalidSpellDialog.message.includes('корректного персонажа')) throw new Error('Class-incompatible spell selection was not rejected on import');
  const invalidSpellUnchanged = await waitForCondition(`(()=>{const data=JSON.parse(localStorage.getItem('dnd5e2014_chars_v1')||'[]');return data.length===2&&data.every(c=>c.id!=='invalid-spell-e2e')})()`);
  if (!invalidSpellUnchanged) throw new Error('Invalid spell import changed the character library');

  const safeActions = await evaluate(`(()=>{const buttons=[...document.querySelectorAll('[data-character-action]')];return buttons.length===6&&buttons.every(button=>!button.hasAttribute('onclick'))&&!document.querySelector('.char-card [onerror],.char-card [onload],.char-card script')})()`);
  if (!safeActions) throw new Error('Character card actions contain unsafe event attributes or imported markup');
  const opened = await evaluate(`(()=>{document.querySelector('[data-character-action="open"]').click();return C.name})()`);
  if (opened !== 'Backup E2E') throw new Error('Delegated character action did not open the selected character');

  const rulesSmoke = await evaluate(`(()=>{
    const currentId=C.id,c=newChar();c.id=currentId;c.name='Rules E2E';c.race='elf';c.subrace='high';c.bg='soldier';c.classes=[{cls:'wizard',lvl:1,sub:'evocation'},{cls:'bard',lvl:1,sub:'lore'}];
    c.abilityMethod='manual';c.bases.manual={str:10,dex:14,con:10,int:13,wis:10,cha:13};c.classSkills={wizard:['arcana','history'],bard:['persuasion']};
    c.choices.backgroundTools=[];c.choices.classTools={};
    c.inventory=[{type:'armor',id:'chainmail',qty:1,equipped:true},{type:'shield',id:'shield',qty:1,equipped:true},{type:'weapon',id:'longbow',qty:1,wielded:true}];
    C=c;TAB='main';render();
    let toolPicker=document.querySelector('#main select[multiple]');
    toolPicker.querySelector('option[value="Лютня"]').selected=true;toolPicker.dispatchEvent(new Event('change',{bubbles:true}));
    const bgPicker=[...document.querySelectorAll('#main select')].find(select=>[...select.options].some(option=>option.value==='Игровой набор (кости)'));
    bgPicker.value='Игровой набор (кости)';bgPicker.dispatchEvent(new Event('change',{bubbles:true}));
    const main=document.querySelector('#main').innerText;toolPicker=document.querySelector('#main select[multiple]');
    const profs=weaponProf('longbow')&&!weaponProf('rapier')&&toolProficiencies().includes('Лютня')&&toolProficiencies().includes('Игровой набор (кости)');
    TAB='equip';render();const equip=document.querySelector('#main').innerText;
    TAB='cls';render();const cls=document.querySelector('#main').innerText;
    return {profs,toolPicker:!!toolPicker,backgroundChoice:main.includes('Игровой набор (1 на выбор)'),armorWarning:equip.includes('нельзя накладывать заклинания'),multiclassArmor:cls.includes('Доспехи: лёгкие')};
  })()`);
  if (!rulesSmoke.profs || !rulesSmoke.toolPicker || !rulesSmoke.backgroundChoice || !rulesSmoke.armorWarning || !rulesSmoke.multiclassArmor) throw new Error(`Proficiency UI smoke test failed: ${JSON.stringify(rulesSmoke)}`);

  const corruptLibrary = '{damaged-local-library';
  await evaluate(`localStorage.setItem('dnd5e2014_chars_v1',${JSON.stringify(corruptLibrary)})`);
  const recoveredLoad = waitFor('Page.loadEventFired');
  await send('Page.reload', { ignoreCache: true });
  await recoveredLoad;
  const protectedState = await evaluate(`(()=>({corrupt:STORAGE_CORRUPT,library:LIB.length,raw:localStorage.getItem('dnd5e2014_chars_v1')}))()`);
  if (!protectedState.corrupt || protectedState.library !== 0 || protectedState.raw !== corruptLibrary) throw new Error('Corrupt library was not preserved behind the safe fallback');
  await evaluate("createChar();C.name='Unsaved after corruption';persist();goHome()");
  const stillProtected = await evaluate(`localStorage.getItem('dnd5e2014_chars_v1')`);
  if (stillProtected !== corruptLibrary) throw new Error('A normal edit overwrote the corrupt library');
  const recoveryDialogWait = waitFor('Page.javascriptDialogOpening');
  await submitFile(backupPath);
  const recoveryDialog = await recoveryDialogWait;
  if (recoveryDialog.type !== 'confirm') throw new Error('Restoring over a corrupt library did not require confirmation');
  const recovered = await waitForCondition(`(()=>{const data=JSON.parse(localStorage.getItem('dnd5e2014_chars_v1')||'[]');return !STORAGE_CORRUPT&&data.length===1&&data[0].name==='Backup E2E'})()`);
  if (!recovered) throw new Error('Confirmed backup did not recover the corrupt library');
  console.log('Browser E2E passed: persistence, semantic import rejection, proficiency UI, XSS protection, and corrupt-storage recovery.');
} finally {
  if (ws) ws.close();
  chrome.kill('SIGTERM');
  await sleep(250);
  fs.rmSync(profile, { recursive: true, force: true });
}
