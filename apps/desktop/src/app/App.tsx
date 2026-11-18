import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Navigator } from "../components/Navigator";
import { SearchPalette } from "../components/SearchPalette";
import { CommandBar } from "../components/CommandBar";
import { StatusDock } from "../components/StatusDock";
import { Toasts } from "../components/Toasts";
import { WhatsNew } from "../components/WhatsNew";
import { useSettings } from "../lib/settings";
import { Account } from "../pages/Account";
import { Admin } from "../pages/Admin";
import { Downloads } from "../pages/Downloads";
import { Home } from "../pages/Home";
import { Library } from "../pages/Library";
import { Live } from "../pages/Live";
import { LiveWatch } from "../pages/LiveWatch";
import { ProductDetail } from "../pages/ProductDetail";
import { Settings } from "../pages/Settings";
import { Store } from "../pages/Store";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } });

export function App() {
  const [search, setSearch] = useState(false);
  const theme = useSettings((s) => s.theme);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <div className="hud-bg flex h-full flex-col">
          <CommandBar onSearch={() => setSearch(true)} />
          <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col">
              <main className="min-h-0 flex-1 overflow-auto">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/store" element={<Store />} />
                  <Route path="/store/:id" element={<ProductDetail />} />
                  <Route path="/live" element={<Live />} />
                  <Route path="/live/:id" element={<LiveWatch />} />
                  <Route path="/library" element={<Library />} />
                  <Route path="/downloads" element={<Downloads />} />
                  <Route path="/account" element={<Account />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="*" element={<Home />} />
                </Routes>
              </main>
            </div>
          </div>
          <StatusDock />
        </div>
        <Navigator />
        <SearchPalette open={search} onClose={() => setSearch(false)} />
        <Toasts />
        <WhatsNew />
      </HashRouter>
    </QueryClientProvider>
  );
}
