import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const app=read('app.js'),css=read('styles.css'),html=read('index.html');
const fail=m=>{console.error('FAIL:',m);process.exitCode=1;};
const pass=m=>console.log('PASS:',m);
if(!app.includes('function isCoarseTouchInput()')) fail('missing coarse-touch detection for modal input'); else pass('coarse-touch modal detection exists');
const auth=read('auth-sync.js'); if(auth.includes("addEventListener('touchend'")||auth.includes("input?.addEventListener('click'")) fail('login fields still override native iPad tap focus'); else pass('login fields preserve native iPad tap focus');
if(!app.includes('if(!isCoarseTouchInput()) setTimeout(()=>form.querySelector')) fail('modal autofocus is not disabled on touch devices'); else pass('touch modals do not programmatically autofocus');
if(!app.includes("type==='number'?'inputmode=\"decimal\"'")) fail('dynamic number inputs do not request numeric/decimal keyboard'); else pass('dynamic number inputs request decimal keypad');
if(!app.includes('inputmode="text"')) fail('dynamic textarea/text inputmode hint missing'); else pass('dynamic text input hint exists');
if(!css.includes('V5.6.6 iPhone/iPad all-form input hardening')) fail('all-form touch CSS missing'); else pass('all-form touch CSS exists');
if(!css.includes('font-size:16px!important')||!css.includes('pointer-events:auto')||!css.includes('-webkit-user-select:text')) fail('touch writable-field protections incomplete'); else pass('touch writable-field protections complete');
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(x=>x[1]);
for(const id of ['loginUsername','loginPassword','appsScriptUrl','cloudPassword','vehicleForm','quickFuelForm','modalForm']){if(!ids.includes(id))fail(`missing input surface ${id}`);else pass(`input surface exists: ${id}`);}
if(process.exitCode) process.exit(process.exitCode);
console.log('PASS: V5.6.6 iPhone/iPad all-input guard regression passed.');
