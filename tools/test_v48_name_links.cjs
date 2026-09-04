// Real name-link module against a small DOM adapter. No browser dependencies.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const events={},ids=new Map();let activeElement=null;
class Node{
 constructor(tag,text=''){this.tagName=tag.toUpperCase();this.nodeType=tag==='#text'?3:tag==='#fragment'?11:1;this.nodeValue=text;this.children=[];this.attrs={};this.dataset={};this.isConnected=true;this.inert=false;this.style={};this.className='';this.classList={add:()=>{},remove:()=>{}};}
 get childNodes(){return this.children;}
 get parentElement(){return this.parentNode?.nodeType===1?this.parentNode:null;}
 get textContent(){return this.nodeType===3?this.nodeValue:this.children.map(n=>n.textContent).join('')||this._text||'';}
 set textContent(v){this._text=String(v);this.children=[];}
 set innerHTML(v){this._html=v;this.children=[];}get innerHTML(){return this._html||'';}
 set id(v){this.attrs.id=v;ids.set(v,this);}get id(){return this.attrs.id;}
 appendChild(n){if(n.nodeType===11){for(const c of [...n.children])this.appendChild(c);return n;}this.children.push(n);n.parentNode=this;return n;}
 replaceWith(n){const parent=this.parentNode,i=parent.children.indexOf(this),nodes=n.nodeType===11?n.children:[n];parent.children.splice(i,1,...nodes);nodes.forEach(x=>x.parentNode=parent);this.isConnected=false;}
 setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}hasAttribute(k){return k in this.attrs;}
 addEventListener(k,fn){(this.events??={})[k]=fn;}
 focus(){activeElement=this;}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.isConnected=false;}
 contains(n){return n===this||this.children.some(c=>c.contains(n));}
 matches(selector){return selector.split(',').some(part=>{const s=part.trim();if(s[0]==='.')return this.className.split(' ').includes(s.slice(1));if(s[0]==='#')return this.id===s.slice(1);if(s[0]==='['){const m=s.match(/^\[([^=\]]+)(?:="([^"\]]*)")?\]$/);return m&&this.hasAttribute(m[1])&&(m[2]===undefined||this.getAttribute(m[1])===m[2]);}return this.tagName===s.toUpperCase();});}
 closest(s){return this.matches(s)?this:this.parentElement?.closest(s)||null;}
 querySelectorAll(s){return this.children.flatMap(c=>[...(c.matches(s)?[c]:[]),...c.querySelectorAll(s)]);}
 querySelector(s){const found=this.querySelectorAll(s)[0];if(found)return found;if(this.id==='v48PlayerProfile'&&s==='.v48-profile-main'){const main=new Node('main');main.className='v48-profile-main';return this.appendChild(main);}return null;}
}
const body=new Node('body');const document={body,get activeElement(){return activeElement;},createElement:t=>new Node(t),createTextNode:t=>new Node('#text',t),createDocumentFragment:()=>new Node('#fragment'),addEventListener:(type,fn)=>(events[type]??=[]).push(fn),createTreeWalker(root){const texts=[];function walk(n){if(n.nodeType===3)texts.push(n);else n.children.forEach(walk);}walk(root);let i=-1;return {nextNode(){return ++i<texts.length;},get currentNode(){return texts[i];}};}};
const window={VelmoraTraits:require('../player-traits.js')};vm.runInNewContext(fs.readFileSync(require.resolve('../player-profiles.js'),'utf8'),{window,document,MutationObserver:class{observe(){}disconnect(){}},setTimeout:()=>1,clearTimeout(){},console});
const ui=window.VelmoraPlayerProfiles;const players=[{id:'p1',name:'Tobin Cinderwick',club:'Ashwick'},{id:'p2',name:'Enzo Kestven',club:'Riva Sola'},{id:'p3',name:'Tobin Cinderwick',club:'Other club'},{id:'p4',name:'Ari (Jet)',club:'Vale'}];let canOpen=true,pause=0,resume=0,saved=0;
const data=id=>{const p=players.find(x=>x.id===id);return p?{...p,role:'Playmaker',age:25,country:'Belros',badge:'',sprite:'sprite.png',own:true,known:true,managed:false,ovr:'70',stage:'CLUB DATA',fitness:98,availability:'Available',squadRole:'Rotation',attributes:[],traits:['quick_link'],stats:{apps:4,goals:2,assists:1,rating:'7.0'},details:{},plan:'Balanced',growth:0,value:'£1m',wage:'£1k',contract:'2 years'}:null;};
ui.install({players:()=>players,data,action(){},navigate(){},canOpen:()=>canOpen,source:()=> 'Inbox',save:()=>saved++,pause:()=>++pause,resume:()=>resume++});
function el(tag,text,parent=body){const n=new Node(tag);if(text)n.appendChild(new Node('#text',text));parent.appendChild(n);return n;}
const email=el('article');email.id='email';const paragraph=el('p','Enzo Kestven has impressed. Enzo Kestven again, with Ari (Jet).',email);
const transfer=el('section');transfer.id='transferDossier';const heading=el('h3','ENZO KESTVEN',transfer);
const ownCard=el('button');ownCard.dataset.playerId='p1';ownCard.setAttribute('data-player-id','p1');el('strong','Tobin Cinderwick',ownCard);
const ambiguous=el('p','Tobin Cinderwick is in the news.');const partial=el('p','Enzo Kestvenford should not match.');
const hidden=el('p','Enzo Kestven');hidden.setAttribute('aria-hidden','true');const script=el('script','Enzo Kestven');
ui.enhance();const links=body.querySelectorAll('.v48-name');assert.equal(links.length,6);assert.equal(paragraph.querySelectorAll('.v48-name').length,3);assert.equal(heading.querySelectorAll('.v48-name').length,1);assert.equal(partial.querySelectorAll('.v48-name').length,0);assert.equal(hidden.querySelectorAll('.v48-name').length,0);assert.equal(script.querySelectorAll('.v48-name').length,0);
assert.deepEqual(JSON.parse(ownCard.querySelector('.v48-name').dataset.v48Candidates),['p1']);assert.equal(JSON.parse(ambiguous.querySelector('.v48-name').dataset.v48Candidates).length,2);
ui.enhance();assert.equal(body.querySelectorAll('.v48-name').length,6,'No nested/duplicated links on repeat render');
function dispatch(type,target,key){const event={target,key,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};for(const fn of events[type]||[])fn(event);return event;}
const source=paragraph.querySelector('.v48-name');source.focus();let ev=dispatch('click',source);assert(ev.prevented&&ev.stopped);assert(ids.get('v48PlayerProfile').innerHTML.includes('Enzo'));assert(email.inert);ui.close();assert(!email.inert);assert.equal(document.activeElement,source);assert.equal(pause,resume);
ev=dispatch('keydown',source,'Enter');assert(ev.stopped);dispatch('keydown',source,'Escape');assert.equal(pause,resume);
canOpen=false;ev=dispatch('click',ownCard.querySelector('.v48-name'));assert(!ev.prevented&&!ev.stopped,'Squad swap mode keeps its existing click handler');canOpen=true;
dispatch('click',ambiguous.querySelector('.v48-name'));assert(ids.get('v48PlayerProfile').querySelector('.v48-profile-main').innerHTML.includes('Other club'));ui.close();
assert(saved>=3);console.log('PASS: email names, transfer heading, uppercase, punctuation, duplicate-name club resolution/chooser, word boundaries, hidden/script exclusion, repeat hydration, click/keyboard interception, source focus/inert restoration and squad swap protection.');
