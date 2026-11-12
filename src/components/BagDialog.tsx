import React, { useEffect, useRef, useState } from 'react';
import { Product } from '../types';
import { clearBag, getBagDetailedItems, removeFromBag } from '../services/bagStorage';
import { saveOrderShareToFirestore, saveOrderToFirestore } from '../services/firebase';
import { formatCurrency } from '../services/storeSettings';
import { useScrollLock } from '../services/scrollLock';
import { OrderSlip } from './OrderSlip';
import { ProductThumb } from './ProductThumb';
import { SlipOrder } from '../services/slipImage';

interface BagDialogProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  shopName: string;
  whatsappNumber: string;
  currencySymbol?: string;
}

export const BagDialog: React.FC<BagDialogProps> = ({
  isOpen,
  onClose,
  products,
  shopName,
  whatsappNumber,
  currencySymbol = '$',
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [slip, setSlip] = useState<SlipOrder | null>(null);
  const orderingRef = useRef(false);

  // Page behind the cart must not scroll while it is open
  useScrollLock(isOpen);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  const items = getBagDetailedItems(products);

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const rect = dialog.getBoundingClientRect();
    const isInDialog =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;
    if (!isInDialog) {
      onClose();
    }
  };

  /** Step 1: print the slip on screen (nothing is sent yet). */
  const handlePrintSlip = async () => {
    if (items.length === 0 || orderingRef.current) return;
    orderingRef.current = true;
    setTimeout(() => {
      orderingRef.current = false;
    }, 1500);

    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
    const snapshot = items.map((i) => ({ ...i }));
    // Keep the share URL compact: send only a minimal order snapshot. Product
    // photos are resolved from the shared catalog on the order page instead.
    const shareData = {
      v: 1,
      o: orderId,
      d: Date.now(),
      s: shopName,
      i: snapshot.map(({ id, name, size, quantity, price, url }) => [
        String(id), name, size, quantity, price, url,
      ]),
      t: subtotal,
      c: currencySymbol,
    };
    const bytes = new TextEncoder().encode(JSON.stringify(shareData));
    const base64 = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    const longOrderUrl = `${window.location.origin}${window.location.pathname}#order=v1.${base64}`;
    const tokenBytes = new Uint8Array(9);
    window.crypto.getRandomValues(tokenBytes);
    const shareToken = btoa(String.fromCharCode(...tokenBytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    const shareRecord = {
      orderId,
      date: new Date(shareData.d).toISOString(),
      shopName,
      items: snapshot.map((item) => ({
        id: String(item.id),
        name: item.name,
        size: item.size,
        quantity: item.quantity,
        price: item.price,
        ...(item.url ? { url: item.url } : {}),
      })),
      total: subtotal,
      currencySymbol,
    };
    const shortLinkResult = await saveOrderShareToFirestore(shareToken, shareRecord);
    const orderUrl = shortLinkResult.success
      ? `${window.location.origin}${window.location.pathname}#order=${shareToken}`
      : longOrderUrl;
    const shareWarning = shortLinkResult.success
      ? ''
      : 'Short order link could not be saved. Firebase rules need the orderShares access from the latest firestore.rules; a longer link is being used for this order.';

    // Log a product snapshot, including photo and product page URL, to Firestore.
    saveOrderToFirestore({
      orderId,
      items: snapshot.map((i) => ({
        id: String(i.id),
        name: i.name,
        size: i.size,
        quantity: i.quantity,
        price: i.price,
        image: (i.image.startsWith('https://') || i.image.startsWith('http://')) ? i.image : '',
        url: i.url,
      })),
      total: subtotal,
      channel: 'whatsapp',
      phone: (whatsappNumber || '').replace(/[^0-9]/g, ''),
      customerName: customerName || undefined,
      notes: deliveryNotes || undefined,
      orderUrl,
    });

    setSlip({
      orderId,
      date: new Date().toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      shopName,
      customerName: customerName || undefined,
      notes: deliveryNotes || undefined,
      shareUrl: orderUrl,
      shareWarning,
      items: snapshot,
      total: subtotal,
      currencyText: (n: number) => formatCurrency(n, currencySymbol),
    });

    onClose();
  };

  const handleExport = () => {
    if (items.length === 0) return;
    const lines = [
      `${shopName.toUpperCase()} — STYLING SHORTLIST`,
      '',
      'Reference prices; no order or payment has been placed.',
      '',
    ];

    for (const item of items) {
      lines.push(`${item.name} · Size ${item.size} · Quantity ${item.quantity}`);
      lines.push(item.url);
      lines.push('');
    }

    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'runway-outfit-shortlist.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  };

  return (
    <>
      <dialog
        id="bag-dialog"
        ref={dialogRef}
        onClick={handleBackdropClick}
        onCancel={onClose}
      >
        <div className="bag-heading">
          <h2>Your Cart ({items.length})</h2>
          <button
            id="close-bag"
            type="button"
            aria-label="Close cart"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <p className="bag-note">
          Review your selected pieces, print your order slip, then send it on WhatsApp.
        </p>

        <div id="bag-items">
          {items.length === 0 ? (
            <p className="bag-note">
              Your cart is empty. Tap a size beside any piece on the runway to add it.
            </p>
          ) : (
            items.map((item) => (
              <div key={`${item.id}-${item.size}`} className="bag-row">
                <ProductThumb item={item} className="bag-row-img" />
                <div className="bag-row-details">
                  <h3>{item.name}</h3>
                  <p>
                    Size {item.size} · Quantity {item.quantity} · {formatCurrency(item.price, currencySymbol)}
                  </p>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bag-row-link"
                  >
                    View piece details ↗
                  </a>
                </div>
                <button
                  type="button"
                  className="bag-remove-btn"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => removeFromBag(item.id)}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-[#e4e4e4] pt-4 mt-4 space-y-4">
            <div className="flex justify-between items-baseline">
              <span className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">Subtotal</span>
              <span className="text-lg font-bold font-mono">{formatCurrency(subtotal, currencySymbol)}</span>
            </div>

            {/* Optional Customer info for WhatsApp checkout */}
            <div className="space-y-2 bg-neutral-50 p-3 border border-neutral-200 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Your Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full border border-neutral-300 p-1.5 bg-white text-xs focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Delivery Address / Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apartment, City or Size questions"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  className="w-full border border-neutral-300 p-1.5 bg-white text-xs focus:outline-none focus:border-black"
                />
              </div>
            </div>

            {/* WhatsApp Order CTA */}
            <button
              type="button"
              onClick={handlePrintSlip}
              className="w-full py-3.5 px-4 bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 9V3h12v6" />
                <rect x="3" y="9" width="18" height="8" rx="2" />
                <path d="M6 14h12v7H6z" />
              </svg>
              <span>Print slip to order with WhatsApp ({formatCurrency(subtotal, currencySymbol)})</span>
            </button>
          </div>
        )}

        <button
          id="export-bag"
          type="button"
          disabled={items.length === 0}
          onClick={handleExport}
          className="mt-2 text-xs !text-white font-medium"
        >
          Download outfit shortlist (.txt)
        </button>
      </dialog>

      <div id="bag-status" role="status" aria-live="polite"></div>

      {slip && (
        <OrderSlip
          order={slip}
          whatsappNumber={whatsappNumber}
          onClose={() => setSlip(null)}
          onClearCart={() => clearBag()}
        />
      )}
    </>
  );
};
