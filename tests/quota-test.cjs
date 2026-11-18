// Regression of quota exception after cloud commit. Simulates Web Storage/IndexedDB transactions and server.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'../cloud.js'),'utf8');
const source=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const clone=x=>JSON.parse(JSON.stringify(x));
const key='vehiclehub_lite_cloud_base_v1',stateKey='vehiclehub_lite_v580';
const storage=new Map(),nodes=new Map(),bases=new Map();let quotaFailures=0,failIDB=false,rev=0,remote=null,pushes=0;
// Model IDB request/transaction ordering and atomic commit/abort; not a native browser test.
const idb={open(){const q={};queueMicrotask(()=>{q.result={objectStoreNames:{contains:()=>true},close(){},transaction(){const pending=new Map(bases);let aborted=false;const t={abort(){aborted=true;queueMicrotask(()=>t.onabort?.());},objectStore(){return {get(k){const r={};queueMicrotask(()=>{r.result=pending.get(k)?clone(pending.get(k)):undefined;r.onsuccess?.();});return r;},put(v,k){pending.set(k,clone(v));},delete(k){pending.delete(k);}}}};setImmediate(()=>{if(aborted)return;if(failIDB){t.error=new Error('IndexedDB quota');t.onabort?.();return;}bases.clear();for(const [k,v] of pending)bases.set(k,v);t.oncomplete?.();});return t;}};q.onsuccess?.();});return q;}};
async function server(action,b){if(action==='pull')return {revision:rev,...(b.knownRevision===rev?{unchanged:true}:{data:clone(remote)})};if(action==='push'){assert.equal(b.baseRevision,rev);remote=clone(b.data);pushes++;return {revision:++rev};}throw Error(action);}
function device(){const c=vm.createContext({console,Blob,Uint8Array,Date,Math,source,indexedDB:idb,localStorage:{getItem:k=>storage.get(k)??null,setItem(k,v){if(k===key){quotaFailures++;const e=new Error('exceeded the quota');e.name='QuotaExceededError';throw e;}storage.set(k,v);},removeItem:k=>storage.delete(k)},navigator:{onLine:true},mockServer:server,mockNode:id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:true,disabled:false,dataset:{},textContent:''});return nodes.get(id);}});vm.runInContext(src,c);const run=s=>vm.runInContext(s,c);run(`state=normalizeImportedData(JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')||source);cloudConfig={dataset:'test-dataset'};cloudEditsOpen=()=>false;cloudRequest=mockServer;cloudFiles=async()=>{};renderAll=()=>{};resetFuelForm=()=>{};resetMaintenanceForm=()=>{};showToast=()=>{};document={getElementById:mockNode};cloudApplying=true;persist(false);cloudApplying=false;cloudDisk=localStorage.getItem(STORAGE_KEY);`);return {run,c};}
(async()=>{
 let d=device(); // Recreate prior failed run: server already accepted records; writing old localStorage base failed.
 remote=clone(d.run('cloudPayload(state)'));rev=1;pushes=1;
 assert.throws(()=>d.run('localStorage.setItem(CLOUD_BASE,JSON.stringify({dataset:cloudConfig.dataset,revision:1,data:cloudPayload(state)}))'),/quota/);
 await d.run('cloudSync()');assert.equal(d.run('cloudBase.revision'),1);assert.equal(pushes,1);assert.equal(nodes.get('cloudStatus').dataset.kind,'ok');assert.equal(storage.has(key),false);assert.equal(quotaFailures,1);assert.equal(bases.get('test-dataset').data.fuel.length,101);
 // Reload: restore durable ancestor, and ensure repeat sync doesn't write same remote data again.
 d=device();await d.run('cloudSync()');assert.equal(pushes,1);assert.equal(d.run('cloudBase.revision'),1);
 // Old baseline migration: retain old value on failed transaction, then commit before removing it.
 const old=clone(bases.get('test-dataset'));bases.clear();storage.set(key,JSON.stringify(old));d=device();failIDB=true;await d.run('cloudSync()');assert.equal(nodes.get('cloudStatus').dataset.kind,'warn');assert.equal(storage.has(key),true);assert.equal(pushes,1);failIDB=false;await d.run('cloudSync()');assert.equal(storage.has(key),false);assert.equal(d.run('cloudBase.revision'),1);assert.equal(pushes,1);
 // Reject older baseline when another tab committed a newer one.
 d.c.old=old;const newer={...old,revision:2};bases.set('test-dataset',newer);await assert.rejects(()=>d.run('cloudBasePut(old)'),/其他分頁/);assert.equal(bases.get('test-dataset').revision,2);
 assert.equal(d.run('state.maintenance.length'),13);assert.equal(d.run('allRefs(state).length'),10);assert.equal(JSON.parse(storage.get(stateKey)).fuel.length,101);
 console.log('PASS quota recovery after remote commit, no duplicate push, reload, legacy migration rollback/retry, reject older ancestor; 101/13/10 references retained (storage/IDB/server mock)');
})().catch(e=>{console.error(e);process.exitCode=1});
