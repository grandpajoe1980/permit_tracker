-- S6: preserve resource provenance and distinguish missing/demo links from
-- authoritative resources in the permit catalog.

alter table public.requirement_resources
  add column if not exists effective_date date,
  add column if not exists instructions text,
  add column if not exists source_authority text,
  add column if not exists resource_classification text not null default 'unclassified';

alter table public.requirement_resources
  alter column url drop not null,
  alter column verified_at drop not null,
  alter column verified_by drop not null;

update public.requirement_resources
set resource_classification = case
  when lower(coalesce(url, '')) like '%.pdf%' then 'file_download'
  when nullif(trim(coalesce(url, '')), '') is not null then 'official_resource'
  else 'unavailable'
end
where resource_classification = 'unclassified';
