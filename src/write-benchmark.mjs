import {PGlite} from '@electric-sql/pglite';
import {readFile,writeFile} from 'node:fs/promises';
import {checkWrites,validateWriteMapping} from './mapped-writes.mjs';
import {Unsupported,AccessFailure} from './mapped-checks.mjs';
const results=[];
for(const fixture of ['invoices','tickets']) {
 const m=JSON.parse(await readFile(new URL(`../fixtures/${fixture}.json`,import.meta.url),'utf8'));
 const setup=await readFile(new URL(`../fixtures/${fixture}.sql`,import.meta.url),'utf8');
 const cases=[
  ['healthy_crud','crud','','pass'],['healthy_removal','removed','','pass'],['healthy_demotion','demoted','','pass'],
  ['cross_insert','crud',`alter policy owner_insert on "${m.table}" with check(true)`,'fail'],
  ['cross_update','crud',`alter policy member_read on "${m.table}" using(true);alter policy owner_update on "${m.table}" using(true) with check(true)`,'fail'],
  ['cross_delete','crud',`alter policy member_read on "${m.table}" using(true);alter policy owner_delete on "${m.table}" using(true)`,'fail'],
  ['demoted_insert','demoted',`alter policy owner_insert on "${m.table}" with check(true)`,'fail'],
  ['demoted_update','demoted',`alter policy owner_update on "${m.table}" using(true) with check(true)`,'fail'],
  ['demoted_delete','demoted',`alter policy owner_delete on "${m.table}" using(true)`,'fail'],
  ['removed_insert','removed',`alter policy owner_insert on "${m.table}" with check(true)`,'fail'],
  ['missing_fixture','crud',`delete from "${m.table}"`,'fail'],
  ['constraint_error','crud',`alter table "${m.table}" add constraint block_change check(${fixture==='invoices'?'amount <> 321':"subject <> 'Synthetic changed'"})`,'error'],
 ];
 for(const [name,scenario,mutation,expected]of cases){
  const db=new PGlite();let status='pass',detail='Expected permissions and stored effects observed';
  try{await db.exec(setup);if(mutation)await db.exec(mutation);await checkWrites(db,m,{scenario});}
  catch(e){status=e instanceof Unsupported?'unsupported':e instanceof AccessFailure?'fail':'error';detail=e.message;}
  finally{await db.close();}
  results.push({fixture,name,scenario,expected,status,detail});
 }
 for(const [name,patch]of [['duplicate_ids',{newOwnId:m.ownId}],['unsafe_write_column',{valueColumn:'x;drop table y'}],['missing_write_value',{writeValue:null}]]){
  let status='pass';try{validateWriteMapping({...m,...patch});}catch(e){status=e instanceof Unsupported?'unsupported':'error';}
  results.push({fixture,name,expected:'unsupported',status});
 }
}
const report={generatedAt:new Date().toISOString(),scope:'Synthetic database CRUD, immediate removal, and demotion in two fixtures; not HTTP or arbitrary schemas',results,mismatches:results.filter(x=>x.expected!==x.status).length};
await writeFile(new URL('../reports/writes.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.table(results.map(({fixture,name,expected,status})=>({fixture,name,expected,status})));
console.log(`${results.length} cases; ${report.mismatches} unexpected results`);process.exitCode=report.mismatches?1:0;
