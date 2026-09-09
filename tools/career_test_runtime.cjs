// Boots the complete app with a DOM adapter; checks real save/load and view events.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
function runtime(){
const root=path.resolve(__dirname,'..'),nodes=new Map(),local=new Map(),noop=()=>{};
function node(key=''){
 if(nodes.has(key))return nodes.get(key);
 const events={},attrs={},classes=new Set();
 const n={id:key,dataset:{},style:{setProperty:noop,removeProperty:noop},value:'',checked:false,disabled:false,hidden:false,innerHTML:'',textContent:'',options:{length:0},children:[],childNodes:[],scrollTop:0,isConnected:true,paused:true,volume:.5,
 classList:{add:(...s)=>s.forEach(x=>classes.add(x)),remove:(...s)=>s.forEach(x=>classes.delete(x)),contains:s=>classes.has(s),toggle:(s,on)=>{if(on===undefined)on=!classes.has(s);on?classes.add(s):classes.delete(s);return on}},
 addEventListener:(name,fn)=>{(events[name]||=[]).push(fn)},removeEventListener:noop,dispatch:(name,event)=>(events[name]||[]).forEach(fn=>fn(event)),listenerCount:name=>(events[name]||[]).length,
 setAttribute:(k,v)=>attrs[k]=v,getAttribute:k=>attrs[k]||'',hasAttribute:k=>Object.prototype.hasOwnProperty.call(attrs,k),removeAttribute:k=>delete attrs[k],querySelector:s=>node(key+' '+s),querySelectorAll:()=>[],closest:()=>null,contains:()=>false,
 appendChild:noop,insertBefore:noop,insertAdjacentHTML:noop,append:noop,prepend:noop,replaceChildren:noop,remove:noop,focus:noop,play:()=>Promise.resolve(),pause:noop,load:noop,getContext:()=>null,getBoundingClientRect:()=>({width:1672,height:941,x:0,y:0,left:0,right:1672,top:0,bottom:941}),cloneNode:()=>node(key+' clone'),matches:()=>false};
 nodes.set(key,n);n.parentElement=nodeParent;n.parentNode=nodeParent;return n;
}
const nodeParent={scrollTop:0,appendChild:noop,classList:{add:noop,remove:noop,toggle:noop}};
const context={console,btoa,atob,URLSearchParams,URL,Map,Set,WeakMap,WeakSet,Array,Object,String,Number,Boolean,Math,Date,JSON,RegExp,Promise,Intl,parseInt,parseFloat,isNaN,encodeURI,decodeURI,performance:{now:()=>Date.now()},setTimeout:()=>1,clearTimeout:noop,setInterval:()=>1,clearInterval:noop,requestAnimationFrame:()=>1,cancelAnimationFrame:noop,location:{search:''},navigator:{userAgent:'DOM-adapter'},innerWidth:1672,innerHeight:941,
 MutationObserver:class{observe(){}disconnect(){}},ResizeObserver:class{observe(){}disconnect(){}},IntersectionObserver:class{observe(){}disconnect(){}},
 localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,String(v)),removeItem:k=>local.delete(k)},Audio:function(){return node('audio')},Image:function(){return node('image')},
 document:{body:node('body'),head:node('head'),documentElement:node('html'),activeElement:null,hidden:false,getElementById:node,querySelector:s=>node(s),querySelectorAll:()=>[],addEventListener:noop,createElement:t=>node('created-'+t),createDocumentFragment:()=>node('fragment')},addEventListener:noop,removeEventListener:noop,matchMedia:()=>({matches:false,addEventListener:noop,removeEventListener:noop}),getComputedStyle:()=>({display:'block',visibility:'visible',getPropertyValue:()=>''})};
context.window=context;vm.createContext(context);
const scripts=['clubs.js','names.js','assets/manager/manager-assets.js','world-expansion.js','data/player-sprites.js','data/club-stadiums.js','training.js','player-performance.js','training-ui.js','vendor/pako.min.js','save-codec.js','career-expansion.js','player-traits.js','player-profiles.js','negotiation-cinematic.js','chairmen.js','club-pulse.js','multiplayer-core.js','app.js'].filter(f=>fs.existsSync(path.join(root,f)));
for(const file of scripts){let source=fs.readFileSync(path.join(root,file),'utf8');if(file==='app.js'){
 const names=[...source.matchAll(/^  (?:async )?function (\w+)\(/gm)].map(m=>m[1]);
 source=source.replace('  window.VELMORA_MANAGER_DEBUG={',`window.auditQA={${[...new Set(names)].join(',')},state:()=>({worldSeed,fixtures,careerTime,careerRuntime,livingSquad,roadToGlory,currentClub,careerPreferences,employmentStatus,clubs,managerMarket,ownershipState,audienceWorldState,calendarEvents,squadCache,lineupCache,freeAgentCache,youthAcademies,transferActivity}),set:(key,value)=>{switch(key){case 'currentClub':currentClub=value;break;case 'fixtures':fixtures=value;v202MarkCompetitionDataDirty();break;case 'employmentStatus':employmentStatus=value;break;}}};\n  window.VELMORA_MANAGER_DEBUG={`);
 }vm.runInContext(source,context,{filename:file});}
return {context,q:context.auditQA,d:context.VELMORA_MANAGER_DEBUG,nodes,local,node};
}
module.exports={runtime};
