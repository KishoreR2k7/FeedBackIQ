import React from 'react';
import { X, ShieldAlert, Layers, Tag, Quote, Building2, UserCheck, Clock } from 'lucide-react';
import { Feedback, FeedbackAnalysis } from '../types';
import { resolveDepartmentRouting } from '../utils/routing';

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

  const routing = resolveDepartmentRouting(
    analysis.issue_categories[0] || feedback.issue_category,
    analysis.food_safety_flag,
    analysis.severity_score
  );

  const getSentimentBadge = (s: string) => {
    switch (s) {
      case 'positive':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'negative':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'mixed':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'uncertain':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getSeverityBadge = (sev: number) => {
    if (sev >= 4) return 'text-red-700 bg-red-50 border-red-200';
    if (sev === 3) return 'text-amber-800 bg-amber-50 border-amber-200';
    return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 p-6 shadow-xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-2xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Feedback Aspect &amp; Sentiment Analysis</h3>
              <p className="text-xs text-slate-500">
                Structured Aspect Extraction • Classifier: <span className="font-mono text-blue-700 font-semibold">{analysis.model_name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Deterministic Food Safety Banner (Rule 9) */}
        {analysis.food_safety_flag && (
          <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-300 text-red-900 shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-xs text-red-700 uppercase tracking-wide">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <span>Critical Food Safety Hazard Flagged</span>
            </div>
            <ul className="mt-2 text-xs space-y-1 list-disc list-inside text-red-800 font-medium">
              {analysis.food_safety_reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Operational Department Routing Card */}
        <div className="mt-4 p-4 rounded-xl bg-blue-50/80 border border-blue-200 space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold text-blue-900">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Operational Department Routing</span>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
              AI Routing Agent
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
            <div className="bg-white p-2.5 rounded-lg border border-blue-200/70 shadow-2xs">
              <div className="text-[10px] font-bold uppercase text-slate-400">Assigned Department</div>
              <div className="font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                <span>{routing.department}</span>
              </div>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-blue-200/70 shadow-2xs">
              <div className="text-[10px] font-bold uppercase text-slate-400">Responsible Role</div>
              <div className="font-bold text-blue-700 mt-0.5 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>{routing.role}</span>
              </div>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-blue-200/70 shadow-2xs">
              <div className="text-[10px] font-bold uppercase text-slate-400">Resolution SLA</div>
              <div className="font-bold text-slate-800 mt-0.5 flex items-center gap-1.5 font-mono text-[11px]">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{analysis.food_safety_flag ? '2 Hours (Critical)' : '24 Hours'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Source Comment Card */}
        <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5 font-mono">
            <span className="font-semibold text-slate-800">
              {feedback.meal_type || 'General'} • {feedback.item || 'Food Item'}
            </span>
            <span>{feedback.rating ? `${feedback.rating} / 5 Stars` : 'No numerical rating'}</span>
          </div>
          <p className="text-xs text-slate-800 italic leading-relaxed bg-white p-3 rounded-lg border border-slate-200/80">
            "{feedback.comment || 'No text comment provided'}"
          </p>
        </div>

        {/* Primary Analytical Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Sentiment</div>
            <span
              className={`mt-1.5 inline-block px-2.5 py-0.5 rounded-full text-xs font-bold capitalize border ${getSentimentBadge(
                analysis.sentiment
              )}`}
            >
              {analysis.sentiment}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Severity Score</div>
            <div className="mt-1.5 flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${getSeverityBadge(
                  analysis.severity_score
                )}`}
              >
                Level {analysis.severity_score} / 5
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Language</div>
            <div className="mt-1.5 text-xs font-mono font-bold text-slate-700 uppercase">
              {analysis.language || 'EN'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Uncertainty</div>
            <div className="mt-1.5 text-xs font-mono font-bold text-slate-700">
              {Math.round(analysis.uncertainty_score * 100)}%
            </div>
          </div>
        </div>

        {/* Mentioned Entities & Aspect Tags */}
        <div className="mt-4 space-y-3">
          <div>
            <div className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-blue-600" />
              <span>Issue Categories</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {analysis.issue_categories.length > 0 ? (
                analysis.issue_categories.map((cat) => (
                  <span
                    key={cat}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 capitalize"
                  >
                    {cat}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">None identified</span>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-emerald-600" />
              <span>Identified Dishes &amp; Ingredients</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {analysis.mentioned_food_items.length > 0 ? (
                analysis.mentioned_food_items.map((item) => (
                  <span
                    key={item}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                  >
                    {item}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">No specific dish named</span>
              )}
            </div>
          </div>

          {/* Evidence Quotes */}
          <div>
            <div className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Quote className="w-3.5 h-3.5 text-amber-600" />
              <span>Extracted Evidence Quotes</span>
            </div>
            <div className="space-y-1.5">
              {analysis.evidence_quotes.length > 0 ? (
                analysis.evidence_quotes.map((q, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 italic"
                  >
                    "{q}"
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 italic">No quotes extracted</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-xs"
          >
            Close Analysis
          </button>
        </div>
      </div>
    </div>
  );
};
