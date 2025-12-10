// StatFin Indicator Configuration
// Curated list of key Finnish economic indicators from Statistics Finland
// Updated to match actual PxWeb API variable codes and values

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
  // GDP and National Accounts (from statfin_ntp_pxt_132h.px)
  // Variables: Vuosineljännes (time), Taloustoimi, Tiedot
  {
    id: "fin_gdp_volume_q",
    label: "GDP, seasonally adjusted volume (ref. 2015), quarterly",
    labelFi: "BKT, kausitasoitettu volyymi (viite 2015), neljännesvuosi",
    category: "National Accounts",
    tablePath: "StatFin/ntp/statfin_ntp_pxt_132h.px",
    unit: "Million EUR (2015 prices)",
    frequency: "Q",
    description: "Finland's gross domestic product, seasonally adjusted, reference year 2015",
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
          values: ["kausitvv2015"] // Seasonally adjusted, reference year 2015
        }
      }
    ]
  },
  {
    id: "fin_gdp_current_q",
    label: "GDP, seasonally adjusted current prices (million EUR), quarterly",
    labelFi: "BKT, kausitasoitettu käypiin hintoihin (milj. EUR), neljännesvuosi",
    category: "National Accounts",
    tablePath: "StatFin/ntp/statfin_ntp_pxt_132h.px",
    unit: "Million EUR",
    frequency: "Q",
    description: "Finland's gross domestic product at current prices, seasonally adjusted",
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
          values: ["kausitcp"] // Seasonally adjusted, current prices
        }
      }
    ]
  },
  // Employment (from statfin_tyti_pxt_135z.px)
  // Variables: Kuukausi (time), Tiedot
  // NOTE: This table does NOT have Sukupuoli variable - it's a key indicators summary table
  {
    id: "fin_employment_rate_m",
    label: "Employment rate 15-64 (%), trend, monthly",
    labelFi: "Työllisyysaste 15-64 (%), trendi, kuukausi",
    category: "Labour Market",
    tablePath: "StatFin/tyti/statfin_tyti_pxt_135z.px",
    unit: "%",
    frequency: "M",
    description: "Employment rate of population aged 15-64, trend",
    query: [
      {
        code: "Tiedot",
        selection: {
          filter: "item",
          values: ["tyollaste_15_64_trendi"] // Employment rate 15-64, trend
        }
      }
    ]
  },
  {
    id: "fin_unemployment_rate_m",
    label: "Unemployment rate (%), trend, monthly",
    labelFi: "Työttömyysaste (%), trendi, kuukausi",
    category: "Labour Market",
    tablePath: "StatFin/tyti/statfin_tyti_pxt_135z.px",
    unit: "%",
    frequency: "M",
    description: "Unemployment rate, trend",
    query: [
      {
        code: "Tiedot",
        selection: {
          filter: "item",
          values: ["tyottaste_trendi"] // Unemployment rate, trend
        }
      }
    ]
  },
  {
    id: "fin_employed_m",
    label: "Employed persons (1000), trend, monthly",
    labelFi: "Työlliset (1000 henkeä), trendi, kuukausi",
    category: "Labour Market",
    tablePath: "StatFin/tyti/statfin_tyti_pxt_135z.px",
    unit: "1000 persons",
    frequency: "M",
    description: "Number of employed persons, trend",
    query: [
      {
        code: "Tiedot",
        selection: {
          filter: "item",
          values: ["tyolliset_trendi"] // Employed, trend
        }
      }
    ]
  },
  {
    id: "fin_unemployed_m",
    label: "Unemployed persons (1000), trend, monthly",
    labelFi: "Työttömät (1000 henkeä), trendi, kuukausi",
    category: "Labour Market",
    tablePath: "StatFin/tyti/statfin_tyti_pxt_135z.px",
    unit: "1000 persons",
    frequency: "M",
    description: "Number of unemployed persons, trend",
    query: [
      {
        code: "Tiedot",
        selection: {
          filter: "item",
          values: ["tyottomat_trendi"] // Unemployed, trend
        }
      }
    ]
  },
  // Foreign Trade (from statfin_ntp_pxt_132h.px)
  {
    id: "fin_exports_q",
    label: "Exports of goods and services (million EUR), quarterly",
    labelFi: "Tavaroiden ja palveluiden vienti (milj. EUR), neljännesvuosi",
    category: "Foreign Trade",
    tablePath: "StatFin/ntp/statfin_ntp_pxt_132h.px",
    unit: "Million EUR",
    frequency: "Q",
    description: "Total exports of goods and services, seasonally adjusted",
    query: [
      {
        code: "Taloustoimi",
        selection: {
          filter: "item",
          values: ["P6K"] // Exports of goods and services, expenditure
        }
      },
      {
        code: "Tiedot",
        selection: {
          filter: "item",
          values: ["kausitcp"] // Seasonally adjusted, current prices
        }
      }
    ]
  },
  {
    id: "fin_imports_q",
    label: "Imports of goods and services (million EUR), quarterly",
    labelFi: "Tavaroiden ja palveluiden tuonti (milj. EUR), neljännesvuosi",
    category: "Foreign Trade",
    tablePath: "StatFin/ntp/statfin_ntp_pxt_132h.px",
    unit: "Million EUR",
    frequency: "Q",
    description: "Total imports of goods and services, seasonally adjusted",
    query: [
      {
        code: "Taloustoimi",
        selection: {
          filter: "item",
          values: ["P7R"] // Imports of goods and services, income
        }
      },
      {
        code: "Tiedot",
        selection: {
          filter: "item",
          values: ["kausitcp"]
        }
      }
    ]
  },
  // Private Consumption (from statfin_ntp_pxt_132h.px)
  {
    id: "fin_private_consumption_q",
    label: "Private consumption (million EUR), quarterly",
    labelFi: "Yksityinen kulutus (milj. EUR), neljännesvuosi",
    category: "National Accounts",
    tablePath: "StatFin/ntp/statfin_ntp_pxt_132h.px",
    unit: "Million EUR",
    frequency: "Q",
    description: "Private final consumption expenditure, seasonally adjusted",
    query: [
      {
        code: "Taloustoimi",
        selection: {
          filter: "item",
          values: ["P3KS14_S15"] // Private consumption expenditure (S14+S15)
        }
      },
      {
        code: "Tiedot",
        selection: {
          filter: "item",
          values: ["kausitcp"]
        }
      }
    ]
  },
  // Investment (from statfin_ntp_pxt_132h.px)
  {
    id: "fin_investment_q",
    label: "Gross fixed capital formation (million EUR), quarterly",
    labelFi: "Kiinteän pääoman bruttomuodostus (milj. EUR), neljännesvuosi",
    category: "National Accounts",
    tablePath: "StatFin/ntp/statfin_ntp_pxt_132h.px",
    unit: "Million EUR",
    frequency: "Q",
    description: "Gross fixed capital formation (investment), seasonally adjusted",
    query: [
      {
        code: "Taloustoimi",
        selection: {
          filter: "item",
          values: ["P51K"] // Gross fixed capital formation, expenditure
        }
      },
      {
        code: "Tiedot",
        selection: {
          filter: "item",
          values: ["kausitcp"]
        }
      }
    ]
  },
  // GDP Growth Rate
  {
    id: "fin_gdp_growth_qoq",
    label: "GDP growth (% QoQ), quarterly",
    labelFi: "BKT:n kasvu (% edell. neljänneksestä), neljännesvuosi",
    category: "National Accounts",
    tablePath: "StatFin/ntp/statfin_ntp_pxt_132h.px",
    unit: "%",
    frequency: "Q",
    description: "GDP volume change from previous quarter, seasonally adjusted",
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
          values: ["vol_kk_kausitvv2015"] // Change from previous quarter
        }
      }
    ]
  },
  {
    id: "fin_gdp_growth_yoy",
    label: "GDP growth (% YoY), quarterly",
    labelFi: "BKT:n kasvu (% edell. vuodesta), neljännesvuosi",
    category: "National Accounts",
    tablePath: "StatFin/ntp/statfin_ntp_pxt_132h.px",
    unit: "%",
    frequency: "Q",
    description: "GDP volume change from previous year, seasonally adjusted",
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
          values: ["vol_vv_kausitvv2015"] // Change from previous year
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

export function getIndicatorQueryConfig(id: string): { tablePath: string; query: { query: typeof STATFIN_INDICATORS[0]['query']; response: { format: string } } } | null {
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
