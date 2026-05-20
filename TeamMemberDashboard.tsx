import React, { useState } from 'react';
import { PageTitle } from '../../components/shared/UIItems';
import { CheckCircle2, Clock, AlertCircle, FileText, Terminal } from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  MOCK_TEAM_MEMBER_TODO, 
  MOCK_TEAM_MEMBER_INPROGRESS, 
  MOCK_TEAM_MEMBER_COMPLETED,
  MOCK_TEAM_MEMBER_ACTIVITY 
} from '../../constants/mockData';

export const TeamMemberDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'todo' | 'inprogress' | 'completed'>('todo');

  // Calculate stats
  const todoCount = MOCK_TEAM_MEMBER_TODO.length;
  const inProgressCount = MOCK_TEAM_MEMBER_INPROGRESS.length;
  const completedCount = MOCK_TEAM_MEMBER_COMPLETED.length;
  const pendingReviewCount = MOCK_TEAM_MEMBER_COMPLETED.filter(item => item.status === 'Pending Review').length;

  const stats = [
    { label: 'To Do', value: todoCount.toString(), icon: Clock, trend: '3 Assigned', color: 'text-tertiary' },
    { label: 'In Progress', value: inProgressCount.toString(), icon: AlertCircle, trend: '45% avg', color: 'text-primary' },
    { label: 'Completed', value: completedCount.toString(), icon: CheckCircle2, trend: '2 Pending', color: 'text-green-600' },
    { label: 'Pending Review', value: pendingReviewCount.toString(), icon: FileText, trend: '67% Overall', color: 'text-on-surface-variant' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageTitle 
        title="My Work Dashboard" 
        subtitle="Manage assigned PSSR tasks and track completion status."
        breadcrumbs={['My Work', 'Dashboard']} 
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
        {/* Task Lists Section */}
        <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant p-6 rounded shadow-sm">
          <div className="flex items-center space-x-2 mb-6 border-b border-outline-variant pb-4">
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab('todo')}
                className={`px-4 py-2 text-label-md font-bold uppercase transition-all ${
                  activeTab === 'todo'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                To Do ({todoCount})
              </button>
              <button
                onClick={() => setActiveTab('inprogress')}
                className={`px-4 py-2 text-label-md font-bold uppercase transition-all ${
                  activeTab === 'inprogress'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                In Progress ({inProgressCount})
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`px-4 py-2 text-label-md font-bold uppercase transition-all ${
                  activeTab === 'completed'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                Completed ({completedCount})
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {activeTab === 'todo' && MOCK_TEAM_MEMBER_TODO.map((item, idx) => (
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
                    <p className="text-body-sm text-on-surface-variant mt-1">{item.pssrTitle}</p>
                    <div className="flex items-center space-x-4 mt-2 text-[11px] text-on-surface-variant">
                      <span>Unit: <span className="font-bold text-on-surface">{item.unit}</span></span>
                      <span>Due: <span className="font-bold text-error">{item.dueDate}</span></span>
                      <span className={`font-bold px-2 py-0.5 rounded ${
                        item.priority === 'High' ? 'bg-error/10 text-error' :
                        item.priority === 'Medium' ? 'bg-tertiary/10 text-tertiary' :
                        'bg-outline/10 text-outline'
                      }`}>
                        {item.priority}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2 pt-3 border-t border-outline-variant">
                  <button className="text-label-sm font-bold text-primary hover:underline">
                    Start
                  </button>
                  <button className="text-label-sm font-bold text-primary hover:underline">
                    Details
                  </button>
                </div>
              </motion.div>
            ))}

            {activeTab === 'inprogress' && MOCK_TEAM_MEMBER_INPROGRESS.map((item, idx) => (
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
                    <p className="text-body-sm text-on-surface-variant mt-1">Operational Safety Audit</p>
                    <div className="flex items-center space-x-4 mt-2 text-[11px] text-on-surface-variant">
                      <span>Unit: <span className="font-bold text-on-surface">{item.unit}</span></span>
                      <span>Answered: <span className="font-bold text-primary">{item.questionsAnswered}/{item.totalQuestions}</span></span>
                      <span>Updated: <span className="text-[10px]">{item.lastUpdated}</span></span>
                    </div>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="flex justify-between text-label-xs font-bold mb-1">
                    <span className="text-on-surface-variant">Progress</span>
                    <span className="text-primary">{item.progress}%</span>
                  </div>
                  <div className="h-2 bg-surface-container-low rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${item.progress}%` }}
                      transition={{ delay: 0.3, duration: 1 }}
                      className="h-full bg-primary"
                    />
                  </div>
                </div>
                <div className="flex space-x-2 pt-3 border-t border-outline-variant">
                  <button className="text-label-sm font-bold text-primary hover:underline">
                    Continue
                  </button>
                  <button className="text-label-sm font-bold text-primary hover:underline">
                    Upload
                  </button>
                </div>
              </motion.div>
            ))}

            {activeTab === 'completed' && MOCK_TEAM_MEMBER_COMPLETED.map((item, idx) => (
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
                    <p className="text-body-sm text-on-surface-variant mt-1">{item.pssrTitle}</p>
                    <div className="flex items-center space-x-4 mt-2 text-[11px] text-on-surface-variant">
                      <span>Unit: <span className="font-bold text-on-surface">{item.unit}</span></span>
                      <span>Submitted: <span className="text-[10px]">{item.submittedDate}</span></span>
                      <span className={`font-bold px-2 py-0.5 rounded ${
                        item.status === 'Approved' ? 'bg-green-100/50 text-green-700' :
                        'bg-tertiary/10 text-tertiary'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-label-xs text-on-surface-variant mb-3">Reviewed by: <span className="font-bold text-on-surface">{item.reviewerName}</span></p>
                <div className="flex space-x-2 pt-3 border-t border-outline-variant">
                  {item.status === 'Approved' && (
                    <span className="text-label-sm font-bold text-green-600 flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approved</span>
                    </span>
                  )}
                  {item.status === 'Pending Review' && (
                    <button className="text-label-sm font-bold text-primary hover:underline flex items-center space-x-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Pending Review</span>
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Activity Log Sidebar */}
        <div className="bg-surface-container-highest border border-on-surface/5 p-6 rounded shadow-sm text-on-surface">
          <div className="flex items-center space-x-2 mb-6">
            <Terminal className="w-4 h-4 text-primary" />
            <h3 className="text-label-md font-black uppercase tracking-widest">Recent Activity</h3>
          </div>
          <div className="space-y-4 font-mono text-[11px] leading-relaxed opacity-80">
            {MOCK_TEAM_MEMBER_ACTIVITY.map((activity) => (
              <div key={activity.id} className={`border-l-2 pl-3 py-1 ${
                activity.action === 'Assessment Approved' ? 'border-green-600' :
                activity.action === 'Uploaded File' ? 'border-primary' :
                'border-tertiary'
              }`}>
                <p className="text-on-surface-variant italic">{activity.timestamp}</p>
                <p className="text-on-surface font-bold underline">{activity.action}</p>
                <p className="text-on-surface-variant text-[10px]">{activity.pssrId}: {activity.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
