const STORAGE_KEY = 'vehiclehub_lite_v580';
const APP_VERSION = 'V5.9.0';
let state = null;
const SNAPSHOT_KEY=STORAGE_KEY+'_previous';
let lastMergeReport=null, editDetails=[], editAttachments=[], fileBusy=false, editorEpoch=0, detailsDirty=false;
let activeTab = 'overview';
// 開啟編輯器時鎖定車輛，不依後續畫面選取值改寫紀錄。
const editorVehicle = {fuel:null, maintenance:null};

const el = (id) => document.getElementById(id);
const currency = (n) => Number(n || 0).toLocaleString('zh-TW');
const num = (n, digits = 0) => Number(n || 0).toLocaleString('zh-TW', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const todayISO = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

function showToast(message) {
  const node = el('toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => node.classList.remove('show'), 2400);
}

async function loadInitialData() {
  const keys=[STORAGE_KEY,'vehicleMaintenanceFuelV48'];
  for (const key of keys) {
    const saved=localStorage.getItem(key);
    if (!saved) continue;
    try { state=normalizeImportedData(JSON.parse(saved)); return; }
    catch(err) { console.warn('備份格式無法讀取',err); throw new Error('本機資料無法讀取，請先保存原始資料，未覆寫。'); }
  }
  state=blankData(); persist(false);
}
function blankData(){return {version:'5.9.0',appName:'Vehicle Hub Lite',settings:{lastVehicleId:'local-default'},vehicles:[{id:'local-default',name:'我的車輛',fuelType:'',odometer:0}],fuel:[],maintenance:[],meta:{}};}

function persist(snapshot=true) {
  state.meta=state.meta||{};state.meta.savedAt=new Date().toISOString();
  const prior=localStorage.getItem(STORAGE_KEY);const next=JSON.stringify(state);
  if(typeof cloudTabStale!=='undefined'&&(cloudTabStale||(cloudDisk!==null&&prior!==cloudDisk))){if(prior)state=normalizeImportedData(JSON.parse(prior));showToast('另一分頁已變更，請重新整理後再操作');throw new Error('本機分頁版本衝突');}
  try{if(snapshot&&prior&&prior!==next)localStorage.setItem(SNAPSHOT_KEY,prior);localStorage.setItem(STORAGE_KEY,next);}
  catch(err){if(prior)state=normalizeImportedData(JSON.parse(prior));showToast('本機儲存失敗，未完成變更；請備份並釋放空間');throw err;}
  if(typeof cloudAfterPersist==='function'){cloudDisk=localStorage.getItem(STORAGE_KEY);cloudAfterPersist();}
}

function normalizeImportedData(data) {
  if (data && data.data && Array.isArray(data.data.vehicles)) data=data.data;
  if (!data || !['vehicles','fuel','maintenance'].every(k=>Array.isArray(data[k])) || !data.vehicles.length) throw new Error('資料需包含車輛、加油及維修清單');
  const out=JSON.parse(JSON.stringify(data));
  const ids=new Set();
  for(const v of out.vehicles){if(!v || typeof v.id!=='string' || !v.id || ids.has(v.id))throw new Error('車輛識別碼錯誤');ids.add(v.id);v.name=String(v.name||'未命名車輛');}
  for(const key of ['fuel','maintenance']){
    const seen=new Set();
    for(const r of out[key]){
      if(!r || !ids.has(r.vehicleId) || typeof r.id!=='string' || !r.id || seen.has(r.id) || !/^\d{4}-\d{2}-\d{2}$/.test(r.date||''))throw new Error('紀錄格式或識別碼錯誤'); seen.add(r.id);
      const fields=key==='fuel'?['odometer','liters','amount']:['odometer','total'];
      for(const k of fields){if(r[k]===null||r[k]===''){r[k]=null;continue;}const n=Number(r[k]);if(!Number.isFinite(n)||n<0)throw new Error('數值格式錯誤');r[k]=n;}
      if(key==='fuel'){
        r.fullTank=r.fullTank===true; const notes=String(r.notes||'');
        if(r.odometerEstimated===undefined)r.odometerEstimated=/里程[^；。]*估算值|里程[^；。]*推估/.test(notes);
        if(r.litersEstimated===undefined)r.litersEstimated=/公升數[^；。]*估算|油量[^；。]*估算/.test(notes);
        if(r.fullTankEstimated===undefined)r.fullTankEstimated=!/已確認加滿/.test(notes)&&/推定加滿|推估加滿/.test(notes);
      } else {r.summary=deriveSummary(r);r.details=Array.isArray(r.details)?r.details.filter(d=>d&&typeof d==='object'&&!Array.isArray(d)):[];r.localAttachments=Array.isArray(r.localAttachments)?r.localAttachments.filter(validAttachmentRef):[];r.discountMode=discountMode(r);r.attachmentName=r.attachmentName|| (typeof r.attachment==='string'?r.attachment.split('/').pop():r.attachment?.name)||'';}
    }
  }
  // 保留紀錄欄位（包括維修明細及估算旗標），不保留已移除的模組。
  const selected=data.settings?.lastVehicleId||data.activeVehicleId;
  const result={version:'5.9.0',appName:'Vehicle Hub Lite',settings:{lastVehicleId:ids.has(selected)?selected:out.vehicles[0].id},vehicles:out.vehicles,fuel:out.fuel,maintenance:out.maintenance,meta:out.meta||{},trash:Array.isArray(out.trash)?out.trash.filter(x=>x&&['fuel','maintenance'].includes(x.key)&&x.record&&ids.has(x.record.vehicleId)&&typeof x.record.id==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x.record.date||'')):[],tombstones:Array.isArray(out.tombstones)?out.tombstones.filter(x=>x&&['fuel','maintenance'].includes(x.key)&&typeof x.id==='string'):[]};
  refreshVehicleOdometers(result);return result;
}

function deriveSummary(r) {
  if (r.summary) return r.summary;
  const names = [];
  ['items', 'details'].forEach(key => {
    const val = r[key];
    if (Array.isArray(val)) {
      val.forEach(item => {
        if (item && typeof item === 'object') {
          const name = item.name || item.item || item.title || item.description;
          if (name) names.push(String(name));
        } else if (item) {
          names.push(String(item));
        }
      });
    } else if (typeof val === 'string' && val.trim()) {
      names.push(val.trim());
    }
  });
  return [...new Set(names)].join('、');
}

function refreshVehicleOdometers(targetState = state) {
  for (const v of targetState.vehicles) {
    const latest=[...targetState.fuel,...targetState.maintenance].filter(r=>r.vehicleId===v.id&&Number(r.odometer)>0).sort(sortDateDesc)[0];
    v.odometer=latest?Number(latest.odometer):0;v.odometerDate=latest?.date||'';v.odometerEstimated=!!latest?.odometerEstimated;
  }
}

function sortDateDesc(a, b) {
  const ad = `${a.date || ''} ${String(a.odometer || 0).padStart(9, '0')} ${a.id || ''}`;
  const bd = `${b.date || ''} ${String(b.odometer || 0).padStart(9, '0')} ${b.id || ''}`;
  return ad < bd ? 1 : ad > bd ? -1 : 0;
}

function sortDateAsc(a, b) {
  const ad = `${a.date || ''} ${String(a.odometer || 0).padStart(9, '0')} ${a.id || ''}`;
  const bd = `${b.date || ''} ${String(b.odometer || 0).padStart(9, '0')} ${b.id || ''}`;
  return ad > bd ? 1 : ad < bd ? -1 : 0;
}

function getSelectedVehicleId() {
  return state.vehicles.some(v=>v.id===state.settings.lastVehicleId) ? state.settings.lastVehicleId : state.vehicles[0]?.id || null;
}

function getSelectedVehicle() {
  return state.vehicles.find(v => v.id === getSelectedVehicleId()) || state.vehicles[0] || null;
}

function vehicleFuelRecords(vehicleId = getSelectedVehicleId()) {
  return state.fuel.filter(r => r.vehicleId === vehicleId).sort(sortDateDesc);
}

function vehicleMaintenanceRecords(vehicleId = getSelectedVehicleId()) {
  return state.maintenance.filter(r => r.vehicleId === vehicleId).sort(sortDateDesc);
}

function vehicleLabel(v){return v ? `${v.name}${v.plate ? '｜'+v.plate : ''}` : '未選擇車輛';}
function renderVehicleSelect() {
  const select = el('vehicleSelect'), v=getSelectedVehicle();
  select.innerHTML = state.vehicles.map(v => `<option value="${escapeHtml(v.id)}">${escapeHtml(vehicleLabel(v))}</option>`).join('');
  select.value = getSelectedVehicleId();
  const index=state.vehicles.findIndex(x=>x.id===v.id);
  // 依車輛順序區分識別色，名稱與車牌才是主要識別依據。
  el('vehicleBar').setAttribute('data-tone',String(Math.max(0,index)%4));
  el('vehicleMileage').textContent=v.odometer?`最新已知 ${currency(v.odometer)} km · ${v.odometerDate||'日期未知'}${v.odometerEstimated?' · 估算':''}`:'尚無里程紀錄';
  el('vehicleScope').textContent=`僅顯示此車紀錄｜加油 ${vehicleFuelRecords().length} 筆 · 維修 ${vehicleMaintenanceRecords().length} 筆`;
  for(const key of ['fuel','maintenance']){
    if(editorVehicle[key])updateEditorLabel(key);
  }
}
function updateEditorLabel(key){
  const v=state.vehicles.find(v=>v.id===editorVehicle[key]);
  el(key+'VehicleLabel').textContent='本筆資料將儲存至：'+vehicleLabel(v);
}
function setEditorVehicle(key){editorVehicle[key]=getSelectedVehicleId();updateEditorLabel(key);}
function canSaveEditor(key,rows){
  const locked=editorVehicle[key],id=el(key+'Id').value;
  if(!locked||locked!==getSelectedVehicleId()||el(key+'Editor').hidden|| (id&&!rows.some(r=>r.id===id&&r.vehicleId===locked))){
    showToast('車輛或紀錄已變更，請重新開啟表單');return false;
  }
  return true;
}
function vehicleSettingsDirty(){const v=getSelectedVehicle();return ['vehicleName','vehicleFuelType','vehiclePlate'].some((id,i)=>String(el(id).value||'')!==String(v?.[['name','fuelType','plate'][i]]||''));}
function restoreVehicleSettings(){const v=getSelectedVehicle();el('vehicleName').value=v?.name||'';el('vehicleFuelType').value=v?.fuelType||'';el('vehiclePlate').value=v?.plate||'';}
function resumeCloudAfterEditor(){if(typeof cloudResumeAfterEdit==='function')cloudResumeAfterEdit();}
function canDiscardEditors(){
  const open=['fuel','maintenance'].filter(k=>editorVehicle[k]&&!el(k+'Editor').hidden);
  const dirtySettings=activeTab==='data'&&vehicleSettingsDirty();
  if(!open.length&&!dirtySettings)return true;
  return confirm(`「${vehicleLabel(getSelectedVehicle())}」尚有${[...open.map(k=>k==='fuel'?'加油表單':'維修表單'),...(dirtySettings?['未儲存車輛設定']:[])].join('、')}。切換或重開將放棄未儲存內容，確定繼續？`);
}
function resetVehicleFilters(){
  for(const k of ['fuel','maintenance']){el(k+'Search').value='';el(k+'Year').value='all';}
  el('analysisYear').value='all';
}
function switchVehicle(id){
  if(!state.vehicles.some(v=>v.id===id)){renderVehicleSelect();return false;}
  if(id===getSelectedVehicleId()){renderVehicleSelect();return true;}
  if(!canDiscardEditors()){renderVehicleSelect();return false;}
  state.settings.lastVehicleId=id;
  resetFuelForm();resetMaintenanceForm();resetVehicleFilters();persist(false);renderAll();
  showToast('已切換至 '+vehicleLabel(getSelectedVehicle()));return true;
}

function renderSummary() {
  const vehicle = getSelectedVehicle();
  const fuel = vehicleFuelRecords();
  const maintenance = vehicleMaintenanceRecords();
  const latestFuel = fuel[0];
  const latestMaintenance = maintenance[0];
  const avg = calcEfficiencySummary(vehicle.id);
  const nextReminder = findNextReminder(maintenance, vehicle.odometer);

  const cards = [
    {
      label: '最新已知里程',
      value: vehicle?.odometer ? `${currency(vehicle.odometer)} km` : "—",
      hint: vehicle ? `${vehicle.odometerDate || "尚無量測日期"}${vehicle.odometerEstimated ? "｜估算" : ""}` : '尚未選擇車輛'
    },
    {
      label: '最近加油',
      value: latestFuel ? `NT$ ${currency(latestFuel.amount)}` : '—',
      hint: latestFuel ? `${latestFuel.date}｜${num(latestFuel.liters,2)} L` : '尚無加油紀錄'
    },
    {
      label: '最近維修',
      value: latestMaintenance ? `NT$ ${currency(latestMaintenance.total)}` : '—',
      hint: latestMaintenance ? `${latestMaintenance.date}｜${latestMaintenance.type}` : '尚無維修紀錄'
    },
    {
      label: '平均油耗',
      value: avg.avgKmPerLiter ? `${num(avg.avgKmPerLiter, 2)} km/L` : '—',
      hint: avg.estimatedCount?`完整區間（含 ${avg.estimatedCount} 段估算）`:'依完整加油區間計算'
    }
  ];

  el('nextService').hidden=!nextReminder;el('nextService').textContent=nextReminder?`下次保養｜${nextReminder}`:'';
  el('summaryGrid').innerHTML = cards.map(card => `
    <article class="summary-card">
      <div class="label">${card.label}</div>
      <div class="value">${card.value}</div>
      <div class="hint">${escapeHtml(card.hint)}</div>
    </article>
  `).join('');
}

function findNextReminder(maintenance, currentOdo = 0) {
  if (!maintenance.length) return '';
  const item = maintenance.find(r => r.nextKm || r.nextDate);
  if (!item) return '';
  const bits = [];
  if (item.nextKm) {
    const diff = Number(item.nextKm) - Number(currentOdo || 0);
    bits.push(diff > 0 ? `下次保養約 ${currency(diff)} km 後` : `已到下次保養里程 ${currency(item.nextKm)} km`);
  }
  if (item.nextDate) bits.push(`日期 ${item.nextDate}`);
  return bits.join('｜');
}

function renderOverview() {
  const fuel = vehicleFuelRecords().slice(0, 5);
  const maintenance = vehicleMaintenanceRecords().slice(0, 5);

  el('recentFuelList').innerHTML = fuel.length ? fuel.map(r => `
    <article class="list-item">
      <div class="list-item-title">${escapeHtml(r.date)}｜NT$ ${currency(r.amount)}</div>
      <div class="list-meta">
        <span>里程 <span class="metric-strong">${r.odometer?currency(r.odometer)+' km':'未記錄'}</span></span>
        <span>加油量 <span class="metric-strong">${num(r.liters,2)} L</span></span>
        <span>單價 <span class="metric-strong">${r.liters ? num(r.amount / r.liters, 2) : '—'}</span></span>
      </div>
      ${r.station || r.notes ? `<div class="list-meta" style="margin-top:8px;"><span>${escapeHtml([r.station, r.notes].filter(Boolean).join('｜'))}</span></div>` : ''}
    </article>
  `).join('') : '<p>尚無加油紀錄。</p>';

  el('recentMaintenanceList').innerHTML = maintenance.length ? maintenance.map(r => `
    <article class="list-item">
      <div class="list-item-title">${escapeHtml(r.date)}｜NT$ ${currency(r.total)}</div>
      <div class="list-meta">
        <span>里程 <span class="metric-strong">${r.odometer?currency(r.odometer)+' km':'未記錄'}</span></span>
        <span>${escapeHtml(r.type || '維修')}</span>
        <span>${escapeHtml(r.vendor || '未填維修廠')}</span>
      </div>
      ${r.summary ? `<div class="list-meta" style="margin-top:8px;"><span>${escapeHtml(r.summary)}</span></div>` : ''}
    </article>
  `).join('') : '<p>尚無維修紀錄。</p>';
}

function renderFuelTable(){
 const rows=filteredRecords(vehicleFuelRecords(),'fuel'), segments=new Map(calcEfficiencySummary(getSelectedVehicleId()).segments.map(x=>[x.toId,x]));
 el('fuelTableWrap').innerHTML=rows.length?`<div class="record-list">${rows.map(r=>`<article class="record-card"><div class="record-head"><strong>${escapeHtml(r.date)} <span class="tag">${r.fullTank?'加滿':'未加滿'}</span>${quality(r)?' <span class="tag estimate">估算</span>':''}</strong><strong class="money">NT$ ${currency(r.amount)}</strong></div><div class="record-metrics"><span>里程 <b>${r.odometer?currency(r.odometer)+' km':'—'}</b></span><span>油量 <b>${r.liters?num(r.liters,2)+' L':'—'}</b></span><span>單價 <b>${r.liters&&r.amount!=null?num(r.amount/r.liters,2):'—'}</b></span></div>${fuelCycleHTML(r,segments.get(r.id))}<div class="record-foot"><div class="record-note">${escapeHtml([r.fuelType,r.station,r.notes].filter(Boolean).join('｜'))}</div><div class="row-actions"><button class="row-btn" data-edit-fuel="${escapeHtml(r.id)}">編輯</button><button class="row-btn delete" data-del-fuel="${escapeHtml(r.id)}">刪除</button></div></div></article>`).join('')}</div>`:'<p class="empty-holder">沒有符合的加油紀錄。</p>';
}
function quality(r){return !!(r.odometerEstimated||r.litersEstimated||r.fullTankEstimated);}
// Search is presentation-only. Reject misplaced cloud connection credentials without modifying records.
function invalidRecordSearch(value){const q=String(value||'').trim();return /^(?:https?:\/\/)?script\.google\.com\/macros\/s\//i.test(q)||/^[a-f0-9]{64}$/i.test(q);}
function filteredRecords(rows,key){
  const input=el(key+'Search');if(invalidRecordSearch(input.value))input.value='';
  const year=el(key+'Year').value||'all',q=input.value.trim().toLowerCase();
  const found=rows.filter(r=>{if(year!=='all'&&!r.date.startsWith(year))return false;if(!q)return true;const hay=[r.date,r.odometer,r.amount,r.total,r.fuelType,r.station,r.notes,r.summary,r.vendor,r.type,r.workOrder,...(r.details||[]).map(d=>d.name),...(r.localAttachments||[]).map(d=>d.name)].join(' ').toLowerCase();return hay.includes(q)||hay.replace(/(\d),(?=\d)/g,'$1').includes(q.replace(/(\d),(?=\d)/g,'$1'));});
  el(key+'FilterCount').textContent=`顯示 ${found.length} / ${rows.length} 筆`;
  el(key+'ClearFilter').disabled=!q&&year==='all';
  return found;
}
function renderYearOptions(){for(const [id,rows] of [['fuelYear',vehicleFuelRecords()],['maintenanceYear',vehicleMaintenanceRecords()],['analysisYear',vehicleFuelRecords()]]){const node=el(id);const selected=node.value;const years=[...new Set((id==='analysisYear'?[...rows,...vehicleMaintenanceRecords()]:rows).map(r=>r.date.slice(0,4)))].sort().reverse();node.innerHTML='<option value="all">全部年份</option>'+years.map(y=>`<option value="${y}">${y} 年</option>`).join('');node.value=years.includes(selected)?selected:'all';}}

function renderMaintenanceTable(){
 const rows=filteredRecords(vehicleMaintenanceRecords(),'maintenance');
 el('maintenanceTableWrap').innerHTML=rows.length?`<div class="record-list">${rows.map(r=>`<article class="record-card"><div class="record-head"><strong>${escapeHtml(r.date)} <span class="tag">${escapeHtml(r.type)}</span></strong><strong class="money">NT$ ${currency(r.total)}</strong></div><div class="record-note">${escapeHtml([r.vendor,r.summary].filter(Boolean).join('｜'))}</div><div class="record-metrics"><span>里程 <b>${r.odometer?currency(r.odometer)+' km':'—'}</b></span><span>零件 <b>${currency(r.parts)}</b></span><span>工資 <b>${currency(r.labor)}</b></span></div><details><summary>查看工單資訊</summary><div class="record-note">${escapeHtml([r.invoiceDate?'開單 '+r.invoiceDate:'',r.workOrder?'工單 '+r.workOrder:'','折扣 '+currency(r.discount)+'（'+discountLabel(r.discountMode)+'）',r.nextKm?'下次 '+currency(r.nextKm)+' km':'',r.nextDate,r.notes].filter(Boolean).join('｜'))}</div>${Array.isArray(r.details)&&r.details.length?`<div class="detail-list">${r.details.map(d=>`<div>${escapeHtml(d.name||d.item||'')} <span>${escapeHtml(d.qty??'')} × ${currency(d.unitPrice)} = ${currency(d.amount)}</span></div>`).join('')}</div>`:''}${attachmentHTML(r)}</details><div class="row-actions"><button class="row-btn" data-edit-maint="${escapeHtml(r.id)}">編輯</button><button class="row-btn delete" data-del-maint="${escapeHtml(r.id)}">刪除</button></div></article>`).join('')}</div>`:'<p class="empty-holder">沒有符合的維修紀錄。</p>';
}

function calcEfficiencySummary(vehicleId, year='all', includeEstimated=true, target=state) {
 const all=target.fuel.filter(r=>r.vehicleId===vehicleId).sort(sortDateAsc),segments=[];
 let start=null,prev=null,liters=0,amount=0,valid=true,costValid=true,estimated=false,count=0;
 for(const r of all){
   if(start){count++;if(!(Number(r.liters)>0))valid=false;else liters+=Number(r.liters);if(r.amount==null||!Number.isFinite(Number(r.amount)))costValid=false;else amount+=Number(r.amount);estimated=estimated||quality(r);if(r.odometer>0&&prev&&r.odometer<prev.odometer)valid=false;}
   if(r.fullTank&&r.odometer>0){
     if(start&&valid&&r.odometer>start.odometer&&liters>0&&(includeEstimated||!estimated)){
       segments.push({fromDate:start.date,toDate:r.date,fromId:start.id,toId:r.id,distance:r.odometer-start.odometer,liters,amount:costValid?amount:null,kmPerLiter:(r.odometer-start.odometer)/liters,estimated,count});
     }
     start=r.odometer>0?r:null;liters=0;amount=0;valid=true;costValid=true;estimated=!!r.odometerEstimated||!!r.fullTankEstimated;count=0;
   }
   if(r.odometer>0)prev=r;
 }
 const segs=segments.filter(s=>year==='all'||s.toDate.startsWith(year));const records=all.filter(r=>year==='all'||r.date.startsWith(year));
 const totalDistance=segs.reduce((s,x)=>s+x.distance,0),totalLiters=segs.reduce((s,x)=>s+x.liters,0),totalAmount=records.reduce((s,x)=>s+Number(x.amount||0),0),priced=records.filter(r=>r.liters>0&&r.amount!=null),costSegments=segs.filter(s=>s.amount!=null);
 const pricedLiters=priced.reduce((s,r)=>s+Number(r.liters),0),costDistance=costSegments.reduce((s,x)=>s+x.distance,0);
 return {segments:segs.reverse(),avgKmPerLiter:totalLiters?totalDistance/totalLiters:null,totalDistance,totalLiters,totalAmount,totalRecords:records.length,avgFuelPrice:pricedLiters?priced.reduce((s,r)=>s+Number(r.amount),0)/pricedLiters:null,amountPerKm:costDistance?costSegments.reduce((s,x)=>s+x.amount,0)/costDistance:null,estimatedCount:segs.filter(s=>s.estimated).length};
}

function renderAnalysis() {
  const vehicle = getSelectedVehicle();
  const year=el("analysisYear").value||"all", includeEstimated=el("includeEstimated").checked;
  const stats = calcEfficiencySummary(vehicle.id,year,includeEstimated);

  const cards = [
    ['平均油耗', stats.avgKmPerLiter ? `${num(stats.avgKmPerLiter, 2)} km/L` : '—'],
    ['百公里油耗',stats.avgKmPerLiter?`${num(100/stats.avgKmPerLiter,2)} L/100km`:'—'],
    ['完整區間',`${stats.segments.length} 段（估算 ${stats.estimatedCount}）`],
    ['總加油金額', `NT$ ${currency(stats.totalAmount)}`],
    ['平均每公升價格', stats.avgFuelPrice != null ? `NT$ ${num(stats.avgFuelPrice, 2)}` : '—'],
    ['平均每公里成本', stats.amountPerKm != null ? `NT$ ${num(stats.amountPerKm, 2)}` : '—']
  ];
  el('analysisCards').innerHTML = cards.map(([label, value]) => `
    <article class="summary-card">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
    </article>
  `).join('');

  el('efficiencySegments').innerHTML = stats.segments.length ? stats.segments.slice(0, 12).map(seg => `
    <article class="list-item">
      <div class="list-item-title">${seg.fromDate} → ${seg.toDate}${seg.estimated?' <span class="tag estimate">估算</span>':''}</div>
      <div class="list-meta">
        <span>距離 <span class="metric-strong">${currency(seg.distance)} km</span></span>
        <span>油量 <span class="metric-strong">${num(seg.liters,2)} L</span></span>
        <span>油耗 <span class="metric-strong">${num(seg.kmPerLiter,2)} km/L</span></span>
      </div>
    </article>
  `).join('') : '<p>沒有符合條件的完整油耗區間（需有可用的起訖里程及中間加油量）。</p>';

  renderTrend(stats.segments);renderAnnualCosts(vehicle.id,year,includeEstimated);
  const monthly = buildMonthlyStats(vehicle.id,year,includeEstimated);
  el('monthlyBars').innerHTML = monthly.length ? monthly.map(item => `
    <div class="month-row">
      <div>${item.month}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${item.width}%"></div></div>
      <div class="month-extra">${item.kmPerLiter ? `${num(item.kmPerLiter,2)} km/L` : '—'}</div>
      <div class="month-extra">${num(item.liters,2)} L · NT$ ${currency(item.amount)}</div>
    </div>
  `).join('') : '<p>尚無足夠資料可產生每月油耗統計。</p>';
}

function buildMonthlyStats(vehicleId, year="all",includeEstimated=true) {
  const records = state.fuel.filter(r => r.vehicleId === vehicleId && r.date && (year==="all"||r.date.startsWith(year))).sort(sortDateAsc);
  const map = new Map();
  records.forEach(r => {
    const month = r.date.slice(0, 7);
    if (!map.has(month)) map.set(month, { month, liters: 0, amount: 0, count: 0 });
    const row = map.get(month);
    row.liters += Number(r.liters || 0);
    row.amount += Number(r.amount || 0);
    row.count += 1;
  });

  const stats = calcEfficiencySummary(vehicleId,year,includeEstimated);
  stats.segments.forEach(seg => {
    const month = seg.toDate.slice(0, 7);
    if (!map.has(month)) map.set(month, { month, liters: 0, amount: 0, count: 0 });
    const row = map.get(month);
    row.distance = (row.distance || 0) + seg.distance;
    row.fullLiters = (row.fullLiters || 0) + seg.liters;
  });

  const arr = [...map.values()].sort((a, b) => a.month < b.month ? 1 : -1).slice(0, 12).reverse();
  arr.forEach(r => {
    r.kmPerLiter = r.fullLiters ? r.distance / r.fullLiters : null;
  });
  const maxValue = Math.max(...arr.map(r => r.kmPerLiter || 0), 1);
  arr.forEach(r => r.width = ((r.kmPerLiter || 0) / maxValue) * 100);
  return arr.reverse();
}

function renderDataMeta() {
  const vehicleCount = state.vehicles.length;
  const fuelCount = vehicleFuelRecords().length;
  const maintenanceCount = vehicleMaintenanceRecords().length;
  const savedAt = state.meta?.savedAt ? new Date(state.meta.savedAt).toLocaleString('zh-TW') : '尚未儲存';
  el('restoreDeleted').disabled=!(state.trash||[]).some(x=>x.record.vehicleId===getSelectedVehicleId());
  el('snapshotInfo').textContent=localStorage.getItem(SNAPSHOT_KEY)?'已保留上一個資料版本（本機）':'尚無自動復原點';
  el('dataMeta').innerHTML = `
    <div class="meta-item"><strong>版本</strong>${APP_VERSION}</div>
    <div class="meta-item"><strong>目前車輛</strong>${escapeHtml(vehicleLabel(getSelectedVehicle()))}</div>
    <div class="meta-item"><strong>加油紀錄</strong>${fuelCount} 筆</div>
    <div class="meta-item"><strong>維修紀錄</strong>${maintenanceCount} 筆</div>
    <div class="meta-item"><strong>全部車輛備份範圍</strong>${vehicleCount} 台 · 加油 ${state.fuel.length} 筆 · 維修 ${state.maintenance.length} 筆</div>
    <div class="meta-item"><strong>最近儲存（全部資料）</strong>${savedAt}</div>
    <div class="meta-item"><strong>說明</strong>免登入；資料先存本機，配對後自動同步所有車輛。</div>
  `;
}

function renderAll() {
  renderVehicleSelect();
  el('fuelStations').innerHTML=[...new Set(vehicleFuelRecords().map(r=>r.station).filter(Boolean))].map(x=>`<option value="${escapeHtml(x)}"></option>`).join('');
  renderYearOptions();
  renderSummary();
  renderOverview();
  renderFuelTable();
  renderMaintenanceTable();
  renderAnalysis();
  renderDataMeta();
  restoreVehicleSettings();
  if(typeof cloudRenderCounts==='function')cloudRenderCounts();
}

function bindTabs() {
  el('tabs').addEventListener('click', (event) => {
    const btn = event.target.closest('.tab');
    if (!btn) return;
    const next=btn.dataset.tab;
    if(next!==activeTab&&(['fuel','maintenance'].some(k=>editorVehicle[k]&&!el(k+'Editor').hidden)|| (activeTab==='data'&&vehicleSettingsDirty()))){
      if(!canDiscardEditors())return;
      resetFuelForm();resetMaintenanceForm();restoreVehicleSettings();
    }
    activeTab = next;
    document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab === btn));
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === `panel-${activeTab}`));
    if(activeTab==='fuel')renderFuelTable();if(activeTab==='maintenance')renderMaintenanceTable();resumeCloudAfterEditor();
  });
}

function resetFuelForm() {
  editorVehicle.fuel=null;el('fuelVehicleLabel').textContent='';
  el('fuelForm').reset();
  el('fuelId').value = '';
  el('fuelDate').value = todayISO();
  el('fuelFormTitle').textContent = '新增加油紀錄';
  el('fuelEditor').hidden = true;
  const v = getSelectedVehicle();
  el('fuelOdometer').value = '';el('fuelOdometer').placeholder=v?.odometer?'上次 '+currency(v.odometer)+' km':'';el('fuelPricePreview').textContent='每公升價格 —';
  el('fuelType').value = v?.fuelType || '';
  el('fuelFullTank').checked = true;
}

function resetMaintenanceForm() {
  if(typeof resetOcrUI==='function')resetOcrUI();
  editorVehicle.maintenance=null;editorEpoch++;fileBusy=false;editDetails=[];editAttachments=[];detailsDirty=false;el('saveMaintenance').disabled=false;el('maintenanceVehicleLabel').textContent='';
  el('maintenanceForm').reset();
  el('maintenanceId').value = '';
  el('maintenanceDate').value = todayISO();
  el('maintenanceInvoiceDate').value = '';
  el('maintenanceFormTitle').textContent = '新增維修紀錄';
  el('maintenanceEditor').hidden = true;
  const v = getSelectedVehicle();
  el('maintenanceOdometer').value = '';el('maintenanceOdometer').placeholder=v?.odometer?'上次 '+currency(v.odometer)+' km':'';
  el('maintenanceParts').value = 0;
  el('maintenanceLabor').value = 0;
  el('maintenanceDiscount').value = 0;el('discountMode').value='separate';renderDetailEditor();renderAttachmentEditor();
}

function bindForms() {
  el('fuelForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if(!canSaveEditor('fuel',state.fuel))return;
    const record = {
      ...state.fuel.find(r=>r.id===el('fuelId').value),
      id: el('fuelId').value || uid('fuel'),
      vehicleId: editorVehicle.fuel,
      date: el('fuelDate').value,
      odometer: el('fuelOdometer').value===''?null:Number(el('fuelOdometer').value),
      liters: Number(el('fuelLiters').value || 0),
      amount: Number(el('fuelAmount').value || 0),
      fuelType: el('fuelType').value.trim(),
      station: el('fuelStation').value.trim(),
      fullTank: el('fuelFullTank').checked,odometerEstimated:el('odoEstimated').checked,litersEstimated:el('litersEstimated').checked,fullTankEstimated:el('tankEstimated').checked,
      notes: el('fuelNotes').value.trim()
    };
    if (!record.date || !(record.liters>0) || record.amount<0) {
      showToast('請完整填寫加油資料');
      return;
    }
    if(!confirmMileage(record)||!confirmDuplicate('fuel',record))return;
    const idx = state.fuel.findIndex(r => r.id === record.id);
    if (idx >= 0) { const before=state.fuel[idx]; if(before.odometer!==record.odometer)delete record.distanceProvided; if(before.liters!==record.liters||before.amount!==record.amount){record.unitPrice=record.amount/record.liters;record.unitPriceEstimated=record.litersEstimated;} state.fuel[idx] = record; } else state.fuel.push(record);
    refreshVehicleOdometers();
    persist();
    renderAll();
    resetFuelForm();
    showToast(idx >= 0 ? '已更新加油紀錄' : '已新增加油紀錄');
  });

  el('maintenanceForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if(!canSaveEditor('maintenance',state.maintenance))return;
    if(typeof ocrCanSave==='function'&&!ocrCanSave())return;
    if(el('maintenanceTotal').value===''){showToast('請填寫實付金額（免費服務請填 0）');return;}
    const record = {
      ...state.maintenance.find(r=>r.id===el('maintenanceId').value),
      id: el('maintenanceId').value || uid('maint'),
      vehicleId: editorVehicle.maintenance,
      date: el('maintenanceDate').value,
      invoiceDate: el('maintenanceInvoiceDate').value,
      odometer: el('maintenanceOdometer').value===''?null:Number(el('maintenanceOdometer').value),
      type: el('maintenanceType').value,
      vendor: el('maintenanceVendor').value.trim(),
      workOrder: el('maintenanceWorkOrder').value.trim(),
      summary: el('maintenanceSummary').value.trim(),
      parts: Number(el('maintenanceParts').value || 0),
      labor: Number(el('maintenanceLabor').value || 0),
      discount: Number(el('maintenanceDiscount').value || 0),
      total: Number(el('maintenanceTotal').value || 0),
      nextKm: el('maintenanceNextKm').value ? Number(el('maintenanceNextKm').value) : null,
      nextDate: el('maintenanceNextDate').value,
      notes: el('maintenanceNotes').value.trim(),discountMode:el('discountMode').value||'separate',details:editDetails.map(x=>({...x})),localAttachments:editAttachments.map(x=>({...x}))
    };
    if (fileBusy || !record.date || !Number.isFinite(record.total) || record.total<0 || !validDetailRows(record.details)) {
      showToast('請完整填寫維修資料');
      return;
    }
    if(!record.summary&&record.details.length)record.summary=deriveSummary(record);
    if(typeof ocrRecordMetadata==='function'){const info=ocrRecordMetadata();if(info)record.ocrImport=info;}
    if(!confirmMileage(record)||!confirmDuplicate('maintenance',record))return;
    if(detailsDirty&&record.details.length&&Math.abs(detailTotals(record.details,record.discount,record.discountMode).total-record.total)>0.01&&!confirm('明細與實付金額不同，仍保留原單實付金額？'))return;
    const idx = state.maintenance.findIndex(r => r.id === record.id);
    if (idx >= 0) state.maintenance[idx] = record; else state.maintenance.push(record);
    refreshVehicleOdometers();
    persist();
    renderAll();
    resetMaintenanceForm();
    showToast(idx >= 0 ? '已更新維修紀錄' : '已新增維修紀錄');
  });

  el('fuelCancelBtn').addEventListener('click', ()=>{resetFuelForm();resumeCloudAfterEditor();});
  el('maintenanceCancelBtn').addEventListener('click', ()=>{resetMaintenanceForm();resumeCloudAfterEditor();});

  [el('maintenanceParts'), el('maintenanceLabor'), el('maintenanceDiscount')].forEach(node => {
    node.addEventListener('input', () => {
      const parts = Number(el('maintenanceParts').value || 0);
      const labor = Number(el('maintenanceLabor').value || 0);
      const discount = Number(el('maintenanceDiscount').value || 0);
      const mode=el('discountMode').value;if(mode!=='manual')el('maintenanceTotal').value=Math.max(parts+labor-(mode==='included'?0:discount),0);updateDetailPreview();
    });
  });
}

function bindLists() {
  document.body.addEventListener('click', (e) => {
    const editFuel = e.target.closest('[data-edit-fuel]');
    const delFuel = e.target.closest('[data-del-fuel]');
    const editMaint = e.target.closest('[data-edit-maint]');
    const delMaint = e.target.closest('[data-del-maint]');

    if (editFuel) {
      const record = state.fuel.find(r => r.id === editFuel.dataset.editFuel);
      if (!record || record.vehicleId!==getSelectedVehicleId()){showToast('紀錄不屬於目前車輛，請重新選取');return;}
      if(!canDiscardEditors())return;resetFuelForm();resetMaintenanceForm();
      activeTab = 'fuel';
      document.querySelector('[data-tab="fuel"]').click();
      el('fuelFormTitle').textContent = '編輯加油紀錄';
      setEditorVehicle('fuel');
      el('fuelEditor').hidden = false;
      el('fuelId').value = record.id;
      el('fuelDate').value = record.date || '';
      el('fuelOdometer').value = record.odometer || '';
      el('fuelLiters').value = record.liters || '';
      el('fuelAmount').value = record.amount ?? '';
      el('fuelType').value = record.fuelType || '';
      el('fuelStation').value = record.station || '';
      el('fuelFullTank').checked = !!record.fullTank;el('odoEstimated').checked=!!record.odometerEstimated;el('litersEstimated').checked=!!record.litersEstimated;el('tankEstimated').checked=!!record.fullTankEstimated;updatePrice();
      el('fuelNotes').value = record.notes || '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (delFuel) {
      const record = state.fuel.find(r => r.id === delFuel.dataset.delFuel);
      if (!record || record.vehicleId!==getSelectedVehicleId()){showToast('紀錄不屬於目前車輛，請重新選取');return;}
      if (!confirm(`確定刪除「${vehicleLabel(getSelectedVehicle())}」${record.date} 的加油紀錄？`)) return;
      rememberDeleted('fuel',record);state.fuel = state.fuel.filter(r => r.id !== record.id);if(el('fuelId').value===record.id)resetFuelForm();
      refreshVehicleOdometers();
      persist();
      renderAll();
      showToast('已刪除加油紀錄');
    }

    if (editMaint) {
      const record = state.maintenance.find(r => r.id === editMaint.dataset.editMaint);
      if (!record || record.vehicleId!==getSelectedVehicleId()){showToast('紀錄不屬於目前車輛，請重新選取');return;}
      if(!canDiscardEditors())return;resetFuelForm();resetMaintenanceForm();
      document.querySelector('[data-tab="maintenance"]').click();
      el('maintenanceFormTitle').textContent = '編輯維修紀錄';
      if(typeof resetOcrUI==='function')el('ocrPanel').hidden=true;
      setEditorVehicle('maintenance');
      el('maintenanceEditor').hidden = false;
      el('maintenanceId').value = record.id;
      el('maintenanceDate').value = record.date || '';
      el('maintenanceInvoiceDate').value = record.invoiceDate || '';
      el('maintenanceOdometer').value = record.odometer || '';
      if(!Array.from(el('maintenanceType').options).some(o=>o.value===record.type)&&record.type){const o=document.createElement('option');o.value=record.type;o.textContent=record.type;el('maintenanceType').append(o);}el('maintenanceType').value = record.type || '其他';
      el('maintenanceVendor').value = record.vendor || '';
      el('maintenanceWorkOrder').value = record.workOrder || '';
      el('maintenanceSummary').value = record.summary || '';
      el('maintenanceParts').value = record.parts || 0;
      el('maintenanceLabor').value = record.labor || 0;
      el('maintenanceDiscount').value = record.discount || 0;
      el('maintenanceTotal').value = record.total || 0;
      el('maintenanceNextKm').value = record.nextKm || '';
      el('maintenanceNextDate').value = record.nextDate || '';
      el('maintenanceNotes').value = record.notes || '';editDetails=(record.details||[]).map(x=>({...x}));editAttachments=(record.localAttachments||[]).map(x=>({...x}));el('discountMode').value=discountMode(record);renderDetailEditor();renderAttachmentEditor();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (delMaint) {
      const record = state.maintenance.find(r => r.id === delMaint.dataset.delMaint);
      if (!record || record.vehicleId!==getSelectedVehicleId()){showToast('紀錄不屬於目前車輛，請重新選取');return;}
      if (!confirm(`確定刪除「${vehicleLabel(getSelectedVehicle())}」${record.date} 的維修紀錄？`)) return;
      rememberDeleted('maintenance',record);state.maintenance = state.maintenance.filter(r => r.id !== record.id);if(el('maintenanceId').value===record.id)resetMaintenanceForm();
      refreshVehicleOdometers();
      persist();
      renderAll();
      showToast('已刪除維修紀錄');
    }
  });
}

function bindDataActions(){
  const exportAction=async()=>{try{const data=JSON.parse(JSON.stringify(state));data.attachmentFiles=await exportAttachmentFiles(data);downloadFile(JSON.stringify(data,null,2),'VehicleHub_Lite_Backup_'+todayISO()+'.json','application/json');showToast('已匯出備份（含已存附件）');}catch(e){showToast('備份失敗：'+e.message);}};
  el('exportBtn').addEventListener('click',exportAction);el('exportBtn2').addEventListener('click',exportAction);
  const importHandler=async event=>{const file=event.target.files?.[0];if(!file)return;if(typeof cloudImportBusy!=='undefined')cloudImportBusy=true;try{
    if(!canDiscardEditors())return;const before=JSON.stringify(state),parsed=JSON.parse(await file.text());const incoming=normalizeImportedData(parsed);const mode=el('importMode').value||'merge';if(typeof cloudConfig!=='undefined'&&cloudConfig&&mode==='replace')throw new Error('配對期間僅允許安全合併');
    const m=mode==='replace'?{data:incoming,conflicts:[],added:incoming.fuel.length+incoming.maintenance.length}:mergeData(state,incoming);
    if(!confirm(`${mode==='replace'?'取代全部資料':'安全合併'}：匯入 ${incoming.fuel.length} 筆加油、${incoming.maintenance.length} 筆維修。新增／還原 ${m.added} 筆；衝突 ${m.conflicts.length} 筆（合併時保留本機版）。確定繼續？`))return;
    await importAttachmentFiles(parsed.attachmentFiles||parsed.data?.attachmentFiles||[],m.data);
    if(JSON.stringify(state)!==before)throw new Error('匯入期間本機資料已變更，請重新匯入');
    if(!canDiscardEditors())return;
    state=m.data;persist();resetFuelForm();resetMaintenanceForm();resetVehicleFilters();renderAll();lastMergeReport=m.conflicts;el('mergeReport').hidden=false;el('mergeReport').textContent=`完成：新增／還原 ${m.added} 筆，衝突 ${m.conflicts.length} 筆。`;el('exportConflicts').hidden=!m.conflicts.length;showToast('資料匯入完成');
  }catch(err){console.error(err);showToast('匯入未完成：'+err.message);}finally{if(typeof cloudImportBusy!=='undefined'){cloudImportBusy=false;cloudSchedule();}event.target.value='';}};
  el('importInput').addEventListener('change',importHandler);el('importInput2').addEventListener('change',importHandler);
  el('exportConflicts').onclick=()=>{if(lastMergeReport?.length)downloadFile(JSON.stringify(lastMergeReport,null,2),'VehicleHub_合併衝突_'+todayISO()+'.json','application/json');};
  el('exportFuelCsv').onclick=()=>exportCSV('fuel');el('exportMaintCsv').onclick=()=>exportCSV('maintenance');
  el('restoreSnapshot').onclick=()=>{if(typeof cloudConfig!=='undefined'&&cloudConfig)return showToast('配對期間暫停整份復原');const saved=localStorage.getItem(SNAPSHOT_KEY);if(!saved){showToast('尚無復原點');return;}if(!canDiscardEditors()||!confirm('復原上一個本機資料版本？目前版本將成為新的復原點。'))return;try{state=normalizeImportedData(JSON.parse(saved));persist();resetFuelForm();resetMaintenanceForm();resetVehicleFilters();renderAll();showToast('已復原上一版本');}catch(err){showToast('復原失敗：'+err.message);}};
  el('restoreDeleted').onclick=()=>{const trash=state.trash||[],id=getSelectedVehicleId();let idx=trash.length-1;while(idx>=0&&trash[idx].record.vehicleId!==id)idx--;const entry=trash[idx];if(!entry){showToast('此車無可復原的刪除紀錄');return;}if(!canDiscardEditors()||!confirm(`復原「${vehicleLabel(getSelectedVehicle())}」${entry.record.date} 最近刪除的${entry.key==='fuel'?'加油':'維修'}紀錄？`))return;if(!state.vehicles.some(v=>v.id===entry.record.vehicleId)||state[entry.key].some(r=>r.id===entry.record.id)){showToast('原車輛不存在或紀錄已存在');return;}state[entry.key].push(entry.record);state.trash.splice(idx,1);state.tombstones=(state.tombstones||[]).filter(t=>!(t.key===entry.key&&t.id===entry.record.id));refreshVehicleOdometers();persist();resetFuelForm();resetMaintenanceForm();renderAll();showToast('已復原紀錄');};
  el('resetLocalBtn').addEventListener('click',()=>{if(typeof cloudConfig!=='undefined'&&cloudConfig)return showToast('請先解除配對並備份');if(!canDiscardEditors()||!confirm('確定清除本機所有車輛及全部紀錄？請先匯出備份。'))return;state=blankData();persist();resetFuelForm();resetMaintenanceForm();resetVehicleFilters();renderAll();showToast('已清除本機資料');});
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}

function bindVehicleSelect() {
  el('vehicleSelect').addEventListener('change', (e) => switchVehicle(e.target.value));
}

async function main() {
  await loadInitialData();
  bindTabs();
  bindForms();
  bindLists();
  bindDataActions();
  bindVehicleSelect();
  bindLiteUI();bindDetailUI();if(typeof bindOcrUI==='function')bindOcrUI();
  renderAll();
  resetFuelForm();
  resetMaintenanceForm();
  if(typeof cloudInit==='function')cloudInit();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

function confirmMileage(record){if(!(record.odometer>0))return true;const other=[...state.fuel,...state.maintenance].filter(r=>r.vehicleId===record.vehicleId&&r.id!==record.id&&r.odometer>0);const conflict=other.find(r=>(r.date<record.date&&r.odometer>record.odometer)||(r.date>record.date&&r.odometer<record.odometer));return !conflict||confirm(`里程日期可能衝突：${conflict.date} 為 ${currency(conflict.odometer)} km。仍要儲存本筆？`);}
function updatePrice(){const l=Number(el('fuelLiters').value),a=el('fuelAmount').value;el('fuelPricePreview').textContent=l>0&&a!==''?`每公升 NT$ ${num(Number(a)/l,2)}`:'每公升價格 —';}
function bindLiteUI(){
  const open=(key,ocr=false)=>{if(!canDiscardEditors())return false;resetFuelForm();resetMaintenanceForm();restoreVehicleSettings();document.querySelector(`[data-tab="${key}"]`).click();setEditorVehicle(key);el(key+'Editor').hidden=false;el(key+'Editor').scrollIntoView({block:'start',behavior:'smooth'});if(ocr&&typeof resetOcrUI==='function'){el('ocrPanel').open=true;}return true;};
  el('quickFuel').onclick=()=>open('fuel');el('quickMaint').onclick=()=>open('maintenance');el('fuelNewBtn').onclick=()=>open('fuel');el('maintenanceNewBtn').onclick=()=>open('maintenance');if(typeof bindOcrUI==='function')el('ocrNewBtn').onclick=()=>open('maintenance',true);
  for(const key of ['fuel','maintenance']){
    const refresh=key==='fuel'?renderFuelTable:renderMaintenanceTable,input=el(key+'Search');
    for(const event of ['input','change','focus'])input.addEventListener(event,refresh);
    input.addEventListener('animationstart',e=>{if(e.animationName==='vh-search-autofill')refresh();});
    el(key+'Year').addEventListener('change',refresh);
    el(key+'ClearFilter').onclick=()=>{input.value='';el(key+'Year').value='all';refresh();};
  }
  el('analysisYear').onchange=renderAnalysis;el('includeEstimated').onchange=renderAnalysis;for(const id of ['fuelAmount','fuelLiters'])el(id).addEventListener('input',updatePrice);
  el('vehicleForm').onsubmit=e=>{e.preventDefault();const v=getSelectedVehicle();v.name=el('vehicleName').value.trim()||v.name;v.fuelType=el('vehicleFuelType').value.trim();v.plate=el('vehiclePlate').value.trim();persist();renderAll();showToast('車輛已更新');};
  el('cancelVehicleSettings').onclick=()=>{restoreVehicleSettings();resumeCloudAfterEditor();showToast('已取消未儲存設定');};
  el('addVehicle').onclick=()=>{if(!canDiscardEditors())return;const name=prompt('新車輛名稱');if(!name||!name.trim())return;const v={id:uid('car'),name:name.trim(),fuelType:'',odometer:0};state.vehicles.push(v);state.settings.lastVehicleId=v.id;resetFuelForm();resetMaintenanceForm();resetVehicleFilters();persist();renderAll();showToast('已新增車輛');};
}
function fuelCycleHTML(r,s){if(!s)return `<div class="cycle-note">${r.fullTank?(r.odometer?'尚無可結算的完整區間':'缺少里程，油量併入下一個有效區間'):'部分加油，油量併入下一個有效區間'}</div>`;return `<div class="cycle-box"><div class="cycle-note">${escapeHtml(s.fromDate)} ～ ${escapeHtml(s.toDate)}${s.estimated?' · 含估算':''}</div><div class="record-metrics"><span>區間距離<b>${currency(s.distance)} km</b></span><span>區間油耗<b>${num(s.kmPerLiter,2)} km/L</b></span><span>每公里油費<b>${s.amount==null?'—':'$'+num(s.amount/s.distance,2)}</b></span></div><div class="cycle-note">累計 ${num(s.liters,2)} L · ${s.count} 筆加油</div></div>`;}
function discountMode(r){if(['separate','included','manual'].includes(r.discountMode))return r.discountMode;const p=Number(r.parts||0)+Number(r.labor||0),d=Number(r.discount||0),t=Number(r.total);return Math.abs(p-d-t)<.01?'separate':Math.abs(p-t)<.01?'included':'manual';}
function discountLabel(m){return {separate:'另扣',included:'已扣',manual:'原單實付'}[m]||'原單實付';}
function detailTotals(rows,discount,mode){let parts=0,labor=0;for(const d of rows){if(d.category==='工資')labor+=Number(d.amount||0);else parts+=Number(d.amount||0);}return {parts,labor,total:Math.max(0,parts+labor-(mode==='separate'?Number(discount||0):0))};}
function validDetailRows(rows){return rows.every(d=>typeof d.name==='string'&&d.name.trim()&&[d.qty,d.unitPrice,d.amount].every(v=>v!==''&&v!=null&&Number.isFinite(Number(v))&&Number(v)>=0));}
function renderDetailEditor(){const host=el('detailRows');host.innerHTML=editDetails.length?editDetails.map((d,i)=>`<div class="detail-row" data-index="${i}"><label class="detail-name"><span>項目名稱</span><input data-field="name" value="${escapeHtml(d.name||'')}" required></label><label><span>分類</span><input data-field="category" value="${escapeHtml(d.category||'零件')}" list="detailCategories"></label><label><span>數量</span><input type="number" min="0" step="any" data-field="qty" value="${escapeHtml(d.qty??'')}" required></label><label><span>單價</span><input type="number" min="0" step="any" data-field="unitPrice" value="${escapeHtml(d.unitPrice??'')}" required></label><label><span>小計</span><input type="number" min="0" step="any" data-field="amount" value="${escapeHtml(d.amount??'')}" required></label><label class="detail-name"><span>明細備註</span><input data-field="note" value="${escapeHtml(d.note||'')}"></label><button type="button" class="row-btn delete" data-remove-detail="${i}">移除項目</button></div>`).join('')+'<datalist id="detailCategories"><option value="零件"><option value="工資"><option value="油品"><option value="用品"><option value="檢查"><option value="免費服務"></datalist>':'<p class="help-text">可直接記總金額，不必逐項輸入。</p>';updateDetailPreview();}
function updateDetailPreview(){const t=detailTotals(editDetails,el('maintenanceDiscount').value,el('discountMode').value);el('detailTotalPreview').textContent=editDetails.length?`明細合計 $${currency(t.parts+t.labor)}｜${el('discountMode').value==='manual'?'實付金額手動填寫':'計算實付 $'+currency(t.total)}`:'';}
function applyDetailTotals(){if(!editDetails.length||!validDetailRows(editDetails)){showToast('請先填寫有效的明細');return;}const mode=el('discountMode').value,t=detailTotals(editDetails,el('maintenanceDiscount').value,mode);el('maintenanceParts').value=t.parts;el('maintenanceLabor').value=t.labor;if(mode!=='manual')el('maintenanceTotal').value=t.total;updateDetailPreview();}
function bindDetailUI(){el('addDetail').onclick=()=>{editDetails.push({category:'零件',name:'',qty:1,unitPrice:0,amount:0});detailsDirty=true;renderDetailEditor();};el('applyDetailTotals').onclick=applyDetailTotals;el('discountMode').onchange=()=>{updateDetailPreview();};el('detailRows').addEventListener('input',e=>{const row=e.target.closest('[data-index]'),k=e.target.dataset.field;if(!row||!k)return;const d=editDetails[+row.dataset.index];if(!d)return;d[k]=['qty','unitPrice','amount'].includes(k)?(e.target.value===''?'':Number(e.target.value)):e.target.value;detailsDirty=true;if(k==='qty'||k==='unitPrice'){d.amount=Math.round(Number(d.qty||0)*Number(d.unitPrice||0)*100)/100;row.querySelector('[data-field="amount"]').value=d.amount;}updateDetailPreview();});el('detailRows').addEventListener('click',e=>{const b=e.target.closest('[data-remove-detail]');if(!b)return;editDetails.splice(+b.dataset.removeDetail,1);detailsDirty=true;renderDetailEditor();});el('maintenanceFiles').addEventListener('change',async e=>{const files=Array.from(e.target.files||[]),epoch=editorEpoch;if(!editorVehicle.maintenance||fileBusy)return;fileBusy=true;el('saveMaintenance').disabled=true;try{for(const f of files){if(f.size>15*1024*1024||!allowedType(f.type))throw new Error('僅接受 15 MB 以下的 JPG、PNG、WEBP、GIF 或 PDF');const ref={id:uid('file'),name:f.name,type:f.type,size:f.size};await putAttachment(ref.id,f);if(epoch!==editorEpoch)return;editAttachments.push(ref);renderAttachmentEditor();}showToast('附件已加入，請儲存工單');}catch(err){showToast('附件未完整加入：'+err.message);}finally{if(epoch===editorEpoch){fileBusy=false;el('saveMaintenance').disabled=false;e.target.value='';}}});el('attachmentRows').addEventListener('click',e=>{const b=e.target.closest('[data-remove-attachment]');if(b){editAttachments=editAttachments.filter(r=>r.id!==b.dataset.removeAttachment);renderAttachmentEditor();}});document.body.addEventListener('click',async e=>{const b=e.target.closest('[data-open-attachment]');if(!b)return;const id=b.dataset.openAttachment;const refs=[...(editorVehicle.maintenance===getSelectedVehicleId()?editAttachments:[]),...vehicleMaintenanceRecords().flatMap(r=>r.localAttachments||[])];const ref=refs.find(r=>r.id===id);if(!ref){showToast('附件不屬於目前車輛');return;}try{const blob=await getAttachment(ref.id);if(!blob)throw new Error('檔案尚未匯入本機');downloadFile(blob,ref.name,ref.type);showToast('已開啟附件下載');}catch(err){showToast('附件無法讀取：'+err.message);}});}
function allowedType(t){return ['image/jpeg','image/png','image/webp','image/gif','application/pdf'].includes(t);}
function validAttachmentRef(r){return r&&typeof r.id==='string'&&r.id.length>0&&typeof r.name==='string'&&allowedType(r.type)&&Number.isFinite(r.size)&&r.size>=0&&r.size<=15*1024*1024;}
function openAttachments(){return new Promise((resolve,reject)=>{if(typeof indexedDB==='undefined'){reject(new Error('此瀏覽器不支援本機附件'));return;}const q=indexedDB.open('vehiclehub_lite_attachments',1);q.onupgradeneeded=()=>q.result.createObjectStore('files');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
async function putAttachment(id,blob){const db=await openAttachments();try{await new Promise((resolve,reject)=>{const t=db.transaction('files','readwrite');t.objectStore('files').put(blob,id);t.oncomplete=resolve;t.onabort=t.onerror=()=>reject(t.error||new Error('附件儲存失敗'));});}finally{db.close();}}
async function getAttachment(id){const db=await openAttachments();try{return await new Promise((resolve,reject)=>{const q=db.transaction('files','readonly').objectStore('files').get(id);q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>reject(q.error);});}finally{db.close();}}
function attachmentHTML(r){const refs=r.localAttachments||[];return `<div class="attachment-list">${refs.map(a=>`<button type="button" class="row-btn" data-open-attachment="${escapeHtml(a.id)}">📎 ${escapeHtml(a.name)}</button>`).join('')}${!refs.length&&r.attachmentName?`<p class="help-text">舊單據：${escapeHtml(r.attachmentName)}（尚未存入本機）</p>`:''}</div>${r.ocrImport?.reviewed?`<details class="ocr-history"><summary>影像辨識原文（已人工核對）</summary><p class="help-text">${escapeHtml(r.ocrImport.method==='ai'?'AI 進階':r.ocrImport.method==='drive'?'Drive OCR':'文字匯入')}${r.ocrImport.textTruncated?' · 文字已截短，請以原單為準':''}</p><pre>${escapeHtml(r.ocrImport.rawText||r.ocrImport.parsedText||'')}</pre>${r.ocrImport.rawText&&r.ocrImport.parsedText?`<pre>${escapeHtml(r.ocrImport.parsedText)}</pre>`:''}</details>`:''}`;}
function renderAttachmentEditor(){el('attachmentRows').innerHTML=editAttachments.map(a=>`<div class="attachment-row"><button type="button" class="row-btn" data-open-attachment="${escapeHtml(a.id)}">${escapeHtml(a.name)}</button><button class="row-btn delete" type="button" data-remove-attachment="${escapeHtml(a.id)}">移除</button></div>`).join('');}
function allRefs(data){return [...data.maintenance,...(data.trash||[]).filter(x=>x.key==='maintenance').map(x=>x.record)].flatMap(r=>r.localAttachments||[]);}
function blobData(blob){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(',')[1]);r.onerror=()=>rej(r.error);r.readAsDataURL(blob);});}
async function exportAttachmentFiles(data){const out=[];for(const ref of new Map(allRefs(data).map(x=>[x.id,x])).values()){const blob=await getAttachment(ref.id);if(!blob)throw new Error('缺少附件 '+ref.name+'；請重新附檔或匯入含附件的完整備份');out.push({...ref,base64:await blobData(blob)});}return out;}
async function importAttachmentFiles(files,data){if(!Array.isArray(files))throw new Error('附件格式錯誤');const map=new Map(files.map(x=>[x.id,x]));for(const ref of new Map(allRefs(data).map(x=>[x.id,x])).values()){const f=map.get(ref.id),existing=await getAttachment(ref.id);if(f){if(!validAttachmentRef(f)||f.type!==ref.type||f.size!==ref.size||typeof f.base64!=='string'||f.base64.length>21*1024*1024)throw new Error('附件資料錯誤');const bytes=Uint8Array.from(atob(f.base64),c=>c.charCodeAt(0));if(bytes.length!==ref.size)throw new Error('附件大小不符');if(existing){if(existing.size!==ref.size||await blobData(existing)!==f.base64)throw new Error('同識別碼附件內容衝突');}else await putAttachment(ref.id,new Blob([bytes],{type:ref.type}));}else if(!existing)throw new Error('備份缺少附件 '+ref.name);}}
function duplicateKey(key,r){return key==='fuel'?[r.vehicleId,r.date,r.odometer,r.liters,r.amount,r.fullTank].join('|'):r.workOrder?[r.vehicleId,r.date,r.workOrder].join('|'):[r.vehicleId,r.date,r.odometer,r.total,r.vendor,r.summary].join('|');}
function confirmDuplicate(key,r){const found=state[key].find(x=>x.id!==r.id&&duplicateKey(key,x)===duplicateKey(key,r));return !found||confirm('可能與既有同日紀錄重複，仍要儲存？');}
function stable(x){if(x===undefined)return 'null';if(x===null||typeof x!=='object')return JSON.stringify(x);if(Array.isArray(x))return '['+x.map(stable).join(',')+']';return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}';}
function rememberDeleted(key,r){state.trash=state.trash||[];state.tombstones=state.tombstones||[];state.trash.push({key,record:r,at:new Date().toISOString()});state.tombstones.push({key,id:r.id});}
function mergeData(local,incoming){const data=JSON.parse(JSON.stringify(local)),conflicts=[];let added=0;data.trash=data.trash||[];data.tombstones=data.tombstones||[];if(data.vehicles.length===1&&data.vehicles[0].id==='local-default'&&!data.fuel.length&&!data.maintenance.length&&!incoming.vehicles.some(v=>v.id==='local-default')){data.vehicles=[];data.settings.lastVehicleId=incoming.settings.lastVehicleId;}for(const v of incoming.vehicles){const old=data.vehicles.find(x=>x.id===v.id);if(!old)data.vehicles.push(v);else if(stable([old.name,old.plate||'',old.fuelType||''])!==stable([v.name,v.plate||'',v.fuelType||'']))conflicts.push({type:'vehicle',reason:'車輛設定不同',local:old,incoming:v});}for(const key of ['fuel','maintenance'])for(const r of incoming[key]){const old=data[key].find(x=>x.id===r.id);if(old){if(stable(old)!==stable(r)){// only augment attachment refs if other fields are identical
const {localAttachments:la,...a}=old,{localAttachments:ra,...b}=r;if(key==='maintenance'&&stable(a)===stable(b)){old.localAttachments=[...new Map([...(la||[]),...(ra||[])].map(x=>[x.id,x])).values()];}else conflicts.push({type:key,reason:'同 ID 內容不同',local:old,incoming:r});}continue;}if(data.tombstones.some(t=>t.key===key&&t.id===r.id)){conflicts.push({type:key,reason:'本機曾刪除',incoming:r});continue;}const dupe=data[key].find(x=>duplicateKey(key,x)===duplicateKey(key,r));if(dupe){conflicts.push({type:key,reason:'疑似重複（ID 不同）',local:dupe,incoming:r});continue;}data[key].push(r);added++;}return {data:normalizeImportedData(data),conflicts,added};}
function downloadFile(content,name,type){const blob=content instanceof Blob?content:new Blob([content],{type});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function csvCell(x){let s=String(x??'');if(/^[\s]*[=+\-@]/.test(s)&&typeof x==='string')s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function exportCSV(key){const fuel=key==='fuel',rows=fuel?vehicleFuelRecords():vehicleMaintenanceRecords(),cycles=new Map(calcEfficiencySummary(getSelectedVehicleId()).segments.map(x=>[x.toId,x]));const header=fuel?['車輛','日期','里程','油量','實付','加滿','加油站','區間公里','區間油量','km/L','備註']:['車輛','日期','里程','類型','維修廠','內容','零件','工資','折扣','折扣方式','實付','備註'];const data=rows.map(r=>{const s=cycles.get(r.id);return fuel?[getSelectedVehicle().name,r.date,r.odometer,r.liters,r.amount,r.fullTank?'是':'否',r.station,s?.distance,s?.liters,s?.kmPerLiter,r.notes]:[getSelectedVehicle().name,r.date,r.odometer,r.type,r.vendor,r.summary,r.parts,r.labor,r.discount,discountLabel(r.discountMode),r.total,r.notes];});downloadFile('\ufeff'+[header,...data].map(r=>r.map(csvCell).join(',')).join('\r\n'),`VehicleHub_${key}_${todayISO()}.csv`,'text/csv;charset=utf-8');}
function renderTrend(segments){const rows=segments.slice(0,60).reverse();if(!rows.length){el('trendChart').innerHTML='<p class="help-text">尚無完整區間。</p>';return;}const ma=rows.map((r,i)=>{const a=rows.slice(Math.max(0,i-2),i+1);return a.reduce((s,x)=>s+x.distance,0)/a.reduce((s,x)=>s+x.liters,0);});const max=Math.max(1,...rows.map(r=>r.kmPerLiter),...ma)*1.1,x=i=>46+(rows.length===1?270:i*540/(rows.length-1)),y=v=>210-v/max*182;const line=vals=>vals.map((v,i)=>`${x(i)},${y(v)}`).join(' ');el('trendChart').innerHTML=`<svg class="trend-svg" viewBox="0 0 620 250" role="img" aria-label="區間油耗及最近三段加權平均">${[0,.25,.5,.75,1].map(f=>`<path d="M46 ${y(max*f)} H586" stroke="#dce5ea"/><text x="40" y="${y(max*f)+4}" text-anchor="end" fill="#64748b" font-size="11">${num(max*f,1)}</text>`).join('')}<polyline points="${line(rows.map(r=>r.kmPerLiter))}" fill="none" stroke="#267c84" stroke-width="2.4"/><polyline points="${line(ma)}" fill="none" stroke="#bb8439" stroke-width="2" stroke-dasharray="6 4"/>${rows.map((r,i)=>`<circle cx="${x(i)}" cy="${y(r.kmPerLiter)}" r="3.5" fill="${r.estimated?'#fff':'#267c84'}" stroke="#267c84"><title>${escapeHtml(r.toDate)}：${num(r.kmPerLiter,2)} km/L</title></circle>`).join('')}<text x="46" y="236" font-size="11" fill="#64748b">${escapeHtml(rows[0].toDate)}</text><text x="586" y="236" text-anchor="end" font-size="11" fill="#64748b">${escapeHtml(rows[rows.length-1].toDate)}</text></svg><div class="help-text">實線：區間油耗（空心為估算）｜虛線：最近三段加權平均。最新三段 ${num(ma[ma.length-1],2)} km/L；最多顯示 60 段。</div>`;}
function renderAnnualCosts(id,year,includeEstimated){const f=vehicleFuelRecords(id),m=vehicleMaintenanceRecords(id),years=[...new Set([...f,...m].map(r=>r.date.slice(0,4)))].filter(y=>year==='all'||y===year).sort().reverse();el('annualCosts').innerHTML=years.length?years.map(y=>{const a=f.filter(r=>r.date.startsWith(y)).reduce((n,r)=>n+Number(r.amount||0),0),b=m.filter(r=>r.date.startsWith(y)).reduce((n,r)=>n+Number(r.total||0),0),s=calcEfficiencySummary(id,y,includeEstimated);return `<div class="annual-row"><strong>${escapeHtml(y)}</strong><span>加油 $${currency(a)}</span><span>維修 $${currency(b)}</span><b>合計 $${currency(a+b)}</b><span>${s.avgKmPerLiter==null?'—':num(s.avgKmPerLiter,2)+' km/L'}</span></div>`;}).join(''):'<p class="help-text">尚無支出紀錄。</p>';}

if(typeof document!== 'undefined')main().catch(err=>{console.error(err);document.body.insertAdjacentHTML('afterbegin','<p role="alert" class="startup-error">無法載入資料，未覆寫本機紀錄。請先保留原始備份後再處理。</p>');});
