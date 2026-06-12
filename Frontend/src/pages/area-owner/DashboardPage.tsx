import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Save,
  Terminal,
  ThumbsUp,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { PageTitle } from '../../components/shared/UIItems';
import { useAreaOwnerDashboard } from '../../hooks/useAreaOwnerDashboard';
import { usePSSRDetail } from '../../hooks/usePSSRDetail';
import { useTeamDirectory } from '../../hooks/useTeamDirectory';
import { api } from '../../services/api';
import type { CheckpointAttachment, PSSRWorkflowDetail } from '../../services/api';
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
  const queryClient = useQueryClient();
  const detailQuery = usePSSRDetail(pssrId);
  const detail = detailQuery.data;
  const punchMutation = useMutation({
    mutationFn: ({ point, patch }: { point: NonNullable<PSSRWorkflowDetail['punch_points']>[number]; patch: Partial<{ assigned_to_user_id: number | null; category: 'A' | 'B' | 'C'; due_date: string | null; status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED'; progress_remarks: string | null; closure_remarks: string | null; closure_evidence: string | null }> }) => api.updatePSSRPunchPoint(pssrId, point.id, {
      title: point.title,
      description: point.description ?? point.title,
      category: point.category as 'A' | 'B' | 'C',
      owning_department: point.owning_department,
      assigned_to_user_id: point.assigned_to_user_id ?? null,
      due_date: point.due_date ?? null,
      progress_remarks: point.progress_remarks ?? point.remarks ?? null,
      closure_remarks: point.closure_remarks ?? null,
      closure_evidence: point.closure_evidence ?? null,
      status: point.status as 'OPEN' | 'IN_PROGRESS' | 'CLOSED',
      question_id: point.question_id ?? null,
      ...patch,
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pssr-detail', pssrId] });
      void queryClient.invalidateQueries({ queryKey: ['area-owner-dashboard'] });
    },
  });
  const departmentProgress = useMemo(() => {
    if (!detail) return [];
    if (detail.department_progress?.length) {
      return detail.department_progress.map((row) => ({
        assignment: (detail.assignments ?? []).find((assignment) => assignment.id === row.assignment_id),
        department: row.department,
        answered: row.answered_questions,
        total: row.total_questions,
        pending: row.pending_questions,
        mandatoryPending: row.mandatory_pending,
        openPunchPoints: row.open_punch_points,
        completed: row.completed,
        status: row.status,
      }));
    }
    const questions = detail.questions ?? [];
    return (detail.assignments ?? []).map((assignment) => {
      const departmentQuestions = questions.filter((question) => departmentMatches(assignment.department, question.department_owner) || departmentMatches(question.department_owner, assignment.department));
      const answered = departmentQuestions.filter((question) => question.latest_response && question.latest_response.response !== 'PENDING').length;
      return {
        assignment,
        department: assignment.department,
        answered,
        total: departmentQuestions.length,
        pending: Math.max(departmentQuestions.length - answered, 0),
        mandatoryPending: departmentQuestions.filter((question) => question.mandatory && !question.latest_response).length,
        openPunchPoints: (detail.punch_points ?? []).filter((point) => departmentMatches(assignment.department, point.owning_department) && point.status !== 'CLOSED').length,
        completed: assignment.status === 'COMPLETED',
        status: assignment.status,
      };
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
                <ReviewValue label="MOC Details" value={detail.moc_type === 'MOC' ? (detail.moc_number ?? 'MOC number pending') : 'Non MOC PSSR'} />
                <ReviewValue label="Workflow Stage" value={workflowStateLabel(detail.workflow_state)} />
                <ReviewValue label="Progress" value={`${detail.progress ?? 0}%`} />
                <ReviewValue label="Mandatory Answers" value={`${detail.mandatory_questions_answered ?? 0}/${detail.mandatory_question_count ?? 0}`} />
                <ReviewValue label="Open Punch Points" value={String(detail.open_punch_points ?? 0)} />
                <ReviewValue label="Created" value={detail.created_at ? new Date(detail.created_at).toLocaleString() : 'Not recorded'} />
                <ReviewValue label="Submitted" value={detail.submitted_at ? new Date(detail.submitted_at).toLocaleString() : 'Not submitted'} />
                <ReviewValue label="Completed" value={detail.completed_at ? new Date(detail.completed_at).toLocaleString() : 'Not completed'} />
                <ReviewValue label="Approved" value={detail.approved_at ? new Date(detail.approved_at).toLocaleString() : 'Not approved'} />
                <ReviewValue label="Description" value={detail.description ?? 'Not recorded'} />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <UserReviewBlock label="Initiator" user={detail.initiator} fallback={detail.initiator_user_id ? `User ${detail.initiator_user_id}` : 'Not recorded'} />
                <UserReviewBlock label="Team Leader" user={detail.team_leader} fallback={detail.team_leader_user_id ? `User ${detail.team_leader_user_id}` : 'Not assigned'} />
                <UserReviewBlock label="Area Owner" user={detail.area_owner} fallback={detail.area_owner_user_id ? `User ${detail.area_owner_user_id}` : 'Not assigned'} />
              </div>

              <ReviewSection title="Assigned Members">
                {(detail.assignments ?? []).map((assignment) => (
                  <div key={assignment.id} className="grid grid-cols-1 gap-2 px-4 py-3 text-body-sm md:grid-cols-[1fr_220px_180px]">
                    <span className="font-bold text-on-surface">{assignment.department}</span>
                    <span className="text-on-surface-variant">{assignment.user?.full_name ?? `User ${assignment.user_id}`}</span>
                    <span className="text-on-surface-variant">{assignment.user?.employee_id ?? '-'} | {assignment.user?.designation ?? '-'}</span>
                  </div>
                ))}
              </ReviewSection>

              <ReviewSection title="Department Progress">
                {departmentProgress.map(({ assignment, department, answered, total, pending, mandatoryPending, openPunchPoints, completed, status }) => (
                  <div key={assignment?.id ?? department} className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px_180px] gap-2 px-4 py-3 text-body-sm">
                    <span className="font-bold text-on-surface">{department}<span className="block text-label-sm text-on-surface-variant">{assignment?.user?.full_name ?? (assignment?.user_id ? `User ${assignment.user_id}` : 'No assigned member')}</span></span>
                    <span className="text-on-surface-variant">{answered}/{total} answered</span>
                    <span className="text-on-surface-variant">{mandatoryPending} mandatory pending, {openPunchPoints} open punch</span>
                    <span className={completed ? 'font-bold text-green-700' : 'font-bold text-on-surface'}>{completed ? 'Finalized' : status}</span>
                  </div>
                ))}
              </ReviewSection>

              <ReviewSection title="Annexure Summary">
                {(detail.annexures ?? []).map((annexure) => {
                  const questions = (detail.questions ?? []).filter((question) => question.annexure_id === annexure.id);
                  const answered = questions.filter((question) => question.latest_response && question.latest_response.response !== 'PENDING').length;
                  return (
                    <div key={annexure.id} className="grid grid-cols-1 gap-2 px-4 py-3 text-body-sm md:grid-cols-[140px_1fr_160px_160px]">
                      <span className="font-black text-primary">{annexure.code}</span>
                      <span className="font-bold text-on-surface">{annexure.title}</span>
                      <span className="text-on-surface-variant">Rev {annexure.revision}</span>
                      <span className="text-on-surface-variant">{answered}/{questions.length} answered</span>
                    </div>
                  );
                })}
                {(detail.annexures ?? []).length === 0 && <p className="px-4 py-3 text-body-sm text-on-surface-variant">No annexures selected.</p>}
              </ReviewSection>

              <ReviewSection title="Checkpoint Review">
                {(detail.questions ?? []).map((question) => (
                  <div key={question.id} className="px-4 py-4 text-body-sm">
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_120px_220px]">
                      <div>
                        <p className="text-[10px] font-black uppercase text-primary">{question.department_owner} | {question.category}</p>
                        <p className="mt-1 font-black text-on-surface">{question.sequence}. {question.question_text}</p>
                        {question.question_description && <p className="mt-1 text-on-surface-variant">{question.question_description}</p>}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-outline">Answer</p>
                        <p className="font-black text-on-surface">{question.latest_response?.response ?? 'PENDING'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-outline">Owner</p>
                        <p className="font-bold text-on-surface">{question.assigned_user?.full_name ?? (question.assigned_user_id ? `User ${question.assigned_user_id}` : 'Department owner')}</p>
                        <p className="text-on-surface-variant">{question.assigned_user?.employee_id ?? '-'}</p>
                      </div>
                    </div>
                    <div className="mt-3 rounded border border-outline-variant bg-surface-container-low p-3">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_180px]">
                        <div>
                          <p className="text-[10px] font-black uppercase text-outline">Remarks</p>
                          <p className="font-bold text-on-surface-variant">{question.latest_response?.remarks || question.remarks || '-'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase text-outline">Answered By</p>
                          <p className="font-bold text-on-surface">{question.latest_response?.responded_by?.full_name ?? '-'}</p>
                          <p className="text-on-surface-variant">{question.latest_response?.responded_by?.employee_id ?? question.latest_response?.responded_by_department ?? '-'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase text-outline">Updated</p>
                          <p className="font-bold text-on-surface">{question.latest_response?.updated_at || question.latest_response?.responded_at ? new Date(question.latest_response.updated_at ?? question.latest_response.responded_at ?? '').toLocaleString() : '-'}</p>
                        </div>
                      </div>
                      <CheckpointAttachments pssrId={pssrId} attachments={question.latest_response?.attachments ?? []} />
                    </div>
                  </div>
                ))}
                {(detail.questions ?? []).length === 0 && <p className="px-4 py-3 text-body-sm text-on-surface-variant">No checkpoints recorded.</p>}
              </ReviewSection>
            </div>
          )}
          {detail && tab === 'punchlist' && (
            <div className="border border-outline-variant rounded divide-y divide-outline-variant">
              {(detail.punch_points ?? []).map((point) => (
                <AreaOwnerPunchPointRow
                  key={point.id}
                  point={point}
                  busy={punchMutation.isPending}
                  onSave={(patch) => punchMutation.mutate({ point, patch })}
                />
              ))}
              {(detail.punch_points ?? []).length === 0 && <p className="px-4 py-3 text-body-sm text-on-surface-variant">No punch items recorded.</p>}
            </div>
          )}
          {detail && tab === 'history' && (
            <div className="border border-outline-variant rounded divide-y divide-outline-variant">
              {(detail.audit_timeline ?? []).map((row) => (
                <div key={row.id} className="grid grid-cols-1 md:grid-cols-[170px_1fr_180px] gap-2 px-4 py-3 text-body-sm">
                  <p className="font-black text-on-surface">{row.action.replace(/_/g, ' ')}</p>
                  <p className="text-on-surface-variant">
                    {row.summary}
                    {row.action === 'PUNCH_EVIDENCE_UPLOADED' && row.metadata?.evidence_id != null && row.metadata?.punch_point_id != null && (
                      <button onClick={() => void api.viewPunchEvidence(pssrId, Number(row.metadata.punch_point_id), Number(row.metadata.evidence_id))} className="ml-2 font-black text-primary hover:underline">View Evidence</button>
                    )}
                  </p>
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

const AreaOwnerPunchPointRow: React.FC<{
  point: NonNullable<PSSRWorkflowDetail['punch_points']>[number];
  busy?: boolean;
  onSave: (patch: Partial<{ assigned_to_user_id: number | null; category: 'A' | 'B' | 'C'; due_date: string | null; status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED'; progress_remarks: string | null; closure_remarks: string | null; closure_evidence: string | null }>) => void;
}> = ({ point, busy, onSave }) => {
  const [search, setSearch] = useState('');
  const [assigneeId, setAssigneeId] = useState(point.assigned_to_user_id ? String(point.assigned_to_user_id) : '');
  const [category, setCategory] = useState(point.category as 'A' | 'B' | 'C');
  const [dueDate, setDueDate] = useState(toDateInputValue(point.due_date));
  const [status, setStatus] = useState(point.status as 'OPEN' | 'IN_PROGRESS' | 'CLOSED');
  const [progressRemarks, setProgressRemarks] = useState(point.progress_remarks ?? point.remarks ?? '');
  const [closureRemarks, setClosureRemarks] = useState(point.closure_remarks ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const directory = useTeamDirectory({
    page: 1,
    limit: 50,
    department: point.owning_department,
    search: search.trim() || undefined,
    role: 'TEAM_MEMBER',
  });
  const users = useMemo(() => {
    const byId = new Map<number, NonNullable<PSSRWorkflowDetail['punch_points']>[number]['assigned_to_user']>();
    if (point.assigned_to_user) byId.set(point.assigned_to_user.id, point.assigned_to_user);
    directory.data?.records.forEach((user) => byId.set(user.id, user));
    return Array.from(byId.values()).filter(Boolean);
  }, [directory.data?.records, point.assigned_to_user]);

  useEffect(() => {
    setAssigneeId(point.assigned_to_user_id ? String(point.assigned_to_user_id) : '');
    setCategory(point.category as 'A' | 'B' | 'C');
    setDueDate(toDateInputValue(point.due_date));
    setStatus(point.status as 'OPEN' | 'IN_PROGRESS' | 'CLOSED');
    setProgressRemarks(point.progress_remarks ?? point.remarks ?? '');
    setClosureRemarks(point.closure_remarks ?? '');
  }, [point]);

  return (
    <div className="space-y-3 px-4 py-4 text-body-sm">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(220px,1fr)_130px_170px_minmax(220px,280px)_auto] lg:items-end">
        <div>
          <p className="text-[10px] font-black uppercase text-primary">Punch Point</p>
          <p className="mt-1 font-black text-on-surface">{point.title}</p>
          <p className="mt-1 text-on-surface-variant">{point.description ?? '-'}</p>
        </div>
        <label className="block">
          <span className="text-[10px] font-black uppercase text-outline">Category</span>
          <select disabled={busy} value={category} onChange={(event) => setCategory(event.target.value as 'A' | 'B' | 'C')} className="mt-1 h-10 w-full rounded border border-outline-variant bg-transparent px-3 text-body-sm disabled:opacity-60">
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase text-outline">Due Date</span>
          <input disabled={busy} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1 h-10 w-full rounded border border-outline-variant bg-transparent px-3 text-body-sm disabled:opacity-60" />
        </label>
        <div className="grid grid-cols-1 gap-1">
          <span className="text-[10px] font-black uppercase text-outline">Assign To</span>
          <input disabled={busy} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search team member" className="h-8 rounded border border-outline-variant bg-transparent px-2 text-label-sm disabled:opacity-60" />
          <select disabled={busy || directory.isLoading} value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className="h-10 rounded border border-outline-variant bg-transparent px-3 text-body-sm disabled:opacity-60">
            <option value="">Unassigned</option>
            {users.map((user) => user && <option key={user.id} value={user.id}>{user.full_name} | {user.employee_id} | {user.designation ?? 'No designation'}</option>)}
          </select>
        </div>
        <button
          disabled={busy}
          onClick={() => onSave({
            assigned_to_user_id: assigneeId ? Number(assigneeId) : null,
            category,
            due_date: dueDate ? `${dueDate}T00:00:00` : null,
            status,
            progress_remarks: progressRemarks.trim() || null,
            closure_remarks: closureRemarks.trim() || null,
          })}
          className="inline-flex h-10 items-center justify-center gap-2 rounded bg-primary px-3 text-label-sm font-black text-on-primary disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          Save Punch Point
        </button>
      </div>
      <div className="rounded border border-outline-variant bg-surface-container-low p-4">
        <p className="text-[10px] font-black uppercase text-outline">Original Checkpoint</p>
        <p className="mt-1 font-black text-on-surface">{point.question_number ? `${point.question_number}. ` : ''}{point.checkpoint_question ?? 'No linked checkpoint'}</p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          <ReviewValue label="Annexure" value={point.annexure_name ?? '-'} />
          <ReviewValue label="Department" value={point.department ?? point.owning_department} />
          <ReviewValue label="Original Answer" value={point.original_answer ?? 'PENDING'} />
          <ReviewValue label="Original Remarks" value={point.original_remarks ?? '-'} />
        </div>
        <CheckpointAttachments pssrId={point.pssr_number ?? point.workflow_reference ?? ''} attachments={point.checkpoint_attachments ?? []} />
      </div>
      <div className="grid grid-cols-1 gap-2 border-t border-outline-variant pt-3 md:grid-cols-[160px_1fr_1fr]">
        <label className="block">
          <span className="text-[10px] font-black uppercase text-outline">Status</span>
          <select disabled={busy} value={status} onChange={(event) => setStatus(event.target.value as 'OPEN' | 'IN_PROGRESS' | 'CLOSED')} className="mt-1 h-10 w-full rounded border border-outline-variant bg-transparent px-3 text-body-sm disabled:opacity-60">
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="CLOSED">Closed</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase text-outline">Progress Remarks</span>
          <input disabled={busy} value={progressRemarks} onChange={(event) => setProgressRemarks(event.target.value)} className="mt-1 h-10 w-full rounded border border-outline-variant bg-transparent px-3 text-body-sm disabled:opacity-60" />
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase text-outline">Closure Remarks</span>
          <input disabled={busy} value={closureRemarks} onChange={(event) => setClosureRemarks(event.target.value)} className="mt-1 h-10 w-full rounded border border-outline-variant bg-transparent px-3 text-body-sm disabled:opacity-60" />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-2 text-label-sm text-on-surface-variant md:grid-cols-4">
        <span>Raised By: <span className="font-bold text-on-surface">{point.raised_by?.full_name ?? '-'}</span></span>
        <span>Assigned By: <span className="font-bold text-on-surface">{point.assigned_by?.full_name ?? '-'}</span></span>
        <span>Closed By: <span className="font-bold text-on-surface">{point.closed_by?.full_name ?? '-'}</span></span>
        <span>Updated: <span className="font-bold text-on-surface">{point.updated_at ? new Date(point.updated_at).toLocaleString() : '-'}</span></span>
      </div>
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase text-outline">Closure Evidence</p>
        {(point.evidence_attachments ?? []).map((evidence) => (
          <div key={evidence.id} className="flex flex-col gap-2 rounded border border-outline-variant p-3 md:flex-row md:items-center md:justify-between">
            <span className="font-bold text-on-surface">{evidence.file_name} <span className="font-normal text-on-surface-variant">by {evidence.uploaded_by?.full_name ?? 'Unknown'}</span></span>
            <div className="flex gap-2">
              <button onClick={() => void api.viewPunchEvidence(evidence.pssr_id, evidence.punch_point_id, evidence.id).catch((error: Error) => setMessage(error.message))} className="rounded border border-outline-variant px-3 py-2 text-[11px] font-black">View</button>
              <button onClick={() => void api.downloadPunchEvidence(evidence.pssr_id, evidence.punch_point_id, evidence.id, evidence.file_name).catch((error: Error) => setMessage(error.message))} className="rounded border border-outline-variant px-3 py-2 text-[11px] font-black text-primary">Download</button>
            </div>
          </div>
        ))}
        {(point.evidence_attachments ?? []).length === 0 && <p className="text-on-surface-variant">No closure evidence uploaded.</p>}
        {message && <p className="font-bold text-error">{message}</p>}
      </div>
    </div>
  );
};

const ReviewSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="overflow-hidden rounded border border-outline-variant">
    <div className="bg-surface-container-low px-4 py-3 text-label-md font-black uppercase text-on-surface">{title}</div>
    <div className="divide-y divide-outline-variant">{children}</div>
  </section>
);

const UserReviewBlock: React.FC<{
  label: string;
  user?: PSSRWorkflowDetail['initiator'] | null;
  fallback: string;
}> = ({ label, user, fallback }) => (
  <div className="rounded border border-outline-variant bg-surface-container-low p-3">
    <p className="text-[10px] font-black uppercase text-outline">{label}</p>
    <p className="mt-1 text-body-sm font-black text-on-surface">{user?.full_name ?? fallback}</p>
    <p className="text-label-sm font-bold text-on-surface-variant">{user?.employee_id ?? '-'} | {user?.department ?? '-'}</p>
    <p className="text-label-sm text-on-surface-variant">{user?.email ?? '-'}</p>
  </div>
);

const CheckpointAttachments: React.FC<{ pssrId: string; attachments: CheckpointAttachment[] }> = ({ pssrId, attachments }) => {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[10px] font-black uppercase text-outline">Attachments</p>
      {attachments.map((attachment) => (
        <div key={attachment.id} className="flex flex-col gap-2 rounded border border-outline-variant bg-surface-container-lowest p-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="truncate font-black text-on-surface">{attachment.file_name}</p>
            <p className="text-on-surface-variant">Uploaded by {attachment.uploaded_by?.full_name ?? 'Unknown'} | {attachment.uploaded_by?.employee_id ?? attachment.uploader_employee_code ?? '-'}</p>
            <p className="text-on-surface-variant">{attachment.uploaded_at ? new Date(attachment.uploaded_at).toLocaleString() : '-'}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => void api.downloadCheckpointAttachment(pssrId, attachment.id, attachment.file_name).catch((error: Error) => setMessage(error.message))} className="rounded border border-outline-variant px-3 py-2 text-[11px] font-black text-primary">Download</button>
            <button type="button" onClick={() => void api.viewCheckpointAttachment(pssrId, attachment.id).catch((error: Error) => setMessage(error.message))} className="rounded border border-outline-variant px-3 py-2 text-[11px] font-black text-on-surface">View</button>
          </div>
        </div>
      ))}
      {attachments.length === 0 && <p className="text-on-surface-variant">No attachment uploaded.</p>}
      {message && <p className="font-bold text-error">{message}</p>}
    </div>
  );
};

const ReviewValue: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded border border-outline-variant bg-surface-container-low p-3">
    <p className="text-[10px] font-black uppercase text-outline">{label}</p>
    <p className="mt-1 text-body-sm font-bold text-on-surface break-words">{value || 'Not recorded'}</p>
  </div>
);

function workflowStateLabel(state?: string | null): string {
  const labels: Record<string, string> = {
    UNDER_PREPARATION: 'Under Preparation',
    SUBMITTED: 'To Do',
    TODO: 'To Do',
    IN_PROGRESS: 'In Progress',
    COMPLETED_BY_DEPARTMENT: 'Completed by Department',
    COMPLETED_BY_TEAM: 'Completed by Department',
    PENDING_AREA_OWNER_APPROVAL: 'Pending Area Owner Approval',
    APPROVED: 'Approved',
    CLOSED: 'Closed',
    REJECTED: 'Rejected',
  };
  return labels[state ?? ''] ?? state ?? 'Not recorded';
}

function departmentMatches(expected: string, actual?: string | null): boolean {
  if (!actual) return expected === 'Others';
  const a = actual.toLowerCase().trim();
  const e = expected.toLowerCase().trim();
  if (e === 'safety / psm') return a.includes('safety') || a.includes('psm') || a.includes('hse');
  if (e === 'instrumentation' || e === 'instrumental') return a.includes('instrument');
  if (e === 'others') return ['other', 'it', 'admin'].some((token) => a.includes(token));
  return a.includes(e) || a.includes(e.replace(/s$/, ''));
}

function toDateInputValue(value?: string | null): string {
  if (!value) return '';
  return value.slice(0, 10);
}

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
