import React, { useState, useRef } from 'react';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  PenLine,
  Star,
  Send,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { api } from '../services/api';
import { Organization, ImportJob } from '../types';
import { resolveDepartmentRouting } from '../utils/routing';

interface IngestionPanelProps {
  currentOrg: Organization | null;
  onIngestionComplete: () => void;
  onNavigateToExplorer?: () => void;
}

export const IngestionPanel: React.FC<IngestionPanelProps> = ({
  currentOrg,
  onIngestionComplete,
  onNavigateToExplorer,
}) => {
  // Ingestion Mode: 'manual' | 'csv' | 'synthetic'
  const [activeMode, setActiveMode] = useState<'manual' | 'csv' | 'synthetic'>('manual');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Manual text entry state
  const [item, setItem] = useState('');
  const [mealType, setMealType] = useState('Lunch');
  const [rating, setRating] = useState<number>(3);
  const [category, setCategory] = useState('Taste');
  const [comment, setComment] = useState('');
  const [isSubmittingText, setIsSubmittingText] = useState(false);

  // CSV & Synthetic states
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [syntheticCount, setSyntheticCount] = useState(40);
  const [seedRecurring, setSeedRecurring] = useState(true);
  const [lastJob, setLastJob] = useState<ImportJob | null>(null);

  // Status notifications
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Direct Feedback Submission
  const handleSubmitManualFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      setErrorMessage('Please write a feedback comment or review text.');
      return;
    }

    setIsSubmittingText(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const created = await api.submitFeedback(
        {
          item: item.trim() || undefined,
          meal_type: mealType || undefined,
          rating: rating || undefined,
          comment: comment.trim(),
          issue_category: category || undefined,
          channel: 'manual_form',
        },
        currentOrg?.id
      );

      const routing = resolveDepartmentRouting(
        created.analysis?.issue_categories[0] || category,
        created.analysis?.food_safety_flag,
        created.analysis?.severity_score
      );

      const sentimentStr = created.analysis?.sentiment
        ? ` • Sentiment: ${created.analysis.sentiment.toUpperCase()} (Sev ${created.analysis.severity_score}/5)`
        : '';

      const deptStr = ` • Routed to: ${routing.department}`;

      setSuccessMessage(
        `Feedback for "${item || 'General Meal'}" ingested and analyzed${sentimentStr}${deptStr}!`
      );

      // Reset form
      setItem('');
      setComment('');
      setRating(3);
      onIngestionComplete();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit direct feedback');
    } finally {
      setIsSubmittingText(false);
    }
  };

  // Quick Preset Handlers
  const handleApplyPreset = (preset: 'cold' | 'safety' | 'positive') => {
    if (preset === 'cold') {
      setItem('Sambar Rice');
      setMealType('Lunch');
      setRating(2);
      setCategory('Temperature');
      setComment('The sambar rice served today at lunch counter 2 was cold, watery, and had a sour taste.');
    } else if (preset === 'safety') {
      setItem('Chicken Curry');
      setMealType('Dinner');
      setRating(1);
      setCategory('Hygiene');
      setComment('Critical hygiene hazard: Found a sharp metallic wire strand inside the chicken curry during dinner service!');
    } else if (preset === 'positive') {
      setItem('Paneer Butter Masala');
      setMealType('Dinner');
      setRating(5);
      setCategory('Taste');
      setComment('The paneer butter masala tonight was exceptionally fresh, hot, and delicious with generous portion size.');
    }
  };

  // CSV Ingestion
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.uploadCSV(file, currentOrg?.id);
      setLastJob(res.import_job);
      setSuccessMessage(
        `Processed "${file.name}": ${res.import_job.successful_records} records imported, ${res.import_job.duplicate_records} duplicates skipped.`
      );
      onIngestionComplete();
    } catch (err: any) {
      setErrorMessage(err.message || 'CSV upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Synthetic Data Ingestion
  const handleGenerateSynthetic = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.generateSynthetic(syntheticCount, seedRecurring, currentOrg?.id);
      setSuccessMessage(
        `Generated ${res.generated_count} synthetic records with realistic recurring failure clusters.`
      );
      onIngestionComplete();
    } catch (err: any) {
      setErrorMessage(err.message || 'Synthetic data generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="rounded-xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
      {/* Dynamic Status Notifications */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border-b border-emerald-100 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
            {onNavigateToExplorer && (
              <button
                type="button"
                onClick={onNavigateToExplorer}
                className="underline font-bold text-emerald-900 hover:text-emerald-950 ml-1 cursor-pointer"
              >
                View in Feedback Explorer &rarr;
              </button>
            )}
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-50 border-b border-red-100 text-red-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-700 hover:text-red-900 font-bold text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header & Mode Tabs */}
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <PenLine className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Feedback Ingestion Center
            </h3>
            <p className="text-[11px] text-slate-500">
              Target Tenant: <span className="font-semibold text-slate-800">{currentOrg?.name || 'Default'}</span>
            </p>
          </div>
        </div>

        {/* Tab Controls & Collapse Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white p-1 rounded-lg border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setActiveMode('manual');
                setIsCollapsed(false);
              }}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${
                activeMode === 'manual'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Direct Entry
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMode('csv');
                setIsCollapsed(false);
              }}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${
                activeMode === 'csv'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Upload CSV Feedback
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMode('synthetic');
                setIsCollapsed(false);
              }}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${
                activeMode === 'synthetic'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Synthetic Scenario Generator
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition"
            title={isCollapsed ? 'Expand ingestion form' : 'Collapse ingestion form'}
          >
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Ingestion Body */}
      {!isCollapsed && (
        <div className="p-4 sm:p-5">
          {/* 1. Direct Entry Mode */}
          {activeMode === 'manual' && (
            <form onSubmit={handleSubmitManualFeedback} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
                <span className="text-xs font-semibold text-slate-700">Fill review details:</span>
                {/* Presets */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-slate-400">Quick Scenarios:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('cold')}
                    className="px-2 py-0.5 text-[11px] font-semibold rounded bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition"
                  >
                    Cold Food
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('safety')}
                    className="px-2 py-0.5 text-[11px] font-semibold rounded bg-red-50 hover:bg-red-100 text-red-700 transition"
                  >
                    Safety Hazard
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('positive')}
                    className="px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition"
                  >
                    Positive Review
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {/* Dish Name */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Dish / Item</label>
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => setItem(e.target.value)}
                    placeholder="e.g. Sambar Rice, Chicken Curry..."
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white text-xs transition"
                  />
                </div>

                {/* Meal Slot */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Meal Service</label>
                  <select
                    value={mealType}
                    onChange={(e) => setMealType(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Breakfast">Breakfast</option>
                    <option value="Lunch">Lunch</option>
                    <option value="Evening Snacks">Evening Snacks</option>
                    <option value="Dinner">Dinner</option>
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Issue Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Taste">Taste &amp; Seasoning</option>
                    <option value="Temperature">Temperature Upkeep</option>
                    <option value="Hygiene">Hygiene &amp; Cleanliness</option>
                    <option value="Freshness">Freshness &amp; Spoilage</option>
                    <option value="Portion">Portion &amp; Quantity</option>
                    <option value="Service">Service &amp; Counter Wait</option>
                  </select>
                </div>

                {/* Rating Stars */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Rating: <span className="font-mono text-blue-600 font-bold">{rating} / 5</span>
                  </label>
                  <div className="flex items-center gap-1 py-1 px-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="focus:outline-none hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            star <= rating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Comment text */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-xs">
                  Review Comment / Complaint
                </label>
                <textarea
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Enter written feedback comment (e.g. 'The dal served today at lunch was cold and sour...')"
                  className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition leading-relaxed"
                />
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isSubmittingText || !comment.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition shadow-xs cursor-pointer"
                >
                  {isSubmittingText ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>{isSubmittingText ? 'Ingesting & Analyzing...' : 'Submit & Analyze'}</span>
                </button>
              </div>
            </form>
          )}

          {/* 2. CSV Import Mode */}
          {activeMode === 'csv' && (
            <div className="space-y-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-6 text-center cursor-pointer bg-slate-50/50 hover:bg-blue-50/20 transition group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <FileText className="w-7 h-7 text-slate-400 group-hover:text-blue-600 mx-auto mb-1.5 transition-colors" />
                <p className="text-xs font-semibold text-slate-800 group-hover:text-blue-700">
                  {isUploading ? 'Parsing and importing CSV records...' : 'Click to browse CSV feedback file'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Supported formats: Zomato Kaggle reviews, campus dining surveys, standard CSVs.
                </p>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                <span>Fields mapped: item, rating, comment, meal_type, channel</span>
                {lastJob && (
                  <span className="font-mono font-semibold text-blue-600">
                    Last Job: {lastJob.status.toUpperCase()} ({lastJob.successful_records} saved)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 3. Synthetic Generator Mode */}
          {activeMode === 'synthetic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
                <div>
                  <div className="flex justify-between text-slate-700 font-semibold mb-1">
                    <span>Generated Records:</span>
                    <span className="font-mono text-blue-600 font-bold">{syntheticCount}</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="150"
                    step="10"
                    value={syntheticCount}
                    onChange={(e) => setSyntheticCount(Number(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-2 md:pt-0">
                  <input
                    type="checkbox"
                    checked={seedRecurring}
                    onChange={(e) => setSeedRecurring(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-semibold text-slate-800">Seed Systemic Failure Clusters</span>
                    <p className="text-[10px] text-slate-500">Injects cold temperature &amp; hygiene recurrence signals</p>
                  </div>
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleGenerateSynthetic}
                  disabled={isGenerating}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>{isGenerating ? 'Synthesizing...' : 'Generate Dataset'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
