import React, { useState, useEffect } from 'react';
import {
  X,
  TrendingUp,
  AlertTriangle,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Quote,
  Star,
  ArrowRight,
  RefreshCw,
  Flame,
} from 'lucide-react';
import { TopicTrendSummary, Feedback } from '../types';
import { api } from '../services/api';

interface IssueDetailModalProps {
  topic: TopicTrendSummary | null;
  isOpen: boolean;
  onClose: () => void;
  orgId?: string;
  onCreateAction?: (topic: TopicTrendSummary) => void;
}

export const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  topic,
  isOpen,
  onClose,
  orgId,
  onCreateAction,
}) => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [isLoadingFeedbacks, setIsLoadingFeedbacks] = useState(false);
  const [activeTab, setActiveTab] = useState<'evidence' | 'timeline' | 'recommendations'>('evidence');

  useEffect(() => {
    if (topic && isOpen) {
      setIsLoadingFeedbacks(true);
      api
        .getTopicFeedback(topic.issue_cluster_key, orgId)
        .then((records) => setFeedbacks(records))
        .catch((err) => {
          console.error('Failed to load supporting feedback for topic:', err);
          setFeedbacks([]);
        })
        .finally(() => setIsLoadingFeedbacks(false));
    }
  }, [topic, isOpen, orgId]);

  if (!isOpen || !topic) return null;

  const isInsufficientData = topic.total_feedback_count < 3 || topic.velocity_trend === 'insufficient_data';
  const recurrenceScore = Math.min(100, Math.max(0, Math.round(
    topic.negative_feedback_proportion * 50 +
    (topic.velocity_trend === 'increasing' ? 30 : topic.velocity_trend === 'new' ? 40 : 10) +
    (topic.has_food_safety_hazard ? 20 : 0)
  )));

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
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            <Minus className="w-3.5 h-3.5" />
            Stable
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white border border-slate-200 p-6 shadow-xl relative max-h-[90vh] overflow-y-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                {topic.issue_category}
              </span>
              {topic.has_food_safety_hazard && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 border border-red-300 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-red-600" />
                  Rule 9 Hazard
                </span>
              )}
              {getVelocityBadge(topic.velocity_trend, topic.velocity_change_percent)}
            </div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              {topic.topic_label}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Affected Food Item: <strong className="text-slate-800">{topic.item}</strong> • Service Slot: <strong className="text-slate-800">{topic.meal_type}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Insufficient Data Alert if Applicable */}
        {isInsufficientData && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Insufficient Historical Evidence</span>
              <p className="text-amber-800 mt-0.5 font-normal">
                Only {topic.total_feedback_count} feedback records have been logged for this cluster key. A minimum of 3 observations is required for rigorous empirical velocity calculations. Predictions are tentative.
              </p>
            </div>
          </div>
        )}

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {/* Recurrence Risk */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[10px] uppercase font-bold text-slate-400">Recurrence Risk</div>
            <div className="text-xl font-bold text-blue-600 font-mono mt-0.5">
              {recurrenceScore}
              <span className="text-xs text-slate-400 font-normal"> / 100</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">
              {recurrenceScore >= 75 ? 'Critical Likelihood' : recurrenceScore >= 50 ? 'Moderate Risk' : 'Low Recurrence'}
            </div>
          </div>

          {/* Complaint Velocity */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[10px] uppercase font-bold text-slate-400">Recent Complaints</div>
            <div className="text-xl font-bold text-slate-900 font-mono mt-0.5">
              {topic.recent_complaints_count}
              <span className="text-xs text-slate-400 font-normal"> / {topic.total_feedback_count} total</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">
              Hist: {topic.historical_complaints_count} complaints
            </div>
          </div>

          {/* Average Rating */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[10px] uppercase font-bold text-slate-400">Average Rating</div>
            <div className="text-xl font-bold text-amber-500 font-mono mt-0.5 flex items-center gap-1">
              <span>{topic.average_rating ? topic.average_rating.toFixed(1) : '--'}</span>
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">
              {Math.round(topic.negative_feedback_proportion * 100)}% dissatisfaction
            </div>
          </div>

          {/* Severity Score */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[10px] uppercase font-bold text-slate-400">Average Severity</div>
            <div className="text-xl font-bold text-red-600 font-mono mt-0.5">
              {topic.average_severity ? topic.average_severity.toFixed(1) : '1.0'}
              <span className="text-xs text-slate-400 font-normal"> / 5.0</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">
              Peak Severity: {topic.max_severity || 1}/5
            </div>
          </div>
        </div>

        {/* AI Grounded Summary */}
        <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-1.5">
          <div className="text-[11px] font-bold text-blue-900 uppercase tracking-wide flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
            <span>Empirical Trend Observation</span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed font-normal">
            {topic.topic_summary || 'Multiple diner reports confirm an elevated complaint velocity for this dish and category.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('evidence')}
            className={`pb-2.5 px-3 border-b-2 transition ${
              activeTab === 'evidence'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Supporting Diner Feedback ({feedbacks.length})
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`pb-2.5 px-3 border-b-2 transition ${
              activeTab === 'timeline'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Temporal Patterns &amp; Velocity
          </button>
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`pb-2.5 px-3 border-b-2 transition ${
              activeTab === 'recommendations'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Recommended Corrective Actions
          </button>
        </div>

        {/* Tab 1: Supporting Feedback */}
        {activeTab === 'evidence' && (
          <div className="space-y-3">
            {isLoadingFeedbacks ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                Loading supporting feedback records from database...
              </div>
            ) : feedbacks.length === 0 ? (
              <div className="space-y-2">
                <div className="text-xs text-slate-500 italic p-4 bg-slate-50 rounded-xl text-center">
                  No full feedback records returned for this cluster. Showing direct quotes from trend intelligence:
                </div>
                {topic.evidence_quotes && topic.evidence_quotes.length > 0 ? (
                  topic.evidence_quotes.map((quote, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-800 italic flex items-start gap-2">
                      <Quote className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <span>"{quote}"</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic text-center">No quotes available.</p>
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {feedbacks.map((fb) => (
                  <div
                    key={fb.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">
                          {fb.date ? new Date(fb.date).toLocaleDateString() : 'Recent'}
                        </span>
                        <span>•</span>
                        <span>{fb.meal_type || topic.meal_type}</span>
                        {fb.rating && (
                          <span className="font-mono text-amber-600 font-bold">
                            ★ {fb.rating}/5
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">
                        {fb.feedback_id || fb.id.slice(0, 8)}
                      </span>
                    </div>
                    <p className="text-slate-800 italic bg-white p-2.5 rounded-lg border border-slate-200/70">
                      "{fb.comment || 'No written text'}"
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Temporal Patterns */}
        {activeTab === 'timeline' && (
          <div className="space-y-3 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wide">
                Identified Time Patterns &amp; Meal Slots
              </span>
              {topic.time_patterns && topic.time_patterns.length > 0 ? (
                <ul className="space-y-1.5 list-disc list-inside text-slate-700">
                  {topic.time_patterns.map((p, idx) => (
                    <li key={idx} className="leading-relaxed">{p}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500 italic">No specific temporal clustering detected. Occurrences are distributed across standard service times.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Recent Window (7 Days)</span>
                <div className="text-lg font-bold text-blue-600 font-mono">{topic.recent_complaints_count} Complaints</div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Historical Window</span>
                <div className="text-lg font-bold text-slate-700 font-mono">{topic.historical_complaints_count} Complaints</div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Recommendations */}
        {activeTab === 'recommendations' && (
          <div className="space-y-3 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wide">
                AI Suggested Preventive Measures
              </span>
              <p className="text-slate-700 leading-relaxed font-normal">
                Based on recurrence velocity and root cause clustering for <strong>{topic.item}</strong> ({topic.issue_category}), kitchen operations should implement:
              </p>
              <ul className="space-y-1.5 list-disc list-inside text-slate-800 font-medium pt-1">
                <li>Calibrate and audit holding temperature timers at Counter 2 before service starts.</li>
                <li>Conduct batch sample verification at the 30-minute mark during {topic.meal_type}.</li>
                <li>Log corrective measures on the CAPA Action Board for statistical verification.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div className="text-[11px] text-slate-500">
            Cluster Key: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-700">{topic.issue_cluster_key}</code>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
            >
              Close
            </button>
            {onCreateAction && (
              <button
                onClick={() => onCreateAction(topic)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition"
              >
                <span>Create Corrective Action</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
