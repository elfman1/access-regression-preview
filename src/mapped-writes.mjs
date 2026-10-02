import assert from 'node:assert/strict';
import {validateMapping,Unsupported,AccessFailure} from './mapped-checks.mjs';
const q=x=>`"${x}"`;
const check=(ok,message)=>{if(!ok)throw new AccessFailure(message);};
export function validateWriteMapping(input) {
 const m=validateMapping(input);
 for(const key of ['tenantColumn','valueColumn','membershipRoleColumn'])
  if(typeof m[key]!=='string'||!/^[a-z_][a-z0-9_]*$/.test(m[key]))throw new Unsupported(`Unsupported identifier: ${key}`);
 for(const key of ['ownTenant','otherTenant','newOwnId','newOtherId'])
  if(typeof m[key]!=='string'||!m[key])throw new Unsupported(`Missing string: ${key}`);
 if(new Set([m.ownId,m.otherId,m.newOwnId,m.newOtherId]).size!==4)throw new Unsupported('Four distinct record identifiers required');
 if(m.ownTenant===m.otherTenant)throw new Unsupported('Two distinct tenant identifiers required');
 for(const key of ['writeValue','memberRole'])
  if(!['string','number','boolean'].includes(typeof m[key])||typeof m[key]==='number'&&!Number.isFinite(m[key]))throw new Unsupported(`Unsupported scalar: ${key}`);
 if(new Set([m.idColumn,m.tenantColumn,m.valueColumn]).size!==3)throw new Unsupported('Record columns must be distinct');
 return m;
}
export async function checkWrites(db,input,{scenario='crud'}={}) {
 const m=validateWriteMapping(input);
 if(!['crud','removed','demoted'].includes(scenario))throw new Unsupported('Unsupported write scenario');
 const table=q(m.table),id=q(m.idColumn),tenant=q(m.tenantColumn),value=q(m.valueColumn);
 async function asActor(user,fn) {
  await db.query('select set_config($1,$2,false)',[m.actorSetting,user]);
  await db.exec('set role app_user');
  try {
   const {rows:[r]}=await db.query(`select current_user as name,rolsuper,rolbypassrls from pg_roles where rolname=current_user`);
   assert.equal(r.name,'app_user');assert.equal(r.rolsuper,false);assert.equal(r.rolbypassrls,false);
   return await fn();
  }finally{await db.exec('reset role');}
 }
 const snapshot=async()=>JSON.stringify((await db.query(`select * from ${table} order by ${id}`)).rows);
 const visible=(user,key)=>asActor(user,async()=> (await db.query(`select ${id}::text as id from ${table} where ${id}::text=$1`,[key])).rows);
 const amount=async key=>(await db.query(`select ${value} as value from ${table} where ${id}::text=$1`,[key])).rows;
 const changed=async(sql,params)=>{
  const result=await asActor(m.actor,()=>db.query(sql,params));
  check(result.affectedRows===1,'Authorized write did not change exactly one row');
 };
 const forbidden=async(sql,params)=>{
  const before=await snapshot();let affected=0;
  await asActor(m.actor,async()=>{
   try{const r=await db.query(sql,params);affected=r.affectedRows??r.rows.length;}
   catch(e){if(e.code!=='42501')throw e;}
  });
  check(affected===0,'Forbidden write affected rows');
  check(before===await snapshot(),'Forbidden write changed stored records');
 };
 check((await visible(m.actor,m.ownId)).length===1,'Authorized actor fixture unavailable');
 check((await visible(m.otherActor,m.otherId)).length===1,'Other actor fixture unavailable');
 const update=`update ${table} set ${value}=$1 where ${id}::text=$2`;
 const insert=`insert into ${table}(${id},${tenant},${value}) values($1,$2,$3)`;
 const del=`delete from ${table} where ${id}::text=$1`;
 await changed(update,[m.writeValue,m.ownId]);
 check((await amount(m.ownId))[0]?.value===m.writeValue,'Authorized update did not persist expected value');
 await changed(insert,[m.newOwnId,m.ownTenant,m.writeValue]);
 check((await amount(m.newOwnId))[0]?.value===m.writeValue,'Authorized insert did not persist expected value');
 await changed(del,[m.newOwnId]);
 check((await amount(m.newOwnId)).length===0,'Authorized delete did not persist');
 if(scenario==='removed')await db.query(`delete from ${q(m.membershipTable)} where ${q(m.membershipUserColumn)}::text=$1`,[m.actor]);
 if(scenario==='demoted')await db.query(`update ${q(m.membershipTable)} set ${q(m.membershipRoleColumn)}=$1 where ${q(m.membershipUserColumn)}::text=$2`,[m.memberRole,m.actor]);
 if(scenario!=='crud') {
  const rows=await visible(m.actor,m.ownId);
  check(rows.length===(scenario==='removed'?0:1),'Membership transition has unexpected read access');
 }
 const targetId=scenario==='crud'?m.otherId:m.ownId;
 const targetTenant=scenario==='crud'?m.otherTenant:m.ownTenant;
 await forbidden(insert,[m.newOtherId,targetTenant,m.writeValue]);
 await forbidden(update,[m.writeValue,targetId]);
 await forbidden(del,[targetId]);
 return {status:'pass',scenario,coverage:['authorized CRUD','stored-state verification',...(scenario==='crud'?['forbidden cross-tenant CRUD']:[`forbidden ${scenario} member CRUD`])]};
}
