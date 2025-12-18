-- Add display_name column for creative automation
-- dealer_name = Allied API name (ALL CAPS, with &)
-- display_name = Clean name for posts/folders (proper case, no &)

ALTER TABLE dealers ADD COLUMN display_name TEXT;

-- Update the 10 dealers you just provided
UPDATE dealers SET display_name = 'All Temp Heating and Cooling' WHERE dealer_no = '8816';
UPDATE dealers SET display_name = 'Dunwiddie Heating and Air Conditioning' WHERE dealer_no = '1402';
UPDATE dealers SET display_name = 'Eco Systems Heating and Air' WHERE dealer_no = 'TEMP-002';
UPDATE dealers SET display_name = 'H and H Plumbing, Heating and Cooling' WHERE dealer_no = '975';
UPDATE dealers SET display_name = 'H.E.R.O. Heating and Air Conditioning' WHERE dealer_no = '1734';
UPDATE dealers SET display_name = 'KMK Heating and Air Conditioning' WHERE dealer_no = '11276';
UPDATE dealers SET display_name = 'Krooswyk Plumbing and Heating' WHERE dealer_no = '1349';
UPDATE dealers SET display_name = 'R and P Heating and Cooling' WHERE dealer_no = '2589';
UPDATE dealers SET display_name = 'Standard Plumbing, Heating, and AC' WHERE dealer_no = '1423';
UPDATE dealers SET display_name = 'Unique Heating and Cooling' WHERE dealer_no = '6575';

-- Verify
SELECT dealer_no, dealer_name, display_name 
FROM dealers 
WHERE display_name IS NOT NULL;
