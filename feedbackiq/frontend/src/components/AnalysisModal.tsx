import { X, ShieldAlert, Sparkles, Tag, Quote } from 'lucide-react';
import { Feedback, FeedbackAnalysis } from '../types';

interface AnalysisModalProps {
  feedback: Feedback | null;
  analysis: FeedbackAnalysis | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AnalysisModal: React.FC<AnalysisModalProps> = ({
  feedback,
  analysis,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !feedback || !analysis) return null;

  const getSentimentColor = (s: string) => {
    switch (s) {
      case 'positive':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'negative':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'mixed':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getSeverityColor = (sev: number) => {
    if (sev >= 4) return 'text-red-400 bg-red-950/60 border-red-800';
    if (sev === 3) return 'text-amber-400 bg-amber-950/60 border-amber-800';
    return 'text-emerald-400 bg-emerald-950/60 border-emerald-800';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">AI Feedback Intelligence</h3>
              <p className="text-xs text-slate-400">
                LangChain Agent Structured Output • Model: <span className="font-mono text-purple-300">{analysis.model_name}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Deterministic Food Safety Banner (Rule 9) */}
        {analysis.food_safety_flag && (
          <div className="mt-4 p-4 rounded-xl bg-red-950/50 border border-red-700/60 text-red-200 animate-pulse">
            <div className="flex items-center gap-2 font-bold text-sm text-red-300">
              <ShieldAlert className="w-5 h-5 text-red-400" />
              <span>CRITICAL FOOD SAFETY HAZARD FLAGGED</span>
            </div>
            <ul className="mt-2 text-xs space-y-1 list-disc list-inside text-red-200/90">
              {analysis.food_safety_reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Source Comment Card */}
        <div className="mt-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-mono">
            <span>
              {feedback.meal_type || 'General'} • {feedback.item || 'Food Item'}
            </span>
            <span>{feedback.rating ? `${feedback.rating} / 5 Stars` : 'No numerical rating'}</span>
          </div>
          <p className="text-xs text-slate-200 italic leading-relaxed">
            "{feedback.comment || 'No text comment provided'}"
          </p>
        </div>

        {/* Primary Analytical Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60">
            <div className="text-[10px] font-semibold text-slate-400 uppercase">Sentiment</div>
            <span
              className={`mt-1.5 inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${getSentimentColor(
                analysis.sentiment
              )}`}
            >
              {analysis.sentiment}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60">
            <div className="text-[10px] font-semibold text-slate-400 uppercase">Severity Score</div>
            <div className="mt-1.5 flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${getSeverityColor(
                  analysis.severity_score
                )}`}
              >
                Level {analysis.severity_score} / 5
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60">
            <div className="text-[10px] font-semibold text-slate-400 uppercase">Language</div>
            <div className="mt-1.5 text-xs font-mono text-slate-200 uppercase">
              {analysis.language || 'EN'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60">
            <div className="text-[10px] font-semibold text-slate-400 uppercase">Uncertainty</div>
            <div className="mt-1.5 text-xs font-mono text-slate-200">
              {Math.round(analysis.uncertainty_score * 100)}%
            </div>
          </div>
        </div>

        {/* Mentioned Entities & Aspect Tags */}
        <div className="mt-4 space-y-3">
          <div>
            <div className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-cyan-400" />
              <span>Issue Categories</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {analysis.issue_categories.length > 0 ? (
                analysis.issue_categories.map((cat) => (
                  <span
                    key={cat}
                    className="px-2.5 py-1 rounded-lg text-xs bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 capitalize"
                  >
                    {cat}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500">None identified</span>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Identified Dishes & Ingredients</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {analysis.mentioned_food_items.length > 0 ? (
                analysis.mentioned_food_items.map((item) => (
                  <span
                    key={item}
                    className="px-2.5 py-1 rounded-lg text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                  >
                    {item}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500">No specific dish named</span>
              )}
            </div>
          </div>

          {/* Evidence Quotes */}
          <div>
            <div className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Quote className="w-3.5 h-3.5 text-amber-400" />
              <span>Extracted Evidence Quotes</span>
            </div>
            <div className="space-y-1">
              {analysis.evidence_quotes.map((q, i) => (
                <div
                  key={i}
                  className="px-3 py-1.5 rounded-lg bg-slate-950/40 border border-slate-800 text-xs text-slate-300"
                >
                  "{q}"
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            Close Analysis
          </button>
        </div>
      </div>
    </div>
  );
};
