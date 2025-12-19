.headers on
.mode column

-- Which FULL dealer is still missing display_name?
SELECT dealer_no, dealer_name, distributor_name, region
FROM dealers
WHERE program_status = 'FULL' AND display_name IS NULL;
