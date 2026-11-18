const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const root=path.resolve(__dirname,'..'),code=fs.readFileSync(path.join(root,'app.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'ocr.js'),'utf8');const ctx=vm.createContext({console,Date,Blob,URL,confirm:()=>true});vm.runInContext(code,ctx);const run=s=>vm.runInContext(s,ctx);const parse=s=>{ctx.input=s;return run('ocrParse(input)')},v=(p,k)=>p.fields[k]?.value;
// Synthetic Taiwanese repair order. Uses no private vehicle, plate, service, or invoice identifiers.
const sample=`測試汽車有限公司
工作單號: TEST00001
車牌：ABC-1234
車型：SAMPLE ONE
入廠日期 115/10/15 102082公里
印表日期 115/10/16
保養工資 600
零件甲 546 4.5 546 2457
零件乙 160 1.0 160 160
工資小計 600
零件小計 2617
本單總額 3217
折扣 -246
下次保養116/04/13
107082公里`;
let p=parse(sample);assert.equal(v(p,'date'),'2026-10-15');assert.equal(v(p,'invoiceDate'),'2026-10-16');assert.equal(v(p,'odometer'),102082);assert.equal(v(p,'nextKm'),107082);assert.equal(v(p,'nextDate'),'2027-04-13');assert.equal(v(p,'parts'),2617);assert.equal(v(p,'labor'),600);assert.equal(v(p,'total'),2971);assert.equal(p.mode,'separate');assert.equal(p.details.length,3);assert.equal(p.details[1].qty,4.5);assert.equal(p.details[1].amount,2457);assert.equal(p.fields.total.kind,'推算待核對');
p=parse('進廠日期：2026/11/18\n開單日期：2026/11/19\n零件小計：1000\n工資小計：200\n折扣：100\n實付金額：1200\n工資 | 工資甲 | 1 | 200 | 200\n零件 | 零件甲 | 2 | 500 | 1000');assert.equal(v(p,'total'),1200);assert.equal(p.mode,'included');assert.equal(p.details.length,2);
p=parse('開單日期：115/10/16\n下次保養里程：107082\n里程 102O82\n零件小計：1000\n工資小計：200\n本單總額：990\n折扣：100');assert.equal(v(p,'date'),undefined);assert.equal(v(p,'odometer'),undefined);assert.equal(v(p,'total'),undefined);
p=parse('進廠日期：115/02/30\n實付金額：1000\n實付金額：1200\n實付金額：1000');assert.equal(v(p,'date'),undefined);assert.equal(v(p,'total'),undefined);assert.equal(p.fields.paid.value,null);
p=parse('工資小計 零件小計 合計 稅額 本單總額\n600 1000 1600 0 1600');assert.equal(v(p,'labor'),600);assert.equal(v(p,'parts'),1000);assert.equal(v(p,'total'),1600);assert.equal(p.mode,'manual');
p=parse('維修廠：<img src=x onerror=alert(1)>\n零件 | 零件甲 | 2 | 100 | 150');assert.equal(p.details.length,1);assert.match(p.warnings.join(' '),/小計不符/);
ctx.parsed=parse(sample);ctx.vehicles=[{id:'a',name:'SAMPLE ONE',plate:'ABC-1234'},{id:'b',name:'SAMPLE TWO',plate:'ABC-2222'}];assert.equal(run('ocrIdentity(parsed,vehicles[1],vehicles).blocked'),true);assert.equal(run('ocrIdentity(parsed,vehicles[0],vehicles).blocked'),false);
console.log('PASS OCR 文字候選：民國日期、雙日期、雙里程、工資/零件、折扣、數量/單價、未確定欄、衝突、跨車保護');
// Mock DOM and actual apply function, original-file storage, review / no changes to records before save.
const nodes=new Map();const getNode=id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,disabled:false,checked:false,dataset:{},style:{},textContent:'',innerHTML:'',classList:{toggle(){},remove(){},contains(){return false}},scrollIntoView(){},removeAttribute(){},addEventListener(){},reset(){}});return nodes.get(id)};
ctx.document={getElementById:getNode};ctx.mockPut=async(id,b)=>{ctx.savedFile={id,b};};ctx.file=new Blob(['fake'],{type:'image/jpeg'});ctx.input=sample;ctx.console=console;run(`state={vehicles,settings:{lastVehicleId:'a'},fuel:[],maintenance:[]};editorVehicle.maintenance='a';el('maintenanceEditor').hidden=false;el('maintenanceId').value='';putAttachment=mockPut;showToast=()=>{};renderDetailEditor=()=>{};renderAttachmentEditor=()=>{};ocrDraft={file,name:'sample.jpg',vehicleId:'a',raw:input,method:'drive',parsed:ocrParse(input),sourceText:input,applied:false};el('ocrText').value=input;`);
(async()=>{await run('ocrApply()');assert.equal(getNode('maintenanceDate').value,'2026-10-15');assert.equal(getNode('maintenanceTotal').value,'2971');assert.equal(run('editDetails.length'),3);assert.equal(run('editAttachments.length'),1);assert.equal(ctx.savedFile.b.size,4);assert.equal(run('state.maintenance.length'),0);assert.equal(run('ocrCanSave()'),false);getNode('ocrReviewed').checked=true;assert.equal(run('ocrCanSave()'),true);assert.equal(run('ocrRecordMetadata().rawText'),sample);assert.equal(run('ocrRecordMetadata().parsedText'),'');run('editAttachments=[]');assert.equal(run('ocrCanSave()'),false);await run('ocrAttachOnly()');assert.equal(run('editAttachments.length'),1);assert.equal(run('ocrCanSave()'),true);
run(`state.settings.lastVehicleId='b';editorVehicle.maintenance='b';resetOcrUI();ocrDraft={file:null,name:'',vehicleId:'b',raw:input,method:'manual',parsed:ocrParse(input),sourceText:input,applied:false};el('ocrText').value=input;el('maintenanceTotal').value='';`);await run('ocrApply()');assert.equal(getNode('maintenanceTotal').value,'');assert.equal(run('ocrDraft.applied'),false);
// Verify server response from a cancelled or switched form cannot be applied.
run(`state.settings.lastVehicleId='a';editorVehicle.maintenance='a';el('maintenanceEditor').hidden=false;ocrDraft={file,name:'sample.jpg',vehicleId:'a',raw:'',method:'',parsed:null,applied:false};`);ctx.navigator={onLine:true};ctx.fakeReply=()=>new Promise(r=>{ctx.resolveReply=r});run('globalThis.cloudConfig={};ocrPrepared=async f=>f;blobData=async()=>"YWJj";globalThis.cloudRequest=fakeReply;');const task=run('ocrRun("drive")');await new Promise(r=>setImmediate(r));assert.equal(typeof ctx.resolveReply,'function');run('resetOcrUI();editorVehicle.maintenance="b";state.settings.lastVehicleId="b";fileBusy=false;');ctx.resolveReply({text:sample,rawText:sample});await task;assert.equal(run('ocrDraft'),null);assert.equal(getNode('maintenanceTotal').value,'');
console.log('PASS 套表及原圖保留、未儲存不寫資料、人工核對必要、跨車攔截、取消後過期回應丟棄（DOM/IndexedDB 模擬）');})().catch(e=>{console.error(e);process.exitCode=1});
