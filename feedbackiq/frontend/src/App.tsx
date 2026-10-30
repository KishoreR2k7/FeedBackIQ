import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LandingPage } from './components/LandingPage';
import { IngestionPanel } from './components/IngestionPanel';
import { FeedbackListView } from './components/FeedbackListView';
import { TopicTrendView } from './components/TopicTrendView';
import { PrioritizedIssuesView } from './components/PrioritizedIssuesView';
import { PrioritizedActionBoard } from './components/PrioritizedActionBoard';
import { TenantSelector } from './components/TenantSelector';
import { AnalyticsOverviewView } from './components/AnalyticsOverviewView';
import { FeedbackProgressView } from './components/FeedbackProgressView';
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
import { Cpu } from 'lucide-react';

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
  const [sourceDatasetFilter, setSourceDatasetFilter] = useState('');
  const [foodSafetyOnly, setFoodSafetyOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [isHealthChecking, setIsHealthChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
  }, [currentOrg, currentPage, mealTypeFilter, categoryFilter, sentimentFilter, sourceDatasetFilter, foodSafetyOnly, searchQuery]);

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

  // OUTER LEVEL: Public Standalone Landing Page (Modeled after feedback.tools, No Inner Sidebar)
  if (activeTab === 'overview') {
    return (
      <ErrorBoundary>
        <LandingPage
          onEnterWorkspace={(tab = 'dashboard') => setActiveTab(tab)}
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

  // INNER LEVEL: Modern Project Workspace with sleek Sidebar, Header, and dedicated Views
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
          onNavigateTab={setActiveTab}
          isMobileMenuOpen={isMobileMenuOpen}
          onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
        />

        {/* Workspace Layout Container */}
        <div className="flex-1 flex min-h-0 overflow-hidden relative">
          {/* Sleek Workspace Sidebar */}
          <Sidebar
            activeTab={activeTab}
            onSelectTab={(tab) => {
              setActiveTab(tab);
              setIsMobileMenuOpen(false);
            }}
            currentOrg={currentOrg}
            isMobileOpen={isMobileMenuOpen}
            onCloseMobile={() => setIsMobileMenuOpen(false)}
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
                {/* Executive Overview & Full Feedback Analytics */}
                {(activeTab === 'dashboard' || activeTab === 'analytics') && (
                  <AnalyticsOverviewView
                    orgId={currentOrg?.id}
                    onNavigateToRecurrence={() => setActiveTab('recurrence')}
                    onNavigateToActions={() => setActiveTab('actions')}
                    onNavigateToFeedback={() => setActiveTab('feedback')}
                    onNavigateToPipeline={() => setActiveTab('pipeline')}
                    onNavigateToIngest={() => setActiveTab('ingestion')}
                  />
                )}

                {/* Feedback Resolution Progress for Each Feedback */}
                {(activeTab === 'pipeline' || activeTab === 'progress') && (
                  <FeedbackProgressView
                    feedbackData={feedbackData}
                    isLoading={isLoadingFeedback}
                    onRefresh={loadFeedback}
                    onNavigateToActions={() => setActiveTab('actions')}
                  />
                )}

                {/* Direct Ingestion Hub */}
                {activeTab === 'ingestion' && (
                  <IngestionPanel
                    currentOrg={currentOrg}
                    onIngestionComplete={loadFeedback}
                    onNavigateToFeedback={() => setActiveTab('feedback')}
                  />
                )}

                {/* Feedback Ingestion & Feedback Explorer */}
                {activeTab === 'feedback' && (
                  <div className="space-y-6">
                    <IngestionPanel
                      currentOrg={currentOrg}
                      onIngestionComplete={loadFeedback}
                    />

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
                      sourceDatasetFilter={sourceDatasetFilter}
                      setSourceDatasetFilter={setSourceDatasetFilter}
                      foodSafetyOnly={foodSafetyOnly}
                      setFoodSafetyOnly={setFoodSafetyOnly}
                      searchQuery={searchQuery}
                      setSearchQuery={setSearchQuery}
                      currentPage={currentPage}
                      setCurrentPage={setCurrentPage}
                    />
                  </div>
                )}

                {/* Topic Trends & Recurrence Risks */}
                {activeTab === 'recurrence' && (
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

                {/* CAPA Action Board & Task Lifecycle Management */}
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

                {/* System Architecture & Methodology Tab */}
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
