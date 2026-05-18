import React from 'react';
import { PageTitle } from '../../components/shared/UIItems';
import { Activity, ShieldAlert, CheckCircle2, Clock, Terminal } from 'lucide-react';
import { motion } from 'framer-motion';

export const DashboardPage: React.FC = () => {
  const stats = [
    { label: 'Active PSSR', value: '142', icon: Activity, trend: '+12%', color: 'text-primary' },
    { label: 'Pending Approvals', value: '28', icon: Clock, trend: '-3', color: 'text-tertiary' },
    { label: 'Safety Violations', value: '0', icon: ShieldAlert, trend: 'stable', color: 'text-error' },
    { label: 'Compliance Rate', value: '98.4%', icon: CheckCircle2, trend: '+0.2%', color: 'text-green-600' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageTitle 
        title="Operations Dashboard" 
        subtitle="Real-time refinery safety and compliance metrics snapshot."
        breadcrumbs={['System', 'Dashboard']} 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-surface-container-lowest border border-outline-variant p-5 rounded shadow-sm group hover:border-primary transition-colors"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-surface-container-low rounded">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <span className="text-[10px] font-black tracking-widest text-outline uppercase">{stat.trend}</span>
            </div>
            <p className="text-label-sm text-outline uppercase tracking-wider mb-1 font-bold">{stat.label}</p>
            <h3 className="text-3xl font-black text-on-surface">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-headline-sm font-bold text-on-surface">Compliance Health by Unit</h3>
            <button className="text-label-md text-primary font-bold hover:underline">View Full Report</button>
          </div>
          <div className="space-y-4">
            {['CDU-1', 'FCCU', 'VDU-2', 'SRU-4'].map((unit, idx) => (
              <div key={unit} className="space-y-1">
                <div className="flex justify-between text-label-md font-bold uppercase tracking-wider">
                  <span className="text-on-surface-variant">{unit}</span>
                  <span className="text-primary">{90 + idx * 2}%</span>
                </div>
                <div className="h-2 bg-surface-container-low rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${90 + idx * 2}%` }}
                    transition={{ delay: 0.5 + idx * 0.1, duration: 1 }}
                    className="h-full bg-primary"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface-container-highest border border-on-surface/5 p-6 rounded shadow-sm text-on-surface">
          <div className="flex items-center space-x-2 mb-6">
            <Terminal className="w-4 h-4 text-primary" />
            <h3 className="text-label-md font-black uppercase tracking-widest">Recent System Logic</h3>
          </div>
          <div className="space-y-4 font-mono text-[11px] leading-relaxed opacity-80">
            <div className="border-l-2 border-primary pl-3 py-1 bg-on-surface/5">
              <p className="text-on-surface-variant italic">10:45:22</p>
              <p className="text-on-surface font-bold underline">SECURITY_ACCESS_LOG</p>
              <p>User 1001 accessed Module:DEPARTMENTS_CONFIG_V4</p>
            </div>
            <div className="border-l-2 border-tertiary pl-3 py-1">
              <p className="text-on-surface-variant italic">09:12:05</p>
              <p className="text-on-surface font-bold underline">WORKFLOW_ENGINE_STATE</p>
              <p>Triggered automated escalation for PSSR-2023-0042</p>
            </div>
            <div className="border-l-2 border-green-600 pl-3 py-1">
              <p className="text-on-surface-variant italic">08:00:00</p>
              <p className="text-on-surface font-bold underline">CRON_JOB_COMPLIANCE</p>
              <p>Completed 24h compliance scan. All units within safety parameters.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
