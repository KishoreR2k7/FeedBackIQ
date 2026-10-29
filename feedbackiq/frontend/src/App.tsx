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
import { ShieldCheck, Sparkles, Cpu, Database, Network } from 'lucide-react';

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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
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
                  <>
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

                    {/* Phase Roadmap */}
                    <div className="rounded-2xl bg-slate-900/40 border border-slate-800/80 p-6">
                      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-indigo-400" />
                          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                            FeedbackIQ Architecture Roadmap
                          </h3>
                        </div>
                        <span className="text-xs text-emerald-400 font-mono font-semibold">
                          Implementation 3 Active
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-emerald-500/30">
                          <div className="flex items-center justify-between text-xs font-semibold text-emerald-400 mb-2">
                            <span>Phase 0: Foundation</span>
                            <ShieldCheck className="w-4 h-4" />
                          </div>
                          <p className="text-xs text-slate-300 font-medium">Core Monorepo &amp; Multi-Tenancy</p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            FastAPI, PostgreSQL 16 (Docker), SQLAlchemy async, Alembic, React UI shell.
                          </p>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-950/60 border border-emerald-500/30">
                          <div className="flex items-center justify-between text-xs font-semibold text-emerald-400 mb-2">
                            <span>Phase 1: Ingestion &amp; NLP</span>
                            <Database className="w-4 h-4" />
                          </div>
                          <p className="text-xs text-slate-300 font-medium">Data Pipeline &amp; Safety Agent</p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            CSV Upload, Zomato mapping, synthetic scenarios, LangChain Aspect Analysis &amp; Rule 9 Safety.
                          </p>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-950/60 border border-emerald-500/30">
                          <div className="flex items-center justify-between text-xs font-semibold text-emerald-400 mb-2">
                            <span>Phase 2: Recurrence Intelligence</span>
                            <Cpu className="w-4 h-4" />
                          </div>
                          <p className="text-xs text-slate-300 font-medium">Intelligence &amp; Priority Engine</p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Deterministic priority formula (Severity + Recurrence + Frequency + Impact) &amp; Rule 9 override.
                          </p>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-950/60 border border-emerald-500/50 ring-1 ring-emerald-500/20">
                          <div className="flex items-center justify-between text-xs font-semibold text-emerald-300 mb-2">
                            <span>Phase 3: CAPA Actions</span>
                            <Network className="w-4 h-4" />
                          </div>
                          <p className="text-xs text-slate-300 font-medium">Closed-Loop Task &amp; Verification</p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Pydantic action recommendations, manager approvals, staff delegation, and statistical verification.
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
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
                  <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4">
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-indigo-400" />
                      FeedbackIQ Architecture &amp; Methodology
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      FeedbackIQ operates on an unbending architectural principle: <strong>Calculated facts are computed deterministically with SQL and Python, while LLMs synthesize human-readable labels, causal hypotheses, and operational recommendations.</strong>
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
                      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/60 space-y-2">
                        <span className="font-bold text-emerald-400 uppercase">Deterministic Priority Engine</span>
                        <p className="text-slate-400">
                          Priority = 0.50 × Severity + 0.30 × RecurrenceRisk + 0.20 × RecentFrequency.
                          All components are normalized strictly between 0 and 100 before weighting.
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/60 space-y-2">
                        <span className="font-bold text-rose-400 uppercase">Rule 9 Food-Safety Override</span>
                        <p className="text-slate-400">
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
