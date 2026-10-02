import assert from 'node:assert/strict';

export class Unsupported extends Error {}
export class AccessFailure extends Error {}
const identifier = /^[a-z_][a-z0-9_]*$/;
const required = ['table','idColumn','membershipTable','membershipUserColumn','actorSetting','actor','otherActor','ownId','otherId'];
export function validateMapping(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) throw new Unsupported('Mapping must be an object');
  for (const key of required) if(typeof m[key]!=='string'||!m[key]) throw new Unsupported(`Missing string: ${key}`);
  for (const key of ['table','idColumn','membershipTable','membershipUserColumn']) {
    if(!identifier.test(m[key])) throw new Unsupported(`Unsupported identifier: ${key}`);
  }
  if(!/^app\.[a-z_]+$/.test(m.actorSetting)) throw new Unsupported('Unsupported actor setting');
  if(m.actor===m.otherActor||m.ownId===m.otherId) throw new Unsupported('Two distinct actors and records are required');
  return m;
}
function check(condition,message) {if(!condition)throw new AccessFailure(message);}
const quote = name => `"${name}"`;
export async function checkReadIsolation(db,input,{removeMember=false}={}) {
 const m=validateMapping(input);
 const table=quote(m.table), id=quote(m.idColumn);
 async function asActor(user,fn) {
  await db.query('select set_config($1,$2,false)',[m.actorSetting,user]);
  await db.exec('set role app_user');
  try {
   const {rows:[role]}=await db.query(`select rolsuper,rolbypassrls from pg_roles where rolname=current_user`);
   assert.equal(role.rolsuper,false);assert.equal(role.rolbypassrls,false);
   return await fn();
  }finally{await db.exec('reset role');}
 }
 const get=(user,value)=>asActor(user,async()=> (await db.query(`select ${id}::text as id from ${table} where ${id}::text=$1`,[value])).rows);
 check((await get(m.actor,m.ownId)).length===1,'Own fixture unavailable');
 check((await get(m.otherActor,m.otherId)).length===1,'Other actor fixture unavailable');
 check((await get(m.actor,m.otherId)).length===0,'Other tenant record exposed');
 const rows=await asActor(m.actor,async()=> (await db.query(`select ${id}::text as id from ${table}`)).rows);
 check(rows.length===1&&rows[0].id===m.ownId,'List exposed unexpected records');
 if(removeMember) {
  await db.query(`delete from ${quote(m.membershipTable)} where ${quote(m.membershipUserColumn)}::text=$1`,[m.actor]);
  check((await get(m.actor,m.ownId)).length===0,'Removed member retains access');
 }
 return {status:'pass',coverage:['authorized read','cross-tenant read','list isolation',...(removeMember?['immediate membership removal']:[])]};
}
