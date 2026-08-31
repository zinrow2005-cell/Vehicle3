import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const fail=msg=>{console.error(`FAIL: ${msg}`);process.exit(1)};
const pass=msg=>console.log(`PASS: ${msg}`);

if(!app.includes('@page{size:210mm 297mm;margin:9mm 9mm 12mm}')) fail('missing explicit A4 portrait page size');
pass('explicit A4 portrait page size 210mm x 297mm');
if(app.includes("orientation:'landscape'")||app.includes("orientation='landscape'")||app.includes('A4 landscape')) fail('landscape print path still exists');
pass('no landscape print path remains');
if(!app.includes('function openPrintReport(title, bodyHtml){')) fail('openPrintReport still accepts orientation override');
pass('all report buttons share the fixed portrait print path');
for(const id of ['printCurrentVehiclePdf','printServiceShopPdf','printFleetOverviewPdf','printFullBackupPdf']){
  if(!html.includes(`id="${id}"`)) fail(`missing PDF button ${id}`);
}
pass('all four PDF export buttons are present');
if(!app.includes('transform:none!important;rotate:none!important')) fail('rotation guard missing');
pass('report root has transform/rotate guard');
if(!app.includes('.service-shop-report th,.service-shop-report td{padding:3px 3.4px;white-space:normal')) fail('service-shop portrait wrapping missing');
pass('service-shop tables wrap for portrait A4');
if(!app.includes('.wide-table table{font-size:6.7pt;table-layout:auto}')) fail('wide-table portrait sizing missing');
pass('wide tables use portrait-safe sizing');
console.log('PASS: V5.6.7 PDF portrait regression passed.');
