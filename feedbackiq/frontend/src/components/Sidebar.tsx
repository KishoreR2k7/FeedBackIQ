import React from 'react';
import {
  LayoutGrid,
  Sparkles,
  FileText,
  TrendingUp,
  SlidersHorizontal,
  BarChart3,
  UploadCloud,
  Building2,
  GitPullRequest,
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
    { id: 'dashboard', label: 'Overview', icon: LayoutGrid },
    { id: 'recurrence', label: 'AI Insights', icon: Sparkles },
    { id: 'feedback', label: 'All Reviews', icon: FileText },
    { id: 'pipeline', label: 'Resolution Progress', icon: GitPullRequest },
    { id: 'actions', label: 'Prioritized Actions', icon: SlidersHorizontal },
    { id: 'capa', label: 'Reports', icon: BarChart3 },
    { id: 'ingestion', label: 'Feedback Ingestion', icon: UploadCloud },
    { id: 'tenants', label: 'Department Routing', icon: Building2 },
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

      {/* Main Sidebar (Exact Image 1 layout) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white p-5 flex flex-col justify-between border-r border-slate-200/80 shadow-xs transition-transform duration-300 md:static md:w-60 md:h-full md:translate-x-0 select-none overflow-y-auto shrink-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="space-y-7">
          {/* Brand Header */}
          <div className="flex items-center gap-3 px-1 pt-1">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 shadow-2xs">
              <svg className="w-5 h-5 text-slate-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="6" y1="20" x2="6" y2="14" />
                <line x1="12" y1="20" x2="12" y2="8" />
                <line x1="18" y1="20" x2="18" y2="11" />
              </svg>
            </div>
            <div>
              <div className="text-[14px] font-bold text-slate-950 tracking-tight leading-tight">
                VoiceOfCustomer
              </div>
              <div className="text-[9px] font-mono font-semibold text-slate-400 tracking-widest uppercase">
                FEEDBACK INTELLIGENCE
              </div>
            </div>
          </div>

          {/* Section: WORKSPACE */}
          <div className="space-y-1">
            <div className="px-3 py-1 text-[11px] font-mono font-semibold tracking-wider uppercase text-slate-400">
              WORKSPACE
            </div>
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const isActive =
                activeTab === item.id ||
                (item.id === 'dashboard' && activeTab === 'overview') ||
                (item.id === 'pipeline' && activeTab === 'progress');

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all ${
                    isActive
                      ? 'bg-slate-100 text-slate-950 font-bold border border-slate-200 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-indigo-600' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Section: Privacy Notice & Active Tenant Card */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          {/* Privacy-conscious analysis card from Image 1 */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60 text-left">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Privacy-conscious analysis</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
              CSV parsing runs in your browser. Review text is sent to the configured AI service only when you request AI insights.
            </p>
          </div>

          {/* Active Workspace Indicator */}
          <div className="flex items-center gap-2.5 px-1 pt-1 text-xs">
            <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-800 flex items-center justify-center font-mono font-bold text-[10px]">
              voc
            </div>
            <div className="truncate">
              <span className="text-xs font-bold text-slate-950 block truncate leading-tight">
                {currentOrg ? currentOrg.name : 'VoiceOfCustomer'}
              </span>
              <span className="text-[11px] text-slate-400 font-mono block truncate">
                Local feedback workspace
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
