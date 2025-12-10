import { ReactNode } from "react";
import { TrendingUp, LayoutDashboard, Search, BarChart3, Settings, Database, Building2 } from "lucide-react";
import { NavLink } from "@/components/NavLink";

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <TrendingUp className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">MacroData Warehouse</h1>
                <p className="text-sm text-muted-foreground">Economic time series analytics</p>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              <NavLink 
                to="/" 
                end
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                activeClassName="text-primary bg-primary/10"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </NavLink>
              <NavLink 
                to="/explore"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                activeClassName="text-primary bg-primary/10"
              >
                <Search className="h-4 w-4" />
                Data Explorer
              </NavLink>
              <NavLink 
                to="/fred"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                activeClassName="text-primary bg-primary/10"
              >
                <Database className="h-4 w-4" />
                FRED
              </NavLink>
              <NavLink 
                to="/statfin"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                activeClassName="text-primary bg-primary/10"
              >
                <Building2 className="h-4 w-4" />
                StatFin
              </NavLink>
              <NavLink 
                to="/analysis"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                activeClassName="text-primary bg-primary/10"
              >
                <BarChart3 className="h-4 w-4" />
                Analysis
              </NavLink>
              <NavLink 
                to="/admin"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                activeClassName="text-primary bg-primary/10"
              >
                <Settings className="h-4 w-4" />
                Admin
              </NavLink>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-6">
        {children}
      </main>
    </div>
  );
};
