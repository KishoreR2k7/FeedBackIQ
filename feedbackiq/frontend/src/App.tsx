import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { HealthStatusCard } from './components/HealthStatusCard';
import { TenantSelector } from './components/TenantSelector';
import { IngestionPanel } from './components/IngestionPanel';
import { FeedbackListView } from './components/FeedbackListView';
import { TopicTrendView } from './components/TopicTrendView';
import { PrioritizedIssuesView } from './components/PrioritizedIssuesView';
import { PrioritizedActionBoard } from './components/PrioritizedActionBoard';
import { LoadingState } from './components/LoadingState';
import { ErrorAlert } from './components/ErrorAlert';
import { ErrorBoundary } from './components/ErrorBoundary';
import { api } from './services/api';
import {
  Organization,
  ReadinessResponse,
  CreateOrganizationInput,
  OrgTemplateConfig,
  PaginatedFeedback,
} from './types';
import {
  Sparkles,
  ArrowRight,
  TrendingUp,
  CheckSquare,
  CheckCircle2,
  ShieldAlert,
  Flame,
  Cpu,
} from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [templates, setTemplates] = useState<Record<string, OrgTemplateConfig>>({});
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);

  const [feedbackData, setFeedbackData] = useState<PaginatedFeedback | null>(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);

  // Filters
  const [mealTypeFilter, setMealTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState('');
  const [foodSafetyOnly, setFoodSafetyOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [isHealthChecking, setIsHealthChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);

  // Load Feedback Data
  const loadFeedback = useCallback(async () => {
    if (!currentOrg) return;
    setIsLoadingFeedback(true);
    try {
      const data = await api.getFeedback(
        {
          page: currentPage,
          page_size: 15,
          meal_type: mealTypeFilter || undefined,
          item: searchQuery || undefined,
          issue_category: categoryFilter || undefined,
          sentiment: sentimentFilter || undefined,
          food_safety_only: foodSafetyOnly || undefined,
        },
        currentOrg.id
      );
      setFeedbackData(data);
    } catch (err: any) {
      console.error('Failed to load feedback:', err);
    } finally {
      setIsLoadingFeedback(false);
    }
  }, [currentOrg, currentPage, mealTypeFilter, categoryFilter, sentimentFilter, foodSafetyOnly, searchQuery]);

  // Fetch initial telemetry and tenants
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [readinessData, templatesData, orgsData] = await Promise.all([
        api.getReadiness().catch(() => null),
        api.getTemplates().catch(() => ({})),
        api.getOrganizations().catch(() => []),
      ]);

      setReadiness(readinessData);
      setTemplates(templatesData);
      setOrganizations(orgsData);

      if (orgsData.length > 0) {
        setCurrentOrg(orgsData[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to FeedbackIQ backend');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (currentOrg) {
      loadFeedback();
    }
  }, [currentOrg, loadFeedback]);

  const handleRefreshHealth = async () => {
    setIsHealthChecking(true);
    try {
      const data = await api.getReadiness();
      setReadiness(data);
    } catch (err: any) {
      setError(err.message || 'Error refreshing health check');
    } finally {
      setIsHealthChecking(false);
    }
  };

  const handleCreateOrg = async (input: CreateOrganizationInput) => {
    const created = await api.createOrganization(input);
    setOrganizations((prev) => [...prev, created]);
    setCurrentOrg(created);
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
        {/* Navigation Header */}
        <Header
          currentOrg={currentOrg}
          organizations={organizations}
          onSelectOrg={setCurrentOrg}
          onOpenCreateOrgModal={() => setIsCreateOrgModalOpen(true)}
          readiness={readiness}
          isChecking={isHealthChecking}
          onRefreshHealth={handleRefreshHealth}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Navigation Sidebar */}
          <Sidebar activeTab={activeTab} onSelectTab={setActiveTab} />

          {/* Primary Viewport */}
          <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
            {/* Global Error Banner */}
            {error && (
              <ErrorAlert
                title="API Gateway Connectivity Notice"
                message={error}
                onRetry={loadInitialData}
                isRetrying={isLoading}
              />
            )}

            {isLoading ? (
              <LoadingState
                message="Initializing FeedbackIQ Foundation..."
                subtext="Checking PostgreSQL connection, verifying database schema, and loading tenant templates"
              />
            ) : (
              <>
                {/* Active Organization & Readiness Telemetry */}
                {activeTab === 'overview' && (
                  <div className="space-y-8">
                    {/* feedback.tools Model: High-Impact Hero Section */}
                    <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-8 md:p-12 shadow-xs">
                      {/* Decorative gradient glow */}
                      <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-100/60 rounded-full blur-3xl pointer-events-none" />
                      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-50/80 rounded-full blur-3xl pointer-events-none" />

                      <div className="relative max-w-3xl space-y-5">
                        {/* Sparkle Trust Pill */}
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                          <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                          <span>1M+ Responses Analyzed • AI Food Intelligence Platform</span>
                        </div>

                        {/* Hero Title */}
                        <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                          Customer Food Feedback <br />
                          <span className="text-blue-600">Analytics &amp; Quality Intelligence</span>
                        </h1>

                        {/* Subtitle */}
                        <p className="text-base text-slate-600 leading-relaxed max-w-2xl font-normal">
                          Continuous feedback ingestion, empirical recurrence prediction, and automated action prioritization for modern dining operations, campus messes, and enterprise kitchens.
                        </p>

                        {/* CTAs */}
                        <div className="flex flex-wrap items-center gap-3 pt-2">
                          <button
                            onClick={() => setActiveTab('feedback')}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition hover:shadow-md"
                          >
                            <span>Launch Ingestion Workspace</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setActiveTab('capa')}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-semibold text-sm shadow-xs transition"
                          >
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                            <span>Prioritized Action Board</span>
                          </button>
                        </div>
                      </div>

                      {/* Live Interactive Review Showcase (Feedback.tools style) */}
                      <div className="mt-8 pt-8 border-t border-slate-100">
                        <div className="text-xs font-bold uppercase text-slate-600 tracking-wider mb-3">
                          Live Ingestion Demonstration
                        </div>

                        <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 font-medium text-slate-700">
                              <span className="font-bold text-amber-600 font-mono">★ 2/5</span>
                              <span>•</span>
                              <span className="font-semibold text-slate-900">Dinner Service • Counter 2</span>
                              <span>•</span>
                              <span className="text-slate-500">Student Mess Hall</span>
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

                    {/* 3-Stage Pipeline (feedback.tools model) */}
                    <div className="space-y-4">
                      <div>
                        <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                          Closed-Loop Operations
                        </div>
                        <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-1">
                          From raw feedback to verified kitchen resolutions
                        </h2>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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
                            onClick={() => setActiveTab('feedback')}
                            className="flex items-center justify-between text-xs font-bold text-blue-600 hover:text-blue-700 pt-2 border-t border-slate-100"
                          >
                            <span>Launch Feedback Ingestion</span>
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
                            onClick={() => setActiveTab('recurrence')}
                            className="flex items-center justify-between text-xs font-bold text-blue-600 hover:text-blue-700 pt-2 border-t border-slate-100"
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
                            onClick={() => setActiveTab('capa')}
                            className="flex items-center justify-between text-xs font-bold text-blue-600 hover:bg-blue-700 pt-2 border-t border-slate-100"
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
                    <HealthStatusCard
                      readiness={readiness}
                      isLoading={isHealthChecking}
                      onRefresh={handleRefreshHealth}
                    />

                    <TenantSelector
                      currentOrg={currentOrg}
                      organizations={organizations}
                      templates={templates}
                      onSelectOrg={setCurrentOrg}
                      onCreateOrg={handleCreateOrg}
                      isOpenModal={isCreateOrgModalOpen}
                      onCloseModal={() => setIsCreateOrgModalOpen(false)}
                      onOpenModal={() => setIsCreateOrgModalOpen(true)}
                    />
                  </div>
                )}

                {/* Feedback Ingestion & Aspect Intelligence Views */}
                {activeTab === 'feedback' && (
                  <div className="space-y-6">
                    {/* Ingestion & Synthetic Generation Panel */}
                    <IngestionPanel
                      currentOrg={currentOrg}
                      onIngestionComplete={loadFeedback}
                    />

                    {/* Feedback Interactive Table & AI Analysis */}
                    <FeedbackListView
                      data={feedbackData}
                      isLoading={isLoadingFeedback}
                      onRefresh={loadFeedback}
                      orgId={currentOrg?.id}
                      mealTypeFilter={mealTypeFilter}
                      setMealTypeFilter={setMealTypeFilter}
                      categoryFilter={categoryFilter}
                      setCategoryFilter={setCategoryFilter}
                      sentimentFilter={sentimentFilter}
                      setSentimentFilter={setSentimentFilter}
                      foodSafetyOnly={foodSafetyOnly}
                      setFoodSafetyOnly={setFoodSafetyOnly}
                      searchQuery={searchQuery}
                      setSearchQuery={setSearchQuery}
                      currentPage={currentPage}
                      setCurrentPage={setCurrentPage}
                    />
                  </div>
                )}

                {/* Topic Trends & Aspect Intelligence */}
                {(activeTab === 'analytics' || activeTab === 'recurrence') && (
                  <TopicTrendView
                    orgId={currentOrg?.id}
                    onNavigateToPriorities={() => setActiveTab('actions')}
                  />
                )}

                {/* Prioritized Issues & Rule 9 Safety Overrides (Deterministic Priority Queue) */}
                {activeTab === 'actions' && (
                  <PrioritizedIssuesView
                    orgId={currentOrg?.id}
                    onRefreshData={loadFeedback}
                  />
                )}

                {/* Implementation 3: Prioritized Action Board & CAPA Management */}
                {activeTab === 'capa' && (
                  <PrioritizedActionBoard
                    orgId={currentOrg?.id}
                    onRefreshData={loadFeedback}
                  />
                )}

                {/* Tenant Settings Tab */}
                {activeTab === 'tenants' && (
                  <TenantSelector
                    currentOrg={currentOrg}
                    organizations={organizations}
                    templates={templates}
                    onSelectOrg={setCurrentOrg}
                    onCreateOrg={handleCreateOrg}
                    isOpenModal={isCreateOrgModalOpen}
                    onCloseModal={() => setIsCreateOrgModalOpen(false)}
                    onOpenModal={() => setIsCreateOrgModalOpen(true)}
                  />
                )}

                {/* System Architecture Tab */}
                {activeTab === 'system' && (
                  <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-blue-600" />
                      FeedbackIQ Architecture &amp; Methodology
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      FeedbackIQ operates on an unbending architectural principle: <strong>Calculated facts are computed deterministically with SQL and Python, while LLMs synthesize human-readable labels, causal hypotheses, and operational recommendations.</strong>
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <span className="font-bold text-blue-700 uppercase">Deterministic Priority Engine</span>
                        <p className="text-slate-600">
                          Priority = 0.50 × Severity + 0.30 × RecurrenceRisk + 0.20 × RecentFrequency.
                          All components are normalized strictly between 0 and 100 before weighting.
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <span className="font-bold text-red-600 uppercase">Rule 9 Food-Safety Override</span>
                        <p className="text-slate-600">
                          Critical food safety hazards (pests, foreign objects, illness, raw meat, chemical odor) trigger an independent safety floor (≥ 85.0) ensuring they are never deprioritized due to limited historical frequency.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default App;
