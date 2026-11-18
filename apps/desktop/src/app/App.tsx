import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { SearchPalette } from "../components/SearchPalette";
import { Sidebar } from "../components/Sidebar";
import { TitleBar } from "../components/TitleBar";
import { TopBar } from "../components/TopBar";
import { useSettings } from "../lib/settings";
import { Account } from "../pages/Account";
import { Downloads } from "../pages/Downloads";
import { Home } from "../pages/Home";
import { Library } from "../pages/Library";
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
        <div className="flex h-full flex-col">
          <TitleBar />
          <div className="flex min-h-0 flex-1">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar onSearch={() => setSearch(true)} />
              <main className="min-h-0 flex-1 overflow-auto">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/store" element={<Store />} />
                  <Route path="/library" element={<Library />} />
                  <Route path="/downloads" element={<Downloads />} />
                  <Route path="/account" element={<Account />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Home />} />
                </Routes>
              </main>
            </div>
          </div>
        </div>
        <SearchPalette open={search} onClose={() => setSearch(false)} />
      </HashRouter>
    </QueryClientProvider>
  );
}
