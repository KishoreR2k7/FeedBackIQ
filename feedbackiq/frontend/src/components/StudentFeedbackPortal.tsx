import React, { useState } from 'react';
import {
  Utensils,
  Star,
  CheckCircle2,
  Send,
  Clock,
  ShieldCheck,
  ArrowLeft,
  Coffee,
  Sun,
  Sunset,
  Moon,
} from 'lucide-react';
import { api } from '../services/api';
import { Organization, Feedback } from '../types';

interface StudentFeedbackPortalProps {
  currentOrg: Organization | null;
  onBackToApp?: () => void;
  onFeedbackSubmitted?: () => void;
}

export const StudentFeedbackPortal: React.FC<StudentFeedbackPortalProps> = ({
  currentOrg,
  onBackToApp,
  onFeedbackSubmitted,
}) => {
  const [mealType, setMealType] = useState('Lunch');
  const [item, setItem] = useState('');
  const [rating, setRating] = useState<number>(4);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [category, setCategory] = useState('Taste & Flavor');
  const [studentId, setStudentId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedFeedback, setSubmittedFeedback] = useState<Feedback | null>(null);

  const mealSlots = [
    { id: 'Breakfast', label: 'Breakfast', icon: Coffee, time: '7:30 - 9:30 AM' },
    { id: 'Lunch', label: 'Lunch', icon: Sun, time: '12:30 - 2:30 PM' },
    { id: 'Evening Snacks', label: 'Snacks', icon: Sunset, time: '4:30 - 6:00 PM' },
    { id: 'Dinner', label: 'Dinner', icon: Moon, time: '7:30 - 9:30 PM' },
  ];

  const popularItems = [
    'Dal Tadka & Steamed Rice',
    'Cold Rice & Sambar',
    'Paneer Butter Masala',
    'Chicken Biryani',
    'Chapati & Mixed Veg',
    'Idli & Vada Chutney',
    'Curd Rice & Pickle',
    'Special Thali',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() && !item.trim()) {
      setErrorMessage('Please specify the food item or write a short comment.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        meal_type: mealType,
        item: item.trim() || 'General Dining',
        rating,
        comment: comment.trim(),
        issue_category: category,
        channel: 'student_form',
      };

      const result = await api.submitFeedback(payload, currentOrg?.id);
      setSubmittedFeedback(result);
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmittedFeedback(null);
    setItem('');
    setComment('');
    setRating(4);
    setStudentId('');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Student Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-8 py-3.5 shadow-2xs">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900">
                  {currentOrg ? currentOrg.name : 'Campus Food & Quality Portal'}
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Student Portal
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Official Canteen Quality Feedback &amp; Food Safety Reporting
              </p>
            </div>
          </div>

          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition border border-slate-200"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Management Console</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Form Body */}
      <main className="flex-1 max-w-3xl mx-auto w-full p-4 sm:p-6 my-4 sm:my-8">
        {submittedFeedback ? (
          /* Confirmation Message Screen */
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-sm text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">
                Thank You! Your Feedback Has Been Ingested
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                Your review has been securely saved to the database and analyzed by our quality intelligence agent.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 max-w-md mx-auto text-left space-y-2 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-semibold">Reference ID:</span>
                <span className="font-mono font-bold text-blue-700">
                  {submittedFeedback.feedback_id || submittedFeedback.id.slice(0, 8)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Meal &amp; Dish:</span>
                <span className="font-bold text-slate-800">
                  {submittedFeedback.meal_type} • {submittedFeedback.item}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Rating Given:</span>
                <div className="flex items-center gap-1 font-bold text-amber-600">
                  {submittedFeedback.rating} / 5 Stars
                </div>
              </div>
              {submittedFeedback.analysis && (
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-slate-500">AI Assessment:</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                      submittedFeedback.analysis.sentiment === 'positive'
                        ? 'bg-emerald-100 text-emerald-800'
                        : submittedFeedback.analysis.sentiment === 'negative'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {submittedFeedback.analysis.sentiment} (Sev {submittedFeedback.analysis.severity_score}/5)
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={handleReset}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm"
              >
                Submit Another Feedback
              </button>
              {onBackToApp && (
                <button
                  onClick={onBackToApp}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  Return to Dashboard
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Submission Form */
          <form
            onSubmit={handleSubmit}
            className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-8 shadow-sm space-y-6"
          >
            <div>
              <h2 className="text-lg font-bold text-slate-900">Share Your Meal Experience</h2>
              <p className="text-xs text-slate-500 mt-1">
                Help improve campus food standards. High severity and safety feedback automatically escalates to canteen supervision.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                {errorMessage}
              </div>
            )}

            {/* 1. Meal Slot Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                1. Select Meal Slot
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {mealSlots.map((slot) => {
                  const Icon = slot.icon;
                  const isSelected = mealType === slot.id;
                  return (
                    <button
                      type="button"
                      key={slot.id}
                      onClick={() => setMealType(slot.id)}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <Icon
                          className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}
                        />
                        {isSelected && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                      </div>
                      <div className="mt-2">
                        <div
                          className={`text-xs font-bold ${
                            isSelected ? 'text-blue-900' : 'text-slate-800'
                          }`}
                        >
                          {slot.label}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{slot.time}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Food Item Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                2. Food Item / Dish Name
              </label>
              <input
                type="text"
                value={item}
                onChange={(e) => setItem(e.target.value)}
                placeholder="e.g., Cold Rice & Sambar, Dal Tadka, Paneer Butter Masala..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-400 font-semibold mr-1">Quick pick:</span>
                {popularItems.slice(0, 4).map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setItem(p)}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 border border-slate-200 transition"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Star Rating */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  3. Overall Rating (1 to 5 Stars)
                </label>
                <span className="text-xs font-bold text-slate-800">
                  {rating === 5
                    ? 'Excellent'
                    : rating === 4
                    ? 'Good'
                    : rating === 3
                    ? 'Average'
                    : rating === 2
                    ? 'Poor'
                    : 'Critical / Unsatisfactory'}
                </span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 rounded-lg hover:scale-110 transition"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        star <= (hoverRating || rating)
                          ? 'text-amber-500 fill-amber-400'
                          : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs font-mono font-bold text-slate-600 ml-2">
                  {rating} of 5
                </span>
              </div>
            </div>

            {/* 4. Issue Category */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                4. Primary Quality Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="Taste & Flavor">Taste &amp; Flavor</option>
                <option value="Food Temperature">Food Temperature (e.g., Cold food)</option>
                <option value="Hygiene & Cleanliness">Hygiene &amp; Cleanliness (Hair, foreign object)</option>
                <option value="Freshness & Spoilage">Food Freshness &amp; Spoilage</option>
                <option value="Portion & Quantity">Portion &amp; Quantity</option>
                <option value="Service Delay">Serving Delay &amp; Counter Staff</option>
              </select>
            </div>

            {/* 5. Feedback Comment */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                5. Detailed Comments &amp; Observations
              </label>
              <textarea
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Describe your dining experience. For example: 'The rice was completely cold at 1:15 PM lunch station B' or 'Delicious hot sambar today!'"
                className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>

            {/* Optional Student Roll / ID */}
            <div className="pt-2">
              <label className="text-xs font-semibold text-slate-500">
                Student ID or Room No. (Optional, for resolution follow-up)
              </label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g., ST-8492 or Hostel Block 4"
                className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Submit Action */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Responses are directly ingested by the quality management system.</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting Feedback...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Canteen Feedback</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-slate-200 text-center text-xs text-slate-400">
        FeedbackIQ Quality Intelligence • Autonomous AI Feedback Orchestration
      </footer>
    </div>
  );
};
