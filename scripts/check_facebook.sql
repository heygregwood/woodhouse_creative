.headers on
.mode column

-- Summary of FULL dealers
SELECT 
    SUM(CASE WHEN creatomate_phone IS NOT NULL THEN 1 ELSE 0 END) as has_phone,
    SUM(CASE WHEN creatomate_website IS NOT NULL THEN 1 ELSE 0 END) as has_website,
    COUNT(*) as total
FROM dealers WHERE program_status = 'FULL';

-- Facebook pages we found
SELECT COUNT(*) as facebook_pages_found FROM dealer_contacts WHERE contact_subtype = 'facebook';

-- All social links by type
SELECT contact_subtype, COUNT(*) as count 
FROM dealer_contacts 
WHERE contact_type = 'social' 
GROUP BY contact_subtype;

-- Dealers missing website - do they have Facebook?
SELECT d.dealer_no, d.display_name, dc.value as facebook_url
FROM dealers d
LEFT JOIN dealer_contacts dc ON d.dealer_no = dc.dealer_no AND dc.contact_subtype = 'facebook'
WHERE d.program_status = 'FULL'
  AND (d.creatomate_website IS NULL OR d.creatomate_website = '')
ORDER BY d.display_name;
