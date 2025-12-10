import { useState, useMemo, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  LineChart,
  Table2,
  Search,
  CheckSquare,
  Square,
  Info,
} from 'lucide-react';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  StatFinTableData,
  StatFinRow,
  groupRowsForChart,
  getUniqueDimensionValues,
  exportTableDataToCSV,
} from '@/lib/statfinTransform';

interface StatFinResultViewProps {
  tableData: StatFinTableData;
  onExport?: (format: 'csv' | 'xlsx') => void;
}

const ROWS_PER_PAGE = 25;
const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7300',
  '#00C49F',
];

export default function StatFinResultView({ tableData, onExport }: StatFinResultViewProps) {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string>('time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [dimensionFilters, setDimensionFilters] = useState<Record<string, string>>({});

  // Get dimension columns for filtering
  const dimensionColumns = useMemo(
    () => tableData.columns.filter((c) => c.type === 'dimension'),
    [tableData.columns]
  );

  // Get unique values for each dimension
  const dimensionOptions = useMemo(() => {
    const options: Record<string, { value: string; label: string }[]> = {};
    dimensionColumns.forEach((col) => {
      options[col.code] = getUniqueDimensionValues(tableData.rows, col.code);
    });
    return options;
  }, [tableData.rows, dimensionColumns]);

  // Filter and sort rows
  const filteredRows = useMemo(() => {
    let rows = [...tableData.rows];

    // Apply dimension filters
    Object.entries(dimensionFilters).forEach(([code, value]) => {
      if (value && value !== 'all') {
        rows = rows.filter((r) => r.dimensions[code] === value);
      }
    });

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.time.toLowerCase().includes(query) ||
          r.timeLabel.toLowerCase().includes(query) ||
          Object.values(r.dimensionLabels).some((l) => l.toLowerCase().includes(query)) ||
          (r.value !== null && r.value.toString().includes(query))
      );
    }

    // Sort rows
    rows.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      if (sortColumn === 'time') {
        aVal = a.time;
        bVal = b.time;
      } else if (sortColumn === 'value') {
        aVal = a.value ?? -Infinity;
        bVal = b.value ?? -Infinity;
      } else {
        aVal = a.dimensions[sortColumn] || '';
        bVal = b.dimensions[sortColumn] || '';
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDirection === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

    return rows;
  }, [tableData.rows, dimensionFilters, searchQuery, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / ROWS_PER_PAGE);
  const paginatedRows = useMemo(
    () => filteredRows.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE),
    [filteredRows, currentPage]
  );

  // Chart data from selected rows
  const chartSeries = useMemo(
    () => groupRowsForChart(tableData.rows, selectedRows),
    [tableData.rows, selectedRows]
  );

  // Convert chart series to recharts format
  const chartData = useMemo(() => {
    if (chartSeries.size === 0) return [];

    // Collect all unique dates
    const allDates = new Set<string>();
    chartSeries.forEach((series) => {
      series.data.forEach((point) => allDates.add(point.date));
    });

    // Build data array
    const sortedDates = Array.from(allDates).sort();
    return sortedDates.map((date) => {
      const point: Record<string, string | number> = { date };
      chartSeries.forEach((series, key) => {
        const dataPoint = series.data.find((d) => d.date === date);
        point[key] = dataPoint?.value ?? null as unknown as number;
      });
      return point;
    });
  }, [chartSeries]);

  // Toggle row selection
  const toggleRowSelection = useCallback((rowId: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  // Select all visible rows
  const selectAllVisible = useCallback(() => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      paginatedRows.forEach((row) => next.add(row.id));
      return next;
    });
  }, [paginatedRows]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedRows(new Set());
  }, []);

  // Handle sort
  const handleSort = useCallback((column: string) => {
    setSortColumn((prev) => {
      if (prev === column) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDirection('asc');
      return column;
    });
  }, []);

  // Handle export
  const handleExport = useCallback(() => {
    const csv = exportTableDataToCSV(tableData, selectedRows.size > 0 ? selectedRows : undefined);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tableData.metadata.title || 'statfin_data'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [tableData, selectedRows]);

  // Format date for display
  const formatDate = (date: string) => {
    if (date.length === 10) {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
      });
    }
    return date;
  };

  return (
    <div className="space-y-6">
      {/* Metadata Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-lg">{tableData.metadata.title}</CardTitle>
              <CardDescription className="mt-1 space-y-1">
                {tableData.metadata.source && (
                  <span className="block text-xs">Source: {tableData.metadata.source}</span>
                )}
                {tableData.metadata.updated && (
                  <span className="block text-xs">Last updated: {tableData.metadata.updated}</span>
                )}
                {tableData.metadata.unit && (
                  <span className="block text-xs">Unit: {tableData.metadata.unit}</span>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Table2 className="h-3 w-3" />
                {tableData.rows.length} rows
              </Badge>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Notice */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
        <Info className="h-4 w-4 flex-shrink-0" />
        <span>Select rows in the table to plot them as time-series in the chart below.</span>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8"
              />
            </div>

            {/* Dimension filters */}
            {dimensionColumns.map((col) => (
              <Select
                key={col.code}
                value={dimensionFilters[col.code] || 'all'}
                onValueChange={(value) => {
                  setDimensionFilters((prev) => ({ ...prev, [col.code]: value }));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={col.label} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {col.label}</SelectItem>
                  {dimensionOptions[col.code]?.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}

            {/* Selection controls */}
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={selectAllVisible}>
                <CheckSquare className="h-4 w-4 mr-1" />
                Select page
              </Button>
              {selectedRows.size > 0 && (
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  <Square className="h-4 w-4 mr-1" />
                  Clear ({selectedRows.size})
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  {dimensionColumns.map((col) => (
                    <TableHead
                      key={col.code}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort(col.code)}
                    >
                      {col.label}
                      {sortColumn === col.code && (
                        <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </TableHead>
                  ))}
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('time')}
                  >
                    Time
                    {sortColumn === 'time' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('value')}
                  >
                    Value
                    {sortColumn === 'value' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={dimensionColumns.length + 3}
                      className="text-center text-muted-foreground py-8"
                    >
                      No data matches the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={selectedRows.has(row.id) ? 'bg-primary/5' : ''}
                    >
                      <TableCell className="w-[40px]">
                        <Checkbox
                          checked={selectedRows.has(row.id)}
                          onCheckedChange={() => toggleRowSelection(row.id)}
                        />
                      </TableCell>
                      {dimensionColumns.map((col) => (
                        <TableCell key={col.code}>
                          {row.dimensionLabels[col.code] || row.dimensions[col.code] || '-'}
                        </TableCell>
                      ))}
                      <TableCell>{row.timeLabel || row.time}</TableCell>
                      <TableCell className="text-right font-mono">
                        {row.value !== null ? row.value.toLocaleString() : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}-
                {Math.min(currentPage * ROWS_PER_PAGE, filteredRows.length)} of{' '}
                {filteredRows.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart Panel */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <LineChart className="h-4 w-4" />
              Time Series Chart
            </CardTitle>
            {selectedRows.size > 0 && (
              <Badge variant="outline">{selectedRows.size} series selected</Badge>
            )}
          </div>
          <CardDescription>
            {selectedRows.size === 0
              ? 'Select rows from the table above to display chart'
              : `Showing ${chartSeries.size} unique series`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedRows.size === 0 ? (
            <div className="h-[300px] flex items-center justify-center border-2 border-dashed rounded-lg bg-muted/20">
              <div className="text-center text-muted-foreground">
                <LineChart className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Select rows in the table to plot them here</p>
              </div>
            </div>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelFormatter={formatDate}
                  />
                  <Legend />
                  {Array.from(chartSeries.entries()).map(([key, series], index) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      name={series.label}
                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
