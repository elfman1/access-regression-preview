import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {checkReadIsolation,AccessFailure} from './mapped-checks.mjs';
import {checkWrites} from './mapped-writes.mjs';
const args=process.argv.slice(2);
if(args.some(x=>!['invoices','tickets','--broken'].includes(x))||args.filter(x=>['invoices','tickets'].includes(x)).length>1){
 console.error('Usage: npm run demo -- [invoices|tickets] [--broken]');process.exit(2);
}
const fixture=args.find(x=>['invoices','tickets'].includes(x))??'invoices';
const broken=args.includes('--broken');
const m=JSON.parse(await readFile(new URL(`../fixtures/${fixture}.json`,import.meta.url),'utf8'));
const sql=await readFile(new URL(`../fixtures/${fixture}.sql`,import.meta.url),'utf8');
const db=new PGlite();
try{
 await db.exec(sql);
 if(broken)await db.exec(`alter policy owner_insert on "${m.table}" with check(true)`);
 await checkReadIsolation(db,m);
 console.log('PASS: legitimate records visible, other-company records hidden');
 await checkWrites(db,m);
 console.log('PASS: legitimate writes persisted, other-company writes blocked');
 console.log('Scope: this synthetic database fixture only. No external database was accessed.');
}catch(e){
 console.error(`${e instanceof AccessFailure?'FAIL':'ERROR'}: ${e.message}`);
 if(broken&&e instanceof AccessFailure)console.error('This demo deliberately permits another-company insert. The test caught it.');
 process.exitCode=1;
}finally{await db.close();}
