import React, { useEffect, useRef, useState } from 'react';
import { Product } from '../types';
import { clearBag, getBagDetailedItems, removeFromBag } from '../services/bagStorage';
import { saveOrderToFirestore } from '../services/firebase';
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

  const buildWaUrl = (
    orderId: string,
    lineItems: typeof items,
    total: number,
    name: string,
    notes: string
  ) => {
    // Sanitize phone number (digits only)
    const cleanPhone = (whatsappNumber || '15551234567').replace(/[^0-9]/g, '');

    const lines: string[] = [
      `🛍️ *New Order from ${shopName}*`,
      `🧾 *Order ID:* ${orderId}`,
      name ? `👤 *Customer:* ${name}` : '',
      notes ? `📍 *Address/Notes:* ${notes}` : '',
      '--------------------------------',
      ...lineItems.map(
        (item) =>
          `• *${item.name}*\n  Size: ${item.size} | Qty: ${item.quantity} | ${formatCurrency(
            item.price * item.quantity,
            currencySymbol
          )}`
      ),
      '--------------------------------',
      `💰 *Total:* ${formatCurrency(total, currencySymbol)}`,
      '',
      'Please confirm availability and delivery timeframe! 🙌',
    ].filter(Boolean);

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(lines.join('\n'))}`;
  };

  const handleOrderWhatsApp = () => {
    if (items.length === 0 || orderingRef.current) return;
    orderingRef.current = true;
    setTimeout(() => {
      orderingRef.current = false;
    }, 1500);

    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
    const snapshot = items.map((i) => ({ ...i }));
    const waUrl = buildWaUrl(orderId, snapshot, subtotal, customerName, deliveryNotes);

    // Log order to Firestore (no-op when Firebase isn't configured)
    saveOrderToFirestore({
      orderId,
      items: snapshot.map((i) => ({
        name: i.name,
        size: i.size,
        quantity: i.quantity,
        price: i.price,
      })),
      total: subtotal,
      channel: 'whatsapp',
      phone: (whatsappNumber || '').replace(/[^0-9]/g, ''),
      customerName: customerName || undefined,
      notes: deliveryNotes || undefined,
    });

    // Build the receipt slip that animates in on this page
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
      items: snapshot,
      total: subtotal,
      currencyText: (n: number) => formatCurrency(n, currencySymbol),
    });

    onClose();
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleResendWhatsApp = () => {
    if (!slip) return;
    const url = buildWaUrl(slip.orderId, slip.items, slip.total, slip.customerName || '', slip.notes || '');
    window.open(url, '_blank', 'noopener,noreferrer');
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
          Review your selected runway looks and pieces. Order directly via WhatsApp or download your shortlist.
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
              onClick={handleOrderWhatsApp}
              className="w-full py-3.5 px-4 bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.173.086.275.072.376-.043.101-.116.433-.506.549-.68.116-.173.231-.145.39-.086s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.392-12.416c-5.523 0-10 4.477-10 10 0 1.765.459 3.424 1.261 4.869l-1.261 4.606 4.71-1.236c1.396.762 2.996 1.192 4.69 1.192 5.524 0 10-4.477 10-10s-4.476-10-10-10z" />
              </svg>
              <span>Order via WhatsApp ({formatCurrency(subtotal, currencySymbol)})</span>
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
          onClose={() => setSlip(null)}
          onResendWhatsApp={handleResendWhatsApp}
          onClearCart={() => clearBag()}
        />
      )}
    </>
  );
};
