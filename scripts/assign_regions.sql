-- Auto-assign regions for FULL dealers based on distributor/state

-- G W Berkheimer (Michigan/Indiana/Illinois area) = NORTH
UPDATE dealers 
SET region = 'NORTH' 
WHERE program_status = 'FULL' 
  AND region IS NULL 
  AND distributor_name = 'G W Berkheimer Co Inc';

-- Famous Supply (Ohio) = NORTH  
UPDATE dealers
SET region = 'NORTH'
WHERE program_status = 'FULL'
  AND region IS NULL
  AND distributor_name = 'Famous Supply Co';

-- ECCO Supply (British Columbia) = CANADA
UPDATE dealers
SET region = 'CANADA'
WHERE program_status = 'FULL'
  AND region IS NULL
  AND distributor_name = 'ECCO Supply';

-- Hercules Ind (Utah - mountain west) = NORTH
UPDATE dealers
SET region = 'NORTH'
WHERE program_status = 'FULL'
  AND region IS NULL
  AND distributor_name = 'Hercules Ind';

-- Verify all FULL dealers now have regions
SELECT program_status, region, COUNT(*) as count
FROM dealers
WHERE program_status = 'FULL'
GROUP BY program_status, region;
