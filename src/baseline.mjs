import {stripTypeScriptTypes} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import assert from 'node:assert/strict';
// Original upstream sources retained with MIT license. Only import resolution is
// adapted; Node strips TypeScript. pg's query result shape is adapted below.
const vendor=new URL('../vendor/supashield/',import.meta.url);
for(const name of ['constants','simulate']) {
 const source=await readFile(new URL(`${name}.ts`,vendor),'utf8');
 await writeFile(new URL(`${name}.mjs`,vendor),stripTypeScriptTypes(source).replace('../shared/constants.js','./constants.mjs'));
}
const {executeRlsPolicyProbeDetailed}=await import('../vendor/supashield/simulate.mjs');
const results=[];
for(const mode of ['healthy','cross_tenant_read','no_access']) {
 const db=new PGlite();
 try {
 await db.exec(`
 create role authenticated nologin nosuperuser nobypassrls;
 create role anon nologin nosuperuser nobypassrls;
 create table invoices(id serial primary key,org_id text not null,amount integer not null);
 insert into invoices values(1,'a',100),(2,'b',200);
 alter sequence invoices_id_seq restart with 100;
 grant select,insert,update,delete on invoices to authenticated;
 grant usage on sequence invoices_id_seq to authenticated;
 alter table invoices enable row level security;
 create policy invoice_read on invoices for select to authenticated using(${mode==='healthy'?"org_id=(current_setting('request.jwt.claims',true)::jsonb->>'org_id')":mode==='cross_tenant_read'?'true':'false'});
 `);
 const client={query:async(sql,params)=>{const r=await db.query(sql,params);return {...r,rowCount:r.affectedRows??r.rows.length};},release(){}};
 const pool={connect:async()=>client};
 const probe=await executeRlsPolicyProbeDetailed(pool,'public','invoices','SELECT',{sub:'alice',org_id:'a',role:'authenticated'});
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:'alice',org_id:'a',role:'authenticated'})]);
 await db.exec('set role authenticated');
 const visible=(await db.query('select id from invoices order by id')).rows.map(r=>r.id);
 await db.exec('reset role');
 const exact=visible.length===1&&visible[0]===1?'pass':'fail';
 results.push({case:mode,baseline:probe,expectedBaseline:mode==='no_access'?'DENY':'ALLOW',exactRowCheck:exact,visibleIds:visible});
 assert.equal(probe.result,mode==='no_access'?'DENY':'ALLOW');
 assert.equal(exact,mode==='healthy'?'pass':'fail');
 }finally{await db.close();}
}
const report={upstream:'https://github.com/Rodrigotari1/supashield',commit:'ab01656ba6e6664f6aca2879b3eec8270601b48d',scope:'Three SELECT probes through upstream core function with PGlite query adapter; not full CLI or comprehensive competitor benchmark',results};
await mkdir(new URL('../reports/',import.meta.url),{recursive:true});
await writeFile(new URL('../reports/baseline.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
