/* Vehicle Hub Lite 5.8.4 | paired, revision-checked cloud sync */
const CLOUD_CONFIG='vehiclehub_lite_cloud_config_v1', CLOUD_BASE='vehiclehub_lite_cloud_base_v1';
let cloudConfig=null, cloudBase=null, cloudBusy=false, cloudTimer=null, cloudConflicts=[], cloudConflictStamp='', cloudApplying=false, cloudDisk=null, cloudTabStale=false;
const cloudCopy=x=>JSON.parse(JSON.stringify(x));
function cloudPayload(data){
  const list=(a,sortKey)=>cloudCopy(a||[]).sort((x,y)=>String(sortKey(x))<String(sortKey(y))?-1:String(sortKey(x))>String(sortKey(y))?1:0);
  let vehicles=list(data.vehicles,v=>v.id).map(({odometer,odometerDate,odometerEstimated,...v})=>v);
  if(vehicles.length===1&&vehicles[0].id==='local-default'&&vehicles[0].name==='我的車輛'&&!vehicles[0].plate&&!vehicles[0].fuelType&&!data.fuel.length&&!data.maintenance.length&&!(data.tombstones||[]).length)vehicles=[];
  return {vehicles,fuel:list(data.fuel,r=>r.id),maintenance:list(data.maintenance,r=>r.id),trash:list(data.trash,t=>t.at+'|'+t.key+'|'+t.record.id),tombstones:list(data.tombstones,t=>t.key+'|'+t.id)};
}
function cloudMerge(base,local,remote,choice=''){
  const out={vehicles:[],fuel:[],maintenance:[],trash:[],tombstones:[]},conflicts=[];
  const eq=(a,b)=>stable(a)===stable(b), active=(d,k,id)=>(d?.[k]||[]).find(r=>r.id===id)||null;
  const erased=(d,k,id)=>!!d?.tombstones?.some(t=>t.key===k&&t.id===id);
  const entry=(d,k,id)=>{const r=active(d,k,id);return r?{row:r}:erased(d,k,id)?{deleted:true}:null;};
  for(const k of ['vehicles','fuel','maintenance']){
    const ids=new Set();for(const d of [base,local,remote]){for(const r of d?.[k]||[])ids.add(r.id);for(const t of d?.tombstones||[])if(t.key===k)ids.add(t.id);}
    for(const id of ids){const b=entry(base,k,id),l=entry(local,k,id),r=entry(remote,k,id);let v;
      if(eq(l,r))v=l;else if(base&&eq(l,b))v=r;else if(base&&eq(r,b))v=l;else if(!base&&!l)v=r;else if(!base&&!r)v=l;
      else {conflicts.push({key:k,id,reason:'同一紀錄有不同變更（含刪除）',base:b,local:l,remote:r});v=choice==='remote'?r:l;}
      if(v?.row)out[k].push(v.row);else if(k!=='vehicles'&&(v?.deleted||b?.row))out.tombstones.push({key:k,id});
    }
  }
  // Detect cross-device independent duplicate records; never silently discard either copy.
  for(const k of ['fuel','maintenance']){
    const groups=new Map();for(const r of out[k]){const key=duplicateKey(k,r);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
    for(const group of groups.values())if(group.length>1){const ids=group.map(x=>x.id);const bothIn=d=>ids.every(id=>active(d,k,id));if(bothIn(local)||bothIn(remote))continue;
      conflicts.push({key:k,id:ids.join('|'),reason:'不同裝置新增疑似重複紀錄',local:group.filter(x=>active(local,k,x.id)),remote:group.filter(x=>active(remote,k,x.id))});
      if(choice){const preferred=choice==='remote'?remote:local;const keep=group.filter(x=>active(preferred,k,x.id));if(keep.length){const remove=ids.filter(id=>!keep.some(r=>r.id===id));out[k]=out[k].filter(r=>!remove.includes(r.id));for(const id of remove)out.tombstones.push({key:k,id});}}
    }
  }
  const tomb=new Map(out.tombstones.map(t=>[t.key+'|'+t.id,t]));out.tombstones=[...tomb.values()];
  const trash=new Map();for(const d of [base,remote,local])for(const t of d?.trash||[])if(tomb.has(t.key+'|'+t.record.id))trash.set(t.key+'|'+t.record.id,t);
  // Preserve a recoverable record when another device deleted it.
  for(const t of out.tombstones){const id=t.key+'|'+t.id;if(!trash.has(id)){const old=active(local,t.key,t.id)||active(remote,t.key,t.id)||active(base,t.key,t.id);if(old)trash.set(id,{key:t.key,record:old,at:'1970-01-01T00:00:00.000Z'});}}
  out.trash=[...trash.values()];
  const ids=new Set(out.vehicles.map(v=>v.id));for(const k of ['fuel','maintenance'])for(const r of out[k])if(!ids.has(r.vehicleId))conflicts.push({key:k,id:r.id,reason:'所屬車輛不存在，需先修正車輛資料',blocking:true});
  return {data:cloudPayload(out),conflicts};
}
function cloudStatus(message,kind='neutral'){
  el('cloudStatus').textContent=message;el('cloudStatus').dataset.kind=kind;el('cloudBarStatus').textContent=message;el('cloudBarStatus').dataset.kind=kind;
  el('cloudLast').textContent=cloudBase?`最近確認雲端 r${cloudBase.revision}｜${new Date(cloudBase.checkedAt).toLocaleString('zh-TW')}`:'尚未完成第一次同步';
  el('cloudSyncNow').disabled=!cloudConfig||cloudBusy;el('cloudDisconnect').disabled=!cloudConfig||cloudBusy;el('cloudPair').disabled=cloudBusy;
  el('cloudConflictPanel').hidden=!cloudConflicts.length;
}
function cloudRead(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch(e){return null;}}
function cloudEndpoint(url){const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='script.google.com'||!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname)||u.search||u.hash||u.username||u.password)throw new Error('請貼上正式 Google Apps Script /exec 部署網址');return u.href;}
async function cloudRequest(action,data={},config=cloudConfig){
  const ctl=typeof AbortController!=='undefined'?new AbortController():null;const timer=setTimeout(()=>ctl?.abort(),120000);
  try{const res=await fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({action:'lite.'+action,key:config.key,...data}),cache:'no-store',redirect:'follow',...(ctl?{signal:ctl.signal}:{})});if(!res.ok)throw new Error('雲端 HTTP '+res.status);let result;try{result=await res.json();}catch(e){throw new Error('部署回應不是 JSON，請確認 Web App 權限及版本');}if(!result.ok){const e=new Error(result.message||'雲端拒絕操作');e.code=result.code;throw e;}if(result.protocol!==1||typeof result.dataset!=='string')throw new Error('後端版本不相容，請更新 Apps Script');if(config.dataset&&result.dataset!==config.dataset)throw new Error('雲端資料庫識別碼不同，請重新配對');return result;
  }finally{clearTimeout(timer);}
}
function cloudEditsOpen(){return fileBusy||cloudImportBusy||['fuel','maintenance'].some(k=>editorVehicle[k]&&!el(k+'Editor').hidden)||['vehicleName','vehicleFuelType','vehiclePlate'].includes(document.activeElement?.id)||!!(el('vehicleForm')&&(el('vehicleName').value!==(getSelectedVehicle()?.name||'')||el('vehicleFuelType').value!==(getSelectedVehicle()?.fuelType||'')||el('vehiclePlate').value!==(getSelectedVehicle()?.plate||'')));}
function cloudCanApply(raw,signature){return !cloudTabStale&&localStorage.getItem(STORAGE_KEY)===raw&&stable(cloudPayload(state))===signature&&!cloudEditsOpen();}
async function cloudHash(blob){if(!globalThis.crypto?.subtle)throw new Error('此瀏覽器不支援安全附件雜湊，請使用 HTTPS 網站及更新瀏覽器');const ab=await new Promise((yes,no)=>{const r=new FileReader();r.onload=()=>yes(r.result);r.onerror=no;r.readAsArrayBuffer(blob);});return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',ab)),x=>x.toString(16).padStart(2,'0')).join('');}
async function cloudFiles(data){
  const refs=[...new Map(allRefs(data).map(x=>[x.id,x])).values()];if(!refs.length)return;const info=(await cloudRequest('fileIndex',{ids:refs.map(r=>r.id)})).files;
  for(let i=0;i<refs.length;i++){
    const ref=refs[i];if(!validAttachmentRef(ref))throw new Error('附件引用格式錯誤');cloudStatus(`附件核對 ${i+1}/${refs.length}`,'busy');
    let blob=await getAttachment(ref.id);const remote=info.find(x=>x.id===ref.id);
    if(blob){if(blob.size!==ref.size)throw new Error('本機附件大小不符：'+ref.name);const hash=await cloudHash(blob);if(remote){if(remote.hash!==hash||remote.size!==ref.size||remote.type!==ref.type)throw new Error('同 ID 附件內容不同：'+ref.name);}else await cloudRequest('putFile',{id:ref.id,type:ref.type,size:ref.size,hash,base64:await blobData(blob)});}
    else {if(!remote||remote.size!==ref.size||remote.type!==ref.type)throw new Error('本機與雲端均無有效附件：'+ref.name);const f=await cloudRequest('getFile',{id:ref.id});const bytes=Uint8Array.from(atob(f.base64),c=>c.charCodeAt(0));blob=new Blob([bytes],{type:ref.type});if(blob.size!==ref.size||await cloudHash(blob)!==remote.hash)throw new Error('下載附件驗證失敗：'+ref.name);await putAttachment(ref.id,blob);}
  }
}
let cloudImportBusy=false,cloudVerifiedFiles='';
function cloudSchedule(ms=1800){if(!cloudConfig||cloudApplying)return;clearTimeout(cloudTimer);cloudTimer=setTimeout(()=>cloudSync(),ms);}
function cloudAfterPersist(){if(!cloudConfig||cloudApplying)return;cloudDisk=localStorage.getItem(STORAGE_KEY);cloudSchedule();if(!cloudBusy&&(!cloudBase||stable(cloudPayload(state))!==stable(cloudBase.data)))cloudStatus('本機已儲存 · 待同步','wait');}
async function cloudSync(choice='',manual=false){
  if(!cloudConfig||cloudBusy)return;if(cloudTabStale){cloudStatus('其他分頁已更新，請重新整理','warn');return;}if(navigator.onLine===false){cloudStatus('離線 · 資料保存在本機','wait');return;}if(cloudEditsOpen()){cloudStatus('表單編輯中 · 暫緩同步','wait');return;}
  cloudBusy=true;cloudStatus('正在核對雲端…','busy');
  try{
    const raw=localStorage.getItem(STORAGE_KEY),local=cloudPayload(state),sig=stable(local);if(raw!==cloudDisk)throw new Error('其他分頁已更新，請重新整理');
    const known=cloudBase?.revision??-1,head=await cloudRequest('pull',{knownRevision:known});
    if(!Number.isSafeInteger(head.revision)||head.revision<0||(cloudBase&&head.revision<known))throw new Error('雲端版本倒退，停止同步；請保留備份');
    if(head.unchanged&&(!cloudBase||head.revision!==known))throw new Error('雲端回應版本不一致');
    const remote=head.unchanged?cloudBase.data:(head.data||{vehicles:[],fuel:[],maintenance:[],trash:[],tombstones:[]});
    const merge=cloudMerge(cloudBase?.data||null,local,remote);const stamp=stable([known,head.revision,local,remote]);
    if(merge.conflicts.length){if(!choice||stamp!==cloudConflictStamp||merge.conflicts.some(c=>c.blocking)){cloudConflicts=merge.conflicts;cloudConflictStamp=stamp;cloudStatus(`待核對 ${merge.conflicts.length} 筆衝突 · 未覆蓋`,'warn');return;}}
    const target=merge.conflicts.length?cloudMerge(cloudBase?.data||null,local,remote,choice).data:merge.data;
    if(!target.vehicles.length){cloudConflicts=[];cloudStatus('雲端尚無資料 · 請先匯入備份或新增車輛','wait');return;}
    const prepared=normalizeImportedData({...target,settings:state.settings,meta:state.meta});const canonical=cloudPayload(prepared);
    const fileSig=stable(allRefs(prepared));if(cloudVerifiedFiles!==fileSig||manual){await cloudFiles(prepared);cloudVerifiedFiles=fileSig;}
    if(!cloudCanApply(raw,sig)){cloudStatus('資料或表單已變更 · 等待下次同步','wait');return;}
    let revision=head.revision;
    if(stable(canonical)!==stable(remote)){cloudStatus('正在上傳紀錄…','busy');const pushed=await cloudRequest('push',{baseRevision:head.revision,data:canonical});revision=pushed.revision;if(revision!==head.revision+1)throw new Error('雲端回應版本不一致');}
    if(!cloudCanApply(raw,sig)){cloudStatus('雲端已核對 · 本機有新變更，等待下次同步','wait');return;}
    if(stable(canonical)!==sig){cloudApplying=true;try{state=prepared;persist(true);cloudDisk=localStorage.getItem(STORAGE_KEY);resetFuelForm();resetMaintenanceForm();renderAll();}finally{cloudApplying=false;}}
    const next={dataset:cloudConfig.dataset,revision,data:canonical,checkedAt:new Date().toISOString()};localStorage.setItem(CLOUD_BASE,JSON.stringify(next));cloudBase=next;cloudConflicts=[];cloudConflictStamp='';cloudStatus(`已同步 · r${revision}`,'ok');
  }catch(e){cloudStatus(e.code==='REVISION'?'另一裝置已更新 · 稍後重新比對':`同步未完成：${e.message}`,'warn');}
  finally{cloudBusy=false;el('cloudSyncNow').disabled=!cloudConfig;el('cloudDisconnect').disabled=!cloudConfig;el('cloudPair').disabled=false;}
}
function cloudControls(){const paired=!!cloudConfig;el('cloudConfigPanel').hidden=paired;el('cloudPairedPanel').hidden=!paired;el('resetLocalBtn').disabled=paired;el('restoreSnapshot').disabled=paired;el('importMode').querySelector('option[value="replace"]').disabled=paired;if(paired&&el('importMode').value==='replace')el('importMode').value='merge';}
function cloudInit(){
  cloudDisk=localStorage.getItem(STORAGE_KEY);cloudConfig=cloudRead(CLOUD_CONFIG);cloudBase=cloudRead(CLOUD_BASE);if(cloudConfig&&cloudBase?.dataset!==cloudConfig.dataset)cloudBase=null;
  cloudControls();cloudStatus(cloudConfig?'已配對 · 正在等待同步':'未配對 · 本機模式');
  el('cloudPair').onclick=async()=>{if(cloudBusy)return;try{const endpoint=cloudEndpoint(el('cloudEndpoint').value.trim()),key=el('cloudKey').value.trim();if(!/^[a-f0-9]{64}$/i.test(key))throw new Error('請輸入 64 字元配對金鑰');cloudBusy=true;cloudStatus('驗證配對中…','busy');const cfg={endpoint,key};const res=await cloudRequest('pull',{knownRevision:-1},cfg);cfg.dataset=res.dataset;localStorage.setItem(CLOUD_CONFIG,JSON.stringify(cfg));localStorage.removeItem(CLOUD_BASE);cloudConfig=cfg;cloudBase=null;cloudVerifiedFiles='';el('cloudKey').value='';cloudControls();cloudStatus('配對成功 · 等待同步','wait');}catch(e){cloudStatus('配對失敗：'+e.message,'warn');}finally{cloudBusy=false;el('cloudPair').disabled=false;el('cloudSyncNow').disabled=!cloudConfig;el('cloudDisconnect').disabled=!cloudConfig;if(cloudConfig)cloudSchedule(50);}};
  el('cloudSyncNow').onclick=()=>cloudSync('',true);
  el('cloudDisconnect').onclick=()=>{if(cloudBusy||!confirm('解除這台裝置的配對？本機與雲端資料都保留。'))return;localStorage.removeItem(CLOUD_CONFIG);localStorage.removeItem(CLOUD_BASE);cloudConfig=null;cloudBase=null;cloudConflicts=[];cloudVerifiedFiles='';clearTimeout(cloudTimer);cloudControls();cloudStatus('未配對 · 本機模式');};
  el('cloudExportConflicts').onclick=()=>downloadFile(JSON.stringify(cloudConflicts,null,2),'VehicleHub_雲端衝突_'+todayISO()+'.json','application/json');
  for(const [id,choice,label] of [['cloudKeepLocal','local','本機'],['cloudKeepRemote','remote','雲端']])el(id).onclick=()=>{if(cloudConflicts.some(c=>c.blocking)){showToast('請先修正所屬車輛，並下載衝突報告');return;}if(confirm(`只針對已列出的衝突採用${label}版本？其他紀錄照常合併。請先下載衝突報告和完整備份。`))cloudSync(choice,true);};
  window.addEventListener('online',()=>cloudSchedule(50));window.addEventListener('offline',()=>{if(cloudConfig&&!cloudBusy)cloudStatus('離線 · 資料保存在本機','wait');});window.addEventListener('focus',()=>cloudSchedule(50));document.addEventListener('visibilitychange',()=>{if(!document.hidden)cloudSchedule(50);});
  window.addEventListener('storage',e=>{if([STORAGE_KEY,CLOUD_CONFIG,CLOUD_BASE].includes(e.key)&&e.newValue!==e.oldValue){if(e.key===CLOUD_BASE){try{const a=JSON.parse(e.oldValue),b=JSON.parse(e.newValue);if(a&&b&&a.dataset===b.dataset&&a.revision===b.revision&&stable(a.data)===stable(b.data))return;}catch(_){} }cloudTabStale=true;cloudStatus('其他分頁已更新 · 請重新整理','warn');}});
  setInterval(()=>{if(!document.hidden)cloudSync();},60000);if(cloudConfig)cloudSchedule(50);
}
