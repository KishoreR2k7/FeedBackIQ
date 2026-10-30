export type OrgTemplateType = 'college' | 'restaurant' | 'corporate_cafeteria' | 'custom';

export interface HealthResponse {
  status: string;
  app: string;
  version: string;
  environment: string;
  timestamp: string;
}

export interface ReadinessResponse {
  status: 'ready' | 'not_ready';
  app: string;
  version: string;
  environment: string;
  timestamp: string;
  checks: {
    database: {
      status: string;
      connected: boolean;
      latency_ms?: number;
      error?: string;
    };
    llm_engine: {
      provider: string;
      model: string;
      configured: boolean;
    };
  };
}

export interface OrgTemplateConfig {
  description: string;
  meal_slots: string[];
  default_categories: string[];
  default_channels: string[];
  sla_resolution_hours: number;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  template_type: OrgTemplateType;
  is_active: boolean;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  template_type: OrgTemplateType;
  settings?: Record<string, any>;
}

export interface FeedbackAnalysis {
  id: string;
  feedback_id: string;
  organization_id: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed' | 'uncertain';
  mentioned_food_items: string[];
  service_aspects: string[];
  issue_categories: string[];
  severity_score: number;
  evidence_quotes: string[];
  food_safety_flag: boolean;
  food_safety_reasons: string[];
  language: string;
  uncertainty_score: number;
  model_name: string;
  created_at: string;
  updated_at: string;
}

export interface Feedback {
  id: string;
  feedback_id?: string;
  organization_id: string;
  location_id?: string;
  location?: string;
  is_synthetic?: boolean;
  date?: string;
  meal_type?: string;
  item?: string;
  rating?: number;
  comment?: string;
  channel?: string;
  issue_category?: string;
  source_dataset?: string;
  content_hash: string;
  created_at: string;
  updated_at: string;
  analysis?: FeedbackAnalysis;
}

export interface PaginatedFeedback {
  items: Feedback[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ImportJob {
  id: string;
  organization_id: string;
  source_name: string;
  filename: string;
  total_records: number;
  processed_records: number;
  successful_records: number;
  failed_records: number;
  duplicate_records: number;
  errors: Array<{ row: number; error: string }>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export type RiskLevelType = 'Critical' | 'High' | 'Medium' | 'Low' | 'Insufficient Evidence';
export type VelocityTrendType = 'increasing' | 'stable' | 'decreasing' | 'new' | 'insufficient_data';

export interface TopicTrendSummary {
  issue_cluster_key: string;
  item?: string;
  issue_category?: string;
  meal_type?: string;
  topic_label: string;
  topic_summary: string;
  total_feedback_count: number;
  complaint_count: number;
  positive_count: number;
  average_rating: number;
  negative_feedback_proportion: number;
  recent_complaints_count: number;
  historical_complaints_count: number;
  velocity_change_percent?: number;
  velocity_trend: VelocityTrendType;
  time_patterns: string[];
  evidence_quotes: string[];
  has_food_safety_hazard: boolean;
  food_safety_reasons: string[];
  average_severity: number;
  max_severity: number;
  supporting_feedback_ids?: string[];
  distinct_days_count?: number;
  days_since_last_occurrence?: number;
  last_occurred_at?: string;
  synthetic_records_count?: number;
  real_records_count?: number;
}

export interface PrioritizedIssueItem {
  id?: string;
  issue_cluster_key: string;
  item?: string;
  issue_category?: string;
  meal_type?: string;
  priority_score: number;
  severity_score_normalized: number;
  recurrence_risk_normalized: number;
  recent_frequency_normalized: number;
  is_safety_override: boolean;
  risk_level: RiskLevelType;
  topic_label: string;
  issue_summary: string;
  supporting_evidence: string[];
  observed_patterns: string[];
  hypotheses_causes: string[];
  recommended_actions: string[];
  confidence_explanation: string;
  total_complaints_count: number;
  recent_complaints_count: number;
  historical_complaints_count: number;
  velocity_change_percent?: number;
  time_patterns: string[];
  distinct_days_count?: number;
  days_since_last_occurrence?: number;
  last_occurred_at?: string;
  synthetic_records_count?: number;
  real_records_count?: number;
  execution_trace?: string[];
  created_at?: string;
}

export interface PriorityConfig {
  w_severity: number;
  w_recurrence_risk: number;
  w_recent_frequency: number;
  w_impact?: number;
  safety_override_floor: number;
}

export type TaskStatusType =
  | 'proposed'
  | 'awaiting_approval'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'verified'
  | 'rejected';

export type TaskApprovalStatusType = 'proposed' | 'awaiting_approval' | 'approved' | 'rejected';

export type VerificationOutcomeType =
  | 'Improved'
  | 'No Clear Improvement'
  | 'Worsened'
  | 'Insufficient Evidence'
  | 'Pending';

export interface VerificationResult {
  task_id: string;
  verification_status: VerificationOutcomeType;
  pre_action_complaints: number;
  post_action_complaints: number;
  complaint_change_percent?: number;
  pre_action_avg_rating?: number;
  post_action_avg_rating?: number;
  pre_window_days: number;
  post_window_days: number;
  non_causal_explanation: string;
}

export interface ActionTask {
  id: string;
  organization_id: string;
  issue_cluster_key: string;
  item?: string;
  issue_category?: string;
  meal_type?: string;
  priority_score: number;
  risk_level: RiskLevelType;
  is_safety_override: boolean;
  issue_summary: string;
  evidence_and_priority_reason: string;
  corrective_action: string;
  preventive_action: string;
  responsible_role: string;
  assignee_id?: string;
  assignee_name?: string;
  due_date?: string;
  required_approval: string;
  approval_status: TaskApprovalStatusType;
  status: TaskStatusType;
  estimated_effort: 'Low' | 'Medium' | 'High';
  verification_criteria: string;
  expected_outcome: string;
  completion_notes?: string;
  completed_at?: string;
  verified_at?: string;
  verification_status: VerificationOutcomeType;
  verification_results?: VerificationResult;
  dedup_fingerprint: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationItem {
  id: string;
  organization_id: string;
  user_id?: string;
  target_role?: string;
  title: string;
  message: string;
  notification_type:
    | 'task_assigned'
    | 'approval_required'
    | 'deadline_approaching'
    | 'deadline_missed'
    | 'critical_safety_alert'
    | 'investigation_required';
  task_id?: string;
  channel: string;
  is_read: boolean;
  delivery_status: 'pending' | 'delivered' | 'failed' | 'simulated';
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsOverview {
  total_feedback: number;
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  satisfaction_percentage: number;
  negative_percentage: number;
  average_rating: number;
  active_recurring_issues: number;
  critical_issues: number;
  pending_actions: number;
  student_canteen_count: number;
  synthetic_count: number;
  zomato_count: number;
}

export interface SentimentByMeal {
  meal_type: string;
  positive: number;
  negative: number;
  neutral: number;
  total: number;
  average_rating: number;
}

export interface SentimentTrend {
  date: string;
  positive: number;
  negative: number;
  neutral: number;
  total: number;
  average_rating: number;
}

export interface FoodItemStat {
  item: string;
  total_feedback: number;
  complaint_count: number;
  positive_count: number;
  average_rating: number;
  top_issue?: string;
}

export interface CommonComplaintStat {
  issue: string;
  category: string;
  count: number;
  sample_comment: string;
  severity: number;
}

export interface CategoryDistributionItem {
  category: string;
  count: number;
  percentage: number;
}

export interface ExtractedTopicItem {
  topic: string;
  item: string;
  category: string;
  meal_type?: string;
  count: number;
  average_rating: number;
  sentiment_ratio: number;
  sample_quotes: string[];
}

export interface AnalyticsReport {
  overview: AnalyticsOverview;
  sentiment_by_meal: SentimentByMeal[];
  sentiment_trend: SentimentTrend[];
  top_food_items: FoodItemStat[];
  top_complaints: CommonComplaintStat[];
  category_distribution: CategoryDistributionItem[];
  common_topics: ExtractedTopicItem[];
}

export interface RecurrencePrediction {
  issue_name: string;
  affected_food_item: string;
  meal_type?: string;
  number_of_occurrences: number;
  recent_frequency: number;
  historical_frequency: number;
  severity: number;
  recurrence_risk_score: number;
  risk_category: string;
  has_insufficient_evidence: boolean;
  supporting_evidence: string[];
  recommended_preventive_action: string;
}

