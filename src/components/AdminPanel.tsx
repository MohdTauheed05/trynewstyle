import React, { useState } from 'react';
import { Look, Product, LookPin } from '../types';
import { saveLooks, saveProducts, resetToDefaults } from '../services/catalogStorage';
import {
  StoreSettings,
  saveStoredSettings,
  cleanCurrencySymbol,
  formatCurrency,
} from '../services/storeSettings';
import {
  testFirestoreConnection,
  syncCatalogToFirestore,
  fetchCatalogFromFirestore,
  signInStoreAdmin,
  signOutStoreAdmin,
  saveStoreSettingsToFirestore,
} from '../services/firebase';
import {
  RailItem,
  getStoredRailItems,
  saveRailItems,
  resetRailItems,
} from '../services/railStorage';
import { LadiesPiece, LadiesSectionSettings } from '../types';
import {
  getStoredLadiesPieces,
  saveLadiesPieces,
  getStoredLadiesSettings,
  saveLadiesSettings,
  resetLadiesData,
  LADIES_PIECES_SHEET,
} from '../services/ladiesStorage';
import {
  LadiesRailItem,
  getStoredLadiesRailItems,
  saveLadiesRailItems,
  resetLadiesRailItems,
} from '../services/ladiesRailStorage';

interface AdminPanelProps {
  looks: Look[];
  products: Product[];
  settings: StoreSettings;
  onUpdateLooks: (looks: Look[]) => void;
  onUpdateProducts: (products: Product[]) => void;
  onUpdateSettings: (settings: StoreSettings) => void;
  onNavigateToRunway: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  looks,
  products,
  settings,
  onUpdateLooks,
  onUpdateProducts,
  onUpdateSettings,
  onNavigateToRunway,
}) => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('runway_admin_auth') === 'true';
  });
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Active Tab: Fitting Studio | Clothes | Runway Models | 3D Rail Clothes | Ladies Collection | Ladies 3D Tops | Store Settings & Firebase
  const [activeTab, setActiveTab] = useState<'fit_studio' | 'clothes' | 'models' | 'rail' | 'ladies' | 'ladies_rail' | 'settings'>('fit_studio');

  // Ladies Lookbook CRUD State
  const [ladiesPieces, setLadiesPieces] = useState<LadiesPiece[]>(() => getStoredLadiesPieces());
  const [ladiesSettings, setLadiesSettings] = useState<LadiesSectionSettings>(() => getStoredLadiesSettings());
  const [ladiesModalOpen, setLadiesModalOpen] = useState(false);
  const [editingLadiesPiece, setEditingLadiesPiece] = useState<LadiesPiece | null>(null);
  const [ladiesPieceForm, setLadiesPieceForm] = useState({
    name: '',
    price: '1200.00',
    lookNumber: 15,
    pieceNumber: 1,
    customImage: '',
  });
  const [ladiesSettingsModalOpen, setLadiesSettingsModalOpen] = useState(false);
  const [ladiesSettingsForm, setLadiesSettingsForm] = useState<LadiesSectionSettings>(() => getStoredLadiesSettings());

  // Ladies 3D Rail Tops CRUD State
  const [ladiesRailItems, setLadiesRailItems] = useState<LadiesRailItem[]>(() => getStoredLadiesRailItems());
  const [ladiesRailModalOpen, setLadiesRailModalOpen] = useState(false);
  const [editingLadiesRailItem, setEditingLadiesRailItem] = useState<LadiesRailItem | null>(null);
  const [ladiesRailForm, setLadiesRailForm] = useState({
    name: '',
    price: '380.00',
    image: '',
    fitDescription: '',
  });

  // 3D Rail Clothes CRUD State
  const [railItems, setRailItems] = useState<RailItem[]>(() => getStoredRailItems());
  const [railModalOpen, setRailModalOpen] = useState(false);
  const [editingRailItem, setEditingRailItem] = useState<RailItem | null>(null);
  const [railForm, setRailForm] = useState({
    name: '',
    price: '48.00',
    image: '',
  });

  // Fitting Studio State
  const [selectedModelLookId, setSelectedModelLookId] = useState<string>(
    looks[0]?.id || 'look-1'
  );
  const [focusedProductId, setFocusedProductId] = useState<string>(
    looks[0]?.productIds[0] || products[0]?.id || ''
  );
  const [isCalibratingPin, setIsCalibratingPin] = useState(false);

  // Clothes CRUD Modal State
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    vendor: 'Studio Collection',
    price: '149.00',
    category: 'top' as Product['category'],
    image: '',
    sizes: 'S, M, L, XL',
    optionLegend: 'Size',
    fitDescription: 'Contemporary relaxed drape with premium heavyweight cotton.',
    defaultPinX: 50,
    defaultPinY: 45,
    url: '#',
  });

  // Model / Look CRUD Modal State
  const [lookModalOpen, setLookModalOpen] = useState(false);
  const [editingLook, setEditingLook] = useState<Look | null>(null);
  const [lookForm, setLookForm] = useState({
    name: '',
    description: '',
    src640: '',
    selectedProductIds: [] as string[],
  });

  // Store & Firebase Settings Form State
  const [settingsForm, setSettingsForm] = useState<StoreSettings>({ ...settings });
  const curr = cleanCurrencySymbol(settingsForm.currencySymbol || settings.currencySymbol);
  const [firebaseStatus, setFirebaseStatus] = useState<{
    loading: boolean;
    message: string;
    type: 'success' | 'error' | 'info' | '';
  }>({ loading: false, message: '', type: '' });

  const selectedLook = looks.find((l) => l.id === selectedModelLookId) || looks[0];
  const focusedProduct = products.find((p) => p.id === focusedProductId);
  const getProduct = (id: string): Product | undefined => products.find((p) => p.id === id);

  // --------------------------------------------------------------------------
  // Admin Login Handler
  // --------------------------------------------------------------------------
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const correctUser = settings.adminUsername || 'admin';
    const correctPass = settings.adminPasswordHash || 'password123';

    if (loginUsername === correctUser && loginPassword === correctPass) {
      setIsAuthenticated(true);
      sessionStorage.setItem('runway_admin_auth', 'true');
      setLoginError('');
      const email = import.meta.env.VITE_FIREBASE_ADMIN_EMAIL || '';
      if (!email) {
        setFirebaseStatus({
          loading: false,
          message: 'Shared saving needs VITE_FIREBASE_ADMIN_EMAIL and a Firebase admin account. This login is local only until cloud access is configured.',
          type: 'error',
        });
        return;
      }
      const authResult = await signInStoreAdmin(email, loginPassword);
      setFirebaseStatus({
        loading: false,
        message: authResult.message,
        type: authResult.success ? 'success' : 'error',
      });
    } else {
      setLoginError('Invalid username or password. Default is admin / password123');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('runway_admin_auth');
    void signOutStoreAdmin();
  };

  // If not authenticated, show sleek Admin Login Form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center p-4">
        <div className="bg-white max-w-sm w-full p-8 border border-neutral-300 shadow-2xl">
          <div className="text-center mb-6">
            <span className="text-[10px] tracking-widest uppercase font-bold text-neutral-400 bg-neutral-100 px-2 py-0.5">
              Secure Access
            </span>
            <h2 className="text-xl font-bold mt-2 text-neutral-900">Admin Control Panel</h2>
            <p className="text-xs text-neutral-500 mt-1">
              Enter your credentials to manage clothes, runway models, and store settings.
            </p>
          </div>

          {loginError && (
            <div className="bg-red-50 text-red-700 p-2.5 text-xs mb-4 border border-red-200">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">Username</label>
              <input
                type="text"
                required
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Default: admin"
                className="w-full border border-neutral-300 p-2.5 bg-neutral-50 focus:bg-white focus:border-black focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-neutral-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Default: password123"
                className="w-full border border-neutral-300 p-2.5 bg-neutral-50 focus:bg-white focus:border-black focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#151413] hover:bg-neutral-800 text-white font-semibold text-xs tracking-wider uppercase transition-colors"
            >
              Sign In to Admin
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-neutral-100 text-center">
            <button
              type="button"
              onClick={onNavigateToRunway}
              className="text-xs text-neutral-500 hover:text-black hover:underline"
            >
              ← Return to Storefront
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderLadiesPieceThumbnail = (piece: LadiesPiece) => {
    if (piece.customImage) {
      return (
        <img
          src={piece.customImage}
          alt={piece.name}
          className="w-full h-full object-contain"
        />
      );
    }
    if (piece.box) {
      const [x0, x1, y0, y1] = piece.box;
      const w = x1 - x0;
      const h = y1 - y0;
      return (
        <svg viewBox={`${x0} ${y0} ${w} ${h}`} className="w-full h-full object-contain">
          <svg x={x0} y={y0} width={w} height={h} viewBox={`${x0} ${y0} ${w} ${h}`}>
            <image href={LADIES_PIECES_SHEET} width={960} height={720} />
          </svg>
        </svg>
      );
    }
    return <div className="text-neutral-400 text-xs">No image</div>;
  };

  // --------------------------------------------------------------------------
  // Clothes CRUD Handlers
  // --------------------------------------------------------------------------
  const openAddProductModal = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      vendor: settings.shopName || 'Studio Collection',
      price: '149.00',
      category: 'top',
      image: 'https://reel-ref-try-the-look.vercel.app/assets/source-tshirt.webp',
      sizes: 'S, M, L, XL',
      optionLegend: 'Size',
      fitDescription: 'Modern streetwear cut with relaxed proportions.',
      defaultPinX: 50,
      defaultPinY: 45,
      url: '#',
    });
    setProductModalOpen(true);
  };

  const openEditProductModal = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      vendor: product.vendor,
      price: product.price.toString(),
      category: product.category || 'top',
      image: product.image,
      sizes: product.sizes.join(', '),
      optionLegend: product.optionLegend,
      fitDescription: product.fitDescription || '',
      defaultPinX: product.defaultPinX ?? 50,
      defaultPinY: product.defaultPinY ?? 45,
      url: product.url,
    });
    setProductModalOpen(true);
  };

  const handleImageFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    onComplete: (dataUrl: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) onComplete(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const sizesArray = productForm.sizes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const parsedPrice = parseFloat(productForm.price) || 99.0;

    if (editingProduct) {
      // Update
      const updated: Product = {
        ...editingProduct,
        name: productForm.name,
        vendor: productForm.vendor,
        price: parsedPrice,
        category: productForm.category,
        image: productForm.image,
        sizes: sizesArray,
        optionLegend: productForm.optionLegend,
        fitDescription: productForm.fitDescription,
        defaultPinX: Number(productForm.defaultPinX),
        defaultPinY: Number(productForm.defaultPinY),
        url: productForm.url,
        variants: sizesArray.map((s, idx) => ({
          id: editingProduct.variants[idx]?.id || Math.floor(57000000000000 + Math.random() * 1000000000),
          a: true,
          o: [s],
        })),
      };
      const nextProducts = products.map((p) => (p.id === updated.id ? updated : p));
      onUpdateProducts(nextProducts);
      saveProducts(nextProducts);
    } else {
      // Create
      const newId = `product-${Date.now()}`;
      const newProduct: Product = {
        id: newId,
        name: productForm.name || 'Custom Garment',
        vendor: productForm.vendor || settings.shopName || 'Studio Collection',
        price: parsedPrice,
        category: productForm.category,
        image: productForm.image || 'https://reel-ref-try-the-look.vercel.app/assets/source-tshirt.webp',
        imageWidth: 400,
        imageHeight: productForm.category === 'shoes' ? 400 : 560,
        sizes: sizesArray.length > 0 ? sizesArray : ['S', 'M', 'L', 'XL'],
        optionLegend: productForm.optionLegend,
        fitDescription: productForm.fitDescription,
        defaultPinX: Number(productForm.defaultPinX),
        defaultPinY: Number(productForm.defaultPinY),
        url: productForm.url,
        variants: (sizesArray.length > 0 ? sizesArray : ['S', 'M', 'L', 'XL']).map((s) => ({
          id: Math.floor(57000000000000 + Math.random() * 1000000000),
          a: true,
          o: [s],
        })),
      };
      const nextProducts = [...products, newProduct];
      onUpdateProducts(nextProducts);
      saveProducts(nextProducts);
    }
    setProductModalOpen(false);
  };

  const handleDeleteProduct = (productId: string) => {
    if (!confirm('Are you sure you want to delete this piece?')) return;
    const nextProducts = products.filter((p) => p.id !== productId);
    onUpdateProducts(nextProducts);
    saveProducts(nextProducts);

    // Also remove from any look references
    const nextLooks = looks.map((look) => ({
      ...look,
      productIds: look.productIds.filter((id) => id !== productId),
      pins: look.pins.filter((pin) => pin.productId !== productId),
    }));
    onUpdateLooks(nextLooks);
    saveLooks(nextLooks);
  };

  // --------------------------------------------------------------------------
  // Model / Look CRUD Handlers
  // --------------------------------------------------------------------------
  const openAddLookModal = () => {
    setEditingLook(null);
    setLookForm({
      name: '',
      description: 'Styled streetwear silhouette.',
      src640: 'https://reel-ref-try-the-look.vercel.app/assets/model-1-640.webp',
      selectedProductIds: products.slice(0, 3).map((p) => p.id),
    });
    setLookModalOpen(true);
  };

  const openEditLookModal = (look: Look) => {
    setEditingLook(look);
    setLookForm({
      name: look.name,
      description: look.description,
      src640: look.src640,
      selectedProductIds: [...look.productIds],
    });
    setLookModalOpen(true);
  };

  const handleSaveLook = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingLook) {
      // Update
      const updatedPins: LookPin[] = lookForm.selectedProductIds.map((pId, idx) => {
        const existingPin = editingLook.pins.find((p) => p.productId === pId);
        const prod = products.find((p) => p.id === pId);
        return {
          num: idx + 1,
          productId: pId,
          left: existingPin?.left ?? prod?.defaultPinX ?? 50,
          top: existingPin?.top ?? prod?.defaultPinY ?? 30 + idx * 30,
        };
      });

      const updated: Look = {
        ...editingLook,
        name: lookForm.name,
        description: lookForm.description,
        src640: lookForm.src640,
        srcset1080: lookForm.src640,
        productIds: lookForm.selectedProductIds,
        pins: updatedPins,
      };

      const nextLooks = looks.map((l) => (l.id === updated.id ? updated : l));
      onUpdateLooks(nextLooks);
      saveLooks(nextLooks);
    } else {
      // Create new look
      const newLookId = `look-${Date.now()}`;
      const newPins: LookPin[] = lookForm.selectedProductIds.map((pId, idx) => {
        const prod = products.find((p) => p.id === pId);
        return {
          num: idx + 1,
          productId: pId,
          left: prod?.defaultPinX ?? 50,
          top: prod?.defaultPinY ?? 30 + idx * 30,
        };
      });

      const newLook: Look = {
        id: newLookId,
        key: `key_${Math.random().toString(36).substring(2, 8)}`,
        name: lookForm.name || 'New Street Look',
        description: lookForm.description || 'Full-body streetwear model',
        src640: lookForm.src640 || 'https://reel-ref-try-the-look.vercel.app/assets/model-1-640.webp',
        srcset1080: lookForm.src640 || 'https://reel-ref-try-the-look.vercel.app/assets/original-look-1.webp',
        productIds: lookForm.selectedProductIds,
        pins: newPins,
        isCustom: true,
      };

      const nextLooks = [...looks, newLook];
      onUpdateLooks(nextLooks);
      saveLooks(nextLooks);
    }
    setLookModalOpen(false);
  };

  const handleDeleteLook = (lookId: string) => {
    if (looks.length <= 1) {
      alert('You must have at least one runway look.');
      return;
    }
    if (!confirm('Are you sure you want to delete this look/model?')) return;
    const nextLooks = looks.filter((l) => l.id !== lookId);
    onUpdateLooks(nextLooks);
    saveLooks(nextLooks);
    if (selectedModelLookId === lookId) {
      setSelectedModelLookId(nextLooks[0].id);
    }
  };

  // Pin placement calibration on Model
  const handleModelClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCalibratingPin || !focusedProduct || !selectedLook) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const leftPercent = Math.round((clickX / rect.width) * 100);
    const topPercent = Math.round((clickY / rect.height) * 100);

    const updatedPins = [...selectedLook.pins];
    const existingIndex = updatedPins.findIndex((p) => p.productId === focusedProduct.id);

    if (existingIndex >= 0) {
      updatedPins[existingIndex] = {
        ...updatedPins[existingIndex],
        left: leftPercent,
        top: topPercent,
      };
    } else {
      updatedPins.push({
        num: updatedPins.length + 1,
        productId: focusedProduct.id,
        left: leftPercent,
        top: topPercent,
      });
    }

    const updatedLook: Look = {
      ...selectedLook,
      pins: updatedPins,
      productIds: selectedLook.productIds.includes(focusedProduct.id)
        ? selectedLook.productIds
        : [...selectedLook.productIds, focusedProduct.id],
    };

    const nextLooks = looks.map((l) => (l.id === updatedLook.id ? updatedLook : l));
    onUpdateLooks(nextLooks);
    saveLooks(nextLooks);
  };

  // --------------------------------------------------------------------------
  // 3D Rail Clothes CRUD Handlers
  // --------------------------------------------------------------------------
  const openAddRailModal = () => {
    setEditingRailItem(null);
    setRailForm({
      name: '',
      price: '48.00',
      image: 'https://reel-ref-try-the-look.vercel.app/assets/source-tshirt.webp',
    });
    setRailModalOpen(true);
  };

  const openEditRailModal = (item: RailItem) => {
    setEditingRailItem(item);
    setRailForm({
      name: item.name,
      price: item.price.toString(),
      image: item.image || '',
    });
    setRailModalOpen(true);
  };

  const handleSaveRailItem = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = parseFloat(railForm.price) || 48.0;
    if (editingRailItem) {
      const updated: RailItem = {
        ...editingRailItem,
        name: railForm.name || 'Brand Piece',
        price: parsedPrice,
        image: railForm.image || undefined,
        spriteIndex: railForm.image ? undefined : editingRailItem.spriteIndex,
      };
      const next = railItems.map((r) => (r.id === updated.id ? updated : r));
      setRailItems(next);
      saveRailItems(next);
    } else {
      const newId = `rail-${Date.now()}`;
      const newItem: RailItem = {
        id: newId,
        name: railForm.name || 'Brand Garment',
        price: parsedPrice,
        image: railForm.image || 'https://reel-ref-try-the-look.vercel.app/assets/source-tshirt.webp',
      };
      const next = [...railItems, newItem];
      setRailItems(next);
      saveRailItems(next);
    }
    setRailModalOpen(false);
  };

  const handleDeleteRailItem = (id: string) => {
    if (railItems.length <= 1) {
      alert('You must have at least one garment on the rail.');
      return;
    }
    if (!confirm('Are you sure you want to remove this piece from the 3D rail?')) return;
    const next = railItems.filter((r) => r.id !== id);
    setRailItems(next);
    saveRailItems(next);
  };

  const handleMoveRailItem = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= railItems.length) return;
    const next = [...railItems];
    const temp = next[idx];
    next[idx] = next[target];
    next[target] = temp;
    setRailItems(next);
    saveRailItems(next);
  };

  const handleImportProductToRail = (prod: Product) => {
    const newId = `rail-${Date.now()}-${prod.id}`;
    const newItem: RailItem = {
      id: newId,
      name: prod.name,
      price: prod.price,
      image: prod.image,
    };
    const next = [...railItems, newItem];
    setRailItems(next);
    saveRailItems(next);
    alert(`"${prod.name}" has been placed onto your 3D Hanging Rail!`);
  };

  const handleResetRail = () => {
    if (confirm('Reset the 3D rail to default garments collection?')) {
      const res = resetRailItems();
      setRailItems(res);
    }
  };

  // --------------------------------------------------------------------------
  // Ladies Collection CRUD Handlers
  // --------------------------------------------------------------------------
  const openAddLadiesModal = () => {
    setEditingLadiesPiece(null);
    setLadiesPieceForm({
      name: '',
      price: '1200.00',
      lookNumber: 15,
      pieceNumber: 1,
      customImage: '',
    });
    setLadiesModalOpen(true);
  };

  const openEditLadiesModal = (piece: LadiesPiece) => {
    setEditingLadiesPiece(piece);
    setLadiesPieceForm({
      name: piece.name,
      price: piece.price.toString(),
      lookNumber: piece.lookNumber,
      pieceNumber: piece.pieceNumber,
      customImage: piece.customImage || '',
    });
    setLadiesModalOpen(true);
  };

  const handleSaveLadiesPiece = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = parseFloat(ladiesPieceForm.price) || 500;
    if (editingLadiesPiece) {
      const updated: LadiesPiece = {
        ...editingLadiesPiece,
        name: ladiesPieceForm.name || 'Ladies Piece',
        price: parsedPrice,
        lookNumber: Number(ladiesPieceForm.lookNumber) || 15,
        pieceNumber: Number(ladiesPieceForm.pieceNumber) || 1,
        customImage: ladiesPieceForm.customImage || undefined,
      };
      const next = ladiesPieces.map((p) => (p.id === updated.id ? updated : p));
      setLadiesPieces(next);
      saveLadiesPieces(next);
    } else {
      const newId = `lp-${Date.now()}`;
      const newItem: LadiesPiece = {
        id: newId,
        name: ladiesPieceForm.name || 'New Ladies Piece',
        price: parsedPrice,
        lookNumber: Number(ladiesPieceForm.lookNumber) || 15,
        pieceNumber: Number(ladiesPieceForm.pieceNumber) || 1,
        customImage: ladiesPieceForm.customImage || undefined,
      };
      const next = [...ladiesPieces, newItem];
      setLadiesPieces(next);
      saveLadiesPieces(next);
    }
    setLadiesModalOpen(false);
  };

  const handleDeleteLadiesPiece = (id: string) => {
    if (ladiesPieces.length <= 1) {
      alert('You must have at least one piece in the ladies collection.');
      return;
    }
    if (!confirm('Are you sure you want to remove this piece from the ladies collection?')) return;
    const next = ladiesPieces.filter((p) => p.id !== id);
    setLadiesPieces(next);
    saveLadiesPieces(next);
  };

  const handleSaveLadiesSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveLadiesSettings(ladiesSettingsForm);
    setLadiesSettings(ladiesSettingsForm);
    setLadiesSettingsModalOpen(false);
  };

  const handleResetLadies = () => {
    if (confirm('Reset Ladies Collection to the default 12 runway pieces and season info?')) {
      const res = resetLadiesData();
      setLadiesPieces(res.pieces);
      setLadiesSettings(res.settings);
      setLadiesSettingsForm(res.settings);
    }
  };

  // --------------------------------------------------------------------------
  // Ladies 3D Rail Tops CRUD Handlers
  // --------------------------------------------------------------------------
  const openAddLadiesRailModal = () => {
    setEditingLadiesRailItem(null);
    setLadiesRailForm({
      name: '',
      price: '380.00',
      image: 'https://images.unsplash.com/photo-1598554747436-c9293d6a588f?auto=format&fit=crop&w=800&q=80',
      fitDescription: 'Relaxed airy silhouette on natural hanger.',
    });
    setLadiesRailModalOpen(true);
  };

  const openEditLadiesRailModal = (item: LadiesRailItem) => {
    setEditingLadiesRailItem(item);
    setLadiesRailForm({
      name: item.name,
      price: item.price.toString(),
      image: item.image,
      fitDescription: item.fitDescription || '',
    });
    setLadiesRailModalOpen(true);
  };

  const handleSaveLadiesRailItem = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = parseFloat(ladiesRailForm.price) || 380;
    if (editingLadiesRailItem) {
      const updated: LadiesRailItem = {
        ...editingLadiesRailItem,
        name: ladiesRailForm.name || 'Ladies Top',
        price: parsedPrice,
        image: ladiesRailForm.image || 'https://images.unsplash.com/photo-1598554747436-c9293d6a588f?auto=format&fit=crop&w=800&q=80',
        fitDescription: ladiesRailForm.fitDescription || 'Tailored contemporary blouse silhouette.',
      };
      const next = ladiesRailItems.map((r) => (r.id === updated.id ? updated : r));
      setLadiesRailItems(next);
      saveLadiesRailItems(next);
    } else {
      const newId = `lrail-${Date.now()}`;
      const newItem: LadiesRailItem = {
        id: newId,
        name: ladiesRailForm.name || 'New Ladies Top',
        price: parsedPrice,
        image: ladiesRailForm.image || 'https://images.unsplash.com/photo-1598554747436-c9293d6a588f?auto=format&fit=crop&w=800&q=80',
        fitDescription: ladiesRailForm.fitDescription || 'Contemporary relaxed drape on hanger.',
      };
      const next = [...ladiesRailItems, newItem];
      setLadiesRailItems(next);
      saveLadiesRailItems(next);
    }
    setLadiesRailModalOpen(false);
  };

  const handleDeleteLadiesRailItem = (id: string) => {
    if (ladiesRailItems.length <= 1) {
      alert('You must have at least one top on the ladies rail.');
      return;
    }
    if (!confirm('Are you sure you want to remove this top from the ladies 3D rail?')) return;
    const next = ladiesRailItems.filter((r) => r.id !== id);
    setLadiesRailItems(next);
    saveLadiesRailItems(next);
  };

  const handleMoveLadiesRailItem = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= ladiesRailItems.length) return;
    const next = [...ladiesRailItems];
    const temp = next[idx];
    next[idx] = next[target];
    next[target] = temp;
    setLadiesRailItems(next);
    saveLadiesRailItems(next);
  };

  const handleResetLadiesRail = () => {
    if (confirm('Reset Ladies 3D rail to default 10 hanging tops?')) {
      const res = resetLadiesRailItems();
      setLadiesRailItems(res);
    }
  };

  const handleReset = () => {
    if (confirm('Reset all clothes and models to the default catalog dataset?')) {
      const res = resetToDefaults();
      onUpdateProducts(res.products);
      onUpdateLooks(res.looks);
      setSelectedModelLookId(res.looks[0].id);
    }
  };

  // --------------------------------------------------------------------------
  // Settings & Firebase Handlers
  // --------------------------------------------------------------------------
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(settingsForm);
    saveStoredSettings(settingsForm);
    setFirebaseStatus({ loading: true, message: 'Saving shared store settings...', type: 'info' });
    const result = await saveStoreSettingsToFirestore(settingsForm);
    setFirebaseStatus({
      loading: false,
      message: result.success
        ? result.message
        : `Saved only on this device. Shared save failed: ${result.message}`,
      type: result.success ? 'success' : 'error',
    });
    alert(result.success
      ? 'Store settings saved for all devices.'
      : `Settings saved on this device only. To share them across devices: ${result.message}`);
  };

  const handleTestFirebase = async () => {
    setFirebaseStatus({ loading: true, message: 'Pinging Firebase Firestore...', type: 'info' });
    const res = await testFirestoreConnection();
    setFirebaseStatus({
      loading: false,
      message: res.message,
      type: res.success ? 'success' : 'error',
    });
  };

  const handleSyncToFirestore = async () => {
    setFirebaseStatus({ loading: true, message: 'Syncing catalog to Firestore...', type: 'info' });
    const res = await syncCatalogToFirestore(products, looks, settingsForm);
    setFirebaseStatus({
      loading: false,
      message: res.message,
      type: res.success ? 'success' : 'error',
    });
  };

  const handleFetchFromFirestore = async () => {
    setFirebaseStatus({ loading: true, message: 'Fetching catalog from Firestore...', type: 'info' });
    const res = await fetchCatalogFromFirestore();
    if (res && res.products.length > 0) {
      onUpdateProducts(res.products);
      saveProducts(res.products);
      if (res.looks.length > 0) {
        onUpdateLooks(res.looks);
        saveLooks(res.looks);
      }
      setFirebaseStatus({
        loading: false,
        message: `Loaded ${res.products.length} products and ${res.looks.length} looks from Firestore!`,
        type: 'success',
      });
    } else {
      setFirebaseStatus({
        loading: false,
        message: 'No records found or could not read Firestore collections.',
        type: 'error',
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#151413] flex flex-col font-sans">
      {/* Admin Top Action Header */}
      <div className="bg-white border-b border-[#e4e4e4] px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="bg-[#151413] text-white text-[11px] font-bold tracking-widest px-2.5 py-1">
            ADMIN
          </span>
          <h1 className="text-lg font-bold tracking-tight">
            {settings.shopName} — Management Panel
          </h1>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center bg-[#f0f0f0] p-1 rounded-sm gap-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('fit_studio')}
            className={`px-3 py-1.5 transition-colors ${
              activeTab === 'fit_studio'
                ? 'bg-white text-black shadow-sm font-semibold'
                : 'text-neutral-600 hover:text-black'
            }`}
          >
            Virtual Fitting Studio
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('clothes')}
            className={`px-3 py-1.5 transition-colors ${
              activeTab === 'clothes'
                ? 'bg-white text-black shadow-sm font-semibold'
                : 'text-neutral-600 hover:text-black'
            }`}
          >
            Clothes Inventory ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('models')}
            className={`px-3 py-1.5 transition-colors ${
              activeTab === 'models'
                ? 'bg-white text-black shadow-sm font-semibold'
                : 'text-neutral-600 hover:text-black'
            }`}
          >
            Runway Models ({looks.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rail')}
            className={`px-3 py-1.5 transition-colors ${
              activeTab === 'rail'
                ? 'bg-white text-black shadow-sm font-semibold'
                : 'text-neutral-600 hover:text-black'
            }`}
          >
            3D Rail Clothes ({railItems.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ladies')}
            className={`px-3 py-1.5 transition-colors ${
              activeTab === 'ladies'
                ? 'bg-white text-black shadow-sm font-semibold'
                : 'text-neutral-600 hover:text-black'
            }`}
          >
            Ladies Lookbook ({ladiesPieces.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ladies_rail')}
            className={`px-3 py-1.5 transition-colors ${
              activeTab === 'ladies_rail'
                ? 'bg-white text-black shadow-sm font-semibold'
                : 'text-neutral-600 hover:text-black'
            }`}
          >
            Ladies 3D Tops ({ladiesRailItems.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 transition-colors ${
              activeTab === 'settings'
                ? 'bg-white text-black shadow-sm font-semibold'
                : 'text-neutral-600 hover:text-black'
            }`}
          >
            Shop & Firebase Settings
          </button>
        </div>

        {/* Top actions: View Storefront & Logout */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onNavigateToRunway}
            className="px-4 py-2 bg-[#151413] text-white text-xs font-semibold tracking-wider hover:bg-neutral-800 transition-colors flex items-center gap-1.5"
          >
            <span>View Storefront</span>
            <span>↗</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="text-xs text-neutral-500 hover:text-black underline"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
        {/* ================================================================== */}
        {/* TAB 1: VIRTUAL FITTING STUDIO */}
        {/* ================================================================== */}
        {activeTab === 'fit_studio' && (
          <div className="space-y-6">
            <div className="bg-white border border-[#e4e4e4] p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Interactive Fitting Studio</h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Click any clothing piece below to test how it fits on your model. You can calibrate pin coordinates in real time.
                </p>
              </div>

              {/* Model Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-neutral-600">Active Model:</span>
                <select
                  value={selectedModelLookId}
                  onChange={(e) => setSelectedModelLookId(e.target.value)}
                  className="text-xs border border-neutral-300 py-1.5 px-3 bg-white focus:outline-none focus:border-black font-medium"
                >
                  {looks.map((look, i) => (
                    <option key={look.id} value={look.id}>
                      Look 0{i + 1} — {look.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Full-Body Model Canvas with interactive pins */}
              <div className="lg:col-span-6 bg-white border border-[#e4e4e4] p-6 flex flex-col items-center">
                <div className="w-full flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                      Model Viewport
                    </span>
                    <h3 className="text-sm font-semibold">{selectedLook?.name}</h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsCalibratingPin(!isCalibratingPin)}
                    className={`text-xs px-3 py-1 font-medium transition-colors ${
                      isCalibratingPin
                        ? 'bg-black text-white'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    }`}
                  >
                    {isCalibratingPin ? '✓ Click on model to set pin' : 'Reposition Pin'}
                  </button>
                </div>

                {/* Model Interactive Figure */}
                <div
                  className="relative w-[320px] h-[570px] bg-white cursor-crosshair border border-dashed border-transparent hover:border-neutral-300 transition-colors select-none"
                  onClick={handleModelClick}
                  title={
                    isCalibratingPin
                      ? `Click anywhere to place ${focusedProduct?.name || 'garment'}`
                      : 'Interactive Model Figure'
                  }
                >
                  {/* Subtle floor contact shadow */}
                  <span
                    className="absolute left-1/2 bottom-2 w-3/4 h-6 -translate-x-1/2 rounded-full pointer-events-none"
                    style={{
                      background: 'radial-gradient(ellipse at center, rgba(20,16,12,0.25) 0%, transparent 70%)',
                      filter: 'blur(3px)',
                    }}
                  />

                  {/* Model Image */}
                  <img
                    src={selectedLook?.src640}
                    alt={selectedLook?.name}
                    className="w-full h-full object-contain object-bottom pointer-events-none"
                  />

                  {/* Garment Fit Preview Overlay on Model */}
                  {focusedProduct && (
                    <div
                      className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 transition-all duration-300"
                      style={{
                        left: `${
                          selectedLook?.pins.find((p) => p.productId === focusedProduct.id)?.left ??
                          focusedProduct.defaultPinX ??
                          50
                        }%`,
                        top: `${
                          selectedLook?.pins.find((p) => p.productId === focusedProduct.id)?.top ??
                          focusedProduct.defaultPinY ??
                          50
                        }%`,
                        width: focusedProduct.category === 'shoes' ? '120px' : '160px',
                      }}
                    >
                      <img
                        src={focusedProduct.image}
                        alt={focusedProduct.name}
                        className="w-full h-auto object-contain drop-shadow-xl"
                      />
                    </div>
                  )}

                  {/* Render Pins on the Model */}
                  {selectedLook?.pins.map((pin) => {
                    const prod = getProduct(pin.productId);
                    const isFocused = focusedProductId === pin.productId;
                    return (
                      <div
                        key={pin.num}
                        className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer z-20"
                        style={{ left: `${pin.left}%`, top: `${pin.top}%` }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFocusedProductId(pin.productId);
                        }}
                      >
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-md transition-all ${
                            isFocused
                              ? 'bg-black text-white scale-125 ring-4 ring-black/20'
                              : 'bg-white/90 text-black hover:bg-black hover:text-white backdrop-blur-sm'
                          }`}
                        >
                          {pin.num}
                        </div>
                        {/* Tooltip */}
                        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-md border border-neutral-200 px-2.5 py-1 text-[11px] whitespace-nowrap shadow-lg rounded-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                          <span className="font-semibold text-black">{prod?.name}</span>
                          <span className="text-neutral-500 ml-1.5">{prod ? formatCurrency(prod.price, curr) : ''}</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Calibration hint overlay */}
                  {isCalibratingPin && (
                    <div className="absolute top-2 inset-x-2 bg-black/80 text-white text-[11px] py-1.5 px-3 text-center pointer-events-none z-30">
                      Calibrating: Click anywhere on model body to position {focusedProduct?.name}
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-neutral-400 mt-4 text-center">
                  Full body cutout. Soles aligned to baseline with alpha feet scanner.
                </p>
              </div>

              {/* Right Column: Wardrobe / Clothes rack */}
              <div className="lg:col-span-6 space-y-6">
                {/* Active Fitting Breakdown Card */}
                {focusedProduct ? (
                  <div className="bg-white border border-[#e4e4e4] p-5 shadow-sm">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">
                      Currently Fitted Piece
                    </span>
                    <div className="flex items-start gap-4 mt-2">
                      <img
                        src={focusedProduct.image}
                        alt={focusedProduct.name}
                        className="w-20 h-24 object-contain bg-neutral-50 border border-neutral-200 p-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-base font-bold">{focusedProduct.name}</h4>
                          <span className="text-sm font-semibold">{formatCurrency(focusedProduct.price, curr)}</span>
                        </div>
                        <p className="text-xs text-neutral-500 uppercase tracking-wider mt-0.5">
                          {focusedProduct.vendor} · {focusedProduct.category || 'Apparel'}
                        </p>
                        <p className="text-xs text-neutral-700 mt-2 bg-neutral-50 p-2 border-l-2 border-black">
                          {focusedProduct.fitDescription || 'Tailored contemporary streetwear drape.'}
                        </p>

                        <div className="flex flex-wrap gap-1.5 mt-3">
                          <span className="text-[10px] text-neutral-500 self-center mr-1">Sizes:</span>
                          {focusedProduct.sizes.map((s) => (
                            <span
                              key={s}
                              className="px-2 py-0.5 text-[11px] bg-neutral-100 border border-neutral-200 font-medium"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-[#e4e4e4] p-6 text-center text-xs text-neutral-500">
                    Select any piece from the wardrobe below to inspect its fit on the model.
                  </div>
                )}

                {/* Clothing Wardrobe Grid */}
                <div className="bg-white border border-[#e4e4e4] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                      Clothes Wardrobe — Click to Fit on Model
                    </h3>
                    <button
                      type="button"
                      onClick={openAddProductModal}
                      className="text-xs font-semibold text-black hover:underline"
                    >
                      + Add New Garment
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {products.map((prod) => {
                      const isFocused = focusedProductId === prod.id;
                      const isAssigned = selectedLook?.productIds.includes(prod.id);

                      return (
                        <div
                          key={prod.id}
                          onClick={() => {
                            setFocusedProductId(prod.id);
                            if (selectedLook && !selectedLook.productIds.includes(prod.id)) {
                              const newLook: Look = {
                                ...selectedLook,
                                productIds: [...selectedLook.productIds, prod.id],
                                pins: [
                                  ...selectedLook.pins,
                                  {
                                    num: selectedLook.pins.length + 1,
                                    productId: prod.id,
                                    left: prod.defaultPinX ?? 50,
                                    top: prod.defaultPinY ?? 50,
                                  },
                                ],
                              };
                              const nextLooks = looks.map((l) =>
                                l.id === newLook.id ? newLook : l
                              );
                              onUpdateLooks(nextLooks);
                              saveLooks(nextLooks);
                            }
                          }}
                          className={`relative border p-2.5 cursor-pointer transition-all flex flex-col justify-between ${
                            isFocused
                              ? 'border-black ring-2 ring-black/10 bg-neutral-50'
                              : 'border-neutral-200 hover:border-neutral-400 bg-white'
                          }`}
                        >
                          {isAssigned && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-black" title="In active look" />
                          )}
                          <div className="aspect-[4/5] bg-neutral-50 mb-2 flex items-center justify-center overflow-hidden">
                            <img
                              src={prod.image}
                              alt={prod.name}
                              className="w-full h-full object-contain p-1"
                            />
                          </div>
                          <div>
                            <div className="text-xs font-semibold truncate">{prod.name}</div>
                            <div className="text-[11px] text-neutral-500 font-medium">
                              {formatCurrency(prod.price, curr)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 2: CLOTHES INVENTORY (FULL CRUD) */}
        {/* ================================================================== */}
        {activeTab === 'clothes' && (
          <div className="space-y-6">
            <div className="bg-white border border-[#e4e4e4] p-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Clothes & Shoes Catalog</h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Manage all garment details, prices, sizes, and default fitting coordinates.
                </p>
              </div>
              <button
                type="button"
                onClick={openAddProductModal}
                className="px-4 py-2 bg-[#151413] text-white text-xs font-semibold hover:bg-neutral-800 transition-colors"
              >
                + Add New Piece
              </button>
            </div>

            <div className="bg-white border border-[#e4e4e4] overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Item</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Vendor</th>
                    <th className="py-3 px-4">Price</th>
                    <th className="py-3 px-4">Sizes</th>
                    <th className="py-3 px-4">Fit Drape</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {products.map((prod) => (
                    <tr key={prod.id} className="hover:bg-neutral-50/50">
                      <td className="py-3 px-4 flex items-center gap-3">
                        <img
                          src={prod.image}
                          alt={prod.name}
                          className="w-10 h-12 object-contain bg-neutral-100 border border-neutral-200 p-0.5"
                        />
                        <div>
                          <div className="font-semibold text-neutral-900">{prod.name}</div>
                          <div className="text-[10px] text-neutral-400">{prod.id}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4 capitalize text-neutral-600">{prod.category || 'top'}</td>
                      <td className="py-3 px-4 text-neutral-600">{prod.vendor}</td>
                      <td className="py-3 px-4 font-semibold">{formatCurrency(prod.price, curr)}</td>
                      <td className="py-3 px-4">
                        <span className="text-neutral-600">{prod.sizes.join(', ')}</span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-neutral-500" title={prod.fitDescription}>
                        {prod.fitDescription || 'Standard fit'}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => handleImportProductToRail(prod)}
                          className="text-[11px] font-semibold bg-neutral-100 hover:bg-black hover:text-white px-2 py-1 transition-colors border border-neutral-300 inline-block"
                          title="Place on 3D Hanging Rail"
                        >
                          + Put on 3D Rail
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditProductModal(prod)}
                          className="text-neutral-700 hover:text-black font-medium underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(prod.id)}
                          className="text-neutral-400 hover:text-red-600 font-medium ml-2"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 3: RUNWAY MODELS (FULL CRUD) */}
        {/* ================================================================== */}
        {activeTab === 'models' && (
          <div className="space-y-6">
            <div className="bg-white border border-[#e4e4e4] p-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Runway Models & Looks</h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Upload model photographs, assign clothes to each look, and adjust the 3D ring sequence.
                </p>
              </div>
              <button
                type="button"
                onClick={openAddLookModal}
                className="px-4 py-2 bg-[#151413] text-white text-xs font-semibold hover:bg-neutral-800 transition-colors"
              >
                + Upload New Model / Look
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {looks.map((look, i) => (
                <div
                  key={look.id}
                  className="bg-white border border-[#e4e4e4] p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                        Look 0{i + 1}
                      </span>
                      {look.isCustom && (
                        <span className="text-[9px] bg-black text-white px-1.5 py-0.5 uppercase tracking-wider font-semibold">
                          Custom Upload
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-neutral-900">{look.name}</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">{look.description}</p>

                    {/* Model Cutout Preview */}
                    <div className="h-64 my-4 bg-neutral-50 flex items-center justify-center border border-neutral-100 overflow-hidden relative">
                      <img
                        src={look.src640}
                        alt={look.name}
                        className="h-full object-contain object-bottom"
                      />
                      <span className="absolute bottom-2 right-2 text-[10px] bg-black/60 text-white px-2 py-0.5 backdrop-blur-sm">
                        {look.pins.length} Pins
                      </span>
                    </div>

                    {/* Pieces assigned */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                        Assigned Pieces:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {look.productIds.map((pId) => {
                          const prod = getProduct(pId);
                          return (
                            <span
                              key={pId}
                              className="text-[11px] bg-neutral-100 px-2 py-0.5 text-neutral-700 border border-neutral-200"
                            >
                              {prod?.name || pId}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100 mt-4 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => openEditLookModal(look)}
                      className="text-black hover:underline"
                    >
                      Edit Model & Pieces
                    </button>
                    {looks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteLook(look.id)}
                        className="text-neutral-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 4: 3D RAIL CLOTHES (FULL CRUD) */}
        {/* ================================================================== */}
        {activeTab === 'rail' && (
          <div className="space-y-6">
            <div className="bg-white border border-[#e4e4e4] p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <h2 className="text-base font-semibold">
                    3D Hanging Rail Collection ({railItems.length} Pieces)
                  </h2>
                </div>
                <p className="text-xs text-neutral-500 mt-1 max-w-2xl leading-relaxed">
                  These are the clothes that hang on the polished chrome rail in your storefront. Every piece here hangs edge-on in 3D, swings forward when hovered, slides adjacent clothes apart, and lifts into full detail view on click.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetRail}
                  className="px-3 py-2 border border-neutral-300 text-neutral-700 text-xs font-medium hover:bg-neutral-50 transition-colors"
                >
                  Reset Defaults
                </button>
                <button
                  type="button"
                  onClick={openAddRailModal}
                  className="px-4 py-2 bg-[#151413] text-white text-xs font-semibold hover:bg-neutral-800 transition-colors flex items-center gap-1.5"
                >
                  <span>+</span>
                  <span>Add Brand Clothes</span>
                </button>
              </div>
            </div>

            {/* Quick Import from Store Inventory Banner */}
            <div className="bg-[#19191c] text-white p-4 border border-neutral-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Quick Sync
                </span>
                <h4 className="text-sm font-semibold text-neutral-100">
                  Import pieces from your Clothes Inventory onto the 3D Rail
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <select
                  id="import-prod-select"
                  className="text-xs bg-neutral-900 border border-neutral-700 text-white py-1.5 px-3 focus:outline-none focus:border-white"
                  defaultValue=""
                  onChange={(e) => {
                    const prod = products.find((p) => p.id === e.target.value);
                    if (prod) {
                      handleImportProductToRail(prod);
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="" disabled>Select garment to add to 3D rail...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatCurrency(p.price, curr)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Rail Garments Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {railItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="bg-white border border-[#e4e4e4] p-4 flex flex-col justify-between hover:shadow-md transition-shadow relative group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                        Slot #{String(idx + 1).padStart(2, '0')}
                      </span>
                      {item.image ? (
                        <span className="text-[9px] bg-black text-white px-1.5 py-0.5 uppercase tracking-wider font-semibold">
                          Custom Brand
                        </span>
                      ) : (
                        <span className="text-[9px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 uppercase tracking-wider font-semibold">
                          Preset
                        </span>
                      )}
                    </div>

                    {/* Garment Image Preview */}
                    <div className="h-44 bg-neutral-900 rounded-sm p-3 flex items-center justify-center relative overflow-hidden mb-3 border border-neutral-800">
                      {/* Subtle chrome rail line indication */}
                      <div className="absolute top-3 inset-x-2 h-1 bg-gradient-to-r from-neutral-500 via-neutral-200 to-neutral-500 rounded-full opacity-60 pointer-events-none" />

                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="max-h-36 max-w-full object-contain filter drop-shadow-lg"
                        />
                      ) : (
                        <div className="text-center text-neutral-400 text-xs">
                          <span className="text-xl block mb-1">👕</span>
                          <span className="text-[10px] tracking-wider uppercase">High-Res Sprite</span>
                        </div>
                      )}
                    </div>

                    <h4 className="font-bold text-sm text-neutral-900 truncate" title={item.name}>
                      {item.name}
                    </h4>
                    <div className="text-xs font-semibold text-neutral-600 mt-0.5">
                      {formatCurrency(item.price, curr)}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
                    {/* Reorder Buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveRailItem(idx, -1)}
                        disabled={idx === 0}
                        title="Move left on rail"
                        className="w-6 h-6 border border-neutral-200 grid place-items-center text-neutral-600 hover:border-black disabled:opacity-30 disabled:pointer-events-none"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveRailItem(idx, 1)}
                        disabled={idx === railItems.length - 1}
                        title="Move right on rail"
                        className="w-6 h-6 border border-neutral-200 grid place-items-center text-neutral-600 hover:border-black disabled:opacity-30 disabled:pointer-events-none"
                      >
                        →
                      </button>
                    </div>

                    {/* Edit & Delete */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditRailModal(item)}
                        className="text-neutral-700 hover:text-black font-semibold underline text-xs"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRailItem(item.id)}
                        className="text-neutral-400 hover:text-red-600 font-medium text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 5: LADIES COLLECTION (MAISON VELL RUNWAY DEPTH LOOKBOOK)       */}
        {/* ================================================================== */}
        {activeTab === 'ladies' && (
          <div className="space-y-6">
            <div className="bg-white border border-[#e4e4e4] p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse" />
                  <h2 className="text-base font-semibold">
                    Ladies Runway Depth Lookbook ({ladiesPieces.length} Pieces)
                  </h2>
                </div>
                <p className="text-xs text-neutral-500 mt-1 max-w-2xl leading-relaxed">
                  These 12 pieces and 6 runway looks are featured on the infinite 3D perspective runway at the bottom of your storefront. Dragging and scrolling moves the entire line forward, synchronized with your product rail.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetLadies}
                  className="px-3 py-2 border border-neutral-300 text-neutral-700 text-xs font-medium hover:bg-neutral-50 transition-colors"
                >
                  Reset Defaults
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLadiesSettingsForm({ ...ladiesSettings });
                    setLadiesSettingsModalOpen(true);
                  }}
                  className="px-3 py-2 border border-neutral-800 text-neutral-900 text-xs font-medium hover:bg-neutral-100 transition-colors"
                >
                  Edit Season Info
                </button>
                <button
                  type="button"
                  onClick={openAddLadiesModal}
                  className="px-4 py-2 bg-[#151413] text-white text-xs font-semibold hover:bg-neutral-800 transition-colors flex items-center gap-1.5"
                >
                  <span>+</span>
                  <span>Add Ladies Piece</span>
                </button>
              </div>
            </div>

            {/* Current Season Info Card */}
            <div className="bg-[#121418] text-white p-5 border border-neutral-800 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold tracking-widest uppercase text-pink-400">
                  Current Lookbook Theme
                </span>
                <h3 className="text-lg font-bold tracking-tight text-white font-['Michroma']">
                  {ladiesSettings.seasonTitle || 'Spring Summer 2027'}
                </h3>
                <p className="text-xs text-neutral-300 max-w-xl italic">
                  "{ladiesSettings.subtitle}"
                </p>
              </div>
              <div className="flex items-center gap-4 bg-neutral-900/80 px-4 py-2.5 rounded border border-neutral-700">
                <div className="text-center">
                  <span className="text-[10px] uppercase text-neutral-400 block font-semibold">Looks Range</span>
                  <span className="text-sm font-bold text-white font-mono">
                    Look {ladiesSettings.firstLookNumber} – Look {ladiesSettings.firstLookNumber + 5}
                  </span>
                </div>
                <div className="h-6 w-px bg-neutral-700" />
                <div className="text-center">
                  <span className="text-[10px] uppercase text-neutral-400 block font-semibold">Total Pieces</span>
                  <span className="text-sm font-bold text-pink-300 font-mono">
                    {ladiesPieces.length} Items
                  </span>
                </div>
              </div>
            </div>

            {/* Pieces Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {ladiesPieces.map((piece, idx) => (
                <div
                  key={piece.id}
                  className="bg-white border border-[#e4e4e4] p-4 flex flex-col justify-between hover:shadow-md transition-shadow relative group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest bg-neutral-100 px-2 py-0.5 rounded">
                        Look #{piece.lookNumber} · Piece {piece.pieceNumber}
                      </span>
                      <span className="text-[11px] font-mono text-neutral-400">
                        #{idx + 1}
                      </span>
                    </div>

                    {/* Image Preview Container */}
                    <div className="h-44 w-full bg-[#f8f9fa] border border-neutral-100 flex items-center justify-center p-3 overflow-hidden relative">
                      {renderLadiesPieceThumbnail(piece)}
                    </div>

                    <h4 className="font-bold text-sm text-neutral-900 mt-3 line-clamp-1">
                      {piece.name}
                    </h4>
                    <div className="text-xs font-semibold text-neutral-700 mt-1">
                      {formatCurrency(piece.price, curr)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                    <span className="text-[10px] text-neutral-400 uppercase tracking-wider">
                      {piece.customImage ? 'Custom Photo' : 'Sprite Sheet'}
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openEditLadiesModal(piece)}
                        className="text-neutral-800 hover:text-black font-semibold underline text-xs cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLadiesPiece(piece.id)}
                        className="text-neutral-400 hover:text-red-600 font-medium text-xs cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 5: LADIES 3D RAIL TOPS (FULL CRUD) */}
        {/* ================================================================== */}
        {activeTab === 'ladies_rail' && (
          <div className="space-y-6">
            <div className="bg-white border border-[#e4e4e4] p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <h2 className="text-base font-semibold">
                    Ladies 3D Hanging Rail Collection ({ladiesRailItems.length} Tops)
                  </h2>
                </div>
                <p className="text-xs text-neutral-500 mt-1 max-w-2xl leading-relaxed">
                  These are the women&apos;s tops and blouses that hang on wooden hangers on your 3D rail. Hovering tilts garments forward with interactive 3D perspective and creates gaps between adjacent clothes. Full add-to-bag & inspection capability.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetLadiesRail}
                  className="px-3 py-2 border border-neutral-300 text-neutral-700 text-xs font-medium hover:bg-neutral-50 transition-colors"
                >
                  Reset Defaults
                </button>
                <button
                  type="button"
                  onClick={openAddLadiesRailModal}
                  className="px-4 py-2 bg-[#151413] text-white text-xs font-semibold hover:bg-neutral-800 transition-colors flex items-center gap-1.5"
                >
                  <span>+</span>
                  <span>Add Ladies Top</span>
                </button>
              </div>
            </div>

            {/* Ladies Rail Garments Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {ladiesRailItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="bg-white border border-[#e4e4e4] p-4 flex flex-col justify-between hover:shadow-md transition-shadow relative group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                        Slot #{String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="text-[9px] bg-neutral-900 text-neutral-200 px-1.5 py-0.5 uppercase tracking-wider font-semibold">
                        Wooden Hanger
                      </span>
                    </div>

                    {/* Garment Image Preview */}
                    <div className="h-44 bg-[#0d0f12] rounded-sm p-3 flex items-center justify-center relative overflow-hidden mb-3 border border-neutral-800">
                      {/* Subtle chrome rail line indication */}
                      <div className="absolute top-3 inset-x-2 h-1 bg-gradient-to-r from-neutral-600 via-neutral-300 to-neutral-600 rounded-full opacity-60 pointer-events-none" />

                      <img
                        src={item.image}
                        alt={item.name}
                        className="max-h-36 max-w-full object-contain filter drop-shadow-lg"
                      />
                    </div>

                    <h4 className="font-bold text-sm text-neutral-900 truncate" title={item.name}>
                      {item.name}
                    </h4>
                    <div className="text-xs font-semibold text-rose-700 mt-0.5">
                      {formatCurrency(item.price, curr)}
                    </div>
                    {item.fitDescription && (
                      <p className="text-[11px] text-neutral-500 mt-1 line-clamp-2">
                        {item.fitDescription}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
                    {/* Reorder Buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveLadiesRailItem(idx, -1)}
                        disabled={idx === 0}
                        title="Move left on rail"
                        className="w-6 h-6 border border-neutral-200 grid place-items-center text-neutral-600 hover:border-black disabled:opacity-30 disabled:pointer-events-none"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveLadiesRailItem(idx, 1)}
                        disabled={idx === ladiesRailItems.length - 1}
                        title="Move right on rail"
                        className="w-6 h-6 border border-neutral-200 grid place-items-center text-neutral-600 hover:border-black disabled:opacity-30 disabled:pointer-events-none"
                      >
                        →
                      </button>
                    </div>

                    {/* Edit & Delete */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditLadiesRailModal(item)}
                        className="text-neutral-700 hover:text-black font-semibold underline text-xs cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLadiesRailItem(item.id)}
                        className="text-neutral-400 hover:text-red-600 font-medium text-xs cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 6: SHOP SETTINGS & FIREBASE CONSOLE */}
        {/* ================================================================== */}
        {activeTab === 'settings' && (
          <div className="space-y-8 max-w-3xl">
            {/* General Shop Settings */}
            <form onSubmit={handleSaveSettings} className="bg-white border border-[#e4e4e4] p-6 space-y-5 text-xs shadow-sm">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">Shop Branding & WhatsApp</h3>
                <p className="text-neutral-500 mt-0.5">Customize your shop name, headline, and customer ordering number.</p>
              </div>

              <div>
                <label className="block font-semibold mb-1">Shop Name</label>
                <input
                  type="text"
                  required
                  value={settingsForm.shopName}
                  onChange={(e) => setSettingsForm({ ...settingsForm, shopName: e.target.value })}
                  placeholder="e.g. Try the Look, Atelier Runway, Streetwear Co."
                  className="w-full border border-neutral-300 p-2.5 focus:border-black focus:outline-none bg-neutral-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Shop Tagline</label>
                <input
                  type="text"
                  value={settingsForm.shopTagline}
                  onChange={(e) => setSettingsForm({ ...settingsForm, shopTagline: e.target.value })}
                  placeholder="Six looks, styled head to toe. Tap a pin to see the piece."
                  className="w-full border border-neutral-300 p-2.5 focus:border-black focus:outline-none bg-neutral-50 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold">Store Currency Symbol / Code</label>
                    <span className="text-[11px] font-semibold text-neutral-600 bg-neutral-200/80 px-2 py-0.5 rounded-xs">
                      Preview: {formatCurrency(149, settingsForm.currencySymbol)}
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    value={settingsForm.currencySymbol ?? ''}
                    onChange={(e) => {
                      const val = cleanCurrencySymbol(e.target.value);
                      setSettingsForm({ ...settingsForm, currencySymbol: val });
                    }}
                    placeholder="e.g. AED, $, €, £, ₹, SAR, USD"
                    className="w-full border border-neutral-300 p-2.5 focus:border-black focus:outline-none bg-neutral-50 focus:bg-white font-mono"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-neutral-400 font-medium">Quick select:</span>
                    {['AED', '$', '€', '£', '₹', 'SAR', 'USD'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSettingsForm({ ...settingsForm, currencySymbol: c })}
                        className={`text-[10px] px-2 py-0.5 border transition-colors ${
                          cleanCurrencySymbol(settingsForm.currencySymbol) === c
                            ? 'bg-black text-white border-black font-bold'
                            : 'bg-white text-neutral-700 border-neutral-300 hover:border-black'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1.5">
                    Prefix applied to all clothes prices, outfit bundles, cart, and WhatsApp orders.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold mb-1">WhatsApp Order Phone Number</label>
                  <input
                    type="text"
                    value={settingsForm.whatsappNumber}
                    onChange={(e) => setSettingsForm({ ...settingsForm, whatsappNumber: e.target.value })}
                    placeholder="e.g. +971545086557 (with country code, digits only)"
                    className="w-full border border-neutral-300 p-2.5 focus:border-black focus:outline-none bg-neutral-50 focus:bg-white"
                  />
                  <p className="text-[11px] text-neutral-400 mt-1">
                    This number is published to all shoppers when shared settings save successfully. The owner number must be in international format.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-200">
                <h4 className="font-bold text-neutral-800 mb-2">Admin Credentials</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Username</label>
                    <input
                      type="text"
                      required
                      value={settingsForm.adminUsername}
                      onChange={(e) => setSettingsForm({ ...settingsForm, adminUsername: e.target.value })}
                      className="w-full border border-neutral-300 p-2 focus:border-black focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Password</label>
                    <input
                      type="password"
                      required
                      value={settingsForm.adminPasswordHash}
                      onChange={(e) => setSettingsForm({ ...settingsForm, adminPasswordHash: e.target.value })}
                      className="w-full border border-neutral-300 p-2 focus:border-black focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-black text-white font-semibold hover:bg-neutral-800 transition-colors"
                >
                  Save Store Settings
                </button>
              </div>
            </form>

            {/* Firebase Console Database Integration */}
            <div className="bg-white border border-[#e4e4e4] p-6 space-y-5 text-xs shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                    Firebase Console Database Connection
                  </h3>
                </div>
                <p className="text-neutral-500 mt-1">
                  Connect your Firebase Firestore database for online cloud storage (ready for Vercel deployment).
                </p>
              </div>

              {firebaseStatus.message && (
                <div
                  className={`p-3 text-xs border ${
                    firebaseStatus.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : firebaseStatus.type === 'error'
                      ? 'bg-red-50 text-red-800 border-red-200'
                      : 'bg-neutral-50 text-neutral-800 border-neutral-200'
                  }`}
                >
                  {firebaseStatus.message}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Project ID</label>
                  <input
                    type="text"
                    value={settingsForm.firebaseConfig.projectId}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        firebaseConfig: {
                          ...settingsForm.firebaseConfig,
                          projectId: e.target.value,
                        },
                      })
                    }
                    placeholder="my-project-id"
                    className="w-full border border-neutral-300 p-2 focus:border-black focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">API Key</label>
                  <input
                    type="text"
                    value={settingsForm.firebaseConfig.apiKey}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        firebaseConfig: {
                          ...settingsForm.firebaseConfig,
                          apiKey: e.target.value,
                        },
                      })
                    }
                    placeholder="AIzaSy..."
                    className="w-full border border-neutral-300 p-2 focus:border-black focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Auth Domain (Optional)</label>
                  <input
                    type="text"
                    value={settingsForm.firebaseConfig.authDomain}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        firebaseConfig: {
                          ...settingsForm.firebaseConfig,
                          authDomain: e.target.value,
                        },
                      })
                    }
                    placeholder="my-project.firebaseapp.com"
                    className="w-full border border-neutral-300 p-2 focus:border-black focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">App ID</label>
                  <input
                    type="text"
                    value={settingsForm.firebaseConfig.appId}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        firebaseConfig: {
                          ...settingsForm.firebaseConfig,
                          appId: e.target.value,
                        },
                      })
                    }
                    placeholder="1:123456789:web:abcdef"
                    className="w-full border border-neutral-300 p-2 focus:border-black focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleTestFirebase}
                  disabled={firebaseStatus.loading}
                  className="px-4 py-2 border border-neutral-300 font-semibold hover:bg-neutral-50 transition-colors"
                >
                  {firebaseStatus.loading ? 'Connecting...' : 'Test Connection'}
                </button>
                <button
                  type="button"
                  onClick={handleSyncToFirestore}
                  disabled={firebaseStatus.loading}
                  className="px-4 py-2 bg-black text-white font-semibold hover:bg-neutral-800 transition-colors"
                >
                  Upload Catalog to Firestore
                </button>
                <button
                  type="button"
                  onClick={handleFetchFromFirestore}
                  disabled={firebaseStatus.loading}
                  className="px-4 py-2 bg-neutral-100 text-neutral-800 font-semibold hover:bg-neutral-200 transition-colors"
                >
                  Fetch from Firestore
                </button>
              </div>

              <div className="bg-neutral-50 p-3 border border-neutral-200 text-[11px] text-neutral-600 space-y-1.5">
                <div className="font-semibold text-neutral-800">Deploying to Vercel Checklist:</div>
                <p>1. Copy the project files to your Git repository and deploy to Vercel.</p>
                <p>2. In your Vercel Project Settings &gt; Environment Variables, add <code>VITE_FIREBASE_API_KEY</code> and <code>VITE_FIREBASE_PROJECT_ID</code> or save your credentials directly in this settings tab.</p>
                <p>3. In Firebase Console, enable Firestore Database under Build &gt; Firestore Database.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* MODAL: ADD / EDIT PRODUCT */}
      {/* ==================================================================== */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full p-6 shadow-2xl border border-neutral-300 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 mb-4">
              <h3 className="text-base font-bold">
                {editingProduct ? 'Edit Garment' : 'Add New Garment'}
              </h3>
              <button
                type="button"
                onClick={() => setProductModalOpen(false)}
                className="text-neutral-400 hover:text-black text-xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="e.g. Retro Court Sneaker, Heavyweight Hoodie"
                  className="w-full border border-neutral-300 p-2 focus:border-black focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Vendor Line</label>
                  <input
                    type="text"
                    value={productForm.vendor}
                    onChange={(e) => setProductForm({ ...productForm, vendor: e.target.value })}
                    className="w-full border border-neutral-300 p-2 focus:border-black focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Price ({curr})</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    className="w-full border border-neutral-300 p-2 focus:border-black focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Category</label>
                  <select
                    value={productForm.category}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        category: e.target.value as Product['category'],
                        optionLegend: e.target.value === 'shoes' ? 'Shoe size' : 'Size',
                      })
                    }
                    className="w-full border border-neutral-300 p-2 focus:border-black focus:outline-none"
                  >
                    <option value="shoes">Shoes</option>
                    <option value="top">T-Shirt / Top</option>
                    <option value="hoodie">Hoodie</option>
                    <option value="sweatshirt">Sweatshirt</option>
                    <option value="pants">Pants / Denim</option>
                    <option value="accessory">Accessory</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Size Option Legend</label>
                  <input
                    type="text"
                    value={productForm.optionLegend}
                    onChange={(e) => setProductForm({ ...productForm, optionLegend: e.target.value })}
                    className="w-full border border-neutral-300 p-2 focus:border-black focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Sizes (comma-separated)</label>
                <input
                  type="text"
                  value={productForm.sizes}
                  onChange={(e) => setProductForm({ ...productForm, sizes: e.target.value })}
                  placeholder="S, M, L, XL or 40, 41, 42, 43, 44, 45, 46"
                  className="w-full border border-neutral-300 p-2 focus:border-black focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Fit & Drape Description</label>
                <input
                  type="text"
                  value={productForm.fitDescription}
                  onChange={(e) => setProductForm({ ...productForm, fitDescription: e.target.value })}
                  placeholder="e.g. Heavyweight boxy cut with relaxed dropped shoulders"
                  className="w-full border border-neutral-300 p-2 focus:border-black focus:outline-none"
                />
              </div>

              {/* Garment Image Upload */}
              <div className="border border-neutral-200 p-3 bg-neutral-50 space-y-2">
                <label className="block font-semibold">Garment Image</label>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      handleImageFileUpload(e, (dataUrl) =>
                        setProductForm((prev) => ({ ...prev, image: dataUrl }))
                      )
                    }
                    className="text-xs"
                  />
                </div>
                <div className="text-[11px] text-neutral-400">or enter image URL:</div>
                <input
                  type="url"
                  value={productForm.image}
                  onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
                  placeholder="https://..."
                  className="w-full border border-neutral-300 p-2 bg-white focus:border-black focus:outline-none"
                />
                {productForm.image && (
                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={productForm.image}
                      alt="Preview"
                      className="w-12 h-14 object-contain bg-white border border-neutral-200"
                    />
                    <span className="text-[11px] text-neutral-500">Image ready</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="px-4 py-2 border border-neutral-300 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-black text-white font-semibold hover:bg-neutral-800"
                >
                  Save Garment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD / EDIT MODEL / LOOK */}
      {/* ==================================================================== */}
      {lookModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full p-6 shadow-2xl border border-neutral-300 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 mb-4">
              <h3 className="text-base font-bold">
                {editingLook ? 'Edit Model & Look' : 'Upload New Model & Look'}
              </h3>
              <button
                type="button"
                onClick={() => setLookModalOpen(false)}
                className="text-neutral-400 hover:text-black text-xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveLook} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Look Name</label>
                <input
                  type="text"
                  required
                  value={lookForm.name}
                  onChange={(e) => setLookForm({ ...lookForm, name: e.target.value })}
                  placeholder="e.g. The Downtown Edit, Neon Sunset, Studio Minimal"
                  className="w-full border border-neutral-300 p-2 focus:border-black focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Look Description</label>
                <input
                  type="text"
                  value={lookForm.description}
                  onChange={(e) => setLookForm({ ...lookForm, description: e.target.value })}
                  placeholder="e.g. Relaxed streetwear layers and vintage washed denim."
                  className="w-full border border-neutral-300 p-2 focus:border-black focus:outline-none"
                />
              </div>

              {/* Model Cutout Image Upload */}
              <div className="border border-neutral-200 p-3 bg-neutral-50 space-y-2">
                <label className="block font-semibold">Upload Model Full-Body Photo (Transparent PNG / WebP)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleImageFileUpload(e, (dataUrl) =>
                      setLookForm((prev) => ({ ...prev, src640: dataUrl }))
                    )
                  }
                  className="text-xs"
                />
                <div className="text-[11px] text-neutral-400">or enter model image URL:</div>
                <input
                  type="url"
                  value={lookForm.src640}
                  onChange={(e) => setLookForm({ ...lookForm, src640: e.target.value })}
                  placeholder="https://..."
                  className="w-full border border-neutral-300 p-2 bg-white focus:border-black focus:outline-none"
                />
                {lookForm.src640 && (
                  <div className="mt-2 flex items-center gap-3">
                    <img
                      src={lookForm.src640}
                      alt="Preview"
                      className="w-14 h-24 object-contain bg-white border border-neutral-200"
                    />
                    <div className="text-[11px] text-neutral-500">
                      Model photo loaded. Transparent cutout recommended.
                    </div>
                  </div>
                )}
              </div>

              {/* Assign Clothes to Look */}
              <div>
                <label className="block font-semibold mb-1">
                  Assign Clothes to this Look ({lookForm.selectedProductIds.length} selected)
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-neutral-200 p-2">
                  {products.map((p) => {
                    const isChecked = lookForm.selectedProductIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center gap-2 p-1.5 border cursor-pointer ${
                          isChecked ? 'bg-neutral-100 border-black' : 'border-neutral-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setLookForm({
                                ...lookForm,
                                selectedProductIds: [...lookForm.selectedProductIds, p.id],
                              });
                            } else {
                              setLookForm({
                                ...lookForm,
                                selectedProductIds: lookForm.selectedProductIds.filter(
                                  (id) => id !== p.id
                                ),
                              });
                            }
                          }}
                        />
                        <img src={p.image} alt="" className="w-6 h-6 object-contain" />
                        <span className="truncate">{p.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setLookModalOpen(false)}
                  className="px-4 py-2 border border-neutral-300 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-black text-white font-semibold hover:bg-neutral-800"
                >
                  Save Model & Look
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD / EDIT 3D RAIL GARMENT */}
      {/* ==================================================================== */}
      {railModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-6 shadow-2xl border border-neutral-300 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 mb-4">
              <h3 className="text-base font-bold">
                {editingRailItem ? 'Edit 3D Rail Garment' : 'Add Brand Garment to 3D Rail'}
              </h3>
              <button
                type="button"
                onClick={() => setRailModalOpen(false)}
                className="text-neutral-400 hover:text-black text-xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveRailItem} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Garment Name</label>
                <input
                  type="text"
                  required
                  value={railForm.name}
                  onChange={(e) => setRailForm({ ...railForm, name: e.target.value })}
                  placeholder="e.g. Signature Heavy Tee, Boxy Hoodie"
                  className="w-full border border-neutral-300 p-2 focus:border-black focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Price ({curr})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={railForm.price}
                  onChange={(e) => setRailForm({ ...railForm, price: e.target.value })}
                  className="w-full border border-neutral-300 p-2 focus:border-black focus:outline-none"
                />
              </div>

              {/* Garment Image Upload */}
              <div className="border border-neutral-200 p-3 bg-neutral-50 space-y-2">
                <label className="block font-semibold">Garment Image (Cutout PNG recommended)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleImageFileUpload(e, (dataUrl) =>
                      setRailForm((prev) => ({ ...prev, image: dataUrl }))
                    )
                  }
                  className="text-xs"
                />
                <div className="text-[11px] text-neutral-400">or enter image web URL:</div>
                <input
                  type="url"
                  value={railForm.image}
                  onChange={(e) => setRailForm({ ...railForm, image: e.target.value })}
                  placeholder="https://..."
                  className="w-full border border-neutral-300 p-2 bg-white focus:border-black focus:outline-none"
                />

                {railForm.image && (
                  <div className="mt-3 bg-neutral-900 p-3 rounded flex items-center gap-3">
                    <img
                      src={railForm.image}
                      alt="Preview"
                      className="w-14 h-16 object-contain filter drop-shadow-md"
                    />
                    <div className="text-[11px] text-neutral-300">
                      <b className="text-white block">Image ready for 3D Rail</b>
                      Garment will hang suspended from chrome rail with 3D mouse swing & hover gaps.
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setRailModalOpen(false)}
                  className="px-4 py-2 border border-neutral-300 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-black text-white font-semibold hover:bg-neutral-800"
                >
                  Save Piece to Rail
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD / EDIT LADIES PIECE */}
      {/* ==================================================================== */}
      {ladiesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-6 shadow-2xl border border-neutral-300 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 mb-4">
              <h3 className="text-base font-bold text-neutral-900">
                {editingLadiesPiece ? 'Edit Ladies Lookbook Piece' : 'Add New Ladies Piece'}
              </h3>
              <button
                type="button"
                onClick={() => setLadiesModalOpen(false)}
                className="text-neutral-400 hover:text-black text-xl cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveLadiesPiece} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Piece Name</label>
                <input
                  type="text"
                  required
                  value={ladiesPieceForm.name}
                  onChange={(e) =>
                    setLadiesPieceForm({ ...ladiesPieceForm, name: e.target.value })
                  }
                  placeholder="e.g. Feather Jacket, Pleated Dress, Satin Trench"
                  className="w-full border border-neutral-300 p-2.5 focus:border-black focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Look Number</label>
                  <select
                    value={ladiesPieceForm.lookNumber}
                    onChange={(e) =>
                      setLadiesPieceForm({
                        ...ladiesPieceForm,
                        lookNumber: Number(e.target.value),
                      })
                    }
                    className="w-full border border-neutral-300 p-2.5 bg-white focus:border-black focus:outline-none"
                  >
                    {[15, 16, 17, 18, 19, 20].map((num) => (
                      <option key={num} value={num}>
                        Look #{num}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Piece Slot</label>
                  <select
                    value={ladiesPieceForm.pieceNumber}
                    onChange={(e) =>
                      setLadiesPieceForm({
                        ...ladiesPieceForm,
                        pieceNumber: Number(e.target.value),
                      })
                    }
                    className="w-full border border-neutral-300 p-2.5 bg-white focus:border-black focus:outline-none"
                  >
                    <option value={1}>Piece 1 (Primary Garment)</option>
                    <option value={2}>Piece 2 (Secondary / Accessory)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Price ({curr})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={ladiesPieceForm.price}
                  onChange={(e) =>
                    setLadiesPieceForm({ ...ladiesPieceForm, price: e.target.value })
                  }
                  className="w-full border border-neutral-300 p-2.5 focus:border-black focus:outline-none"
                />
              </div>

              {/* Piece Image Upload */}
              <div className="border border-neutral-200 p-3 bg-neutral-50 space-y-2">
                <label className="block font-semibold">Custom Piece Photo (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleImageFileUpload(e, (dataUrl) =>
                      setLadiesPieceForm((prev) => ({ ...prev, customImage: dataUrl }))
                    )
                  }
                  className="text-xs"
                />
                <div className="text-[11px] text-neutral-400">or enter image web URL:</div>
                <input
                  type="url"
                  value={ladiesPieceForm.customImage}
                  onChange={(e) =>
                    setLadiesPieceForm({ ...ladiesPieceForm, customImage: e.target.value })
                  }
                  placeholder="https://..."
                  className="w-full border border-neutral-300 p-2 bg-white focus:border-black focus:outline-none"
                />

                {ladiesPieceForm.customImage ? (
                  <div className="mt-3 bg-white border border-neutral-200 p-3 rounded flex items-center gap-3">
                    <img
                      src={ladiesPieceForm.customImage}
                      alt="Preview"
                      className="w-14 h-16 object-contain"
                    />
                    <div className="text-[11px] text-neutral-600">
                      <b className="text-black block">Custom photo loaded</b>
                      This image will appear on the product card and in the cart.
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-neutral-500 italic">
                    If left empty, uses the built-in high-resolution Maison Vell sprite sheet piece crop.
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setLadiesModalOpen(false)}
                  className="px-4 py-2 border border-neutral-300 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-black text-white font-semibold hover:bg-neutral-800"
                >
                  Save Piece
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: EDIT LADIES SEASON INFO */}
      {/* ==================================================================== */}
      {ladiesSettingsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-6 shadow-2xl border border-neutral-300">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 mb-4">
              <h3 className="text-base font-bold text-neutral-900">
                Edit Ladies Runway Lookbook Theme
              </h3>
              <button
                type="button"
                onClick={() => setLadiesSettingsModalOpen(false)}
                className="text-neutral-400 hover:text-black text-xl cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveLadiesSettings} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Season Title</label>
                <input
                  type="text"
                  required
                  value={ladiesSettingsForm.seasonTitle}
                  onChange={(e) =>
                    setLadiesSettingsForm({
                      ...ladiesSettingsForm,
                      seasonTitle: e.target.value,
                    })
                  }
                  placeholder="e.g. Spring Summer 2027, Autumn Winter Atelier"
                  className="w-full border border-neutral-300 p-2.5 focus:border-black focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Subtitle / Brand Statement</label>
                <textarea
                  rows={3}
                  required
                  value={ladiesSettingsForm.subtitle}
                  onChange={(e) =>
                    setLadiesSettingsForm({
                      ...ladiesSettingsForm,
                      subtitle: e.target.value,
                    })
                  }
                  placeholder="A study in softness and strength..."
                  className="w-full border border-neutral-300 p-2.5 focus:border-black focus:outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">First Look Number</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={999}
                  value={ladiesSettingsForm.firstLookNumber}
                  onChange={(e) =>
                    setLadiesSettingsForm({
                      ...ladiesSettingsForm,
                      firstLookNumber: Number(e.target.value) || 15,
                    })
                  }
                  className="w-full border border-neutral-300 p-2.5 focus:border-black focus:outline-none"
                />
                <span className="text-[11px] text-neutral-500 mt-0.5 block">
                  The rolling number on the bottom left will roll across 6 looks starting from this number.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setLadiesSettingsModalOpen(false)}
                  className="px-4 py-2 border border-neutral-300 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-black text-white font-semibold hover:bg-neutral-800"
                >
                  Save Theme
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD / EDIT LADIES 3D RAIL TOP */}
      {/* ==================================================================== */}
      {ladiesRailModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-6 shadow-2xl border border-neutral-300 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 mb-4">
              <h3 className="text-base font-bold text-neutral-900">
                {editingLadiesRailItem ? 'Edit Ladies 3D Rail Top' : 'Add Ladies Top to 3D Rail'}
              </h3>
              <button
                type="button"
                onClick={() => setLadiesRailModalOpen(false)}
                className="text-neutral-400 hover:text-black text-xl cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveLadiesRailItem} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Top / Blouse Name</label>
                <input
                  type="text"
                  required
                  value={ladiesRailForm.name}
                  onChange={(e) =>
                    setLadiesRailForm({ ...ladiesRailForm, name: e.target.value })
                  }
                  placeholder="e.g. Silk Georgette Blouse, Linen Wrap Top"
                  className="w-full border border-neutral-300 p-2.5 focus:border-black focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Price ({curr})</label>
                <input
                  type="text"
                  required
                  value={ladiesRailForm.price}
                  onChange={(e) =>
                    setLadiesRailForm({ ...ladiesRailForm, price: e.target.value })
                  }
                  placeholder="380.00"
                  className="w-full border border-neutral-300 p-2.5 focus:border-black focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Fit & Fabric Description</label>
                <input
                  type="text"
                  value={ladiesRailForm.fitDescription}
                  onChange={(e) =>
                    setLadiesRailForm({ ...ladiesRailForm, fitDescription: e.target.value })
                  }
                  placeholder="e.g. Relaxed fluid drape with French seams and pearlescent buttons."
                  className="w-full border border-neutral-300 p-2.5 focus:border-black focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Top Photo URL or Custom Upload</label>
                <input
                  type="text"
                  value={ladiesRailForm.image}
                  onChange={(e) =>
                    setLadiesRailForm({ ...ladiesRailForm, image: e.target.value })
                  }
                  placeholder="https://... image URL (preferably transparent background)"
                  className="w-full border border-neutral-300 p-2.5 focus:border-black focus:outline-none mb-2"
                />

                <div className="flex items-center gap-2">
                  <label className="cursor-pointer bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 px-3 py-1.5 text-[11px] font-semibold text-neutral-800 transition-colors inline-block">
                    <span>Upload Image File</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (uploadEvent) => {
                            if (typeof uploadEvent.target?.result === 'string') {
                              setLadiesRailForm({
                                ...ladiesRailForm,
                                image: uploadEvent.target.result,
                              });
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  <span className="text-[10px] text-neutral-400">
                    PNG transparent cutout looks best on hanger
                  </span>
                </div>

                {ladiesRailForm.image && (
                  <div className="mt-3 p-3 bg-[#0d0f12] border border-neutral-800 flex items-center gap-3">
                    <img
                      src={ladiesRailForm.image}
                      alt="Preview"
                      className="w-14 h-16 object-contain filter drop-shadow-md"
                    />
                    <div className="text-[11px] text-neutral-300">
                      <b className="text-white block">Top preview loaded</b>
                      Garment will hang suspended from wooden hanger with 3D mouse swing & hover gaps.
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setLadiesRailModalOpen(false)}
                  className="px-4 py-2 border border-neutral-300 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-black text-white font-semibold hover:bg-neutral-800"
                >
                  Save Piece to Rail
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
