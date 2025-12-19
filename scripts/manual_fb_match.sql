-- Manual matches for dealers with different name spellings
-- Based on comparing unmatched Sprout profiles with FULL dealers missing FB

-- 2B COOL Services (dealer) = 2B COOL Services, LLC (Sprout)
UPDATE dealers SET facebook_page_id = '2309899172383146', sprout_profile = '5811862', has_sprout = 1
WHERE dealer_no = '10020099';

-- Advanced Air Solutions Systems (dealer) = Advanced Air Solutions Systems, Inc. (Sprout)  
UPDATE dealers SET facebook_page_id = '936006579869191', sprout_profile = '6244444', has_sprout = 1
WHERE dealer_no = '10019203';

-- Air 911 Heating and Cooling LLC (dealer) = Air 911Heating and Cooling (Sprout)
UPDATE dealers SET facebook_page_id = '221857534338705', sprout_profile = '6986705', has_sprout = 1
WHERE dealer_no = '10405016';

-- B and C Plumbing and Heating (dealer) = B and C Plumbing & Heating (Sprout)
UPDATE dealers SET facebook_page_id = '161871333842741', sprout_profile = '4895494', has_sprout = 1
WHERE dealer_no = '107895';

-- B and G Mechanical LLC (dealer) = B&G Mechanical LLC (Sprout)
UPDATE dealers SET facebook_page_id = '105494734810221', sprout_profile = '5606191', has_sprout = 1
WHERE dealer_no = '10216002';

-- H and H Plumbing, Heating and Cooling (dealer) = H & H Plumbing Heating and Cooling (Sprout)
UPDATE dealers SET facebook_page_id = '162470807106058', sprout_profile = '4439018', has_sprout = 1
WHERE dealer_no = '975';

-- Justin Time Plumbing and Heating (dealer) = JustinTime Plumbing & Heating (Sprout)
UPDATE dealers SET facebook_page_id = '109777295337434', sprout_profile = '5570954', has_sprout = 1
WHERE dealer_no = '105819';

-- NC Heating and Air (dealer) = NC Heating & Air - Your HVAC Friend (Sprout)
UPDATE dealers SET facebook_page_id = '134223643103809', sprout_profile = '6574653', has_sprout = 1
WHERE dealer_no = '10372033';

-- O T T Mechanical (dealer) = O T T Mechanical LLC (Sprout)
UPDATE dealers SET facebook_page_id = '316164725410233', sprout_profile = '4606736', has_sprout = 1
WHERE dealer_no = '106257';

-- R and P Heating and Cooling (dealer) = R & P Heating & Cooling (Sprout)
UPDATE dealers SET facebook_page_id = '284677414607', sprout_profile = '4663234', has_sprout = 1
WHERE dealer_no = '2589';

-- Check remaining
SELECT dealer_no, display_name, has_sprout
FROM dealers 
WHERE program_status = 'FULL' 
  AND (facebook_page_id IS NULL OR facebook_page_id = '')
ORDER BY display_name;
