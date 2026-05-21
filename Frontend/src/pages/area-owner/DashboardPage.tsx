import React, { useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Terminal,
  ThumbsUp,
} from 'lucide-react';
import { motion } from 'motion/react';

import { PageTitle } from '../../components/shared/UIItems';
import { useAreaOwnerDashboard } from '../../hooks/useAreaOwnerDashboard';
import { ActivityFeedSkeleton, DashboardCardSkeleton } from '../../components/shared/Skeleton';
import type {
  AreaOwnerApprovedRecord,
  AreaOwnerMocRecord,
  AreaOwnerPendingRecord,
} from '../../types/area-owner-dashboard.types';

type DashboardTab = 'pending' | 'approved' | 'moc';

export const AreaOwnerDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('pending');

  const {
    data,
    isLoading,
    error,
  } = useAreaOwnerDashboard();

  const pendingRecords = data?.pending_records ?? [];
  const approvedRecords = data?.approved_records ?? [];
  const mocRecords = data?.moc_pending_records ?? [];
  const decisions = data?.decision_logs ?? [];

  const pendingCount = data?.stats.pending_count ?? pendingRecords.length;
  const approvedCount = data?.stats.approved_count ?? approvedRecords.length;
  const mocPendingCount = data?.stats.moc_pending_count ?? mocRecords.length;
  const approvalRate = data?.stats.approval_rate ?? 0;

  const stats = [
    {
      label: 'Pending Approval',
      value: pendingCount.toString(),
      icon: Clock,
      trend: 'Awaiting Review',
      color: 'text-tertiary',
    },
    {
      label: 'Approved',
      value: approvedCount.toString(),
      icon: CheckCircle2,
      trend: `${approvalRate}% Rate`,
      color: 'text-green-600',
    },
    {
      label: 'MOC Pending',
      value: mocPendingCount.toString(),
      icon: AlertTriangle,
      trend: 'Safety Critical',
      color: 'text-error',
    },
    {
      label: 'Approval Rate',
      value: `${approvalRate}%`,
      icon: BarChart3,
      trend: 'Current Cycle',
      color: 'text-primary',
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-8">
        <PageTitle
          title="Area Owner Dashboard"
          subtitle="Loading refinery operational approvals..."
          breadcrumbs={['Area Management', 'Approvals']}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <DashboardCardSkeleton key={index} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm">
            <ActivityFeedSkeleton />
          </div>
          <div className="bg-surface-container-highest border border-on-surface/5 p-6 rounded shadow-sm">
            <ActivityFeedSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageTitle
          title="Area Owner Dashboard"
          subtitle="Unable to load operational dashboard."
          breadcrumbs={['Area Management', 'Approvals']}
        />

        <div className="bg-error/5 border border-error/20 rounded p-6">
          <p className="text-error font-black uppercase tracking-wider">
            Dashboard Load Failed
          </p>

          <p className="text-body-sm text-on-surface-variant mt-2">
            {error instanceof Error
              ? error.message
              : 'Unknown dashboard loading error.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageTitle
        title="Area Owner Dashboard"
        subtitle="Review and approve refinery PSSR submissions."
        breadcrumbs={['Area Management', 'Approvals']}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-surface-container-lowest border border-outline-variant p-5 rounded shadow-sm"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-surface-container-low rounded">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>

              <span className="text-[10px] font-black tracking-widest uppercase text-outline">
                {stat.trend}
              </span>
            </div>

            <p className="text-label-sm text-outline uppercase tracking-wider mb-1 font-bold">
              {stat.label}
            </p>

            <h3 className="text-3xl font-black text-on-surface">
              {stat.value}
            </h3>
          </motion.div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Section */}
        <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm">
          <div className="flex space-x-2 border-b border-outline-variant pb-4 mb-6">
            {[
              {
                key: 'pending',
                label: `Pending (${pendingCount})`,
              },
              {
                key: 'approved',
                label: `Approved (${approvedCount})`,
              },
              {
                key: 'moc',
                label: `MOC Pending (${mocPendingCount})`,
              },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as DashboardTab)}
                className={`px-4 py-2 text-label-md font-bold uppercase transition-all ${
                  activeTab === tab.key
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {activeTab === 'pending' &&
              (pendingRecords.length === 0
                ? <EmptyPanel message="No live PSSR approvals are pending." />
                : pendingRecords.map((item) => <PendingRecordCard key={item.id} item={item} />))}

            {activeTab === 'approved' &&
              (approvedRecords.length === 0
                ? <EmptyPanel message="No approved PSSR records are available." />
                : approvedRecords.map((item) => <ApprovedRecordCard key={item.id} item={item} />))}

            {activeTab === 'moc' &&
              (mocRecords.length === 0
                ? <EmptyPanel message="No MOC records are pending review." />
                : mocRecords.map((item) => <MocRecordCard key={item.id} item={item} />))}
          </div>
        </div>

        {/* Decision Log */}
        <div className="bg-surface-container-highest border border-on-surface/5 p-6 rounded shadow-sm">
          <div className="flex items-center space-x-2 mb-6">
            <Terminal className="w-4 h-4 text-primary" />

            <h3 className="text-label-md font-black uppercase tracking-widest">
              Decision Log
            </h3>
          </div>

          <div className="space-y-4 font-mono text-[11px]">
            {decisions.length === 0 ? (
              <p className="text-on-surface-variant">No decisions have been recorded.</p>
            ) : (
              decisions.map((decision) => (
                <div key={decision.id} className="border-l-2 border-primary pl-3">
                  <p className="italic text-on-surface-variant">{decision.timestamp}</p>
                  <p className="font-bold underline">{decision.action}</p>
                  <p className="text-[10px] text-on-surface-variant">{decision.detail}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const AreaOwnerDashboardPage = AreaOwnerDashboard;

const PendingRecordCard: React.FC<{ item: AreaOwnerPendingRecord }> = ({ item }) => (
  <div className="border border-outline-variant p-4 rounded">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-label-md font-bold">{item.pssr_id}</p>
        <p className="text-body-sm text-on-surface-variant mt-1">Submitted by {item.submitted_by}</p>
        <div className="flex flex-wrap gap-4 mt-3 text-[11px] text-on-surface-variant">
          <span>Unit: <span className="font-bold text-on-surface">{item.unit}</span></span>
          <span>Department: <span className="font-bold text-on-surface">{item.department}</span></span>
        </div>
      </div>
    </div>

    <div className="flex gap-3 mt-4 pt-4 border-t border-outline-variant">
      <button className="text-label-sm font-bold text-primary hover:underline">Review Checklist</button>
      <button className="text-label-sm font-bold text-green-600 hover:underline flex items-center gap-1">
        <ThumbsUp className="w-3.5 h-3.5" />
        Approve
      </button>
      <button className="text-label-sm font-bold text-tertiary hover:underline">Request Revision</button>
    </div>
  </div>
);

const ApprovedRecordCard: React.FC<{ item: AreaOwnerApprovedRecord }> = ({ item }) => (
  <div className="border border-outline-variant p-4 rounded">
    <p className="font-bold">{item.pssr_id}</p>
    <p className="text-body-sm text-on-surface-variant mt-1">Approved by {item.approved_by}</p>
    <div className="mt-3">
      <span className="bg-green-100/50 text-green-700 px-2 py-1 rounded text-[11px] font-bold">APPROVED</span>
    </div>
  </div>
);

const MocRecordCard: React.FC<{ item: AreaOwnerMocRecord }> = ({ item }) => (
  <div className="border border-outline-variant p-4 rounded">
    <p className="font-bold">{item.moc_id}</p>
    <p className="text-body-sm text-on-surface-variant mt-1">Due: {item.due_date ?? 'Not scheduled'}</p>
    <div className="mt-3">
      <span className="bg-error/10 text-error px-2 py-1 rounded text-[11px] font-bold">{item.priority}</span>
    </div>
  </div>
);

const EmptyPanel: React.FC<{ message: string }> = ({ message }) => (
  <div className="border border-outline-variant p-6 rounded text-center bg-surface-container-low">
    <p className="text-label-md font-black text-on-surface uppercase tracking-widest">{message}</p>
  </div>
);
