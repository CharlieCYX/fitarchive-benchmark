# features/style-engine — Style Engine

Owning module (ARCHITECTURE.md §3) for routes: /style, /style/build, /style/compatibility, /style/decode.
Core tables: style_sessions, style_feedback, outfits, outfit_items, style_references, style_reference_attributes.
Status: **planned — Phase 6**. UI wiring and server actions land in that phase;
cross-module reads go through `lib/db` queries or `lib/metrics`, never through
another feature's internals (rule §6.4.1).
