-- Fix Economy Shipping Price (50 EGP)
INSERT INTO price (id, amount, raw_amount, currency_code, rules_count, price_set_id, created_at, updated_at)
VALUES (
    'price_' || md5('so_run_econ_v2'), 
    5000, 
    '{"value": "5000", "precision": 20}', 
    'egp', 
    1, 
    'pset_a687836dc17643f29ddc4141', 
    NOW(), 
    NOW()
) ON CONFLICT DO NOTHING;

INSERT INTO price_rule (id, attribute, value, priority, price_id, created_at, updated_at)
VALUES (
    'pr_' || md5('so_rule_econ_v2'), 
    'region_id', 
    'reg_eg', 
    0, 
    'price_' || md5('so_run_econ_v2'), 
    NOW(), 
    NOW()
) ON CONFLICT DO NOTHING;

-- Fix Standard Shipping Price (100 EGP)
INSERT INTO price (id, amount, raw_amount, currency_code, rules_count, price_set_id, created_at, updated_at)
VALUES (
    'price_' || md5('so_run_std_v2'), 
    10000, 
    '{"value": "10000", "precision": 20}', 
    'egp', 
    1, 
    'pset_e6998c0439c744c3871b52ed', 
    NOW(), 
    NOW()
) ON CONFLICT DO NOTHING;

INSERT INTO price_rule (id, attribute, value, priority, price_id, created_at, updated_at)
VALUES (
    'pr_' || md5('so_rule_std_v2'), 
    'region_id', 
    'reg_eg', 
    0, 
    'price_' || md5('so_run_std_v2'), 
    NOW(), 
    NOW()
) ON CONFLICT DO NOTHING;
