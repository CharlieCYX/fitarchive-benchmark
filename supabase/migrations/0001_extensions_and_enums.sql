-- 0001_extensions_and_enums.sql
-- DATA_MODEL.md §1: extensions + all enums. Idempotent where possible.
-- Applied with `supabase db push` (see docs/DATA_MODEL.md §5 migration plan).

create extension if not exists pgcrypto;

create type app_role as enum ('owner', 'seller', 'shopper', 'stylist', 'analyst', 'viewer');
create type permission_state as enum ('observed_only', 'contacted', 'permission_referral', 'permission_consignment', 'owned', 'borrowed_for_content', 'prototype_permission', 'expired_revoked');
create type agreement_type as enum ('owned', 'consignment', 'referral', 'content_collaboration');
create type condition_grade as enum ('new_unworn', 'excellent', 'good', 'fair', 'project_repair');
create type availability_status as enum ('draft', 'available', 'reserved', 'sold', 'withdrawn');
create type drop_item_tier as enum ('entry', 'core', 'hero');
create type drop_status as enum ('planning', 'ready', 'scheduled', 'published', 'paused', 'closed');
create type order_mode as enum ('demo', 'external_manual');
create type order_status as enum ('pending', 'paid', 'fulfilled', 'cancelled', 'refunded');
create type payment_status as enum ('initiated', 'authorized', 'captured', 'failed', 'refunded', 'simulated');
create type insight_type as enum ('observation', 'hypothesis', 'experiment', 'validated_result', 'forecast');
create type conclusion_strength as enum ('inconclusive', 'directional', 'repeated_evidence');
create type experiment_status as enum ('draft', 'running', 'paused', 'concluded', 'abandoned');
create type experiment_unit as enum ('session', 'product', 'campaign', 'drop');
create type style_mode as enum ('build_my_fit', 'can_this_work', 'decode_reference');
create type style_feedback_label as enum ('nailed_it', 'too_costume', 'too_hot', 'wrong_silhouette', 'wrong_budget', 'other');
create type style_failure_mode as enum ('constraint_miss', 'hallucinated_inventory', 'cosplay_overfit', 'contradiction_blindness', 'unsupported_certainty', 'preference_miss');
create type tag_source as enum ('human', 'seller_provided', 'ai_suggestion', 'imported_metadata', 'rule');
create type ai_generation_status as enum ('draft', 'accepted', 'rejected', 'superseded');
create type job_status as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');
create type taxonomy_dimension as enum ('category', 'silhouette', 'proportion', 'material', 'palette_role', 'energy', 'era', 'aesthetic', 'climate', 'use');
