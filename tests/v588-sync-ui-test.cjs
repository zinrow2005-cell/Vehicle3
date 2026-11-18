const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const root=path.resolve(__dirname,'..'),source=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const code=fs.readFileSync(path.join(root,'app.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'cloud.js'),'utf8');
const nodes=new Map(),store=new Map(),bases=new Map(),timers=[];
const getNode=id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,disabled:false,dataset:{},textContent:'',innerHTML:'',classList:{toggle(){}},reset(){},setAttribute(){},addEventListener(t,f){this[t]=f}});return nodes.get(id)};
let remote=null,rev=0,pushes=0,hook=null,editOpen=false;
const clone=x=>JSON.parse(JSON.stringify(x));
const server=async(action,b)=>{if(action==='pull'){if(hook){const fn=hook;hook=null;fn();}return {revision:rev,...(b.knownRevision===rev?{unchanged:true}:{data:clone(remote)})};}if(action==='push'){assert.equal(b.baseRevision,rev);remote=clone(b.data);pushes++;return {revision:++rev};}throw Error(action)};
const ctx=vm.createContext({console,source,navigator:{onLine:true},localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},setTimeout:(f,ms)=>{timers.push({f,ms});return timers.length},clearTimeout:()=>{},confirm:()=>true,getNode,server,baseGet:async k=>clone(bases.get(k)||null),basePut:async b=>bases.set(b.dataset,clone(b)),mockEdit:()=>editOpen});
vm.runInContext(code,ctx);const run=s=>vm.runInContext(s,ctx);
ctx.document={getElementById:getNode,querySelectorAll:()=>[],querySelector:()=>({click(){}})};
run('state=normalizeImportedData(source);cloudConfig={dataset:"demo"}; cloudRequest=server;cloudBaseGet=baseGet;cloudBasePut=basePut;cloudEditsOpen=mockEdit;cloudFiles=async()=>{};showToast=()=>{};renderAll=()=>cloudRenderCounts();resetFuelForm=()=>{};resetMaintenanceForm=()=>{};cloudApplying=true;persist(false);cloudApplying=false;cloudDisk=localStorage.getItem(STORAGE_KEY);');
(async()=>{
 run('cloudRenderCounts()');assert.equal(getNode('cloudCompareBase').textContent,'尚未確認');
 run('state.settings.lastVehicleId="v2"');await run('cloudSync()');assert.equal(rev,1);assert.equal(pushes,1);assert.match(getNode('cloudCompareLocal').textContent,/加油 23 筆 · 維修 7 筆/);assert.equal(getNode('cloudCompareBase').textContent,getNode('cloudCompareLocal').textContent);assert.match(getNode('cloudCompareMatch').textContent,/一致/);
 run('state.settings.lastVehicleId="v1";cloudRenderCounts()');assert.match(getNode('cloudCompareLocal').textContent,/加油 78 筆 · 維修 6 筆/);assert.equal(getNode('cloudCompareBase').textContent,getNode('cloudCompareLocal').textContent);
 run('state.fuel.find(r=>r.vehicleId==="v1").amount+=1;cloudRenderCounts()');assert.equal(getNode('cloudCompareLocal').textContent,getNode('cloudCompareBase').textContent);assert.match(getNode('cloudCompareMatch').textContent,/有差異/);run('state.fuel.find(r=>r.vehicleId==="v1").amount-=1');
 editOpen=true;await run('cloudSync()');assert.equal(run('cloudDeferred'),true);assert.match(getNode('cloudStatus').textContent,/儲存或取消/);timers.length=0;editOpen=false;run('cloudResumeAfterEdit()');assert.equal(run('cloudDeferred'),false);assert.equal(timers.at(-1).ms,50);
 // Real sync routine: a save scheduling another sync while the first pull is active.
 timers.length=0;hook=()=>run('cloudSchedule(50)');await run('cloudSync()');assert.equal(run('cloudQueued'),false);assert.equal(timers.at(-1).ms,250);assert.equal(pushes,1);
 // A vehicle switch is saved during a pull. Do not overwrite the new selection; queue retry.
 timers.length=0;hook=()=>run('state.settings.lastVehicleId="v2";persist(false)');await run('cloudSync()');assert.equal(run('getSelectedVehicleId()'),'v2');assert.equal(timers.at(-1).ms,250);await run('cloudSync()');assert.equal(pushes,1);assert.equal(getNode('cloudStatus').dataset.kind,'ok');
 // Scoped restore: the most recent global trash entry belongs to another vehicle.
 run('cloudApplying=true;rememberDeleted("fuel",state.fuel.find(r=>r.vehicleId==="v2"));rememberDeleted("fuel",state.fuel.find(r=>r.vehicleId==="v1"));state.fuel=state.fuel.filter(r=>!state.trash.some(t=>t.record.id===r.id));persist(false);cloudApplying=false;renderAll();bindDataActions()');
 const other=run('state.trash.at(-1).record.id');getNode('restoreDeleted').onclick();assert.equal(run('state.trash.length'),1);assert.equal(run('state.trash[0].record.vehicleId'),'v1');ctx.other=other;assert.equal(run('state.fuel.some(r=>r.id===other)'),false);
 console.log('PASS 兩車本機／最近確認筆數、同筆數內容差異、暫緩續接、同步中排程、切車保留、此車復原（真實備份與模擬伺服器/DOM）');
})().catch(e=>{console.error(e);process.exitCode=1});
