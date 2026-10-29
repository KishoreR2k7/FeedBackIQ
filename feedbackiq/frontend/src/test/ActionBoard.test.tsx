import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PrioritizedActionBoard } from '../components/PrioritizedActionBoard';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    getTasks: vi.fn(),
    generateTasks: vi.fn(),
    getTask: vi.fn(),
    approveTask: vi.fn(),
    assignTask: vi.fn(),
    updateTaskStatus: vi.fn(),
    verifyTask: vi.fn(),
    getNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
  },
}));

describe('PrioritizedActionBoard Component (Implementation 3)', () => {
  const mockOrgId = '11111111-1111-1111-1111-111111111111';

  const mockTasks = [
    {
      id: 'task-111',
      organization_id: mockOrgId,
      issue_cluster_key: 'Chicken Curry|hygiene|Dinner',
      item: 'Chicken Curry',
      issue_category: 'hygiene',
      meal_type: 'Dinner',
      priority_score: 92.5,
      risk_level: 'Critical',
      is_safety_override: true,
      issue_summary: 'Physical foreign object reported in Dinner Chicken Curry.',
      evidence_and_priority_reason: '1 severe report of metal scrubber fragment.',
      corrective_action: 'Immediately halt dinner service of batch CC-20261029 and inspect wire scrubbers.',
      preventive_action: 'Replace metal wire scrubbers with nylon pads across all dishwashing stations.',
      responsible_role: 'Food Safety Officer',
      assignee_id: undefined,
      assignee_name: undefined,
      due_date: new Date(Date.now() + 86400000).toISOString(),
      required_approval: 'Operations Manager',
      approval_status: 'awaiting_approval',
      status: 'awaiting_approval',
      estimated_effort: 'Medium',
      verification_criteria: 'Zero foreign object reports in subsequent 14 dinner services.',
      expected_outcome: 'Immediate elimination of physical contamination hazard.',
      completion_notes: undefined,
      verification_status: 'Pending',
      dedup_fingerprint: 'fingerprint123',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'task-222',
      organization_id: mockOrgId,
      issue_cluster_key: 'Sambar Rice|temperature|Lunch',
      item: 'Sambar Rice',
      issue_category: 'temperature',
      meal_type: 'Lunch',
      priority_score: 74.0,
      risk_level: 'High',
      is_safety_override: false,
      issue_summary: 'Recurring lukewarm sambar complaints during lunch peak.',
      evidence_and_priority_reason: '5 complaints across 3 consecutive days.',
      corrective_action: 'Recalibrate steam wells at Bain-Marie Counter 2.',
      preventive_action: 'Establish hourly temperature logging protocol for hot holding lines.',
      responsible_role: 'Head Chef',
      assignee_id: '00000000-0000-0000-0000-000000000001',
      assignee_name: 'Chef Ramesh',
      due_date: new Date(Date.now() + 86400000 * 3).toISOString(),
      required_approval: 'None',
      approval_status: 'approved',
      status: 'verified',
      estimated_effort: 'Low',
      verification_criteria: 'Maintain hot holding >= 65C across lunch services.',
      expected_outcome: 'Elimination of temperature deficit complaints.',
      completion_notes: 'Thermostat replaced and digital probe calibrated.',
      verification_status: 'Improved',
      verification_results: {
        task_id: 'task-222',
        verification_status: 'Improved',
        pre_action_complaints: 8,
        post_action_complaints: 1,
        complaint_change_percent: -87.5,
        pre_action_avg_rating: 2.1,
        post_action_avg_rating: 4.2,
        pre_window_days: 7,
        post_window_days: 7,
        non_causal_explanation:
          'Observed complaint reduction of 87.5% across 7 days. Correlation indicates improvement; operational confounding factors not excluded.',
      },
      dedup_fingerprint: 'fingerprint456',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockNotifications = [
    {
      id: 'notif-1',
      organization_id: mockOrgId,
      title: 'Critical Safety Hazard: Chicken Curry',
      message: 'Rule 9 safety review mandated immediately.',
      notification_type: 'critical_safety_alert',
      channel: 'in_app',
      is_read: false,
      delivery_status: 'delivered',
      retry_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (api.getTasks as any).mockResolvedValue(mockTasks);
    (api.getNotifications as any).mockResolvedValue(mockNotifications);
    (api.approveTask as any).mockResolvedValue({ ...mockTasks[0], status: 'assigned', approval_status: 'approved' });
    (api.verifyTask as any).mockResolvedValue(mockTasks[1].verification_results);
  });

  it('renders Action Board KPI cards, tasks and Rule 9 safety indicators', async () => {
    render(<PrioritizedActionBoard orgId={mockOrgId} />);

    await waitFor(() => {
      expect(screen.getByText('Prioritized Action Board & CAPA')).toBeInTheDocument();
      expect(screen.getByText('Chicken Curry')).toBeInTheDocument();
      expect(screen.getByText('Rule 9 Safety Floor')).toBeInTheDocument();
      expect(screen.getByText('Sambar Rice')).toBeInTheDocument();
    });

    // Check action suggestions
    expect(
      screen.getByText(/Immediately halt dinner service of batch CC-20261029/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Replace metal wire scrubbers with nylon pads/)
    ).toBeInTheDocument();
  });

  it('opens approval modal and allows manager to review and approve plan', async () => {
    render(<PrioritizedActionBoard orgId={mockOrgId} />);

    await waitFor(() => {
      expect(screen.getByText('Review & Approve')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Review & Approve'));

    await waitFor(() => {
      expect(screen.getByText('Manager Authorization & Assignment')).toBeInTheDocument();
      expect(screen.getByText('✓ Approve Action')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Confirm Decision'));

    await waitFor(() => {
      expect(api.approveTask).toHaveBeenCalledWith(
        'task-111',
        expect.objectContaining({ approved: true }),
        'org_admin',
        mockOrgId
      );
    });
  });

  it('displays closed-loop verification results and non-causal disclaimer', async () => {
    render(<PrioritizedActionBoard orgId={mockOrgId} />);

    await waitFor(() => {
      expect(screen.getByText('Improved')).toBeInTheDocument();
      expect(screen.getByText('Pre-Complaints:')).toBeInTheDocument();
      expect(screen.getByText('Post-Complaints:')).toBeInTheDocument();
      expect(screen.getByText('-87.5%')).toBeInTheDocument();
    });

    // Click "View Verification"
    const viewVerifyBtn = screen.getByText('View Verification');
    fireEvent.click(viewVerifyBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Before/After Statistical Outcome Verification')
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Observed complaint reduction of 87.5% across 7 days/)
      ).toBeInTheDocument();
    });
  });

  it('toggles alerts drawer and displays in-app notifications', async () => {
    render(<PrioritizedActionBoard orgId={mockOrgId} />);

    await waitFor(() => {
      expect(screen.getByText('Alerts')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Alerts'));

    await waitFor(() => {
      expect(screen.getByText('In-App Notifications & Delivery Telemetry')).toBeInTheDocument();
      expect(screen.getByText('Critical Safety Hazard: Chicken Curry')).toBeInTheDocument();
      expect(screen.getByText('Rule 9 safety review mandated immediately.')).toBeInTheDocument();
    });
  });
});
