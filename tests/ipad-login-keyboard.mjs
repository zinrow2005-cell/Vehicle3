import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const source=fs.readFileSync(path.join(root,'auth-sync.js'),'utf8');

if(source.includes("addEventListener('touchend'")) throw new Error('FAIL: login field still has touchend focus override');
if(source.includes("input?.addEventListener('click'")) throw new Error('FAIL: login field still has click focus override');
if(!source.includes("addEventListener('pointerdown', prepare")) throw new Error('FAIL: pointerdown prepare guard missing');
if(!source.includes("addEventListener('touchstart', prepare")) throw new Error('FAIL: touchstart prepare guard missing');
if(!source.includes("classList.toggle('ipad-native-input', enabled)")) throw new Error('FAIL: iPad native-input class missing');

class MemoryStorage{constructor(){this.map=new Map();}getItem(k){return this.map.has(k)?this.map.get(k):null;}setItem(k,v){this.map.set(k,String(v));}removeItem(k){this.map.delete(k);}}
class ClassList{constructor(){this.set=new Set();}toggle(k,on){if(on)this.set.add(k);else this.set.delete(k);return on;}contains(k){return this.set.has(k);}}
class FakeElement{
  constructor(id,doc){this.id=id;this.doc=doc;this.hidden=false;this.disabled=false;this.readOnly=false;this.tabIndex=0;this.style={};this.value='';this.type=id==='loginPassword'?'password':'text';this.textContent='';this.listeners={};this.attributes={};}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  dispatch(type){for(const fn of this.listeners[type]||[])fn({target:this,currentTarget:this,preventDefault(){}});}
  focus(){this.doc.activeElement=this;this.focusCount=(this.focusCount||0)+1;}
  blur(){if(this.doc.activeElement===this)this.doc.activeElement=this.doc.body;this.blurCount=(this.blurCount||0)+1;}
  setAttribute(k,v){this.attributes[k]=String(v);}
}
const document={activeElement:null,body:{id:'body'},documentElement:{classList:new ClassList()},querySelector(sel){return this.elements[sel.slice(1)]||null;},elements:{},createElement(){return new FakeElement('',this);},createTextNode(v){return {textContent:String(v)}}};
document.activeElement=document.body;
for(const id of ['loginGate','appShell','loginForm','toggleLoginPassword','loginUsername','loginPassword','enableLoginUsername','enableLoginPassword','cloudPassword','appsScriptUrl']) document.elements[id]=new FakeElement(id,document);

const context={console,document,navigator:{userAgent:'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)',platform:'iPad',maxTouchPoints:5},localStorage:new MemoryStorage(),sessionStorage:new MemoryStorage(),globalThis:null,crypto:{subtle:{}},TextEncoder,setInterval(){return 1;},clearInterval(){},setTimeout,Date,JSON,Math,Number,String,Array,Object,Error,Promise,fetch:async()=>{throw new Error('not used');},alert(){},confirm(){return false;},location:{reload(){}},structuredClone:globalThis.structuredClone};
context.globalThis=context;
vm.createContext(context); vm.runInContext(source,context,{filename:'auth-sync.js'});
const user=document.elements.loginUsername, pass=document.elements.loginPassword;
if(!document.documentElement.classList.contains('ipad-native-input')) throw new Error('FAIL: iPad native-input class was not enabled');
if((user.listeners.touchend||[]).length||(pass.listeners.touchend||[]).length) throw new Error('FAIL: touchend listeners should not be attached to login inputs');
if((user.listeners.click||[]).length||(pass.listeners.click||[]).length) throw new Error('FAIL: click listeners should not be attached to login inputs');
user.dispatch('touchstart'); if(user.disabled||user.readOnly) throw new Error('FAIL: username not prepared writable on touchstart');
pass.dispatch('pointerdown'); if(pass.disabled||pass.readOnly) throw new Error('FAIL: password not prepared writable on pointerdown');
document.activeElement=user; document.elements.enableLoginUsername.dispatch('click'); if(document.activeElement!==user||!user.blurCount) throw new Error('FAIL: username backup did not blur+refocus');
document.activeElement=pass; document.elements.enableLoginPassword.dispatch('click'); if(document.activeElement!==pass||!pass.blurCount) throw new Error('FAIL: password backup did not blur+refocus');
console.log('PASS: V5.6.6 physical iPad native-input regression test passed.');
