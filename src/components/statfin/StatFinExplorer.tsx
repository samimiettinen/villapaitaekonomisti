import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Folder, 
  FolderOpen, 
  Table2, 
  ChevronRight, 
  ChevronDown,
  Loader2,
  AlertCircle,
  Home,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { 
  StatFinNode, 
  StatFinTableMetadata,
  fetchNavigation, 
  fetchTableMetadata,
  detectFrequency,
} from '@/lib/statfinPxweb';

interface StatFinExplorerProps {
  onTableSelected: (tablePath: string[], metadata: StatFinTableMetadata) => void;
  onError?: (error: Error) => void;
  language?: 'en' | 'fi';
}

interface ExpandedFolders {
  [key: string]: boolean;
}

interface FolderCache {
  [key: string]: StatFinNode[];
}

export default function StatFinExplorer({ 
  onTableSelected, 
  onError,
  language = 'en' 
}: StatFinExplorerProps) {
  const [currentPath, setCurrentPath] = useState<string[]>(['StatFin']);
  const [expandedFolders, setExpandedFolders] = useState<ExpandedFolders>({});
  const [folderCache, setFolderCache] = useState<FolderCache>({});
  const [selectedTable, setSelectedTable] = useState<string[] | null>(null);
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());

  // Fetch current path contents
  const { 
    data: currentNodes, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['statfin-nav', currentPath.join('/')],
    queryFn: () => fetchNavigation(currentPath, language),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch selected table metadata
  const { 
    data: tableMetadata, 
    isLoading: isLoadingMetadata,
    error: metadataError 
  } = useQuery({
    queryKey: ['statfin-metadata', selectedTable?.join('/')],
    queryFn: () => selectedTable ? fetchTableMetadata(selectedTable, language) : null,
    enabled: !!selectedTable,
    staleTime: 5 * 60 * 1000,
  });

  const pathKey = (path: string[]) => path.join('/');

  // Navigate to a folder
  const navigateToFolder = useCallback((path: string[]) => {
    setCurrentPath(path);
    setSelectedTable(null);
  }, []);

  // Toggle folder expansion (for tree view)
  const toggleFolder = useCallback(async (node: StatFinNode) => {
    const key = pathKey(node.path);
    
    if (expandedFolders[key]) {
      setExpandedFolders(prev => ({ ...prev, [key]: false }));
    } else {
      // Load folder contents if not cached
      if (!folderCache[key]) {
        setLoadingFolders(prev => new Set(prev).add(key));
        try {
          const children = await fetchNavigation(node.path, language);
          setFolderCache(prev => ({ ...prev, [key]: children }));
        } catch (err) {
          console.error('Failed to load folder:', err);
          onError?.(err as Error);
        } finally {
          setLoadingFolders(prev => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }
      }
      setExpandedFolders(prev => ({ ...prev, [key]: true }));
    }
  }, [expandedFolders, folderCache, language, onError]);

  // Select a table
  const handleSelectTable = useCallback((node: StatFinNode) => {
    setSelectedTable(node.path);
  }, []);

  // Confirm table selection
  const handleConfirmSelection = useCallback(() => {
    if (selectedTable && tableMetadata) {
      onTableSelected(selectedTable, tableMetadata);
    }
  }, [selectedTable, tableMetadata, onTableSelected]);

  // Navigate via breadcrumb
  const handleBreadcrumbClick = (index: number) => {
    const newPath = currentPath.slice(0, index + 1);
    navigateToFolder(newPath);
  };

  // Render a single node
  const renderNode = (node: StatFinNode, depth: number = 0) => {
    const isFolder = node.type === 'folder';
    const key = pathKey(node.path);
    const isExpanded = expandedFolders[key];
    const isLoadingFolder = loadingFolders.has(key);
    const children = folderCache[key];
    const isSelected = selectedTable && pathKey(selectedTable) === pathKey(node.path);

    return (
      <div key={node.id} className="select-none">
        <div
          className={`
            flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer
            transition-colors hover:bg-muted/50
            ${isSelected ? 'bg-primary/10 border border-primary/30' : ''}
          `}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => isFolder ? toggleFolder(node) : handleSelectTable(node)}
        >
          {isFolder ? (
            <>
              {isLoadingFolder ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              {isExpanded ? (
                <FolderOpen className="h-4 w-4 text-amber-500" />
              ) : (
                <Folder className="h-4 w-4 text-amber-500" />
              )}
            </>
          ) : (
            <>
              <span className="w-4" />
              <Table2 className="h-4 w-4 text-primary" />
            </>
          )}
          <span className="flex-1 text-sm truncate">{node.text}</span>
          {node.type === 'table' && node.updated && (
            <Badge variant="outline" className="text-xs shrink-0">
              {new Date(node.updated).toLocaleDateString()}
            </Badge>
          )}
        </div>
        
        {/* Render children if expanded */}
        {isFolder && isExpanded && children && (
          <div>
            {children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load StatFin data: {(error as Error).message}
          <Button variant="link" className="p-0 h-auto ml-2" onClick={() => refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb Navigation */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between gap-4">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink 
                    onClick={() => navigateToFolder(['StatFin'])}
                    className="cursor-pointer flex items-center gap-1"
                  >
                    <Home className="h-3.5 w-3.5" />
                    StatFin
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {currentPath.slice(1).map((segment, index) => (
                  <BreadcrumbItem key={segment}>
                    <BreadcrumbSeparator />
                    {index === currentPath.length - 2 ? (
                      <BreadcrumbPage>{segment}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink 
                        onClick={() => handleBreadcrumbClick(index + 1)}
                        className="cursor-pointer"
                      >
                        {segment}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Folder/Table Browser */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Folder className="h-4 w-4" />
              Browse Tables
            </CardTitle>
            <CardDescription>
              Navigate through folders to find a table
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : currentNodes && currentNodes.length > 0 ? (
                <div className="space-y-0.5">
                  {currentNodes.map(node => renderNode(node))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No items found in this folder
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Table Metadata Preview */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Table2 className="h-4 w-4" />
              Table Details
            </CardTitle>
            <CardDescription>
              {selectedTable ? 'Preview selected table' : 'Select a table to see details'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedTable ? (
              <div className="text-center text-muted-foreground py-12">
                <Table2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Click on a table to preview its details</p>
              </div>
            ) : isLoadingMetadata ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <div className="pt-4 space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              </div>
            ) : metadataError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to load table metadata: {(metadataError as Error).message}
                </AlertDescription>
              </Alert>
            ) : tableMetadata ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{tableMetadata.title}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">
                      {detectFrequency(tableMetadata) === 'Q' ? 'Quarterly' : 
                       detectFrequency(tableMetadata) === 'M' ? 'Monthly' : 
                       detectFrequency(tableMetadata) === 'A' ? 'Annual' : 'Unknown frequency'}
                    </Badge>
                    {tableMetadata.updated && (
                      <Badge variant="outline">
                        Updated: {new Date(tableMetadata.updated).toLocaleDateString()}
                      </Badge>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Dimensions ({tableMetadata.variables.length})
                  </h4>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {tableMetadata.variables.map((variable) => (
                        <div 
                          key={variable.code} 
                          className="p-2 bg-muted/50 rounded-md"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{variable.text}</span>
                            <Badge variant="outline" className="text-xs">
                              {variable.values.length} values
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {variable.valueTexts.slice(0, 3).join(', ')}
                            {variable.valueTexts.length > 3 && '...'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleConfirmSelection}
                >
                  <Table2 className="h-4 w-4 mr-2" />
                  Select This Table
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
