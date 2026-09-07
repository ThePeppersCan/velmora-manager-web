(function(root){
  'use strict';

  const base='assets/career/personnel-v2/';
  const profiles=Object.freeze({
    scout:Object.freeze({key:'scout',title:'Chief Scout',shortTitle:'Scouting',asset:base+'chief-scout-raven.png',accent:'#7454b8'}),
    coach:Object.freeze({key:'coach',title:'Assistant Coach',shortTitle:'First Team',asset:base+'assistant-coach-badger.png',accent:'#2f7650'}),
    medical:Object.freeze({key:'medical',title:'Head of Medical',shortTitle:'Medical',asset:base+'medical-lead-frog.png',accent:'#15928b'}),
    academy:Object.freeze({key:'academy',title:'Academy Director',shortTitle:'Academy',asset:base+'academy-director-fox.png',accent:'#d06f36'}),
    commercial:Object.freeze({key:'commercial',title:'Commercial Director',shortTitle:'Club Operations',asset:base+'commercial-director-lynx.png',accent:'#ba9141'})
  });

  const aliases=Object.freeze({assistant:'coach',recruitment:'scout',youth:'academy'});
  const normalizeRole=role=>profiles[role]?role:(aliases[role]||null);
  const profile=role=>profiles[normalizeRole(role)]||null;
  const asset=role=>profile(role)?.asset||'';

  function hash(value){
    let out=2166136261;
    for(const char of String(value||'')){out^=char.charCodeAt(0);out=Math.imul(out,16777619);}
    return out>>>0;
  }

  function fallbackAsset(personOrKey,role='staff'){
    const key=typeof personOrKey==='object'?(personOrKey?.key||personOrKey?.id||personOrKey?.name):personOrKey;
    const index=1+(hash(`${role}:${key||'staff'}`)%40);
    return `assets/career/staff/staff_${String(index).padStart(2,'0')}.png`;
  }

  function roleForMessage(message={}){
    const sender=String(message.originalSender||message.sender||message.signoff||'').toLowerCase();
    const type=String(message.type||'').toUpperCase();
    if(/academy director|academy staff|youth development|youth coach/.test(sender))return'academy';
    if(/head of medical|medical team|medical lead|club doctor|physio/.test(sender))return'medical';
    if(/assistant coach|assistant manager|coaching team|performance team|first.team coach/.test(sender))return'coach';
    if(/chief scout|head of recruitment|scouting team|recruitment team|\bscout\b/.test(sender))return'scout';
    if(/commercial|club operations/.test(sender))return'commercial';
    if(type==='MEDICAL')return'medical';
    if(type==='YOUTH')return'academy';
    if(type==='TRAINING')return'coach';
    if(type==='SCOUTING')return'scout';
    return null;
  }

  function portrait(person,role,{signature=false}={}){
    if(person?.portrait)return person.portrait;
    if(person?.avatar)return person.avatar;
    if(signature&&asset(role))return asset(role);
    if(person?.image)return person.image;
    return fallbackAsset(person,role);
  }

  const api=Object.freeze({base,profiles,normalizeRole,profile,asset,fallbackAsset,roleForMessage,portrait});
  root.VelmoraPersonnelIdentity=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
