create role app_user nologin nosuperuser nobypassrls;
create table workspace_access(workspace_id uuid,principal_id uuid,is_active boolean not null,is_admin boolean not null,primary key(workspace_id,principal_id));
create table tickets(ticket_id uuid primary key,workspace_id uuid not null,subject text);
insert into workspace_access values
('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',true,true),
('20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002',true,true);
insert into tickets values
('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Synthetic A'),
('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Synthetic B');
grant select on tickets,workspace_access to app_user;
alter table workspace_access enable row level security;
create policy self on workspace_access for select to app_user using(principal_id=nullif(current_setting('app.principal_id',true),'')::uuid);
alter table tickets enable row level security;
create policy member_read on tickets for select to app_user using(exists(select 1 from workspace_access a where a.workspace_id=tickets.workspace_id and a.principal_id=nullif(current_setting('app.principal_id',true),'')::uuid and a.is_active));

grant insert,update,delete on tickets to app_user;
create policy owner_insert on tickets for insert to app_user with check(exists(select 1 from workspace_access a where a.workspace_id=tickets.workspace_id and a.principal_id=nullif(current_setting('app.principal_id',true),'')::uuid and a.is_active and a.is_admin));
create policy owner_update on tickets for update to app_user using(exists(select 1 from workspace_access a where a.workspace_id=tickets.workspace_id and a.principal_id=nullif(current_setting('app.principal_id',true),'')::uuid and a.is_active and a.is_admin)) with check(exists(select 1 from workspace_access a where a.workspace_id=tickets.workspace_id and a.principal_id=nullif(current_setting('app.principal_id',true),'')::uuid and a.is_active and a.is_admin));
create policy owner_delete on tickets for delete to app_user using(exists(select 1 from workspace_access a where a.workspace_id=tickets.workspace_id and a.principal_id=nullif(current_setting('app.principal_id',true),'')::uuid and a.is_active and a.is_admin));
