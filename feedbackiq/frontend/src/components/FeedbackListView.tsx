import { useState } from 'react';
import {
  Search,
  Sparkles,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Eye,
  Star,
  RefreshCw,
} from 'lucide-react';
import { Feedback, FeedbackAnalysis, PaginatedFeedback } from '../types';
import { api } from '../services/api';
import { AnalysisModal } from './AnalysisModal';
import { EmptyState } from './EmptyState';
import { resolveDepartmentRouting } from '../utils/routing';

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

  const handleAnalyzeSingle = async (fb: Feedback) => {
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

  const handleViewAnalysis = (fb: Feedback) => {
    if (fb.analysis) {
      setSelectedFeedback(fb);
      setSelectedAnalysis(fb.analysis);
      setIsModalOpen(true);
    }
  };

  const renderStars = (rating?: number) => {
    if (!rating) return <span className="text-xs text-slate-400">No rating</span>;
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

  return (
    <div className="space-y-4">
      {/* Filtering Toolbar */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search dish or complaint keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Meal Type Filter */}
            <select
              value={mealTypeFilter}
              onChange={(e) => setMealTypeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
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
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">All Categories</option>
              <option value="Taste">Taste &amp; Flavor</option>
              <option value="Hygiene">Hygiene &amp; Cleanliness</option>
              <option value="Temperature">Temperature</option>
              <option value="Freshness">Freshness &amp; Spoilage</option>
              <option value="Portion">Portion &amp; Quantity</option>
              <option value="Service">Service &amp; Waiting Time</option>
            </select>

            {/* Sentiment Filter */}
            <select
              value={sentimentFilter}
              onChange={(e) => setSentimentFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">All Sentiments</option>
              <option value="positive">Positive</option>
              <option value="negative">Negative</option>
              <option value="neutral">Neutral</option>
              <option value="mixed">Mixed</option>
              <option value="uncertain">Uncertain</option>
            </select>

            {/* Safety Filter Toggle */}
            <button
              onClick={() => setFoodSafetyOnly(!foodSafetyOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                foodSafetyOnly
                  ? 'bg-red-50 text-red-700 border-red-300 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
              <span>Safety Escalations</span>
            </button>

            {/* Batch Analyze Button */}
            <button
              onClick={handleBatchAnalyze}
              disabled={isBatchAnalyzing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition shadow-sm shadow-blue-500/20"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isBatchAnalyzing ? 'animate-spin' : ''}`} />
              {isBatchAnalyzing ? 'Analyzing...' : 'Batch AI Analyze'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            Loading feedback records...
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No Feedback Records Found"
              description="No feedback records match the current filter or dataset is empty. Use the Ingestion tab above to upload CSV or generate synthetic feedback."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Time &amp; Meal</th>
                  <th className="px-4 py-3">Dish / Item</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Student Comment</th>
                  <th className="px-4 py-3">AI Intelligence</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {data.items.map((fb) => {
                  const analysis = fb.analysis;
                  const isFoodSafety = analysis?.food_safety_flag;

                  return (
                    <tr
                      key={fb.id}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        isFoodSafety ? 'bg-red-50/40' : ''
                      }`}
                    >
                      {/* Date & Meal Slot */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-slate-900 font-semibold">
                          {fb.date ? new Date(fb.date).toLocaleDateString() : 'N/A'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {fb.meal_type || 'General'}
                        </div>
                      </td>

                      {/* Item */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{fb.item || 'General Meal'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {fb.source_dataset}
                        </div>
                      </td>

                      {/* Rating */}
                      <td className="px-4 py-3 whitespace-nowrap">{renderStars(fb.rating)}</td>

                      {/* Comment */}
                      <td className="px-4 py-3 max-w-xs truncate">
                        <p className="truncate text-slate-800" title={fb.comment || ''}>
                          {fb.comment || <span className="text-slate-400 italic">No comment</span>}
                        </p>
                      </td>

                      {/* AI Analysis Badges & Department Routing */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {analysis ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  analysis.sentiment === 'positive'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : analysis.sentiment === 'negative'
                                    ? 'bg-red-50 text-red-700 border border-red-200'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}
                              >
                                {analysis.sentiment}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                                Sev {analysis.severity_score}
                              </span>
                              {isFoodSafety && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-300 flex items-center gap-1">
                                  <ShieldAlert className="w-3 h-3 text-red-600" />
                                  Hazard
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="text-slate-400 font-mono">Dept:</span>
                              <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                                {resolveDepartmentRouting(
                                  analysis.issue_categories[0] || fb.issue_category,
                                  analysis.food_safety_flag,
                                  analysis.severity_score
                                ).department}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Unanalyzed</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {analysis ? (
                          <button
                            onClick={() => handleViewAnalysis(fb)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            View
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAnalyzeSingle(fb)}
                            disabled={analyzingId === fb.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 disabled:opacity-50 transition"
                          >
                            <Sparkles className={`w-3.5 h-3.5 text-blue-600 ${analyzingId === fb.id ? 'animate-spin' : ''}`} />
                            {analyzingId === fb.id ? 'Extracting...' : 'AI Analyze'}
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
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div>
              Showing page <span className="font-semibold text-slate-900">{data.page}</span> of{' '}
              <span className="font-semibold text-slate-900">{data.total_pages}</span> ({data.total} records)
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(data.total_pages, currentPage + 1))}
                disabled={currentPage >= data.total_pages}
                className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Analysis Details Modal */}
      {selectedFeedback && selectedAnalysis && (
        <AnalysisModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          feedback={selectedFeedback}
          analysis={selectedAnalysis}
        />
      )}
    </div>
  );
};
