import React, { useState } from 'react';
import {
  Search,
  Sparkles,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Eye,
  Star,
  RefreshCw,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Feedback, FeedbackAnalysis, PaginatedFeedback } from '../types';
import { api } from '../services/api';
import { AnalysisModal } from './AnalysisModal';
import { EmptyState } from './EmptyState';

interface FeedbackListViewProps {
  data: PaginatedFeedback | null;
  isLoading: boolean;
  onRefresh: () => void;
  orgId?: string;
  mealTypeFilter: string;
  setMealTypeFilter: (val: string) => void;
  categoryFilter: string;
  setCategoryFilter: (val: string) => void;
  sentimentFilter: string;
  setSentimentFilter: (val: string) => void;
  foodSafetyOnly: boolean;
  setFoodSafetyOnly: (val: boolean) => void;
  sourceDatasetFilter?: string;
  setSourceDatasetFilter?: (val: string) => void;
  channelFilter?: string;
  setChannelFilter?: (val: string) => void;
  ratingFilter?: number | '';
  setRatingFilter?: (val: number | '') => void;
  dateFromFilter?: string;
  setDateFromFilter?: (val: string) => void;
  dateToFilter?: string;
  setDateToFilter?: (val: string) => void;
  analysisStatusFilter?: string;
  setAnalysisStatusFilter?: (val: string) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
}

export const FeedbackListView: React.FC<FeedbackListViewProps> = ({
  data,
  isLoading,
  onRefresh,
  orgId,
  mealTypeFilter,
  setMealTypeFilter,
  categoryFilter,
  setCategoryFilter,
  sentimentFilter,
  setSentimentFilter,
  foodSafetyOnly,
  setFoodSafetyOnly,
  sourceDatasetFilter = '',
  setSourceDatasetFilter,
  channelFilter = '',
  setChannelFilter,
  ratingFilter = '',
  setRatingFilter,
  dateFromFilter = '',
  setDateFromFilter,
  dateToFilter = '',
  setDateToFilter,
  analysisStatusFilter = '',
  setAnalysisStatusFilter,
  searchQuery,
  setSearchQuery,
  currentPage,
  setCurrentPage,
}) => {
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<FeedbackAnalysis | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const handleAnalyzeSingle = async (e: React.MouseEvent, fb: Feedback) => {
    e.stopPropagation();
    setAnalyzingId(fb.id);
    try {
      const result = await api.analyzeFeedback(fb.id, orgId);
      setSelectedFeedback(fb);
      setSelectedAnalysis(result);
      setIsModalOpen(true);
      onRefresh();
    } catch (err) {
      console.error('Failed to analyze feedback:', err);
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleBatchAnalyze = async () => {
    setIsBatchAnalyzing(true);
    try {
      await api.batchAnalyze(undefined, 25, orgId);
      onRefresh();
    } catch (err) {
      console.error('Batch analysis failed:', err);
    } finally {
      setIsBatchAnalyzing(false);
    }
  };

  const handleRowClick = (fb: Feedback) => {
    setSelectedFeedback(fb);
    setSelectedAnalysis(fb.analysis || null);
    setIsModalOpen(true);
  };

  const renderStars = (rating?: number) => {
    if (!rating) return <span className="text-xs text-slate-400">--</span>;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3 h-3 ${
              star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
            }`}
          />
        ))}
      </div>
    );
  };

  const renderDatasetBadge = (source?: string, channel?: string) => {
    const src = (source || '').toLowerCase();
    const ch = (channel || '').toLowerCase();
    if (src.includes('zomato') || ch === 'zomato_review') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          Kaggle Zomato
        </span>
      );
    }
    if (src.includes('synth')) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          Synthetic
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        Student Canteen
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Explorer Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-slate-900">Feedback Explorer</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {data ? `${data.total} Total Records` : 'Loading...'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Search, filter, and inspect raw student submissions, synthetic simulations, and external review datasets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdvancedFilters((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              showAdvancedFilters
                ? 'bg-blue-50 text-blue-700 border-blue-300'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{showAdvancedFilters ? 'Simple Filters' : 'More Filters'}</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh Feedback Table"
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          <button
            onClick={handleBatchAnalyze}
            disabled={isBatchAnalyzing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition shadow-2xs"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isBatchAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isBatchAnalyzing ? 'Analyzing...' : 'Batch AI Analyze'}</span>
          </button>
        </div>
      </div>

      {/* Comprehensive Filtering Toolbar */}
      <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-2xs space-y-3">
        {/* Row 1: Primary Search & Basic Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Search Input */}
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search dish, comment keyword, or feedback ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>

          {/* Meal Slot Filter */}
          <select
            value={mealTypeFilter}
            onChange={(e) => setMealTypeFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="">All Meal Slots</option>
            <option value="Breakfast">Breakfast</option>
            <option value="Lunch">Lunch</option>
            <option value="Evening Snacks">Evening Snacks</option>
            <option value="Dinner">Dinner</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="">All Categories</option>
            <option value="Taste">Taste &amp; Flavor</option>
            <option value="Hygiene">Hygiene &amp; Cleanliness</option>
            <option value="Temperature">Temperature</option>
            <option value="Freshness">Freshness &amp; Spoilage</option>
            <option value="Portion">Portion &amp; Quantity</option>
            <option value="Service">Service</option>
          </select>

          {/* Sentiment Filter */}
          <select
            value={sentimentFilter}
            onChange={(e) => setSentimentFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="">All Sentiments</option>
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
            <option value="neutral">Neutral</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>

        {/* Row 2: Advanced Filters (Expandable) */}
        {showAdvancedFilters && (
          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {/* Rating Filter */}
            {setRatingFilter && (
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value ? Number(e.target.value) : '')}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">All Ratings (1 - 5)</option>
                <option value="5">5 Stars (Excellent)</option>
                <option value="4">4 Stars (Good)</option>
                <option value="3">3 Stars (Average)</option>
                <option value="2">2 Stars (Poor)</option>
                <option value="1">1 Star (Critical)</option>
              </select>
            )}

            {/* Channel Filter */}
            {setChannelFilter && (
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">All Channels</option>
                <option value="student_form">Student Portal Form</option>
                <option value="csv_import">CSV Ingestion</option>
                <option value="manual_entry">Staff Manual Entry</option>
                <option value="zomato_review">External Zomato</option>
              </select>
            )}

            {/* Analysis Status Filter */}
            {setAnalysisStatusFilter && (
              <select
                value={analysisStatusFilter}
                onChange={(e) => setAnalysisStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">All Analysis Statuses</option>
                <option value="true">Analyzed by AI</option>
                <option value="false">Pending AI Analysis</option>
              </select>
            )}

            {/* Date From */}
            {setDateFromFilter && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="date"
                  value={dateFromFilter}
                  onChange={(e) => setDateFromFilter(e.target.value)}
                  className="bg-transparent text-xs text-slate-700 focus:outline-none w-full"
                  title="Date From"
                />
              </div>
            )}

            {/* Date To */}
            {setDateToFilter && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="date"
                  value={dateToFilter}
                  onChange={(e) => setDateToFilter(e.target.value)}
                  className="bg-transparent text-xs text-slate-700 focus:outline-none w-full"
                  title="Date To"
                />
              </div>
            )}
          </div>
        )}

        {/* Row 3: Filter Badges & Fast Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            {/* Dataset Filter */}
            {setSourceDatasetFilter && (
              <select
                value={sourceDatasetFilter}
                onChange={(e) => setSourceDatasetFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">All Data Sources</option>
                <option value="canteen">Student Canteen Only</option>
                <option value="synth">Synthetic Demo Only</option>
                <option value="zomato">Kaggle Zomato Only</option>
              </select>
            )}

            {/* Food Safety Filter Pill */}
            <button
              onClick={() => setFoodSafetyOnly(!foodSafetyOnly)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                foodSafetyOnly
                  ? 'bg-red-50 text-red-700 border-red-300'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-900'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
              <span>Safety Escalations</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400">
            Click any row to open full AI Analysis &amp; Department Routing details
          </div>
        </div>
      </div>

      {/* Main Feedback Records Table */}
      <div className="rounded-xl bg-white border border-slate-200 overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
            Loading feedback records...
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No Feedback Records Found"
              description="No feedback records match the current filter or dataset is empty. Try resetting your search or adjusting filters."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-3.5 py-2.5">ID &amp; Date</th>
                  <th className="px-3.5 py-2.5">Food Item &amp; Meal</th>
                  <th className="px-3.5 py-2.5">Rating</th>
                  <th className="px-3.5 py-2.5">Student / Diner Review</th>
                  <th className="px-3.5 py-2.5">Channel</th>
                  <th className="px-3.5 py-2.5">AI Sentiment</th>
                  <th className="px-3.5 py-2.5">Category &amp; Sev</th>
                  <th className="px-3.5 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {data.items.map((fb) => {
                  const analysis = fb.analysis;
                  const isFoodSafety = analysis?.food_safety_flag;
                  const isAnalyzed = Boolean(analysis);

                  return (
                    <tr
                      key={fb.id}
                      onClick={() => handleRowClick(fb)}
                      className={`hover:bg-blue-50/40 cursor-pointer transition-colors ${
                        isFoodSafety ? 'bg-red-50/30' : ''
                      }`}
                    >
                      {/* ID & Date */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <div className="font-mono text-[11px] font-bold text-slate-900">
                          {fb.feedback_id || fb.id.slice(0, 8)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {fb.date ? new Date(fb.date).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>

                      {/* Food Item & Meal Slot */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{fb.item || 'General Meal'}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {fb.meal_type || 'General Service'}
                        </div>
                      </td>

                      {/* Rating */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">{renderStars(fb.rating)}</td>

                      {/* Comment */}
                      <td className="px-3.5 py-2.5 max-w-xs sm:max-w-sm truncate">
                        <p className="truncate text-slate-800" title={fb.comment || ''}>
                          {fb.comment || <span className="text-slate-400 italic">No comment text</span>}
                        </p>
                      </td>

                      {/* Channel & Dataset */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <div>{renderDatasetBadge(fb.source_dataset, fb.channel)}</div>
                        <div className="text-[10px] text-slate-400 capitalize mt-0.5">
                          {fb.channel ? fb.channel.replace('_', ' ') : 'portal'}
                        </div>
                      </td>

                      {/* Sentiment */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        {analysis?.sentiment ? (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize border ${
                              analysis.sentiment === 'positive'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : analysis.sentiment === 'negative'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {analysis.sentiment}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Pending</span>
                        )}
                      </td>

                      {/* Category & Severity */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <div className="text-slate-800 font-medium">
                          {analysis?.issue_categories[0] || fb.issue_category || 'General'}
                        </div>
                        {analysis && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                              Sev {analysis.severity_score}
                            </span>
                            {isFoodSafety && (
                              <span className="px-1 rounded text-[9px] font-bold bg-red-100 text-red-700">
                                HAZARD
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Analysis Status */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        {isAnalyzed ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Analyzed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3 text-slate-400" />
                            Queued
                          </span>
                        )}
                      </td>

                      {/* Action Button */}
                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                        {isAnalyzed ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowClick(fb);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            <span>Inspect</span>
                          </button>
                        ) : (
                          <button
                            onClick={(e) => handleAnalyzeSingle(e, fb)}
                            disabled={analyzingId === fb.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition shadow-2xs"
                          >
                            <Sparkles className={`w-3 h-3 ${analyzingId === fb.id ? 'animate-spin' : ''}`} />
                            <span>{analyzingId === fb.id ? '...' : 'Analyze'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs">
            <span className="text-slate-500 font-medium">
              Showing <span className="font-semibold text-slate-900">{(currentPage - 1) * data.page_size + 1}</span> to{' '}
              <span className="font-semibold text-slate-900">
                {Math.min(currentPage * data.page_size, data.total)}
              </span>{' '}
              of <span className="font-semibold text-slate-900">{data.total}</span> records
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-600 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2 font-mono font-bold text-slate-700">
                {currentPage} / {data.total_pages}
              </span>

              <button
                onClick={() => setCurrentPage(Math.min(data.total_pages, currentPage + 1))}
                disabled={currentPage === data.total_pages}
                className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-600 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI Analysis Details Modal */}
      <AnalysisModal
        feedback={selectedFeedback}
        analysis={selectedAnalysis}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        orgId={orgId}
        onAnalysisUpdated={() => onRefresh()}
      />
    </div>
  );
};
