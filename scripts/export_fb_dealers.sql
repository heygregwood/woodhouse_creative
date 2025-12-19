.mode json
.output /home/heygregwood/woodhouse_creative/data/apify/facebook_scraper_input.json

SELECT 
    d.dealer_no,
    d.display_name,
    d.city,
    d.state,
    dc.value as facebook_url
FROM dealers d
LEFT JOIN dealer_contacts dc ON d.dealer_no = dc.dealer_no AND dc.contact_subtype = 'facebook'
WHERE d.program_status = 'FULL'
  AND (d.creatomate_website IS NULL OR d.creatomate_website = '')
ORDER BY d.display_name;

.output stdout
