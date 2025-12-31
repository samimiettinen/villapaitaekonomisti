import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import Analysis from "./pages/Analysis";
import FredExplorer from "./pages/FredExplorer";
import DataExplorer from "./pages/DataExplorer";
import StatFinDashboard from "./pages/StatFinDashboard";
import StatFinDebug from "./pages/StatFinDebug";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/fred" element={<FredExplorer />} />
          <Route path="/explore" element={<DataExplorer />} />
          <Route path="/statfin" element={<StatFinDashboard />} />
          <Route path="/statfin-debug" element={<StatFinDebug />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
