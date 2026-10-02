import { PGlite } from '@electric-sql/pglite';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// This program deliberately accepts no database URL. Every case uses a fresh,
// disposable, in-memory PostgreSQL instance and only synthetic records.
const membership = `exists(select 1 from memberships m where m.org_id = invoices.org_id and m.user_id = current_setting('app.user_id',true))`;
const owner = `exists(select 1 from memberships m where m.org_id = invoices.org_id and m.user_id = current_setting('app.user_id',true) and m.role = 'owner')`;
const setup = `
create role app_user nologin nosuperuser nobypassrls;
create role anonymous nologin nosuperuser nobypassrls;
create table memberships(org_id text, user_id text, role text, primary key(org_id,user_id));
create table invoices(id integer primary key, org_id text not null, amount integer not null);
insert into memberships values ('a','alice','owner'),('a','member','member'),('b','bob','owner');
insert into invoices values (1,'a',100),(2,'b',200);
grant usage on schema public to app_user,anonymous;
grant select,insert,update,delete on invoices to app_user,anonymous;
grant select on memberships to app_user;
alter table memberships enable row level security;
create policy own_membership on memberships for select to app_user using(user_id = current_setting('app.user_id',true));
alter table invoices enable row level security;
create policy invoice_read on invoices for select to app_user using (${membership});
create policy invoice_insert on invoices for insert to app_user with check (${owner});
create policy invoice_update on invoices for update to app_user using (${owner}) with check (${owner});
create policy invoice_delete on invoices for delete to app_user using (${owner});
`;
const mutations = [
 ['rls_disabled', `alter table invoices disable row level security`, 'read'],
 ['read_everyone', `alter policy invoice_read on invoices using(true)`, 'read'],
 ['insert_everywhere', `alter policy invoice_insert on invoices with check(true)`, 'insert'],
 ['update_everywhere', `alter policy invoice_read on invoices using(true); alter policy invoice_update on invoices using(true) with check(true)`, 'update'],
 ['delete_everywhere', `alter policy invoice_read on invoices using(true); alter policy invoice_delete on invoices using(true)`, 'delete'],
 ['tenant_transfer', `alter policy invoice_update on invoices with check(true)`, 'move'],
 ['stale_membership', `alter policy invoice_read on invoices using(org_id=current_setting('app.org_id',true))`, 'removed'],
 ['stale_owner_claim', `alter policy invoice_update on invoices using(org_id=current_setting('app.org_id',true) and current_setting('app.claim_role',true)='owner') with check(org_id=current_setting('app.org_id',true))`, 'demoted'],
 ['anonymous_read', `create policy public_read on invoices for select to anonymous using(true)`, 'anonymous'],
 ['member_can_update', `alter policy invoice_update on invoices using(${membership}) with check(${membership})`, 'demoted'],
 ['member_can_delete', `alter policy invoice_delete on invoices using(${membership})`, 'demoted'],
 ['permissive_policy_bypass', `create policy accidental_allow on invoices for select to app_user using(true)`, 'read'],
];
class ExpectationFailure extends Error {}
function expect(ok, message) { if (!ok) throw new ExpectationFailure(message); }
async function actor(db, user='alice', role='app_user', fn) {
  assert(['app_user','anonymous'].includes(role));
  await db.query(`select set_config('app.user_id',$1,false),set_config('app.org_id','a',false),set_config('app.claim_role','owner',false)`, [user]);
  await db.exec(`set role ${role}`);
  try {
    const {rows:[r]} = await db.query(`select current_user as name,rolsuper,rolbypassrls from pg_roles where rolname=current_user`);
    assert.equal(r.name,role); assert.equal(r.rolsuper,false); assert.equal(r.rolbypassrls,false);
    return await fn();
  } finally { await db.exec('reset role'); }
}
async function read(db,id,user='alice',role='app_user') {
 return actor(db,user,role,async()=> (await db.query('select * from invoices where id=$1',[id])).rows);
}
async function snapshot(db) { return (await db.query('select * from invoices order by id')).rows; }
async function deniedWrite(db,sql,params=[],user='alice') {
 const before = await snapshot(db);
 let affected = 0;
 await actor(db,user,'app_user',async()=>{
  try { const result=await db.query(sql,params); affected=result.affectedRows ?? result.rows.length; }
  catch(e) { if(e.code!=='42501') throw e; } // Only an explicit authorization error qualifies.
 });
 expect(affected===0,'Forbidden write returned changed rows');
 expect(JSON.stringify(before)===JSON.stringify(await snapshot(db)),'Forbidden write changed stored state');
}
async function positiveRead(db) {
 const own=await read(db,1); expect(own.length===1 && own[0].amount===100,'Authorized fixture missing');
 const other=await read(db,2,'bob'); expect(other.length===1 && other[0].amount===200,'Second tenant fixture missing');
}
async function positiveWrite(db,sql) {
 const rows=await actor(db,'alice','app_user',async()=> (await db.query(sql)).rows);
 expect(rows.length===1,'Authorized write did not affect expected row');
}
const checks={
 read:async db=>{await positiveRead(db); expect((await read(db,2)).length===0,'Other tenant invoice visible'); const rows=await actor(db,'alice','app_user',async()=>(await db.query('select * from invoices')).rows); expect(rows.length===1&&rows[0].id===1,'List leaks rows');},
 anonymous:async db=>{await positiveRead(db);expect((await read(db,1,'','anonymous')).length===0,'Anonymous invoice visible');},
 insert:async db=>{await positiveRead(db);await positiveWrite(db,"insert into invoices values(3,'a',300) returning *");await deniedWrite(db,"insert into invoices values(4,'b',400)");},
 update:async db=>{await positiveRead(db);await positiveWrite(db,'update invoices set amount=101 where id=1 returning *');await deniedWrite(db,'update invoices set amount=999 where id=2 returning *');},
 delete:async db=>{await positiveRead(db);await positiveWrite(db,'delete from invoices where id=1 returning *');await deniedWrite(db,'delete from invoices where id=2 returning *');},
 move:async db=>{await positiveRead(db);await db.exec("insert into memberships values('b','alice','member')");await positiveWrite(db,'update invoices set amount=101 where id=1 returning *');await deniedWrite(db,"update invoices set org_id='b' where id=1 returning *");},
 removed:async db=>{await positiveRead(db);await db.exec("delete from memberships where user_id='alice'");expect((await read(db,1)).length===0,'Removed member retains read access');await deniedWrite(db,'update invoices set amount=999 where id=1 returning *');},
 demoted:async db=>{await positiveRead(db);await positiveWrite(db,'update invoices set amount=101 where id=1 returning *');await db.exec("update memberships set role='member' where user_id='alice'");expect((await read(db,1)).length===1,'Demoted member lost legitimate read');await deniedWrite(db,'update invoices set amount=999 where id=1 returning *');await deniedWrite(db,'delete from invoices where id=1 returning *');},
};
async function run(name,scenario,mutation='',expected='pass') {
 const db = new PGlite(); const start=performance.now(); let status='pass',detail='Expected permissions observed';
 try { await db.exec(setup); if(mutation)await db.exec(mutation);await checks[scenario](db); }
 catch(e){ status=e instanceof ExpectationFailure?'fail':'error'; detail=e.message; }
 finally{await db.close();}
 return {name,scenario,expected,status,detail,durationMs:Math.round(performance.now()-start)};
}
const results=[];
for(const scenario of Object.keys(checks)) results.push(await run(`healthy_${scenario}`,scenario));
for(const [name,sql,scenario] of mutations) results.push(await run(name,scenario,sql,'fail'));
// Harness safety controls: never count missing fixtures or SQL errors as a pass.
results.push(await run('empty_fixture','read','delete from invoices','fail'));
results.push(await run('broken_setup','read','select nonexistent_function()','error'));
results.push(await run('missing_table','read','drop table invoices','error'));
const mismatches=results.filter(r=>r.status!==r.expected);
const report={generatedAt:new Date().toISOString(),engine:'PGlite 0.5.8',scope:'Synthetic PostgreSQL RLS only; no Supabase HTTP, JWT validation, Storage or Realtime coverage',results,summary:{healthyControls:8,deliberateBugs:12,harnessControls:3,mismatches:mismatches.length}};
await mkdir(new URL('../reports/',import.meta.url),{recursive:true});
await writeFile(new URL('../reports/benchmark.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
const rows=results.map(r=>`| ${r.name} | ${r.expected} | ${r.status} | ${r.detail} |`).join('\n');
await writeFile(new URL('../reports/benchmark.md',import.meta.url),`# Synthetic benchmark\n\n${report.generatedAt}\n\n${report.scope}\n\nThe benchmark passes when healthy cases pass, deliberately broken cases fail, and infrastructure mistakes produce errors. These results are not customer validation or competitor superiority.\n\n| Case | Expected | Observed | Detail |\n|---|---|---|---|\n${rows}\n\nUnexpected results: ${mismatches.length}\n`);
console.table(results.map(({name,expected,status})=>({name,expected,status})));
console.log(`${results.length} cases; ${mismatches.length} unexpected results. See reports/benchmark.md`);
process.exitCode=mismatches.length?1:0;
