import React from 'react';
import {
  BrainCircuit,
  UploadCloud,
  Search,
  GitMerge,
  TrendingUp,
  Sliders,
  CheckSquare,
  Sparkles,
} from 'lucide-react';
import { Organization } from '../types';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  currentOrg?: Organization | null;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  userRole?: 'student' | 'manager' | 'admin';
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  currentOrg,
  isMobileOpen = false,
  onCloseMobile,
  userRole = 'admin',
}) => {
  const handleNavClick = (tabId: string) => {
    onSelectTab(tabId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const navSections = [
    {
      title: 'OVERVIEW',
      items: [
        { id: 'dashboard', label: 'Overview & Analytics', icon: BrainCircuit },
      ],
    },
    {
      title: 'FEEDBACK INTELLIGENCE',
      items: [
        { id: 'ingestion', label: 'Feedback Ingestion', icon: UploadCloud },
        { id: 'explorer', label: 'Feedback Explorer', icon: Search },
        { id: 'tracker', label: 'Feedback Flow & Tracker', icon: GitMerge },
      ],
    },
    {
      title: 'ISSUE INTELLIGENCE',
      items: [
        { id: 'recurrence', label: 'Recurrence Risks', icon: TrendingUp },
      ],
    },
    {
      title: 'DECISION INTELLIGENCE',
      items: [
        { id: 'actions', label: 'Prioritized Actions', icon: Sliders },
        { id: 'capa', label: 'CAPA Action Board', icon: CheckSquare },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs md:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white p-3 sm:p-4 flex flex-col justify-between border-r border-slate-200 shadow-xl md:static md:w-60 lg:w-64 md:h-full md:translate-x-0 md:shadow-none select-none overflow-y-auto shrink-0 transition-transform duration-200 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="space-y-4">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold tracking-wider uppercase text-slate-400 font-mono">
                {section.title}
              </div>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  activeTab === item.id ||
                  (item.id === 'dashboard' && activeTab === 'analytics');

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-blue-600' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom Active Workspace Profile Card */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold text-slate-800 truncate">
                {currentOrg ? currentOrg.name : 'Default Workspace'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate capitalize">
              Role: <strong className="text-slate-700 capitalize">{userRole}</strong> • {currentOrg ? currentOrg.template_type : 'college'}
            </p>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 font-medium">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-blue-600" />
              <span>FeedbackIQ</span>
            </div>
            <span className="font-mono text-[10px]">PS 2.5 • v0.1.0</span>
          </div>
        </div>
      </aside>
    </>
  );
};
