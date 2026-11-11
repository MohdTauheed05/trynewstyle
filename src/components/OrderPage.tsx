import React from 'react';

interface SharedOrderItem {
  id: string;
  name: string;
  size: string;
  quantity: number;
  price: number;
  image?: string;
  url?: string;
}

interface SharedOrder {
  orderId: string;
  date: string;
  shopName: string;
  customerName?: string;
  notes?: string;
  items: SharedOrderItem[];
  total: number;
  currencySymbol: string;
}

export const OrderPage: React.FC<{ order: SharedOrder }> = ({ order }) => {
  const money = (amount: number) => {
    const symbol = order.currencySymbol || '$';
    return symbol.length > 1 ? `${symbol} ${amount.toFixed(2)}` : `${symbol}${amount.toFixed(2)}`;
  };

  return (
    <main className="min-h-screen bg-[#f5f3ef] text-[#151413] px-4 py-8 sm:py-12">
      <article className="mx-auto max-w-2xl bg-white border border-neutral-200 shadow-sm">
        <header className="border-b border-neutral-200 p-6 sm:p-8">
          <a href={window.location.pathname} className="text-xs uppercase tracking-widest text-neutral-500 hover:text-black">← Back to shop</a>
          <p className="mt-6 text-xs uppercase tracking-[0.2em] text-neutral-500">Order details</p>
          <h1 className="mt-2 text-2xl font-semibold">{order.shopName}</h1>
          <p className="mt-2 text-sm text-neutral-600">Order {order.orderId}</p>
          <p className="text-xs text-neutral-500">{new Date(order.date).toLocaleString()}</p>
          {order.customerName && <p className="mt-3 text-sm">Customer: {order.customerName}</p>}
        </header>

        <section className="p-6 sm:p-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Items ({order.items.length})</h2>
          <ul className="mt-4 divide-y divide-neutral-200">
            {order.items.map((item) => (
              <li key={item.id + item.size} className="flex gap-4 py-4">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="h-24 w-20 shrink-0 bg-neutral-100 object-contain" />
                ) : (
                  <div className="h-24 w-20 shrink-0 bg-neutral-100 grid place-items-center text-[10px] text-neutral-500">Photo unavailable</div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium">{item.name}</h3>
                  <p className="mt-1 text-sm text-neutral-600">Size {item.size} · Qty {item.quantity}</p>
                  {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs underline underline-offset-2">Product details ↗</a>}
                </div>
                <span className="shrink-0 text-sm font-medium">{money(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          {order.notes && <p className="mt-5 border-l-2 border-neutral-300 pl-3 text-sm text-neutral-600">Note: {order.notes}</p>}
          <div className="mt-6 flex justify-between border-t border-neutral-200 pt-4 font-semibold">
            <span>Total</span><span>{money(order.total)}</span>
          </div>
          <p className="mt-6 text-xs text-neutral-500">Order details shared from {order.shopName}.</p>
        </section>
      </article>
    </main>
  );
};
