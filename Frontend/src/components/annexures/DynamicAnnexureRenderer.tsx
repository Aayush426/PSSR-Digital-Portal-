import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Clock3, FileUp, ShieldCheck, XCircle } from 'lucide-react';
import { useAnnexureDetail, useSaveAnnexureResponse } from '../../hooks/useAnnexures';
import { FormSkeleton, Skeleton } from '../shared/Skeleton';
import type { AnnexureQuestion, AnnexureResponseValue } from '../../types/annexure.types';

interface DynamicAnnexureRendererProps {
  annexureId?: number;
  pssrId: string;
}

const responseOptions: AnnexureResponseValue[] = ['PENDING', 'PASS', 'FAIL', 'NA'];

export const DynamicAnnexureRenderer: React.FC<DynamicAnnexureRendererProps> = ({ annexureId, pssrId }) => {
  const { data, isLoading } = useAnnexureDetail(annexureId, pssrId);
  const saveResponse = useSaveAnnexureResponse(pssrId);
  const [remarks, setRemarks] = useState<Record<number, string>>({});
  const [uploads, setUploads] = useState<Record<number, File | undefined>>({});

  const sectionStats = useMemo(() => {
    if (!data) return { total: 0, completed: 0, failed: 0 };
    const questions = data.sections.flatMap((section) => section.questions);
    return {
      total: questions.length,
      completed: questions.filter((question) => ['PASS', 'FAIL', 'NA'].includes(question.latest_response?.response ?? '')).length,
      failed: questions.filter((question) => question.latest_response?.response === 'FAIL').length,
    };
  }, [data]);

  if (!annexureId) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded p-8 text-center">
        <ShieldCheck className="w-10 h-10 text-primary mx-auto mb-3" />
        <p className="text-title-md font-black text-on-surface">Select an annexure</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return <FormSkeleton />;
  }

  const onResponseChange = (question: AnnexureQuestion, response: AnnexureResponseValue) => {
    const file = uploads[question.id];
    saveResponse.mutate({
      pssr_id: pssrId,
      annexure_id: data.id,
      question_id: question.id,
      response,
      remarks: remarks[question.id] ?? question.latest_response?.remarks ?? '',
      attachments: file
        ? [{ file_name: file.name, file_type: file.type, size: file.size, storage_path: `pending-browser-upload/${file.name}` }]
        : question.latest_response?.attachments ?? [],
    });
  };

  return (
    <div className="space-y-5">
      <div className="bg-surface-container-lowest border border-outline-variant rounded p-5">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">{data.code}</p>
            <h2 className="text-headline-sm font-black text-on-surface mt-1">{data.title}</h2>
            <p className="text-body-sm text-on-surface-variant mt-2 max-w-3xl">{data.description}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 min-w-[300px]">
            <Metric label="Progress" value={`${data.progress}%`} tone="primary" />
            <Metric label="Closed" value={`${sectionStats.completed}/${sectionStats.total}`} tone="success" />
            <Metric label="Failed" value={String(sectionStats.failed)} tone="danger" />
          </div>
        </div>
        <div className="mt-4 h-2 bg-surface-container rounded overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${data.progress}%` }} />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {data.sections.map((section) => (
          <motion.section
            key={section.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-surface-container-lowest border border-outline-variant rounded overflow-hidden"
          >
            <div className="bg-surface-container-low border-b border-outline-variant px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-title-sm font-black text-on-surface">{section.title}</p>
                <p className="text-[11px] font-bold uppercase tracking-widest text-outline mt-1">{section.section_type}</p>
              </div>
              <span className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
                {section.questions.length} checkpoints
              </span>
            </div>

            <div className="divide-y divide-outline-variant">
              {section.questions.map((question) => {
                const current = question.latest_response?.response ?? 'PENDING';
                return (
                  <div key={question.id} className="p-5 grid grid-cols-1 xl:grid-cols-[1fr_180px_260px] gap-4">
                    <div className="min-w-0">
                      <div className="flex items-start gap-3">
                        <StatusIcon status={current} />
                        <div>
                          <p className="text-body-sm font-bold text-on-surface leading-6">{question.question_text}</p>
                          <div className="flex flex-wrap gap-2 mt-3">
                            <Chip>{question.checked_by_department}</Chip>
                            <Chip>{question.category}</Chip>
                            {question.required && <Chip>Required</Chip>}
                          </div>
                        </div>
                      </div>
                    </div>

                    <select
                      value={current}
                      onChange={(event) => onResponseChange(question, event.target.value as AnnexureResponseValue)}
                      className="h-10 border border-outline-variant rounded bg-surface-container-lowest text-body-sm font-bold px-3 focus:ring-1 focus:ring-primary outline-none"
                    >
                      {responseOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>

                    <div className="space-y-3">
                      <textarea
                        value={remarks[question.id] ?? question.latest_response?.remarks ?? ''}
                        onChange={(event) => setRemarks((draft) => ({ ...draft, [question.id]: event.target.value }))}
                        onBlur={() => onResponseChange(question, current)}
                        className="w-full min-h-20 border border-outline-variant rounded bg-surface-container-lowest p-3 text-body-sm outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Remarks"
                      />
                      <label className="h-10 border border-dashed border-outline-variant rounded flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest text-outline hover:text-primary hover:border-primary cursor-pointer">
                        <FileUp className="w-4 h-4" />
                        Evidence
                        <input
                          type="file"
                          accept="image/*,.pdf,.doc,.docx"
                          className="hidden"
                          onChange={(event) => setUploads((draft) => ({ ...draft, [question.id]: event.target.files?.[0] }))}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>
        ))}
      </AnimatePresence>

      {saveResponse.isPending && <Skeleton className="h-2 w-full" />}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; tone: 'primary' | 'success' | 'danger' }> = ({ label, value, tone }) => {
  const toneClass = tone === 'success' ? 'text-green-700' : tone === 'danger' ? 'text-red-700' : 'text-primary';
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded p-3">
      <p className={`text-title-md font-black ${toneClass}`}>{value}</p>
      <p className="text-[10px] font-black uppercase tracking-widest text-outline mt-1">{label}</p>
    </div>
  );
};

const Chip: React.FC<React.PropsWithChildren> = ({ children }) => (
  <span className="bg-surface-container text-outline px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">
    {children}
  </span>
);

const StatusIcon: React.FC<{ status: AnnexureResponseValue }> = ({ status }) => {
  if (status === 'PASS') return <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />;
  if (status === 'FAIL') return <XCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />;
  if (status === 'NA') return <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />;
  return <Clock3 className="w-5 h-5 text-outline mt-0.5 shrink-0" />;
};
