.headers on
.mode column

-- Logo status for FULL dealers
SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN creatomate_logo IS NOT NULL AND creatomate_logo != '' THEN 1 ELSE 0 END) as has_logo,
    SUM(CASE WHEN creatomate_logo IS NULL OR creatomate_logo = '' THEN 1 ELSE 0 END) as needs_logo
FROM dealers WHERE program_status = 'FULL';

-- List dealers missing logo
SELECT dealer_no, display_name, dealer_city, dealer_state
FROM dealers 
WHERE program_status = 'FULL'
  AND (creatomate_logo IS NULL OR creatomate_logo = '')
ORDER BY display_name;
