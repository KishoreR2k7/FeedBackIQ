import React from 'react';
import { Activity, BookOpen, Layers, ChevronDown } from 'lucide-react';
import { Organization, ReadinessResponse } from '../types';

interface HeaderProps {
  currentOrg: Organization | null;
  organizations: Organization[];
  onSelectOrg: (org: Organization) => void;
  onOpenCreateOrgModal: () => void;
  readiness: ReadinessResponse | null;
  isChecking: boolean;
  onRefreshHealth: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentOrg,
  organizations,
  onSelectOrg,
  onOpenCreateOrgModal,
  readiness,
  isChecking,
  onRefreshHealth,
}) => {
  const isReady = readiness?.status === 'ready';

  return (
    <header className="h-16 border-b border-slate-200/80 bg-white/95 backdrop-blur sticky top-0 z-30 px-6 flex items-center justify-between shadow-xs">
      {/* Brand & Project Info */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-600/20 text-white">
          <Layers className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 tracking-tight">FeedbackIQ</h1>
            <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
              SaaS MVP
            </span>
            <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 rounded-md uppercase tracking-wider font-mono">
              PS 2.5
            </span>
            <span className="hidden lg:inline text-xs font-medium text-slate-500 border-l border-slate-200 pl-2">
              Food Quality Intelligence Platform
            </span>
          </div>
          <p className="text-[11px] text-slate-500 hidden sm:block">
            Sentiment Analysis • Recurrence Prediction • Canteen Prioritized Actions
          </p>
        </div>
      </div>

      {/* Right Actions: Tenant Selector, Health Pill, Docs */}
      <div className="flex items-center gap-3">
        {/* Tenant Switcher */}
        <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-lg hover:border-blue-300 transition-colors">
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
            className="appearance-none bg-transparent text-xs font-semibold text-slate-800 pl-3 pr-8 py-2 focus:outline-none cursor-pointer"
          >
            {organizations.length === 0 ? (
              <option value="" className="text-slate-400">
                No Tenants Initialized
              </option>
            ) : (
              organizations.map((org) => (
                <option key={org.id} value={org.id} className="text-slate-800">
                  {org.name} ({org.template_type})
                </option>
              ))
            )}
            <option value="__create_new__" className="text-blue-600 font-semibold">
              + Onboard New Tenant...
            </option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
        </div>

        {/* Live Backend Readiness Pill */}
        <button
          onClick={onRefreshHealth}
          title="Click to re-ping Backend & Database health"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            isReady
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70 shadow-xs'
              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/70 shadow-xs'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isReady ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
            }`}
          />
          <span>{isChecking ? 'Checking...' : isReady ? 'Services Ready' : 'Degraded'}</span>
          <Activity className={`w-3.5 h-3.5 opacity-70 ${isChecking ? 'animate-spin' : ''}`} />
        </button>

        {/* Swagger Docs Link */}
        <a
          href="/api/v1/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 transition-all shadow-xs"
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden md:inline">OpenAPI Docs</span>
        </a>
      </div>
    </header>
  );
};
