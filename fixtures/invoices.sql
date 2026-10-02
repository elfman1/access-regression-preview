create role app_user nologin nosuperuser nobypassrls;
create table memberships(org_id text,user_id text,role text not null,primary key(org_id,user_id));
create table invoices(id int primary key,org_id text not null,amount integer not null);
insert into memberships values('a','alice','owner'),('b','bob','owner');
insert into invoices values(1,'a',100),(2,'b',200);
grant select on memberships,invoices to app_user;
alter table memberships enable row level security;
create policy self on memberships for select to app_user using(user_id=current_setting('app.user_id',true));
alter table invoices enable row level security;
create policy member_read on invoices for select to app_user using(exists(select 1 from memberships m where m.org_id=invoices.org_id and m.user_id=current_setting('app.user_id',true)));

grant insert,update,delete on invoices to app_user;
create policy owner_insert on invoices for insert to app_user with check(exists(select 1 from memberships m where m.org_id=invoices.org_id and m.user_id=current_setting('app.user_id',true) and m.role='owner'));
create policy owner_update on invoices for update to app_user using(exists(select 1 from memberships m where m.org_id=invoices.org_id and m.user_id=current_setting('app.user_id',true) and m.role='owner')) with check(exists(select 1 from memberships m where m.org_id=invoices.org_id and m.user_id=current_setting('app.user_id',true) and m.role='owner'));
create policy owner_delete on invoices for delete to app_user using(exists(select 1 from memberships m where m.org_id=invoices.org_id and m.user_id=current_setting('app.user_id',true) and m.role='owner'));
