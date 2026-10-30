import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import App from '../App';

// Mock API client
vi.mock('../services/api', () => ({
  api: {
    getHealth: vi.fn().mockResolvedValue({
      status: 'healthy',
      app: 'FeedbackIQ',
      version: '0.1.0',
      environment: 'development',
      timestamp: new Date().toISOString(),
    }),
    getReadiness: vi.fn().mockResolvedValue({
      status: 'ready',
      app: 'FeedbackIQ',
      version: '0.1.0',
      environment: 'development',
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: 'healthy', connected: true, latency_ms: 12.5 },
        llm_engine: { provider: 'mock', model: 'gemini-1.5-flash', configured: true },
      },
    }),
    getTemplates: vi.fn().mockResolvedValue({
      college: {
        description: 'Higher Education Campus & Hostel Mess',
        meal_slots: ['Breakfast', 'Lunch', 'Evening Snacks', 'Dinner'],
        default_categories: ['Taste & Flavor', 'Hygiene', 'Temperature'],
        default_channels: ['student_form', 'complaint_box'],
        sla_resolution_hours: 24,
      },
    }),
    getOrganizations: vi.fn().mockResolvedValue([
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'St. Andrews Campus Mess',
        slug: 'st-andrews-mess',
        template_type: 'college',
        is_active: true,
        settings: {
          meal_slots: ['Breakfast', 'Lunch', 'Dinner'],
          default_categories: ['Taste & Flavor', 'Hygiene'],
          sla_resolution_hours: 24,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]),
    createOrganization: vi.fn(),
    getFeedback: vi.fn().mockResolvedValue({
      items: [
        {
          id: '22222222-2222-2222-2222-222222222222',
          feedback_id: 'FB-REC-1001',
          organization_id: '11111111-1111-1111-1111-111111111111',
          meal_type: 'Lunch',
          item: 'Sambar Rice',
          rating: 2,
          comment: 'Sambar was ice cold again today at Station B.',
          channel: 'student_form',
          issue_category: 'Temperature',
          source_dataset: 'synthetic_canteen',
          content_hash: 'samplehash123',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          analysis: {
            id: '33333333-3333-3333-3333-333333333333',
            feedback_id: '22222222-2222-2222-2222-222222222222',
            organization_id: '11111111-1111-1111-1111-111111111111',
            sentiment: 'negative',
            mentioned_food_items: ['Sambar Rice'],
            service_aspects: ['Temperature upkeep'],
            issue_categories: ['temperature'],
            severity_score: 3,
            evidence_quotes: ['Sambar was ice cold'],
            food_safety_flag: false,
            food_safety_reasons: [],
            language: 'en',
            uncertainty_score: 0.1,
            model_name: 'mock',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        },
      ],
      total: 1,
      page: 1,
      page_size: 15,
      total_pages: 1,
    }),
    uploadCSV: vi.fn(),
    generateSynthetic: vi.fn(),
    analyzeFeedback: vi.fn(),
    batchAnalyze: vi.fn(),
    getTrends: vi.fn().mockResolvedValue([
      {
        issue_cluster_key: 'Sambar Rice|temperature|Lunch',
        item: 'Sambar Rice',
        issue_category: 'temperature',
        meal_type: 'Lunch',
        topic_label: 'Sambar Rice (Lunch) — Temperature',
        topic_summary: 'Multiple reports indicating recurring temperature issues with Sambar Rice.',
        total_feedback_count: 5,
        complaint_count: 4,
        positive_count: 1,
        average_rating: 2.2,
        negative_feedback_proportion: 0.8,
        recent_complaints_count: 3,
        historical_complaints_count: 1,
        velocity_change_percent: 200.0,
        velocity_trend: 'increasing',
        time_patterns: ['Predominantly Lunch service (100% of reports)'],
        evidence_quotes: ['Sambar was ice cold again today'],
        has_food_safety_hazard: false,
        food_safety_reasons: [],
        average_severity: 3.0,
        max_severity: 3,
      },
    ]),
    assessRecurrence: vi.fn(),
    getPrioritizedIssues: vi.fn().mockResolvedValue([
      {
        id: '44444444-4444-4444-4444-444444444444',
        issue_cluster_key: 'Chicken Curry|hygiene|Dinner',
        item: 'Chicken Curry',
        issue_category: 'hygiene',
        meal_type: 'Dinner',
        priority_score: 87.5,
        severity_score_normalized: 100.0,
        recurrence_risk_normalized: 100.0,
        recent_frequency_normalized: 20.0,
        is_safety_override: true,
        risk_level: 'Critical',
        topic_label: 'Chicken Curry — Hygiene & Safety',
        issue_summary: 'CRITICAL SAFETY CONCERN: Urgent contamination reported in Chicken Curry.',
        supporting_evidence: ['Found a metal wire in the chicken curry!'],
        observed_patterns: ['1 complaint recorded during Dinner service'],
        hypotheses_causes: ['[HYPOTHESIS] Physical metal wire contaminant from kitchen scrubber'],
        recommended_actions: ['Immediately discard batch and inspect wire scrubbers'],
        confidence_explanation: 'High severity hazard requires immediate mitigation regardless of sample size',
        total_complaints_count: 1,
        recent_complaints_count: 1,
        historical_complaints_count: 0,
        velocity_change_percent: 100.0,
        time_patterns: [],
      },
    ]),
    getPriorityConfig: vi.fn().mockResolvedValue({
      w_severity: 0.50,
      w_recurrence_risk: 0.30,
      w_recent_frequency: 0.20,
      safety_override_floor: 85.0,
    }),
    updatePriorityConfig: vi.fn(),
  },
}));

describe('FeedbackIQ Application Shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders application branding and header elements', async () => {
    render(<App />);

    expect(screen.getByText('FeedbackIQ')).toBeInTheDocument();
    expect(screen.getByText('SaaS MVP')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('St. Andrews Campus Mess (college)')).toBeInTheDocument();
    });
  });

  it('displays readiness telemetry and database probe latency', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Core Engine Infrastructure')).toBeInTheDocument();
      expect(screen.getByText('PostgreSQL (AsyncPG)')).toBeInTheDocument();
      expect(screen.getByText('12.5 ms')).toBeInTheDocument();
    });
  });

  it('displays active tenant and template configuration', async () => {
    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByText('Tenant Slug: st-andrews-mess • UUID: 11111111-1111-1111-1111-111111111111')
      ).toBeInTheDocument();
      expect(screen.getByText('24 Hours')).toBeInTheDocument();
    });
  });

  it('navigates to Feedback Ingestion & AI Intelligence view', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('St. Andrews Campus Mess (college)')).toBeInTheDocument();
    });

    const feedbackTab = screen.getByText('Feedback Ingestion');
    fireEvent.click(feedbackTab);

    await waitFor(() => {
      expect(screen.getByText('Upload CSV Feedback')).toBeInTheDocument();
      expect(screen.getByText('Synthetic Scenario Generator')).toBeInTheDocument();
      expect(screen.getByText('Sambar Rice')).toBeInTheDocument();
      expect(screen.getByText('Sev 3')).toBeInTheDocument();
    });
  });

  it('navigates to Recurrence Risks and displays Topic Trends', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('St. Andrews Campus Mess (college)')).toBeInTheDocument();
    });

    const recurrenceTab = screen.getByText('Recurrence Risks');
    fireEvent.click(recurrenceTab);

    await waitFor(() => {
      expect(screen.getByText('Topic & Trend Intelligence Layer')).toBeInTheDocument();
      expect(screen.getByText('Sambar Rice (Lunch) — Temperature')).toBeInTheDocument();
      expect(screen.getByText(/Increasing/)).toBeInTheDocument();
      expect(screen.getByText('Run Recurrence Agent')).toBeInTheDocument();
    });
  });

  it('navigates to Prioritized Actions and displays Priority Engine items with Rule 9 override', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('St. Andrews Campus Mess (college)')).toBeInTheDocument();
    });

    const actionsTab = screen.getByText('Prioritized Actions');
    fireEvent.click(actionsTab);

    await waitFor(() => {
      expect(screen.getByText('Deterministic Priority Queue')).toBeInTheDocument();
      expect(screen.getByText('RULE 9 SAFETY OVERRIDE ACTIVE')).toBeInTheDocument();
      expect(screen.getByText('Chicken Curry — Hygiene & Safety')).toBeInTheDocument();
      expect(screen.getByText('[HYPOTHESIS]')).toBeInTheDocument();
      expect(screen.getByText('Configure Weights')).toBeInTheDocument();
    });
  });
});

