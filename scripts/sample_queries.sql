.headers on
.mode column

-- Sample FULL dealers
SELECT dealer_no, dealer_name, program_status, region, distributor_name 
FROM dealers 
WHERE program_status = 'FULL' 
LIMIT 10;

-- Dealers needing validation (missing phone, url, or website)
SELECT COUNT(*) as needs_validation
FROM dealers 
WHERE turnkey_phone IS NULL OR turnkey_phone = ''
   OR turnkey_url IS NULL OR turnkey_url = ''
   OR website IS NULL OR website = '';

-- FULL dealers without region assigned
SELECT dealer_no, dealer_name, distributor_name
FROM dealers
WHERE program_status = 'FULL' AND region IS NULL
LIMIT 15;
