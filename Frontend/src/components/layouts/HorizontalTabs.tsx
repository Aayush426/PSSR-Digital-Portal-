import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Enterprise horizontal tabs with smart scroll behavior.
 * Unlike wrapped tabs, this component handles overflow with scroll controls.
 * 
 * Benefits:
 * - No tab wrapping (stays on one line)
 * - Scroll arrows appear when tabs overflow
 * - Keyboard navigation support
 * - Mobile-friendly with optional stacking
 */

export interface HorizontalTabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  badge?: number;
}

interface HorizontalTabsProps {
  tabs: HorizontalTabItem[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  /** Allow tabs to stack on mobile instead of scroll */
  stackOnMobile?: boolean;
  className?: string;
  /** Variant: default, compact, pill */
  variant?: 'default' | 'compact' | 'pill';
}

export const HorizontalTabs: React.FC<HorizontalTabsProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  stackOnMobile = false,
  className = '',
  variant = 'default',
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    const container = scrollContainerRef.current;
    container?.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);
    return () => {
      container?.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  useEffect(() => {
    checkScroll();
  }, [tabs]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = 200;
    scrollContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const tabStyleMap = {
    default: {
      base: 'px-3 py-2 border text-label-sm font-bold transition-colors whitespace-nowrap',
      inactive: 'border-outline-variant bg-surface text-on-surface-variant hover:text-on-surface hover:border-primary/40',
      active: 'border-primary bg-primary/10 text-primary shadow-sm',
    },
    compact: {
      base: 'px-2.5 py-1.5 border text-[11px] font-bold transition-colors whitespace-nowrap',
      inactive: 'border-outline-variant bg-transparent text-on-surface-variant hover:text-primary',
      active: 'border-primary text-primary',
    },
    pill: {
      base: 'px-3 py-1.5 text-[12px] font-bold transition-colors whitespace-nowrap rounded-full',
      inactive: 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
      active: 'bg-primary text-on-primary shadow-sm',
    },
  };

  const styles = tabStyleMap[variant];

  return (
    <div className={`flex items-center gap-2 ${stackOnMobile ? 'flex-col md:flex-row' : ''} ${className}`}>
      {/* Left Scroll Button */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          aria-label="Scroll tabs left"
          className="shrink-0 p-1 text-outline hover:text-on-surface transition-colors hidden lg:flex"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Tabs Container */}
      <div
        ref={scrollContainerRef}
        className={`flex gap-2 overflow-x-auto overflow-y-hidden ${stackOnMobile ? 'md:overflow-x-visible' : ''} scrollbar-hide`}
        style={{
          // Hide native scrollbar
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && onTabChange(tab.id)}
              disabled={tab.disabled}
              className={`
                ${styles.base}
                ${isActive ? styles.active : styles.inactive}
                ${tab.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                flex items-center gap-2
              `}
              aria-selected={isActive}
              role="tab"
            >
              {tab.icon && <span className="shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-[10px] font-black rounded-full bg-error text-on-error">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Right Scroll Button */}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          aria-label="Scroll tabs right"
          className="shrink-0 p-1 text-outline hover:text-on-surface transition-colors hidden lg:flex"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

/**
 * Tab content wrapper. Use with HorizontalTabs for organized tab content.
 */
interface TabPanelProps {
  isActive: boolean;
  children: React.ReactNode;
  className?: string;
}

export const TabPanel: React.FC<TabPanelProps> = ({ isActive, children, className = '' }) => {
  if (!isActive) return null;
  return <div className={`animate-in fade-in duration-200 ${className}`}>{children}</div>;
};
