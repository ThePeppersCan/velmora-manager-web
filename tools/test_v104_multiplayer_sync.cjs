'use strict';
// V104 · Online career · synchronisation
//
// The full two-manager scenario suite, run in-process so it is part of the
// ordinary release suite on any machine. The identical scenarios also run
// against a real PostgreSQL database with the shipped Row Level Security in
// test_v104_multiplayer_database.cjs, so the two implementations are held to
// exactly the same expectations.

const {createServer}=require('./mp/mp_server_memory.cjs');
const scenarios=require('./mp/mp_scenarios.cjs');

(async()=>{
  const server=createServer();
  const backend={
    async reset(){server.reset();},
    async createUser(email,name){return server.createUser(email,name);},
    clientFor(userId){return server.createClient(userId);},
    async rpc(userId,name,args){
      const result=await server.createClient(userId).rpc(name,args);
      if(result.error)throw result.error;
      return result.data;
    },
    async rawSelect(userId,table,filters={}){
      let query=server.createClient(userId).from(table).select('*');
      Object.entries(filters).forEach(([key,value])=>{query=query.eq(key,value);});
      const result=await query;
      return result.data||[];
    }
  };

  const results=await scenarios.run(backend);
  const failed=results.filter(row=>row.status!=='PASS');
  console.log(JSON.stringify({
    status:failed.length?'FAIL':'PASS',
    backend:'in-process',
    checks:results.map(row=>row.name),
    passed:results.length-failed.length,
    failed:failed.length
  },null,2));
  if(failed.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
