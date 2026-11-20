-- Dedicated, column-limited view for the anonymous business-card page (/p/[id]).
-- Exposes only the fields the public card UI actually renders, so a future
-- select("*") against this view can never leak stripe_customer_id, waddress,
-- username, phone, or other sensitive profile columns.
--
-- security_invoker = true (Postgres 15+) makes the view run with the
-- querying role's own permissions, so the profiles RLS policies (including
-- the public_access = true restriction) still apply through the view. The
-- WHERE clause below is a second, redundant layer of the same restriction —
-- defense in depth in case RLS is ever misconfigured again.
create or replace view public.public_profile_cards
with (security_invoker = true) as
select
  public_id,
  full_name,
  company,
  job_title,
  email,
  website,
  linkedin_url,
  avatar_url,
  company_logo_url,
  xhandle,
  card_style
from public.profiles
where public_access = true;

grant select on public.public_profile_cards to anon, authenticated;
