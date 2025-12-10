// StatFin PxWeb Response Transformation Utility
// Converts raw PxWeb API responses into normalized table structures

import { StatFinDataResponse, StatFinTableMetadata, StatFinVariable } from './statfinPxweb';

export interface StatFinColumnDef {
  id: string;
  code: string;
  label: string;
  type: 'dimension' | 'time' | 'value';
}

export interface StatFinRow {
  id: string;
  dimensions: Record<string, string>;
  dimensionLabels: Record<string, string>;
  time: string;
  timeLabel: string;
  value: number | null;
}

export interface StatFinTableData {
  columns: StatFinColumnDef[];
  rows: StatFinRow[];
  metadata: {
    title: string;
    updated?: string;
    source?: string;
    unit?: string;
    timeVariable?: string;
  };
}

/**
 * Transform PxWeb API response and metadata into normalized table data
 */
export function transformPxWebResponse(
  response: StatFinDataResponse,
  metadata: StatFinTableMetadata
): StatFinTableData {
  const columns: StatFinColumnDef[] = [];
  const rows: StatFinRow[] = [];
  
  // Find time variable
  const timeVarIndex = findTimeVariableIndex(metadata.variables);
  const timeVariable = timeVarIndex >= 0 ? metadata.variables[timeVarIndex] : null;
  
  // Build column definitions from variables
  metadata.variables.forEach((variable, index) => {
    const isTime = index === timeVarIndex;
    columns.push({
      id: variable.code,
      code: variable.code,
      label: variable.text,
      type: isTime ? 'time' : 'dimension',
    });
  });
  
  // Add value column
  columns.push({
    id: 'value',
    code: 'value',
    label: 'Value',
    type: 'value',
  });
  
  // Build value-text lookup maps for each variable
  const valueLookups: Record<string, Record<string, string>> = {};
  metadata.variables.forEach((variable) => {
    valueLookups[variable.code] = {};
    variable.values.forEach((value, idx) => {
      valueLookups[variable.code][value] = variable.valueTexts?.[idx] || value;
    });
  });
  
  // Transform data rows
  if (response.data && Array.isArray(response.data)) {
    response.data.forEach((item, index) => {
      if (!item.key || !item.values) return;
      
      const dimensions: Record<string, string> = {};
      const dimensionLabels: Record<string, string> = {};
      let time = '';
      let timeLabel = '';
      
      // Map keys to variable codes
      item.key.forEach((keyValue, keyIndex) => {
        if (keyIndex < metadata.variables.length) {
          const variable = metadata.variables[keyIndex];
          const label = valueLookups[variable.code]?.[keyValue] || keyValue;
          
          if (keyIndex === timeVarIndex) {
            time = keyValue;
            timeLabel = label;
          } else {
            dimensions[variable.code] = keyValue;
            dimensionLabels[variable.code] = label;
          }
        }
      });
      
      // Parse value
      const rawValue = item.values[0];
      let value: number | null = null;
      if (rawValue !== '..' && rawValue !== '.' && rawValue !== '' && rawValue !== null) {
        const parsed = parseFloat(rawValue);
        if (!isNaN(parsed)) {
          value = parsed;
        }
      }
      
      // Generate unique row ID from all dimension values + time
      const rowId = `${Object.values(dimensions).join('_')}_${time}_${index}`;
      
      rows.push({
        id: rowId,
        dimensions,
        dimensionLabels,
        time,
        timeLabel,
        value,
      });
    });
  }
  
  // Extract unit from response columns if available
  const unit = response.columns?.find(c => c.type === 'c')?.text || '';
  
  return {
    columns,
    rows,
    metadata: {
      title: metadata.title,
      updated: metadata.updated,
      source: metadata.source,
      unit,
      timeVariable: timeVariable?.code,
    },
  };
}

/**
 * Find the index of the time variable in the variables array
 */
function findTimeVariableIndex(variables: StatFinVariable[]): number {
  return variables.findIndex(
    (v) =>
      v.time === true ||
      v.code.toLowerCase().includes('vuosi') ||
      v.code.toLowerCase().includes('aika') ||
      v.code.toLowerCase().includes('kuukausi') ||
      v.code.toLowerCase().includes('neljännes') ||
      v.code.toLowerCase() === 'year' ||
      v.code.toLowerCase() === 'time' ||
      v.code.toLowerCase() === 'quarter' ||
      v.code.toLowerCase() === 'month' ||
      (v.values.length > 0 && /^\d{4}/.test(v.values[0]))
  );
}

/**
 * Group rows by non-time dimensions to create chart series
 */
export function groupRowsForChart(
  rows: StatFinRow[],
  selectedIds: Set<string>
): Map<string, { label: string; data: { date: string; value: number }[] }> {
  const seriesMap = new Map<string, { label: string; data: { date: string; value: number }[] }>();
  
  const selectedRows = rows.filter(r => selectedIds.has(r.id));
  
  // Group by dimension combination
  selectedRows.forEach((row) => {
    // Create series key from dimensions (excluding time)
    const seriesKey = Object.entries(row.dimensions)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v)
      .join('|');
    
    // Create human-readable label from dimension labels
    const seriesLabel = Object.entries(row.dimensionLabels)
      .map(([, label]) => label)
      .filter(l => l && l !== 'Total' && l !== 'Yhteensä')
      .join(', ') || 'Series';
    
    if (!seriesMap.has(seriesKey)) {
      seriesMap.set(seriesKey, { label: seriesLabel, data: [] });
    }
    
    if (row.value !== null) {
      const date = normalizeTimeToISO(row.time);
      seriesMap.get(seriesKey)!.data.push({ date, value: row.value });
    }
  });
  
  // Sort data points by date within each series
  seriesMap.forEach((series) => {
    series.data.sort((a, b) => a.date.localeCompare(b.date));
  });
  
  return seriesMap;
}

/**
 * Get unique dimension values for filtering
 */
export function getUniqueDimensionValues(
  rows: StatFinRow[],
  dimensionCode: string
): { value: string; label: string }[] {
  const seen = new Map<string, string>();
  
  rows.forEach((row) => {
    const value = row.dimensions[dimensionCode];
    const label = row.dimensionLabels[dimensionCode];
    if (value && !seen.has(value)) {
      seen.set(value, label || value);
    }
  });
  
  return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
}

/**
 * Normalize time key to ISO date format for charting
 */
function normalizeTimeToISO(timeKey: string): string {
  // Quarterly format: 2024Q1 or 2024K1 -> 2024-01-01
  if (/^\d{4}[QK]\d$/.test(timeKey)) {
    const year = timeKey.substring(0, 4);
    const quarter = parseInt(timeKey.substring(5));
    const month = ((quarter - 1) * 3 + 1).toString().padStart(2, '0');
    return `${year}-${month}-01`;
  }
  
  // Monthly format: 2024M01 -> 2024-01-01
  if (/^\d{4}M\d{2}$/.test(timeKey)) {
    const year = timeKey.substring(0, 4);
    const month = timeKey.substring(5, 7);
    return `${year}-${month}-01`;
  }
  
  // Already ISO format
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(timeKey)) {
    return timeKey.length === 7 ? `${timeKey}-01` : timeKey;
  }
  
  // Annual format: 2024 -> 2024-01-01
  if (/^\d{4}$/.test(timeKey)) {
    return `${timeKey}-01-01`;
  }
  
  return timeKey;
}

/**
 * Export table data to CSV format
 */
export function exportTableDataToCSV(
  tableData: StatFinTableData,
  selectedIds?: Set<string>
): string {
  const rows = selectedIds 
    ? tableData.rows.filter(r => selectedIds.has(r.id))
    : tableData.rows;
  
  if (rows.length === 0) return '';
  
  // Build header from dimension columns + time + value
  const dimensionCols = tableData.columns.filter(c => c.type === 'dimension');
  const timeCol = tableData.columns.find(c => c.type === 'time');
  
  const headers = [
    ...dimensionCols.map(c => c.label),
    timeCol?.label || 'Time',
    'Value',
  ];
  
  const csvRows = rows.map(row => [
    ...dimensionCols.map(c => row.dimensionLabels[c.code] || row.dimensions[c.code] || ''),
    row.timeLabel || row.time,
    row.value !== null ? row.value.toString() : '',
  ]);
  
  const escapeCSV = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };
  
  return [
    headers.map(escapeCSV).join(','),
    ...csvRows.map(row => row.map(escapeCSV).join(',')),
  ].join('\n');
}
