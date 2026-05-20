import React from 'react';
import { PageTitle } from '../../components/shared/UIItems';
import { PieChart, Download, FileSpreadsheet, FileBarChart, Filter, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

export const ReportsPage: React.FC = () => {
  const reportCategories = [
    { title: 'Compliance Records', desc: 'Detailed PSSR completion metrics and safety violation logs.', icon: PieChart },
    { title: 'Department Analytics', desc: 'KPI breakdown by refinery unit and operational zone.', icon: FileBarChart },
    { title: 'Workflow Overdue', desc: 'Trace-back on bottleneck points in approval sequences.', icon: FileSpreadsheet },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-start">
        <PageTitle 
          title="Analytical Reports" 
          subtitle="Generate, export and analyze operational PSSR data and compliance metrics."
          breadcrumbs={['Compliance', 'Analytics', 'Reports']} 
        />
        <button className="p-2 border border-outline-variant rounded hover:bg-surface-container text-primary transition-colors"><RefreshCw className="w-4 h-4" /></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reportCategories.map((repo, idx) => (
          <motion.div 
            key={repo.title}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm hover:border-primary transition-all flex flex-col items-center text-center group"
          >
            <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
              <repo.icon className="w-8 h-8" />
            </div>
            <h3 className="text-headline-sm font-bold text-on-surface uppercase tracking-tight">{repo.title}</h3>
            <p className="text-body-sm text-on-surface-variant mt-2 mb-8 leading-relaxed opacity-80">{repo.desc}</p>
            <div className="w-full flex space-x-2 mt-auto">
              <button className="flex-1 bg-surface-container-low border border-outline-variant py-2 rounded text-[11px] font-black uppercase text-on-surface hover:bg-surface-container transition-all flex items-center justify-center">
                <Download className="w-3.5 h-3.5 mr-2" /> .PDF
              </button>
              <button className="flex-1 bg-primary text-on-primary py-2 rounded text-[11px] font-black uppercase hover:bg-primary-container transition-all flex items-center justify-center">
                <Download className="w-3.5 h-3.5 mr-2" /> .XLSX
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-surface p-6 border border-outline-variant rounded shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h4 className="text-label-md font-black uppercase tracking-widest text-on-surface">Data Aggregation Parameters</h4>
            <p className="text-[11px] text-outline mt-1 font-bold">REFINERY_WIDE_SCAN_ENABLED</p>
          </div>
          <button className="flex items-center text-primary font-bold text-label-md hover:underline"><Filter className="w-3.5 h-3.5 mr-2" /> Advanced Aggregation</button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {['Compliance Trend', 'Efficiency Score', 'Overdue Rate', 'Audit Score'].map(item => (
            <div key={item} className="space-y-4">
              <div className="flex justify-between text-label-sm font-black uppercase tracking-widest text-outline">
                <span>{item}</span>
                <span className="text-primary">84%</span>
              </div>
              <div className="grid grid-cols-10 gap-0.5 h-4">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className={`h-full ${i < 8 ? 'bg-primary' : 'bg-on-surface/5'}`}></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
