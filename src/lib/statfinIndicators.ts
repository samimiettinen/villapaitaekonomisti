// StatFin Indicator Configuration
// Curated list of key Finnish economic indicators from Statistics Finland

export interface StatFinIndicator {
  id: string;
  label: string;
  labelFi: string;
  category: string;
  tablePath: string;
  unit: string;
  frequency: "Q" | "M" | "A"; // Quarterly, Monthly, Annual
  description: string;
  query: {
    code: string;
    selection: {
      filter: string;
      values: string[];
    };
  }[];
}

export const STATFIN_INDICATORS: StatFinIndicator[] = [
  // GDP and National Accounts
  {
    id: "fin_gdp_volume_q",
    label: "GDP, volume index (2015=100), quarterly",
    labelFi: "BKT, volyymi-indeksi (2015=100), neljännesvuosi",
    category: "National Accounts",
    tablePath: "StatFin/kan/ntp/statfin_ntp_pxt_132h.px",
    unit: "Index (2015=100)",
    frequency: "Q",
    description: "Finland's gross domestic product volume index, seasonally adjusted",
    query: [
      {
        code: "Taloustoimi",
        selection: {
          filter: "item",
          values: ["B1GMH"] // GDP market prices
        }
      },
      {
        code: "Tiedot",
        selection: {
          filter: "item",
          values: ["indeksi_tvk"] // Volume index, seasonally adjusted
        }
      }
    ]
  },
  {
    id: "fin_gdp_current_q",
    label: "GDP, current prices (million EUR), quarterly",
    labelFi: "BKT, käypiin hintoihin (milj. EUR), neljännesvuosi",
    category: "National Accounts",
    tablePath: "StatFin/kan/ntp/statfin_ntp_pxt_132h.px",
    unit: "Million EUR",
    frequency: "Q",
    description: "Finland's gross domestic product at current prices",
    query: [
      {
        code: "Taloustoimi",
        selection: {
          filter: "item",
          values: ["B1GMH"]
        }
      },
      {
        code: "Tiedot",
        selection: {
          filter: "item",
          values: ["kausitasoitettu"] // Seasonally adjusted, current prices
        }
      }
    ]
  },
  // Employment
  {
    id: "fin_employment_rate_m",
    label: "Employment rate (%), monthly",
    labelFi: "Työllisyysaste (%), kuukausi",
    category: "Labour Market",
    tablePath: "StatFin/tym/tyti/statfin_tyti_pxt_135z.px",
    unit: "%",
    frequency: "M",
    description: "Employment rate of population aged 15-64, trend",
    query: [
      {
        code: "Sukupuoli",
        selection: {
          filter: "item",
          values: ["SSS"] // Both sexes
        }
      },
      {
        code: "Tiedot",
        selection: {
          filter: "item",
          values: ["Työllisyysaste_t"] // Employment rate, trend
        }
      }
    ]
  },
  {
    id: "fin_unemployment_rate_m",
    label: "Unemployment rate (%), monthly",
    labelFi: "Työttömyysaste (%), kuukausi",
    category: "Labour Market",
    tablePath: "StatFin/tym/tyti/statfin_tyti_pxt_135z.px",
    unit: "%",
    frequency: "M",
    description: "Unemployment rate, trend",
    query: [
      {
        code: "Sukupuoli",
        selection: {
          filter: "item",
          values: ["SSS"]
        }
      },
      {
        code: "Tiedot",
        selection: {
          filter: "item",
          values: ["Työttömyysaste_t"] // Unemployment rate, trend
        }
      }
    ]
  },
  // Foreign Trade
  {
    id: "fin_exports_q",
    label: "Exports of goods and services (million EUR), quarterly",
    labelFi: "Tavaroiden ja palveluiden vienti (milj. EUR), neljännesvuosi",
    category: "Foreign Trade",
    tablePath: "StatFin/kan/ntp/statfin_ntp_pxt_132h.px",
    unit: "Million EUR",
    frequency: "Q",
    description: "Total exports of goods and services",
    query: [
      {
        code: "Taloustoimi",
        selection: {
          filter: "item",
          values: ["P6"] // Exports
        }
      },
      {
        code: "Tiedot",
        selection: {
          filter: "item",
          values: ["kausitasoitettu"]
        }
      }
    ]
  },
  {
    id: "fin_imports_q",
    label: "Imports of goods and services (million EUR), quarterly",
    labelFi: "Tavaroiden ja palveluiden tuonti (milj. EUR), neljännesvuosi",
    category: "Foreign Trade",
    tablePath: "StatFin/kan/ntp/statfin_ntp_pxt_132h.px",
    unit: "Million EUR",
    frequency: "Q",
    description: "Total imports of goods and services",
    query: [
      {
        code: "Taloustoimi",
        selection: {
          filter: "item",
          values: ["P7"] // Imports
        }
      },
      {
        code: "Tiedot",
        selection: {
          filter: "item",
          values: ["kausitasoitettu"]
        }
      }
    ]
  },
  // Government Finance
  {
    id: "fin_gov_expenditure_q",
    label: "General government expenditure (million EUR), quarterly",
    labelFi: "Julkisyhteisöjen menot (milj. EUR), neljännesvuosi",
    category: "Government Finance",
    tablePath: "StatFin/kan/jynt/statfin_jynt_pxt_12bs.px",
    unit: "Million EUR",
    frequency: "Q",
    description: "Total general government expenditure",
    query: [
      {
        code: "Sektori",
        selection: {
          filter: "item",
          values: ["S13"] // General government
        }
      },
      {
        code: "Taloustoimi",
        selection: {
          filter: "item",
          values: ["OTE"] // Total expenditure
        }
      },
      {
        code: "Tiedot",
        selection: {
          filter: "item",
          values: ["Kausi_milj"]
        }
      }
    ]
  },
  {
    id: "fin_gov_revenue_q",
    label: "General government revenue (million EUR), quarterly",
    labelFi: "Julkisyhteisöjen tulot (milj. EUR), neljännesvuosi",
    category: "Government Finance",
    tablePath: "StatFin/kan/jynt/statfin_jynt_pxt_12bs.px",
    unit: "Million EUR",
    frequency: "Q",
    description: "Total general government revenue",
    query: [
      {
        code: "Sektori",
        selection: {
          filter: "item",
          values: ["S13"]
        }
      },
      {
        code: "Taloustoimi",
        selection: {
          filter: "item",
          values: ["OTR"] // Total revenue
        }
      },
      {
        code: "Tiedot",
        selection: {
          filter: "item",
          values: ["Kausi_milj"]
        }
      }
    ]
  },
  // Prices and Inflation
  {
    id: "fin_cpi_m",
    label: "Consumer Price Index (2015=100), monthly",
    labelFi: "Kuluttajahintaindeksi (2015=100), kuukausi",
    category: "Prices",
    tablePath: "StatFin/hin/khi/statfin_khi_pxt_11xq.px",
    unit: "Index (2015=100)",
    frequency: "M",
    description: "Consumer price index, all items",
    query: [
      {
        code: "Hyödyke",
        selection: {
          filter: "item",
          values: ["0"] // All items
        }
      },
      {
        code: "Tiedot",
        selection: {
          filter: "item",
          values: ["indeksipisteluku"]
        }
      }
    ]
  },
  {
    id: "fin_inflation_yoy_m",
    label: "Inflation rate (% YoY), monthly",
    labelFi: "Inflaatio (% vuosimuutos), kuukausi",
    category: "Prices",
    tablePath: "StatFin/hin/khi/statfin_khi_pxt_11xq.px",
    unit: "%",
    frequency: "M",
    description: "Year-on-year change in consumer price index",
    query: [
      {
        code: "Hyödyke",
        selection: {
          filter: "item",
          values: ["0"]
        }
      },
      {
        code: "Tiedot",
        selection: {
          filter: "item",
          values: ["vuosimuutos"]
        }
      }
    ]
  },
  // Private Consumption
  {
    id: "fin_private_consumption_q",
    label: "Private consumption (million EUR), quarterly",
    labelFi: "Yksityinen kulutus (milj. EUR), neljännesvuosi",
    category: "National Accounts",
    tablePath: "StatFin/kan/ntp/statfin_ntp_pxt_132h.px",
    unit: "Million EUR",
    frequency: "Q",
    description: "Private final consumption expenditure",
    query: [
      {
        code: "Taloustoimi",
        selection: {
          filter: "item",
          values: ["P31_S14"] // Private consumption
        }
      },
      {
        code: "Tiedot",
        selection: {
          filter: "item",
          values: ["kausitasoitettu"]
        }
      }
    ]
  },
  // Investment
  {
    id: "fin_investment_q",
    label: "Gross fixed capital formation (million EUR), quarterly",
    labelFi: "Kiinteän pääoman bruttomuodostus (milj. EUR), neljännesvuosi",
    category: "National Accounts",
    tablePath: "StatFin/kan/ntp/statfin_ntp_pxt_132h.px",
    unit: "Million EUR",
    frequency: "Q",
    description: "Gross fixed capital formation (investment)",
    query: [
      {
        code: "Taloustoimi",
        selection: {
          filter: "item",
          values: ["P51"] // Gross fixed capital formation
        }
      },
      {
        code: "Tiedot",
        selection: {
          filter: "item",
          values: ["kausitasoitettu"]
        }
      }
    ]
  }
];

// Helper functions
export function listAvailableIndicators(): { id: string; label: string; category: string }[] {
  return STATFIN_INDICATORS.map(ind => ({
    id: ind.id,
    label: ind.label,
    category: ind.category
  }));
}

export function getIndicatorById(id: string): StatFinIndicator | undefined {
  return STATFIN_INDICATORS.find(ind => ind.id === id);
}

export function getIndicatorsByCategory(category: string): StatFinIndicator[] {
  return STATFIN_INDICATORS.filter(ind => ind.category === category);
}

export function getCategories(): string[] {
  return [...new Set(STATFIN_INDICATORS.map(ind => ind.category))];
}

export function getIndicatorQueryConfig(id: string): { tablePath: string; query: any } | null {
  const indicator = getIndicatorById(id);
  if (!indicator) return null;
  
  return {
    tablePath: indicator.tablePath,
    query: {
      query: indicator.query,
      response: { format: "json" }
    }
  };
}
