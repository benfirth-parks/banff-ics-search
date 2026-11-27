-- Banff ICS for Search: sync schema. Run once in the Supabase SQL editor.
-- Access model: no user accounts. Anyone holding an incident's shared code can
-- read and write that incident's records via the RPC functions below. Tables
-- are not directly readable with the anon key (RLS on, no policies).
-- Training/made-up data only in v1.

create table if not exists ics_incidents (
  incident_id uuid primary key,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists ics_records (
  id uuid primary key,
  incident_id uuid not null references ics_incidents(incident_id) on delete cascade,
  tbl text not null,
  data jsonb not null,
  updated_at timestamptz not null,
  server_ts timestamptz not null default clock_timestamp()
);
create index if not exists ics_records_pull on ics_records (incident_id, server_ts);

alter table ics_incidents enable row level security;
alter table ics_records enable row level security;

create or replace function ics_join(p_code text) returns uuid
language sql security definer set search_path = public as $$
  select incident_id from ics_incidents where code = upper(trim(p_code));
$$;

create or replace function ics_pull(p_code text, p_since timestamptz)
returns table (tbl text, data jsonb, server_ts timestamptz)
language sql security definer set search_path = public as $$
  select r.tbl, r.data, r.server_ts from ics_records r
  join ics_incidents i on i.incident_id = r.incident_id
  where i.code = upper(trim(p_code)) and r.server_ts > coalesce(p_since, '-infinity')
  order by r.server_ts
  limit 2000;
$$;

-- p_rows: [{ "tbl": "teams", "data": { ...record with id, incidentId, updatedAt } }]
create or replace function ics_push(p_code text, p_rows jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_incident uuid;
  v_row jsonb;
  v_count integer := 0;
begin
  select incident_id into v_incident from ics_incidents where code = upper(trim(p_code));
  if v_incident is null then
    -- First push for a new incident registers its code.
    for v_row in select * from jsonb_array_elements(p_rows) loop
      if v_row->>'tbl' = 'incidents' and upper(v_row->'data'->>'code') = upper(trim(p_code)) then
        v_incident := (v_row->'data'->>'id')::uuid;
        insert into ics_incidents (incident_id, code) values (v_incident, upper(trim(p_code)));
      end if;
    end loop;
    if v_incident is null then raise exception 'unknown incident code'; end if;
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    if (v_row->'data'->>'incidentId')::uuid <> v_incident then continue; end if;
    insert into ics_records (id, incident_id, tbl, data, updated_at)
    values ((v_row->'data'->>'id')::uuid, v_incident, v_row->>'tbl', v_row->'data', (v_row->'data'->>'updatedAt')::timestamptz)
    on conflict (id) do update
      set data = excluded.data, updated_at = excluded.updated_at, server_ts = clock_timestamp()
      where ics_records.updated_at < excluded.updated_at;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function ics_join(text) to anon;
grant execute on function ics_pull(text, timestamptz) to anon;
grant execute on function ics_push(text, jsonb) to anon;
