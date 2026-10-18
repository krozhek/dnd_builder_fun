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
    } else if (message.method === 'Page.javascriptDialogOpening') {
      send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
    } else if (message.method) {
      for (const listener of events.get(message.method) || []) listener(message.params);
      events.set(message.method, []);
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');
  const loaded = waitFor('Page.loadEventFired');
  await send('Page.navigate', { url: pathToFileURL(path.join(root, 'dnd_builder.html')).href });
  await loaded;

  await evaluate(`(()=>{
    const create=URL.createObjectURL.bind(URL);
    URL.createObjectURL=blob=>{window.__backupBlob=blob;return create(blob)};
    const click=HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click=function(){
      if(this.download?.startsWith('dnd-builder-backup-')){window.__backupName=this.download;return}
      return click.call(this)
    };
  })()`);
  await evaluate("createChar();C.name='Backup E2E';C.extraLangs=['Эльфийский'];persist();exportLibrary()");
  const exported = await evaluate(`(async()=>({name:window.__backupName,json:await window.__backupBlob.text()}))()`);
  if (!exported?.json) throw new Error('Backup export produced no JSON blob');
  fs.writeFileSync(backupPath, exported.json);
  const backup = JSON.parse(exported.json);
  if (backup.format !== 'dnd-builder-backup' || backup.characters.length !== 1 || backup.characters[0].name !== 'Backup E2E') throw new Error('Unexpected exported backup contents');

  await evaluate("createChar();C.name='Should Be Replaced';persist();goHome()");
  const documentNode = await send('DOM.getDocument');
  const input = await send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: '#importFile2' });
  if (!input.nodeId) throw new Error('Backup restore input not found on Heroes page');
  await send('DOM.setFileInputFiles', { files: [backupPath], nodeId: input.nodeId });
  await evaluate("document.querySelector('#importFile2').dispatchEvent(new Event('change',{bubbles:true}))");

  let restored;
  for (let i = 0; i < 100; i++) {
    await sleep(100);
    restored = await evaluate(`(()=>{const data=JSON.parse(localStorage.getItem('dnd5e2014_chars_v1')||'[]');return data.length===1&&data[0].name==='Backup E2E'&&data[0].extraLangs[0]==='Эльфийский'})()`);
    if (restored) break;
  }
  if (!restored) throw new Error('Backup restore did not replace the library with the exported character');
  console.log('Browser E2E passed: JSON backup exported, then restored over the existing library with character data intact.');
} finally {
  if (ws) ws.close();
  chrome.kill('SIGTERM');
  await sleep(250);
  fs.rmSync(profile, { recursive: true, force: true });
}
