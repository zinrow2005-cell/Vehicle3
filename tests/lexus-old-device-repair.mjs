import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const data=JSON.parse(fs.readFileSync(path.join(root,'initial-complete-data.json'),'utf8'));
const fail=msg=>{throw new Error(msg)};
const start=app.indexOf('function prependFuelConfirmationNote');
const end=app.indexOf('function applyV58PartBaselineCorrections',start);
if(start<0||end<0)fail('找不到正式加油一致性修復函式');
const source=app.slice(start,end);
const applyRepair=new Function('isLexusVehicleName',`${source}\nreturn applyV56ConfirmedFuelCycles;`)(name=>String(name||'').toUpperCase().includes('LEXUS'));
// 模擬曾升級過、migration旗標已true，但LEXUS加滿狀態仍殘留null的舊iPad/iPhone。
data.migrations.v56ConfirmedFuelCycles=true;
for(const row of data.fuel){
  if(row.vehicleId==='v2'&&String(row.id||'').startsWith('lex-fuel-')){row.fullTank=null;row.userConfirmed=false;row.fullTankEstimated=false;}
  if(row.id==='volvo-fuel-20260721'){row.fullTank=true;row.userConfirmed=false;}
}
applyRepair(data);
const lex=data.fuel.filter(x=>x.vehicleId==='v2'&&String(x.id||'').startsWith('lex-fuel-'));
if(lex.length!==21)fail(`LEXUS筆數錯誤：${lex.length}`);
if(lex.some(x=>x.fullTank!==true||x.userConfirmed!==true||x.fullTankEstimated!==false))fail('舊裝置LEXUS加滿狀態沒有完整修復');
const partial=data.fuel.find(x=>x.id==='volvo-fuel-20260721');
if(!partial||partial.fullTank!==false||partial.userConfirmed!==true)fail('VOLVO 2026/07/21部分加油沒有被一致性修復');
if(!app.includes('applyV56ConfirmedFuelCycles(data);\n    data.migrations.v56ConfirmedFuelCycles=true;'))fail('migrateData沒有每次執行一致性修復');
if(app.includes('if(!data.migrations.v56ConfirmedFuelCycles){applyV56ConfirmedFuelCycles(data)'))fail('仍依賴舊migration旗標，可能重現資料不足');
console.log('✓ 舊裝置migration=true但LEXUS fullTank=null：21筆全部自動修復為確認加滿');
console.log('✓ VOLVO 2026/07/21自動維持確認部分加油');
console.log('✓ 每次load／雲端下載reload／JSON匯入都會再次套用一致性修復');
