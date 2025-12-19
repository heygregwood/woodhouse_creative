-- Fix: Set use_for_creatomate for Allied API websites where no Google Maps website exists

-- First, mark Allied websites as use_for_creatomate where dealer has no creatomate website yet
UPDATE dealer_contacts
SET use_for_creatomate = 1
WHERE id IN (
    SELECT dc.id
    FROM dealer_contacts dc
    JOIN dealers d ON dc.dealer_no = d.dealer_no
    WHERE dc.contact_type = 'website'
      AND dc.source = 'allied_api'
      AND d.program_status = 'FULL'
      AND d.creatomate_website IS NULL
      AND dc.dealer_no NOT IN (
          SELECT dealer_no FROM dealer_contacts 
          WHERE contact_type = 'website' AND use_for_creatomate = 1
      )
);

-- Same for phones - use Allied turnkey phones where no Google Maps phone
UPDATE dealer_contacts
SET use_for_creatomate = 1
WHERE id IN (
    SELECT dc.id
    FROM dealer_contacts dc
    JOIN dealers d ON dc.dealer_no = d.dealer_no
    WHERE dc.contact_type = 'phone'
      AND dc.source = 'allied_api'
      AND dc.contact_subtype = 'turnkey'  -- Prefer turnkey over contact phone
      AND d.program_status = 'FULL'
      AND d.creatomate_phone IS NULL
      AND dc.dealer_no NOT IN (
          SELECT dealer_no FROM dealer_contacts 
          WHERE contact_type = 'phone' AND use_for_creatomate = 1
      )
);

-- Now update dealers table with the newly marked contacts
UPDATE dealers
SET creatomate_website = (
    SELECT value FROM dealer_contacts 
    WHERE dealer_contacts.dealer_no = dealers.dealer_no 
      AND contact_type = 'website' 
      AND use_for_creatomate = 1
    LIMIT 1
)
WHERE program_status = 'FULL'
  AND creatomate_website IS NULL
  AND dealer_no IN (
    SELECT dealer_no FROM dealer_contacts 
    WHERE contact_type = 'website' AND use_for_creatomate = 1
  );

UPDATE dealers
SET creatomate_phone = (
    SELECT value FROM dealer_contacts 
    WHERE dealer_contacts.dealer_no = dealers.dealer_no 
      AND contact_type = 'phone' 
      AND use_for_creatomate = 1
    LIMIT 1
)
WHERE program_status = 'FULL'
  AND creatomate_phone IS NULL
  AND dealer_no IN (
    SELECT dealer_no FROM dealer_contacts 
    WHERE contact_type = 'phone' AND use_for_creatomate = 1
  );

-- Summary
SELECT 
    SUM(CASE WHEN creatomate_phone IS NOT NULL THEN 1 ELSE 0 END) as has_phone,
    SUM(CASE WHEN creatomate_website IS NOT NULL THEN 1 ELSE 0 END) as has_website,
    SUM(CASE WHEN display_name IS NOT NULL THEN 1 ELSE 0 END) as has_display_name,
    COUNT(*) as total
FROM dealers
WHERE program_status = 'FULL';
