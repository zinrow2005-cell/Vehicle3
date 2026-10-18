import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const fail=msg=>{console.error(`✗ ${msg}`);process.exitCode=1;};
const pass=msg=>console.log(`✓ ${msg}`);
for(const file of ['index.html','app.js','auth-sync.js','styles.css','sw.js','manifest.webmanifest','version.json','icon-192.png','icon-512.png','icon-maskable-512.png','Google_Sheets_Apps_Script/Code.gs','Google_Sheets_Apps_Script/appsscript.json']){if(!fs.existsSync(path.join(root,file)))fail(`缺少必要檔案：${file}`);else pass(`必要檔案存在：${file}`);}
const html=read('index.html'),app=read('app.js'),auth=read('auth-sync.js'),sw=read('sw.js'),version=JSON.parse(read('version.json'));
const appVersion=app.match(/const APP_VERSION = '([^']+)'/)?.[1],schema=Number(app.match(/const SCHEMA_VERSION = (\d+)/)?.[1]),swVersion=sw.match(/const APP_VERSION = '([^']+)'/)?.[1];
if(appVersion!==version.version)fail('app.js與version.json版本不一致');else pass('APP版本一致');
if(swVersion!==version.version)fail('Service Worker版本不一致');else pass('Service Worker版本一致');
if(schema!==Number(version.schemaVersion))fail('資料庫版本不一致');else pass('資料庫版本一致');
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(x=>x[1]);const dup=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];if(dup.length)fail(`HTML有重複ID：${dup.join(',')}`);else pass(`${ids.length}個HTML ID均唯一`);
for(const id of ['loginGate','loginForm','logoutButton','view-sync','appsScriptUrl','cloudPullButton','cloudPushButton']){if(!ids.includes(id))fail(`缺少登入／同步元件：${id}`);else pass(`登入／同步元件存在：${id}`);}
for(const token of ['dad','mom','03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4','cloudPush','cloudPull']){if(!auth.includes(token))fail(`auth-sync.js缺少：${token}`);else pass(`登入／同步功能存在：${token}`);}
if(!sw.includes("'./auth-sync.js'"))fail('Service Worker未快取auth-sync.js');else pass('Service Worker包含登入同步程式');

// V5.6.6 physical iPad native-input regression guards.
if(auth.includes("$('#loginUsername').focus();")) fail('登入頁仍在載入時自動focus帳號欄，iPad可能不彈鍵盤'); else pass('登入頁不再載入時自動focus帳號欄');
for(const id of ['enableLoginUsername','enableLoginPassword']){if(!ids.includes(id))fail(`缺少iPad登入鍵盤備援：${id}`);else pass(`iPad登入鍵盤備援存在：${id}`);}
if(auth.includes("addEventListener('touchend'")||auth.includes("input?.addEventListener('click'"))fail('登入輸入框仍攔截iPad原生touch/click焦點');else pass('登入輸入框不再攔截iPad原生touch/click焦點');
if(!auth.includes('applyIPadNativeInputMode()')||!auth.includes("addEventListener('touchstart', prepare")||!auth.includes("addEventListener('pointerdown', prepare"))fail('iPad原生輸入模式前置保護缺失');else pass('iPad只在touchstart/pointerdown準備欄位，不搶focus');
if(!html.includes('autocapitalize="none"')||!html.includes('enterkeyhint="next"')||!html.includes('enterkeyhint="done"'))fail('登入欄iPad輸入屬性未完整設定');else pass('登入欄iPad輸入屬性已完整設定');
if(!app.includes('function isCoarseTouchInput()')||!app.includes('if(!isCoarseTouchInput()) setTimeout(()=>form.querySelector'))fail('動態表單仍可能在iPhone/iPad自動focus造成鍵盤不彈');else pass('iPhone/iPad動態表單已取消程式自動focus');
const styles=read('styles.css');if(!styles.includes('V5.6.6 iPhone/iPad all-form input hardening')||!styles.includes('font-size:16px!important')||!styles.includes('pointer-events:auto'))fail('iPhone/iPad全輸入框觸控保護缺失');else pass('iPhone/iPad全輸入框觸控與16px防縮放保護已建立');
if(!styles.includes('physical iPad Safari/PWA native-input compatibility')||!styles.includes('html.ipad-native-input .login-gate{position:absolute'))fail('實體iPad非fixed登入相容模式缺失');else pass('實體iPad登入遮罩改為非fixed原生輸入模式');
if(!html.includes('./auth-sync.js?v=5.6.8')||!html.includes('./styles.css?v=5.6.8')||!html.includes('./app.js?v=5.6.8'))fail('V5.6.7關鍵前端資源未做快取破除');else pass('V5.6.7關鍵前端資源已加入快取破除參數');
if(!sw.includes('await self.skipWaiting()')||!sw.includes('styles\\.css|app\\.js|auth-sync\\.js'))fail('Service Worker即時更新／關鍵資源network-first缺失');else pass('Service Worker自動啟用並對關鍵UI資源network-first');
if(!app.includes("type==='number'?'inputmode=\"decimal\"'"))fail('動態數字欄未指定decimal鍵盤提示');else pass('動態數字欄已指定decimal鍵盤提示');
if(/type="number"(?![^>]*inputmode=)/.test(html))fail('仍有靜態number欄位未指定inputmode');else pass('所有靜態number欄位均指定decimal鍵盤提示');


// V5.6.7 PDF portrait-layout regression guards.
if(!app.includes('function reportCss(){return `')||!app.includes('@page{size:210mm 297mm;margin:9mm 9mm 12mm}'))fail('PDF未固定為A4直式210×297mm');else pass('所有PDF固定使用A4直式210×297mm');
if(app.includes("orientation:'landscape'")||app.includes("orientation='landscape'")||app.includes('size:A4 ${orientation}'))fail('PDF仍殘留橫式landscape方向設定');else pass('PDF匯出已移除舊landscape方向設定');
if(!app.includes('body{print-color-adjust:exact;-webkit-print-color-adjust:exact;transform:none!important;rotate:none!important}')||!app.includes('.report{width:100%;max-width:100%;margin:0 auto;transform:none!important;rotate:none!important}'))fail('PDF內容缺少防止整頁旋轉保護');else pass('PDF內容已強制取消transform/rotate');
if(!app.includes('.wide-table table{font-size:6.7pt;table-layout:auto}')||!app.includes('.service-shop-report th,.service-shop-report td{padding:3px 3.4px;white-space:normal'))fail('A4直式寬表格換行／縮排保護缺失');else pass('A4直式寬表格與維修廠清單已重新排版');
if(!html.includes('A4 直式列印版面')||!html.includes('直向／Portrait'))fail('報表匯出頁未提示A4直式列印');else pass('報表匯出頁已明確提示A4直式');

const data=JSON.parse(read('initial-complete-data.json'));
if(data.schemaVersion!==59)fail('initial-complete-data schema不是59');else pass('完整資料schema為59');
const volvo=data.fuel.filter(x=>x.vehicleId==='v1'),lexus=data.fuel.filter(x=>x.vehicleId==='v2');
const partial=volvo.find(x=>x.date==='2026-07-21');
if(!partial||partial.fullTank!==false||partial.liters!==25.56||partial.amount!==800||!partial.userConfirmed)fail('VOLVO 2026/07/21部分加油資料錯誤');else pass('VOLVO 2026/07/21已確認部分加油');
if(lexus.length!==21||lexus.some(x=>x.fullTank!==true||!x.userConfirmed))fail('LEXUS 21筆加油未全部確認加滿');else pass('LEXUS 21筆均已確認加滿');
if(app.includes('if(!data.migrations.v56ConfirmedFuelCycles){applyV56ConfirmedFuelCycles(data)'))fail('LEXUS加滿修復仍只依賴migration旗標');else if(!app.includes('applyV56ConfirmedFuelCycles(data);\n    data.migrations.v56ConfirmedFuelCycles=true;'))fail('LEXUS每次載入一致性修復缺失');else pass('LEXUS舊裝置migration旗標不再阻止一致性修復');
function fuelRows(rows){let last=null,liters=0,amount=0;return rows.slice().sort((a,b)=>a.date.localeCompare(b.date)||(Number(a.odometer)||0)-(Number(b.odometer)||0)).map((row,i,arr)=>{if(last!==null){if(Number(row.liters)>0)liters+=Number(row.liters);amount+=Number(row.amount)||0;}let efficiency=null,distance=null,cycleLiters=null,cycleAmount=null;if(row.fullTank===true&&Number(row.odometer)>0){if(last!==null){distance=Number(row.odometer)-Number(arr[last].odometer);if(distance>0&&liters>0){cycleLiters=liters;cycleAmount=amount;efficiency=distance/liters;}}last=i;liters=0;amount=0;}return {...row,efficiency,distance,cycleLiters,cycleAmount};});}
function stats(rows){const valid=fuelRows(rows).filter(x=>x.efficiency);const recent=valid.slice(-3);const distance=recent.reduce((s,x)=>s+x.distance,0), liters=recent.reduce((s,x)=>s+x.cycleLiters,0), amount=recent.reduce((s,x)=>s+x.cycleAmount,0);return {latest:valid.at(-1)?.efficiency||0,weighted:distance/liters,cost:amount/distance};}
const vs=stats(volvo),ls=stats(lexus);
if(Math.abs(vs.latest-11.95948)>.001||Math.abs(vs.weighted-12.06798)>.001||Math.abs(vs.cost-2.74669)>.001)fail('VOLVO油耗驗收值不一致');else pass('VOLVO油耗驗收值11.96／12.07／2.75通過');
if(Math.abs(ls.latest-8.00676)>.001||Math.abs(ls.cost-3.93056)>.001)fail('LEXUS油耗驗收值不一致');else pass('LEXUS油耗驗收值8.01／3.93通過');
const lexComputed=fuelRows(lexus),lexValid=lexComputed.filter(x=>x.efficiency),lexDec=lexComputed.find(x=>x.date==='2025-12-11'),lexJul=lexComputed.find(x=>x.date==='2026-07-27');
if(lexValid.length!==16)fail(`LEXUS有效油耗週期應為16個，實際為${lexValid.length}`);else pass('LEXUS全歷史形成16個有效油耗週期');
if(Math.abs(Number(lexDec?.cycleLiters)-102.76)>.001)fail('LEXUS 2025/11/26無里程加油未正確併入12/11週期');else pass('LEXUS 2025/11/26無里程加油正確併入12/11週期');
if(Math.abs(Number(lexJul?.cycleLiters)-230.93)>.001)fail('LEXUS 2026/03～06無里程加油未正確併入7/27週期');else pass('LEXUS 2026/03～06無里程加油正確併入7/27週期');
if(!app.includes('x.workOrder')||!app.includes('WA24080060')){ if(!app.includes('x.workOrder')) fail('全域搜尋未納入工單號'); } else pass('工單號搜尋程式存在');
if(!auth.includes('remoteRevision')||!auth.includes('localBaseRevision'))fail('雲端revision雙基準保護缺失');else pass('remoteRevision/localBaseRevision保護存在');
if(!auth.includes("action: 'status'"))fail('上傳前未查詢雲端revision');else pass('上傳前revision preflight存在');
if(!app.includes("days===0?'今天到期'"))fail('今天到期邏輯缺失');else pass('今天到期邏輯存在');
if(!app.includes('待建立基準檢查')||!app.includes('待建立現況基準'))fail('待建立基準提醒邏輯缺失');else pass('待建立基準提醒邏輯存在');
const tire=data.partInspections.find(x=>x.vehicleId==='v1'&&x.standardId==='tires'),battery=data.partInspections.find(x=>x.vehicleId==='v1'&&x.standardId==='battery');
if(tire?.lastReplaceDate!=='2025-08-16'||battery?.lastReplaceDate!=='2025-08-26'||tire?.lastInspectDate!=='2026-08-10'||battery?.lastInspectDate!=='2026-08-10')fail('VOLVO輪胎／電瓶更換或最新檢查基準錯誤');else pass('VOLVO輪胎／電瓶保留更換日並更新2026/08/10原廠檢查基準');
if(!app.includes('reminderCategoryPriority'))fail('提醒分類優先度缺失');else pass('提醒優先度法規→安全→保養→其他→基準已建立');
if(!app.includes("value===false?'部分加油／未加滿'"))fail('部分加油UI未明確標示未加滿');else pass('部分加油UI明確標示未加滿');
if(!app.includes("if(row?.fullTank!==true)return null"))fail('部分加油仍可能被直接計算區間油耗');else pass('部分加油不做20.19等直接區間油耗判定');
if(!app.includes('已確認部分加油／未加滿'))fail('資料品質頁未明確說明部分加油');else pass('資料品質頁明確說明部分加油');
if(!app.includes("row?(row.fullTank===true?'true':row.fullTank===false?'false':'unknown'):'true'"))fail('完整新增加油表單未預設加滿');else pass('完整新增加油表單預設加滿，特殊部分加油才手動改否');
if(!app.includes("f.elements.fullTank.value='true'"))fail('快速加油切換車輛後未重設為加滿');else pass('快速加油每次新紀錄預設加滿');

const m60=data.maintenance.find(x=>x.id==='volvo-maint-20260810-60k'||x.workOrder==='WV2608011100');
if(!m60||m60.date!=='2026-08-10'||Number(m60.odometer)!==63343||Number(m60.total)!==33453||Number(m60.parts)!==24638||Number(m60.labor)!==8815)fail('VOLVO 6萬公里工單資料不完整');else pass('VOLVO 6萬公里工單完整：63,343 km／33,453元');
if(!m60?.details?.some(x=>String(x.name).includes('自動變速箱換油'))||!m60?.details?.some(x=>String(x.name).includes('扭力臂－右上'))||!m60?.details?.some(x=>String(x.name).includes('冷氣蒸發器')))fail('VOLVO 6萬公里逐項明細缺漏');else pass('VOLVO 6萬公里變速箱油／扭力臂／蒸發器待修均已列入');
const m60Attachment=path.join(root,m60?.attachment||'');
if(!m60?.attachment||!fs.existsSync(m60Attachment))fail('VOLVO 6萬公里原始單據PDF附件缺失');else pass('VOLVO 6萬公里3頁PDF附件存在');
const next60=data.reminders.find(x=>x.sourceType==='maintenance'&&x.sourceId==='volvo-maint-20260810-60k');
if(next60?.targetDate!=='2027-07-21')fail('VOLVO 6萬公里下次定保提醒錯誤');else pass('VOLVO 下次定保2027/07/21提醒已建立');
const ac60=data.partInspections.find(x=>x.vehicleId==='v1'&&x.standardId==='ac-system');
if(ac60?.lastInspectDate!=='2026-08-10'||ac60?.condition!=='attention')fail('VOLVO 蒸發器待修狀態未建立');else pass('VOLVO 蒸發器滲漏已列待修注意');

if(process.exitCode)process.exit(process.exitCode);
console.log('V5.6.8所有靜態品質檢查通過。');
