-- 0014_taxonomy_seed.sql
-- DATA_MODEL.md §3 controlled taxonomy seed (idempotent upserts into the single
-- V1 org, A3). Operator-editable afterwards; versioning per §11.4 rule 4.

insert into public.tags (org_id, dimension, slug, label, description)
select o.id, v.dimension::taxonomy_dimension, v.slug, v.label, v.description
from public.organizations o
cross join (
  values
    -- category
    ('category', 'outerwear', 'Outerwear', null),
    ('category', 'top', 'Top', null),
    ('category', 'shirt', 'Shirt', null),
    ('category', 'knitwear', 'Knitwear', null),
    ('category', 'trouser', 'Trouser', null),
    ('category', 'denim', 'Denim', null),
    ('category', 'skirt', 'Skirt', null),
    ('category', 'dress', 'Dress', null),
    ('category', 'footwear', 'Footwear', null),
    ('category', 'bag', 'Bag', null),
    ('category', 'accessory', 'Accessory', null),
    ('category', 'other', 'Other', null),
    -- silhouette
    ('silhouette', 'boxy', 'Boxy', null),
    ('silhouette', 'cropped', 'Cropped', null),
    ('silhouette', 'fitted', 'Fitted', null),
    ('silhouette', 'oversized', 'Oversized', null),
    ('silhouette', 'relaxed', 'Relaxed', null),
    ('silhouette', 'straight', 'Straight', null),
    ('silhouette', 'wide', 'Wide', null),
    ('silhouette', 'flared', 'Flared', null),
    ('silhouette', 'tapered', 'Tapered', null),
    ('silhouette', 'draped', 'Draped', null),
    ('silhouette', 'structured', 'Structured', null),
    -- proportion
    ('proportion', 'long-over-short', 'Long over short', null),
    ('proportion', 'short-over-long', 'Short over long', null),
    ('proportion', 'balanced', 'Balanced', null),
    ('proportion', 'top-heavy', 'Top-heavy', null),
    ('proportion', 'bottom-heavy', 'Bottom-heavy', null),
    ('proportion', 'layered', 'Layered', null),
    -- material
    ('material', 'cotton', 'Cotton', null),
    ('material', 'denim', 'Denim', null),
    ('material', 'leather', 'Leather', null),
    ('material', 'wool', 'Wool', null),
    ('material', 'knit', 'Knit', null),
    ('material', 'nylon', 'Nylon', null),
    ('material', 'polyester', 'Polyester', null),
    ('material', 'linen', 'Linen', null),
    ('material', 'silk', 'Silk', null),
    ('material', 'rayon-viscose', 'Rayon / viscose', null),
    ('material', 'mesh', 'Mesh', null),
    ('material', 'mixed-unknown', 'Mixed / unknown', null),
    -- palette_role
    ('palette_role', 'neutral', 'Neutral', null),
    ('palette_role', 'monochrome', 'Monochrome', null),
    ('palette_role', 'low-contrast', 'Low contrast', null),
    ('palette_role', 'high-contrast', 'High contrast', null),
    ('palette_role', 'accent-color', 'Accent color', null),
    ('palette_role', 'earth', 'Earth', null),
    ('palette_role', 'jewel', 'Jewel', null),
    ('palette_role', 'pastel', 'Pastel', null),
    ('palette_role', 'metallic', 'Metallic', null),
    -- energy
    ('energy', 'clean', 'Clean', null),
    ('energy', 'sharp', 'Sharp', null),
    ('energy', 'soft', 'Soft', null),
    ('energy', 'rugged', 'Rugged', null),
    ('energy', 'romantic', 'Romantic', null),
    ('energy', 'sporty', 'Sporty', null),
    ('energy', 'futuristic', 'Futuristic', null),
    ('energy', 'archival', 'Archival', null),
    ('energy', 'playful', 'Playful', null),
    ('energy', 'formal', 'Formal', null),
    ('energy', 'utilitarian', 'Utilitarian', null),
    -- era
    ('era', '70s', '70s', null),
    ('era', '80s', '80s', null),
    ('era', '90s', '90s', null),
    ('era', '2000s-y2k', '2000s / Y2K', null),
    ('era', 'contemporary', 'Contemporary', null),
    ('era', 'vintage-uncertain', 'Vintage (uncertain)', null),
    -- aesthetic
    ('aesthetic', 'streetwear', 'Streetwear', null),
    ('aesthetic', 'minimal', 'Minimal', null),
    ('aesthetic', 'workwear', 'Workwear', null),
    ('aesthetic', 'blokecore', 'Blokecore', null),
    ('aesthetic', 'blokette', 'Blokette', null),
    ('aesthetic', 'gorpcore', 'Gorpcore', null),
    ('aesthetic', 'darkwear', 'Darkwear', null),
    ('aesthetic', 'prep', 'Prep', null),
    ('aesthetic', 'romantic', 'Romantic', null),
    ('aesthetic', 'techwear', 'Techwear', null),
    ('aesthetic', 'archival', 'Archival', null),
    ('aesthetic', 'tailored', 'Tailored', null),
    ('aesthetic', 'other', 'Other', null),
    -- climate (breathability/layering notes carried in description, §11.3)
    ('climate', 'hot-humid', 'Hot & humid', 'Singapore default: prioritize breathability, short layers, quick-dry fabrics.'),
    ('climate', 'indoor-aircon', 'Indoor aircon', 'Light layerable pieces; strong indoor/outdoor temperature swing.'),
    ('climate', 'mild', 'Mild', 'Flexible layering; most fabrics work.'),
    ('climate', 'cold', 'Cold', 'Insulating layers, wool/heap knits, shell outerwear.'),
    -- use
    ('use', 'daily', 'Daily', null),
    ('use', 'work', 'Work', null),
    ('use', 'nightlife', 'Nightlife', null),
    ('use', 'event', 'Event', null),
    ('use', 'travel', 'Travel', null),
    ('use', 'active', 'Active', null),
    ('use', 'editorial', 'Editorial', null),
    ('use', 'special-occasion', 'Special occasion', null)
) as v(dimension, slug, label, description)
where o.slug = 'fitarchive'
on conflict (org_id, dimension, slug, version) do nothing;

-- A few starter aliases (§11.4 rule 4: mappings preserved so history never breaks).
insert into public.tag_aliases (tag_id, alias)
select t.id, a.alias
from public.tags t
join public.organizations o on o.id = t.org_id and o.slug = 'fitarchive'
cross join (values
  ('trousers', 'trouser'),
  ('pants', 'trouser'),
  ('jeans', 'denim'),
  ('y2k', '2000s-y2k'),
  ('jacket', 'outerwear')
) as a(alias, canonical_slug)
where t.slug = a.canonical_slug
on conflict (alias) do nothing;
