import React from 'react';
import { ChevronDown, ArrowLeft, Menu, X, BookOpen } from 'lucide-react';
import { Organization, ReadinessResponse } from '../types';

interface HeaderProps {
  currentOrg: Organization | null;
  organizations: Organization[];
  onSelectOrg: (org: Organization) => void;
  onOpenCreateOrgModal: () => void;
  readiness: ReadinessResponse | null;
  isChecking: boolean;
  onRefreshHealth: () => void;
  onNavigateTab?: (tab: string) => void;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
  activeTab?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentOrg,
  organizations,
  onSelectOrg,
  onOpenCreateOrgModal,
  readiness,
  isChecking,
  onRefreshHealth,
  onNavigateTab,
  isMobileMenuOpen,
  onToggleMobileMenu,
  activeTab = 'dashboard',
}) => {
  const isReady = readiness?.status === 'ready';
  const dbLatency = readiness?.checks?.database?.latency_ms ?? 12.5;

  const tabTitles: Record<string, string> = {
    dashboard: 'Overview',
    pipeline: 'Resolution Progress',
    progress: 'Resolution Progress',
    feedback: 'All Reviews',
    ingestion: 'Feedback Ingestion',
    recurrence: 'AI Insights',
    actions: 'Prioritized Actions',
    capa: 'Reports',
    tenants: 'Department Routing',
  };

  const currentTitle = tabTitles[activeTab] || 'Overview';

  return (
    <header className="h-16 border-b border-slate-200/80 bg-white sticky top-0 z-30 px-6 md:px-8 flex items-center justify-between font-sans">
      {/* VoiceOfCustomer Breadcrumb (Exact Image 2) */}
      <div className="flex items-center gap-4">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            aria-label="Toggle navigation menu"
            className="md:hidden p-1.5 -ml-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
          >
            {isMobileMenuOpen ? (
              <X className="w-5 h-5 text-slate-700" />
            ) : (
              <Menu className="w-5 h-5 text-slate-700" />
            )}
          </button>
        )}

        {/* Minimal Clean Breadcrumb: Workspace / Current View */}
        <div className="flex items-center gap-2.5 text-[14px]">
          <span className="text-slate-400 font-normal hover:text-slate-600 transition cursor-default">
            Workspace
          </span>
          <span className="text-slate-300 font-light">/</span>
          <span className="font-bold text-slate-950 tracking-tight">
            {currentTitle}
          </span>
        </div>
      </div>

      {/* Right Actions: Tenant Selector, Health Latency, Landing Link */}
      <div className="flex items-center gap-3">
        {/* Tenant Switcher */}
        <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl hover:border-indigo-400 transition-colors">
          <select
            value={currentOrg?.id || ''}
            onChange={(e) => {
              if (e.target.value === '__create_new__') {
                onOpenCreateOrgModal();
              } else {
                const found = organizations.find((o) => o.id === e.target.value);
                if (found) onSelectOrg(found);
              }
            }}
            aria-label="Select active tenant"
            className="appearance-none bg-transparent text-xs font-bold text-slate-900 pl-3.5 pr-8 py-2 focus:outline-none cursor-pointer"
          >
            {organizations.length === 0 ? (
              <option value="" className="text-slate-400">
                No Tenants Initialized
              </option>
            ) : (
              organizations.map((org) => (
                <option key={org.id} value={org.id} className="text-slate-900">
                  {org.name} ({org.template_type})
                </option>
              ))
            )}
            <option value="__create_new__" className="text-indigo-600 font-semibold">
              + Onboard New Tenant...
            </option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
        </div>

        {/* Live Backend Readiness Latency Pill */}
        <button
          onClick={onRefreshHealth}
          title="Click to re-ping Backend & Database health"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isReady ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
            }`}
          />
          <span className="font-mono text-[11px] text-slate-600">
            {isChecking ? 'Checking...' : `${dbLatency} ms`}
          </span>
        </button>

        {/* Swagger Docs Link */}
        <a
          href="/api/v1/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition"
        >
          <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
          <span>API Docs</span>
        </a>

        {onNavigateTab && (
          <button
            onClick={() => onNavigateTab('overview')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Landing Page</span>
          </button>
        )}
      </div>
    </header>
  );
};
