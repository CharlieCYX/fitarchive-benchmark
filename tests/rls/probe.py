#!/usr/bin/env python3
"""RLS probe harness — verifies the Supabase RLS/column-privilege contract
against a real, throwaway Postgres (hard-fail §19.3 rule 3, red-team C1).

What it does:
  1. Boots an ephemeral Postgres via `pgserver` (no Docker, no hosted Supabase).
  2. Installs a minimal Supabase-compatible prelude: roles `anon` /
     `authenticated` / `service_role`, a stub `auth` schema (auth.users +
     auth.uid() reading `request.jwt.claims`), and the default table grants
     Supabase gives those roles.
  3. Applies every migration in supabase/migrations/ in order (from zero).
  4. Seeds a minimal fixture set (owner, shopper, two sellers, published +
     draft products with private columns, settlements, events, closet item).
  5. Runs the probes below under `set local role` + JWT claims and asserts.

Probes (each prints PASS/FAIL):
  - shopper (authenticated) CANNOT select products.cost_basis_sgd      [C1]
  - shopper (authenticated) CANNOT select products.notes_private       [C1]
  - shopper CAN select the public column list, published rows only
  - anon CANNOT select the private columns either
  - anon CANNOT read sellers / events / closet_items (0 rows or denied)
  - seller A sees ONLY own settlements; seller B likewise
  - seller A sees own DRAFT product; shopper does not
  - get_owner_product_full(): owner gets the full row incl. cost basis;
    shopper/anon get an error, never data
  - data_rights_requests: self insert/read works, others' rows hidden

Usage:
  python3 -m pip install pgserver psycopg[binary]
  python3 tests/rls/probe.py

Exit code 0 = all probes pass; 1 = at least one failure.
"""

from __future__ import annotations

import os
import pathlib
import sys
import tempfile

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = REPO_ROOT / "supabase" / "migrations"

PRELUDE = """
-- Minimal Supabase-compatible environment for a vanilla Postgres.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema if not exists auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'
);
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub')::uuid
$$;

-- Supabase default privileges: anon/authenticated get table-level DML on
-- public tables; migrations 0013/0021 then carve that down.
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
"""

SEED = """
-- users → profiles via the 0002 trigger (default role shopper)
insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'owner@probe.test'),
  ('10000000-0000-4000-8000-000000000002', 'shopper@probe.test'),
  ('10000000-0000-4000-8000-000000000003', 'seller-a@probe.test'),
  ('10000000-0000-4000-8000-000000000004', 'seller-b@probe.test');
update public.profiles set role = 'owner'  where id = '10000000-0000-4000-8000-000000000001';
update public.profiles set role = 'seller' where id = '10000000-0000-4000-8000-000000000003';
update public.profiles set role = 'seller' where id = '10000000-0000-4000-8000-000000000004';

insert into public.sellers (id, org_id, user_id, handle, display_name, notes_private)
select '20000000-0000-4000-8000-00000000000a', o.id, '10000000-0000-4000-8000-000000000003', 'seller-a', 'Seller A', 'owner-only note A'
from public.organizations o;
insert into public.sellers (id, org_id, user_id, handle, display_name, notes_private)
select '20000000-0000-4000-8000-00000000000b', o.id, '10000000-0000-4000-8000-000000000004', 'seller-b', 'Seller B', 'owner-only note B'
from public.organizations o;

insert into public.agreements (id, seller_id, type, seller_share_pct)
values
  ('30000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000a', 'consignment', 60),
  ('30000000-0000-4000-8000-00000000000b', '20000000-0000-4000-8000-00000000000b', 'consignment', 60);

-- published product with private columns + a draft product (same seller)
insert into public.products
  (id, org_id, slug, sku, title, description_public, notes_private, public_price_sgd, cost_basis_sgd, seller_id, availability, published_at)
select '40000000-0000-4000-8000-0000000000a1'::uuid, o.id, 'probe-piece', 'FA-901', 'Probe piece', 'public desc',
       'PRIVATE: seller phone 9123', 48.00, 12.00, '20000000-0000-4000-8000-00000000000a',
       'available', now()
from public.organizations o;
insert into public.products
  (id, org_id, slug, sku, title, notes_private, public_price_sgd, cost_basis_sgd, seller_id, availability)
select '40000000-0000-4000-8000-0000000000d1'::uuid, o.id, 'probe-draft', 'FA-902', 'Probe draft', 'PRIVATE draft note',
       30.00, 5.00, '20000000-0000-4000-8000-00000000000a', 'draft'
from public.organizations o;

insert into public.settlements
  (id, seller_id, agreement_id, period_start, period_end, gross_sale_sgd, seller_base_sgd, fitarchive_gross_sgd, fitarchive_contribution_sgd, status)
values
  ('50000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-00000000000a',
   '2026-01-01', '2026-01-31', 100.00, 60.00, 40.00, 40.00, 'paid'),
  ('50000000-0000-4000-8000-00000000000b', '20000000-0000-4000-8000-00000000000b', '30000000-0000-4000-8000-00000000000b',
   '2026-01-01', '2026-01-31', 200.00, 120.00, 80.00, 80.00, 'pending');

insert into public.sessions (id, org_id, anon_id)
select '60000000-0000-4000-8000-0000000000b1'::uuid, o.id, 'probe-anon' from public.organizations o;
insert into public.events (org_id, event_name, session_id, client_event_id, properties)
select o.id, 'page_view', '60000000-0000-4000-8000-0000000000b1', '60000000-0000-4000-8000-0000000000c1', '{}'
from public.organizations o;

insert into public.closet_items (profile_id, title)
values ('10000000-0000-4000-8000-000000000002', 'Shopper closet item');
"""

OWNER = "10000000-0000-4000-8000-000000000001"
SHOPPER = "10000000-0000-4000-8000-000000000002"
SELLER_A = "10000000-0000-4000-8000-000000000003"
SELLER_B = "10000000-0000-4000-8000-000000000004"
PRODUCT_PUB = "40000000-0000-4000-8000-0000000000a1"
PRODUCT_DRAFT = "40000000-0000-4000-8000-0000000000d1"
SELLER_A_ROW = "20000000-0000-4000-8000-00000000000a"
SELLER_B_ROW = "20000000-0000-4000-8000-00000000000b"

results: list[tuple[str, bool, str]] = []


def report(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  — {detail}" if detail else ""))


def as_role(cur, role: str | None, sub: str | None) -> None:
    """Run subsequent statements as a Supabase role with JWT claims."""
    if role:
        cur.execute(f"set local role {role}")
    claims = "{}" if sub is None else f'{{"sub": "{sub}", "role": "{role or "authenticated"}"}}'
    cur.execute("select set_config('request.jwt.claims', %s, true)", (claims,))


def expect_denied(cur, name: str, sql: str) -> None:
    try:
        cur.execute(sql)
        rows = cur.fetchall()
        report(name, False, f"expected permission denied, got {len(rows)} row(s)")
    except Exception as exc:  # insufficient_privilege (42501) expected
        report(name, True, type(exc).__name__)


def migration_sql(path: pathlib.Path, has_pgcrypto: bool) -> str:
    """pgserver's bundled Postgres lacks contrib modules; gen_random_uuid()
    is core since PG13, so the pgcrypto extension line can be skipped when
    the extension is not installed (it is present on hosted Supabase)."""
    text = path.read_text()
    if not has_pgcrypto:
        text = text.replace(
            "create extension if not exists pgcrypto;",
            "-- pgcrypto not bundled with pgserver; gen_random_uuid() is core (PG13+)",
        )
    return text


def main() -> int:
    import psycopg
    import pgserver

    pgdata = tempfile.mkdtemp(prefix="fa-rls-probe-")
    pg = pgserver.get_server(pgdata)
    uri = pg.get_uri()
    print(f"[probe] ephemeral postgres up: {pgdata}")

    with psycopg.connect(uri, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(PRELUDE)
            has_pgcrypto = True
            try:
                cur.execute("create extension if not exists pgcrypto")
            except Exception:
                has_pgcrypto = False
                print("[probe] pgcrypto unavailable in pgserver build — skipping extension line")
            migrations = sorted(MIGRATIONS_DIR.glob("*.sql"))
            for path in migrations:
                cur.execute(migration_sql(path, has_pgcrypto))
                print(f"[probe] applied {path.name}")
            cur.execute(SEED)
            print("[probe] fixtures seeded")

            # ---- C1: shopper column lockdown --------------------------------
            cur.execute("begin")
            as_role(cur, "authenticated", SHOPPER)
            expect_denied(
                cur,
                "shopper cannot select products.cost_basis_sgd",
                "select cost_basis_sgd from public.products",
            )
            cur.execute("rollback")

            cur.execute("begin")
            as_role(cur, "authenticated", SHOPPER)
            expect_denied(
                cur,
                "shopper cannot select products.notes_private",
                "select notes_private from public.products",
            )
            cur.execute("rollback")

            cur.execute("begin")
            as_role(cur, "authenticated", SHOPPER)
            expect_denied(
                cur,
                "shopper select * does not leak private columns",
                "select * from public.products",
            )
            cur.execute("rollback")

            cur.execute("begin")
            as_role(cur, "authenticated", SHOPPER)
            cur.execute(
                "select id, slug, title, public_price_sgd from public.products order by slug"
            )
            rows = cur.fetchall()
            slugs = [r[1] for r in rows]
            report(
                "shopper reads public columns, published rows only",
                slugs == ["probe-piece"],
                f"visible slugs: {slugs}",
            )
            cur.execute("rollback")

            # ---- anon lockdown ----------------------------------------------
            cur.execute("begin")
            as_role(cur, "anon", None)
            expect_denied(
                cur,
                "anon cannot select products.cost_basis_sgd",
                "select cost_basis_sgd from public.products",
            )
            cur.execute("rollback")

            cur.execute("begin")
            as_role(cur, "anon", None)
            anon_blocked = True
            detail = []
            for table in ("sellers", "events", "closet_items"):
                try:
                    cur.execute(f"select count(*) from public.{table}")
                    n = cur.fetchone()[0]
                    detail.append(f"{table}={n} rows")
                    if n != 0:
                        anon_blocked = False
                except Exception as exc:
                    detail.append(f"{table}=denied({type(exc).__name__})")
            report("anon cannot read sellers/events/closet_items", anon_blocked, "; ".join(detail))
            cur.execute("rollback")

            # ---- seller settlement scoping -----------------------------------
            for seller_sub, own_seller, label in (
                (SELLER_A, SELLER_A_ROW, "seller A"),
                (SELLER_B, SELLER_B_ROW, "seller B"),
            ):
                cur.execute("begin")
                as_role(cur, "authenticated", seller_sub)
                cur.execute("select seller_id from public.settlements")
                rows = [str(r[0]) for r in cur.fetchall()]
                ok = len(rows) == 1 and rows[0] == own_seller
                report(f"{label} sees only own settlements", ok, f"rows: {rows}")
                cur.execute("rollback")

            # ---- seller sees own draft; shopper does not ----------------------
            cur.execute("begin")
            as_role(cur, "authenticated", SELLER_A)
            cur.execute(
                "select slug from public.products where slug = 'probe-draft'"
            )
            report(
                "seller A sees own draft product",
                cur.fetchone() is not None,
            )
            cur.execute("rollback")

            # ---- owner full-row RPC -------------------------------------------
            cur.execute("begin")
            as_role(cur, "authenticated", OWNER)
            cur.execute(
                "select cost_basis_sgd, notes_private from public.get_owner_product_full(%s)",
                (PRODUCT_PUB,),
            )
            row = cur.fetchone()
            report(
                "owner reads full row via get_owner_product_full()",
                row is not None and float(row[0]) == 12.00 and "PRIVATE" in (row[1] or ""),
                f"row: {row}",
            )
            cur.execute("rollback")

            cur.execute("begin")
            as_role(cur, "authenticated", SHOPPER)
            expect_denied(
                cur,
                "shopper is rejected by get_owner_product_full()",
                f"select * from public.get_owner_product_full('{PRODUCT_PUB}')",
            )
            cur.execute("rollback")

            # ---- data rights requests ------------------------------------------
            cur.execute("begin")
            as_role(cur, "authenticated", SHOPPER)
            cur.execute(
                "insert into public.data_rights_requests (profile_id, kind, note) values (%s, 'delete', 'probe') returning id",
                (SHOPPER,),
            )
            req_id = cur.fetchone()[0]
            cur.execute("select count(*) from public.data_rights_requests")
            n_self = cur.fetchone()[0]
            report(
                "shopper can file + read own data-rights request",
                req_id is not None and n_self == 1,
            )
            cur.execute("rollback")

            cur.execute("begin")
            as_role(cur, "authenticated", SELLER_A)
            cur.execute("select count(*) from public.data_rights_requests")
            report(
                "other users cannot read the shopper's data-rights request",
                cur.fetchone()[0] == 0,
            )
            cur.execute("rollback")

    failed = [r for r in results if not r[1]]
    print(f"\n[probe] {len(results) - len(failed)}/{len(results)} probes passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
