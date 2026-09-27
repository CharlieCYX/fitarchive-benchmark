# features/campaigns — Campaign Studio

Owning module (ARCHITECTURE.md §3) for routes: /studio/campaigns.
Core tables: campaigns, campaign_assets, campaign_posts, tracked_links, ai_generations.
Status: **planned — Phase 3**. UI wiring and server actions land in that phase;
cross-module reads go through `lib/db` queries or `lib/metrics`, never through
another feature's internals (rule §6.4.1).
