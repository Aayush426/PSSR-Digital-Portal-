import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  BarChart3,
  ChevronDown,
  Download,
  FileCheck2,
  FileText,
  GripVertical,
  History,
  Layers3,
  Plus,
  RefreshCw,
  Save,
  Search,
  UploadCloud,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MiniMetric } from '@/components/admin/DepartmentPrimitives';
import { Skeleton } from '../../components/shared/Skeleton';
import {
  useAnnexureDetail,
  useAnnexureOverview,
  useAnnexures,
  useArchiveAnnexure,
  useCreateAnnexure,
  useRestoreAnnexure,
  useUpdateAnnexure,
  useUploadAnnexureTemplate,
} from '../../hooks/useAnnexures';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { annexureService } from '../../services/annexureService';
import type {
  AnnexureDetail,
  AnnexureMasterPayload,
  AnnexureOverview,
  AnnexureQuestionTemplatePayload,
  AnnexureResponseType,
  AnnexureSectionTemplatePayload,
  AnnexureSummary,
} from '../../types/annexure.types';

const DEPARTMENTS = ['Safety', 'PM Operation', 'Process', 'Mechanical', 'Inspection', 'Civil', 'Electrical', 'Instrumental', 'Fire', 'IT'];
const RESPONSE_TYPES: AnnexureResponseType[] = ['PASS_FAIL', 'YES_NO', 'YES_NO_NA', 'TEXT', 'NUMBER', 'DATE', 'CHECKBOX', 'MULTISELECT', 'FILE_UPLOAD', 'CUSTOM'];
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

const EMPTY_QUESTION: AnnexureQuestionTemplatePayload = {
  question_text: '',
  response_type: 'PASS_FAIL',
  department_owner: 'Safety',
  category: 'Document Control',
  required: true,
  sequence: 1,
  help_text: '',
  guidance_notes: '',
  expected_evidence: '',
  evidence_required: false,
  attachment_allowed: false,
  remarks_allowed: true,
  punch_point_enabled: true,
  severity: 'MEDIUM',
};

const EMPTY_SECTION: AnnexureSectionTemplatePayload = {
  title: 'New Controlled Section',
  section_type: 'CUSTOM',
  description: '',
  responsible_department: 'Safety',
  sort_order: 1,
  questions: [{ ...EMPTY_QUESTION }],
};

export const AnnexuresPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'manage'>();
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState<'active' | 'archived' | 'all'>('active');
  const [revision, setRevision] = useState('');
  const [hasTemplate, setHasTemplate] = useState<'all' | 'yes' | 'no'>('all');
  const [recentlyModified, setRecentlyModified] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | undefined>();
  const [editingId, setEditingId] = useState<number | undefined>();
  const [toast, setToast] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const overview = useAnnexureOverview();
  const list = useAnnexures({
    page,
    limit: 10,
    search: debouncedSearch,
    department: department || undefined,
    active: status === 'all' ? undefined : status === 'active',
    archived: status === 'archived' ? true : status === 'active' ? false : undefined,
    revision: revision || undefined,
    hasTemplate: hasTemplate === 'all' ? undefined : hasTemplate === 'yes',
    recentlyModified,
    sortBy: recentlyModified ? 'updated_at' : 'number',
    sortDir: recentlyModified ? 'desc' : 'asc',
  });
  const detail = useAnnexureDetail(selectedId);
  const archiveAnnexure = useArchiveAnnexure();
  const restoreAnnexure = useRestoreAnnexure();

  const annexures = list.data?.records ?? [];
  const selected = detail.data;

  useEffect(() => {
    if (!selectedId && annexures[0]) setSelectedId(annexures[0].id);
  }, [annexures, selectedId]);

  const revisions = useMemo(() => [...new Set(annexures.map((item) => item.revision))].sort(), [annexures]);
  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };

  const archiveOrRestore = (annexure: AnnexureSummary) => {
    const mutation = annexure.is_archived ? restoreAnnexure : archiveAnnexure;
    mutation.mutate(annexure.id, {
      onSuccess: () => showToast(annexure.is_archived ? 'Annexure restored to active master library.' : 'Annexure archived. Historical references are preserved.'),
      onError: (error) => showToast(error instanceof Error ? error.message : 'Archive action failed.'),
    });
  };

  return (
    <div className="w-full max-w-440 mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <nav className="flex items-center gap-2 text-label-sm font-bold text-on-surface-variant">
            <span>Admin</span>
            <span className="text-outline">/</span>
            <span className="text-primary">Annexures</span>
          </nav>
          <h1 className="mt-2 text-2xl font-black text-on-surface leading-tight">Annexure Master Templates</h1>
          <p className="mt-2 max-w-4xl text-body-md text-on-surface-variant">
            Reusable refinery PSSR annexure definitions, revisions, sections, questions, and controlled Word templates.
          </p>
        </div>
        <button onClick={() => setEditingId(0)} className="h-11 bg-primary hover:bg-primary-container text-on-primary font-black text-label-md px-4 rounded-md flex items-center justify-center shadow-sm transition-all active:scale-95 xl:self-end">
          <Plus className="mr-2 w-4 h-4" />
          New Annexure
        </button>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden shadow-sm">
        <div className="flex flex-wrap border-b border-outline-variant bg-surface-container-low sticky top-0 z-20">
          <TabButton active={activeTab === 'overview'} icon={<Layers3 className="w-4 h-4" />} label="Placeholder 1" onClick={() => setActiveTab('overview')} />
          <TabButton active={activeTab === 'analytics'} icon={<BarChart3 className="w-4 h-4" />} label="Placeholder 2" onClick={() => setActiveTab('analytics')} />
          <TabButton active={activeTab === 'manage'} icon={<FileText className="w-4 h-4" />} label="Manage Annexures" onClick={() => setActiveTab('manage')} />
        </div>

        {activeTab === 'overview' && <OverviewTab loading={overview.isLoading} stats={overview.data} search={search} onSearch={setSearch} />}
        {activeTab === 'analytics' && <AnalyticsTab loading={overview.isLoading} stats={overview.data} />}
        {activeTab === 'manage' && (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(440px,35%)_minmax(0,65%)] h-[calc(100vh-232px)] min-h-170 max-h-280 overflow-hidden">
            <div className="xl:border-r border-outline-variant bg-surface-container-low min-w-0 min-h-0 overflow-hidden">
              <AnnexureLibrary
                annexures={annexures}
                loading={list.isLoading}
                selectedId={selectedId}
                search={search}
                department={department}
                status={status}
                revision={revision}
                hasTemplate={hasTemplate}
                recentlyModified={recentlyModified}
                revisions={revisions}
                page={page}
                totalPages={list.data?.pagination.total_pages ?? 1}
                onSearch={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
                onDepartment={(value) => {
                  setDepartment(value);
                  setPage(1);
                }}
                onStatus={(value) => {
                  setStatus(value);
                  setPage(1);
                  setSelectedId(undefined);
                }}
                onRevision={(value) => {
                  setRevision(value);
                  setPage(1);
                }}
                onHasTemplate={(value) => {
                  setHasTemplate(value);
                  setPage(1);
                }}
                onRecentlyModified={setRecentlyModified}
                onPage={setPage}
                onSelect={setSelectedId}
              />
            </div>
            <div className="min-w-0 min-h-0 bg-surface overflow-hidden">
              <AnnexureDetailPanel
              annexure={selected}
              loading={detail.isLoading}
              onEdit={(id) => setEditingId(id)}
              onArchiveRestore={archiveOrRestore}
              onToast={showToast}
              />
            </div>
          </div>
        )}
      </div>

      {editingId !== undefined && (
        <AnnexureEditor
          annexureId={editingId || undefined}
          onClose={() => setEditingId(undefined)}
          onSaved={(id) => {
            setEditingId(undefined);
            if (id) setSelectedId(id);
            showToast('Annexure master saved with revision history.');
          }}
        />
      )}
      {toast && <div className="fixed bottom-5 right-5 z-50 bg-on-surface text-surface px-4 py-3 rounded-md shadow-xl text-body-sm font-bold">{toast}</div>}
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; icon: React.ReactNode; label: string; onClick: () => void }> = ({ active, icon, label, onClick }) => (
  <button onClick={onClick} className={`px-5 py-3.5 text-label-md font-black flex items-center gap-2 border-b-2 transition-colors ${active ? 'border-primary text-primary bg-surface-container-lowest' : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}`}>
    {icon}
    {label}
  </button>
);

const OverviewTab: React.FC<{ loading: boolean; stats?: AnnexureOverview; search: string; onSearch: (value: string) => void }> = ({ loading, stats, search, onSearch }) => {
  const cards: Array<[string, string | number | undefined, LucideIcon, string]> = [
    ['Total Templates', stats?.total_annexures, FileText, 'Master definitions controlled in the annexure library.'],
    ['Archived Templates', stats?.archived_annexures, Archive, 'Soft-archived records preserved for audit traceability.'],
    ['Active Revisions', stats?.latest_revision ?? '1.0', History, 'Latest controlled revision visible to operations.'],
    ['Total Questions', stats?.total_questions, FileCheck2, 'Checklist checkpoints available across all masters.'],
    ['Total Sections', stats?.total_sections, Layers3, 'Structured refinery compliance sections.'],
    ['Uploaded Templates', stats?.templates_uploaded, UploadCloud, 'Word source files attached to active masters.'],
  ];
  return (
    <div className="p-6 space-y-6 bg-surface">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <p className="text-xl font-black text-on-surface">Annexure Control Overview</p>
          <p className="text-body-sm text-on-surface-variant mt-1">Operational summary for refinery PSSR annexure governance.</p>
        </div>
        <div className="relative w-full xl:w-105">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search master annexures" className="pl-10 pr-4 h-10 border border-outline-variant rounded-md bg-surface-container-lowest text-body-sm w-full outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        {cards.map(([label, value, Icon, helper]) => (
          <div key={String(label)} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 min-h-36 shadow-sm">
            <div className="flex items-center justify-between">
              {loading ? <Skeleton className="h-12 w-28" /> : <p className="text-3xl font-black text-on-surface">{value ?? 0}</p>}
              <span className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </span>
            </div>
            <p className="text-label-sm text-outline font-black uppercase mt-3">{label}</p>
            <p className="text-body-sm text-on-surface-variant mt-2 leading-5">{helper}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)] gap-4">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Timeline title="Recently Modified Annexures" rows={stats?.recently_modified} primaryKey="title" secondaryKey="updated_at" />
          <Timeline title="Recent Activity" rows={stats?.recent_activity} primaryKey="summary" secondaryKey="created_at" />
          <Timeline title="Recently Uploaded Templates" rows={stats?.recently_uploaded_templates} primaryKey="file_name" secondaryKey="uploaded_at" />
          <Timeline title="Revision History Preview" rows={stats?.revision_history_preview} primaryKey="summary" secondaryKey="revision" />
        </div>
        <DepartmentUsageOverview total={stats?.department_visibility_count ?? 0} />
      </div>
    </div>
  );
};

const Timeline: React.FC<{ title: string; rows?: Array<Record<string, unknown>>; primaryKey: string; secondaryKey: string }> = ({ title, rows = [], primaryKey, secondaryKey }) => (
  <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 min-h-64 shadow-sm">
    <p className="text-label-lg font-black text-on-surface">{title}</p>
    <div className="mt-4 space-y-3">
      {rows.length === 0 && <p className="text-body-sm text-on-surface-variant">No records yet.</p>}
      {rows.map((row, index) => (
        <div key={`${title}-${index}`} className="border-l-2 border-primary/30 pl-3">
          <p className="text-body-sm font-bold text-on-surface line-clamp-2">{String(row[primaryKey] ?? 'Annexure update')}</p>
          <p className="text-[10px] text-outline font-black uppercase tracking-widest mt-1">{formatLooseDate(row[secondaryKey])}</p>
        </div>
      ))}
    </div>
  </div>
);

const AnalyticsTab: React.FC<{ loading: boolean; stats?: AnnexureOverview }> = ({ loading, stats }) => {
  const active = stats?.active_annexures ?? 0;
  const total = stats?.total_annexures ?? 0;
  const sections = stats?.total_sections ?? 0;
  const questions = stats?.total_questions ?? 0;
  const templates = stats?.templates_uploaded ?? 0;
  const analytics = [
    ['Template Coverage', total ? `${Math.round((templates / total) * 100)}%` : '0%', `${templates} of ${total} masters have active Word templates.`],
    ['Questions Per Section', sections ? (questions / sections).toFixed(1) : '0.0', `${questions} active questions across ${sections} controlled sections.`],
    ['Sections Per Active Master', active ? (sections / active).toFixed(1) : '0.0', `${sections} sections distributed across ${active} active annexures.`],
    ['Archived Masters', stats?.archived_annexures ?? 0, 'Soft-archived definitions remain preserved for historical references.'],
  ] as const;

  return (
    <div className="p-6 space-y-6 bg-surface">
      <div>
        <p className="text-xl font-black text-on-surface">Annexure Analytics Preview</p>
        <p className="text-body-sm text-on-surface-variant mt-1">Forward-looking reporting workspace for compliance throughput, usage, and governance signals.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4">
        {analytics.map(([label, value, helper]) => (
          <div key={label} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 min-h-36 shadow-sm">
            {loading ? <Skeleton className="h-10 w-24" /> : <p className="text-3xl font-black text-on-surface">{value}</p>}
            <p className="mt-3 text-label-sm font-black uppercase text-outline">{label}</p>
            <p className="mt-2 text-body-sm text-on-surface-variant leading-5">{helper}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <AnalyticsWidget title="Completion Trends" subtitle="PSSR annexure closure velocity" variant="bars" loading={loading} />
        <AnalyticsWidget title="Department Participation" subtitle="Review ownership distribution" variant="stack" loading={loading} />
        <AnalyticsWidget title="Template Usage" subtitle="Most referenced controlled templates" variant="lines" loading={loading} />
        <AnalyticsWidget title="Revision History" subtitle="Revision movement by governance cycle" variant="bars" loading={loading} />
        <AnalyticsWidget title="Compliance Heatmap" subtitle="Section readiness and checkpoint density" variant="heatmap" loading={loading} />
        <AnalyticsWidget title="Future Reporting Cards" subtitle="Operational exports and executive views" variant="cards" loading={loading} />
      </div>
    </div>
  );
};

const DepartmentUsageOverview: React.FC<{ total: number }> = ({ total }) => {
  const rows = DEPARTMENTS.slice(0, 7).map((department, index) => ({
    department,
    percent: Math.max(28, 92 - index * 9),
  }));

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 min-h-64 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-label-lg font-black text-on-surface">Department Usage Overview</p>
          <p className="text-body-sm text-on-surface-variant mt-1">Visibility footprint across refinery disciplines.</p>
        </div>
        <span className="h-9 px-3 rounded-md bg-primary/10 text-primary text-label-sm font-black flex items-center">{total}</span>
      </div>
      <div className="mt-5 space-y-3">
        {rows.map(({ department, percent }) => (
          <div key={department} className="grid grid-cols-[120px_1fr_44px] items-center gap-3">
            <p className="text-body-sm font-bold text-on-surface-variant truncate">{department}</p>
            <div className="h-2 rounded-full bg-surface-container overflow-hidden">
              <div className="h-full rounded-full bg-primary/70" style={{ width: `${percent}%` }} />
            </div>
            <p className="text-label-sm font-black text-outline text-right">{percent}%</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const AnalyticsWidget: React.FC<{ title: string; subtitle: string; variant: 'bars' | 'stack' | 'lines' | 'heatmap' | 'cards'; loading: boolean }> = ({ title, subtitle, variant, loading }) => (
  <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 min-h-72 shadow-sm overflow-hidden">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-label-lg font-black text-on-surface">{title}</p>
        <p className="text-body-sm text-on-surface-variant mt-1">{subtitle}</p>
      </div>
      <span className="text-label-sm font-black uppercase text-primary bg-primary/10 rounded-md px-2.5 py-1">Preview</span>
    </div>
    <div className="mt-6 h-44 rounded-lg border border-outline-variant bg-surface-container-low p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-surface/20 backdrop-blur-[1px]" />
      <div className="relative h-full">
        {loading ? <Skeleton className="h-full w-full" /> : <PreviewGraphic variant={variant} />}
      </div>
    </div>
  </div>
);

const PreviewGraphic: React.FC<{ variant: 'bars' | 'stack' | 'lines' | 'heatmap' | 'cards' }> = ({ variant }) => {
  if (variant === 'heatmap') {
    return (
      <div className="grid grid-cols-8 gap-2 h-full">
        {Array.from({ length: 32 }).map((_, index) => (
          <span key={index} className={`rounded ${index % 5 === 0 ? 'bg-tertiary/35' : index % 3 === 0 ? 'bg-primary/45' : 'bg-primary/20'}`} />
        ))}
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div className="grid grid-cols-2 gap-3 h-full">
        {['Export Queue', 'Audit View', 'Risk Lens', 'Ops Brief'].map((label) => (
          <div key={label} className="rounded-md border border-outline-variant bg-surface-container-lowest p-3">
            <div className="h-3 w-20 rounded bg-primary/25" />
            <div className="mt-4 h-2 w-full rounded bg-surface-container" />
            <div className="mt-2 h-2 w-2/3 rounded bg-surface-container" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'lines') {
    return (
      <div className="h-full flex flex-col justify-end gap-3">
        {[72, 48, 86].map((width, index) => (
          <div key={index} className="h-3 rounded-full bg-surface-container overflow-hidden">
            <div className={`${index === 1 ? 'bg-tertiary/45' : 'bg-primary/45'} h-full rounded-full`} style={{ width: `${width}%` }} />
          </div>
        ))}
      </div>
    );
  }

  const heights = variant === 'stack' ? [58, 74, 45, 88, 64, 72] : [42, 64, 52, 82, 71, 58, 90];
  return (
    <div className="h-full flex items-end gap-3">
      {heights.map((height, index) => (
        <div key={index} className="flex-1 rounded-t-md bg-primary/30 relative overflow-hidden" style={{ height: `${height}%` }}>
          {variant === 'stack' && <div className="absolute bottom-0 left-0 right-0 bg-tertiary/35" style={{ height: `${Math.max(20, height - 32)}%` }} />}
        </div>
      ))}
    </div>
  );
};

const AnnexureLibrary: React.FC<{
  annexures: AnnexureSummary[];
  loading: boolean;
  selectedId?: number;
  search: string;
  department: string;
  status: 'active' | 'archived' | 'all';
  revision: string;
  hasTemplate: 'all' | 'yes' | 'no';
  recentlyModified: boolean;
  revisions: string[];
  page: number;
  totalPages: number;
  onSearch: (value: string) => void;
  onDepartment: (value: string) => void;
  onStatus: (value: 'active' | 'archived' | 'all') => void;
  onRevision: (value: string) => void;
  onHasTemplate: (value: 'all' | 'yes' | 'no') => void;
  onRecentlyModified: (value: boolean) => void;
  onPage: (value: number) => void;
  onSelect: (id: number) => void;
}> = (props) => (
  <div className="h-full min-h-0 flex flex-col overflow-hidden">
    <div className="z-10 bg-surface-container-lowest/95 backdrop-blur border-b border-outline-variant p-4 space-y-3 shrink-0">
      <div>
        <p className="text-label-lg font-black text-on-surface">Master Library</p>
        <p className="text-body-sm text-on-surface-variant mt-1">Search, filter, and select controlled annexure definitions.</p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
        <input value={props.search} onChange={(event) => props.onSearch(event.target.value)} placeholder="Search by number, name, or code" className="pl-10 pr-4 h-10 border border-outline-variant rounded-md bg-surface text-body-sm w-full outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Select value={props.status} onChange={(value) => props.onStatus(value as 'active' | 'archived' | 'all')} options={[['active', 'Active'], ['archived', 'Archived'], ['all', 'All']]} />
        <Select value={props.department} onChange={props.onDepartment} options={[['', 'All Departments'], ...DEPARTMENTS.map((item) => [item, item] as [string, string])]} />
        <Select value={props.revision} onChange={props.onRevision} options={[['', 'All Revisions'], ...props.revisions.map((item) => [item, `Rev ${item}`] as [string, string])]} />
        <Select value={props.hasTemplate} onChange={(value) => props.onHasTemplate(value as 'all' | 'yes' | 'no')} options={[['all', 'Template: All'], ['yes', 'Has Template'], ['no', 'Missing Template']]} />
        <button onClick={() => props.onRecentlyModified(!props.recentlyModified)} className={`h-9 rounded-md border text-label-sm font-black sm:col-span-2 transition-colors ${props.recentlyModified ? 'bg-primary text-on-primary border-primary shadow-sm' : 'bg-surface border-outline-variant text-on-surface-variant hover:text-on-surface hover:border-outline'}`}>Recently Modified</button>
      </div>
    </div>
    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2.5">
      {props.loading && Array.from({ length: 10 }).map((_, index) => <Skeleton key={index} className="h-28 w-full" />)}
      {!props.loading && props.annexures.map((annexure) => (
        <button key={annexure.id} onClick={() => props.onSelect(annexure.id)} className={`w-full text-left border rounded-lg p-3.5 transition-all shadow-sm ${props.selectedId === annexure.id ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/10' : 'border-outline-variant bg-surface-container-lowest hover:border-outline hover:bg-surface'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex items-start gap-3">
              <span className="h-9 min-w-10 px-2 rounded-md bg-primary/10 text-primary text-label-sm font-black flex items-center justify-center">{annexure.code}</span>
              <div className="min-w-0">
                <p className="text-body-md font-black text-on-surface leading-5 line-clamp-2">{annexure.title}</p>
                <p className="text-label-sm font-black uppercase text-outline mt-1">Annexure {annexure.number}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge tone="info">Rev {annexure.revision}</Badge>
              <Badge tone={annexure.is_archived ? 'danger' : annexure.active ? 'success' : 'neutral'}>{annexure.status}</Badge>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <MiniMetric label="Sections" value={annexure.sections_count} />
            <MiniMetric label="Questions" value={annexure.questions_count} />
            <MiniMetric label="Template" value={annexure.uploaded_template ? 'Ready' : 'Missing'} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {annexure.departments.slice(0, 5).map((item) => <Chip key={item}>{item}</Chip>)}
            {annexure.departments.length > 5 && <Chip>+{annexure.departments.length - 5}</Chip>}
          </div>
        </button>
      ))}
      {!props.loading && props.annexures.length === 0 && <div className="border border-dashed border-outline-variant rounded-lg p-10 text-center text-body-sm text-on-surface-variant font-bold bg-surface-container-lowest">No annexure masters match the current filters.</div>}
    </div>
    <div className="border-t border-outline-variant p-3 flex items-center justify-between text-body-sm font-bold bg-surface-container-lowest shrink-0">
      <button disabled={props.page <= 1} onClick={() => props.onPage(props.page - 1)} className="h-9 px-3 border border-outline-variant rounded-md disabled:opacity-40 hover:bg-surface-container">Previous</button>
      <span>Page {props.page} of {Math.max(props.totalPages, 1)}</span>
      <button disabled={props.page >= props.totalPages} onClick={() => props.onPage(props.page + 1)} className="h-9 px-3 border border-outline-variant rounded-md disabled:opacity-40 hover:bg-surface-container">Next</button>
    </div>
  </div>
);

const AnnexureDetailPanel: React.FC<{
  annexure?: AnnexureDetail;
  loading: boolean;
  onEdit: (id: number) => void;
  onArchiveRestore: (annexure: AnnexureSummary) => void;
  onToast: (message: string) => void;
}> = ({ annexure, loading, onEdit, onArchiveRestore, onToast }) => {
  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-36 w-full" /><Skeleton className="h-96 w-full" /></div>;
  if (!annexure) return <div className="p-12 text-center text-body-sm text-on-surface-variant font-bold">Select an annexure master to inspect metadata, templates, sections, and revision history.</div>;
  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-surface min-w-0">
      <div className="z-10 bg-surface/95 backdrop-blur border-b border-outline-variant p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shrink-0">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="h-8 px-3 rounded-md bg-primary/10 text-primary text-label-sm font-black flex items-center">{annexure.code}</span>
            <Badge tone="info">Rev {annexure.revision}</Badge>
            <Badge tone={annexure.is_archived ? 'danger' : annexure.active ? 'success' : 'neutral'}>{annexure.status}</Badge>
          </div>
          <h2 className="mt-2 text-xl font-black text-on-surface leading-tight">{annexure.title}</h2>
          <p className="mt-2 text-body-sm text-on-surface-variant max-w-4xl line-clamp-2">{annexure.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => onEdit(annexure.id)} className="h-10 px-4 rounded-md bg-primary text-on-primary text-label-md font-black flex items-center gap-2 shadow-sm hover:bg-primary-container"><Save className="w-4 h-4" />Edit</button>
          <button onClick={() => onArchiveRestore(annexure)} className="h-10 px-4 rounded-md border border-outline-variant text-label-md font-black flex items-center gap-2 text-tertiary hover:bg-surface-container">
            {annexure.is_archived ? <RefreshCw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
            {annexure.is_archived ? 'Restore' : 'Archive'}
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
        <SectionShell title="Master Metadata">
          <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
            <Meta label="Annexure Number" value={annexure.code} />
            <Meta label="Revision" value={`Rev ${annexure.revision}`} />
            <Meta label="Status" value={annexure.status} />
            <Meta label="Last Modified" value={formatLooseDate(annexure.modified_at)} />
            <Meta label="Modified By" value={annexure.modified_by ? `User #${annexure.modified_by}` : 'System'} />
            <Meta label="Soft Delete State" value={annexure.is_archived ? `Archived ${formatLooseDate(annexure.archived_at)}` : 'Not archived'} />
          </div>
          <div className="mt-4 pt-4 border-t border-outline-variant">
            <p className="text-label-sm font-black uppercase text-outline">Visible Departments</p>
            <div className="mt-3 flex flex-wrap gap-1.5">{annexure.departments.map((item) => <Chip key={item}>{item}</Chip>)}</div>
          </div>
        </SectionShell>

        <SectionShell title="Template Management">
          <TemplateManager annexure={annexure} onToast={onToast} />
        </SectionShell>

        <SectionShell title="Section Builder">
          <div className="space-y-3">
            {annexure.sections.map((section) => (
              <details key={section.id} open className="group border border-outline-variant rounded-lg bg-surface-container-lowest overflow-hidden shadow-sm">
                <summary className="cursor-pointer px-4 py-3 flex items-center justify-between gap-4 text-label-lg font-black text-on-surface hover:bg-surface-container-low">
                  <span className="min-w-0 line-clamp-1">{section.sort_order}. {section.title}</span>
                  <ChevronDown className="w-4 h-4" />
                </summary>
                <div className="px-4 pb-4 pt-1 space-y-3">
                  <p className="text-body-sm text-on-surface-variant leading-5">{section.description || 'No section description recorded.'}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-3">
                    <Meta label="Owner Department" value={section.responsible_department ?? 'Shared'} />
                    <Meta label="Response Strategy" value={dominantResponse(section.questions.map((item) => item.response_type))} />
                    <Meta label="Mandatory" value={section.questions.some((item) => item.required) ? 'Yes' : 'No'} />
                    <Meta label="Question Count" value={String(section.questions.length)} />
                  </div>
                </div>
              </details>
            ))}
          </div>
        </SectionShell>

        <SectionShell title="Question Builder">
          <div className="space-y-4">
            {annexure.sections.map((section) => (
              <div key={section.id} className="border border-outline-variant rounded-lg overflow-hidden bg-surface-container-lowest shadow-sm">
                <div className="bg-surface-container-low px-4 py-3 text-label-md font-black text-on-surface border-b border-outline-variant">{section.title}</div>
                {section.questions.map((question) => (
                  <div key={question.id} className="p-4 border-t border-outline-variant first:border-t-0">
                    <div className="grid grid-cols-[40px_1fr] gap-4">
                      <span className="h-8 w-8 rounded-md bg-surface-container text-on-surface-variant text-label-sm font-black flex items-center justify-center">{question.sequence}</span>
                      <div className="min-w-0">
                        <p className="text-body-md font-bold text-on-surface leading-5">{question.question_text}</p>
                        {question.guidance_notes && <p className="mt-2 text-body-sm text-on-surface-variant leading-5">{question.guidance_notes}</p>}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 pl-0 md:pl-14">
                      <Badge tone="info">{question.response_type}</Badge>
                      <Badge tone={question.required ? 'danger' : 'neutral'}>{question.required ? 'Required' : 'Optional'}</Badge>
                      <Badge tone="neutral">{question.department_owner ?? question.checked_by_department}</Badge>
                      <Badge tone={question.attachment_allowed || question.evidence_required ? 'success' : 'neutral'}>{question.attachment_allowed || question.evidence_required ? 'Attachment allowed' : 'No attachment'}</Badge>
                      <Badge tone={question.punch_point_enabled !== false ? 'danger' : 'neutral'}>{question.punch_point_enabled !== false ? 'Punch enabled' : 'No punch'}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </SectionShell>
      </div>
    </div>
  );
};

const TemplateManager: React.FC<{ annexure: AnnexureDetail; onToast: (message: string) => void }> = ({ annexure, onToast }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadAnnexureTemplate();
  const [dragging, setDragging] = useState(false);
  const sendFile = (file?: File) => {
    if (!file) return;
    if (!/\.(doc|docx)$/i.test(file.name)) {
      onToast('Only .doc and .docx templates are supported.');
      return;
    }
    upload.mutate({ annexureId: annexure.id, version: annexure.revision, file }, {
      onSuccess: () => onToast('Template uploaded and active version replaced.'),
      onError: (error) => onToast(error instanceof Error ? error.message : 'Template upload failed.'),
    });
  };
  const download = async () => {
    try {
      await annexureService.downloadTemplate(annexure.id, annexure.uploaded_template?.file_name ?? `${annexure.code}.docx`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Template download failed.');
    }
  };
  return (
    <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)] gap-5">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          sendFile(event.dataTransfer.files[0]);
        }}
        className={`min-h-48 border border-dashed rounded-lg p-6 flex flex-col justify-between gap-5 transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-outline-variant bg-surface-container-lowest hover:border-outline'}`}
      >
        <div className="flex items-start gap-4 min-w-0">
          <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-label-sm font-black uppercase text-outline">Active Word Source</p>
            <p className="text-body-lg font-black text-on-surface wrap-break-words mt-1">{annexure.uploaded_template?.file_name ?? 'No active template uploaded'}</p>
            <p className="text-body-sm text-on-surface-variant mt-2 leading-5">Drop a .doc or .docx file here, or upload a replacement for controlled Rev {annexure.revision}.</p>
            {upload.isPending && (
              <div className="mt-4">
                <div className="h-2 rounded-full bg-surface-container overflow-hidden">
                  <div className="h-full w-2/3 bg-primary animate-pulse" />
                </div>
                <p className="text-label-sm font-black text-primary mt-2">Uploading template...</p>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button onClick={() => inputRef.current?.click()} className="h-10 px-4 rounded-md bg-primary text-on-primary text-label-md font-black flex items-center gap-2 hover:bg-primary-container"><UploadCloud className="w-4 h-4" />Upload</button>
          <button onClick={download} className="h-10 px-4 rounded-md border border-outline-variant text-label-md font-black flex items-center gap-2 hover:bg-surface-container"><Download className="w-4 h-4" />Download</button>
        </div>
        <input ref={inputRef} type="file" accept=".doc,.docx" className="hidden" onChange={(event) => sendFile(event.target.files?.[0])} />
      </div>
      <div className="border border-outline-variant rounded-lg overflow-hidden bg-surface-container-lowest">
        <div className="bg-surface-container-low px-4 py-3 text-label-sm uppercase font-black text-outline border-b border-outline-variant">Revision History Timeline</div>
        <div className="p-4 space-y-4">
          {(annexure.templates ?? []).slice(0, 5).map((template, index) => (
            <div key={index} className="relative pl-5">
              <span className="absolute left-0 top-1 h-2.5 w-2.5 rounded-full bg-primary" />
              {index < Math.min((annexure.templates ?? []).length, 5) - 1 && <span className="absolute left-1 top-4 h-[calc(100%+0.5rem)] w-px bg-outline-variant" />}
              <p className="text-body-sm font-bold text-on-surface wrap-break-words">{String(template.file_name ?? 'Template')}</p>
              <p className="text-label-sm font-black uppercase text-outline mt-1">Rev {String(template.version ?? annexure.revision)}</p>
            </div>
          ))}
          {(annexure.templates ?? []).length === 0 && <p className="text-body-sm text-on-surface-variant font-bold">No template versions recorded.</p>}
        </div>
      </div>
    </div>
  );
};

const AnnexureEditor: React.FC<{ annexureId?: number; onClose: () => void; onSaved: (id?: number) => void }> = ({ annexureId, onClose, onSaved }) => {
  const detail = useAnnexureDetail(annexureId);
  const createAnnexure = useCreateAnnexure();
  const updateAnnexure = useUpdateAnnexure(annexureId);
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({ 0: true });
  const [departmentQuery, setDepartmentQuery] = useState('');
  const [form, setForm] = useState<AnnexureMasterPayload>({
    number: 26,
    title: '',
    description: '',
    revision: '1.0',
    active: true,
    department_visibility: ['Safety'],
    sections: [{ ...EMPTY_SECTION, questions: [{ ...EMPTY_QUESTION }] }],
    change_summary: 'Administrative master update.',
  });

  useEffect(() => {
    if (detail.data) setForm(toPayload(detail.data));
  }, [detail.data]);

  const save = () => {
    const mutation = annexureId ? updateAnnexure : createAnnexure;
    mutation.mutate(form, {
      onSuccess: (result) => onSaved((result as AnnexureDetail).id),
    });
  };

  const addSection = () => {
    setForm((current) => ({ ...current, sections: resequenceSections([...current.sections, { ...EMPTY_SECTION, sort_order: current.sections.length + 1, questions: [] }]) }));
    setOpenSections((current) => ({ ...current, [form.sections.length]: true }));
  };

  const addQuestion = (sectionIndex: number) => setForm((current) => ({
    ...current,
    sections: current.sections.map((section, index) => index === sectionIndex ? { ...section, questions: resequenceQuestions([...section.questions, { ...EMPTY_QUESTION, sequence: section.questions.length + 1 }]) } : section),
  }));

  const moveSection = (from: number, to: number) => setForm((current) => ({ ...current, sections: resequenceSections(moveItem(current.sections, from, to)) }));
  const moveQuestion = (sectionIndex: number, from: number, to: number) => setForm((current) => ({
    ...current,
    sections: current.sections.map((section, index) => index === sectionIndex ? { ...section, questions: resequenceQuestions(moveItem(section.questions, from, to)) } : section),
  }));

  const visibleDepartments = DEPARTMENTS.filter((item) => item.toLowerCase().includes(departmentQuery.toLowerCase()));

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex justify-end">
      <div className="w-full max-w-7xl bg-surface h-full overflow-auto shadow-2xl">
        <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-outline-variant px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xl font-black text-on-surface">{annexureId ? 'Edit Annexure Master' : 'Create Annexure Master'}</p>
            <p className="text-body-sm text-on-surface-variant">Metadata, department visibility, sections, questions, and revision notes.</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-md border border-outline-variant flex items-center justify-center hover:bg-surface-container"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-6">
          {detail.isLoading ? <Skeleton className="h-96 w-full" /> : (
            <>
              <SectionShell title="Step 1: Master Metadata">
                <div className="grid grid-cols-1 md:grid-cols-[150px_1fr_170px_170px] gap-4">
                  <Field label="Number" type="number" value={String(form.number)} onChange={(value) => setForm({ ...form, number: Number(value) })} />
                  <Field label="Annexure Name" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
                  <Field label="Revision" value={form.revision} onChange={(value) => setForm({ ...form, revision: value })} />
                  <SelectField label="Status" value={form.active ? 'active' : 'inactive'} onChange={(value) => setForm({ ...form, active: value === 'active' })} options={[['active', 'Active'], ['inactive', 'Inactive']]} />
                </div>
                <TextArea label="Description" value={form.description ?? ''} onChange={(value) => setForm({ ...form, description: value })} />
                <Field label="Revision Notes" value={form.change_summary ?? ''} onChange={(value) => setForm({ ...form, change_summary: value })} />
              </SectionShell>

              <SectionShell title="Step 2: Department Visibility">
                <div className="relative max-w-md mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                  <input value={departmentQuery} onChange={(event) => setDepartmentQuery(event.target.value)} placeholder="Search departments" className="pl-10 pr-4 h-10 border border-outline-variant rounded-md bg-surface-container-lowest text-body-sm w-full outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {visibleDepartments.map((department) => {
                    const checked = form.department_visibility.includes(department);
                    return <button key={department} onClick={() => setForm((current) => ({ ...current, department_visibility: checked ? current.department_visibility.filter((item) => item !== department) : [...current.department_visibility, department] }))} className={`h-9 px-3 rounded-md border text-label-sm font-black transition-colors ${checked ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:text-on-surface hover:border-outline'}`}>{department}</button>;
                  })}
                </div>
              </SectionShell>

              <SectionShell title="Step 3: Section Builder">
                <div className="flex justify-end mb-3">
                  <button onClick={addSection} className="h-9 px-3 rounded border border-outline-variant text-label-md font-black flex items-center gap-2"><Plus className="w-4 h-4" />Section</button>
                </div>
                <div className="space-y-3">
                  {form.sections.map((section, sectionIndex) => (
                    <div key={sectionIndex} draggable onDragStart={(event) => event.dataTransfer.setData('section-index', String(sectionIndex))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => moveSection(Number(event.dataTransfer.getData('section-index')), sectionIndex)} className="border border-outline-variant rounded-lg bg-surface-container-lowest shadow-sm overflow-hidden">
                      <button onClick={() => setOpenSections((current) => ({ ...current, [sectionIndex]: !current[sectionIndex] }))} className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-surface-container-low">
                        <GripVertical className="w-4 h-4 text-outline" />
                        <span className="text-label-lg font-black flex-1 line-clamp-1">{section.sort_order}. {section.title || 'Untitled section'}</span>
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      {openSections[sectionIndex] !== false && (
                        <div className="p-5 border-t border-outline-variant space-y-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                            <Field label="Title" value={section.title} onChange={(value) => setForm(updateSection(form, sectionIndex, { title: value }))} />
                            <SelectField label="Type" value={section.section_type} onChange={(value) => setForm(updateSection(form, sectionIndex, { section_type: value }))} options={[['DOCUMENT', 'Document'], ['FIELD', 'Field'], ['CUSTOM', 'Custom']]} />
                            <SelectField label="Owner" value={section.responsible_department ?? ''} onChange={(value) => setForm(updateSection(form, sectionIndex, { responsible_department: value }))} options={DEPARTMENTS.map((item) => [item, item])} />
                            <SelectField label="Mandatory" value={section.questions.some((item) => item.required) ? 'yes' : 'no'} onChange={(value) => setForm({ ...form, sections: form.sections.map((current, index) => index === sectionIndex ? { ...current, questions: current.questions.map((question) => ({ ...question, required: value === 'yes' })) } : current) })} options={[['yes', 'Yes'], ['no', 'No']]} />
                          </div>
                          <TextArea label="Description" value={section.description ?? ''} onChange={(value) => setForm(updateSection(form, sectionIndex, { description: value }))} />
                          <QuestionEditor section={section} sectionIndex={sectionIndex} form={form} setForm={setForm} addQuestion={addQuestion} moveQuestion={moveQuestion} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </SectionShell>
            </>
          )}
        </div>
        <div className="sticky bottom-0 bg-surface/95 backdrop-blur border-t border-outline-variant p-4 flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 border border-outline-variant rounded-md font-black text-label-md hover:bg-surface-container">Cancel</button>
          <button onClick={save} disabled={!form.title || createAnnexure.isPending || updateAnnexure.isPending} className="h-10 px-4 bg-primary text-on-primary rounded-md font-black text-label-md disabled:opacity-50 hover:bg-primary-container">Save Master</button>
        </div>
      </div>
    </div>
  );
};

const QuestionEditor: React.FC<{
  section: AnnexureSectionTemplatePayload;
  sectionIndex: number;
  form: AnnexureMasterPayload;
  setForm: React.Dispatch<React.SetStateAction<AnnexureMasterPayload>>;
  addQuestion: (sectionIndex: number) => void;
  moveQuestion: (sectionIndex: number, from: number, to: number) => void;
}> = ({ section, sectionIndex, form, setForm, addQuestion, moveQuestion }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <p className="text-label-md font-black text-on-surface">Questions</p>
      <button onClick={() => addQuestion(sectionIndex)} className="h-9 px-3 rounded-md bg-surface-container text-label-md font-black flex items-center gap-2 hover:bg-surface-container-high"><Plus className="w-4 h-4" />Question</button>
    </div>
    {section.questions.map((question, questionIndex) => (
      <div key={questionIndex} draggable onDragStart={(event) => event.dataTransfer.setData('question-index', String(questionIndex))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => moveQuestion(sectionIndex, Number(event.dataTransfer.getData('question-index')), questionIndex)} className="border border-outline-variant rounded-lg p-4 bg-surface shadow-sm">
        <div className="grid grid-cols-1 xl:grid-cols-[24px_minmax(280px,1fr)_170px_170px_140px] gap-4 items-end">
          <GripVertical className="w-4 h-4 text-outline mb-3" />
          <Field label={`Question ${question.sequence}`} value={question.question_text} onChange={(value) => setForm(updateQuestion(form, sectionIndex, questionIndex, { question_text: value }))} />
          <SelectField label="Response Type" value={question.response_type} onChange={(value) => setForm(updateQuestion(form, sectionIndex, questionIndex, { response_type: value as AnnexureResponseType }))} options={RESPONSE_TYPES.map((item) => [item, item])} />
          <SelectField label="Department" value={question.department_owner ?? ''} onChange={(value) => setForm(updateQuestion(form, sectionIndex, questionIndex, { department_owner: value }))} options={DEPARTMENTS.map((item) => [item, item])} />
          <SelectField label="Severity" value={question.severity ?? 'MEDIUM'} onChange={(value) => setForm(updateQuestion(form, sectionIndex, questionIndex, { severity: value as AnnexureQuestionTemplatePayload['severity'] }))} options={SEVERITIES.map((item) => [item, item])} />
        </div>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TextArea label="Guidance Notes" value={question.guidance_notes ?? ''} onChange={(value) => setForm(updateQuestion(form, sectionIndex, questionIndex, { guidance_notes: value }))} />
          <Field label="Expected Evidence" value={question.expected_evidence ?? ''} onChange={(value) => setForm(updateQuestion(form, sectionIndex, questionIndex, { expected_evidence: value }))} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Toggle label="Required" checked={question.required} onChange={(value) => setForm(updateQuestion(form, sectionIndex, questionIndex, { required: value }))} />
          <Toggle label="Remarks Allowed" checked={question.remarks_allowed !== false} onChange={(value) => setForm(updateQuestion(form, sectionIndex, questionIndex, { remarks_allowed: value }))} />
          <Toggle label="Attachment Allowed" checked={question.attachment_allowed || question.evidence_required} onChange={(value) => setForm(updateQuestion(form, sectionIndex, questionIndex, { attachment_allowed: value, evidence_required: value }))} />
          <Toggle label="Punch Point Enabled" checked={question.punch_point_enabled !== false} onChange={(value) => setForm(updateQuestion(form, sectionIndex, questionIndex, { punch_point_enabled: value }))} />
        </div>
      </div>
    ))}
  </div>
);

const SectionShell: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="border border-outline-variant rounded-lg bg-surface-container-low p-5 shadow-sm">
    <h3 className="text-label-lg font-black text-on-surface mb-4">{title}</h3>
    {children}
  </section>
);

const Field: React.FC<{ label: string; value: string; onChange: (value: string) => void; type?: string }> = ({ label, value, onChange, type = 'text' }) => (
  <label className="block">
    <span className="text-label-sm font-black uppercase text-outline">{label}</span>
    <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full h-10 border border-outline-variant rounded-md bg-surface-container-lowest px-3 text-body-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
  </label>
);

const TextArea: React.FC<{ label: string; value: string; onChange: (value: string) => void }> = ({ label, value, onChange }) => (
  <label className="block">
    <span className="text-label-sm font-black uppercase text-outline">{label}</span>
    <textarea value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full min-h-24 border border-outline-variant rounded-md bg-surface-container-lowest p-3 text-body-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
  </label>
);

const SelectField: React.FC<{ label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }> = ({ label, value, onChange, options }) => (
  <label className="block">
    <span className="text-label-sm font-black uppercase text-outline">{label}</span>
    <Select value={value} onChange={onChange} options={options} className="mt-1.5 w-full" />
  </label>
);

const Select: React.FC<{ value: string; onChange: (value: string) => void; options: Array<[string, string]>; className?: string }> = ({ value, onChange, options, className = '' }) => (
  <select value={value} onChange={(event) => onChange(event.target.value)} className={`h-10 border border-outline-variant rounded-md bg-surface text-body-sm font-bold px-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${className}`}>
    {options.map(([optionValue, label]) => <option key={optionValue || label} value={optionValue}>{label}</option>)}
  </select>
);

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (value: boolean) => void }> = ({ label, checked, onChange }) => (
  <button onClick={() => onChange(!checked)} className={`h-9 px-3 rounded-md border text-label-sm font-black transition-colors ${checked ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:text-on-surface hover:border-outline'}`}>{label}</button>
);

const Meta: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 min-h-24 flex flex-col justify-between">
    <p className="text-label-sm font-black uppercase text-outline">{label}</p>
    <p className="text-body-md font-black text-on-surface mt-3 leading-5 wrap-break-words">{value}</p>
  </div>
);

const Badge: React.FC<{ children: React.ReactNode; tone: 'success' | 'danger' | 'info' | 'neutral' }> = ({ children, tone }) => {
  const classes = {
    success: 'bg-status-success-bg text-status-success-text',
    danger: 'bg-status-error-bg text-status-error-text',
    info: 'bg-primary/10 text-primary',
    neutral: 'bg-surface-container text-on-surface-variant',
  }[tone];
  return <span className={`inline-flex items-center min-h-6 px-2.5 py-1 rounded-md text-label-sm font-black uppercase ${classes}`}>{children}</span>;
};

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => <span className="inline-flex items-center min-h-7 px-2.5 rounded-md bg-surface-container text-on-surface-variant text-label-sm font-black">{children}</span>;

function toPayload(detail: AnnexureDetail): AnnexureMasterPayload {
  return {
    number: detail.number,
    title: detail.title,
    description: detail.description ?? '',
    revision: detail.revision,
    active: detail.active,
    department_visibility: detail.departments,
    change_summary: `Revision ${detail.revision} administrative update.`,
    sections: detail.sections.map((section) => ({
      id: section.id,
      title: section.title,
      section_type: section.section_type,
      description: section.description ?? '',
      responsible_department: section.responsible_department ?? '',
      sort_order: section.sort_order,
      questions: section.questions.map((question) => ({
        id: question.id,
        question_text: question.question_text,
        response_type: question.response_type,
        department_owner: question.department_owner ?? question.checked_by_department,
        category: question.category,
        expected_evidence: question.expected_evidence ?? '',
        required: question.required,
        sequence: question.sequence,
        help_text: question.help_text ?? '',
        guidance_notes: question.guidance_notes ?? '',
        evidence_required: question.evidence_required,
        attachment_allowed: question.attachment_allowed ?? question.evidence_required,
        remarks_allowed: question.remarks_allowed ?? true,
        punch_point_enabled: question.punch_point_enabled ?? true,
        severity: question.severity ?? 'MEDIUM',
        regulatory_reference: question.regulatory_reference ?? '',
      })),
    })),
  };
}

function updateSection(form: AnnexureMasterPayload, index: number, patch: Partial<AnnexureSectionTemplatePayload>): AnnexureMasterPayload {
  return { ...form, sections: form.sections.map((section, current) => current === index ? { ...section, ...patch } : section) };
}

function updateQuestion(form: AnnexureMasterPayload, sectionIndex: number, questionIndex: number, patch: Partial<AnnexureQuestionTemplatePayload>): AnnexureMasterPayload {
  return {
    ...form,
    sections: form.sections.map((section, currentSection) => currentSection === sectionIndex ? {
      ...section,
      questions: section.questions.map((question, currentQuestion) => currentQuestion === questionIndex ? { ...question, ...patch } : question),
    } : section),
  };
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (Number.isNaN(from) || from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function resequenceSections(sections: AnnexureSectionTemplatePayload[]) {
  return sections.map((section, index) => ({ ...section, sort_order: index + 1, questions: resequenceQuestions(section.questions) }));
}

function resequenceQuestions(questions: AnnexureQuestionTemplatePayload[]) {
  return questions.map((question, index) => ({ ...question, sequence: index + 1 }));
}

function dominantResponse(values: string[]): string {
  if (values.length === 0) return 'CUSTOM';
  const counts = values.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item]: (acc[item] ?? 0) + 1 }), {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function formatLooseDate(value: unknown): string {
  if (!value) return 'Not recorded';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}
