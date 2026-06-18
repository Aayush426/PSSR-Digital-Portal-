import React, { memo } from 'react';

interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton primitive.
 *
 * Enterprise systems avoid blank states because operators interpret empty
 * panels as missing data or broken access. Skeletons preserve layout, signal
 * that work is in progress, and reduce perceived wait time without expensive
 * rendering.
 */
export const Skeleton = memo<SkeletonProps>(({ className = '' }) => (
  <div
    className={`relative overflow-hidden rounded bg-surface-container-high skeleton-shimmer ${className}`}
  />
));

Skeleton.displayName = 'Skeleton';

export const PageHeaderSkeleton = memo(() => (
  <div className="space-y-2">
    <Skeleton className="h-4 w-56" />
    <Skeleton className="h-7 w-72" />
    <Skeleton className="h-3 w-96 max-w-full" />
  </div>
));

PageHeaderSkeleton.displayName = 'PageHeaderSkeleton';

export const DashboardCardSkeleton = memo(() => (
  <div className="bg-surface-container-lowest border border-outline-variant p-4 rounded">
    <Skeleton className="h-5 w-5 mb-3" />
    <Skeleton className="h-3 w-24 mb-2" />
    <Skeleton className="h-5 w-40" />
  </div>
));

DashboardCardSkeleton.displayName = 'DashboardCardSkeleton';

export const SkeletonCard = DashboardCardSkeleton;

export const StatsWidgetSkeleton = memo(() => (
  <div className="bg-surface-container-low border border-outline-variant p-4 rounded">
    <Skeleton className="h-3 w-28 mx-auto mb-3" />
    <Skeleton className="h-7 w-16 mx-auto" />
  </div>
));

StatsWidgetSkeleton.displayName = 'StatsWidgetSkeleton';

export const FormSkeleton = memo(() => (
  <div className="space-y-4 bg-surface-container-lowest border border-outline-variant p-5 rounded">
    {[0, 1, 2].map((item) => (
      <div key={item} className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-full" />
      </div>
    ))}
  </div>
));

FormSkeleton.displayName = 'FormSkeleton';

export const ActivityFeedSkeleton = memo(() => (
  <div className="space-y-4">
    {[0, 1, 2].map((item) => (
      <div key={item} className="border-l-2 border-outline-variant pl-3 py-1">
        <Skeleton className="h-3 w-20 mb-2" />
        <Skeleton className="h-3 w-44 mb-2" />
        <Skeleton className="h-3 w-64 max-w-full" />
      </div>
    ))}
  </div>
));

ActivityFeedSkeleton.displayName = 'ActivityFeedSkeleton';

export const SidebarSkeleton = memo(() => (
  <aside className="w-60 bg-surface-container-low border-r border-outline-variant h-screen fixed left-0 top-0 p-4">
    <Skeleton className="h-8 w-36 mt-2 mb-8" />
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  </aside>
));

SidebarSkeleton.displayName = 'SidebarSkeleton';

export const UserTableSkeleton = memo(() => (
  <div className="bg-surface-container-lowest border border-outline-variant rounded shadow-sm overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-left min-w-[1040px]">
        <thead className="bg-surface-container-low border-b border-outline-variant">
          <tr>
            {['Employee', 'Email', 'Department', 'Role', 'Status', 'Last Login', 'Actions'].map((label) => (
              <th key={label} className="px-4 py-3 text-[10px] text-outline font-black uppercase tracking-wider">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {Array.from({ length: 10 }).map((_, index) => (
            <tr key={index}>
              <td className="px-4 py-4">
                <div className="flex items-center space-x-3">
                  <Skeleton className="w-8 h-8 rounded" />
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </td>
              <td className="px-4 py-4"><Skeleton className="h-3 w-44" /></td>
              <td className="px-4 py-4"><Skeleton className="h-3 w-28" /></td>
              <td className="px-4 py-4"><Skeleton className="h-5 w-24" /></td>
              <td className="px-4 py-4"><Skeleton className="h-5 w-20" /></td>
              <td className="px-4 py-4"><Skeleton className="h-3 w-32" /></td>
              <td className="px-4 py-4"><Skeleton className="h-5 w-20 ml-auto" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
));

UserTableSkeleton.displayName = 'UserTableSkeleton';

export const RouteSkeleton = memo(() => (
  <div className="space-y-6">
    <PageHeaderSkeleton />
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((item) => <DashboardCardSkeleton key={item} />)}
    </div>
    <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded">
      <ActivityFeedSkeleton />
    </div>
  </div>
));

RouteSkeleton.displayName = 'RouteSkeleton';

export const GlobalAppLoader = memo(() => (
  <div className="min-h-screen bg-inverse-surface flex items-center justify-center p-6">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-5" />
      <p className="text-on-primary text-headline-sm font-black uppercase tracking-widest">
        Digital PSSR Portal
      </p>
      <p className="text-outline-variant text-label-md font-bold uppercase tracking-widest mt-2">
        Initializing Secure PSSR Environment...
      </p>
    </div>
  </div>
));

GlobalAppLoader.displayName = 'GlobalAppLoader';
