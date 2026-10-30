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
      console.error('Recurrence assessment failed:', err);
    } finally {
      setIsAssessing(false);
    }
  };

  const getVelocityBadge = (velocity: string, percent?: number) => {
    switch (velocity) {
      case 'increasing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <ArrowUpRight className="w-3.5 h-3.5" />
            Increasing {percent !== undefined ? `(+${percent}%)` : ''}
          </span>
        );
      case 'decreasing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ArrowDownRight className="w-3.5 h-3.5" />
            Decreasing {percent !== undefined ? `(${percent}%)` : ''}
          </span>
        );
      case 'new':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Flame className="w-3.5 h-3.5 text-purple-600" />
            New Outbreak
          </span>
        );
      case 'insufficient_data':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Minus className="w-3.5 h-3.5" />
            Small Sample (&lt; 3 records)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <Minus className="w-3.5 h-3.5" />
            Stable
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Topic &amp; Trend Intelligence Layer
            </h2>
            <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-blue-50 text-blue-700 border border-blue-200">
              Recurrence Prediction
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Empirical aggregation by dish, category, and meal slots. Velocity analysis compares recent ({recentDays}d) vs historical complaint frequencies.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleRunAssessment()}
            disabled={isAssessing || trends.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
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
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2 font-medium">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>{assessmentSuccess}</span>
          </div>
          {onNavigateToPriorities && (
            <button
              onClick={onNavigateToPriorities}
              className="underline font-bold text-blue-700 hover:text-blue-800"
            >
              View Prioritized Issues &rarr;
            </button>
          )}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-white border border-slate-200 text-xs shadow-xs">
        <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
          <Filter className="w-3.5 h-3.5" />
          <span>Filters:</span>
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by Issue Category"
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
        >
          <option value="">All Issue Categories</option>
          <option value="taste">Taste &amp; Flavor</option>
          <option value="temperature">Temperature</option>
          <option value="hygiene">Hygiene &amp; Safety</option>
          <option value="freshness">Freshness &amp; Spoilage</option>
          <option value="portion_size">Portion Size</option>
          <option value="service">Service &amp; Waiting</option>
        </select>

        <select
          value={mealFilter}
          onChange={(e) => setMealFilter(e.target.value)}
          aria-label="Filter by Meal Type"
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
        >
          <option value="">All Meal Slots</option>
          <option value="Breakfast">Breakfast</option>
          <option value="Lunch">Lunch</option>
          <option value="Evening Snacks">Evening Snacks</option>
          <option value="Dinner">Dinner</option>
        </select>

        <div className="flex items-center gap-2 ml-auto text-slate-500 font-medium">
          <span>Recent Velocity Window:</span>
          <select
            value={recentDays}
            onChange={(e) => setRecentDays(Number(e.target.value))}
            aria-label="Select Window Duration"
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 font-bold focus:outline-none cursor-pointer"
          >
            <option value={3}>Last 3 Days</option>
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Grid of Topic Clusters */}
      {isLoading ? (
        <LoadingState message="Aggregating topic trends and calculating velocity metrics..." />
      ) : trends.length === 0 ? (
        <EmptyState
          title="No Common Topic Trends Found"
          description="Either no complaints have been ingested yet, or the current category filter returned zero matches. Use the Ingestion tab to add feedback."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {trends.map((cluster) => (
            <div
              key={cluster.issue_cluster_key}
              className={`rounded-2xl bg-white border p-5 transition-all shadow-xs hover:shadow-md ${
                cluster.has_food_safety_hazard
                  ? 'border-red-300 ring-1 ring-red-300/40'
                  : 'border-slate-200 hover:border-blue-300'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      {cluster.topic_label}
                    </h3>
                    {cluster.has_food_safety_hazard && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-300 animate-pulse">
                        <ShieldAlert className="w-3 h-3 text-red-600" />
                        CRITICAL SAFETY
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {cluster.topic_summary}
                  </p>
                </div>
                {getVelocityBadge(cluster.velocity_trend, cluster.velocity_change_percent)}
              </div>

              {/* Factual Metrics Bar */}
              <div className="grid grid-cols-4 gap-2 my-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Complaints</div>
                  <div className="text-sm font-bold text-red-600 mt-0.5">
                    {cluster.complaint_count}
                    <span className="text-[10px] text-slate-400 font-normal"> / {cluster.total_feedback_count}</span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Avg Rating</div>
                  <div className="text-sm font-bold text-amber-500 mt-0.5">
                    ★ {cluster.average_rating.toFixed(1)}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Recent ({recentDays}d)</div>
                  <div className="text-sm font-bold text-blue-600 mt-0.5">
                    {cluster.recent_complaints_count}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Prior Window</div>
                  <div className="text-sm font-bold text-slate-600 mt-0.5">
                    {cluster.historical_complaints_count}
                  </div>
                </div>
              </div>

              {/* Temporal Patterns */}
              {cluster.time_patterns.length > 0 && (
                <div className="mb-3 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>Observed Time Patterns:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {cluster.time_patterns.map((pattern, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200"
                      >
                        {pattern}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Grounded Evidence Quotes */}
              {cluster.evidence_quotes.length > 0 && (
                <div className="space-y-1.5 pt-3 border-t border-slate-100">
                  <div className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                    <Quote className="w-3.5 h-3.5 text-slate-400" />
                    <span>Grounded Evidence:</span>
                  </div>
                  <div className="space-y-1">
                    {cluster.evidence_quotes.slice(0, 2).map((quote, idx) => (
                      <p
                        key={idx}
                        className="text-[11px] text-slate-700 italic bg-slate-50 px-2.5 py-1 rounded border border-slate-200 truncate"
                      >
                        "{quote}"
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => handleViewSupportingFeedback(cluster)}
                  className="text-xs font-semibold text-slate-700 hover:text-blue-700 flex items-center gap-1.5 transition-colors bg-slate-50 hover:bg-blue-50 px-2.5 py-1 rounded-lg border border-slate-200 hover:border-blue-200"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  Supporting Feedback ({cluster.total_feedback_count})
                </button>
                <button
                  onClick={() => handleRunAssessment(cluster.issue_cluster_key)}
                  disabled={isAssessing}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl relative max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>{selectedTopic.topic_label}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                    {selectedTopic.total_feedback_count} reports
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Empirical database records backing this common topic cluster.
                </p>
              </div>
              <button
                onClick={() => setSelectedTopic(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {isLoadingSupporting ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                  Loading supporting records...
                </div>
              ) : supportingFeedbacks.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No direct feedback items retrieved for this cluster.
                </div>
              ) : (
                supportingFeedbacks.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-900">{item.item}</span>
                      <span>{item.date ? new Date(item.date).toLocaleDateString() : 'N/A'} • {item.meal_type || 'General'}</span>
                    </div>
                    <p className="text-slate-800 font-medium">"{item.comment}"</p>
                    {item.rating && (
                      <div className="flex items-center gap-0.5 text-amber-500 text-xs">
                        {Array.from({ length: item.rating }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-amber-400" />
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedTopic(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
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
