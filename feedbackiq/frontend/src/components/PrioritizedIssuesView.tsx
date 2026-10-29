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
} from 'lucide-react';
import { api } from '../services/api';
import { PrioritizedIssueItem, PriorityConfig, RiskLevelType } from '../types';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';

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
  }, [orgId, categoryFilter, mealFilter, riskFilter]);

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
          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
            Critical Risk
          </span>
        );
      case 'High':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            High Risk
          </span>
        );
      case 'Medium':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-yellow-500/10 text-yellow-300 border border-yellow-500/30">
            Medium Risk
          </span>
        );
      case 'Low':
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
            Low Risk
          </span>
        );
      case 'Insufficient Evidence':
      default:
        return (
          <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
            Insufficient Evidence
          </span>
        );
    }
  };

  const weightsSum = (config.w_severity + config.w_recurrence_risk + config.w_recent_frequency).toFixed(2);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-rose-400" />
            <h2 className="text-base font-bold text-slate-100">
              Deterministic Priority Queue
            </h2>
            <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Rule 9 Safety Override
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Priority = 0.50 × Severity + 0.30 × RecurrenceRisk + 0.20 × RecentFrequency.
            Transparently distinguishes empirical observations from AI causal hypotheses.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsConfigOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            Configure Weights
          </button>

          <button
            onClick={handleRecalculateAll}
            disabled={isAssessing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
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
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-slate-900/30 border border-slate-800/60 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400 font-medium">
          <Filter className="w-3.5 h-3.5" />
          <span>Filters:</span>
        </div>

        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          aria-label="Filter by Risk Level"
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Categories</option>
          <option value="taste">Taste</option>
          <option value="temperature">Temperature</option>
          <option value="hygiene">Hygiene & Safety</option>
          <option value="freshness">Freshness</option>
          <option value="service">Service</option>
        </select>

        <select
          value={mealFilter}
          onChange={(e) => setMealFilter(e.target.value)}
          aria-label="Filter by Meal Type"
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              className={`p-6 rounded-2xl bg-slate-900/40 border transition-all ${
                issue.is_safety_override
                  ? 'border-rose-500/50 bg-rose-950/10 ring-1 ring-rose-500/30'
                  : 'border-slate-800/80 hover:border-slate-700'
              }`}
            >
              {/* Top Row: Title, Priority Score, Badges */}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-base font-bold text-slate-100">
                      {issue.topic_label}
                    </h3>
                    {getRiskBadge(issue.risk_level)}
                    {issue.is_safety_override && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-rose-600 text-white shadow-md shadow-rose-600/30 animate-pulse">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        RULE 9 SAFETY OVERRIDE ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-1.5 font-medium leading-relaxed">
                    {issue.issue_summary}
                  </p>
                </div>

                {/* Priority Score Gauge */}
                <div className="shrink-0 flex items-center gap-4 bg-slate-950/80 px-4 py-3 rounded-xl border border-slate-800/80">
                  <div className="text-right">
                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      Priority Score
                    </div>
                    <div className="text-2xl font-black text-rose-400 font-mono">
                      {issue.priority_score.toFixed(1)}
                      <span className="text-xs text-slate-500 font-normal"> / 100</span>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-full border-4 border-slate-800 flex items-center justify-center text-xs font-mono font-bold text-slate-200">
                    {Math.round(issue.priority_score)}%
                  </div>
                </div>
              </div>

              {/* Formula Subscores Breakdown */}
              <div className="mt-4 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                <div className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Deterministic Score Breakdown (0–100 Normalized):</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>Severity (×{config.w_severity.toFixed(2)}):</span>
                      <span className="font-mono font-bold text-slate-200">
                        {issue.severity_score_normalized.toFixed(1)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-rose-500 h-full rounded-full"
                        style={{ width: `${issue.severity_score_normalized}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>Recurrence Risk (×{config.w_recurrence_risk.toFixed(2)}):</span>
                      <span className="font-mono font-bold text-amber-300">
                        {issue.recurrence_risk_normalized.toFixed(1)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-400 h-full rounded-full"
                        style={{ width: `${issue.recurrence_risk_normalized}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>Recent Frequency (×{config.w_recent_frequency.toFixed(2)}):</span>
                      <span className="font-mono font-bold text-indigo-300">
                        {issue.recent_frequency_normalized.toFixed(1)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded-full"
                        style={{ width: `${issue.recent_frequency_normalized}%` }}
                      />
                    </div>
                  </div>
                </div>

                {issue.is_safety_override && (
                  <div className="mt-2 text-[11px] text-rose-300 bg-rose-500/10 px-2.5 py-1 rounded border border-rose-500/20">
                    Floor override enforced: Critical food safety hazard escalated to minimum priority {config.safety_override_floor}.0.
                  </div>
                )}
              </div>

              {/* Observed Facts vs AI Hypotheses Columns */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Column 1: Observed Facts & Evidence */}
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/60 space-y-2">
                  <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Verified Empirical Observations:</span>
                  </div>
                  <ul className="space-y-1 text-xs text-slate-300">
                    <li className="flex items-center gap-1.5 text-slate-400 font-mono">
                      <span>Total Complaints: {issue.total_complaints_count} (Recent: {issue.recent_complaints_count})</span>
                    </li>
                    {issue.observed_patterns.map((p, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{p}</span>
                      </li>
                    ))}
                    {issue.supporting_evidence.map((quote, idx) => (
                      <li key={idx} className="italic text-slate-400 bg-slate-900/60 px-2 py-1 rounded">
                        "{quote}"
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Column 2: Causal Hypotheses & Actions */}
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/60 space-y-2">
                  <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <HelpCircle className="w-4 h-4 text-indigo-400" />
                    <span>AI Causal Hypotheses &amp; Next Steps:</span>
                  </div>
                  <div className="space-y-2">
                    {issue.hypotheses_causes.map((cause, idx) => (
                      <div
                        key={idx}
                        className="text-xs bg-indigo-950/30 border border-indigo-500/20 p-2 rounded text-indigo-200"
                      >
                        <span className="font-semibold text-indigo-400 mr-1.5">[HYPOTHESIS]</span>
                        <span>{cause.replace('[HYPOTHESIS]', '').trim()}</span>
                      </div>
                    ))}

                    <div className="pt-2 border-t border-slate-800/60">
                      <div className="text-[11px] font-semibold text-slate-400 mb-1">
                        Recommended Operational Actions:
                      </div>
                      <ul className="space-y-1 text-xs text-slate-300">
                        {issue.recommended_actions.map((action, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-indigo-400 font-bold">&rarr;</span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer: Confidence Diagnostics */}
              <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-100">Configure Priority Engine Weights</h3>
              </div>
              <button
                onClick={() => setIsConfigOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="mt-4 space-y-4 text-xs">
              <p className="text-slate-400">
                Weights must sum to 1.00. Changes dynamically update all tenant priority scores.
              </p>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Severity Weight (Current: {config.w_severity.toFixed(2)})
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={config.w_severity}
                  onChange={(e) => setConfig({ ...config, w_severity: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Recurrence Risk Weight (Current: {config.w_recurrence_risk.toFixed(2)})
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={config.w_recurrence_risk}
                  onChange={(e) => setConfig({ ...config, w_recurrence_risk: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Recent Frequency Weight (Current: {config.w_recent_frequency.toFixed(2)})
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={config.w_recent_frequency}
                  onChange={(e) => setConfig({ ...config, w_recent_frequency: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Safety Override Floor (Min Score for Food Hazards)
                </label>
                <input
                  type="number"
                  step="1"
                  min="50"
                  max="100"
                  value={config.safety_override_floor}
                  onChange={(e) => setConfig({ ...config, safety_override_floor: parseFloat(e.target.value) || 85 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100"
                />
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex justify-between font-mono">
                <span>Total Weights Sum:</span>
                <span className={Math.abs(parseFloat(weightsSum) - 1.0) < 0.01 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {weightsSum} / 1.00
                </span>
              </div>

              {configSuccess && (
                <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                  {configSuccess}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={Math.abs(parseFloat(weightsSum) - 1.0) > 0.01}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-500 disabled:opacity-40"
                >
                  Save &amp; Recalculate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
