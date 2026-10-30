import React, { useState, useEffect, useCallback } from 'react';
import {
  BrainCircuit,
  ShieldAlert,
  RefreshCw,
  Search,
  Star,
  AlertTriangle,
  Layers,
  Utensils,
  GraduationCap,
  Sparkles,
  ArrowUpRight,
  Quote,
} from 'lucide-react';
import { api } from '../services/api';
import { AnalyticsReport } from '../types';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';

interface AnalyticsOverviewViewProps {
  orgId?: string;
  onNavigateToRecurrence?: () => void;
  onNavigateToActions?: () => void;
  onNavigateToFeedback?: () => void;
}

export const AnalyticsOverviewView: React.FC<AnalyticsOverviewViewProps> = ({
  orgId,
  onNavigateToRecurrence,
  onNavigateToActions,
  onNavigateToFeedback,
}) => {
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [mealType, setMealType] = useState<string>('');
  const [issueCategory, setIssueCategory] = useState<string>('');
  const [sentiment, setSentiment] = useState<string>('');
  const [searchItem, setSearchItem] = useState<string>('');
  const [sourceDataset, setSourceDataset] = useState<string>('');

  const fetchReport = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getAnalyticsReport(
        {
          meal_type: mealType || undefined,
          issue_category: issueCategory || undefined,
          sentiment: sentiment || undefined,
          item: searchItem || undefined,
          source_dataset: sourceDataset || undefined,
        },
        orgId
      );
      setReport(data);
    } catch (err: any) {
      console.error('Failed to load analytics report:', err);
      setError(err.message || 'Error fetching analytics intelligence');
    } finally {
      setIsLoading(false);
    }
  }, [orgId, mealType, issueCategory, sentiment, searchItem, sourceDataset]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const overview = report?.overview;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Food Feedback Analytics &amp; Decision Intelligence
            </h2>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200 font-mono">
              PS 2.5 Executive
            </span>
          </div>
          <p className="text-xs text-slate-600 max-w-2xl font-medium">
            Continuous AI analysis of student canteen feedback, statistical recurrence risk prediction, and prioritized corrective action intelligence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchReport}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>

      {/* Dataset Discrimination Transparency Banner */}
      <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="font-bold text-slate-900">
              Data Provenance &amp; Dataset Partitioning:
            </span>
            <span className="text-slate-600 font-medium">
              Real student canteen feedback is strictly segregated from external restaurant benchmarks.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5" />
              Student Canteen: {overview?.student_canteen_count ?? 0}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 border border-blue-300 font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Synthetic Scenarios: {overview?.synthetic_count ?? 0}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-800 border border-purple-300 font-semibold flex items-center gap-1">
              <Utensils className="w-3.5 h-3.5" />
              Kaggle Zomato: {overview?.zomato_count ?? 0}
            </span>
            {onNavigateToFeedback && (
              <button
                onClick={onNavigateToFeedback}
                className="px-2 py-1 rounded-lg text-blue-600 hover:text-blue-800 font-bold hover:underline"
              >
                Explorer &rarr;
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Dish Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by food item (e.g. Rice, Dal)..."
              value={searchItem}
              onChange={(e) => setSearchItem(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={mealType}
              onChange={(e) => setMealType(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Meal Slots</option>
              <option value="Breakfast">Breakfast</option>
              <option value="Lunch">Lunch</option>
              <option value="Evening Snacks">Evening Snacks</option>
              <option value="Dinner">Dinner</option>
            </select>

            <select
              value={issueCategory}
              onChange={(e) => setIssueCategory(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Issue Categories</option>
              <option value="Food Temperature">Food Temperature</option>
              <option value="Taste & Flavor">Taste &amp; Flavor</option>
              <option value="Hygiene & Cleanliness">Hygiene &amp; Cleanliness</option>
              <option value="Food Freshness & Spoilage">Freshness &amp; Spoilage</option>
              <option value="Portion & Quantity">Portion &amp; Quantity</option>
              <option value="Serving Delay">Serving Delay</option>
              <option value="Staff Behavior">Staff Behavior</option>
            </select>

            <select
              value={sentiment}
              onChange={(e) => setSentiment(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Sentiments</option>
              <option value="positive">Positive</option>
              <option value="negative">Negative</option>
              <option value="neutral">Neutral</option>
            </select>

            <select
              value={sourceDataset}
              onChange={(e) => setSourceDataset(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Data Sources</option>
              <option value="canteen">Student Canteen Only</option>
              <option value="synthetic">Synthetic Scenarios Only</option>
              <option value="zomato">Kaggle Benchmark Only</option>
            </select>

            {(mealType || issueCategory || sentiment || searchItem || sourceDataset) && (
              <button
                onClick={() => {
                  setMealType('');
                  setIssueCategory('');
                  setSentiment('');
                  setSearchItem('');
                  setSourceDataset('');
                }}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 px-2 py-1"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {isLoading && !report ? (
        <LoadingState
          message="Aggregating Feedback &amp; Recurrence Analytics..."
          subtext="Executing SQL groupings, sentiment trend calculations, and topic cluster distributions"
        />
      ) : error ? (
        <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700">
          <span className="font-bold">Error loading analytics: </span>
          {error}
        </div>
      ) : !report ? (
        <EmptyState
          title="No Feedback Records Found"
          description="Submit canteen feedback or import a dataset to view analytics."
        />
      ) : (
        <>
          {/* Executive KPI Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Total Feedback */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Feedback
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-slate-900 font-mono">
                  {overview?.total_feedback ?? 0}
                </span>
                <span className="text-[10px] text-blue-600 font-medium">Logged</span>
              </div>
            </div>

            {/* Satisfaction Rate */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Satisfaction Rate
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-emerald-600 font-mono">
                  {overview?.satisfaction_percentage ?? 0}%
                </span>
                <span className="text-[10px] text-emerald-600 font-medium">
                  {overview?.positive_count ?? 0} pos
                </span>
              </div>
            </div>

            {/* Negative Feedback % */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Complaint Rate
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-red-600 font-mono">
                  {overview?.negative_percentage ?? 0}%
                </span>
                <span className="text-[10px] text-red-600 font-medium">
                  {overview?.negative_count ?? 0} neg
                </span>
              </div>
            </div>

            {/* Average Rating */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Average Rating
              </span>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-2xl font-bold text-amber-500 font-mono">
                  {overview?.average_rating ? overview.average_rating.toFixed(2) : '0.00'}
                </span>
                <div className="flex items-center text-amber-400">
                  <Star className="w-4 h-4 fill-amber-400" />
                </div>
              </div>
            </div>

            {/* Active Recurring Issues */}
            <div
              onClick={onNavigateToRecurrence}
              className="p-4 rounded-xl bg-white border border-slate-200 hover:border-blue-400 shadow-xs flex flex-col justify-between cursor-pointer transition group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Recurring Risks
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition" />
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-blue-600 font-mono">
                  {overview?.active_recurring_issues ?? 0}
                </span>
                <span className="text-[10px] text-blue-600 font-medium">Active</span>
              </div>
            </div>

            {/* Critical Safety Hazards */}
            <div
              onClick={onNavigateToActions}
              className="p-4 rounded-xl bg-white border border-red-200 hover:border-red-400 shadow-xs flex flex-col justify-between cursor-pointer transition group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-red-600 uppercase tracking-wider">
                  Safety Overrides
                </span>
                <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-red-600 font-mono">
                  {overview?.critical_issues ?? 0}
                </span>
                <span className="text-[10px] text-red-600 font-bold uppercase">Rule 9</span>
              </div>
            </div>
          </div>

          {/* Section 1: Sentiment Distribution by Meal Slot */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Sentiment Distribution by Meal Slot
                </h3>
                <p className="text-xs text-slate-500">
                  Breakdown of student satisfaction and complaints across Breakfast, Lunch, Snacks, and Dinner.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {report.sentiment_by_meal.map((m) => {
                const total = Math.max(1, m.total);
                const posPct = Math.round((m.positive / total) * 100);
                const negPct = Math.round((m.negative / total) * 100);
                const neuPct = 100 - posPct - negPct;

                return (
                  <div
                    key={m.meal_type}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{m.meal_type}</span>
                      <span className="text-[11px] text-slate-500 font-mono">{m.total} feedback</span>
                    </div>

                    {/* Multi-colored Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden flex">
                      <div
                        style={{ width: `${posPct}%` }}
                        className="bg-emerald-500 h-full transition-all"
                        title={`Positive: ${m.positive}`}
                      />
                      <div
                        style={{ width: `${neuPct}%` }}
                        className="bg-blue-400 h-full transition-all"
                        title={`Neutral: ${m.neutral}`}
                      />
                      <div
                        style={{ width: `${negPct}%` }}
                        className="bg-red-500 h-full transition-all"
                        title={`Negative: ${m.negative}`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-medium pt-1">
                      <span className="text-emerald-700">{m.positive} pos</span>
                      <span className="text-slate-500">{m.neutral} neu</span>
                      <span className="text-red-700">{m.negative} neg</span>
                      <span className="font-bold text-slate-800 flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {m.average_rating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Daily Sentiment Trends Timeline */}
          {report.sentiment_trend.length > 0 && (
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Sentiment &amp; Volume Trends Over Time
                  </h3>
                  <p className="text-xs text-slate-500">
                    Chronological progression of complaints versus satisfaction across observation dates.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Positive
                  </span>
                  <span className="flex items-center gap-1.5 text-red-600 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Negative
                  </span>
                </div>
              </div>

              {/* Timeline Horizontal Bar Visualization */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {report.sentiment_trend.map((day) => {
                  const maxTotal = Math.max(
                    ...report.sentiment_trend.map((d) => d.total),
                    1
                  );

                  return (
                    <div key={day.date} className="flex items-center gap-3 text-xs">
                      <span className="w-20 text-[11px] text-slate-500 font-mono shrink-0">
                        {day.date}
                      </span>
                      <div className="flex-1 bg-slate-100 rounded-lg h-6 overflow-hidden flex relative">
                        <div
                          style={{ width: `${(day.positive / maxTotal) * 100}%` }}
                          className="bg-emerald-500 h-full flex items-center px-1 text-[10px] text-white font-bold"
                        >
                          {day.positive > 0 && day.positive}
                        </div>
                        <div
                          style={{ width: `${(day.negative / maxTotal) * 100}%` }}
                          className="bg-red-500 h-full flex items-center px-1 text-[10px] text-white font-bold"
                        >
                          {day.negative > 0 && day.negative}
                        </div>
                      </div>
                      <span className="w-16 text-right font-mono text-[11px] text-slate-700 shrink-0">
                        {day.total} total
                      </span>
                      <span className="w-12 text-right font-bold text-[11px] text-amber-600 shrink-0 flex items-center justify-end gap-0.5">
                        ★ {day.average_rating.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 3: Most Reported Items & Common Complaints */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Food Items */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Utensils className="w-4 h-4 text-blue-600" />
                Frequently Reported Food Items
              </h3>
              <div className="space-y-2">
                {report.top_food_items.map((item, idx) => (
                  <div
                    key={item.item}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs hover:bg-blue-50/50 transition"
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>{idx + 1}. {item.item}</span>
                        {item.top_issue && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-100 text-red-700 font-medium">
                            {item.top_issue}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.total_feedback} feedback records ({item.positive_count} positive, {item.complaint_count} complaints)
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-800 font-mono text-xs flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {item.average_rating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Common Complaints */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                Most Common Complaints &amp; Breakdown
              </h3>
              <div className="space-y-2">
                {report.top_complaints.map((c) => (
                  <div
                    key={c.issue}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{c.issue}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-50 text-red-700 border border-red-200">
                        {c.count} occurrences
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 italic">
                      "{c.sample_comment}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 4: Issue Category Distribution */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Quality Issue Category Distribution
            </h3>
            <p className="text-xs text-slate-500">
              Deterministic breakdown across the 8 required quality intelligence dimensions.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {report.category_distribution.map((cat) => (
                <div
                  key={cat.category}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{cat.category}</span>
                    <span className="font-mono text-slate-500">{cat.count}</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.min(100, cat.percentage)}%` }}
                      className="bg-blue-600 h-full rounded-full transition-all"
                    />
                  </div>
                  <div className="text-right text-[10px] text-slate-400 font-mono">
                    {cat.percentage}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Extracted Common Topics with Supporting Evidence */}
          {report.common_topics.length > 0 && (
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <Quote className="w-4 h-4 text-blue-600" />
                    AI-Extracted Quality Topics Grounded in Real Quotes
                  </h3>
                  <p className="text-xs text-slate-500">
                    Aspect clusters extracted from actual student feedback with verified supporting quotes.
                  </p>
                </div>
                {onNavigateToRecurrence && (
                  <button
                    onClick={onNavigateToRecurrence}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <span>View Recurrence Risks</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.common_topics.map((t) => (
                  <div
                    key={t.topic}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{t.topic}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-mono bg-blue-100 text-blue-800 font-semibold">
                        {t.count} reviews
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>Category: <strong>{t.category}</strong></span>
                      {t.meal_type && <span>Meal: <strong>{t.meal_type}</strong></span>}
                      <span>Avg Rating: <strong>★ {t.average_rating.toFixed(1)}</strong></span>
                    </div>

                    {t.sample_quotes.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          Verified Evidence:
                        </span>
                        {t.sample_quotes.map((q, i) => (
                          <p key={i} className="text-[11px] text-slate-600 italic bg-white p-2 rounded-lg border border-slate-100">
                            "{q}"
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
