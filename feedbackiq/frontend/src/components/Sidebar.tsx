import React from 'react';
import {
  MessageSquareText,
  BrainCircuit,
  TrendingUp,
  CheckSquare,
  Building2,
  Server,
  ArrowLeft,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { Organization } from '../types';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  currentOrg?: Organization | null;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  currentOrg,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const primaryNav = [
    { id: 'dashboard', label: 'Overview & Analytics', icon: BrainCircuit, badge: 'PS 2.5' },
    { id: 'feedback', label: 'Feedback Ingestion', icon: MessageSquareText, badge: 'Live' },
    { id: 'recurrence', label: 'Recurrence Risks', icon: TrendingUp, badge: 'AI' },
    { id: 'actions', label: 'Prioritized Actions', icon: Sliders, badge: 'Queue' },
    { id: 'capa', label: 'CAPA Action Board', icon: CheckSquare, badge: 'Tasks' },
  ];

  const secondaryNav = [
    { id: 'tenants', label: 'Organization & Templates', icon: Building2 },
    { id: 'system', label: 'System Architecture', icon: Server },
  ];

  const handleNavClick = (tabId: string) => {
    onSelectTab(tabId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Drawer Overlay Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Main Sidebar (Drawer on mobile, pinned column on desktop) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white p-4 flex flex-col justify-between border-r border-slate-200 shadow-xl transition-transform duration-300 md:static md:w-64 md:h-full md:translate-x-0 md:shadow-xs select-none overflow-y-auto shrink-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="space-y-4">
          {/* Back to Public Site Button */}
          <button
            onClick={() => handleNavClick('overview')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50/80 hover:bg-blue-100 border border-blue-200 transition shadow-2xs group"
          >
            <div className="flex items-center gap-2">
              <ArrowLeft className="w-3.5 h-3.5 text-blue-600 group-hover:-translate-x-0.5 transition-transform" />
              <span>Public Landing Page</span>
            </div>
            <span className="text-[10px] text-blue-600 font-mono">Site</span>
          </button>

        {/* Section 1: Core Operations */}
        <div className="space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase text-slate-400">
            Operations Pipeline
          </div>
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-white' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                      isActive
                        ? 'bg-blue-700 text-white'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Section 2: Insights & Configuration */}
        <div className="space-y-1 pt-2 border-t border-slate-100">
          <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase text-slate-400">
            Analytics &amp; Config
          </div>
          {secondaryNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-white' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Tenant Profile & Decision Engine Card */}
      <div className="space-y-3 pt-3 border-t border-slate-100">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-800 truncate">
              {currentOrg ? currentOrg.name : 'Default Workspace'}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
            {currentOrg ? `Template: ${currentOrg.template_type}` : 'Active Organization'}
          </p>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 font-medium">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>FeedbackIQ SaaS</span>
          </div>
          <span className="font-mono">v0.1.0</span>
        </div>
      </div>
    </aside>
  </>
  );
};
