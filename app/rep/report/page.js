-- ============================================================
-- AYOH: Replace existing Standard Sampling Event template
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Delete existing fields for the default template
DELETE FROM template_fields
WHERE template_id = '00000000-0000-0000-0000-000000000001';

-- 2. Update the template name/description
UPDATE report_templates
SET
  name = 'Standard Sampling Event',
  description = 'Full demo report — accountability, sales data, shopper insights, retailer intel'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- 3. Insert new fields
INSERT INTO template_fields (template_id, label, field_type, options, required, sort_order) VALUES

-- BEFORE THE DEMO
('00000000-0000-0000-0000-000000000001',
 'Did you contact the grocery manager 3–5 days before this demo?',
 'select',
 ARRAY['Yes — confirmed inventory', 'Yes — left message or email', 'No'],
 true, 1),

('00000000-0000-0000-0000-000000000001',
 'Was product in stock and available when you arrived?',
 'select',
 ARRAY['Yes, fully stocked', 'Partially stocked', 'No — I flagged to manager', 'No — not flagged'],
 true, 2),

('00000000-0000-0000-0000-000000000001',
 'Did you arrive at least 15 minutes early?',
 'select',
 ARRAY['Yes', 'No'],
 true, 3),

-- SALES & CONVERSION
('00000000-0000-0000-0000-000000000001',
 'Total samples handed out',
 'number',
 ARRAY[]::text[],
 true, 4),

('00000000-0000-0000-0000-000000000001',
 'Estimated foot traffic at demo',
 'number',
 ARRAY[]::text[],
 false, 5),

('00000000-0000-0000-0000-000000000001',
 'Most sampled flavor today',
 'select',
 ARRAY['Dill Pickle Mayo', 'Hot Giardinayo', 'Tangy Dijonayo', 'Miso Mayo', 'Original Mayo'],
 false, 6),

('00000000-0000-0000-0000-000000000001',
 'Top reason shoppers did not buy',
 'select',
 ARRAY['Price', 'Did not like taste', 'Already a customer', 'Prefer another brand', 'Just browsing', 'Health or ingredient concern'],
 false, 7),

('00000000-0000-0000-0000-000000000001',
 'Coupons handed out',
 'select',
 ARRAY['0', '1–5', '6–15', '16+', 'No coupons available'],
 false, 8),

-- SHOPPER INSIGHTS
('00000000-0000-0000-0000-000000000001',
 'Estimated age range of most engaged shoppers',
 'select',
 ARRAY['Under 25', '25–40', '40–55', '55+', 'Mixed'],
 false, 9),

('00000000-0000-0000-0000-000000000001',
 'Most common question shoppers asked',
 'select',
 ARRAY['Ingredients / what is in it', 'Sugar or calories', 'Where else to buy', 'Price', 'Difference from competitors', 'Founder or brand story'],
 false, 10),

('00000000-0000-0000-0000-000000000001',
 'Any standout shopper quote or reaction worth sharing?',
 'textarea',
 ARRAY[]::text[],
 false, 11),

-- RETAILER INTEL
('00000000-0000-0000-0000-000000000001',
 'Shelf placement',
 'select',
 ARRAY['Eye level', 'Above eye level', 'Below eye level', 'End cap'],
 false, 12),

('00000000-0000-0000-0000-000000000001',
 'Price on shelf matches expected?',
 'select',
 ARRAY['Yes', 'No — lower than expected', 'No — higher than expected', 'No tag or label visible'],
 false, 13),

('00000000-0000-0000-0000-000000000001',
 'Store staff engagement',
 'select',
 ARRAY['Very helpful', 'Neutral', 'Unhelpful'],
 false, 14),

('00000000-0000-0000-0000-000000000001',
 'Did a manager or buyer interact with you today?',
 'select',
 ARRAY['Yes — positive conversation', 'Yes — neutral or brief', 'No'],
 false, 15),

('00000000-0000-0000-0000-000000000001',
 'Competitor products on the same shelf',
 'multiselect',
 ARRAY['Primal Kitchen', 'Sir Kensington''s', 'Chosen Foods', 'Hellmann''s', 'Duke''s', 'Other', 'None visible'],
 false, 16),

('00000000-0000-0000-0000-000000000001',
 'Recommend this store for a repeat demo?',
 'select',
 ARRAY['Yes — strong location', 'Yes — with conditions', 'No'],
 false, 17),

('00000000-0000-0000-0000-000000000001',
 'Store-specific notes (inventory issues, staff feedback, display opportunities)',
 'textarea',
 ARRAY[]::text[],
 false, 18),

-- REP SELF-ASSESSMENT
('00000000-0000-0000-0000-000000000001',
 'Did you face and organize product on the shelf before leaving?',
 'select',
 ARRAY['Yes', 'No — store declined', 'No'],
 true, 19),

('00000000-0000-0000-0000-000000000001',
 'Did you offer leftover samples to the break room?',
 'select',
 ARRAY['Yes', 'No leftovers', 'No'],
 true, 20),

('00000000-0000-0000-0000-000000000001',
 'Overall demo quality (self-rated 1–5)',
 'select',
 ARRAY['1 — rough day', '2', '3 — solid', '4', '5 — best demo yet'],
 true, 21),

('00000000-0000-0000-0000-000000000001',
 'What would you do differently or improve for next time at this store?',
 'textarea',
 ARRAY[]::text[],
 false, 22);
