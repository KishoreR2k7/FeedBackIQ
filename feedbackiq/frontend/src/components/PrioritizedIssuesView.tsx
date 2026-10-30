import React, { useState, useEffect } from 'react';
import {
  AlertOctagon,
  ShieldAlert,
  Sliders,
  Sparkles,
  CheckCircle,
  HelpCircle,
  Filter,
  RefreshCw,
  Info,
  Search,
  Eye,
  X,
  GitBranch,
} from 'lucide-react';
import { api } from '../services/api';
import { PrioritizedIssueItem, PriorityConfig, RiskLevelType, Feedback } from '../types';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';
import { resolveDepartmentRouting } from '../utils/routing';

interface PrioritizedIssuesViewProps {
  orgId?: string;
  onRefreshData?: () => void;
}

export const PrioritizedIssuesView: React.FC<PrioritizedIssuesViewProps> = ({
  orgId,
}) => {
  const [issues, setIssues] = useState<PrioritizedIssueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAssessing, setIsAssessing] = useState(false);
  const [riskFilter, setRiskFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [mealFilter, setMealFilter] = useState<string>('');
  const [itemFilter, setItemFilter] = useState<string>('');

  // Evidence Inspection Modal State
  const [selectedEvidenceIssue, setSelectedEvidenceIssue] = useState<PrioritizedIssueItem | null>(null);
  const [evidenceFeedbacks, setEvidenceFeedbacks] = useState<Feedback[]>([]);
  const [isEvidenceLoading, setIsEvidenceLoading] = useState(false);
  const [evidenceModalTab, setEvidenceModalTab] = useState<'evidence' | 'hypotheses' | 'trace'>('evidence');

  // Priority Weights Config Modal
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [config, setConfig] = useState<PriorityConfig>({
    w_severity: 0.50,
    w_recurrence_risk: 0.30,
    w_recent_frequency: 0.20,
    safety_override_floor: 85.0,
  });
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);

  const fetchIssues = async () => {
    if (!orgId) return;
    setIsLoading(true);
    try {
      const data = await api.getPrioritizedIssues(
        {
          category: categoryFilter || undefined,
          meal_type: mealFilter || undefined,
          risk_level: riskFilter || undefined,
          item: itemFilter || undefined,
        },
        orgId
      );
      setIssues(data);
    } catch (err: any) {
      console.error('Failed to load prioritized issues:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInspectEvidence = async (issue: PrioritizedIssueItem) => {
    setSelectedEvidenceIssue(issue);
    setEvidenceFeedbacks([]);
    setIsEvidenceLoading(true);
    try {
      const records = await api.getTopicFeedback(issue.issue_cluster_key, orgId);
      setEvidenceFeedbacks(records);
    } catch (err) {
      console.error('Failed to load supporting feedback records:', err);
    } finally {
      setIsEvidenceLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const cfg = await api.getPriorityConfig();
      setConfig(cfg);
    } catch (err: any) {
      console.error('Failed to fetch priority config:', err);
    }
  };

  useEffect(() => {
    fetchIssues();
    fetchConfig();
  }, [orgId, categoryFilter, mealFilter, riskFilter, itemFilter]);

  const handleRecalculateAll = async () => {
    if (!orgId) return;
    setIsAssessing(true);
    try {
      const updated = await api.assessRecurrence({}, orgId);
      setIssues(updated);
    } catch (err: any) {
      console.error('Failed to recalculate priorities:', err);
    } finally {
      setIsAssessing(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSuccess(null);
    try {
      const updated = await api.updatePriorityConfig(config);
      setConfig(updated);
      setConfigSuccess('Priority weights updated successfully!');
      setTimeout(() => {
        setIsConfigOpen(false);
        setConfigSuccess(null);
        handleRecalculateAll();
      }, 1000);
    } catch (err: any) {
      alert(`Config error: ${err.message}`);
    }
  };

  const getRiskBadge = (risk: RiskLevelType) => {
    switch (risk) {
      case 'Critical':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Critical Risk
          </span>
        );
      case 'High':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            High Risk
          </span>
        );
      case 'Medium':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Medium Risk
          </span>
        );
      case 'Low':
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Low Risk
          </span>
        );
      case 'Insufficient Evidence':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            Insufficient Evidence
          </span>
        );
    }
  };

  const weightsSum = (config.w_severity + config.w_recurrence_risk + config.w_recent_frequency).toFixed(2);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Deterministic Priority Queue
            </h2>
            <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-blue-50 text-blue-700 border border-blue-200">
              Rule 9 Safety Override
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Priority = 0.50 × Severity + 0.30 × RecurrenceRisk + 0.20 × RecentFrequency.
            Transparently distinguishes empirical observations from AI causal hypotheses.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsConfigOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-blue-300 transition-all shadow-xs"
          >
            <Sliders className="w-3.5 h-3.5 text-blue-600" />
            Configure Weights
          </button>

          <button
            onClick={handleRecalculateAll}
            disabled={isAssessing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
          >
            {isAssessing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Re-assess All Clusters
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-white border border-slate-200 text-xs shadow-xs">
        <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
          <Filter className="w-3.5 h-3.5" />
          <span>Filters:</span>
        </div>

        {/* Item Search Input */}
        <div className="relative min-w-[160px]">
          <input
            type="text"
            placeholder="Filter by item..."
            value={itemFilter}
            onChange={(e) => setItemFilter(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-3 py-1.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 font-medium"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2.5" />
          {itemFilter && (
            <button
              onClick={() => setItemFilter('')}
              className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          aria-label="Filter by Risk Level"
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
        >
          <option value="">All Risk Levels</option>
          <option value="Critical">Critical Risk</option>
          <option value="High">High Risk</option>
          <option value="Medium">Medium Risk</option>
          <option value="Low">Low Risk</option>
          <option value="Insufficient Evidence">Insufficient Evidence</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by Category"
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
        >
          <option value="">All Categories</option>
          <option value="taste">Taste</option>
          <option value="temperature">Temperature</option>
          <option value="hygiene">Hygiene &amp; Safety</option>
          <option value="freshness">Freshness</option>
          <option value="service">Service</option>
        </select>

        <select
          value={mealFilter}
          onChange={(e) => setMealFilter(e.target.value)}
          aria-label="Filter by Meal Type"
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
        >
          <option value="">All Meal Types</option>
          <option value="Breakfast">Breakfast</option>
          <option value="Lunch">Lunch</option>
          <option value="Dinner">Dinner</option>
        </select>

        <span className="text-slate-500 ml-auto font-mono">
          {issues.length} prioritized issues
        </span>
      </div>

      {/* Prioritized Issues List */}
      {isLoading ? (
        <LoadingState
          message="Retrieving Recurrence Assessments & Priority Scores..."
          subtext="Ordering by deterministic priority formula with independent safety override verification"
        />
      ) : issues.length === 0 ? (
        <EmptyState
          title="No Prioritized Issues Available"
          description="Click 'Re-assess All Clusters' or ingest data to generate the intelligence layer."
        />
      ) : (
        <div className="space-y-4">
          {issues.map((issue) => (
            <div
              key={issue.id || issue.issue_cluster_key}
              className={`p-6 rounded-2xl bg-white border transition-all shadow-xs hover:shadow-md ${issue.is_safety_override
                  ? 'border-red-300 bg-red-50/20 ring-1 ring-red-300/40'
                  : 'border-slate-200 hover:border-blue-300'
                }`}
            >
              {/* Top Row: Title, Badges, Actions */}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-base font-bold text-slate-900">
                      {issue.topic_label}
                    </h3>
                    {getRiskBadge(issue.risk_level)}
                    {issue.is_safety_override && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-red-600 text-white shadow-md shadow-red-600/30 animate-pulse">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        RULE 9 SAFETY OVERRIDE ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    {issue.issue_summary}
                  </p>

                  {/* Empirical Evidence Badges */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono pt-1">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      📅 {issue.distinct_days_count ?? 1} distinct days
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      ⏱ {issue.days_since_last_occurrence !== undefined ? `${issue.days_since_last_occurrence}d ago` : 'Recent'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      🔬 {issue.real_records_count ?? 0} real / {issue.synthetic_records_count ?? 0} synthetic
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                      🏢 Dept: {resolveDepartmentRouting(issue.issue_category, issue.is_safety_override).department} ({resolveDepartmentRouting(issue.issue_category, issue.is_safety_override).role})
                    </span>
                  </div>
                </div>

                {/* Priority Score Gauge and Inspect Button */}
                <div className="shrink-0 flex items-center gap-3">
                  <button
                    onClick={() => handleInspectEvidence(issue)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all shadow-xs"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    <span>Inspect Evidence</span>
                  </button>

                  <div className="flex items-center gap-4 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        Priority Score
                      </div>
                      <div className="text-2xl font-bold text-blue-600 font-mono">
                        {issue.priority_score.toFixed(1)}
                        <span className="text-xs text-slate-400 font-normal"> / 100</span>
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-full border-4 border-blue-200 flex items-center justify-center text-xs font-mono font-bold text-slate-800 bg-white">
                      {Math.round(issue.priority_score)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Formula Subscores Breakdown */}
              <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-600" />
                  <span>Deterministic Score Breakdown (0–100 Normalized):</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <div className="flex justify-between text-slate-600 mb-1">
                      <span>Severity (×{config.w_severity.toFixed(2)}):</span>
                      <span className="font-mono font-bold text-slate-900">
                        {issue.severity_score_normalized.toFixed(1)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-red-500 h-full rounded-full"
                        style={{ width: `${issue.severity_score_normalized}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-600 mb-1">
                      <span>Recurrence Risk (×{config.w_recurrence_risk.toFixed(2)}):</span>
                      <span className="font-mono font-bold text-amber-600">
                        {issue.recurrence_risk_normalized.toFixed(1)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-400 h-full rounded-full"
                        style={{ width: `${issue.recurrence_risk_normalized}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-600 mb-1">
                      <span>Recent Frequency (×{config.w_recent_frequency.toFixed(2)}):</span>
                      <span className="font-mono font-bold text-blue-600">
                        {issue.recent_frequency_normalized.toFixed(1)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full"
                        style={{ width: `${issue.recent_frequency_normalized}%` }}
                      />
                    </div>
                  </div>
                </div>

                {issue.is_safety_override && (
                  <div className="mt-2 text-[11px] text-red-800 bg-red-100 px-2.5 py-1 rounded border border-red-200">
                    Floor override enforced: Critical food safety hazard escalated to minimum priority {config.safety_override_floor}.0.
                  </div>
                )}
              </div>

              {/* Observed Facts vs AI Hypotheses Columns */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Column 1: Observed Facts & Evidence */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Verified Empirical Observations:</span>
                  </div>
                  <ul className="space-y-1 text-xs text-slate-700">
                    <li className="flex items-center gap-1.5 text-slate-500 font-mono">
                      <span>Total Complaints: {issue.total_complaints_count} (Recent: {issue.recent_complaints_count})</span>
                    </li>
                    {issue.observed_patterns.map((p, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-600 font-bold">•</span>
                        <span>{p}</span>
                      </li>
                    ))}
                    {issue.supporting_evidence.map((quote, idx) => (
                      <li key={idx} className="italic text-slate-700 bg-white px-2 py-1 rounded border border-slate-200">
                        "{quote}"
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Column 2: Causal Hypotheses & Actions */}
                <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200 space-y-2">
                  <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5 uppercase tracking-wider">
                    <HelpCircle className="w-4 h-4 text-blue-600" />
                    <span>AI Causal Hypotheses &amp; Next Steps:</span>
                  </div>
                  <div className="space-y-2">
                    {issue.hypotheses_causes.map((cause, idx) => (
                      <div
                        key={idx}
                        className="text-xs bg-white border border-blue-200 p-2.5 rounded text-slate-800 shadow-2xs"
                      >
                        <span className="font-bold text-blue-700 mr-1.5">[HYPOTHESIS]</span>
                        <span>{cause.replace('[HYPOTHESIS]', '').trim()}</span>
                      </div>
                    ))}

                    <div className="pt-2 border-t border-blue-200">
                      <div className="text-[11px] font-semibold text-slate-700 mb-1">
                        Recommended Operational Actions:
                      </div>
                      <ul className="space-y-1 text-xs text-slate-600">
                        {issue.recommended_actions.map((action, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-blue-600 font-bold">&rarr;</span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer: Confidence Diagnostics */}
              <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                <span className="italic">{issue.confidence_explanation}</span>
                <span className="font-mono">
                  Cluster Key: {issue.issue_cluster_key}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Priority Scoring Config Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Configure Priority Engine Weights</h3>
              </div>
              <button
                onClick={() => setIsConfigOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="mt-4 space-y-4 text-xs">
              <p className="text-slate-600">
                Weights must sum to 1.00. Changes dynamically update all tenant priority scores.
              </p>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Severity Weight (Current: {config.w_severity.toFixed(2)})
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={config.w_severity}
                  onChange={(e) => setConfig({ ...config, w_severity: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Recurrence Risk Weight (Current: {config.w_recurrence_risk.toFixed(2)})
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={config.w_recurrence_risk}
                  onChange={(e) => setConfig({ ...config, w_recurrence_risk: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Recent Frequency Weight (Current: {config.w_recent_frequency.toFixed(2)})
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={config.w_recent_frequency}
                  onChange={(e) => setConfig({ ...config, w_recent_frequency: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Safety Override Floor (Min Score for Food Hazards)
                </label>
                <input
                  type="number"
                  step="1"
                  min="50"
                  max="100"
                  value={config.safety_override_floor}
                  onChange={(e) => setConfig({ ...config, safety_override_floor: parseFloat(e.target.value) || 85 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-2.5 rounded bg-slate-50 border border-slate-200 flex justify-between font-mono">
                <span className="text-slate-600">Total Weights Sum:</span>
                <span className={Math.abs(parseFloat(weightsSum) - 1.0) < 0.01 ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                  {weightsSum} / 1.00
                </span>
              </div>

              {configSuccess && (
                <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
                  {configSuccess}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={Math.abs(parseFloat(weightsSum) - 1.0) > 0.01}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-40 transition-all shadow-xs"
                >
                  Save &amp; Recalculate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Evidence & Recurrence Trace Modal */}
      {selectedEvidenceIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedEvidenceIssue.topic_label}
                  </h3>
                  {getRiskBadge(selectedEvidenceIssue.risk_level)}
                  {selectedEvidenceIssue.is_safety_override && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-red-600 text-white shadow-md shadow-red-600/30">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      RULE 9 SAFETY OVERRIDE ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-1 font-medium">
                  {selectedEvidenceIssue.issue_summary}
                </p>
              </div>

              <button
                onClick={() => setSelectedEvidenceIssue(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Evidence Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-white border-b border-slate-200 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Complaints</span>
                <span className="text-base font-bold text-blue-600 font-mono">
                  {selectedEvidenceIssue.total_complaints_count}
                </span>
                <span className="text-[10px] text-slate-500 ml-1">({selectedEvidenceIssue.recent_complaints_count} recent)</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Distinct Days</span>
                <span className="text-base font-bold text-blue-600 font-mono">
                  {selectedEvidenceIssue.distinct_days_count ?? 1}
                </span>
                <span className="text-[10px] text-slate-500 ml-1">days</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Days Since Last</span>
                <span className="text-base font-bold text-amber-600 font-mono">
                  {selectedEvidenceIssue.days_since_last_occurrence !== undefined ? `${selectedEvidenceIssue.days_since_last_occurrence}d` : '0d'}
                </span>
                <span className="text-[10px] text-slate-500 ml-1">ago</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Record Types</span>
                <span className="text-xs font-bold text-slate-800 block mt-1">
                  {selectedEvidenceIssue.real_records_count ?? 0} Real
                </span>
                <span className="text-[10px] text-slate-500">
                  {selectedEvidenceIssue.synthetic_records_count ?? 0} Synthetic
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Priority Score</span>
                <span className="text-base font-bold text-blue-600 font-mono">
                  {selectedEvidenceIssue.priority_score.toFixed(1)}
                </span>
                <span className="text-[10px] text-slate-500 ml-1">/ 100</span>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50/50 px-4 text-xs font-semibold">
              <button
                onClick={() => setEvidenceModalTab('evidence')}
                className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${evidenceModalTab === 'evidence'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Supporting Complaints ({evidenceFeedbacks.length})
              </button>
              <button
                onClick={() => setEvidenceModalTab('hypotheses')}
                className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${evidenceModalTab === 'hypotheses'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                AI Hypotheses &amp; Reasoning
              </button>
              <button
                onClick={() => setEvidenceModalTab('trace')}
                className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${evidenceModalTab === 'trace'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                LangGraph Workflow Trace
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {evidenceModalTab === 'evidence' && (
                <div>
                  {isEvidenceLoading ? (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                      Loading supporting feedback records from database...
                    </div>
                  ) : evidenceFeedbacks.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 text-xs">
                      No specific feedback records matched this cluster key directly.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {evidenceFeedbacks.map((fb) => (
                        <div
                          key={fb.id}
                          className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-300 text-xs space-y-2 transition-all"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-slate-600">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-amber-600 font-mono">★ {fb.rating}/5</span>
                              <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] text-slate-700 font-medium">
                                {fb.meal_type || 'Unspecified Meal'}
                              </span>
                              <span className="text-[11px] text-slate-600">
                                {fb.location || fb.location_id || 'All Locations'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 font-mono text-[10px]">
                              {(fb.is_synthetic || fb.source_dataset?.includes('synthetic')) ? (
                                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                                  Synthetic Test
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                                  Real Feedback
                                </span>
                              )}
                              <span>{new Date(fb.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <p className="text-slate-800 leading-relaxed italic bg-white p-2.5 rounded-lg border border-slate-200">
                            "{fb.comment}"
                          </p>
                          {fb.analysis && (
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                              <span className="font-semibold text-slate-700">Analysis:</span>
                              <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                                {fb.analysis.sentiment}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-mono">
                                Severity: {fb.analysis.severity_score}/5
                              </span>
                              {fb.analysis.food_safety_flag && (
                                <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-bold">
                                  Food Safety Hazard
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {evidenceModalTab === 'hypotheses' && (
                <div className="space-y-4">
                  {/* Empirical Observations */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      Empirically Verified Observations
                    </h4>
                    <ul className="space-y-1.5 text-xs text-slate-700">
                      {selectedEvidenceIssue.observed_patterns.map((p, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-emerald-600 font-bold">•</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Causal Hypotheses */}
                  <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-blue-600" />
                        AI Root-Cause Hypotheses
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono font-medium">
                        Requires Investigation
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mb-3">
                      Note: These are AI-generated working hypotheses based on recurrence signals, not confirmed causal conclusions.
                    </p>
                    <div className="space-y-2">
                      {selectedEvidenceIssue.hypotheses_causes.map((c, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-white border border-blue-200 text-xs text-slate-800 flex items-start gap-2 shadow-2xs"
                        >
                          <span className="font-bold text-blue-600 shrink-0">[HYPOTHESIS]</span>
                          <span>{c.replace('[HYPOTHESIS]', '').trim()}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommended Actions */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                      Recommended Operational Steps
                    </h4>
                    <ul className="space-y-1.5 text-xs text-slate-700">
                      {selectedEvidenceIssue.recommended_actions.map((act, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold">&rarr;</span>
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Uncertainty & Diagnostics */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                    <div className="font-semibold text-slate-800 mb-1">Uncertainty Assessment:</div>
                    <p className="italic">{selectedEvidenceIssue.confidence_explanation}</p>
                  </div>
                </div>
              )}

              {evidenceModalTab === 'trace' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                    <span>LangGraph StateGraph Workflow: 5 Synchronous Functional Steps</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono font-semibold text-[11px] border border-emerald-200">
                      Workflow Completed
                    </span>
                  </div>

                  <div className="space-y-2">
                    {(selectedEvidenceIssue.execution_trace && selectedEvidenceIssue.execution_trace.length > 0
                      ? selectedEvidenceIssue.execution_trace
                      : [
                        '1. retrieve_evidence: Aggregated SQL complaint metrics, velocity window, distinct days count, and synthetic record split.',
                        '2. reason_recurrence: LLM reasoning prompt evaluated recurrence risk and labeled hypotheses.',
                        '3. safety_override: Deterministic Rule 9 validator verified critical food hazards.',
                        '4. priority_scoring: Deterministic formula applied weights w_severity, w_recurrence_risk, w_recent_frequency.',
                        '5. persist_assessment: Committed recurrence assessment and prioritized issue record into PostgreSQL.'
                      ]
                    ).map((traceStep, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs text-slate-700 flex items-start gap-2.5"
                      >
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold text-[10px] border border-blue-200">
                          STEP {idx + 1}
                        </span>
                        <span className="leading-relaxed">{traceStep}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                Cluster: {selectedEvidenceIssue.issue_cluster_key}
              </span>
              <button
                onClick={() => setSelectedEvidenceIssue(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
