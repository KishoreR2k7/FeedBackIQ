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
    if (!rating) return <span className="text-xs text-slate-500">No rating</span>;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3 h-3 ${
              star <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-700'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by dish item or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Filters & Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Meal Filter */}
            <select
              value={mealTypeFilter}
              onChange={(e) => setMealTypeFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="">All Meals</option>
              <option value="Breakfast">Breakfast</option>
              <option value="Lunch">Lunch</option>
              <option value="Evening Snacks">Evening Snacks</option>
              <option value="Dinner">Dinner</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="">All Categories</option>
              <option value="Taste">Taste & Flavor</option>
              <option value="Hygiene">Hygiene & Cleanliness</option>
              <option value="Temperature">Temperature</option>
              <option value="Freshness">Freshness & Spoilage</option>
              <option value="Portion">Portion & Quantity</option>
              <option value="Service">Service & Waiting Time</option>
            </select>

            {/* Sentiment Filter */}
            <select
              value={sentimentFilter}
              onChange={(e) => setSentimentFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none cursor-pointer"
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
                  ? 'bg-red-500/20 text-red-300 border-red-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              <span>Safety Escalations</span>
            </button>

            {/* Batch Analyze Button */}
            <button
              onClick={handleBatchAnalyze}
              disabled={isBatchAnalyzing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isBatchAnalyzing ? 'animate-spin' : ''}`} />
              {isBatchAnalyzing ? 'Analyzing...' : 'Batch AI Analyze'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
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
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Time & Meal</th>
                  <th className="px-4 py-3">Dish / Item</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Student Comment</th>
                  <th className="px-4 py-3">AI Intelligence</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {data.items.map((fb) => {
                  const analysis = fb.analysis;
                  const isFoodSafety = analysis?.food_safety_flag;

                  return (
                    <tr
                      key={fb.id}
                      className={`hover:bg-slate-800/30 transition ${
                        isFoodSafety ? 'bg-red-950/20' : ''
                      }`}
                    >
                      {/* Date & Meal Slot */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-slate-200">
                          {fb.date ? new Date(fb.date).toLocaleDateString() : 'N/A'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {fb.meal_type || 'General'}
                        </div>
                      </td>

                      {/* Item */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-200">{fb.item || 'General Meal'}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {fb.source_dataset}
                        </div>
                      </td>

                      {/* Rating */}
                      <td className="px-4 py-3 whitespace-nowrap">{renderStars(fb.rating)}</td>

                      {/* Comment */}
                      <td className="px-4 py-3 max-w-xs truncate">
                        <p className="truncate text-slate-300" title={fb.comment || ''}>
                          {fb.comment || <span className="text-slate-600">No comment</span>}
                        </p>
                      </td>

                      {/* AI Analysis Badges */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {analysis ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                analysis.sentiment === 'positive'
                                  ? 'bg-emerald-500/10 text-emerald-300'
                                  : analysis.sentiment === 'negative'
                                  ? 'bg-red-500/10 text-red-300'
                                  : 'bg-purple-500/10 text-purple-300'
                              }`}
                            >
                              {analysis.sentiment}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
                              Sev {analysis.severity_score}
                            </span>
                            {isFoodSafety && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1">
                                <ShieldAlert className="w-3 h-3" />
                                Hazard
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">Unanalyzed</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {analysis ? (
                          <button
                            onClick={() => handleViewAnalysis(fb)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAnalyzeSingle(fb)}
                            disabled={analyzingId === fb.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 disabled:opacity-50 transition"
                          >
                            <Sparkles className={`w-3.5 h-3.5 ${analyzingId === fb.id ? 'animate-spin' : ''}`} />
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

        {/* Pagination Footer */}
        {data && data.total_pages > 1 && (
          <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing page <span className="text-slate-200 font-semibold">{currentPage}</span> of{' '}
              <span className="text-slate-200 font-semibold">{data.total_pages}</span> (Total{' '}
              {data.total} records)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-40 hover:bg-slate-800 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(data.total_pages, currentPage + 1))}
                disabled={currentPage >= data.total_pages}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-40 hover:bg-slate-800 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Analysis Details Drawer / Modal */}
      <AnalysisModal
        feedback={selectedFeedback}
        analysis={selectedAnalysis}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};
