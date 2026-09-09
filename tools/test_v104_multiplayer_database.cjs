'use strict';
// V104 · Online career · database rules
//
// Runs the full two-manager scenario suite against a real PostgreSQL
// database with the shipped migration applied, so Row Level Security,
// unique constraints and RPC atomicity are exercised as they will be in
// Supabase -- not as a JavaScript imitation of them.
//
//   npm run test:multiplayer-db
//
// Requires a reachable PostgreSQL and the `psql` client. Configure with
// PGHOST / PGPORT / PGUSER / PGDATABASE / PSQL_BIN, or let it skip.

const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const pg=require('./mp/mp_pg.cjs');
const scenarios=require('./mp/mp_scenarios.cjs');

const root=path.resolve(__dirname,'..');
const conn={
  host:process.env.PGHOST||'/tmp/pgrun',
  port:Number(process.env.PGPORT||5433),
  superuser:process.env.PGUSER||'postgres',
  database:process.env.PGDATABASE||'velmora_mp',
  psql:process.env.PSQL_BIN||'psql'
};

function skip(reason){
  console.log(JSON.stringify({status:'SKIPPED',reason,
    hint:'Set PGHOST/PGPORT/PGUSER/PGDATABASE (and PSQL_BIN) to run the database rules against a real PostgreSQL.'},null,2));
  process.exit(0);
}

async function reachable(){
  try{await pg.psql(conn,'select 1;');return true;}
  catch(_){return false;}
}

(async()=>{
  try{cp.execFileSync(conn.psql,['--version'],{stdio:'ignore'});}
  catch(_){return skip('psql is not installed on this machine');}
  if(!await reachable())return skip('no PostgreSQL server is reachable with the current settings');

  // Apply the harness (the Supabase pieces a bare Postgres lacks) and then
  // the migration exactly as shipped.
  await pg.psql(conn,fs.readFileSync(path.join(root,'tools','mp','supabase_local_harness.sql'),'utf8'));
  const migration=fs.readFileSync(path.join(root,'supabase-velmora-manager-multiplayer.sql'),'utf8');
  await pg.psql(conn,migration);
  // Re-running a migration must be safe; that is asserted, not assumed.
  await pg.psql(conn,migration);
  await pg.bootstrap(conn);

  const clients=new Map();
  const backend={
    async reset(){await pg.reset(conn);clients.clear();},
    async createUser(email,name){return pg.createUser(conn,email,name);},
    clientFor(userId){
      if(!clients.has(userId))clients.set(userId,pg.createClient(conn,userId));
      return clients.get(userId);
    },
    async rpc(userId,name,args){
      const result=await pg.createClient(conn,userId).rpc(name,args);
      if(result.error)throw result.error;
      return result.data;
    },
    async rawSelect(userId,table,filters={}){
      const where=Object.entries(filters)
        .map(([key,value])=>`${key} = ${pg.quote(value)}`).join(' and ');
      const result=await pg.request(conn,userId,
        `select * from public.${table}${where?` where ${where}`:''}`);
      if(result.error)return[];
      return result.data||[];
    }
  };

  const results=await scenarios.run(backend);
  const failed=results.filter(row=>row.status!=='PASS');
  console.log(JSON.stringify({
    status:failed.length?'FAIL':'PASS',
    backend:'postgresql',
    database:conn.database,
    migrationRerunnable:true,
    checks:results.map(row=>row.name),
    passed:results.length-failed.length,
    failed:failed.length
  },null,2));
  if(failed.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
