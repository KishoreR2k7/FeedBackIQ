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
  safety_override_floor: number;
}

