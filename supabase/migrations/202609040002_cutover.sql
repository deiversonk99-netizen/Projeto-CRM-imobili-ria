begin;

update public.app_settings
set data_backend = 'supabase',
    schema_version = greatest(schema_version, 2),
    cutover_at = coalesce(cutover_at, now()),
    updated_at = now()
where legacy_source_id = '1fMcV6e2aUQ4y1zarOGZk0lbiNFTbkVTG';

commit;
