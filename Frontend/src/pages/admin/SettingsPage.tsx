import React from 'react';
import { PageTitle } from '../../components/shared/UIItems';
import { Settings as SettingsIcon, Bell, Shield, Database, Globe, Save } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const sections = [
    { id: 'general', title: 'Refinery Configuration', icon: SettingsIcon, description: 'Base system parameters and site-wide metadata settings.' },
    { id: 'notify', title: 'Workflow Notifications', icon: Bell, description: 'Manage escalation emails, SMS alerts and approval reminders.' },
    { id: 'security', title: 'Global Security Policies', icon: Shield, description: 'Authentication timeout, session management and encryption protocols.' },
    { id: 'data', title: 'Data Retention & Backup', icon: Database, description: 'Immutable log storage duration and automated backup cycles.' },
    { id: 'network', title: 'Network & API Access', icon: Globe, description: 'External integration points and cross-site synchronization logic.' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-start border-b border-outline-variant pb-6">
        <PageTitle 
          title="System Architecture Settings" 
          subtitle="Configure global refinery operations parameters and enterprise security logic."
          breadcrumbs={['System', 'Module Configuration', 'Settings']} 
        />
        <button className="bg-primary hover:bg-primary-container text-on-primary font-black text-label-md px-8 py-2 rounded flex items-center shadow-md active:scale-95 transition-all">
          <Save className="mr-2 w-4 h-4" />
          Apply Global Manifest
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-1">
          {sections.map(section => (
            <button 
              key={section.id} 
              className={`w-full text-left px-4 py-3 rounded flex items-center space-x-3 transition-all ${
                section.id === 'general' ? 'bg-primary text-on-primary font-bold shadow-sm' : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <section.icon className="w-4 h-4" />
              <span className="text-label-md uppercase tracking-widest">{section.title}</span>
            </button>
          ))}
        </div>

        <div className="lg:col-span-3 space-y-8 max-w-3xl">
          <section className="space-y-4">
            <h3 className="text-headline-sm font-bold text-on-surface tracking-tight uppercase">Base Parameter Matrix</h3>
            <div className="grid grid-cols-1 gap-6 bg-surface-container-low p-6 rounded border border-outline-variant">
              <div className="space-y-1.5">
                <label className="text-label-sm font-black text-outline uppercase tracking-widest">Master Refinery Identity Code</label>
                <input className="w-full bg-surface-container-lowest border border-outline-variant rounded px-4 py-2 text-body-sm font-mono focus:ring-1 focus:ring-primary outline-none" defaultValue="REF-ALPHA-GRID-7X" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-label-sm font-black text-outline uppercase tracking-widest">Primary Timezone</label>
                  <select className="w-full bg-surface-container-lowest border border-outline-variant rounded px-4 py-2 text-body-sm outline-none">
                    <option>UTC +05:30 (Mumbai/Calcutta)</option>
                    <option>UTC +00:00 (GMT)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-label-sm font-black text-outline uppercase tracking-widest">Compliance Cycle</label>
                  <select className="w-full bg-surface-container-lowest border border-outline-variant rounded px-4 py-2 text-body-sm outline-none">
                    <option>24-Month Rotation</option>
                    <option>Annual Audit</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center space-x-3 pt-4 border-t border-outline-variant/30">
                <div className="w-10 h-6 bg-primary rounded-full relative cursor-pointer shadow-inner">
                  <div className="absolute right-1 top-1 w-4 h-4 bg-on-primary rounded-full shadow-sm"></div>
                </div>
                <span className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider">Enterprise Audit Integrity Scan</span>
              </div>
            </div>
          </section>

          <section className="space-y-4 pt-4">
             <h3 className="text-headline-sm font-bold text-on-surface tracking-tight uppercase">System Logic Status</h3>
             <div className="p-4 bg-surface-container/50 border border-outline-variant rounded flex items-center justify-between">
                <div className="flex space-x-3">
                   <div className="w-10 h-10 border border-outline-variant rounded bg-surface flex items-center justify-center font-mono text-[10px] text-outline">DB</div>
                   <div>
                      <p className="text-[11px] font-black text-on-surface uppercase tracking-widest">Database Node Alpha</p>
                      <p className="text-[10px] text-green-600 font-bold uppercase tracking-widest">Synchronized / No Faults Detected</p>
                   </div>
                </div>
                <button className="text-primary font-bold text-label-md hover:underline uppercase tracking-widest">Verify Shards</button>
             </div>
          </section>
        </div>
      </div>
    </div>
  );
};
