import React, { useState } from 'react';
import {
  AlertTriangle,
  Filter,
  Plus,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import { PageTitle } from '../../components/shared/UIItems';
import { UsersTable } from '../../components/tables/UsersTable';
import { useAdminUsers } from '../../hooks/useAdminUsers';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { UserTableSkeleton } from '../../components/shared/Skeleton';

/*
 ADMIN directory page.

 Features:
 - Server-side pagination
 - Cached React Query data
 - Smooth transitions using keepPreviousData
 - Search support
 - Large dataset scalability (10k+ users)
 - Virtualized rendering support through react-window
 - Zero UI freeze during pagination
*/

export const UsersPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const debouncedSearch = useDebouncedValue(search);

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useAdminUsers({
    search: debouncedSearch,
    page: currentPage,
    limit: pageSize,
  });

  /*
    Backend response contract:

    {
      records: [],
      pagination: {
        page,
        limit,
        total_pages,
        total_records
      }
    }
  */

  const users = data?.records ?? [];

  const pagination = data?.pagination;

  const totalPages = pagination?.total_pages ?? 1;
  const totalRecords = pagination?.total_records ?? 0;

  const activeCount = users.filter(
    (user: { active?: boolean }) => user.active
  ).length;

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      
      {/* HEADER */}
      

      <div className="flex justify-between items-start gap-4">
        <PageTitle
          title="User Directory"
          subtitle="Manage refinery personnel access, roles, and department assignments."
          breadcrumbs={['System', 'Administration', 'Users']}
        />

        <button className="bg-primary hover:bg-primary-container text-on-primary font-black text-label-md px-4 py-2 rounded flex items-center shadow-md transition-all active:scale-95">
          <Plus className="mr-2 w-4 h-4" />
          Add Access Control Record
        </button>
      </div>

      
      {/* FILTER BAR */}
      

      <div className="bg-surface border border-outline-variant p-3 rounded flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">

        <div className="flex flex-col md:flex-row md:items-center gap-3">

          {/* SEARCH */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />

            <input
              type="text"
              placeholder="Filter by name, ID or email..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setCurrentPage(1);
              }}
              className="pl-10 pr-4 py-2 border border-outline-variant rounded bg-surface-container-lowest text-body-sm w-full md:w-96 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            />
          </div>

          {/* FILTER BUTTON */}
          <button className="flex items-center px-4 py-2 bg-surface-container-low border border-outline-variant text-label-md font-bold text-on-surface-variant hover:bg-surface-container transition-colors rounded">
            <Filter className="mr-2 w-4 h-4" />
            Department: All
          </button>

          {/* REFRESH */}
          <button
            onClick={() => void refetch()}
            className="flex items-center px-4 py-2 bg-surface-container-lowest border border-outline-variant text-label-md font-bold text-primary hover:bg-surface-container transition-colors rounded"
          >
            <RefreshCw
              className={`mr-2 w-4 h-4 ${
                isFetching ? 'animate-spin' : ''
              }`}
            />
            Refresh
          </button>
        </div>

        {/* STATS */}
        <div className="text-label-sm text-outline font-bold uppercase tracking-widest">
          {activeCount} ACTIVE / {totalRecords} TOTAL DIRECTORY RECORDS
        </div>
      </div>

      
      {/* LOADING STATE */}
      

      {(isLoading || isFetching) && users.length === 0 && (
        <UserTableSkeleton />
      )}

      
      {/* ERROR STATE */}
      

      {!isLoading && error && (
        <div className="bg-error/5 border border-error/30 rounded p-5 flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />

          <div>
            <p className="text-label-md font-black uppercase tracking-widest text-error">
              Directory Fetch Failed
            </p>

            <p className="text-body-sm text-on-surface-variant mt-1">
              {error instanceof Error
                ? error.message
                : String(error)}
            </p>
          </div>
        </div>
      )}

      
      {/* EMPTY STATE */}
      

      {!isLoading && !error && users.length === 0 && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded p-8 text-center">

          <p className="text-headline-sm font-black text-on-surface">
            No personnel records found
          </p>

          <p className="text-body-sm text-on-surface-variant mt-2">
            Adjust filters or verify that the backend seed process completed.
          </p>
        </div>
      )}

      
      {/* USERS TABLE */}
      

      {!error && users.length > 0 && (
        <>
          <div className="relative">

            {/* subtle overlay while fetching next page */}
            {isFetching && (
              <div className="absolute inset-0 bg-black/5 z-10 rounded pointer-events-none" />
            )}

            <UsersTable users={users} />
          </div>

          
          {/* PAGINATION */}
          

          <div className="flex flex-col md:flex-row items-center justify-between gap-4">

            {/* PAGE CONTROLS */}
            <div className="flex items-center gap-3">

              <button
                disabled={currentPage === 1}
                onClick={handlePreviousPage}
                className="flex items-center px-4 py-2 border border-outline-variant rounded bg-surface hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </button>

              <div className="text-label-md font-black uppercase tracking-wide">
                Page {currentPage} of {totalPages}
              </div>

              <button
                disabled={currentPage === totalPages}
                onClick={handleNextPage}
                className="flex items-center px-4 py-2 border border-outline-variant rounded bg-surface hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>

            {/* PAGE SIZE */}
            <div className="flex items-center gap-2">

              <span className="text-body-sm text-on-surface-variant">
                Records per page
              </span>

              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setCurrentPage(1);
                }}
                className="border border-outline-variant rounded px-3 py-2 bg-surface"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
