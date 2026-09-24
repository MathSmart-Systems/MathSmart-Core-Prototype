-- Complete the provider rename while preserving the classroom's current choice.
create or replace function app.looks_like_a_secret(value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value::text ~* '(api[_-]?key|secret|password|credential|(access|auth)[_-]?token|service[_-]?role|model)';
$$;

insert into app.system_settings (setting_key, setting_value, updated_by)
select
  'features.gemini_advisory',
  system_settings.setting_value,
  system_settings.updated_by
from app.system_settings
where system_settings.setting_key in (
  'features.groq_advisory',
  'features.groq_enabled',
  'features.groq_feedback_enabled'
)
order by case system_settings.setting_key
  when 'features.groq_advisory' then 1
  when 'features.groq_enabled' then 2
  else 3
end
limit 1
on conflict (setting_key) do nothing;

delete from app.system_settings
where setting_key in (
  'features.groq_advisory',
  'features.groq_enabled',
  'features.groq_feedback_enabled'
);

create or replace function app.gemini_advisory_enabled()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_value jsonb;
begin
  if not app.is_active_account() then
    return false;
  end if;

  select system_settings.setting_value
  into v_value
  from app.system_settings
  where system_settings.setting_key = 'features.gemini_advisory';

  return coalesce(jsonb_typeof(v_value) = 'boolean' and v_value = 'true'::jsonb, false);
end;
$$;

comment on function app.gemini_advisory_enabled() is
  'True only when the stored classroom setting allows optional Gemini advice. Returns false when no setting exists or the caller is inactive.';

revoke all on function app.gemini_advisory_enabled() from public;
revoke all on function app.gemini_advisory_enabled() from anon;
grant execute on function app.gemini_advisory_enabled() to authenticated, service_role;

drop function app.groq_advisory_enabled();
