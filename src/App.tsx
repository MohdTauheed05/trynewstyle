import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { RunwaySection } from './components/RunwaySection';
import { BagDialog } from './components/BagDialog';
import { OrderPage } from './components/OrderPage';
import { AdminPanel } from './components/AdminPanel';
import { OffcutRailSection } from './components/OffcutRailSection';
import { LadiesDepthLookbook } from './components/LadiesDepthLookbook';
import { LadiesRailSection } from './components/LadiesRailSection';
import { VirtualStudio } from './components/VirtualStudio';
import { WesternOrbitSection } from './components/WesternOrbitSection';
import { CircleLookbook } from './components/CircleLookbook';
import { ProductSpotlightCarousel } from './components/ProductSpotlightCarousel';
import { PageRibbonSection } from './components/PageRibbonSection';
import { DEFAULT_LOOKS } from './data/defaultCatalog';
import { Look, MaisonEditProduct, Product } from './types';
import { getStoredLooks, getStoredProducts, saveLooks, saveProducts } from './services/catalogStorage';
import { getBagCount } from './services/bagStorage';
import { getStoredSettings, saveStoredSettings, StoreSettings, cleanCurrencySymbol } from './services/storeSettings';
import { fetchCatalogFromFirestore, fetchMaisonEditFromFirestore, fetchOrderShareFromFirestore, fetchSharedSectionFromFirestore, fetchStoreSettingsFromFirestore } from './services/firebase';
import { getStoredRailItems, saveRailItems } from './services/railStorage';
import { getStoredLadiesPieces, getStoredLadiesSettings, saveLadiesPieces, saveLadiesSettings } from './services/ladiesStorage';
import { getStoredLadiesRailItems, saveLadiesRailItems } from './services/ladiesRailStorage';
import { getMaisonEditCrop, getStoredMaisonEditItems, ME_PRODUCT_SHEET_URL, saveMaisonEditItems } from './services/maisonEditStorage';


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
  const [linkedOrder, setLinkedOrder] = useState<any>(null);
  const [isResolvingOrder, setIsResolvingOrder] = useState(() =>
    typeof window !== 'undefined' && /^[A-Za-z0-9_-]{12}$/.test(window.location.hash.slice('#order='.length))
  );

  useEffect(() => {
    const token = window.location.hash.startsWith('#order=')
      ? window.location.hash.slice('#order='.length)
      : '';
    if (!/^[A-Za-z0-9_-]{12}$/.test(token)) return;
    let active = true;
    setIsResolvingOrder(true);
    fetchOrderShareFromFirestore(token).then((order) => {
      if (!active) return;
      setLinkedOrder(order);
      setIsResolvingOrder(false);
    });
    return () => {
      active = false;
    };
  }, []);

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

  useEffect(() => {
    const sectionIds = new Set([
      'men-studio',
      'offcut-rail-section',
      'ladies-section',
      'ladies-rail-section',
      'virtual-studio',
      'western-orbit-studio',
      'circle-lookbook',
      'product-collection',
    ]);

    let timeoutId = 0;
    let animationFrame = 0;

    const scrollToHashSection = (behavior: ScrollBehavior) => {
      const sectionId = window.location.hash.slice(1);
      if (!sectionIds.has(sectionId)) return;
      let attempts = 0;
      window.clearTimeout(timeoutId);
      window.cancelAnimationFrame(animationFrame);

      const findAndScroll = () => {
        const target = document.getElementById(sectionId);
        if (target) {
          const headerHeight =
            Number.parseFloat(
              window.getComputedStyle(document.documentElement).getPropertyValue('--header-h'),
            ) || 64;
          const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 8;
          window.scrollTo({ top: Math.max(0, top), behavior });
          return;
        }
        attempts += 1;
        if (attempts < 40) timeoutId = window.setTimeout(findAndScroll, 50);
      };

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = window.requestAnimationFrame(findAndScroll);
      });
    };

    scrollToHashSection('auto');
    const onHashChange = () => scrollToHashSection('smooth');
    window.addEventListener('hashchange', onHashChange);

    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(timeoutId);
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

  useEffect(() => {
    let active = true;
    const loadSharedStoreData = async () => {
      const [cloudSettings, catalog, rail, ladies, ladiesRail, maisonEditCollection, sharedMaisonEdit] = await Promise.all([
        fetchStoreSettingsFromFirestore(),
        fetchCatalogFromFirestore(),
        fetchSharedSectionFromFirestore<{ items?: ReturnType<typeof getStoredRailItems> }>('shared_rail'),
        fetchSharedSectionFromFirestore<{ pieces?: ReturnType<typeof getStoredLadiesPieces>; settings?: ReturnType<typeof getStoredLadiesSettings> }>('shared_ladies'),
        fetchSharedSectionFromFirestore<{ items?: ReturnType<typeof getStoredLadiesRailItems> }>('shared_ladies_rail'),
        fetchMaisonEditFromFirestore(),
        fetchSharedSectionFromFirestore<{ items?: MaisonEditProduct[] }>('shared_maison_edit'),
      ]);
      if (!active) return;
      if (cloudSettings) {
        const merged = { ...getStoredSettings(), ...cloudSettings };
        saveStoredSettings(merged);
        setSettings(merged);
      }
      if (catalog?.products.length) {
        saveProducts(catalog.products, false);
        setProducts(catalog.products);
      }
      if (catalog?.looks.length) {
        saveLooks(catalog.looks, false);
        setLooks(catalog.looks);
      }
      if (rail?.items) saveRailItems(rail.items, false);
      if (ladies?.pieces) saveLadiesPieces(ladies.pieces, false);
      if (ladies?.settings) saveLadiesSettings(ladies.settings, false);
      if (ladiesRail?.items) saveLadiesRailItems(ladiesRail.items, false);
      const nextMaisonEdit = maisonEditCollection?.length ? maisonEditCollection : sharedMaisonEdit?.items;
      if (Array.isArray(nextMaisonEdit)) saveMaisonEditItems(nextMaisonEdit, false);
    };
    void loadSharedStoreData().catch((error) => console.error('Failed to load shared Firestore data:', error));
    return () => {
      active = false;
    };
  }, []);

  const currentCurrency = cleanCurrencySymbol(settings.currencySymbol);
  const mensRunwayLooks = looks.filter((look) => !look.modelGroup || look.modelGroup === 'men');
  let sharedOrder: any = null;
  if (typeof window !== 'undefined' && window.location.hash.startsWith('#order=')) {
    try {
      const encodedOrder = window.location.hash.slice('#order='.length);
      if (/^[A-Za-z0-9_-]{12}$/.test(encodedOrder)) {
        sharedOrder = linkedOrder;
      } else if (encodedOrder.startsWith('v1.')) {
        const base64 = encodedOrder.slice(3).replace(/-/g, '+').replace(/_/g, '/');
        const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
        const bytes = Uint8Array.from(atob(paddedBase64), (char) => char.charCodeAt(0));
        const payload = JSON.parse(new TextDecoder().decode(bytes));
        if (payload.v === 1 && Array.isArray(payload.i)) {
          sharedOrder = {
            orderId: payload.o,
            date: new Date(payload.d).toISOString(),
            shopName: payload.s,
            items: payload.i.map(([id, name, size, quantity, price, url]: [string, string, string, number, number, string]) => ({
              id, name, size, quantity, price, url,
            })),
            total: payload.t,
            currencySymbol: payload.c,
          };
        }
      } else {
        // Continue to support order links generated before compact links were introduced.
        sharedOrder = JSON.parse(decodeURIComponent(encodedOrder));
      }
    } catch {
      sharedOrder = null;
    }
  }

  if (!sharedOrder && isResolvingOrder) {
    return <main className="min-h-screen grid place-items-center bg-[#f5f3ef] text-sm text-neutral-600">Loading order details…</main>;
  }
  if (!sharedOrder && /^[A-Za-z0-9_-]{12}$/.test(window.location.hash.slice('#order='.length))) {
    return <main className="min-h-screen grid place-items-center bg-[#f5f3ef] px-6 text-center text-sm text-neutral-600">This order link could not be found. Please ask the store owner for a new link.</main>;
  }

  if (sharedOrder && Array.isArray(sharedOrder.items)) {
    const storedRailItems = getStoredRailItems();
    const storedLadiesPieces = getStoredLadiesPieces();
    const storedLadiesRailItems = getStoredLadiesRailItems();
    const storedMaisonEditItems = getStoredMaisonEditItems();
    const orderWithPhotos = {
      ...sharedOrder,
      items: sharedOrder.items.map((item: any) => {
        const product = products.find((candidate) =>
          candidate.name === item.name || item.id === candidate.id || item.id.startsWith(`${candidate.id}-`)
        );
        const railItem = storedRailItems.find((candidate) => candidate.id === item.id || candidate.name === item.name);
        const ladiesPiece = storedLadiesPieces.find((candidate) => candidate.id === item.id || candidate.name === item.name);
        const ladiesRailItem = storedLadiesRailItems.find((candidate) => candidate.id === item.id || candidate.name === item.name);
        const maisonEditItem = storedMaisonEditItems.find(
          (candidate) => `me-${candidate.id}` === item.id || candidate.id === item.id || candidate.name === item.name
        );
        const maisonEditCrop = maisonEditItem && !maisonEditItem.customImage
          ? getMaisonEditCrop(maisonEditItem.sheetCol ?? 0, maisonEditItem.sheetRow ?? 0)
          : undefined;
        return {
          ...item,
          image:
            item.image ||
            product?.image ||
            railItem?.image ||
            ladiesPiece?.customImage ||
            ladiesRailItem?.image ||
            maisonEditItem?.customImage ||
            (maisonEditCrop ? ME_PRODUCT_SHEET_URL : undefined),
          crop:
            item.crop ||
            (ladiesPiece?.box
              ? {
                  x: ladiesPiece.box[0],
                  y: ladiesPiece.box[2],
                  w: ladiesPiece.box[1] - ladiesPiece.box[0],
                  h: ladiesPiece.box[3] - ladiesPiece.box[2],
                  sheetW: 960,
                  sheetH: 720,
                }
              : ladiesRailItem?.crop || maisonEditCrop),
        };
      }),
    };
    return <OrderPage order={orderWithPhotos} />;
  }

  const ribbonPreview = new URLSearchParams(window.location.search).get('ribbonPreview');
  if (ribbonPreview === 'men-studio') {
    return (
      <main style={{ width: 1280, height: 920, overflow: 'hidden', background: '#fff', ['--rw-frame-h' as any]: '920px' }}>
        <RunwaySection
          looks={mensRunwayLooks.length ? mensRunwayLooks : DEFAULT_LOOKS}
          products={products}
          shopName={settings.shopName}
          shopTagline={settings.shopTagline}
          currencySymbol={currentCurrency}
          onOpenBag={() => {}}
        />
      </main>
    );
  }
  if (ribbonPreview === 'offcut-rail-section') {
    return (
      <main style={{ width: 1280, height: 920, overflow: 'hidden', background: '#fff' }}>
        <OffcutRailSection
          shopName={settings.shopName}
          shopTagline={settings.shopTagline}
          currencySymbol={currentCurrency}
          whatsappNumber={settings.whatsappNumber}
          onOpenBag={() => {}}
        />
      </main>
    );
  }
  if (ribbonPreview === 'ladies-section') {
    return (
      <main style={{ width: 1280, height: 920, overflow: 'hidden', background: '#fff' }}>
        <LadiesDepthLookbook
          shopName={settings.shopName}
          currencySymbol={currentCurrency}
          cartCount={cartCount}
          onOpenBag={() => {}}
          onNavigateHome={() => {}}
        />
      </main>
    );
  }
  if (ribbonPreview === 'ladies-rail-section') {
    return (
      <main style={{ width: 1280, height: 920, overflow: 'hidden', background: '#fff' }}>
        <LadiesRailSection
          shopName={settings.shopName}
          currencySymbol={currentCurrency}
          whatsappNumber={settings.whatsappNumber}
          onOpenBag={() => {}}
        />
      </main>
    );
  }
  if (ribbonPreview === 'virtual-studio') {
    return (
      <main style={{ width: 1280, height: 920, overflow: 'hidden', background: '#fff' }}>
        <VirtualStudio
          shopName={settings.shopName}
          currencySymbol={currentCurrency}
          products={products}
          looks={looks}
          whatsappNumber={settings.whatsappNumber}
          onOpenBag={() => {}}
        />
      </main>
    );
  }
  if (ribbonPreview === 'western-orbit-studio') {
    return (
      <main style={{ width: 1280, height: 920, overflow: 'hidden', background: '#fff' }}>
        <WesternOrbitSection
          shopName={settings.shopName}
          currencySymbol={currentCurrency}
          products={products}
          looks={looks}
          whatsappNumber={settings.whatsappNumber}
          onOpenBag={() => {}}
        />
      </main>
    );
  }
  if (ribbonPreview === 'circle-lookbook') {
    return (
      <main style={{ width: 1280, height: 920, overflow: 'hidden', background: '#fff', ['--rw-frame-h' as any]: '920px' }}>
        <CircleLookbook
          shopName={settings.shopName}
          currencySymbol={currentCurrency}
          looks={looks.length ? looks : DEFAULT_LOOKS}
          products={products}
        />
      </main>
    );
  }
  if (ribbonPreview === 'product-collection') {
    return (
      <main
        style={{
          width: 1280,
          height: 920,
          overflow: 'hidden',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <ProductSpotlightCarousel
          shopName={settings.shopName}
          currencySymbol={currentCurrency}
          products={products}
        />
      </main>
    );
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
                looks={mensRunwayLooks}
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

            <VirtualStudio
              shopName={settings.shopName}
              currencySymbol={currentCurrency}
              products={products}
              looks={looks}
              whatsappNumber={settings.whatsappNumber}
              onOpenBag={() => setIsBagOpen(true)}
            />

            <WesternOrbitSection
              shopName={settings.shopName}
              currencySymbol={currentCurrency}
              products={products}
              looks={looks}
              whatsappNumber={settings.whatsappNumber}
              onOpenBag={() => setIsBagOpen(true)}
            />

            <CircleLookbook
              shopName={settings.shopName}
              currencySymbol={currentCurrency}
              looks={looks}
              products={products}
            />

            <div id="product-collection" style={{ scrollMarginTop: 'var(--header-h, 64px)' }}>
              <ProductSpotlightCarousel
                shopName={settings.shopName}
                currencySymbol={currentCurrency}
                products={products}
              />
            </div>

            <PageRibbonSection shopName={settings.shopName} looks={looks} products={products} />
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
