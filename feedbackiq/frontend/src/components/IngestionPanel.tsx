import { useState, useRef } from 'react';
import {
  Upload,
  Sparkles,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  PenLine,
  Star,
  Send,
  Building2,
} from 'lucide-react';
import { api } from '../services/api';
import { Organization, ImportJob } from '../types';
import { resolveDepartmentRouting } from '../utils/routing';

interface IngestionPanelProps {
  currentOrg: Organization | null;
  onIngestionComplete: () => void;
}

export const IngestionPanel: React.FC<IngestionPanelProps> = ({
  currentOrg,
  onIngestionComplete,
}) => {
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

  // Feedback notifications
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
        ? ` • Detected Sentiment: ${created.analysis.sentiment.toUpperCase()} (Sev ${created.analysis.severity_score}/5)`
        : '';

      const deptStr = ` • Routed to: ${routing.department} (${routing.role})`;

      setSuccessMessage(
        `Direct feedback for "${item || 'General Meal'}" successfully ingested and analyzed${sentimentStr}${deptStr}!`
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
        `Successfully processed "${file.name}": ${res.import_job.successful_records} records imported, ${res.import_job.duplicate_records} duplicates skipped.`
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
        `Successfully generated ${res.generated_count} synthetic records with realistic recurring failure clusters.`
      );
      onIngestionComplete();
    } catch (err: any) {
      setErrorMessage(err.message || 'Synthetic data generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Status Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2.5 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. PRIMARY SECTION: Direct Text & Review Entry Form */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-2xs">
              <PenLine className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Write Direct Student / Diner Feedback</h3>
              <p className="text-xs text-slate-500">
                Type or paste real-time dining reviews. Auto-triggers AI sentiment extraction, safety checks, and department routing.
              </p>
            </div>
          </div>

          {/* Quick Scenario Pre-fill Pills */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <span className="text-[11px] font-semibold text-slate-400 mr-1 hidden md:inline">Quick Presets:</span>
            <button
              type="button"
              onClick={() => handleApplyPreset('cold')}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 transition"
            >
              🍲 Cold Food
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('safety')}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition"
            >
              ⚠️ Safety Alert
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('positive')}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition"
            >
              ⭐ Positive
            </button>
          </div>
        </div>

        {/* The Form */}
        <form onSubmit={handleSubmitManualFeedback} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {/* Dish / Item */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Dish / Item Name</label>
              <input
                type="text"
                value={item}
                onChange={(e) => setItem(e.target.value)}
                placeholder="e.g. Sambar Rice, Dal Tadka..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>

            {/* Meal Slot */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Meal Service Slot</label>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="Breakfast">Breakfast</option>
                <option value="Lunch">Lunch</option>
                <option value="Evening Snacks">Evening Snacks</option>
                <option value="Dinner">Dinner</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Issue Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="Taste">Taste &amp; Seasoning</option>
                <option value="Temperature">Temperature Upkeep</option>
                <option value="Hygiene">Hygiene &amp; Cleanliness</option>
                <option value="Freshness">Freshness &amp; Spoilage</option>
                <option value="Portion">Portion &amp; Quantity</option>
                <option value="Service">Service &amp; Counter Wait</option>
                <option value="Ambience">Ambience &amp; Facilities</option>
              </select>
            </div>

            {/* Rating Stars */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Rating: <span className="font-mono text-blue-600 font-bold">{rating} / 5</span>
              </label>
              <div className="flex items-center gap-1.5 py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="focus:outline-none hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`w-4 h-4 ${star <= rating
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300'
                        }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Feedback Text Area */}
          <div>
            <div className="flex items-center justify-between mb-1 text-xs">
              <label className="font-bold text-slate-700">Diner Review / Written Feedback Comment</label>
              <span className="text-[11px] text-slate-400 font-mono">{comment.length} characters</span>
            </div>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Write or paste customer review text here (e.g. 'The dal served today at lunch was cold and sour, and found a wire strand in the chicken curry')..."
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition leading-relaxed"
            />
          </div>

          {/* Submit Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span>
                Target Tenant: <strong>{currentOrg?.name || 'Default Mess'}</strong> ({currentOrg?.template_type || 'college'})
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmittingText || !comment.trim()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition shadow-sm shadow-blue-500/20 cursor-pointer"
            >
              {isSubmittingText ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{isSubmittingText ? 'Ingesting & AI Analyzing...' : 'Submit Feedback & Run AI Analysis'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. SECONDARY SECTION: Batch File Upload & Synthetic Generator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CSV Ingestion Box */}
        <div className="rounded-2xl bg-white border border-slate-200 p-6 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Upload CSV Feedback</h3>
                <p className="text-xs text-slate-500">
                  Native mapping for Zomato Bangalore Kaggle datasets &amp; canteen feedback forms.
                </p>
              </div>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-xl p-8 text-center cursor-pointer bg-slate-50/70 hover:bg-blue-50/30 transition-all group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <FileText className="w-8 h-8 text-slate-400 group-hover:text-blue-600 mx-auto mb-2 transition-colors" />
              <p className="text-xs font-semibold text-slate-800 group-hover:text-blue-700">
                {isUploading ? 'Ingesting and parsing CSV...' : 'Click to select CSV file'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Kaggle mapping: <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono">name</code> → item, <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono">rate</code> → rating, <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono">reviews_list</code> → comment
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-mono">Dataset: Zomato Kaggle / Canteen Form</span>
            {lastJob ? (
              <span className="text-blue-600 font-mono font-bold">{lastJob.status.toUpperCase()}</span>
            ) : (
              <span className="text-slate-400 font-mono">Ready for CSV</span>
            )}
          </div>
        </div>

        {/* Synthetic Generator Box */}
        <div className="rounded-2xl bg-white border border-slate-200 p-6 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Synthetic Scenario Generator</h3>
                <p className="text-xs text-slate-500">
                  Seeds realistic recurrence clusters across 8 canonical canteen feedback fields.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div>
                <div className="flex justify-between text-xs text-slate-700 font-medium mb-1.5">
                  <span>Record Volume:</span>
                  <span className="font-mono text-blue-600 font-bold">{syntheticCount} Records</span>
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

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={seedRecurring}
                  onChange={(e) => setSeedRecurring(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="text-xs text-slate-700">
                  <span className="font-semibold text-slate-900">Seed Systemic Failure Scenarios</span>
                  <p className="text-[11px] text-slate-500">
                    Fields: <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono">feedback_id, date, meal_type, item, rating, comment, channel, issue_category</code>
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="mt-4 pt-3 flex justify-end">
            <button
              onClick={handleGenerateSynthetic}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-all shadow-md shadow-blue-500/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Generating Synthetic Data...' : 'Generate Canteen Dataset'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
