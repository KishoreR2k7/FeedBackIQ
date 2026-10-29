import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  Clock,
  Quote,
  ShieldAlert,
  RefreshCw,
  Filter,
  Eye,
  X,
  Star,
} from 'lucide-react';
import { api } from '../services/api';
import { TopicTrendSummary, Feedback } from '../types';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';

interface TopicTrendViewProps {
  orgId?: string;
  onNavigateToPriorities?: () => void;
}

export const TopicTrendView: React.FC<TopicTrendViewProps> = ({
  orgId,
  onNavigateToPriorities,
}) => {
  const [trends, setTrends] = useState<TopicTrendSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAssessing, setIsAssessing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [mealFilter, setMealFilter] = useState('');
  const [recentDays, setRecentDays] = useState(7);
  const [assessmentSuccess, setAssessmentSuccess] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TopicTrendSummary | null>(null);
  const [supportingFeedbacks, setSupportingFeedbacks] = useState<Feedback[]>([]);
  const [isLoadingSupporting, setIsLoadingSupporting] = useState(false);

  const handleViewSupportingFeedback = async (topic: TopicTrendSummary) => {
    setSelectedTopic(topic);
    setIsLoadingSupporting(true);
    try {
      const data = await api.getTopicFeedback(topic.issue_cluster_key, orgId);
      setSupportingFeedbacks(data);
    } catch (err) {
      console.error('Failed to load supporting feedback:', err);
      setSupportingFeedbacks([]);
    } finally {
      setIsLoadingSupporting(false);
    }
  };

  const fetchTrends = async () => {
    if (!orgId) return;
    setIsLoading(true);
    try {
      const data = await api.getTrends(
        {
          issue_category: categoryFilter || undefined,
          meal_type: mealFilter || undefined,
          recent_days: recentDays,
        },
        orgId
      );
      setTrends(data);
    } catch (err: any) {
      console.error('Failed to load topic trends:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, [orgId, categoryFilter, mealFilter, recentDays]);

  const handleRunAssessment = async (clusterKey?: string) => {
    if (!orgId) return;
    setIsAssessing(true);
    setAssessmentSuccess(null);
    try {
      await api.assessRecurrence(
        {
          issue_cluster_key: clusterKey || undefined,
          days_recent_window: recentDays,
        },
        orgId
      );
      setAssessmentSuccess(
        clusterKey
          ? `Recurrence assessment generated for ${clusterKey}!`
          : 'Full recurrence assessment & priority scoring complete!'
      );
      if (onNavigateToPriorities) {
        setTimeout(() => onNavigateToPriorities(), 1200);
      }
    } catch (err: any) {
      console.error('Assessment failed:', err);
    } finally {
      setIsAssessing(false);
    }
  };

  const getVelocityBadge = (trend: TopicTrendSummary['velocity_trend'], percent?: number) => {
    switch (trend) {
      case 'increasing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <ArrowUpRight className="w-3.5 h-3.5" />
            Increasing {percent !== undefined ? `(+${percent}%)` : ''}
          </span>
        );
      case 'decreasing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <ArrowDownRight className="w-3.5 h-3.5" />
            Decreasing {percent !== undefined ? `(${percent}%)` : ''}
          </span>
        );
      case 'new':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30">
            <Flame className="w-3.5 h-3.5 text-purple-400" />
            New Outbreak
          </span>
        );
      case 'insufficient_data':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Minus className="w-3.5 h-3.5" />
            Small Sample (&lt; 3 records)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
            <Minus className="w-3.5 h-3.5" />
            Stable
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-slate-100">
              Topic & Trend Intelligence Layer
            </h2>
            <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Phase 2 SQL/Python Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Empirical aggregation by dish, category, and meal slots. Velocity analysis compares recent ({recentDays}d) vs historical complaint frequencies.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleRunAssessment()}
            disabled={isAssessing || trends.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
          >
            {isAssessing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Run Recurrence Agent
          </button>
        </div>
      </div>

      {assessmentSuccess && (
        <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span>{assessmentSuccess}</span>
          </div>
          {onNavigateToPriorities && (
            <button
              onClick={onNavigateToPriorities}
              className="underline font-semibold hover:text-indigo-200"
            >
              View Prioritized Issues &rarr;
            </button>
          )}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-slate-900/30 border border-slate-800/60 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400 font-medium">
          <Filter className="w-3.5 h-3.5" />
          <span>Filters:</span>
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by Issue Category"
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Issue Categories</option>
          <option value="taste">Taste & Flavor</option>
          <option value="temperature">Temperature</option>
          <option value="hygiene">Hygiene & Safety</option>
          <option value="freshness">Freshness & Spoilage</option>
          <option value="portion_size">Portion Size</option>
          <option value="service">Service & Waiting</option>
        </select>

        <select
          value={mealFilter}
          onChange={(e) => setMealFilter(e.target.value)}
          aria-label="Filter by Meal Shift"
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Meal Shifts</option>
          <option value="Breakfast">Breakfast</option>
          <option value="Lunch">Lunch</option>
          <option value="Dinner">Dinner</option>
          <option value="Snacks">Snacks</option>
        </select>

        <select
          value={recentDays}
          onChange={(e) => setRecentDays(Number(e.target.value))}
          aria-label="Select Recent Window in Days"
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value={3}>Recent Window: 3 Days</option>
          <option value={7}>Recent Window: 7 Days</option>
          <option value={14}>Recent Window: 14 Days</option>
          <option value={30}>Recent Window: 30 Days</option>
        </select>

        <span className="text-slate-500 ml-auto font-mono">
          {trends.length} active topic clusters
        </span>
      </div>

      {/* Main Cluster Cards Grid */}
      {isLoading ? (
        <LoadingState
          message="Calculating Topic Trends & Historical Velocity..."
          subtext="Executing deterministic SQL aggregations and time pattern analysis"
        />
      ) : trends.length === 0 ? (
        <EmptyState
          title="No Topic Clusters Detected"
          description="Ingest feedback or generate synthetic recurring scenarios in the Feedback tab to view topic intelligence."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {trends.map((cluster) => (
            <div
              key={cluster.issue_cluster_key}
              className={`p-5 rounded-2xl bg-slate-900/40 border transition-all hover:border-slate-700 ${
                cluster.has_food_safety_hazard
                  ? 'border-rose-500/40 ring-1 ring-rose-500/20'
                  : 'border-slate-800/80'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-100">
                      {cluster.topic_label}
                    </h3>
                    {cluster.has_food_safety_hazard && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
                        <ShieldAlert className="w-3 h-3" />
                        CRITICAL SAFETY
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {cluster.topic_summary}
                  </p>
                </div>
                {getVelocityBadge(cluster.velocity_trend, cluster.velocity_change_percent)}
              </div>

              {/* Factual Metrics Bar */}
              <div className="grid grid-cols-4 gap-2 my-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-center">
                <div>
                  <div className="text-[10px] font-medium text-slate-500 uppercase">Complaints</div>
                  <div className="text-sm font-bold text-rose-400 mt-0.5">
                    {cluster.complaint_count}
                    <span className="text-[10px] text-slate-500 font-normal"> / {cluster.total_feedback_count}</span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-medium text-slate-500 uppercase">Avg Rating</div>
                  <div className="text-sm font-bold text-amber-300 mt-0.5">
                    ★ {cluster.average_rating.toFixed(1)}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-medium text-slate-500 uppercase">Recent (7d)</div>
                  <div className="text-sm font-bold text-slate-200 mt-0.5">
                    {cluster.recent_complaints_count}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-medium text-slate-500 uppercase">Prior Window</div>
                  <div className="text-sm font-bold text-slate-400 mt-0.5">
                    {cluster.historical_complaints_count}
                  </div>
                </div>
              </div>

              {/* Temporal Patterns */}
              {cluster.time_patterns.length > 0 && (
                <div className="mb-3 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Observed Time Patterns:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {cluster.time_patterns.map((pattern, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                      >
                        {pattern}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Grounded Evidence Quotes */}
              {cluster.evidence_quotes.length > 0 && (
                <div className="space-y-1.5 pt-3 border-t border-slate-800/60">
                  <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                    <Quote className="w-3.5 h-3.5 text-slate-500" />
                    <span>Grounded Evidence:</span>
                  </div>
                  <div className="space-y-1">
                    {cluster.evidence_quotes.slice(0, 2).map((quote, idx) => (
                      <p
                        key={idx}
                        className="text-[11px] text-slate-300 italic bg-slate-950/40 px-2.5 py-1 rounded border border-slate-800/40 truncate"
                      >
                        "{quote}"
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Footer */}
              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                <button
                  onClick={() => handleViewSupportingFeedback(cluster)}
                  className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors bg-slate-800/80 hover:bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-700/60"
                >
                  <Eye className="w-3.5 h-3.5 text-indigo-400" />
                  Supporting Feedback ({cluster.total_feedback_count})
                </button>
                <button
                  onClick={() => handleRunAssessment(cluster.issue_cluster_key)}
                  disabled={isAssessing}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                >
                  Assess Recurrence &rarr;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Supporting Feedback Modal Dialog */}
      {selectedTopic && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl relative max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span>{selectedTopic.topic_label}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {selectedTopic.total_feedback_count} reports
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Empirical database records backing this common topic cluster.
                </p>
              </div>
              <button
                onClick={() => setSelectedTopic(null)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {isLoadingSupporting ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
                  Loading supporting feedback...
                </div>
              ) : supportingFeedbacks.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No individual feedback records retrieved for this cluster.
                </div>
              ) : (
                supportingFeedbacks.map((fb) => (
                  <div
                    key={fb.id}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-mono text-slate-400">
                        <span>{fb.date ? new Date(fb.date).toLocaleDateString() : 'N/A'}</span>
                        <span>•</span>
                        <span className="text-slate-300 font-semibold">{fb.meal_type || 'General'}</span>
                        <span>•</span>
                        <span>{fb.item || 'Food Item'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3 h-3 ${
                              fb.rating && s <= fb.rating
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed italic">
                      "{fb.comment || 'No text comment provided'}"
                    </p>
                    {fb.analysis && (
                      <div className="flex items-center gap-2 pt-1">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            fb.analysis.sentiment === 'positive'
                              ? 'bg-emerald-500/10 text-emerald-300'
                              : fb.analysis.sentiment === 'negative'
                              ? 'bg-red-500/10 text-red-300'
                              : 'bg-purple-500/10 text-purple-300'
                          }`}
                        >
                          {fb.analysis.sentiment}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Severity: Level {fb.analysis.severity_score}/5
                        </span>
                        {fb.analysis.food_safety_flag && (
                          <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-1.5 py-0.5 rounded">
                            Hazard Flagged
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedTopic(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
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
