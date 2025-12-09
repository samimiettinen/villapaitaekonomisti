# MacroData Warehouse

A private macroeconomic data warehouse with web dashboard for fetching, storing, and visualizing time series data from multiple sources.

## Run on Lovable / Publish

1. **Set up secrets in Lovable Cloud**:
   - Go to the Cloud tab → Secrets
   - Add `FRED_API_KEY` with your FRED API key (get one at https://fred.stlouisfed.org/docs/api/api_key.html)

2. **Routes**:
   - `/` — Dashboard with featured economic indicators
   - `/explore` — Data Explorer for searching and comparing series
   - `/analysis` — Multi-series analysis builder
   - `/fred` — FRED-specific explorer

3. **Publish**: Click "Publish" in Lovable to deploy both frontend and edge functions.

## Customizing Featured Indicators

Edit `src/components/dashboard/EconomicDashboard.tsx`:

```typescript
const FEATURED_INDICATORS: FeaturedIndicator[] = [
  { seriesId: "FRED_GDPC1", label: "US Real GDP", source: "FRED", currency: "USD" },
  // Add more indicators here...
];
```

The series must be ingested first via the API (use `/explore` or call `fredApi.ingest("SERIES_ID")`).

## Features

## Database Schema

### Tables

1. **series** - Time series metadata
   - `id`: Internal identifier (e.g., "FRED_GDPC1")
   - `source`: Data source ("FRED" or "STATFIN")
   - `provider_id`: Original series/table ID
   - `title`, `description`, `freq`, `unit_original`, `currency_orig`, `geo`
   - `created_at`, `updated_at`

2. **observations** - Time series data points
   - `id`: Auto-increment primary key
   - `series_id`: Foreign key to series
   - `date`: Observation date
   - `value`: Original value
   - `value_eur`, `value_usd`: Normalized values
   - `last_update`: Timestamp

3. **fx_rates** - Currency exchange rates
   - `id`: Auto-increment primary key
   - `date`: Rate date
   - `base`, `quote`: Currency pair
   - `rate`: Exchange rate
   - `source`: Rate source

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- FRED API key (get one at https://fred.stlouisfed.org/docs/api/api_key.html)

### Installation

1. Clone the repository:
```bash
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
```

2. Install dependencies:
```bash
npm install
```

3. Set up your FRED API key:
   - Go to the Cloud tab in Lovable
   - Navigate to Secrets
   - Add `FRED_API_KEY` with your API key

4. Start the development server:
```bash
npm run dev
```

The app will be available at http://localhost:8080

## Usage

### Ingesting Data

To ingest data from FRED or StatFin, use the backend edge functions:

**FRED Example:**
```typescript
import { fredApi } from "@/lib/api";

// Ingest US Real GDP (GDPC1)
await fredApi.ingest("GDPC1");
```

**StatFin Example:**
```typescript
import { statfinApi } from "@/lib/api";

// Ingest Finnish GDP data
await statfinApi.ingest("StatFin/kbar/statfin_kbar_pxt_11cc.px", {
  query: [
    {
      code: "Year",
      selection: { filter: "item", values: ["2020", "2021", "2022"] }
    }
  ],
  response: { format: "json" }
});
```

### API Endpoints

The backend provides these edge functions:

1. **fetch-fred** - FRED API integration
   - `?action=search&query=gdp` - Search series
   - `?action=metadata&seriesId=GDPC1` - Get metadata
   - `?action=observations&seriesId=GDPC1` - Get observations
   - `?action=ingest&seriesId=GDPC1` - Ingest into database

2. **fetch-statfin** - StatFin API integration
   - `?action=databases` - List databases
   - `?action=tables&databasePath=StatFin` - List tables
   - `?action=metadata&tablePath=...` - Get table metadata
   - `?action=data&tablePath=...` - Fetch table data (POST)
   - `?action=ingest&tablePath=...` - Ingest into database (POST)

### Frontend Features

- **Search**: Full-text search across series titles and IDs
- **Filters**: Filter by data source (FRED/StatFin/All)
- **Charts**: Interactive time series visualization
- **Currency**: View data in original currency, EUR, or USD
- **Date Range**: Filter observations by date range
- **Details**: View series metadata and statistics

## Data Sources

### FRED (Federal Reserve Economic Data)

- **Base URL**: https://api.stlouisfed.org/fred
- **Authentication**: API key (query parameter)
- **Coverage**: US economic indicators, financial data
- **Documentation**: https://fred.stlouisfed.org/docs/api/fred/

### Statistics Finland (StatFin)

- **Base URL**: https://pxdata.stat.fi/PXWeb/api/v1
- **Authentication**: None required (open API)
- **Coverage**: Finnish statistics, demographics, economy
- **Documentation**: https://pxdata.stat.fi/api1.html

## Currency Normalization

The system automatically normalizes values to EUR and USD:

- **USD values**: Converted to EUR using FRED series `DEXUSEU` (USD per 1 EUR)
- **EUR values**: Converted to USD using the inverse rate
- **Original values**: Stored as-is in the `value` column

## Development

### Project Structure

```
src/
├── components/         # React components
│   ├── ui/            # shadcn/ui components
│   ├── SeriesList.tsx # Series list view
│   ├── SeriesDetail.tsx # Series detail view
│   └── SeriesChart.tsx # Chart component
├── pages/
│   └── Index.tsx      # Main page
├── lib/
│   ├── api.ts         # API client
│   └── utils.ts       # Utilities
└── integrations/
    └── supabase/      # Supabase client (auto-generated)

supabase/
├── functions/         # Edge functions
│   ├── fetch-fred/    # FRED integration
│   └── fetch-statfin/ # StatFin integration
└── config.toml        # Function configuration
```

### Adding New Series

1. Use the edge functions to ingest data
2. The frontend will automatically pick up new series
3. Series appear in the search and can be filtered by source

## Deployment

Deploy via Lovable:

1. Click the **Publish** button in the top right
2. Frontend changes require clicking "Update" in the publish dialog
3. Backend changes (edge functions, database) deploy automatically

## Resources

- [Lovable Documentation](https://docs.lovable.dev/)
- [Lovable Cloud Features](https://docs.lovable.dev/features/cloud)
- [FRED API Docs](https://fred.stlouisfed.org/docs/api/fred/)
- [StatFin PxWeb API](https://pxdata.stat.fi/api1.html)

## License

MIT
