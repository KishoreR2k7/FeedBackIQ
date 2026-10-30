import React from 'react';
import {
  LayoutDashboard,
  MessageSquareText,
  BrainCircuit,
  TrendingUp,
  CheckSquare,
  Building2,
  Server,
  Zap,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab }) => {
  const navItems = [
    { id: 'overview', label: 'Platform Status', icon: LayoutDashboard, badge: 'Overview' },
    { id: 'feedback', label: 'Feedback Ingestion', icon: MessageSquareText, badge: 'Live Feed' },
    { id: 'analytics', label: 'Aspect Intelligence', icon: BrainCircuit, badge: 'Themes' },
    { id: 'recurrence', label: 'Recurrence Risks', icon: TrendingUp, badge: 'Prediction' },
    { id: 'actions', label: 'Prioritized Actions', icon: CheckSquare, badge: 'Priority' },
    { id: 'capa', label: 'CAPA Action Board', icon: CheckSquare, badge: 'Execution' },
    { id: 'tenants', label: 'Organization & Templates', icon: Building2, badge: 'Tenants' },
    { id: 'system', label: 'System Architecture', icon: Server, badge: 'Infra' },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 bg-white p-4 shrink-0 flex flex-col justify-between hidden md:flex shadow-xs">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[10px] font-bold tracking-wider uppercase text-slate-400">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}
              >
                {item.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Platform Version Footer */}
      <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100/80">
        <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
          <Zap className="w-4 h-4 text-blue-600" />
          <span>Real-time Decision Engine</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-600 leading-normal">
          AI feedback clustering, recurrence forecasting, and prioritized kitchen actions.
        </p>
      </div>
    </aside>
  );
};
