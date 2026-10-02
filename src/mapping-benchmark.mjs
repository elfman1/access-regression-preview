import {PGlite} from '@electric-sql/pglite';
import {readFile,writeFile} from 'node:fs/promises';
import {checkReadIsolation,validateMapping,Unsupported,AccessFailure} from './mapped-checks.mjs';
const results=[];
for(const fixture of ['invoices','tickets']) {
 const mapping=JSON.parse(await readFile(new URL(`../fixtures/${fixture}.json`,import.meta.url),'utf8'));
 const setup=await readFile(new URL(`../fixtures/${fixture}.sql`,import.meta.url),'utf8');
 for(const variant of ['healthy','removed','leak','missing_fixture']) {
  const db=new PGlite();let status='pass',detail='Expected permissions observed';
  try {
   await db.exec(setup);
   if(variant==='leak')await db.exec(`alter policy member_read on "${mapping.table}" using(true)`);
   if(variant==='missing_fixture')await db.exec(`delete from "${mapping.table}"`);
   await checkReadIsolation(db,mapping,{removeMember:variant==='removed'});
  }catch(e){status=e instanceof Unsupported?'unsupported':e instanceof AccessFailure?'fail':'error';detail=e.message;}
  finally{await db.close();}
  results.push({fixture,variant,status,expected:['healthy','removed'].includes(variant)?'pass':'fail',detail});
 }
 for(const [variant,patch] of [['missing_table_name',{table:''}],['unsafe_identifier',{table:'tickets; drop table tickets'}],['same_actor',{otherActor:mapping.actor}]]) {
  let status='pass';try{validateMapping({...mapping,...patch});}catch(e){status=e instanceof Unsupported?'unsupported':'error';}
  results.push({fixture,variant,status,expected:'unsupported'});
 }
}
const mismatches=results.filter(r=>r.status!==r.expected);
await writeFile(new URL('../reports/mapping.json',import.meta.url),JSON.stringify({scope:'Two synthetic schemas; read/list/removal checks only, no general customer mapping support',results,mismatches:mismatches.length},null,2)+'\n');
console.table(results);process.exitCode=mismatches.length?1:0;
