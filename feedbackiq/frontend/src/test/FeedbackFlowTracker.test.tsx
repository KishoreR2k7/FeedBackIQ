import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { FeedbackFlowTrackerView } from '../components/FeedbackFlowTrackerView';

vi.mock('../services/api', () => ({
  api: {
    getFeedback: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'fb-101-test',
          organization_id: '11111111-1111-1111-1111-111111111111',
          item: 'Chole Bhature',
          rating: 1,
          meal_type: 'lunch',
          channel: 'student_form',
          comment: 'Chole was too salty and oil smelled stale at Counter 3',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          content_hash: 'hash1',
          analysis: {
            id: 'ana-101',
            feedback_id: 'fb-101-test',
            organization_id: '11111111-1111-1111-1111-111111111111',
            sentiment: 'negative',
            severity_score: 4,
            food_safety_flag: true,
            food_safety_reasons: ['Oil staleness'],
            mentioned_food_items: ['Chole Bhature', 'Chole'],
            service_aspects: ['Seasoning balance', 'Oil freshness'],
            issue_categories: ['taste', 'freshness'],
            evidence_quotes: ['too salty'],
            language: 'en',
            uncertainty_score: 0.1,
            model_name: 'mock',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        },
        {
          id: 'fb-102-test',
          organization_id: '11111111-1111-1111-1111-111111111111',
          item: 'Paneer Butter Masala',
          rating: 5,
          meal_type: 'dinner',
          channel: 'form',
          comment: 'Paneer was super soft and fresh tonight!',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          content_hash: 'hash2',
          analysis: {
            id: 'ana-102',
            feedback_id: 'fb-102-test',
            organization_id: '11111111-1111-1111-1111-111111111111',
            sentiment: 'positive',
            severity_score: 1,
            food_safety_flag: false,
            food_safety_reasons: [],
            mentioned_food_items: ['Paneer Butter Masala'],
            service_aspects: ['Flavor'],
            issue_categories: ['taste'],
            evidence_quotes: ['super soft'],
            language: 'en',
            uncertainty_score: 0.05,
            model_name: 'mock',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        },
      ],
      total: 2,
    }),
    getTasks: vi.fn().mockResolvedValue([
      {
        id: 'task-101-test',
        organization_id: '11111111-1111-1111-1111-111111111111',
        item: 'Chole Bhature',
        issue_category: 'freshness',
        meal_type: 'lunch',
        priority_score: 94.0,
        risk_level: 'High',
        is_safety_override: true,
        issue_summary: 'Cooking oil degradation in Counter 3 deep fryer',
        evidence_and_priority_reason: 'Multiple diners reported stale oil odor',
        corrective_action: 'Drain and refill fryer with fresh certified cooking oil',
        preventive_action: 'Mandatory daily oil titration checks',
        responsible_role: 'Kitchen Head Chef',
        assignee_name: 'Chef Rajesh Kumar',
        status: 'completed',
        verification_status: 'Improved',
        completion_notes: 'Fryer drained, sanitized, and refilled with fresh batch #4402.',
        approval_status: 'approved',
        dedup_fingerprint: 'fp101',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]),
  },
}));

describe('FeedbackFlowTrackerView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header, macro metrics, and 5-stage lifecycle flow nodes', async () => {
    render(
      <FeedbackFlowTrackerView orgId="11111111-1111-1111-1111-111111111111" />
    );

    await waitFor(() => {
      expect(screen.getByText('Feedback Lifecycle & Resolution Flow')).toBeInTheDocument();
      expect(screen.getByText('STEP 01')).toBeInTheDocument();
      expect(screen.getByText('STEP 02')).toBeInTheDocument();
      expect(screen.getByText('STEP 03')).toBeInTheDocument();
      expect(screen.getByText('STEP 04')).toBeInTheDocument();
      expect(screen.getByText('STEP 05')).toBeInTheDocument();
    });

    // Verify Prominent Solved status
    expect(screen.getByText('✓ SOLVED & VERIFIED')).toBeInTheDocument();
    expect(screen.getByText('Resolution Outcome')).toBeInTheDocument();
    expect(screen.getByText('Drain and refill fryer with fresh certified cooking oil')).toBeInTheDocument();
  });

  it('allows clicking another feedback row to switch tracked item', async () => {
    render(
      <FeedbackFlowTrackerView orgId="11111111-1111-1111-1111-111111111111" />
    );

    await waitFor(() => {
      expect(screen.getByText('Paneer Butter Masala')).toBeInTheDocument();
    });

    // Click on second feedback row
    fireEvent.click(screen.getByText('Paneer Butter Masala'));

    await waitFor(() => {
      expect(screen.getAllByText(/Paneer was super soft and fresh tonight!/i).length).toBeGreaterThan(0);
    });
  });
});
