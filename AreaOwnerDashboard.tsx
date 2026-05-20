//Created dashboard for area owner with all relevant sections as per SRS document.
import React, { useState } from 'react';
import { PageTitle } from '../../components/shared/UIItems';
import { CheckCircle2, Clock, AlertCircle, BarChart3, Terminal, ThumbsUp, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  MOCK_AREA_OWNER_PENDING, 
  MOCK_AREA_OWNER_APPROVED, 
  MOCK_AREA_OWNER_MOC_PENDING,
  MOCK_AREA_OWNER_DECISIONS
} from '../../constants/mockData';

export const AreaOwnerDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'moc'>('pending');

  // Calculate stats
  const pendingCount = MOCK_AREA_OWNER_PENDING.length;
  const approvedCount = MOCK_AREA_OWNER_APPROVED.length;
  const mocPendingCount = MOCK_AREA_OWNER_MOC_PENDING.length;
  const approvalRate = Math.round((approvedCount / (pendingCount + approvedCount)) * 100);

  const stats = [
    { label: 'Pending Approval', value: pendingCount.toString(), icon: Clock, trend: 'Awaiting Review', color: 'text-tertiary' },
    { label: 'Approved', value: approvedCount.toString(), icon: CheckCircle2, trend: `${approvalRate}% Rate`, color: 'text-green-600' },
    { label: 'MOC Pending', value: mocPendingCount.toString(), icon: AlertTriangle, trend: '2 High Priority', color: 'text-error' },
    { label: 'Approval Rate', value: `${approvalRate}%`, icon: BarChart3, trend: 'This Period', color: 'text-primary' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageTitle 
        title="Area Owner Dashboard" 
        subtitle="Review and approve PSSR submissions, manage punch list items."
        breadcrumbs={['Area Management', 'Approvals']} 
      />

      {/* Stats Cards */}
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

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Approval Lists Section */}
        <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm">
          <div className="flex items-center space-x-2 mb-6 border-b border-outline-variant pb-4">
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-2 text-label-md font-bold uppercase transition-all ${
                  activeTab === 'pending'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                Pending ({pendingCount})
              </button>
              <button
                onClick={() => setActiveTab('approved')}
                className={`px-4 py-2 text-label-md font-bold uppercase transition-all ${
                  activeTab === 'approved'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                Approved ({approvedCount})
              </button>
              <button
                onClick={() => setActiveTab('moc')}
                className={`px-4 py-2 text-label-md font-bold uppercase transition-all ${
                  activeTab === 'moc'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                MOC Pending ({mocPendingCount})
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {activeTab === 'pending' && MOCK_AREA_OWNER_PENDING.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="border border-outline-variant p-4 rounded hover:bg-surface-container-low transition-colors"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <p className="text-label-md font-bold text-on-surface">{item.id}</p>
                    <p className="text-body-sm text-on-surface-variant mt-1">Submitted by {item.submittedBy}</p>
                    <div className="flex items-center space-x-4 mt-2 text-[11px] text-on-surface-variant">
                      <span>Unit: <span className="font-bold text-on-surface">{item.unit}</span></span>
                      <span>Dept: <span className="font-bold text-on-surface">{item.department}</span></span>
                      <span>Questions: <span className="font-bold text-primary">{item.questionsCount}</span></span>
                      <span>Attachments: <span className="font-bold text-on-surface">{item.attachmentsCount}</span></span>
                    </div>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="flex justify-between text-label-xs font-bold mb-1">
                    <span className="text-on-surface-variant">Completion</span>
                    <span className="text-primary">{item.completionPercent}%</span>
                  </div>
                  <div className="h-2 bg-surface-container-low rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${item.completionPercent}%` }}
                      transition={{ delay: 0.3, duration: 1 }}
                      className="h-full bg-primary"
                    />
                  </div>
                </div>
                <p className="text-label-xs text-on-surface-variant mb-3">Submitted: {item.submittedDate}</p>
                <div className="flex space-x-2 pt-3 border-t border-outline-variant">
                  <button className="text-label-sm font-bold text-primary hover:underline">
                    Review Checklist
                  </button>
                  <button className="text-label-sm font-bold text-green-600 hover:underline flex items-center space-x-1">
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                  <button className="text-label-sm font-bold text-tertiary hover:underline">
                    Request Revision
                  </button>
                </div>
              </motion.div>
            ))}

            {activeTab === 'approved' && MOCK_AREA_OWNER_APPROVED.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="border border-outline-variant p-4 rounded hover:bg-surface-container-low transition-colors"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <p className="text-label-md font-bold text-on-surface">{item.id}</p>
                    <p className="text-body-sm text-on-surface-variant mt-1">Unit: {item.unit} | Department: {item.department}</p>
                    <div className="flex items-center space-x-4 mt-2 text-[11px] text-on-surface-variant">
                      <span>Approved: <span className="text-[10px]">{item.approvedDate}</span></span>
                      <span>Approved by: <span className="font-bold text-on-surface">{item.approvedBy}</span></span>
                      <span className={`font-bold px-2 py-0.5 rounded ${
                        item.punchListIssues > 0 ? 'bg-error/10 text-error' : 'bg-green-100/50 text-green-700'
                      }`}>
                        {item.punchListIssues} Punch Items
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2 pt-3 border-t border-outline-variant">
                  <span className="text-label-sm font-bold text-green-600 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approved</span>
                  </span>
                  {item.punchListIssues > 0 && (
                    <button className="text-label-sm font-bold text-error hover:underline">
                      View Punch List
                    </button>
                  )}
                </div>
              </motion.div>
            ))}

            {activeTab === 'moc' && MOCK_AREA_OWNER_MOC_PENDING.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="border border-outline-variant p-4 rounded hover:bg-surface-container-low transition-colors"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <p className="text-label-md font-bold text-on-surface">{item.id}</p>
                    <p className="text-body-sm text-on-surface-variant mt-1">Unit: {item.unit} | Department: {item.department}</p>
                    <div className="flex items-center space-x-4 mt-2 text-[11px] text-on-surface-variant">
                      <span>Issued: <span className="text-[10px]">{item.issuedDate}</span></span>
                      <span>Due: <span className="font-bold text-error">{item.dueDate}</span></span>
                      <span className={`font-bold px-2 py-0.5 rounded ${
                        item.priority === 'High' ? 'bg-error/10 text-error' : 'bg-tertiary/10 text-tertiary'
                      }`}>
                        {item.priority} - {item.punchItems} Items
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mb-3 px-3 py-2 bg-surface-container-low rounded">
                  <p className="text-label-xs font-bold text-on-surface-variant uppercase">Status: <span className={item.status === 'In Progress' ? 'text-primary' : 'text-error'}>{item.status}</span></p>
                </div>
                <div className="flex space-x-2 pt-3 border-t border-outline-variant">
                  <button className="text-label-sm font-bold text-primary hover:underline">
                    View Details
                  </button>
                  <button className="text-label-sm font-bold text-primary hover:underline">
                    Track Progress
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Decision Log Sidebar */}
        <div className="bg-surface-container-highest border border-on-surface/5 p-6 rounded shadow-sm text-on-surface">
          <div className="flex items-center space-x-2 mb-6">
            <Terminal className="w-4 h-4 text-primary" />
            <h3 className="text-label-md font-black uppercase tracking-widest">Decision Log</h3>
          </div>
          <div className="space-y-4 font-mono text-[11px] leading-relaxed opacity-80">
            {MOCK_AREA_OWNER_DECISIONS.map((decision) => (
              <div key={decision.id} className={`border-l-2 pl-3 py-1 ${
                decision.action === 'Approved' ? 'border-green-600' :
                decision.action === 'Revisions Requested' ? 'border-tertiary' :
                'border-primary'
              }`}>
                <p className="text-on-surface-variant italic">{decision.timestamp}</p>
                <p className="text-on-surface font-bold underline">{decision.action}</p>
                <p className="text-on-surface-variant text-[10px]">{decision.pssrId}: {decision.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
