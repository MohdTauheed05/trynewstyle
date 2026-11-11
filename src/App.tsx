import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { RunwaySection } from './components/RunwaySection';
import { BagDialog } from './components/BagDialog';
import { OrderPage } from './components/OrderPage';
import { AdminPanel } from './components/AdminPanel';
import { OffcutRailSection } from './components/OffcutRailSection';
import { LadiesDepthLookbook } from './components/LadiesDepthLookbook';
import { LadiesRailSection } from './components/LadiesRailSection';
import { Look, Product } from './types';
import { getStoredLooks, getStoredProducts } from './services/catalogStorage';
import { getBagCount } from './services/bagStorage';
import { getStoredSettings, StoreSettings, cleanCurrencySymbol } from './services/storeSettings';

export default function App() {
  const [currentView, setCurrentView] = useState<'runway' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      const path = window.location.pathname.toLowerCase();
      if (hash === '#admin' || hash.includes('/admin') || path === '/admin' || path.startsWith('/admin')) {
        return 'admin';
      }
    }
    return 'runway';
  });

  const [settings, setSettings] = useState<StoreSettings>(() => getStoredSettings());
  const [looks, setLooks] = useState<Look[]>(() => getStoredLooks());
  const [products, setProducts] = useState<Product[]>(() => getStoredProducts());
  const [cartCount, setCartCount] = useState<number>(() => getBagCount());
  const [isBagOpen, setIsBagOpen] = useState(false);

  // Sync with browser URL / hash changes
  useEffect(() => {
    const handleUrlChange = () => {
      const hash = window.location.hash.toLowerCase();
      const path = window.location.pathname.toLowerCase();
      if (hash === '#admin' || hash.includes('/admin') || path === '/admin' || path.startsWith('/admin')) {
        setCurrentView('admin');
      } else {
        setCurrentView('runway');
      }
    };

    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  // Sync catalog & settings updates
  useEffect(() => {
    const handleCatalogUpdate = () => {
      setLooks(getStoredLooks());
      setProducts(getStoredProducts());
    };

    const handleBagUpdate = () => {
      setCartCount(getBagCount());
    };

    const handleSettingsUpdate = () => {
      setSettings(getStoredSettings());
    };

    window.addEventListener('runway:catalog_updated', handleCatalogUpdate);
    window.addEventListener('runway:bag_updated', handleBagUpdate);
    window.addEventListener('runway:settings_updated', handleSettingsUpdate);

    return () => {
      window.removeEventListener('runway:catalog_updated', handleCatalogUpdate);
      window.removeEventListener('runway:bag_updated', handleBagUpdate);
      window.removeEventListener('runway:settings_updated', handleSettingsUpdate);
    };
  }, []);

  const handleNavigateHome = () => {
    setCurrentView('runway');
    if (window.location.pathname === '/admin') {
      window.history.pushState(null, '', '/');
    } else {
      window.history.pushState(null, '', '#');
    }
  };

  const handleNavigateToRunway = () => {
    setCurrentView('runway');
    if (window.location.pathname === '/admin') {
      window.history.pushState(null, '', '/');
    } else {
      window.history.pushState(null, '', '#');
    }
  };

  const currentCurrency = cleanCurrencySymbol(settings.currencySymbol);
  let sharedOrder: any = null;
  if (typeof window !== 'undefined' && window.location.hash.startsWith('#order=')) {
    try {
      sharedOrder = JSON.parse(decodeURIComponent(window.location.hash.slice('#order='.length)));
    } catch {
      sharedOrder = null;
    }
  }

  if (sharedOrder && Array.isArray(sharedOrder.items)) {
    return <OrderPage order={sharedOrder} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#151413]">
      {currentView === 'runway' ? (
        <>
          <Header
            shopName={settings.shopName}
            onNavigateHome={handleNavigateHome}
            cartCount={cartCount}
            onOpenBag={() => setIsBagOpen(true)}
          />

          <main className="flex-1 flex flex-col">
            <div id="men-studio" style={{ scrollMarginTop: 'var(--header-h, 64px)' }}>
              <RunwaySection
                looks={looks}
                products={products}
                shopName={settings.shopName}
                shopTagline={settings.shopTagline}
                currencySymbol={currentCurrency}
                onOpenBag={() => setIsBagOpen(true)}
              />
            </div>

            {/* Scroll Down 3D Clothing-Rail Hero */}
            <OffcutRailSection
              shopName={settings.shopName}
              shopTagline={settings.shopTagline}
              currencySymbol={currentCurrency}
              whatsappNumber={settings.whatsappNumber}
              onOpenBag={() => setIsBagOpen(true)}
            />

            {/* Ladies Section — Runway Depth Lookbook */}
            <LadiesDepthLookbook
              shopName={settings.shopName}
              currencySymbol={currentCurrency}
              cartCount={cartCount}
              onOpenBag={() => setIsBagOpen(true)}
              onNavigateHome={handleNavigateHome}
            />

            {/* Ladies Section 2 — 3D Tops & Blouses on Chrome Rail */}
            <LadiesRailSection
              shopName={settings.shopName}
              currencySymbol={currentCurrency}
              whatsappNumber={settings.whatsappNumber}
              onOpenBag={() => setIsBagOpen(true)}
            />
          </main>

          <BagDialog
            isOpen={isBagOpen}
            onClose={() => setIsBagOpen(false)}
            products={products}
            shopName={settings.shopName}
            whatsappNumber={settings.whatsappNumber}
            currencySymbol={currentCurrency}
          />
        </>
      ) : (
        <AdminPanel
          looks={looks}
          products={products}
          settings={settings}
          onUpdateLooks={(updated) => setLooks(updated)}
          onUpdateProducts={(updated) => setProducts(updated)}
          onUpdateSettings={(updated) => setSettings(updated)}
          onNavigateToRunway={handleNavigateToRunway}
        />
      )}
    </div>
  );
}
