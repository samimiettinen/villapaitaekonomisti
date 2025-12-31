-- Drop the existing constraint and add ECB to allowed sources
ALTER TABLE public.series DROP CONSTRAINT IF EXISTS series_source_check;

ALTER TABLE public.series ADD CONSTRAINT series_source_check 
  CHECK (source = ANY (ARRAY['FRED'::text, 'STATFIN'::text, 'ECB'::text, 'EUROSTAT'::text, 'OECD'::text, 'WORLDBANK'::text]));