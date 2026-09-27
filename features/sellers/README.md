# features/sellers — Seller CRM + Seller Portal

Owning module (ARCHITECTURE.md §3) for routes: /studio/sellers, /seller.
Core tables: sellers, seller_contacts, permissions, agreements, settlements.
Status: **planned — Phase 2**. UI wiring and server actions land in that phase;
cross-module reads go through `lib/db` queries or `lib/metrics`, never through
another feature's internals (rule §6.4.1).
