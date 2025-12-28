-- =====================================================
-- PCM Requisition System - Seed Data
-- Sprint 1: Test/Development Data
-- =====================================================

-- =====================================================
-- UOM TYPES (Units of Measure)
-- =====================================================

INSERT INTO uom_types (code, name, description) VALUES
  ('PCS', 'Pieces', 'Individual units or pieces'),
  ('EA', 'Each', 'Each unit'),
  ('SET', 'Set', 'Set of items'),
  ('PKT', 'Packet', 'Packet or package'),
  ('BOX', 'Box', 'Box'),
  ('CTN', 'Carton', 'Carton'),
  ('DZ', 'Dozen', '12 pieces'),

  -- Weight
  ('KG', 'Kilogram', 'Weight in kilograms'),
  ('G', 'Gram', 'Weight in grams'),
  ('MT', 'Metric Ton', 'Weight in metric tons'),
  ('LB', 'Pound', 'Weight in pounds'),

  -- Volume
  ('L', 'Liter', 'Volume in liters'),
  ('ML', 'Milliliter', 'Volume in milliliters'),
  ('GAL', 'Gallon', 'Volume in gallons'),

  -- Length
  ('M', 'Meter', 'Length in meters'),
  ('CM', 'Centimeter', 'Length in centimeters'),
  ('MM', 'Millimeter', 'Length in millimeters'),
  ('FT', 'Feet', 'Length in feet'),
  ('IN', 'Inch', 'Length in inches'),

  -- Area
  ('SQM', 'Square Meter', 'Area in square meters'),
  ('SQFT', 'Square Feet', 'Area in square feet'),

  -- Services
  ('HR', 'Hour', 'Time in hours'),
  ('DAY', 'Day', 'Time in days'),
  ('MON', 'Month', 'Time in months'),
  ('SVC', 'Service', 'Service unit')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- EXPENSE ACCOUNTS (Chart of Accounts)
-- =====================================================

-- Level 1: Main Categories
INSERT INTO expense_accounts (id, code, name, description, level) VALUES
  ('11111111-1111-1111-1111-111111111101', '5000', 'Office Supplies', 'General office supplies and stationery', 1),
  ('11111111-1111-1111-1111-111111111102', '5100', 'IT Equipment', 'Information technology equipment and software', 1),
  ('11111111-1111-1111-1111-111111111103', '5200', 'Travel & Transport', 'Travel, accommodation, and transport expenses', 1),
  ('11111111-1111-1111-1111-111111111104', '5300', 'Professional Services', 'Consulting, legal, and professional fees', 1),
  ('11111111-1111-1111-1111-111111111105', '5400', 'Utilities', 'Electricity, water, internet, and phone', 1),
  ('11111111-1111-1111-1111-111111111106', '5500', 'Maintenance & Repairs', 'Building and equipment maintenance', 1),
  ('11111111-1111-1111-1111-111111111107', '5600', 'Marketing & Communications', 'Marketing, advertising, and communications', 1),
  ('11111111-1111-1111-1111-111111111108', '5700', 'Training & Development', 'Staff training and development', 1)
ON CONFLICT (id) DO NOTHING;

-- Level 2: Sub-Categories
INSERT INTO expense_accounts (id, code, name, description, parent_id, level) VALUES
  ('22222222-2222-2222-2222-222222222201', '5001', 'Stationery', 'Pens, paper, folders, etc.', '11111111-1111-1111-1111-111111111101', 2),
  ('22222222-2222-2222-2222-222222222202', '5002', 'Printing & Copying', 'Printing and photocopying supplies', '11111111-1111-1111-1111-111111111101', 2),
  ('22222222-2222-2222-2222-222222222203', '5101', 'Computers & Laptops', 'Desktop and laptop computers', '11111111-1111-1111-1111-111111111102', 2),
  ('22222222-2222-2222-2222-222222222204', '5102', 'Software Licenses', 'Software and application licenses', '11111111-1111-1111-1111-111111111102', 2),
  ('22222222-2222-2222-2222-222222222205', '5103', 'IT Accessories', 'Keyboards, mice, monitors, etc.', '11111111-1111-1111-1111-111111111102', 2),
  ('22222222-2222-2222-2222-222222222206', '5201', 'Local Travel', 'Local transport and fuel', '11111111-1111-1111-1111-111111111103', 2),
  ('22222222-2222-2222-2222-222222222207', '5202', 'Accommodation', 'Hotel and lodging expenses', '11111111-1111-1111-1111-111111111103', 2),
  ('22222222-2222-2222-2222-222222222208', '5203', 'Per Diem', 'Daily allowances for travel', '11111111-1111-1111-1111-111111111103', 2)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- PROJECTS
-- =====================================================

INSERT INTO projects (id, code, name, description, start_date, end_date, budget) VALUES
  (
    '33333333-3333-3333-3333-333333333301',
    'MAIN',
    'Main Office Operations',
    'General operations and administration',
    '2024-01-01',
    '2024-12-31',
    50000000.00
  ),
  (
    '33333333-3333-3333-3333-333333333302',
    'DEV',
    'Software Development Project',
    'Custom software development and IT infrastructure',
    '2024-01-01',
    '2024-12-31',
    30000000.00
  ),
  (
    '33333333-3333-3333-3333-333333333303',
    'MKT',
    'Marketing Campaign 2024',
    'Annual marketing and outreach activities',
    '2024-01-01',
    '2024-12-31',
    15000000.00
  )
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- PROJECT ACCOUNTS
-- =====================================================

-- Main Office Operations
INSERT INTO project_accounts (project_id, account_id, budget_amount) VALUES
  ('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111101', 5000000.00),  -- Office Supplies
  ('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111102', 10000000.00), -- IT Equipment
  ('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111103', 8000000.00),  -- Travel
  ('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111105', 7000000.00),  -- Utilities

  -- Software Development Project
  ('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111102', 20000000.00), -- IT Equipment
  ('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111104', 10000000.00), -- Professional Services

  -- Marketing Campaign
  ('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111107', 12000000.00), -- Marketing
  ('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111101', 3000000.00)   -- Office Supplies
ON CONFLICT (project_id, account_id) DO NOTHING;

-- =====================================================
-- ITEMS (Master Catalog)
-- =====================================================

INSERT INTO items (id, code, name, description, category, default_uom_id) VALUES
  -- Office Supplies
  (
    '44444444-4444-4444-4444-444444444401',
    'ITEM-001',
    'A4 Paper - 80gsm',
    'White A4 copy paper, 80gsm, 500 sheets per ream',
    'Office Supplies',
    (SELECT id FROM uom_types WHERE code = 'PKT')
  ),
  (
    '44444444-4444-4444-4444-444444444402',
    'ITEM-002',
    'Ballpoint Pens - Blue',
    'Blue ballpoint pens, box of 50',
    'Office Supplies',
    (SELECT id FROM uom_types WHERE code = 'BOX')
  ),
  (
    '44444444-4444-4444-4444-444444444403',
    'ITEM-003',
    'Stapler',
    'Heavy duty stapler',
    'Office Supplies',
    (SELECT id FROM uom_types WHERE code = 'PCS')
  ),
  (
    '44444444-4444-4444-4444-444444444404',
    'ITEM-004',
    'Manila Folders',
    'Legal size manila folders, pack of 100',
    'Office Supplies',
    (SELECT id FROM uom_types WHERE code = 'PKT')
  ),

  -- IT Equipment
  (
    '44444444-4444-4444-4444-444444444405',
    'ITEM-005',
    'Dell Laptop - Core i5',
    'Dell Latitude 3520, Intel Core i5, 8GB RAM, 256GB SSD',
    'IT Equipment',
    (SELECT id FROM uom_types WHERE code = 'EA')
  ),
  (
    '44444444-4444-4444-4444-444444444406',
    'ITEM-006',
    'Desktop Computer',
    'HP Desktop PC, Intel Core i5, 8GB RAM, 500GB HDD, Monitor included',
    'IT Equipment',
    (SELECT id FROM uom_types WHERE code = 'SET')
  ),
  (
    '44444444-4444-4444-4444-444444444407',
    'ITEM-007',
    'USB Flash Drive - 32GB',
    'Kingston 32GB USB 3.0 Flash Drive',
    'IT Equipment',
    (SELECT id FROM uom_types WHERE code = 'PCS')
  ),
  (
    '44444444-4444-4444-4444-444444444408',
    'ITEM-008',
    'Wireless Mouse',
    'Logitech wireless optical mouse',
    'IT Equipment',
    (SELECT id FROM uom_types WHERE code = 'PCS')
  ),

  -- Services
  (
    '44444444-4444-4444-4444-444444444409',
    'ITEM-009',
    'IT Consulting Services',
    'Professional IT consulting and support',
    'Professional Services',
    (SELECT id FROM uom_types WHERE code = 'HR')
  ),
  (
    '44444444-4444-4444-4444-444444444410',
    'ITEM-010',
    'Fuel - Petrol',
    'Fuel for vehicle (per liter)',
    'Travel',
    (SELECT id FROM uom_types WHERE code = 'L')
  )
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- ACCOUNT ITEMS (Pre-approved items with pricing)
-- =====================================================

-- For Main Office - Office Supplies
INSERT INTO account_items (project_account_id, item_id, unit_price, max_quantity) VALUES
  (
    (SELECT id FROM project_accounts WHERE project_id = '33333333-3333-3333-3333-333333333301'
     AND account_id = '11111111-1111-1111-1111-111111111101'),
    '44444444-4444-4444-4444-444444444401',
    25000.00,
    100
  ),
  (
    (SELECT id FROM project_accounts WHERE project_id = '33333333-3333-3333-3333-333333333301'
     AND account_id = '11111111-1111-1111-1111-111111111101'),
    '44444444-4444-4444-4444-444444444402',
    45000.00,
    50
  ),
  (
    (SELECT id FROM project_accounts WHERE project_id = '33333333-3333-3333-3333-333333333301'
     AND account_id = '11111111-1111-1111-1111-111111111101'),
    '44444444-4444-4444-4444-444444444403',
    35000.00,
    20
  ),

  -- For Main Office - IT Equipment
  (
    (SELECT id FROM project_accounts WHERE project_id = '33333333-3333-3333-3333-333333333301'
     AND account_id = '11111111-1111-1111-1111-111111111102'),
    '44444444-4444-4444-4444-444444444405',
    3500000.00,
    5
  ),
  (
    (SELECT id FROM project_accounts WHERE project_id = '33333333-3333-3333-3333-333333333301'
     AND account_id = '11111111-1111-1111-1111-111111111102'),
    '44444444-4444-4444-4444-444444444407',
    35000.00,
    50
  ),
  (
    (SELECT id FROM project_accounts WHERE project_id = '33333333-3333-3333-3333-333333333301'
     AND account_id = '11111111-1111-1111-1111-111111111102'),
    '44444444-4444-4444-4444-444444444408',
    25000.00,
    30
  ),

  -- For Dev Project - IT Equipment
  (
    (SELECT id FROM project_accounts WHERE project_id = '33333333-3333-3333-3333-333333333302'
     AND account_id = '11111111-1111-1111-1111-111111111102'),
    '44444444-4444-4444-4444-444444444405',
    3500000.00,
    10
  ),
  (
    (SELECT id FROM project_accounts WHERE project_id = '33333333-3333-3333-3333-333333333302'
     AND account_id = '11111111-1111-1111-1111-111111111102'),
    '44444444-4444-4444-4444-444444444406',
    2800000.00,
    5
  )
ON CONFLICT (project_account_id, item_id) DO NOTHING;

-- =====================================================
-- NOTES
-- =====================================================

-- NOTE: Test users will be created when they first sign up via Supabase Auth
-- User profiles will be automatically created in the users table via trigger
-- Super admin can be assigned manually via SQL after signup:
--
-- UPDATE users SET role = 'super_admin' WHERE email = 'admin@example.com';
--
-- User project assignments should be created by super admin via the application

-- Example of how to manually create a user assignment after signup:
--
-- INSERT INTO user_project_assignments (user_id, project_id, role, assigned_by)
-- VALUES (
--   (SELECT id FROM users WHERE email = 'user@example.com'),
--   '33333333-3333-3333-3333-333333333301',
--   'submitter',
--   (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)
-- );

COMMENT ON COLUMN items.code IS 'Unique item code for catalog reference';
COMMENT ON COLUMN account_items.max_quantity IS 'Maximum quantity that can be requisitioned per transaction (NULL = unlimited)';
COMMENT ON TABLE account_items IS 'Defines which items are pre-approved for each project-account combination with pricing';
