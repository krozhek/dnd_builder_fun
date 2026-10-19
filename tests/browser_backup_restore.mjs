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
const maliciousIdPath = path.join(profile, 'malicious-id-backup.json');
const maliciousLanguagePath = path.join(profile, 'malicious-language-backup.json');
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

  await evaluate("createChar();C.name='Backup E2E';C.extraLangs=['Эльфийский'];persist()");
  const reloaded = waitFor('Page.loadEventFired');
  await send('Page.reload', { ignoreCache: true });
  await reloaded;
  const restoredSession = await evaluate(`(()=>({name:C?.name,id:C?.id,tab:TAB,library:LIB.length,language:C?.extraLangs?.[0]}))()`);
  if (restoredSession.name !== 'Backup E2E' || restoredSession.tab !== 'main' || restoredSession.library !== 1 || restoredSession.language !== 'Эльфийский') throw new Error('Current character did not survive page reload');

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
  fs.writeFileSync(maliciousIdPath, JSON.stringify({ ...backup, characters: [{ ...backup.characters[0], id: "');window.xssProbe();//" }] }));
  fs.writeFileSync(maliciousLanguagePath, JSON.stringify({ ...backup, characters: [{ ...backup.characters[0], extraLangs: ['<img src=x onerror="window.xssProbe()">'] }] }));

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
  const waitForCondition = async expression => {
    for (let i = 0; i < 100; i++) {
      await sleep(100);
      if (await evaluate(expression)) return true;
    }
    return false;
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
  const safeActions = await evaluate(`(()=>{const buttons=[...document.querySelectorAll('[data-character-action]')];return buttons.length===6&&buttons.every(button=>!button.hasAttribute('onclick'))&&!document.querySelector('.char-card [onerror],.char-card [onload],.char-card script')})()`);
  if (!safeActions) throw new Error('Character card actions contain unsafe event attributes or imported markup');
  const opened = await evaluate(`(()=>{document.querySelector('[data-character-action="open"]').click();return C.name})()`);
  if (opened !== 'Backup E2E') throw new Error('Delegated character action did not open the selected character');
  console.log('Browser E2E passed: persistence, valid imports, canceled/restored backups, malicious backup rejection, and delegated character actions.');
} finally {
  if (ws) ws.close();
  chrome.kill('SIGTERM');
  await sleep(250);
  fs.rmSync(profile, { recursive: true, force: true });
}
