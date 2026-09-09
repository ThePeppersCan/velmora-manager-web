'use strict';
const assert=require('node:assert/strict');
const cloudApi=require('../cloud-saves.js');
const PREFIX=cloudApi.PREFIX,USER={id:'00000000-0000-4000-8000-000000000001',email:'playtester@example.com',user_metadata:{username:'Playtester'}};
const codec={decode:value=>value};
function raw(label,time){return JSON.stringify({version:100,worldSeed:label,fixtures:[],squads:{A:[]},careerRuntime:{lastSavedAt:time},managerName:label});}
function memoryStore(initial={}){
  const values=new Map(Object.entries(initial)),listeners=new Set();
  return{ready:Promise.resolve(),getItem:key=>values.get(key)||null,exportSlot:slot=>values.get(PREFIX+slot)||null,status:()=>({pending:0,error:null}),subscribeCommits(fn){listeners.add(fn);return()=>listeners.delete(fn);},async flush(){},async importSlot(slot,value){values.set(PREFIX+slot,value);},set(slot,value){values.set(PREFIX+slot,value);listeners.forEach(fn=>fn({key:PREFIX+slot,value,deleted:false}));},remove(slot){values.delete(PREFIX+slot);listeners.forEach(fn=>fn({key:PREFIX+slot,value:null,deleted:true}));}};
}
function mockClient(seedRows=[],seedObjects={}){
  const rows=new Map(seedRows.map(row=>[Number(row.slot),{...row}])),objects=new Map(Object.entries(seedObjects));
  function resultFor(op,payload,filters,single=false){
    let data=[...rows.values()].filter(row=>Object.entries(filters).every(([key,value])=>row[key]===value));
    if(op==='upsert'){const row={...payload};rows.set(Number(row.slot),row);data=row;}
    if(op==='delete'){data.forEach(row=>rows.delete(Number(row.slot)));data=null;}
    if(single&&Array.isArray(data))data=data[0]||null;
    return{data,error:null};
  }
  function query(op,payload){
    const filters={};let single=false;
    const builder={select(){return builder;},eq(key,value){filters[key]=value;return builder;},order(){return Promise.resolve(resultFor(op,payload,filters,single));},maybeSingle(){single=true;return Promise.resolve(resultFor(op,payload,filters,true));},single(){single=true;return Promise.resolve(resultFor(op,payload,filters,true));},then(resolve,reject){return Promise.resolve(resultFor(op,payload,filters,single)).then(resolve,reject);}};
    return builder;
  }
  return{rows,objects,from(){return{select(){return query('select');},upsert(value){return query('upsert',value);},delete(){return query('delete');}};},storage:{from(){return{async download(path){return objects.has(path)?{data:new Blob([objects.get(path)]),error:null}:{data:null,error:{message:'Object not found',statusCode:'404'}};},async upload(path,blob){objects.set(path,await blob.text());return{data:{path},error:null};},async copy(from,to){if(!objects.has(from))return{data:null,error:{message:'Object not found',statusCode:'404'}};objects.set(to,objects.get(from));return{data:{path:to},error:null};},async remove(paths){paths.forEach(path=>objects.delete(path));return{data:paths,error:null};}};}}};
}
function row(slot,value,path=`${USER.id}/slot-${slot}.velmora`){return{user_id:USER.id,slot,object_path:path,previous_object_path:null,has_previous:false,save_schema:100,save_bytes:value.length,checksum:'remote-checksum',save_timestamp:JSON.parse(value).careerRuntime.lastSavedAt,revision:1,metadata:{},updated_at:JSON.parse(value).careerRuntime.lastSavedAt};}
(async()=>{
  const old=raw('Local old','2026-09-07T10:00:00.000Z'),newer=raw('Cloud new','2026-09-07T11:00:00.000Z');
  const path=`${USER.id}/slot-1.velmora`,downloadStore=memoryStore({[PREFIX+1]:old}),downloadClient=mockClient([row(1,newer,path)],{[path]:newer});
  const downloadCloud=cloudApi.create({store:downloadStore,codec,client:downloadClient,session:{user:USER},debounceMs:0,now:()=>Date.parse('2026-09-07T12:00:00.000Z')});
  await downloadCloud.ready;assert.equal(downloadStore.getItem(PREFIX+1),newer,'newer cloud career wins initial merge');assert.equal(downloadCloud.status().mode,'synced');

  const remoteOld=raw('Cloud old','2026-09-07T09:00:00.000Z'),localNew=raw('Local new','2026-09-07T12:00:00.000Z');
  const uploadStore=memoryStore({[PREFIX+1]:localNew}),uploadClient=mockClient([row(1,remoteOld,path)],{[path]:remoteOld});
  const uploadCloud=cloudApi.create({store:uploadStore,codec,client:uploadClient,session:{user:USER},debounceMs:0,now:()=>Date.parse('2026-09-07T12:01:00.000Z')});
  await uploadCloud.ready;assert.equal(uploadClient.objects.get(path),localNew,'newer local career uploads');assert.equal(uploadClient.objects.get(`${USER.id}/slot-1.previous.velmora`),remoteOld,'upload retains a previous cloud revision');assert.equal(uploadCloud.hasCloudBackup(1),true);

  const later=raw('Autosave','2026-09-07T13:00:00.000Z');uploadStore.set(1,later);await uploadCloud.flush();assert.equal(uploadClient.objects.get(path),later,'committed local autosave is mirrored');assert.equal(uploadClient.objects.get(`${USER.id}/slot-1.previous.velmora`),localNew,'each upload rolls the immediately preceding revision into recovery storage');
  uploadStore.remove(1);await uploadCloud.flush();assert.equal(uploadClient.rows.has(1),false,'deleting a local slot deletes its private cloud record');assert.equal(uploadClient.objects.has(path),false);

  const staleLocal=raw('Stale device','2026-09-07T14:00:00.000Z'),newestCloud=raw('Other device','2026-09-07T15:00:00.000Z');
  const conflictStore=memoryStore({[PREFIX+1]:staleLocal}),conflictClient=mockClient([row(1,staleLocal,path)],{[path]:staleLocal});
  const conflictCloud=cloudApi.create({store:conflictStore,codec,client:conflictClient,session:{user:USER},debounceMs:0,now:()=>Date.parse('2026-09-07T15:01:00.000Z')});await conflictCloud.ready;
  conflictClient.rows.set(1,row(1,newestCloud,path));conflictClient.objects.set(path,newestCloud);conflictStore.set(1,staleLocal);await conflictCloud.flush();assert.equal(conflictStore.getItem(PREFIX+1),newestCloud,'stale devices cannot overwrite a newer cloud career');
  console.log(JSON.stringify({status:'PASS',checks:['newest-save conflict resolution','local-to-cloud upload','previous cloud revision','autosave mirroring','slot deletion','stale-device protection']},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
