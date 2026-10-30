import React, { useState } from 'react';
import {
  X,
  ShieldAlert,
  Sparkles,
  Tag,
  Quote,
  Building2,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Utensils,
  Star,
} from 'lucide-react';
import { Feedback, FeedbackAnalysis } from '../types';
import { resolveDepartmentRouting } from '../utils/routing';
import { api } from '../services/api';

interface AnalysisModalProps {
  feedback: Feedback | null;
  analysis: FeedbackAnalysis | null;
  isOpen: boolean;
  onClose: () => void;
  orgId?: string;
  onAnalysisUpdated?: (updatedAnalysis: FeedbackAnalysis) => void;
}

export const AnalysisModal: React.FC<AnalysisModalProps> = ({
  feedback,
  analysis: initialAnalysis,
  isOpen,
  onClose,
  orgId,
  onAnalysisUpdated,
}) => {
  const [analysis, setAnalysis] = useState<FeedbackAnalysis | null>(initialAnalysis);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  React.useEffect(() => {
    setAnalysis(initialAnalysis);
    setRetryMessage(null);
  }, [initialAnalysis, isOpen]);

  if (!isOpen || !feedback) return null;

  const currentAnalysis = analysis || feedback.analysis;

  const handleRetryAnalysis = async () => {
    if (!feedback.id) return;
    setIsRetrying(true);
    setRetryMessage(null);
    try {
      const res = await api.analyzeFeedback(feedback.id, orgId);
      setAnalysis(res);
      setRetryMessage('Analysis re-evaluated successfully.');
      if (onAnalysisUpdated) {
        onAnalysisUpdated(res);
      }
    } catch (err: any) {
      setRetryMessage(`Failed to re-run analysis: ${err.message || 'Unknown error'}`);
    } finally {
      setIsRetrying(false);
    }
  };

  const routing = resolveDepartmentRouting(
    currentAnalysis?.issue_categories[0] || feedback.issue_category,
    currentAnalysis?.food_safety_flag,
    currentAnalysis?.severity_score
  );

  const getSentimentBadge = (s?: string) => {
    switch (s?.toLowerCase()) {
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

  const getSeverityBadge = (sev?: number) => {
    if (!sev) return 'text-slate-600 bg-slate-100 border-slate-200';
    if (sev >= 4) return 'text-red-700 bg-red-50 border-red-200';
    if (sev === 3) return 'text-amber-800 bg-amber-50 border-amber-200';
    return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white border border-slate-200 p-6 shadow-xl relative max-h-[92vh] overflow-y-auto">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-2xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">AI Feedback Intelligence</h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                  {feedback.feedback_id || feedback.id.slice(0, 8)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Deterministic Aspect Extraction &amp; Sentiment Classification • Model: <span className="font-mono text-blue-700 font-semibold">{currentAnalysis?.model_name || 'langchain-extractor'}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRetryAnalysis}
              disabled={isRetrying}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 transition border border-slate-200/80"
              title="Force re-execution of AI analysis agent on this feedback"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin text-blue-600' : 'text-slate-600'}`} />
              <span>{isRetrying ? 'Analyzing...' : 'Re-analyze'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {retryMessage && (
          <div className="mt-3 p-3 rounded-lg text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{retryMessage}</span>
          </div>
        )}

        {/* SECTION 1: ORIGINAL STUDENT INPUT */}
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                Original Feedback (Database Record)
              </span>
              <span className="text-xs text-slate-500">
                Channel: <strong className="capitalize text-slate-700">{feedback.channel || 'canteen_form'}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{feedback.date ? new Date(feedback.date).toLocaleString() : 'N/A'}</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Utensils className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-bold text-slate-900">{feedback.item || 'General Feedback'}</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-600">{feedback.meal_type || 'General Service'}</span>
              </div>
              {feedback.rating ? (
                <div className="flex items-center gap-1 font-semibold text-amber-600">
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < (feedback.rating || 0)
                            ? 'text-amber-500 fill-amber-400'
                            : 'text-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-slate-700 ml-1">({feedback.rating}/5)</span>
                </div>
              ) : (
                <span className="text-xs text-slate-400">No star rating</span>
              )}
            </div>

            <p className="text-xs text-slate-800 leading-relaxed italic pt-1">
              "{feedback.comment || 'No text review was submitted with this record.'}"
            </p>
          </div>
        </div>

        {/* SECTION 2: AI-GENERATED INTELLIGENCE */}
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                AI Intelligence &amp; Structured Extraction
              </span>
            </div>
            {currentAnalysis?.created_at && (
              <span className="text-xs text-slate-400">
                Analyzed: {new Date(currentAnalysis.created_at).toLocaleString()}
              </span>
            )}
          </div>

          {!currentAnalysis ? (
            <div className="p-6 rounded-xl border border-dashed border-amber-300 bg-amber-50/50 text-center space-y-2">
              <AlertTriangle className="w-6 h-6 text-amber-600 mx-auto" />
              <p className="text-xs font-bold text-amber-900">No AI analysis available for this feedback</p>
              <p className="text-xs text-amber-700">Click the Re-analyze button above to trigger AI extraction.</p>
            </div>
          ) : (
            <>
              {/* Critical Food Safety Alert if active */}
              {currentAnalysis.food_safety_flag && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-300 text-red-900 shadow-2xs">
                  <div className="flex items-center gap-2 font-bold text-xs text-red-700 uppercase tracking-wide">
                    <ShieldAlert className="w-4 h-4 text-red-600" />
                    <span>Rule 9 Food Safety Hazard Triggered</span>
                  </div>
                  <ul className="mt-2 text-xs space-y-1 list-disc list-inside text-red-800 font-medium">
                    {currentAnalysis.food_safety_reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Analytical Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Detected Sentiment</div>
                  <span
                    className={`mt-1.5 inline-block px-2.5 py-0.5 rounded-full text-xs font-bold capitalize border ${getSentimentBadge(
                      currentAnalysis.sentiment
                    )}`}
                  >
                    {currentAnalysis.sentiment}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Severity Level</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${getSeverityBadge(
                        currentAnalysis.severity_score
                      )}`}
                    >
                      Severity {currentAnalysis.severity_score} / 5
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Uncertainty Score</div>
                  <div className="mt-1.5 text-xs font-mono font-bold text-slate-700">
                    {Math.round((currentAnalysis.uncertainty_score || 0) * 100)}%
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Language</div>
                  <div className="mt-1.5 text-xs font-mono font-bold text-slate-700 uppercase">
                    {currentAnalysis.language || 'EN'}
                  </div>
                </div>
              </div>

              {/* Topics, Categories & Extracted Entities */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-blue-600" />
                    <span>Issue Categories</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {currentAnalysis.issue_categories.length > 0 ? (
                      currentAnalysis.issue_categories.map((cat) => (
                        <span
                          key={cat}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200"
                        >
                          {cat}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">None identified</span>
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Mentioned Dishes &amp; Aspects</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {currentAnalysis.mentioned_food_items.length > 0 ? (
                      currentAnalysis.mentioned_food_items.map((item) => (
                        <span
                          key={item}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                        >
                          {item}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">No specific dish</span>
                    )}
                    {currentAnalysis.service_aspects?.map((aspect) => (
                      <span
                        key={aspect}
                        className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200"
                      >
                        {aspect}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Extracted Evidence Quotes */}
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Quote className="w-3.5 h-3.5 text-amber-600" />
                  <span>Important Keywords &amp; Extracted Evidence</span>
                </div>
                {currentAnalysis.evidence_quotes.length > 0 ? (
                  <div className="space-y-1.5">
                    {currentAnalysis.evidence_quotes.map((q, i) => (
                      <div
                        key={i}
                        className="px-3 py-2 rounded-lg bg-amber-50/50 border border-amber-200/70 text-xs text-amber-900 font-medium"
                      >
                        "{q}"
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No specific direct quotes were segmented.</p>
                )}
              </div>

              {/* Suggested Corrective Action & Operational Department */}
              <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-blue-900">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span>Suggested Corrective Action &amp; Operational Routing</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
                    CAPA Dispatch
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-blue-200/70 shadow-2xs">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Assigned Dept</div>
                    <div className="font-bold text-slate-900 mt-0.5">{routing.department}</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-blue-200/70 shadow-2xs">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Responsible Role</div>
                    <div className="font-bold text-blue-700 mt-0.5">{routing.role}</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-blue-200/70 shadow-2xs">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Resolution SLA</div>
                    <div className="font-bold text-slate-800 mt-0.5 font-mono text-[11px]">
                      {currentAnalysis.food_safety_flag ? '2 Hours (Critical Emergency)' : '24 Hours'}
                    </div>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-blue-200/70 text-xs text-slate-700 leading-relaxed">
                  <strong>Recommended Action:</strong> Initiate root-cause inspection for{' '}
                  <span className="font-semibold text-blue-700">{feedback.item || 'this item'}</span> regarding{' '}
                  <span className="font-semibold">{currentAnalysis.issue_categories[0] || 'quality standards'}</span>.
                  Verify holding temperature, portion consistency, and vendor freshness logs.
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between items-center">
          <div className="text-[11px] text-slate-400">
            Source Dataset: <span className="font-mono">{feedback.source_dataset || 'manual_entry'}</span>
          </div>
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
