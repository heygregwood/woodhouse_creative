.headers on
.mode column

-- FULL dealers still missing Facebook Page ID
SELECT dealer_no, display_name, has_sprout
FROM dealers 
WHERE program_status = 'FULL' 
  AND (facebook_page_id IS NULL OR facebook_page_id = '')
ORDER BY display_name;

-- Current status summary
SELECT 
    SUM(CASE WHEN facebook_page_id IS NOT NULL AND facebook_page_id != '' THEN 1 ELSE 0 END) as has_fb_page_id,
    SUM(CASE WHEN has_sprout = 1 THEN 1 ELSE 0 END) as has_sprout,
    SUM(CASE WHEN creatomate_phone IS NOT NULL THEN 1 ELSE 0 END) as has_phone,
    SUM(CASE WHEN creatomate_website IS NOT NULL THEN 1 ELSE 0 END) as has_website,
    COUNT(*) as total
FROM dealers WHERE program_status = 'FULL';
