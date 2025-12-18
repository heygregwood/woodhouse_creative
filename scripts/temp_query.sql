.headers on
.mode csv

-- Dealers to add to scheduling spreadsheet
-- These 11 FULL dealers need to be added to the regional tabs
SELECT 
    dealer_no,
    dealer_name,
    distributor_name,
    city,
    state,
    region as "ADD_TO_TAB",
    turnkey_phone,
    website
FROM dealers
WHERE dealer_no IN (
    '10122026', '975', '8816', '1402', '11276', 
    '1349', '2589', '1734', '1423', '6575', 'TEMP-002'
)
ORDER BY region, dealer_name;
