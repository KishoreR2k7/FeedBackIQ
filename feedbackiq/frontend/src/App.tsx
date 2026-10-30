import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LandingPage } from './components/LandingPage';
import { IngestionPanel } from './components/IngestionPanel';
import { FeedbackListView } from './components/FeedbackListView';
import { FeedbackFlowTrackerView } from './components/FeedbackFlowTrackerView';
import { TopicTrendView } from './components/TopicTrendView';
import { PrioritizedIssuesView } from './components/PrioritizedIssuesView';
import { PrioritizedActionBoard } from './components/PrioritizedActionBoard';
import { TenantSelector } from './components/TenantSelector';
import { HealthStatusCard } from './components/HealthStatusCard';
import { AnalyticsOverviewView } from './components/AnalyticsOverviewView';
import { DatasetManagementView } from './components/DatasetManagementView';
import { StudentFeedbackPortal } from './components/StudentFeedbackPortal';
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
import { Cpu, ShieldCheck, Search, ArrowRight, Activity } from 'lucide-react';

export const App: React.FC = () => {
  // Sync tab with URL hash or default to 'overview'
  const getInitialTab = () => {
    const hash = window.location.hash.replace('#', '');
    return hash || 'overview';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [userRole, setUserRole] = useState<'student' | 'manager' | 'admin'>('admin');
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [templates, setTemplates] = useState<Record<string, OrgTemplateConfig>>({});
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);

  const [feedbackData, setFeedbackData] = useState<PaginatedFeedback | null>(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);

  // Extended Filters for Feedback Explorer
  const [mealTypeFilter, setMealTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState('');
  const [sourceDatasetFilter, setSourceDatasetFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState<number | ''>('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [analysisStatusFilter, setAnalysisStatusFilter] = useState('');
  const [foodSafetyOnly, setFoodSafetyOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [isHealthChecking, setIsHealthChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Keep hash updated for browser refresh routing
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  // Load Feedback Data from Live Database
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
          channel: channelFilter || undefined,
          rating: ratingFilter !== '' ? Number(ratingFilter) : undefined,
          date_from: dateFromFilter ? new Date(dateFromFilter).toISOString() : undefined,
          date_to: dateToFilter ? new Date(dateToFilter).toISOString() : undefined,
          has_analysis:
            analysisStatusFilter === 'true'
              ? true
              : analysisStatusFilter === 'false'
              ? false
              : undefined,
          food_safety_only: foodSafetyOnly || undefined,
          source_dataset: sourceDatasetFilter || undefined,
        },
        currentOrg.id
      );
      setFeedbackData(data);
    } catch (err: any) {
      console.error('Failed to load feedback:', err);
    } finally {
      setIsLoadingFeedback(false);
    }
  }, [
    currentOrg,
    currentPage,
    mealTypeFilter,
    categoryFilter,
    sentimentFilter,
    channelFilter,
    ratingFilter,
    dateFromFilter,
    dateToFilter,
    analysisStatusFilter,
    sourceDatasetFilter,
    foodSafetyOnly,
    searchQuery,
  ]);

  // Initial Telemetry & Tenants fetch
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

  // Handle Role Switching
  const handleRoleChange = (role: 'student' | 'manager' | 'admin') => {
    setUserRole(role);
    if (role === 'student') {
      handleTabChange('student-portal');
    } else if (activeTab === 'student-portal') {
      handleTabChange('dashboard');
    }
  };

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

  // Dedicated Student Portal View (Directly accessible without admin)
  if (activeTab === 'student-portal' || userRole === 'student') {
    return (
      <ErrorBoundary>
        <StudentFeedbackPortal
          currentOrg={currentOrg}
          onBackToApp={() => {
            setUserRole('admin');
            handleTabChange('dashboard');
          }}
          onFeedbackSubmitted={() => {
            loadFeedback();
          }}
        />
      </ErrorBoundary>
    );
  }

  // Public Standalone Landing Page (Modeled after feedback.tools showcase)
  if (activeTab === 'overview') {
    return (
      <ErrorBoundary>
        <LandingPage
          onEnterWorkspace={(tab = 'dashboard') => handleTabChange(tab)}
          currentOrg={currentOrg}
          organizations={organizations}
          templates={templates}
          onSelectOrg={setCurrentOrg}
          onCreateOrg={handleCreateOrg}
          isCreateOrgModalOpen={isCreateOrgModalOpen}
          setIsCreateOrgModalOpen={setIsCreateOrgModalOpen}
          readiness={readiness}
          isHealthChecking={isHealthChecking}
          onRefreshHealth={handleRefreshHealth}
        />
      </ErrorBoundary>
    );
  }

  // Modern Management Workspace with restructured Sidebar and Header
  return (
    <ErrorBoundary>
      <div className="h-screen w-full bg-slate-50 text-slate-900 flex flex-col font-sans overflow-hidden">
        {/* Workspace Top Navigation Header */}
        <Header
          currentOrg={currentOrg}
          organizations={organizations}
          onSelectOrg={setCurrentOrg}
          onOpenCreateOrgModal={() => setIsCreateOrgModalOpen(true)}
          readiness={readiness}
          isChecking={isHealthChecking}
          onRefreshHealth={handleRefreshHealth}
          onNavigateTab={handleTabChange}
          isMobileMenuOpen={isMobileMenuOpen}
          onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
          userRole={userRole}
          onSelectUserRole={handleRoleChange}
        />

        {/* Workspace Layout Container */}
        <div className="flex-1 flex min-h-0 overflow-hidden relative">
          {/* Reorganized Sidebar */}
          <Sidebar
            activeTab={activeTab}
            onSelectTab={(tab) => {
              handleTabChange(tab);
              setIsMobileMenuOpen(false);
            }}
            currentOrg={currentOrg}
            isMobileOpen={isMobileMenuOpen}
            onCloseMobile={() => setIsMobileMenuOpen(false)}
            userRole={userRole}
          />

          {/* Primary Viewport Area */}
          <main className="flex-1 h-full overflow-y-auto p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
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
                {/* 1. OVERVIEW: Executive Overview & Feedback Analytics */}
                {(activeTab === 'dashboard' || activeTab === 'analytics') && (
                  <AnalyticsOverviewView
                    orgId={currentOrg?.id}
                    onNavigateToRecurrence={() => handleTabChange('recurrence')}
                    onNavigateToActions={() => handleTabChange('actions')}
                    onNavigateToFeedback={() => handleTabChange('explorer')}
                  />
                )}

                {/* 2. FEEDBACK INTELLIGENCE: Feedback Ingestion */}
                {(activeTab === 'ingestion' || activeTab === 'feedback') && (
                  <div className="space-y-6">
                    <IngestionPanel
                      currentOrg={currentOrg}
                      onIngestionComplete={loadFeedback}
                      onNavigateToExplorer={() => handleTabChange('explorer')}
                    />

                    {/* Recent Ingestion Stream & Activity (Non-duplicative summary) */}
                    <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                              <Activity className="w-3 h-3 text-blue-600" />
                              Live Ingest Telemetry
                            </span>
                            <span className="text-xs text-slate-500">Pipeline Status</span>
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 mt-1">
                            Recently Ingested Submissions
                          </h3>
                        </div>

                        <button
                          onClick={() => handleTabChange('explorer')}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition"
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>Open Full Feedback Explorer ({feedbackData?.total ?? 0} Records)</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Ingestion Stream Metrics */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-[11px] font-bold text-slate-500 uppercase">Total Ingested</span>
                          <div className="text-lg font-bold text-slate-900 mt-0.5 font-mono">
                            {feedbackData?.total ?? 0}
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200">
                          <span className="text-[11px] font-bold text-emerald-700 uppercase">Positive Sentiment</span>
                          <div className="text-lg font-bold text-emerald-700 mt-0.5 font-mono">
                            {feedbackData?.items.filter((f) => f.analysis?.sentiment === 'positive').length ?? 0}
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200">
                          <span className="text-[11px] font-bold text-amber-700 uppercase">Complaints / Negative</span>
                          <div className="text-lg font-bold text-amber-700 mt-0.5 font-mono">
                            {feedbackData?.items.filter((f) => f.analysis?.sentiment === 'negative').length ?? 0}
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-red-50/60 border border-red-200">
                          <span className="text-[11px] font-bold text-red-700 uppercase">Food Safety Flags</span>
                          <div className="text-lg font-bold text-red-700 mt-0.5 font-mono">
                            {feedbackData?.items.filter((f) => f.analysis?.food_safety_flag).length ?? 0}
                          </div>
                        </div>
                      </div>

                      {/* Recent Samples Stream */}
                      <div className="space-y-2 pt-1">
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                          Latest Submissions Stream:
                        </span>
                        {feedbackData && feedbackData.items.length > 0 ? (
                          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/40">
                            {feedbackData.items.slice(0, 4).map((f) => (
                              <div key={f.id} className="p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900">{f.item || 'General Feedback'}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                                      {f.meal_type || 'Unspecified'}
                                    </span>
                                    {f.analysis?.severity_score !== undefined && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                        Sev {f.analysis.severity_score}
                                      </span>
                                    )}
                                    {f.analysis?.food_safety_flag && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-red-100 text-red-800">
                                        Safety Hazard
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-slate-600 italic line-clamp-1 text-[11px]">
                                    "{f.comment}"
                                  </p>
                                </div>

                                <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-500">
                                  <span className="font-bold text-amber-600">★ {f.rating ?? 3}/5</span>
                                  <span className="capitalize">{f.channel || 'form'}</span>
                                  <span>{new Date(f.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
                            No records ingested yet. Use the Direct Entry, CSV Upload, or Synthetic Generator above to ingest diner reviews.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. FEEDBACK INTELLIGENCE: Dedicated Feedback Explorer */}
                {activeTab === 'explorer' && (
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
                    channelFilter={channelFilter}
                    setChannelFilter={setChannelFilter}
                    ratingFilter={ratingFilter}
                    setRatingFilter={setRatingFilter}
                    dateFromFilter={dateFromFilter}
                    setDateFromFilter={setDateFromFilter}
                    dateToFilter={dateToFilter}
                    setDateToFilter={setDateToFilter}
                    analysisStatusFilter={analysisStatusFilter}
                    setAnalysisStatusFilter={setAnalysisStatusFilter}
                    sourceDatasetFilter={sourceDatasetFilter}
                    setSourceDatasetFilter={setSourceDatasetFilter}
                    foodSafetyOnly={foodSafetyOnly}
                    setFoodSafetyOnly={setFoodSafetyOnly}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                  />
                )}

                {/* 2. FEEDBACK INTELLIGENCE: Feedback Lifecycle Flow & Tracker */}
                {activeTab === 'tracker' && (
                  <FeedbackFlowTrackerView
                    orgId={currentOrg?.id}
                    onNavigateToCapa={() => handleTabChange('capa')}
                    onNavigateToExplorer={() => handleTabChange('explorer')}
                  />
                )}

                {/* 3. ISSUE INTELLIGENCE: Topic Trends & Recurrence Risks */}
                {activeTab === 'recurrence' && (
                  <TopicTrendView
                    orgId={currentOrg?.id}
                    onNavigateToPriorities={() => handleTabChange('actions')}
                  />
                )}

                {/* 4. DECISION INTELLIGENCE: Prioritized Actions (Priority Queue) */}
                {activeTab === 'actions' && (
                  <PrioritizedIssuesView
                    orgId={currentOrg?.id}
                    onRefreshData={loadFeedback}
                  />
                )}

                {/* 4. DECISION INTELLIGENCE: CAPA Action Board (Tasks, Resolution & Verification) */}
                {activeTab === 'capa' && (
                  <PrioritizedActionBoard
                    orgId={currentOrg?.id}
                    onRefreshData={loadFeedback}
                  />
                )}

                {/* 5. CONFIGURATION: Data & Dataset Management */}
                {activeTab === 'datasets' && (
                  <DatasetManagementView
                    orgId={currentOrg?.id}
                    onRefreshData={loadFeedback}
                  />
                )}

                {/* 5. CONFIGURATION: Organization Settings */}
                {(activeTab === 'settings' || activeTab === 'tenants') && (
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

                {/* Technical System Architecture & Methodology Tab */}
                {activeTab === 'system' && (
                  <div className="space-y-6">
                    <HealthStatusCard
                      readiness={readiness}
                      isLoading={isHealthChecking}
                      onRefresh={handleRefreshHealth}
                    />

                    <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-4">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-blue-600" />
                        FeedbackIQ Architecture &amp; Methodology
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed font-normal">
                        FeedbackIQ operates on an unbending architectural principle:{' '}
                        <strong>
                          Calculated facts are computed deterministically with SQL and Python, while LLMs synthesize human-readable labels, causal hypotheses, and operational recommendations.
                        </strong>
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
                        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1.5">
                          <span className="font-bold text-blue-700 uppercase text-[11px] tracking-wide flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                            Deterministic Priority Engine
                          </span>
                          <p className="text-slate-600 font-normal leading-relaxed">
                            Priority = 0.50 × Severity + 0.30 × RecurrenceRisk + 0.20 × RecentFrequency.
                            All components are normalized strictly between 0 and 100 before weighting.
                          </p>
                        </div>
                        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1.5">
                          <span className="font-bold text-red-600 uppercase text-[11px] tracking-wide flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-red-600" />
                            Rule 9 Food-Safety Override
                          </span>
                          <p className="text-slate-600 font-normal leading-relaxed">
                            Critical food safety hazards (pests, foreign objects, illness, raw meat, chemical odor) trigger an independent safety floor (≥ 85.0) ensuring they are never deprioritized due to limited historical frequency.
                          </p>
                        </div>
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
