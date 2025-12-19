.headers on
.mode column

-- Check dealer_contacts summary
SELECT contact_type, source, confidence, COUNT(*) as count
FROM dealer_contacts
GROUP BY contact_type, source, confidence
ORDER BY contact_type, source;

-- Sample of Google Maps imports
SELECT dealer_no, contact_type, value, confidence, notes
FROM dealer_contacts
WHERE source = 'google_maps'
LIMIT 10;

-- FULL dealers still missing creatomate_website
SELECT COUNT(*) as missing_website
FROM dealers
WHERE program_status = 'FULL' AND (creatomate_website IS NULL OR creatomate_website = '');

-- Check why - are there websites in contacts but not marked for creatomate?
SELECT dc.dealer_no, dc.value, dc.confidence, dc.use_for_creatomate
FROM dealer_contacts dc
JOIN dealers d ON dc.dealer_no = d.dealer_no
WHERE d.program_status = 'FULL'
  AND dc.contact_type = 'website'
  AND d.creatomate_website IS NULL
LIMIT 15;
