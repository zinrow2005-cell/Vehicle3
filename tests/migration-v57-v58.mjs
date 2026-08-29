import fs from 'node:fs';
const source=fs.readFileSync(new URL('../initial-complete-data.json',import.meta.url),'utf8');
const data=JSON.parse(source);
const copy=structuredClone(data);
copy.schemaVersion=57; delete copy.migrations?.v58FinalValidation;
if(copy.schemaVersion!==57)throw new Error('V57測試資料建立失敗');
if(copy.fuel.filter(x=>x.vehicleId==='v2').length!==21)throw new Error('LEXUS測試資料缺失');
if(copy.fuel.find(x=>x.date==='2026-07-21'&&x.vehicleId==='v1')?.fullTank!==false)throw new Error('VOLVO部分加油狀態未保留');
console.log('✓ V57 → V58 migration資料前置條件通過');
