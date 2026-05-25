import React, { useMemo, useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';


import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type {
  PssrAnnexureAddPayload,
  PssrCreatePayload,
  PssrDetails,
  PssrMemberAssignmentPayload,
  PssrMocType,
  PssrSaveDraftPayload,
  PssrSubmitPayload,
  PssrUpdateDraftPayload,
} from '../../types/app.types';

import type { PssrAnnexure } from '../../types/app.types';
import { CheckCircle2, Loader2, Plus, Save, Send, Square, Trash2 } from 'lucide-react';

type TabKey = 'DETAILS' | 'MEMBERS' | 'ANNEXURES';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'DETAILS', label: 'PSSR Details' },
  { key: 'MEMBERS', label: 'Add Members' },
  { key: 'ANNEXURES', label: 'Add Annexures' },
];

type PendingAnnexureDraft = {
  annexure_code: string;
  annexure_name: string;
  annexure_category?: string | null;
};

function safeTrim(v: string) {
  return v.trim();
}

export function PssrCreationModal(props: {
  open: boolean;
  onClose: () => void;
  onCreated?: (pssr: PssrDetails) => void;
}) {
  const { open, onClose, onCreated } = props;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<TabKey>('DETAILS');

  // DETAILS
  const [mocType, setMocType] = useState<PssrMocType>('MOC');
  const [pssrBaseNumber, setPssrBaseNumber] = useState<string>('');
  const [mocNumber, setMocNumber] = useState<string>('');
  const [subArea, setSubArea] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // MEMBERS
  const [memberUserIdInput, setMemberUserIdInput] = useState<string>('');
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [memberDepartmentInput, setMemberDepartmentInput] = useState<string>('');
  const [memberDesignationInput, setMemberDesignationInput] = useState<string>('');

  // ANNEXURES
  const [annexureCodeInput, setAnnexureCodeInput] = useState<string>('');
  const [annexureNameInput, setAnnexureNameInput] = useState<string>('');
  const [annexureCategoryInput, setAnnexureCategoryInput] = useState<string>('');
  const [annexures, setAnnexures] = useState<PendingAnnexureDraft[]>([]);

  const [pssrId, setPssrId] = useState<number | null>(null);
  const [pssrNumberPreview, setPssrNumberPreview] = useState<string>('');

  const parsedMemberUserId = useMemo(() => {
    const n = Number(memberUserIdInput);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [memberUserIdInput]);

  const canCreate = useMemo(() => {
    if (!user) return false;
    if (!pssrBaseNumber.trim()) return false;
    if (mocType === 'MOC' && !mocNumber.trim()) return false;
    if (subArea && subArea.length > 100) return false;
    if (description && description.length > 2000) return false;
    return true;
  }, [user, pssrBaseNumber, mocType, mocNumber, subArea, description]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not available');

      const payload: PssrCreatePayload = {
        details: {
          pssr_number: safeTrim(pssrBaseNumber),
          is_moc: mocType === 'MOC',
          moc_number: mocType === 'MOC' ? safeTrim(mocNumber) : null,
          area: user.department,
          sub_area: safeTrim(subArea) ? safeTrim(subArea) : null,
          description: safeTrim(description) ? safeTrim(description) : null,
        },
        members: [],
        annexures: [],
      };

      return api.createPssr(payload);
    },
    onSuccess: async (data) => {
      setPssrId(data.id);
      setPssrNumberPreview(data.pssr_number);
      onCreated?.(data);

      // add pending members
      if (memberIds.length) {
        if (!memberDepartmentInput.trim() || !memberDesignationInput.trim()) {
          throw new Error('Member department and designation are required to add members.');
        }

        await Promise.all(
          memberIds.map((uid) =>
            api.addPssrMember(data.id, {
              user_id: uid,
              department: safeTrim(memberDepartmentInput),
              designation: safeTrim(memberDesignationInput),
            } satisfies PssrMemberAssignmentPayload)
          )
        );
      }

      // add pending annexures
      if (annexures.length) {
        await Promise.all(
          annexures.map((a) =>
            api.addPssrAnnexure(data.id, {
              annexure_code: a.annexure_code,
              annexure_name: a.annexure_name,
              annexure_category: a.annexure_category ?? null,
            } satisfies PssrAnnexureAddPayload)
          )
        );
      }

      await queryClient.invalidateQueries({ queryKey: ['pssr:my'] }).catch(() => {});
      setTab('MEMBERS');
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      if (!pssrId) throw new Error('PSSR not created yet.');

      const updatePayload: PssrUpdateDraftPayload = {
        details: {
          is_moc: mocType === 'MOC',
          moc_number: mocType === 'MOC' ? safeTrim(mocNumber) || null : null,
          area: user?.department ?? '',
          sub_area: safeTrim(subArea) ? safeTrim(subArea) : null,
          description: safeTrim(description) ? safeTrim(description) : null,
          pssr_number: pssrNumberPreview,
        },
      };

      const payload: PssrSaveDraftPayload = {} as PssrSaveDraftPayload;

      await api.updatePssrDraft(pssrId, updatePayload);
      return api.savePssrDraft(pssrId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pssr:my'] }).catch(() => {});
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!pssrId) throw new Error('PSSR not created yet.');

      const payload: PssrSubmitPayload = {} as PssrSubmitPayload;
      return api.submitPssr(pssrId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pssr:my'] }).catch(() => {});
      onClose();
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async (uid: number) => {
      if (!pssrId) throw new Error('PSSR not created yet.');

      return api.addPssrMember(pssrId, {
        user_id: uid,
        department: safeTrim(memberDepartmentInput),
        designation: safeTrim(memberDesignationInput),
      } satisfies PssrMemberAssignmentPayload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pssr:my'] }).catch(() => {});
    },
  });

  const addAnnexureMutation = useMutation({
    mutationFn: async (draft: PendingAnnexureDraft) => {
      if (!pssrId) throw new Error('PSSR not created yet.');

      return api.addPssrAnnexure(pssrId, {
        annexure_code: draft.annexure_code,
        annexure_name: draft.annexure_name,
        annexure_category: draft.annexure_category ?? null,
      } satisfies PssrAnnexureAddPayload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pssr:my'] }).catch(() => {});
    },
  });

  const isAnyPending =
    createMutation.isPending ||
    saveDraftMutation.isPending ||
    submitMutation.isPending ||
    addMemberMutation.isPending ||
    addAnnexureMutation.isPending;

  function addMemberLocal() {
    if (!parsedMemberUserId) return;
    if (memberIds.includes(parsedMemberUserId)) return;
    setMemberIds((prev) => [...prev, parsedMemberUserId]);
    setMemberUserIdInput('');
  }

  function removeMemberLocal(uid: number) {
    setMemberIds((prev) => prev.filter((x) => x !== uid));
  }

  function addAnnexureLocal() {
    const code = safeTrim(annexureCodeInput);
    const name = safeTrim(annexureNameInput);
    if (!code || !name) return;

    if (annexures.some((a) => a.annexure_code === code && a.annexure_name === name)) return;

    setAnnexures((prev) => [
      ...prev,
      {
        annexure_code: code,
        annexure_name: name,
        annexure_category: safeTrim(annexureCategoryInput) ? safeTrim(annexureCategoryInput) : null,
      },
    ]);

    setAnnexureCodeInput('');
    setAnnexureNameInput('');
    setAnnexureCategoryInput('');
  }

  function removeAnnexureLocal(code: string, name: string) {
    setAnnexures((prev) => prev.filter((a) => !(a.annexure_code === code && a.annexure_name === name)));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full max-w-3xl bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl overflow-hidden">
        <div className="p-5 border-b border-outline-variant bg-surface">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-headline-md font-black text-on-surface">Create New PSSR</p>
              <p className="text-body-sm text-on-surface-variant mt-1">Draft → Members → Annexures → Save/Submit</p>
              {pssrNumberPreview && (
                <p className="text-[11px] font-mono text-primary mt-2">PSSR Number: {pssrNumberPreview}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-3 py-2 rounded border border-outline-variant hover:bg-surface-container-lowest text-on-surface-variant"
            >
              Close
            </button>
          </div>

          <div className="mt-4 flex gap-2 flex-wrap">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={[
                  'px-3 py-2 rounded text-label-md font-black uppercase tracking-wider border transition-colors',
                  tab === t.key
                    ? 'bg-primary/15 border-primary/30 text-primary'
                    : 'bg-surface-container-lowest border-outline-variant text-outline hover:bg-surface-container',
                ].join(' ')}
              >
                {tab === t.key ? (
                  <CheckCircle2 className="w-4 h-4 inline mr-2" />
                ) : (
                  <Square className="w-4 h-4 inline mr-2 opacity-60" />
                )}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">
          {tab === 'DETAILS' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-label-sm font-black uppercase tracking-widest text-outline">Create Type</span>
                  <select
                    className="mt-2 w-full bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-body-md"
                    value={mocType}
                    onChange={(e) => setMocType(e.target.value as PssrMocType)}
                  >
                    <option value="MOC">Create MOC PSSR</option>
                    <option value="NON_MOC">Create Non MOC PSSR</option>
                  </select>
                </label>

                <div className="space-y-2">
                  <span className="text-label-sm font-black uppercase tracking-widest text-outline">MOC/Non-MOC Rules</span>
                  <div className="bg-surface-container-lowest border border-outline-variant rounded p-3 text-body-sm text-on-surface-variant">
                    <p className="font-black uppercase text-[10px] tracking-widest text-on-surface-variant">
                      {mocType === 'MOC'
                        ? 'MOC number is required.'
                        : 'MOC number is not used for Non-MOC.'}
                    </p>
                    <ul className="list-disc ml-5 mt-1 space-y-1">
                      <li>Draft becomes locked by backend after submission.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-label-sm font-black uppercase tracking-widest text-outline">
                    PSSR Base Number (required)
                  </span>
                  <input
                    value={pssrBaseNumber}
                    onChange={(e) => setPssrBaseNumber(e.target.value)}
                    className="mt-2 w-full bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-body-md"
                    placeholder="e.g., 12345"
                  />
                </label>

                <label className="block">
                  <span className="text-label-sm font-black uppercase tracking-widest text-outline">
                    MOC Number {mocType === 'MOC' ? '(required)' : '(optional)'}
                  </span>
                  <input
                    value={mocNumber}
                    onChange={(e) => setMocNumber(e.target.value)}
                    className="mt-2 w-full bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-body-md"
                    placeholder="e.g., MOC-00123"
                    disabled={mocType !== 'MOC'}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-label-sm font-black uppercase tracking-widest text-outline">Sub-area / Unit (optional)</span>
                  <input
                    value={subArea}
                    onChange={(e) => setSubArea(e.target.value)}
                    className="mt-2 w-full bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-body-md"
                    placeholder="e.g., Unit-1"
                  />
                </label>

                <label className="block">
                  <span className="text-label-sm font-black uppercase tracking-widest text-outline">Description (optional)</span>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-2 w-full bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-body-md"
                    placeholder="Short scope/objectives"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-body-sm text-on-surface-variant">
                  {pssrId
                    ? 'Draft already created. Continue to add members/annexures.'
                    : 'Create a PSSR draft to start adding members/annexures.'}
                </div>

                <button
                  disabled={createMutation.isPending || pssrId !== null || !canCreate}
                  onClick={() => createMutation.mutate()}
                  className="px-4 py-2 rounded bg-primary text-on-primary font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed flex items-center"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" /> Create Draft
                    </>
                  )}
                </button>
              </div>

              {createMutation.error && (
                <div className="bg-error/5 border border-error/30 rounded p-4 text-error">
                  {(createMutation.error as Error).message}
                </div>
              )}
            </div>
          )}

          {tab === 'MEMBERS' && (
            <div className="space-y-4">
              <div className="bg-surface-container-lowest border border-outline-variant rounded p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-label-md font-black uppercase tracking-widest text-on-surface">Add Members</p>
                    <p className="text-body-sm text-on-surface-variant mt-1">
                      Backend requires department/designation snapshots when adding members. Add by User ID.
                    </p>
                  </div>
                  {pssrId ? (
                    <p className="text-[11px] font-mono text-primary">PSSR ID: {pssrId}</p>
                  ) : (
                    <p className="text-[11px] font-mono text-outline">Create draft first</p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={memberUserIdInput}
                      onChange={(e) => setMemberUserIdInput(e.target.value)}
                      className="flex-1 bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-body-md"
                      placeholder="Enter member User ID (e.g., 42)"
                      inputMode="numeric"
                    />
                    <button
                      disabled={!parsedMemberUserId || isAnyPending}
                      onClick={addMemberLocal}
                      className="px-4 py-2 rounded bg-primary/15 border border-primary/30 text-primary font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      value={memberDepartmentInput}
                      onChange={(e) => setMemberDepartmentInput(e.target.value)}
                      className="bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-body-md"
                      placeholder="Member department snapshot (required)"
                    />
                    <input
                      value={memberDesignationInput}
                      onChange={(e) => setMemberDesignationInput(e.target.value)}
                      className="bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-body-md"
                      placeholder="Member designation snapshot (required)"
                    />
                  </div>

                  {memberIds.length === 0 ? (
                    <p className="text-body-sm text-on-surface-variant">No members added yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {memberIds.map((uid) => (
                        <div
                          key={uid}
                          className="flex items-center justify-between gap-3 border border-outline-variant rounded p-3 bg-surface-container-lowest"
                        >
                          <div className="min-w-0">
                            <p className="text-body-md font-bold text-on-surface font-mono">User ID: {uid}</p>
                            <p className="text-[11px] text-on-surface-variant">
                              Member snapshots are taken from the fields above.
                            </p>
                          </div>
                          <button
                            disabled={isAnyPending}
                            onClick={() => removeMemberLocal(uid)}
                            className="p-2 rounded hover:bg-error/10 text-error border border-error/20"
                            title="Remove from pending member list"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => setTab('DETAILS')}
                  className="px-4 py-2 rounded border border-outline-variant hover:bg-surface-container-lowest text-on-surface-variant font-black uppercase tracking-widest"
                >
                  Back
                </button>

                <button
                  disabled={
                    !pssrId ||
                    isAnyPending ||
                    !memberIds.length ||
                    !memberDepartmentInput.trim() ||
                    !memberDesignationInput.trim()
                  }
                  onClick={() => {
                    if (!pssrId) return;
                    Promise.all(memberIds.map((uid) => addMemberMutation.mutateAsync(uid))).then(() => {
                      queryClient.invalidateQueries({ queryKey: ['pssr:my'] }).catch(() => {});
                      setTab('ANNEXURES');
                    });
                  }}
                  className="px-4 py-2 rounded bg-primary text-on-primary font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed flex items-center"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {tab === 'ANNEXURES' && (
            <div className="space-y-4">
              <div className="bg-surface-container-lowest border border-outline-variant rounded p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-label-md font-black uppercase tracking-widest text-on-surface">Add Annexures</p>
                    <p className="text-body-sm text-on-surface-variant mt-1">
                      Backend requires annexure_code and annexure_name. Catalog is not wired yet, so enter manually.
                    </p>
                  </div>
                  <p className="text-[11px] font-mono text-primary">{pssrId ? `PSSR ID: ${pssrId}` : 'Create draft first'}</p>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      value={annexureCodeInput}
                      onChange={(e) => setAnnexureCodeInput(e.target.value)}
                      className="bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-body-md"
                      placeholder="Annexure code (required)"
                    />
                    <input
                      value={annexureNameInput}
                      onChange={(e) => setAnnexureNameInput(e.target.value)}
                      className="bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-body-md"
                      placeholder="Annexure name (required)"
                    />
                    <input
                      value={annexureCategoryInput}
                      onChange={(e) => setAnnexureCategoryInput(e.target.value)}
                      className="bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-body-md"
                      placeholder="Category (optional)"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-body-sm text-on-surface-variant">
                      Checklist questions appear in Phase 5 once catalog API is wired.
                    </p>
                    <button
                      disabled={isAnyPending || !annexureCodeInput.trim() || !annexureNameInput.trim()}
                      onClick={addAnnexureLocal}
                      className="px-4 py-2 rounded bg-primary/15 border border-primary/30 text-primary font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>

                  {annexures.length === 0 ? (
                    <p className="text-body-sm text-on-surface-variant">No annexures added yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {annexures.map((a) => (
                        <div
                          key={`${a.annexure_code}:${a.annexure_name}`}
                          className="flex items-center justify-between gap-3 border border-outline-variant rounded p-3 bg-surface-container-lowest"
                        >
                          <div className="min-w-0">
                            <p className="text-body-md font-bold text-on-surface font-mono">
                              {a.annexure_code} — {a.annexure_name}
                            </p>
                            <p className="text-[11px] text-on-surface-variant">
                              {a.annexure_category ? `Category: ${a.annexure_category}` : 'Category: (none)'}
                            </p>
                          </div>
                          <button
                            disabled={isAnyPending}
                            onClick={() => removeAnnexureLocal(a.annexure_code, a.annexure_name)}
                            className="p-2 rounded hover:bg-error/10 text-error border border-error/20"
                            title="Remove from pending annexure list"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <button
                    onClick={() => setTab('MEMBERS')}
                    className="px-4 py-2 rounded border border-outline-variant hover:bg-surface-container-lowest text-on-surface-variant font-black uppercase tracking-widest"
                  >
                    Back
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      disabled={!pssrId || saveDraftMutation.isPending || isAnyPending}
                      onClick={() => {
                        if (!pssrId) return;
                        // commit annexures to backend (if any)
                        const pending = annexures;
                        if (pending.length) {
                          Promise.all(pending.map((d) => addAnnexureMutation.mutateAsync(d))).then(() => {
                            saveDraftMutation.mutate();
                          });
                        } else {
                          saveDraftMutation.mutate();
                        }
                      }}
                      className="px-4 py-2 rounded bg-surface-container-lowest border border-outline-variant hover:bg-surface-container text-on-surface font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed flex items-center"
                    >
                      {saveDraftMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" /> Save as Draft
                        </>
                      )}
                    </button>

                    <button
                      disabled={!pssrId || submitMutation.isPending || isAnyPending}
                      onClick={() => {
                        if (!pssrId) return;
                        const pending = annexures;
                        const submit = () => submitMutation.mutate();
                        if (pending.length) {
                          Promise.all(pending.map((d) => addAnnexureMutation.mutateAsync(d))).then(() => {
                            submit();
                          });
                        } else {
                          submit();
                        }
                      }}
                      className="px-4 py-2 rounded bg-primary text-on-primary font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed flex items-center"
                      title="Submit to team"
                    >
                      {submitMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" /> Submit
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {(saveDraftMutation.error || submitMutation.error) && (
                  <div className="space-y-2">
                    {saveDraftMutation.error && (
                      <div className="bg-error/5 border border-error/30 rounded p-4 text-error">
                        {(saveDraftMutation.error as Error).message}
                      </div>
                    )}
                    {submitMutation.error && (
                      <div className="bg-error/5 border border-error/30 rounded p-4 text-error">
                        {(submitMutation.error as Error).message}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-outline-variant bg-surface flex items-center justify-between">
          <div className="text-body-sm text-on-surface-variant">
            {isAnyPending ? 'Processing workflow...' : 'Draft created using initiator access.'}
          </div>
          <button
            disabled={isAnyPending}
            onClick={onClose}
            className="px-4 py-2 rounded border border-outline-variant hover:bg-surface-container-lowest text-on-surface-variant font-black uppercase tracking-widest"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

