import React from 'react';
import {
  Sparkles,
  ArrowRight,
  TrendingUp,
  CheckSquare,
  CheckCircle2,
  ShieldAlert,
  Flame,
  Layers,
  ChevronDown,
  Activity,
} from 'lucide-react';
import { HealthStatusCard } from './HealthStatusCard';
import { TenantSelector } from './TenantSelector';
import {
  Organization,
  ReadinessResponse,
  CreateOrganizationInput,
  OrgTemplateConfig,
} from '../types';

interface LandingPageProps {
  onEnterWorkspace: (tab?: string) => void;
  currentOrg: Organization | null;
  organizations: Organization[];
  templates: Record<string, OrgTemplateConfig>;
  onSelectOrg: (org: Organization) => void;
  onCreateOrg: (input: CreateOrganizationInput) => Promise<void>;
  isCreateOrgModalOpen: boolean;
  setIsCreateOrgModalOpen: (open: boolean) => void;
  readiness: ReadinessResponse | null;
  isHealthChecking: boolean;
  onRefreshHealth: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onEnterWorkspace,
  currentOrg,
  organizations,
  templates,
  onSelectOrg,
  onCreateOrg,
  isCreateOrgModalOpen,
  setIsCreateOrgModalOpen,
  readiness,
  isHealthChecking,
  onRefreshHealth,
}) => {
  const isReady = readiness?.status === 'ready';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Public Top Navbar (Standalone Landing Page Navbar) */}
      <header className="h-16 border-b border-slate-200/80 bg-white/95 backdrop-blur sticky top-0 z-40 px-6 lg:px-12 flex items-center justify-between shadow-xs">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-600/20 text-white">
            <Layers className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-slate-900 tracking-tight">FeedbackIQ</span>
            <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
              SaaS MVP
            </span>
            <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 rounded-md uppercase tracking-wider font-mono">
              PS 2.5
            </span>
          </div>
        </div>

        {/* Public Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 text-xs font-semibold text-slate-600">
          <button
            onClick={() => onEnterWorkspace('feedback')}
            className="px-3 py-2 rounded-lg hover:text-blue-600 hover:bg-blue-50 transition"
          >
            Feedback Ingestion
          </button>
          <button
            onClick={() => onEnterWorkspace('recurrence')}
            className="px-3 py-2 rounded-lg hover:text-blue-600 hover:bg-blue-50 transition"
          >
            Recurrence Risks
          </button>
          <button
            onClick={() => onEnterWorkspace('actions')}
            className="px-3 py-2 rounded-lg hover:text-blue-600 hover:bg-blue-50 transition"
          >
            Prioritized Actions
          </button>
          <button
            onClick={() => onEnterWorkspace('capa')}
            className="px-3 py-2 rounded-lg hover:text-blue-600 hover:bg-blue-50 transition"
          >
            CAPA Action Board
          </button>
        </nav>

        {/* Right Actions: Tenant Selector, Readiness, Launch Workspace */}
        <div className="flex items-center gap-3">
          {/* Tenant Selector Dropdown */}
          <div className="relative hidden sm:flex items-center bg-slate-50 border border-slate-200 rounded-lg hover:border-blue-300 transition-colors">
            <select
              value={currentOrg?.id || ''}
              onChange={(e) => {
                if (e.target.value === '__create_new__') {
                  setIsCreateOrgModalOpen(true);
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

          {/* Readiness Indicator */}
          <button
            onClick={onRefreshHealth}
            title="Click to re-ping Backend & Database health"
            className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              isReady
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isReady ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span>{isHealthChecking ? 'Checking...' : isReady ? 'Services Ready' : 'Degraded'}</span>
            <Activity className={`w-3.5 h-3.5 opacity-70 ${isHealthChecking ? 'animate-spin' : ''}`} />
          </button>

          {/* Primary CTA: Launch Workspace */}
          <button
            onClick={() => onEnterWorkspace('feedback')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition"
          >
            <span>Launch Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Hero Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 lg:px-12 py-10 lg:py-16 space-y-12">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-8 md:p-14 shadow-xs">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-100/60 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-50/80 rounded-full blur-3xl pointer-events-none" />

          <div className="relative max-w-3xl space-y-6">
            {/* Sparkle Trust Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
              <span>1M+ Responses Analyzed • AI Dining Intelligence Platform</span>
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-tight">
              Customer Food Feedback <br />
              <span className="text-blue-600">Analytics &amp; Quality Intelligence</span>
            </h1>

            {/* Subtitle */}
            <p className="text-base md:text-lg text-slate-600 leading-relaxed max-w-2xl font-normal">
              Continuous feedback ingestion, empirical recurrence prediction, and automated action prioritization for modern dining operations, campus messes, and enterprise kitchens.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={() => onEnterWorkspace('feedback')}
                className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all"
              >
                <span>Launch Ingestion Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => onEnterWorkspace('capa')}
                className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-semibold text-sm shadow-xs transition-all hover:border-blue-300"
              >
                <CheckSquare className="w-4 h-4 text-blue-600" />
                <span>Prioritized Action Board</span>
              </button>
            </div>
          </div>

          {/* Interactive Live Review Showcase */}
          <div className="mt-10 pt-8 border-t border-slate-100">
            <div className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-3">
              Live Ingestion &amp; Classification Demonstration
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 font-medium text-slate-700">
                  <span className="font-bold text-amber-600 font-mono">★ 2/5</span>
                  <span>•</span>
                  <span className="font-semibold text-slate-900">Dinner Service • Counter 2</span>
                  <span>•</span>
                  <span className="text-slate-500">Campus Mess Hall</span>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                  ● Real-time Stream
                </span>
              </div>

              <p className="text-sm text-slate-800 italic leading-relaxed bg-white p-3.5 rounded-xl border border-slate-200">
                "The sambar rice served today at lunch was cold and sour, and yesterday there was a foreign wire strand in the dinner chicken curry."
              </p>

              {/* Inline AI Extracted Aspects */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 font-bold">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Chicken Curry (Foreign Object • Sev 5)
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Sambar Rice (Temperature • Sev 3)
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                  <Flame className="w-3.5 h-3.5 text-blue-600" />
                  Recurrence: 88% Likelihood
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold ml-auto shadow-xs">
                  Priority Score: 94.0 / 100
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3-Stage Pipeline */}
        <div className="space-y-6">
          <div>
            <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">
              Operational Quality Loop
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mt-1">
              From raw diner feedback to shipped kitchen resolutions
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Stage 1 */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-blue-300 transition-all space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm border border-blue-100">
                  01
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  AI Reads &amp; Classifies Every Review
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  Ingest CSV batches or real-time diner surveys. LangChain structured output extracts food items, sentiments, aspects, severity scores (1–5), and immediate food safety flags.
                </p>
              </div>
              <button
                onClick={() => onEnterWorkspace('feedback')}
                className="flex items-center justify-between text-xs font-bold text-blue-600 hover:text-blue-700 pt-3 border-t border-slate-100"
              >
                <span>Launch Ingestion Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Stage 2 */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-blue-300 transition-all space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm border border-blue-100">
                  02
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Empirical Recurrence Reasoning
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  SQL metrics retrieve historical velocity, distinct days count, and meal-period patterns. An autonomous reasoning agent forecasts recurrence risk without black-box ML drift.
                </p>
              </div>
              <button
                onClick={() => onEnterWorkspace('recurrence')}
                className="flex items-center justify-between text-xs font-bold text-blue-600 hover:text-blue-700 pt-3 border-t border-slate-100"
              >
                <span>Inspect Recurrence Risks</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Stage 3 */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-blue-300 transition-all space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm border border-blue-100">
                  03
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Deterministic Prioritization &amp; CAPA
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  Configurable deterministic scoring (Severity + Recurrence + Frequency) with non-suppressible Rule 9 safety floors, manager approval workflows, and statistical before/after verification.
                </p>
              </div>
              <button
                onClick={() => onEnterWorkspace('capa')}
                className="flex items-center justify-between text-xs font-bold text-blue-600 hover:text-blue-700 pt-3 border-t border-slate-100"
              >
                <span>Open Action Board</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Operational Guardrails Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-2xl bg-blue-50/50 border border-blue-200 text-xs">
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Multi-Tenant Dining Isolation</span>
          </div>
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Mandatory Rule 9 Safety Floor</span>
          </div>
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Empirical Non-Causal Audits</span>
          </div>
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Kaggle Zomato &amp; Synthetic Tests</span>
          </div>
        </div>

        {/* Administrative Telemetry Cards (PostgreSQL, Docker, Multi-tenancy) */}
        <div className="space-y-6 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Live Infrastructure &amp; Multi-Tenancy</h3>
              <p className="text-xs text-slate-500 font-medium">Real-time PostgreSQL probe latency and tenant organization settings</p>
            </div>
            <button
              onClick={() => onEnterWorkspace('tenants')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>Manage Tenants in Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <HealthStatusCard
            readiness={readiness}
            isLoading={isHealthChecking}
            onRefresh={onRefreshHealth}
          />

          <TenantSelector
            currentOrg={currentOrg}
            organizations={organizations}
            templates={templates}
            onSelectOrg={onSelectOrg}
            onCreateOrg={onCreateOrg}
            isOpenModal={isCreateOrgModalOpen}
            onCloseModal={() => setIsCreateOrgModalOpen(false)}
            onOpenModal={() => setIsCreateOrgModalOpen(true)}
          />
        </div>
      </main>

      {/* Public Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 px-6 lg:px-12 mt-16 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800">FeedbackIQ Platform</span>
          <span>•</span>
          <span>Customer Food Feedback Analytics &amp; Quality Intelligence Platform</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => onEnterWorkspace('feedback')} className="hover:text-blue-600 font-medium">
            Workspace
          </button>
          <a href="/api/v1/docs" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 font-medium">
            OpenAPI Docs
          </a>
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-blue-600 font-medium">
            Back to Top ↑
          </button>
        </div>
      </footer>
    </div>
  );
};
