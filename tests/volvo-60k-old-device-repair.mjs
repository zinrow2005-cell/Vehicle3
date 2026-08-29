import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const data=JSON.parse(fs.readFileSync(path.join(root,'initial-complete-data.json'),'utf8'));
const fail=msg=>{throw new Error(msg)};
const cStart=app.indexOf('const VOLVO_60K_MAINTENANCE =');
const cEnd=app.indexOf('const VOLVO_FUEL_HISTORY',cStart);
const fStart=app.indexOf('function ensureVolvo60KMaintenance');
const fEnd=app.indexOf('function ensureVolvoFuelHistory',fStart);
if(cStart<0||cEnd<0||fStart<0||fEnd<0)fail('找不到VOLVO 6萬公里 migration 程式');
const source=`${app.slice(cStart,cEnd)}\n${app.slice(fStart,fEnd)}\nreturn {VOLVO_60K_MAINTENANCE,ensureVolvo60KMaintenance};`;
const {ensureVolvo60KMaintenance}=new Function(source)();
// 模擬已是V5.6.2的舊裝置：舊migration都完成，但還沒有6萬公里新工單。
data.maintenance=data.maintenance.filter(x=>x.workOrder!=='WV2608011100'&&x.id!=='volvo-maint-20260810-60k');
data.reminders=data.reminders.filter(x=>x.sourceId!=='volvo-maint-20260810-60k');
data.partInspections=data.partInspections.filter(x=>!['brake-pads','ac-system'].includes(x.standardId));
for(const x of data.partInspections){if(x.vehicleId==='v1'&&['battery','tires'].includes(x.standardId))x.lastInspectDate=x.lastReplaceDate;}
const volvo=data.vehicles.find(x=>x.id==='v1');volvo.odometer=62872;
const mount=data.partStandards.find(x=>x.id==='engine-mounts');mount.aliases=mount.aliases.filter(x=>!['扭力臂','扭力桿','上引擎支架'].includes(x));
ensureVolvo60KMaintenance(data);
const found=data.maintenance.filter(x=>x.workOrder==='WV2608011100');
if(found.length!==1)fail(`6萬公里工單補回筆數錯誤：${found.length}`);
if(Number(volvo.odometer)!==63343)fail('VOLVO里程沒有更新到63,343 km');
for(const id of ['battery','tires','brake-pads','ac-system']){
  const row=data.partInspections.find(x=>x.vehicleId==='v1'&&x.standardId===id);
  if(!row||row.lastInspectDate!=='2026-08-10')fail(`${id}未更新2026/08/10檢查基準`);
}
const ac=data.partInspections.find(x=>x.vehicleId==='v1'&&x.standardId==='ac-system');
if(ac.condition!=='attention')fail('蒸發器滲漏未列attention');
const rem=data.reminders.find(x=>x.sourceId==='volvo-maint-20260810-60k');
if(rem?.targetDate!=='2027-07-21')fail('下次定保提醒未補回');
for(const alias of ['扭力臂','扭力桿','上引擎支架'])if(!mount.aliases.includes(alias))fail(`引擎腳標準缺少${alias}別名`);
ensureVolvo60KMaintenance(data);
if(data.maintenance.filter(x=>x.workOrder==='WV2608011100').length!==1)fail('重複執行migration造成工單重複');
console.log('✓ V5.6.2舊裝置可自動補入2026/08/10 VOLVO 6萬公里工單');
console.log('✓ 里程、檢查基準、蒸發器待修、下次定保提醒同步更新');
console.log('✓ 重複執行不會建立重複工單');
