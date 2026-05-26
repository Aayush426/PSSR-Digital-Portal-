import React, { ReactNode } from 'react';

/**
 * Enterprise-grade operational layout for admin workspaces.
 * Provides a balanced split-panel architecture:
 * - Left panel: Controls, filters, list views (35% desktop, full on tablet)
 * - Right panel: Detail view, forms, operational data (65% desktop)
 * 
 * Benefits:
 * - Single scroll context (no nested scrolls)
 * - Responsive at sm/md/lg/xl breakpoints
 * - Proper viewport utilization
 * - Jira-style operational efficiency
 */

interface OperationalLayoutProps {
  /** Left side list/control panel */
  sidebar: ReactNode;
  /** Right side detail view */
  detail: ReactNode;
  /** Optional class overrides */
  className?: string;
  /** Override sidebar width (default: 35% on desktop) */
  sidebarWidthDesktop?: string;
  /** Custom gap between panels */
  gapSize?: 'sm' | 'md' | 'lg';
}

const gapMap = {
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
};

export const OperationalLayout: React.FC<OperationalLayoutProps> = ({
  sidebar,
  detail,
  className = '',
  sidebarWidthDesktop = 'w-[35%]',
  gapSize = 'md',
}) => {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-[1fr_1.85fr] ${gapMap[gapSize]} items-start w-full ${className}`}>
      {/* Left Sidebar Panel */}
      <aside className="w-full lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)]">
        {sidebar}
      </aside>

      {/* Right Detail Panel */}
      <main className="w-full min-w-0">
        {detail}
      </main>
    </div>
  );
};

/**
 * Compact list wrapper for the sidebar panel.
 * Handles scrolling, padding, and consistent styling.
 */
interface OperationalSidebarProps {
  children: ReactNode;
  header?: ReactNode;
  className?: string;
  maxHeight?: string;
  /** Show bottom border on header section */
  headerDivider?: boolean;
}

export const OperationalSidebar: React.FC<OperationalSidebarProps> = ({
  children,
  header,
  className = '',
  maxHeight = 'max-h-[calc(100vh-300px)]',
  headerDivider = true,
}) => {
  return (
    <div className={`bg-surface-container-lowest border border-outline-variant rounded shadow-sm overflow-hidden flex flex-col ${className}`}>
      {header && (
        <div className={`p-4 ${headerDivider ? 'border-b border-outline-variant' : ''} bg-surface`}>
          {header}
        </div>
      )}
      <div className={`overflow-y-auto ${maxHeight} p-3 space-y-2`}>
        {children}
      </div>
    </div>
  );
};

/**
 * Detail panel wrapper for right-side content.
 * Manages title, actions, and content sections.
 */
interface OperationalDetailProps {
  /** Panel title/header */
  title?: ReactNode;
  /** Right-side action buttons */
  actions?: ReactNode;
  /** Main content */
  children: ReactNode;
  /** Show header divider */
  headerDivider?: boolean;
  className?: string;
}

export const OperationalDetail: React.FC<OperationalDetailProps> = ({
  title,
  actions,
  children,
  headerDivider = true,
  className = '',
}) => {
  return (
    <div className={`bg-surface-container-lowest border border-outline-variant rounded shadow-sm overflow-hidden flex flex-col h-full ${className}`}>
      {(title || actions) && (
        <div className={`p-5 ${headerDivider ? 'border-b border-outline-variant' : ''} bg-surface`}>
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="min-w-0 flex-1">
              {title}
            </div>
            {actions && (
              <div className="flex flex-wrap items-center gap-2">
                {actions}
              </div>
            )}
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-5 lg:p-6">
        {children}
      </div>
    </div>
  );
};
