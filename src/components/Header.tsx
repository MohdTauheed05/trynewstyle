import React, { useEffect, useRef } from 'react';

interface HeaderProps {
  shopName: string;
  onNavigateHome: () => void;
  cartCount: number;
  onOpenBag: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  shopName,
  onNavigateHome,
  cartCount,
  onOpenBag,
}) => {
  const brandName = (shopName || 'TRY THE LOOK').trim();
  const headerRef = useRef<HTMLElement | null>(null);

  // Publish the real header height so anchor jumps never hide under it
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const publish = () =>
      document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`);
    publish();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(publish) : null;
    ro?.observe(el);
    window.addEventListener('resize', publish);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', publish);
    };
  }, []);

  const scrollTo = (targetId?: string) => {
    if (!targetId || targetId === 'root') {
      onNavigateHome();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header ref={headerRef} className="sticky top-0 z-50 bg-white border-b border-[#e6ebf0] px-4 sm:px-8 lg:px-12 py-3.5 sm:py-4 select-none shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      <div className="flex items-center justify-between gap-4">
        {/* Brand Logo / Store Name */}
        <a
          href="./"
          onClick={(e) => {
            e.preventDefault();
            scrollTo('root');
          }}
          className="font-['Michroma'] uppercase font-bold text-xs sm:text-sm lg:text-[15px] tracking-[0.2em] text-[#16191f] hover:opacity-85 transition-opacity shrink-0"
          aria-label={`${brandName} Home`}
        >
          {brandName}
        </a>

        {/* Center: EXACTLY 3 Nav Headers */}
        <nav
          aria-label="Main Navigation"
          className="hidden sm:flex items-center gap-6 md:gap-9 lg:gap-12 font-['Michroma'] uppercase text-[10.5px] lg:text-[11.5px] tracking-[0.16em] text-[#828b96]"
        >
          <a
            href="#root"
            onClick={(e) => {
              e.preventDefault();
              scrollTo('root');
            }}
            className="text-[#16191f] hover:opacity-70 transition-opacity cursor-pointer"
          >
            HOME
          </a>

          <a
            href="#men-studio"
            onClick={(e) => {
              e.preventDefault();
              scrollTo('men-studio');
            }}
            className="hover:text-[#16191f] transition-colors cursor-pointer"
          >
            MEN'S STUDIO
          </a>

          <a
            href="#offcut-rail-section"
            onClick={(e) => {
              e.preventDefault();
              scrollTo('offcut-rail-section');
            }}
            className="hover:text-[#16191f] transition-colors cursor-pointer"
          >
            T-SHIRT COLLECTION 3D
          </a>

          <a
            href="#ladies-section"
            onClick={(e) => {
              e.preventDefault();
              scrollTo('ladies-section');
            }}
            className="hover:text-[#16191f] transition-colors cursor-pointer"
          >
            LADIES COLLECTION
          </a>

          <a
            href="#ladies-rail-section"
            onClick={(e) => {
              e.preventDefault();
              scrollTo('ladies-rail-section');
            }}
            className="hover:text-[#16191f] transition-colors cursor-pointer"
          >
            LADIES 3D TOPS
          </a>
        </nav>

        {/* Right: Only Shopping Cart (Admin button removed as requested) */}
        <div className="flex items-center shrink-0">
          <button
            id="open-bag"
            type="button"
            aria-label="Open Cart"
            onClick={onOpenBag}
            className="flex items-center gap-2 font-['Michroma'] uppercase text-[10.5px] lg:text-[11.5px] tracking-[0.14em] text-[#16191f] hover:opacity-75 transition-opacity cursor-pointer p-1"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4 fill-none stroke-current stroke-[1.6]"
              aria-hidden="true"
            >
              <path d="M5 8h14l1 13H4Z" />
              <path d="M9 10V6a3 3 0 0 1 6 0v4" />
            </svg>
            <span>
              Cart ({cartCount})
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Bar: Clean Tap Pills */}
      <nav
        aria-label="Mobile Navigation"
        className="flex sm:hidden items-center justify-between gap-1 mt-2.5 pt-2 border-t border-[#f0f3f7] font-['Michroma'] uppercase text-[8px] tracking-[0.08em] text-[#717b88] overflow-x-auto no-scrollbar"
      >
        <a
          href="#root"
          onClick={(e) => {
            e.preventDefault();
            scrollTo('root');
          }}
          className="px-2 py-1 rounded bg-[#16191f] text-white text-center whitespace-nowrap"
        >
          HOME
        </a>
        <a
          href="#men-studio"
          onClick={(e) => {
            e.preventDefault();
            scrollTo('men-studio');
          }}
          className="px-2 py-1 rounded bg-[#f3f6fa] hover:text-[#16191f] text-center whitespace-nowrap"
        >
          MEN'S
        </a>
        <a
          href="#offcut-rail-section"
          onClick={(e) => {
            e.preventDefault();
            scrollTo('offcut-rail-section');
          }}
          className="px-2 py-1 rounded bg-[#f3f6fa] hover:text-[#16191f] text-center whitespace-nowrap"
        >
          3D T-SHIRTS
        </a>
        <a
          href="#ladies-section"
          onClick={(e) => {
            e.preventDefault();
            scrollTo('ladies-section');
          }}
          className="px-2 py-1 rounded bg-[#f3f6fa] hover:text-[#16191f] text-center whitespace-nowrap"
        >
          LADIES LOOKBOOK
        </a>
        <a
          href="#ladies-rail-section"
          onClick={(e) => {
            e.preventDefault();
            scrollTo('ladies-rail-section');
          }}
          className="px-2 py-1 rounded bg-[#f3f6fa] hover:text-[#16191f] text-center whitespace-nowrap"
        >
          3D TOPS
        </a>
      </nav>
    </header>
  );
};
