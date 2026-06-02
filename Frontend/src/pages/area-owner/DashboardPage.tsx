import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Terminal,
  ThumbsUp,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { PageTitle } from '../../components/shared/UIItems';
import { useAreaOwnerDashboard } from '../../hooks/useAreaOwnerDashboard';
import { usePSSRDetail } from '../../hooks/usePSSRDetail';
import { api } from '../../services/api';
import { ActivityFeedSkeleton, DashboardCardSkeleton } from '../../components/shared/Skeleton';
import type {
  AreaOwnerApprovedRecord,
  AreaOwnerMocRecord,
  AreaOwnerPendingRecord,
} from '../../types/area-owner-dashboard.types';

type DashboardTab = 'pending' | 'approved' | 'moc';
type DetailTab = 'details' | 'punchlist' | 'history';

export const AreaOwnerDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('pending');
  const [selectedPSSRId, setSelectedPSSRId] = useState<string | undefined>();
  const queryClient = useQueryClient();

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
  const approveMutation = useMutation({
    mutationFn: (pssrId: string) => api.transitionPSSR(pssrId, 'APPROVED'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['area-owner-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['pssr-detail'] });
    },
  });
  const rejectMutation = useMutation({
    mutationFn: (pssrId: string) => api.transitionPSSR(pssrId, 'REJECTED', 'Area owner requested rework.'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['area-owner-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['pssr-detail'] });
    },
  });

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
                : pendingRecords.map((item) => (
                  <PendingRecordCard
                    key={item.id}
                    item={item}
                    approving={approveMutation.isPending || rejectMutation.isPending}
                    onReview={() => setSelectedPSSRId(item.pssr_id)}
                    onApprove={() => approveMutation.mutate(item.pssr_id)}
                    onReject={() => rejectMutation.mutate(item.pssr_id)}
                  />
                )))}

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
      {selectedPSSRId && (
        <AreaOwnerPSSRReview
          pssrId={selectedPSSRId}
          onClose={() => setSelectedPSSRId(undefined)}
          onApprove={() => approveMutation.mutate(selectedPSSRId)}
          onReject={() => rejectMutation.mutate(selectedPSSRId)}
          busy={approveMutation.isPending || rejectMutation.isPending}
        />
      )}
    </div>
  );
};

export const AreaOwnerDashboardPage = AreaOwnerDashboard;

const PendingRecordCard: React.FC<{
  item: AreaOwnerPendingRecord;
  approving: boolean;
  onReview: () => void;
  onApprove: () => void;
  onReject: () => void;
}> = ({ item, approving, onReview, onApprove, onReject }) => (
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
      <button onClick={onReview} className="text-label-sm font-bold text-primary hover:underline">Review Workflow</button>
      <button disabled={approving} onClick={onApprove} className="text-label-sm font-bold text-green-600 hover:underline flex items-center gap-1 disabled:opacity-50">
        <ThumbsUp className="w-3.5 h-3.5" />
        Approve
      </button>
      <button disabled={approving} onClick={onReject} className="text-label-sm font-bold text-tertiary hover:underline disabled:opacity-50">Request Rework</button>
    </div>
  </div>
);

const AreaOwnerPSSRReview: React.FC<{
  pssrId: string;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}> = ({ pssrId, onClose, onApprove, onReject, busy }) => {
  const [tab, setTab] = useState<DetailTab>('details');
  const detailQuery = usePSSRDetail(pssrId);
  const detail = detailQuery.data;
  const departmentProgress = useMemo(() => {
    const questions = detail?.questions ?? [];
    const assignments = detail?.assignments ?? [];
    return assignments.map((assignment) => {
      const departmentQuestions = questions.filter((question) => question.department_owner === assignment.department);
      const answered = departmentQuestions.filter((question) => question.latest_response && question.latest_response.response !== 'PENDING').length;
      return { assignment, answered, total: departmentQuestions.length };
    });
  }, [detail]);

  return (
    <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-sm p-3 md:p-6 overflow-y-auto">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-6xl bg-surface-container-lowest border border-outline-variant rounded shadow-xl">
        <div className="sticky top-0 z-10 bg-surface-container-lowest border-b border-outline-variant px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Area Owner Review</p>
            <h2 className="text-headline-sm font-black text-on-surface">{pssrId}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button disabled={busy} onClick={onApprove} className="rounded bg-green-700 px-3 py-2 text-label-sm font-black text-white disabled:opacity-50">Approve</button>
            <button disabled={busy} onClick={onReject} className="rounded border border-outline-variant px-3 py-2 text-label-sm font-black text-tertiary disabled:opacity-50">Request Rework</button>
            <button onClick={onClose} className="rounded border border-outline-variant px-3 py-2 text-label-sm font-black text-on-surface">Close</button>
          </div>
        </div>
        <div className="p-4 md:p-6 space-y-5">
          <div className="flex flex-wrap gap-2 border-b border-outline-variant pb-3">
            {[
              ['details', 'PSSR Details'],
              ['punchlist', 'Punch List'],
              ['history', 'History'],
            ].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key as DetailTab)} className={`px-4 py-2 text-label-md font-bold uppercase transition-all ${tab === key ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-primary'}`}>{label}</button>
            ))}
          </div>
          {detailQuery.isLoading && <div className="h-40 rounded border border-outline-variant bg-surface-container-low animate-pulse" />}
          {detailQuery.error && <div className="rounded border border-error/30 bg-error/5 px-4 py-3 text-body-sm font-bold text-error">{detailQuery.error.message}</div>}
          {detail && tab === 'details' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <ReviewValue label="Plant / Unit" value={detail.plant_unit} />
                <ReviewValue label="Equipment / System" value={detail.equipment_system} />
                <ReviewValue label="Type" value={detail.moc_type} />
                <ReviewValue label="Progress" value={`${detail.progress ?? 0}%`} />
              </div>
              <div className="border border-outline-variant rounded divide-y divide-outline-variant">
                {departmentProgress.map(({ assignment, answered, total }) => (
                  <div key={assignment.id} className="grid grid-cols-1 md:grid-cols-[1fr_180px_140px] gap-2 px-4 py-3 text-body-sm">
                    <span className="font-bold text-on-surface">{assignment.department}<span className="block text-label-sm text-on-surface-variant">{assignment.user?.full_name ?? `User ${assignment.user_id}`}</span></span>
                    <span className="text-on-surface-variant">{answered}/{total} answered</span>
                    <span className="font-bold text-on-surface">{assignment.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {detail && tab === 'punchlist' && (
            <div className="border border-outline-variant rounded divide-y divide-outline-variant">
              {(detail.punch_points ?? []).map((point) => (
                <div key={point.id} className="px-4 py-3 text-body-sm">
                  <p className="font-bold text-on-surface">{point.title}</p>
                  <p className="text-on-surface-variant">{point.description}</p>
                  <p className="mt-1 text-[10px] font-black uppercase text-outline">{point.owning_department} | {point.status}</p>
                </div>
              ))}
              {(detail.punch_points ?? []).length === 0 && <p className="px-4 py-3 text-body-sm text-on-surface-variant">No punch items recorded.</p>}
            </div>
          )}
          {detail && tab === 'history' && (
            <div className="border border-outline-variant rounded divide-y divide-outline-variant">
              {(detail.audit_timeline ?? []).map((row) => (
                <div key={row.id} className="grid grid-cols-1 md:grid-cols-[170px_1fr_180px] gap-2 px-4 py-3 text-body-sm">
                  <p className="font-black text-on-surface">{row.action.replace(/_/g, ' ')}</p>
                  <p className="text-on-surface-variant">{row.summary}</p>
                  <p className="text-[10px] font-bold uppercase text-outline">{new Date(row.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const ReviewValue: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded border border-outline-variant bg-surface-container-low p-3">
    <p className="text-[10px] font-black uppercase text-outline">{label}</p>
    <p className="mt-1 text-body-sm font-bold text-on-surface break-words">{value || 'Not recorded'}</p>
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
  </div>
);

const EmptyPanel: React.FC<{ message: string }> = ({ message }) => (
  <div className="border border-outline-variant p-6 rounded text-center bg-surface-container-low">
    <p className="text-label-md font-black text-on-surface uppercase tracking-widest">{message}</p>
  </div>
);
