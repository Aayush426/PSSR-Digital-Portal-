import React from 'react';
import { PageTitle } from '../../components/shared/UIItems';
import { GitBranch, UserCheck, ShieldCheck, Mail, Save, Plus } from 'lucide-react';
import { motion } from 'framer-motion';

export const WorkflowConfigurationPage: React.FC = () => {
  const workflowStages = [
    { id: 1, name: 'PSSR Initiation', actor: 'PSSR Initiator', mandatory: true, duration: '24h' },
    { id: 2, name: 'Technical Review', actor: 'Subject Matter Expert', mandatory: true, duration: '48h' },
    { id: 3, name: 'Site Safety Audit', actor: 'Safety Inspector', mandatory: true, duration: '72h' },
    { id: 4, name: 'Area Handover', actor: 'Area Owner', mandatory: true, duration: '24h' },
    { id: 5, name: 'Final Commissioning', actor: 'Plant Manager', mandatory: true, duration: '12h' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <PageTitle 
          title="Workflow Engine Mapping" 
          subtitle="Configure PSSR stage sequences, approval logic, and area owner assignments."
          breadcrumbs={['Infra', 'Workflow Configuration']} 
        />
        <button className="bg-primary hover:bg-primary-container text-on-primary font-black text-label-md px-4 py-2 rounded flex items-center shadow-md transition-all active:scale-95">
          <Save className="mr-2 w-4 h-4" />
          Deploy Workflow Logic
        </button>
      </div>

      <div className="bg-surface-container-low border border-outline-variant p-6 rounded-lg relative overflow-hidden mb-8">
        <div className="relative z-10 flex items-center space-x-6">
          <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center text-on-primary shadow-lg ring-4 ring-primary/20">
            <GitBranch className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-black text-on-surface tracking-tight uppercase">Master Approval Sequence</h3>
            <p className="text-body-sm text-on-surface-variant max-w-2xl opacity-80 mt-1 uppercase font-bold tracking-widest text-[10px]">
              Logic Engine v4.2.0 is currently controlling {workflowStages.length} mandatory safety checkpoints across the refinery unit grid.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {workflowStages.map((stage, idx) => (
          <motion.div 
            key={stage.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="group relative flex items-start space-x-4 bg-surface-container-lowest border border-outline-variant p-5 rounded hover:border-primary transition-all shadow-sm"
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-[12px] font-black text-primary border border-outline-variant group-hover:bg-primary group-hover:text-on-primary group-hover:border-primary transition-all">
              {stage.id}
            </div>
            
            <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
              <div>
                <p className="text-label-sm text-outline uppercase font-black tracking-widest mb-0.5">Stage Identity</p>
                <p className="text-body-md font-black text-on-surface uppercase tracking-tight">{stage.name}</p>
              </div>
              <div>
                <p className="text-label-sm text-outline uppercase font-black tracking-widest mb-0.5">Assigned Actor</p>
                <div className="flex items-center text-body-sm text-on-surface font-bold">
                  <UserCheck className="w-3.5 h-3.5 mr-2 text-primary" />
                  {stage.actor}
                </div>
              </div>
              <div>
                <p className="text-label-sm text-outline uppercase font-black tracking-widest mb-0.5">Logic Gate</p>
                <div className="flex space-x-2">
                  <span className="bg-green-100 text-green-800 text-[9px] font-black px-1.5 py-0.5 rounded border border-green-200">MANDATORY</span>
                  <span className="bg-on-surface/5 text-on-surface-variant text-[9px] font-black px-1.5 py-0.5 rounded border border-outline-variant">E-SIGN REQ</span>
                </div>
              </div>
              <div className="text-right flex items-center justify-end space-x-4">
                <div className="text-right">
                  <p className="text-label-sm text-outline uppercase font-black tracking-widest">SLA</p>
                  <p className="text-body-sm font-black text-primary font-mono">{stage.duration}</p>
                </div>
                <button className="text-outline hover:text-primary transition-colors p-1"><Mail className="w-4 h-4" /></button>
              </div>
            </div>

            {idx < workflowStages.length - 1 && (
              <div className="absolute left-[31px] top-[48px] bottom-[-20px] w-0.5 bg-outline-variant grayscale opacity-30"></div>
            )}
          </motion.div>
        ))}

        <button className="w-full py-4 border-2 border-dashed border-outline-variant rounded flex items-center justify-center text-outline hover:text-primary hover:border-primary transition-all group">
          <Plus className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
          <span className="text-label-md font-black uppercase tracking-widest">Inject Secondary Validation Gate</span>
        </button>
      </div>
    </div>
  );
};
