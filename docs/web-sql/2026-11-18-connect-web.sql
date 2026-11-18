-- StudioVoxario Connect – migrace webu k ručnímu spuštění (Supabase → SQL Editor → Run), v tomto pořadí.
-- Jsou idempotentní (drop/create if exists), opakované spuštění nevadí.

-- ===================== 20261118030000_shop_files_license_read.sql =====================
-- StudioVoxario Connect / obchod: soubor softwaru smí stáhnout i držitel licence (shop_licenses), ne jen předplatitel.
-- Dosavadní politika shop_files_buyer_read kontrolovala jen shop_entitlements, takže kupující trvalé licence
-- (Voxario Studio Engine) dostal při stahování chybu. Pravidlo je teď stejné jako shop_can_download().
drop policy if exists shop_files_buyer_read on storage.objects;
create policy shop_files_buyer_read on storage.objects for select to authenticated
  using (
    bucket_id = 'shop-files' and exists (
      select 1 from public.shop_items i
      where storage.objects.name = any (i.file_parts) and public.shop_can_download(i.id)
    )
  );

-- ===================== 20261118160000_game_access_platform_roles.sql =====================
-- StudioVoxario Connect: přístup k jednotlivým hrám (Ashes of Eryon, Fantasy, další) a role pro platformu.
--
-- * game_access(user_id, game) – povolení hrát konkrétní hru. Ashes of Eryon dál používá svou tabulku ashes_access
--   (hra a launcher s ní počítají); funkce níže ji pro 'ashes-of-eryon' zpřístupňují stejně jako ostatní hry.
-- * game_can_play(p_game) – smí přihlášený uživatel hru stáhnout a hrát? (správce, editor, nebo povolení)
-- * game_admin_access_list / _grant / _revoke – správa přístupů (správce, u ostatních her i editor) z webu i z Connectu.
-- * my_platform_role() – role přihlášeného uživatele pro Connect (správce / editor / hráč) + hry, ke kterým má přístup.

create table if not exists public.game_access (
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null check (game ~ '^[a-z0-9-]{2,40}$'),
  granted_by uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  primary key (user_id, game)
);
alter table public.game_access enable row level security;
drop policy if exists game_access_own on public.game_access;
create policy game_access_own on public.game_access for select to authenticated using (user_id = auth.uid());
create index if not exists game_access_game on public.game_access (game, created_at desc);

-- hry, u kterých se přístup spravuje (ochrana proti překlepům v názvu hry)
create or replace function public.game_access_known(p_game text)
returns boolean language sql immutable as $$
  select p_game in ('ashes-of-eryon', 'fantasy');
$$;

create or replace function public.game_is_manager(p_game text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.has_role(auth.uid(), 'admin')
    or (p_game <> 'ashes-of-eryon' and public.has_role(auth.uid(), 'editor'))
  );
$$;

create or replace function public.game_can_play(p_game text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when p_game = 'ashes-of-eryon' then public.ashes_can_play()
    else public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor')
      or exists (select 1 from public.game_access a where a.user_id = auth.uid() and a.game = p_game)
  end;
$$;

create or replace function public.game_admin_access_list(p_game text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.game_access_known(p_game) then raise exception 'Neznámá hra.'; end if;
  if not public.game_is_manager(p_game) then raise exception 'Jen pro správce.'; end if;
  if p_game = 'ashes-of-eryon' then return public.ashes_admin_access_list(); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', a.user_id, 'email', u.email,
      'name', coalesce(p.display_name, p.username), 'note', a.note, 'created_at', a.created_at) order by a.created_at desc)
    from public.game_access a join auth.users u on u.id = a.user_id
    left join public.profiles p on p.user_id = a.user_id
    where a.game = p_game), '[]'::jsonb);
end;
$$;

create or replace function public.game_admin_access_grant(p_game text, p_who text, p_note text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare q text := lower(btrim(coalesce(p_who, ''))); target uuid; n int;
begin
  if not public.game_access_known(p_game) then raise exception 'Neznámá hra.'; end if;
  if not public.game_is_manager(p_game) then raise exception 'Jen pro správce.'; end if;
  if p_game = 'ashes-of-eryon' then return public.ashes_admin_access_grant(p_who, p_note); end if;
  if length(q) < 2 then raise exception 'Zadej e-mail nebo přezdívku.'; end if;
  select u.id into target from auth.users u where lower(u.email) = q;
  if target is null then
    select count(*) into n from public.profiles p where lower(p.username) = q or lower(p.display_name) = q;
    if n > 1 then raise exception 'Přezdívku má víc lidí – zadej e-mail.'; end if;
    select p.user_id into target from public.profiles p where lower(p.username) = q or lower(p.display_name) = q;
  end if;
  if target is null then raise exception 'Uživatel nenalezen.'; end if;
  insert into public.game_access (user_id, game, granted_by, note)
  values (target, p_game, auth.uid(), nullif(btrim(coalesce(p_note, '')), ''))
  on conflict (user_id, game) do update set note = coalesce(excluded.note, public.game_access.note);
  return public.game_admin_access_list(p_game);
end;
$$;

create or replace function public.game_admin_access_revoke(p_game text, p_user uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.game_access_known(p_game) then raise exception 'Neznámá hra.'; end if;
  if not public.game_is_manager(p_game) then raise exception 'Jen pro správce.'; end if;
  if p_game = 'ashes-of-eryon' then return public.ashes_admin_access_revoke(p_user); end if;
  delete from public.game_access where user_id = p_user and game = p_game;
  return public.game_admin_access_list(p_game);
end;
$$;

create or replace function public.my_platform_role()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then jsonb_build_object('signed_in', false) else jsonb_build_object(
    'signed_in', true,
    'role', case when public.has_role(auth.uid(), 'admin') then 'admin'
                 when public.has_role(auth.uid(), 'editor') then 'editor' else 'player' end,
    'games', (select coalesce(jsonb_agg(g), '[]'::jsonb) from unnest(array['ashes-of-eryon', 'fantasy']) g where public.game_can_play(g)),
    'manages', (select coalesce(jsonb_agg(g), '[]'::jsonb) from unnest(array['ashes-of-eryon', 'fantasy']) g where public.game_is_manager(g))
  ) end;
$$;

revoke all on function public.game_can_play(text), public.game_admin_access_list(text), public.game_admin_access_grant(text, text, text),
  public.game_admin_access_revoke(text, uuid), public.my_platform_role(), public.game_is_manager(text) from public, anon;
grant execute on function public.game_can_play(text), public.game_admin_access_list(text), public.game_admin_access_grant(text, text, text),
  public.game_admin_access_revoke(text, uuid), public.my_platform_role(), public.game_is_manager(text) to authenticated;

-- ===================== 20261118170000_game_updates_private.sql =====================
-- Soukromé úložiště her: buildy Ashes of Eryon a Fantasy (bucket game-updates, složka unity/) smí stáhnout jen
-- přihlášený uživatel s přístupem ke konkrétní hře (game_can_play – správce, editor, nebo udělený přístup).
-- StudioVoxario Connect (od 0.5.0) stahuje přes /storage/v1/object/authenticated/… s tokenem uživatele.
--
--   unity/fantasy/…, unity/latest-fantasy.json  → Fantasy
--   ostatní unity/… (latest.json, latest-beta.json, <verze>/…)  → Ashes of Eryon
--   launcher/…  → dál čitelné všem (aktualizace starého launcheru; přes autorizovaný endpoint s anon klíčem)
--
-- Nahrávání z CI (klíč služby) RLS neomezuje. Starý launcher Ashes stahuje hry přes /object/public/ – po této změně
-- už hry nestáhne; hráči přecházejí na StudioVoxario Connect (převezme jejich instalace bez stahování).

update storage.buckets set public = false where id = 'game-updates';

drop policy if exists game_updates_launcher_read on storage.objects;
create policy game_updates_launcher_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'game-updates' and name like 'launcher/%');

drop policy if exists game_updates_fantasy_read on storage.objects;
create policy game_updates_fantasy_read on storage.objects for select to authenticated
  using (
    bucket_id = 'game-updates'
    and (name like 'unity/fantasy/%' or name = 'unity/latest-fantasy.json')
    and public.game_can_play('fantasy')
  );

drop policy if exists game_updates_ashes_read on storage.objects;
create policy game_updates_ashes_read on storage.objects for select to authenticated
  using (
    bucket_id = 'game-updates'
    and name like 'unity/%'
    and name not like 'unity/fantasy/%'
    and name <> 'unity/latest-fantasy.json'
    and public.game_can_play('ashes-of-eryon')
  );
