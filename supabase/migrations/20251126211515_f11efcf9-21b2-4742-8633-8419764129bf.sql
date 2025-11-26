-- Create series table for storing metadata about time series
CREATE TABLE public.series (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('FRED', 'STATFIN')),
  provider_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  freq TEXT,
  unit_original TEXT,
  currency_orig TEXT,
  geo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source, provider_id)
);

-- Create observations table for storing time series data points
CREATE TABLE public.observations (
  id BIGSERIAL PRIMARY KEY,
  series_id TEXT NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  value NUMERIC,
  value_eur NUMERIC,
  value_usd NUMERIC,
  last_update TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(series_id, date)
);

-- Create fx_rates table for currency conversion
CREATE TABLE public.fx_rates (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  base TEXT NOT NULL,
  quote TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  source TEXT,
  UNIQUE(date, base, quote)
);

-- Create indexes for better query performance
CREATE INDEX idx_observations_series_id ON public.observations(series_id);
CREATE INDEX idx_observations_date ON public.observations(date);
CREATE INDEX idx_fx_rates_date ON public.fx_rates(date);
CREATE INDEX idx_series_source ON public.series(source);

-- Enable RLS on all tables (we'll make them publicly readable for this data warehouse)
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (data warehouse use case)
CREATE POLICY "Allow public read access to series"
  ON public.series FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to observations"
  ON public.observations FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to fx_rates"
  ON public.fx_rates FOR SELECT
  USING (true);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating timestamps on series
CREATE TRIGGER update_series_updated_at
  BEFORE UPDATE ON public.series
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();