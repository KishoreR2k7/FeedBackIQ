import React from 'react';
import { Activity, BookOpen, Layers } from 'lucide-react';
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
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur sticky top-0 z-30 px-6 flex items-center justify-between">
      {/* Brand & Project Info */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-sm">
          <Layers className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-white tracking-tight">FeedbackIQ</h1>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
              SaaS MVP
            </span>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-md uppercase tracking-wider font-mono">
              PS 2.5
            </span>
            <span className="hidden lg:inline text-[10px] font-semibold text-slate-400 border-l border-slate-800 pl-2">
              Food Quality Intelligence
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            Sentiment Analysis • Recurrence Prediction • Canteen Prioritized Actions
          </p>
        </div>
      </div>

      {/* Right Actions: Tenant Selector, Health Pill, Docs */}
      <div className="flex items-center gap-3">
        {/* Tenant Switcher */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-1">
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
            className="bg-transparent text-xs font-medium text-slate-200 px-2 py-1 focus:outline-none cursor-pointer"
          >
            {organizations.length === 0 ? (
              <option value="" className="bg-slate-900 text-slate-400">
                No Tenants Initialized
              </option>
            ) : (
              organizations.map((org) => (
                <option key={org.id} value={org.id} className="bg-slate-900 text-slate-200">
                  {org.name} ({org.template_type})
                </option>
              ))
            )}
            <option value="__create_new__" className="bg-slate-900 text-emerald-400 font-semibold">
              + Onboard New Tenant...
            </option>
          </select>
        </div>

        {/* Live Backend Readiness Pill */}
        <button
          onClick={onRefreshHealth}
          title="Click to re-ping Backend & Database health"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            isReady
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isReady ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
        >
          <BookOpen className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden md:inline">OpenAPI Docs</span>
        </a>
      </div>
    </header>
  );
};
