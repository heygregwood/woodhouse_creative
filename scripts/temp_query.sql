.headers on
.mode column

-- How many FULL dealers need display_name?
SELECT 
    SUM(CASE WHEN display_name IS NOT NULL THEN 1 ELSE 0 END) as has_display_name,
    SUM(CASE WHEN display_name IS NULL THEN 1 ELSE 0 END) as needs_display_name,
    COUNT(*) as total
FROM dealers
WHERE program_status = 'FULL';

-- Sample of FULL dealers needing display_name (with website for reference)
SELECT dealer_no, dealer_name, website
FROM dealers 
WHERE display_name IS NULL 
  AND program_status = 'FULL'
  AND website IS NOT NULL
LIMIT 15;
