import React from 'react';
import {
  LayoutDashboard,
  MessageSquareText,
  BrainCircuit,
  TrendingUp,
  CheckSquare,
  Building2,
  Server,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab }) => {
  const navItems = [
    { id: 'overview', label: 'Platform Status', icon: LayoutDashboard, badge: 'Phase 0' },
    { id: 'feedback', label: 'Feedback Ingestion', icon: MessageSquareText, badge: 'Phase 1' },
    { id: 'analytics', label: 'Aspect Intelligence', icon: BrainCircuit, badge: 'Phase 1' },
    { id: 'recurrence', label: 'Recurrence Risks', icon: TrendingUp, badge: 'Phase 2' },
    { id: 'actions', label: 'Prioritized Actions', icon: CheckSquare, badge: 'Phase 2' },
    { id: 'capa', label: 'CAPA Action Board', icon: CheckSquare, badge: 'Phase 3' },
    { id: 'tenants', label: 'Organization & Templates', icon: Building2, badge: 'Active' },
    { id: 'system', label: 'System Architecture', icon: Server, badge: 'Docs' },
  ];

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-slate-950/40 p-4 shrink-0 flex flex-col justify-between hidden md:flex">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-semibold tracking-wider uppercase text-slate-500">
          Core Modules
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-slate-800/70 text-slate-400'
                }`}
              >
                {item.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Platform Version Footer */}
      <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/60">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>Engine Status</span>
          <span className="text-emerald-400 font-semibold">PostgreSQL + FastAPI</span>
        </div>
        <div className="mt-1 text-[10px] text-slate-500">
          Multi-Tenant SaaS Foundation
        </div>
      </div>
    </aside>
  );
};
