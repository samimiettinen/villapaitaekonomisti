import { useState } from "react";
import { RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { FeaturedIndicatorCard, FeaturedIndicator } from "./FeaturedIndicatorCard";
import { fredApi, statfinApi, ecbApi } from "@/lib/api";

// Featured indicators configuration
// To add new indicators:
// 1. Add an entry here with the series_id from your database
// 2. The series must already be ingested via the edge functions
const FEATURED_INDICATORS: FeaturedIndicator[] = [
  {
    seriesId: "FRED_GDPC1",
    label: "US Real GDP",
    source: "FRED",
    currency: "USD",
  },
  {
    seriesId: "STATFIN_GDP",
    label: "Finnish GDP",
    source: "STATFIN",
    currency: "EUR",
  },
  {
    seriesId: "FRED_CPIAUCSL",
    label: "US Consumer Price Index",
    source: "FRED",
    currency: "original",
    isInflationIndex: true,
  },
  {
    seriesId: "STATFIN_CPI",
    label: "Finnish CPI",
    source: "STATFIN",
    currency: "original",
    isInflationIndex: true,
  },
  {
    seriesId: "FRED_UNRATE",
    label: "US Unemployment Rate",
    source: "FRED",
    currency: "original",
  },
  {
    seriesId: "STATFIN_UNEMPLOYMENT",
    label: "Finnish Unemployment Rate",
    source: "STATFIN",
    currency: "original",
  },
  {
    seriesId: "FRED_FEDFUNDS",
    label: "Federal Funds Rate",
    source: "FRED",
    currency: "original",
  },
  {
    seriesId: "ECB_EURIBOR_3M",
    label: "3-Month Euribor",
    source: "ECB",
    currency: "original",
  },
  {
    seriesId: "ECB_DFR",
    label: "ECB Deposit Facility Rate",
    source: "ECB",
    currency: "original",
  },
  {
    seriesId: "FRED_DGS10",
    label: "10-Year Treasury Yield",
    source: "FRED",
    currency: "original",
  },
  {
    seriesId: "FRED_DEXUSEU",
    label: "EUR/USD Exchange Rate",
    source: "FRED",
    currency: "original",
  },
];

// FRED series IDs for refresh functionality
const FRED_SERIES_IDS = ["GDPC1", "CPIAUCSL", "UNRATE", "FEDFUNDS", "DGS10", "DEXUSEU"];

// StatFin ingest configurations - use Finnish language API for Finnish codes
const STATFIN_CONFIGS = [
  {
    // Quarterly GDP table - use correct StatFin variable codes
    tablePath: "StatFin/ntp/statfin_ntp_pxt_132h.px",
    seriesId: "STATFIN_GDP",
    title: "Finnish GDP, quarterly, million EUR",
    language: "fi",
    query: {
      query: [
        { code: "Vuosineljännes", selection: { filter: "all", values: ["*"] } }, // All quarters
        { code: "Taloustoimi", selection: { filter: "item", values: ["B1GMH"] } }, // GDP at market prices
        { code: "Tiedot", selection: { filter: "item", values: ["tasmcp"] } } // Original series, current prices, million EUR
      ],
      response: { format: "json" }
    }
  },
  {
    tablePath: "StatFin/khi/statfin_khi_pxt_11xb.px",
    seriesId: "STATFIN_CPI",
    title: "Finnish Consumer Price Index (2015=100)",
    language: "fi",
    query: {
      query: [
        { code: "Hyödyke", selection: { filter: "item", values: ["0"] } },
        { code: "Tiedot", selection: { filter: "item", values: ["indeksipisteluku"] } }
      ],
      response: { format: "json" }
    }
  },
  {
    // Monthly unemployment - table 135z has Kuukausi and Tiedot only
    tablePath: "StatFin/tyti/statfin_tyti_pxt_135z.px",
    seriesId: "STATFIN_UNEMPLOYMENT",
    title: "Finnish Unemployment Rate, %",
    language: "fi",
    query: {
      query: [
        { code: "Tiedot", selection: { filter: "item", values: ["Työttömyysaste"] } } // Unemployment rate
      ],
      response: { format: "json" }
    }
  }
];

// ECB ingest configurations - use correct series keys
const ECB_CONFIGS = [
  {
    dataflowId: "FM",
    seriesKey: "M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA", // 3-month Euribor monthly average
    seriesId: "ECB_EURIBOR_3M",
    title: "3-Month Euribor Rate"
  },
  {
    dataflowId: "FM",
    seriesKey: "B.U2.EUR.4F.KR.DFR.LEV", // ECB Deposit Facility Rate
    seriesId: "ECB_DFR",
    title: "ECB Deposit Facility Rate"
  }
];

// For backwards compatibility
const STATFIN_GDP_CONFIG = STATFIN_CONFIGS[0];

export const EconomicDashboard = () => {
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const handleRefreshData = async () => {
    setRefreshing(true);
    let successCount = 0;
    let errorCount = 0;

    // Helper to add delay between calls to avoid overwhelming edge functions
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      // Refresh FRED indicators sequentially with delays to avoid resource limits
      for (const seriesId of FRED_SERIES_IDS) {
        try {
          console.log(`Refreshing ${seriesId}...`);
          await fredApi.ingest(seriesId);
          successCount++;
          await delay(2000);
        } catch (err) {
          console.error(`Failed to refresh ${seriesId}:`, err);
          errorCount++;
          await delay(3000);
        }
      }

      // Refresh StatFin indicators
      for (const config of STATFIN_CONFIGS) {
        try {
          console.log(`Refreshing ${config.seriesId}...`);
          await statfinApi.ingest(
            config.tablePath,
            config.query,
            config.seriesId,
            config.title,
            config.language
          );
          successCount++;
          await delay(2000);
        } catch (err) {
          console.error(`Failed to refresh ${config.seriesId}:`, err);
          errorCount++;
          await delay(3000);
        }
      }

      // Refresh ECB indicators with custom series IDs
      for (const config of ECB_CONFIGS) {
        try {
          console.log(`Refreshing ${config.seriesId}...`);
          await ecbApi.ingest(config.dataflowId, config.seriesKey, config.title, config.seriesId);
          successCount++;
          await delay(2000);
        } catch (err) {
          console.error(`Failed to refresh ${config.seriesId}:`, err);
          errorCount++;
          await delay(3000);
        }
      }

      if (errorCount === 0) {
        toast({
          title: "Data refreshed successfully",
          description: `Updated ${successCount} indicators from FRED, StatFin, and ECB.`,
        });
      } else {
        toast({
          title: "Partial refresh",
          description: `Updated ${successCount} indicators, ${errorCount} failed.`,
          variant: "destructive",
        });
      }

      // Trigger a page reload to show new data
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      toast({
        title: "Refresh failed",
        description: err.message || "Could not refresh data",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Economic Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Key macroeconomic indicators updated from FRED, StatFin, and ECB
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleRefreshData} 
          disabled={refreshing}
          className="self-start"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? "Refreshing..." : "Refresh Data"}
        </Button>
      </div>

      {/* Featured Indicators Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURED_INDICATORS.map((indicator) => (
          <FeaturedIndicatorCard key={indicator.seriesId} indicator={indicator} />
        ))}
      </div>

      {/* Help Card */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">About This Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            This dashboard displays key economic indicators from the Federal Reserve Economic Data (FRED), 
            Statistics Finland (StatFin), and the European Central Bank (ECB) databases.
          </p>
          <p>
            Each card shows the latest value, percentage change from the previous period, and a sparkline 
            visualization of recent trends. Click "Refresh Data" to fetch the latest values.
          </p>
          <p>
            For detailed analysis and custom queries, use the <strong>Data Explorer</strong> tab.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export { FEATURED_INDICATORS, FRED_SERIES_IDS, STATFIN_CONFIGS, ECB_CONFIGS, STATFIN_GDP_CONFIG };
