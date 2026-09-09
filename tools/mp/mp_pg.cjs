'use strict';
// A Supabase-shaped client backed by a real PostgreSQL database.
//
// Each call is one short transaction that assumes the `authenticated` role
// and sets the JWT subject, which is how PostgREST executes a request. Row
// Level Security therefore applies exactly as it will in production, and
// SECURITY DEFINER functions run as their owner exactly as they will there.
//
// Talks to psql over stdin so the suite needs no npm dependency.

const cp=require('node:child_process');

const HELPER=`
create or replace function public.velmora_test_exec(p_sql text)
returns jsonb language plpgsql security invoker as $fn$
declare v jsonb;
begin
  execute 'select coalesce(jsonb_agg(t), ''[]''::jsonb) from (' || p_sql || ') t' into v;
  return jsonb_build_object('ok', true, 'data', v);
exception when others then
  return jsonb_build_object('ok', false, 'message', sqlerrm, 'sqlstate', sqlstate);
end
$fn$;
grant execute on function public.velmora_test_exec(text) to authenticated, anon;
`;

function psql(conn,sql,{superuser=false}={}){
  return new Promise((resolve,reject)=>{
    const args=['-X','-q','-A','-t','-v','ON_ERROR_STOP=1',
      '-h',conn.host,'-p',String(conn.port),'-U',superuser?conn.superuser:conn.superuser,
      '-d',conn.database];
    const child=cp.spawn(conn.psql||'psql',args,{env:{...process.env,PGOPTIONS:'-c client_min_messages=warning'}});
    let out='',err='';
    child.stdout.on('data',chunk=>{out+=chunk;});
    child.stderr.on('data',chunk=>{err+=chunk;});
    child.on('error',reject);
    child.on('close',code=>{
      if(code!==0)return reject(new Error(err.trim()||`psql exited ${code}`));
      resolve(out);
    });
    child.stdin.end(sql);
  });
}

function quote(value){return `'${String(value).replace(/'/g,"''")}'`;}

async function bootstrap(conn){await psql(conn,HELPER);}

// One request: role + claim + a single statement whose errors become data.
async function request(conn,uid,statement){
  const role=uid?'authenticated':'anon';
  const claim=uid?`set local "request.jwt.claim.sub" = ${quote(uid)};`:'';
  const sql=[
    'begin;',
    `set local role ${role};`,
    `set local "request.jwt.claim.role" = ${quote(role)};`,
    claim,
    `select public.velmora_test_exec(${quote(statement)});`,
    'commit;'
  ].filter(Boolean).join('\n');
  const raw=(await psql(conn,sql)).trim();
  const line=raw.split('\n').filter(Boolean).pop()||'{}';
  let parsed;
  try{parsed=JSON.parse(line);}catch(_){throw new Error(`Unreadable psql output: ${raw.slice(0,400)}`);}
  if(parsed.ok===false){
    const error=new Error(parsed.message||'database error');
    error.code=parsed.sqlstate;
    return{data:null,error};
  }
  return{data:parsed.data,error:null};
}

function jsonArg(value){
  if(value===undefined||value===null)return'null';
  if(typeof value==='number')return String(value);
  if(typeof value==='boolean')return value?'true':'false';
  if(typeof value==='object')return `${quote(JSON.stringify(value))}::jsonb`;
  return quote(value);
}

// Postgres needs the declared parameter types for the arguments we pass.
const ARG_CASTS={
  p_career_id:'::uuid',p_user_id:'::uuid',p_career_date:'::date',p_next_date:'::date',
  p_since_seq:'::bigint',p_revision:'::bigint',p_expect_revision:'::bigint',
  p_save_schema:'::integer',p_home_score:'::integer',p_away_score:'::integer',
  p_grace_minutes:'::integer',p_max_uses:'::integer',p_ready:'::boolean',p_delete:'::boolean',
  p_payload:'',p_required:'',p_lineup:'',p_tactics:'',p_result:'',p_manager_profile:'',p_custom_club:''
};
function castFor(name,value){
  if(value===undefined||value===null)return ARG_CASTS[name]!==undefined?ARG_CASTS[name]:'::text';
  if(typeof value==='object')return'';
  return ARG_CASTS[name]||'';
}

function createClient(conn,uid){
  const self={
    uid,
    async rpc(name,args={}){
      const parts=Object.entries(args).map(([key,value])=>`${key} => ${jsonArg(value)}${castFor(key,value)}`);
      const call=`select public.${name}(${parts.join(', ')}) as value`;
      const result=await request(conn,uid,call);
      if(result.error)return result;
      const rows=result.data||[];
      return{data:rows.length?rows[0].value:null,error:null};
    },
    from(table){
      const filters=[];
      const builder={
        select(){return builder;},
        eq(key,value){filters.push(`${key} = ${quote(value)}`);return builder;},
        gt(key,value){filters.push(`${key} > ${quote(value)}`);return builder;},
        order(){return builder;},
        limit(n){builder._limit=n;return builder;},
        insert(values){builder._insert=values;return builder;},
        update(values){builder._update=values;return builder;},
        _run(){
          if(builder._insert){
            const rows=Array.isArray(builder._insert)?builder._insert:[builder._insert];
            const cols=Object.keys(rows[0]);
            const tuples=rows.map(row=>`(${cols.map(c=>jsonArg(row[c])).join(',')})`).join(',');
            return request(conn,uid,
              `insert into public.${table} (${cols.join(',')}) values ${tuples} returning *`);
          }
          if(builder._update){
            const sets=Object.entries(builder._update).map(([k,v])=>`${k} = ${jsonArg(v)}`).join(', ');
            return request(conn,uid,
              `update public.${table} set ${sets}${filters.length?` where ${filters.join(' and ')}`:''} returning *`);
          }
          const where=filters.length?` where ${filters.join(' and ')}`:'';
          const limit=builder._limit?` limit ${Number(builder._limit)}`:'';
          return request(conn,uid,`select * from public.${table}${where}${limit}`);
        },
        then(resolve,reject){return builder._run().then(resolve,reject);}
      };
      return builder;
    },
    // Realtime is not exercised against a bare Postgres instance; the client
    // falls back to its polling path, which is what these tests drive.
    channel(){return{on(){return this;},subscribe(){return Promise.resolve('SUBSCRIBED');}};},
    removeChannel(){return Promise.resolve();}
  };
  return self;
}

async function createUser(conn,email,username){
  const result=await psql(conn,
    `insert into auth.users (email, raw_user_meta_data) values (${quote(email)}, ${quote(JSON.stringify({username}))}) returning id;`);
  return result.trim().split('\n').filter(Boolean).pop();
}

async function reset(conn){
  await psql(conn,`
    truncate table public.velmora_multiplayer_careers cascade;
    delete from auth.users;
  `);
}

module.exports={psql,bootstrap,request,createClient,createUser,reset,quote};
