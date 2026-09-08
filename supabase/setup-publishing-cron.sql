-- Run this in the Supabase SQL Editor after replacing the secret placeholder.
-- The URL must use HTTPS and must not end with a slash.
-- The secret must exactly match CRON_SECRET on the production app host.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
declare
  production_url constant text := 'https://360creatorhub.vercel.app';
  secret_value constant text := 'REPLACE_WITH_YOUR_CRON_SECRET';
  app_url_id uuid;
  cron_secret_id uuid;
begin
  if secret_value = 'REPLACE_WITH_YOUR_CRON_SECRET' then
    raise exception 'Replace REPLACE_WITH_YOUR_CRON_SECRET before running this script';
  end if;

  select id
    into app_url_id
    from vault.decrypted_secrets
   where name = 'creatorhub_app_url'
   order by created_at desc
   limit 1;

  if app_url_id is null then
    perform vault.create_secret(
      production_url,
      'creatorhub_app_url',
      'CreatorHub production URL used by scheduled publishing'
    );
  else
    perform vault.update_secret(
      app_url_id,
      production_url,
      'creatorhub_app_url',
      'CreatorHub production URL used by scheduled publishing'
    );
  end if;

  select id
    into cron_secret_id
    from vault.decrypted_secrets
   where name = 'creatorhub_cron_secret'
   order by created_at desc
   limit 1;

  if cron_secret_id is null then
    perform vault.create_secret(
      secret_value,
      'creatorhub_cron_secret',
      'Bearer token for the CreatorHub scheduled-publishing endpoint'
    );
  else
    perform vault.update_secret(
      cron_secret_id,
      secret_value,
      'creatorhub_cron_secret',
      'Bearer token for the CreatorHub scheduled-publishing endpoint'
    );
  end if;
end
$$;

select cron.schedule(
  'creatorhub-publish-scheduled',
  '* * * * *',
  $job$
    select net.http_get(
      url := (
        select decrypted_secret
          from vault.decrypted_secrets
         where name = 'creatorhub_app_url'
         order by created_at desc
         limit 1
      ) || '/api/cron/publish-scheduled',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (
          select decrypted_secret
            from vault.decrypted_secrets
           where name = 'creatorhub_cron_secret'
           order by created_at desc
           limit 1
        )
      ),
      timeout_milliseconds := 300000
    ) as request_id;
  $job$
);

-- Useful checks after setup:
-- select jobid, jobname, schedule, active from cron.job
-- where jobname = 'creatorhub-publish-scheduled';
--
-- select id, status_code, timed_out, error_msg, created
-- from net._http_response
-- order by created desc
-- limit 20;
