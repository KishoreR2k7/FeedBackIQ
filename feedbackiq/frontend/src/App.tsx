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

          {/* Primary Viewport Area (Full Width, Enterprise Density) */}
          <main className="flex-1 h-full overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 w-full">
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
                {/* 1. Executive Analytics & Telemetry Dashboard */}
                {activeTab === 'dashboard' && (
                  <AnalyticsOverviewView
                    orgId={currentOrg?.id}
                    onNavigateToRecurrence={() => setActiveTab('recurrence')}
                    onNavigateToActions={() => setActiveTab('actions')}
                    onNavigateToFeedback={() => setActiveTab('feedback')}
                  />
                )}

                {/* 2. Feedback Records Explorer */}
                {activeTab === 'feedback' && (
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
                    onNavigateToIngest={() => setActiveTab('ingestion')}
                  />
                )}

                {/* 3. Feedback Ingestion Hub */}
                {activeTab === 'ingestion' && (
                  <IngestionPanel
                    currentOrg={currentOrg}
                    onIngestionComplete={loadFeedback}
                    onNavigateToFeedback={() => setActiveTab('feedback')}
                    feedbackData={feedbackData}
                  />
                )}

                {/* 4. Recurrence Patterns & Risk Intelligence */}
                {activeTab === 'recurrence' && (
                  <TopicTrendView
                    orgId={currentOrg?.id}
                    onNavigateToPriorities={() => setActiveTab('actions')}
                  />
                )}

                {/* 5. Deterministic Prioritized Action Queue */}
                {activeTab === 'actions' && (
                  <PrioritizedIssuesView
                    orgId={currentOrg?.id}
                    onRefreshData={loadFeedback}
                  />
                )}

                {/* 6. CAPA Action Board & Statistical Verification */}
                {activeTab === 'capa' && (
                  <PrioritizedActionBoard
                    orgId={currentOrg?.id}
                    onRefreshData={loadFeedback}
                  />
                )}

                {/* 7. Tenant Settings & Department Routing Matrix */}
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
              </>
            )}
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default App;
