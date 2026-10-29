import {
  HealthResponse,
  ReadinessResponse,
  Organization,
  CreateOrganizationInput,
  OrgTemplateConfig,
  Feedback,
  PaginatedFeedback,
  FeedbackAnalysis,
  ImportJob,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || '';

class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`;
    try {
      const errData = await response.json();
      errorDetail = errData.detail || errorDetail;
    } catch {
      // Non-JSON response
    }
    throw new ApiError(errorDetail, response.status);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // System Health
  getHealth: (): Promise<HealthResponse> => fetchJson<HealthResponse>('/health'),
  getReadiness: (): Promise<ReadinessResponse> => fetchJson<ReadinessResponse>('/ready'),

  // Organizations
  getTemplates: (): Promise<Record<string, OrgTemplateConfig>> =>
    fetchJson<Record<string, OrgTemplateConfig>>('/api/v1/organizations/templates'),
  getOrganizations: (): Promise<Organization[]> =>
    fetchJson<Organization[]>('/api/v1/organizations'),
  createOrganization: (data: CreateOrganizationInput): Promise<Organization> =>
    fetchJson<Organization>('/api/v1/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Feedback & Ingestion
  getFeedback: (
    params: {
      page?: number;
      page_size?: number;
      meal_type?: string;
      item?: string;
      issue_category?: string;
      sentiment?: string;
      date_from?: string;
      date_to?: string;
      channel?: string;
      food_safety_only?: boolean;
    } = {},
    orgId?: string
  ): Promise<PaginatedFeedback> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.page_size) query.set('page_size', params.page_size.toString());
    if (params.meal_type) query.set('meal_type', params.meal_type);
    if (params.item) query.set('item', params.item);
    if (params.issue_category) query.set('issue_category', params.issue_category);
    if (params.sentiment) query.set('sentiment', params.sentiment);
    if (params.date_from) query.set('date_from', params.date_from);
    if (params.date_to) query.set('date_to', params.date_to);
    if (params.channel) query.set('channel', params.channel);
    if (params.food_safety_only) query.set('food_safety_only', 'true');

    const headers: Record<string, string> = {};
    if (orgId) headers['X-Organization-Id'] = orgId;

    return fetchJson<PaginatedFeedback>(`/api/v1/feedback?${query.toString()}`, { headers });
  },

  uploadCSV: (file: File, orgId?: string): Promise<{ import_job: ImportJob; message: string }> => {
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (orgId) headers['X-Organization-Id'] = orgId;

    return fetchJson<{ import_job: ImportJob; message: string }>('/api/v1/feedback/upload-csv', {
      method: 'POST',
      body: formData,
      headers,
    });
  },

  generateSynthetic: (
    count = 50,
    seedRecurring = true,
    orgId?: string
  ): Promise<{ generated_count: number; seeded_scenarios: string[]; sample_records: Feedback[] }> => {
    const headers: Record<string, string> = {};
    if (orgId) headers['X-Organization-Id'] = orgId;

    return fetchJson<{
      generated_count: number;
      seeded_scenarios: string[];
      sample_records: Feedback[];
    }>('/api/v1/feedback/generate-synthetic', {
      method: 'POST',
      body: JSON.stringify({ count, seed_recurring_issues: seedRecurring }),
      headers,
    });
  },

  analyzeFeedback: (feedbackId: string, orgId?: string): Promise<FeedbackAnalysis> => {
    const headers: Record<string, string> = {};
    if (orgId) headers['X-Organization-Id'] = orgId;

    return fetchJson<FeedbackAnalysis>(`/api/v1/feedback/${feedbackId}/analyze`, {
      method: 'POST',
      headers,
    });
  },

  batchAnalyze: (
    feedbackIds?: string[],
    limit = 20,
    orgId?: string
  ): Promise<{
    total_requested: number;
    successful_analyzed: number;
    failed_analyzed: number;
    safety_alerts_triggered: number;
    results: FeedbackAnalysis[];
  }> => {
    const headers: Record<string, string> = {};
    if (orgId) headers['X-Organization-Id'] = orgId;

    return fetchJson('/api/v1/feedback/batch-analyze', {
      method: 'POST',
      body: JSON.stringify({ feedback_ids: feedbackIds, limit }),
      headers,
    });
  },

  // Feedback Intelligence, Recurrence & Priority Engine (Phase 2)
  getTrends: (
    params: {
      location_id?: string;
      date_from?: string;
      date_to?: string;
      issue_category?: string;
      meal_type?: string;
      channel?: string;
      recent_days?: number;
    } = {},
    orgId?: string
  ): Promise<import('../types').TopicTrendSummary[]> => {
    const query = new URLSearchParams();
    if (params.location_id) query.set('location_id', params.location_id);
    if (params.date_from) query.set('date_from', params.date_from);
    if (params.date_to) query.set('date_to', params.date_to);
    if (params.issue_category) query.set('issue_category', params.issue_category);
    if (params.meal_type) query.set('meal_type', params.meal_type);
    if (params.channel) query.set('channel', params.channel);
    if (params.recent_days) query.set('recent_days', params.recent_days.toString());

    const headers: Record<string, string> = {};
    if (orgId) headers['X-Organization-Id'] = orgId;

    return fetchJson<import('../types').TopicTrendSummary[]>(`/api/v1/intelligence/trends?${query.toString()}`, { headers });
  },

  getTopicFeedback: (clusterKey: string, orgId?: string): Promise<Feedback[]> => {
    const headers: Record<string, string> = {};
    if (orgId) headers['X-Organization-Id'] = orgId;
    return fetchJson<Feedback[]>(`/api/v1/intelligence/topics/${encodeURIComponent(clusterKey)}/feedback`, { headers });
  },

  assessRecurrence: (
    params: {
      issue_cluster_key?: string;
      days_recent_window?: number;
      days_historical_window?: number;
    } = {},
    orgId?: string
  ): Promise<import('../types').PrioritizedIssueItem[]> => {
    const headers: Record<string, string> = {};
    if (orgId) headers['X-Organization-Id'] = orgId;

    return fetchJson<import('../types').PrioritizedIssueItem[]>('/api/v1/intelligence/assess-recurrence', {
      method: 'POST',
      body: JSON.stringify(params),
      headers,
    });
  },

  getPrioritizedIssues: (
    params: {
      category?: string;
      meal_type?: string;
      risk_level?: string;
      item?: string;
    } = {},
    orgId?: string
  ): Promise<import('../types').PrioritizedIssueItem[]> => {
    const query = new URLSearchParams();
    if (params.category) query.set('category', params.category);
    if (params.meal_type) query.set('meal_type', params.meal_type);
    if (params.risk_level) query.set('risk_level', params.risk_level);
    if (params.item) query.set('item', params.item);

    const headers: Record<string, string> = {};
    if (orgId) headers['X-Organization-Id'] = orgId;

    return fetchJson<import('../types').PrioritizedIssueItem[]>(
      `/api/v1/intelligence/prioritized-issues?${query.toString()}`,
      { headers }
    );
  },

  getPriorityConfig: (): Promise<import('../types').PriorityConfig> =>
    fetchJson<import('../types').PriorityConfig>('/api/v1/intelligence/priority-config'),

  updatePriorityConfig: (
    config: import('../types').PriorityConfig
  ): Promise<import('../types').PriorityConfig> =>
    fetchJson<import('../types').PriorityConfig>('/api/v1/intelligence/priority-config', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),

  // Tasks & Corrective Action Recommendations (Implementation 3)
  getTasks: (
    params: {
      status?: string;
      approval_status?: string;
      risk_level?: string;
      responsible_role?: string;
      assignee_id?: string;
      item?: string;
      issue_category?: string;
      date_from?: string;
      date_to?: string;
      limit?: number;
      offset?: number;
    } = {},
    orgId?: string
  ): Promise<import('../types').ActionTask[]> => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.approval_status) query.set('approval_status', params.approval_status);
    if (params.risk_level) query.set('risk_level', params.risk_level);
    if (params.responsible_role) query.set('responsible_role', params.responsible_role);
    if (params.assignee_id) query.set('assignee_id', params.assignee_id);
    if (params.item) query.set('item', params.item);
    if (params.issue_category) query.set('issue_category', params.issue_category);
    if (params.date_from) query.set('date_from', params.date_from);
    if (params.date_to) query.set('date_to', params.date_to);
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.offset) query.set('offset', params.offset.toString());

    const headers: Record<string, string> = {};
    if (orgId) headers['X-Organization-Id'] = orgId;

    return fetchJson<import('../types').ActionTask[]>(`/api/v1/tasks?${query.toString()}`, { headers });
  },

  generateTasks: (orgId?: string): Promise<import('../types').ActionTask[]> => {
    const headers: Record<string, string> = {};
    if (orgId) headers['X-Organization-Id'] = orgId;

    return fetchJson<import('../types').ActionTask[]>('/api/v1/tasks/generate', {
      method: 'POST',
      headers,
    });
  },

  getTask: (taskId: string, orgId?: string): Promise<import('../types').ActionTask> => {
    const headers: Record<string, string> = {};
    if (orgId) headers['X-Organization-Id'] = orgId;

    return fetchJson<import('../types').ActionTask>(`/api/v1/tasks/${taskId}`, { headers });
  },

  approveTask: (
    taskId: string,
    body: {
      approved: boolean;
      rejection_reason?: string;
      assignee_id?: string;
      assignee_name?: string;
      due_date?: string;
    },
    userRole = 'org_admin',
    orgId?: string
  ): Promise<import('../types').ActionTask> => {
    const headers: Record<string, string> = {
      'X-User-Role': userRole,
    };
    if (orgId) headers['X-Organization-Id'] = orgId;

    return fetchJson<import('../types').ActionTask>(`/api/v1/tasks/${taskId}/approve`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
    });
  },

  assignTask: (
    taskId: string,
    body: {
      assignee_id: string;
      assignee_name: string;
      due_date?: string;
    },
    userRole = 'org_admin',
    orgId?: string
  ): Promise<import('../types').ActionTask> => {
    const headers: Record<string, string> = {
      'X-User-Role': userRole,
    };
    if (orgId) headers['X-Organization-Id'] = orgId;

    return fetchJson<import('../types').ActionTask>(`/api/v1/tasks/${taskId}/assign`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
    });
  },

  updateTaskStatus: (
    taskId: string,
    body: {
      status: string;
      completion_notes?: string;
    },
    userRole = 'staff',
    orgId?: string
  ): Promise<import('../types').ActionTask> => {
    const headers: Record<string, string> = {
      'X-User-Role': userRole,
    };
    if (orgId) headers['X-Organization-Id'] = orgId;

    return fetchJson<import('../types').ActionTask>(`/api/v1/tasks/${taskId}/status`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
    });
  },

  verifyTask: (
    taskId: string,
    windowDays = 7,
    orgId?: string
  ): Promise<import('../types').VerificationResult> => {
    const headers: Record<string, string> = {};
    if (orgId) headers['X-Organization-Id'] = orgId;

    return fetchJson<import('../types').VerificationResult>(
      `/api/v1/tasks/${taskId}/verify?window_days=${windowDays}`,
      {
        method: 'POST',
        headers,
      }
    );
  },

  // In-App Notifications
  getNotifications: (
    params: {
      is_read?: boolean;
      limit?: number;
    } = {},
    orgId?: string
  ): Promise<import('../types').NotificationItem[]> => {
    const query = new URLSearchParams();
    if (params.is_read !== undefined) query.set('is_read', params.is_read.toString());
    if (params.limit) query.set('limit', params.limit.toString());

    const headers: Record<string, string> = {};
    if (orgId) headers['X-Organization-Id'] = orgId;

    return fetchJson<import('../types').NotificationItem[]>(`/api/v1/notifications?${query.toString()}`, {
      headers,
    });
  },

  markNotificationRead: (
    notificationId: string,
    orgId?: string
  ): Promise<{ status: string; message: string }> => {
    const headers: Record<string, string> = {};
    if (orgId) headers['X-Organization-Id'] = orgId;

    return fetchJson<{ status: string; message: string }>(
      `/api/v1/notifications/${notificationId}/read`,
      {
        method: 'POST',
        headers,
      }
    );
  },
};


