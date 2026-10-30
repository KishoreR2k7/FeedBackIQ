import React, { useState, useMemo } from 'react';
import {
  GitPullRequest,
  CheckCircle2,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  Clock,
  Building2,
  RefreshCw,
  Check,
  ChevronRight,
  Calendar,
  AlertTriangle,
  UserCheck,
  TrendingUp,
  LayoutGrid,
  List,
} from 'lucide-react';
import { PaginatedFeedback, ActionTask } from '../types';
import { resolveDepartmentRouting } from '../utils/routing';

export type PipelineStage = 'ingested' | 'investigating' | 'in_progress' | 'resolved' | 'verified';

export interface FeedbackProgressItem {
  id: string;
  feedback_id: string;
  item: string;
  meal_type: string;
  comment: string;
  rating: number;
  issue_category: string;
  severity: number;
  is_safety_flag: boolean;
  department: string;
  stage: PipelineStage;
  progressPercent: number;
  sla_hours: number;
  assigned_to: string;
  resolution_notes?: string;
  updated_at: string;
  created_at: string;
  timeline: {
    stage: PipelineStage;
    label: string;
    timestamp?: string;
    completed: boolean;
  }[];
}

interface FeedbackProgressViewProps {
  feedbackData: PaginatedFeedback | null;
  tasks?: ActionTask[];
  isLoading: boolean;
  onRefresh: () => void;
  onNavigateToActions?: () => void;
}

export const STAGES_CONFIG: {
  key: PipelineStage;
  num: string;
  title: string;
  percent: number;
  desc: string;
}[] = [
  { key: 'ingested', num: '01', title: 'Ingested', percent: 20, desc: 'Feedback logged and awaiting initial department triage.' },
  { key: 'investigating', num: '02', title: 'Investigating', percent: 40, desc: 'Kitchen station audit and temperature log inspection underway.' },
  { key: 'in_progress', num: '03', title: 'In Progress', percent: 60, desc: 'Corrective action, recipe adjustment, or equipment fix in progress.' },
  { key: 'resolved', num: '04', title: 'Resolved', percent: 80, desc: 'Corrective action deployed and verified on the dining floor.' },
  { key: 'verified', num: '05', title: 'Verified', percent: 100, desc: 'Feedback closed with confirmed zero recurrence rate.' },
];

export const FeedbackProgressView: React.FC<FeedbackProgressViewProps> = ({
  feedbackData,
  tasks: _tasks = [],
  isLoading,
  onRefresh,
  onNavigateToActions: _onNavigateToActions,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState<'ALL' | PipelineStage>('ALL');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'journey'>('cards');
  const [noteInput, setNoteInput] = useState('');

  // Persistent stage overrides for interactive progress advancement
  const [stageOverrides, setStageOverrides] = useState<
    Record<string, { stage: PipelineStage; notes?: string }>
  >({});

  // Map progress items from feedback data or demo fallback
  const items: FeedbackProgressItem[] = useMemo(() => {
    if (!feedbackData || !feedbackData.items || feedbackData.items.length === 0) {
      return [
        {
          id: 'fb-demo-01',
          feedback_id: 'FB-REC-1001',
          item: 'Sambar Rice',
          meal_type: 'Lunch',
          comment: 'Sambar was ice cold again today at Station B warmer.',
          rating: 2,
          issue_category: 'Food Temperature',
          severity: 3,
          is_safety_flag: false,
          department: 'Kitchen Operations',
          stage: stageOverrides['fb-demo-01']?.stage || 'in_progress',
          progressPercent: 60,
          sla_hours: 12,
          assigned_to: 'Station B Lead Chef',
          resolution_notes: stageOverrides['fb-demo-01']?.notes || 'Bain-marie temperature adjusted to 68°C. Chef verified logs.',
          updated_at: '2 hours ago',
          created_at: '2026-10-29 12:45',
          timeline: [
            { stage: 'ingested', label: 'Ingested', timestamp: 'Oct 29, 12:45', completed: true },
            { stage: 'investigating', label: 'Investigating', timestamp: 'Oct 29, 13:10', completed: true },
            { stage: 'in_progress', label: 'In Progress', timestamp: 'Oct 29, 14:00', completed: true },
            { stage: 'resolved', label: 'Resolved', completed: false },
            { stage: 'verified', label: 'Verified', completed: false },
          ],
        },
        {
          id: 'fb-demo-02',
          feedback_id: 'FB-REC-1002',
          item: 'Chicken Curry',
          meal_type: 'Dinner',
          comment: 'Found a loose metal wire scrubber piece in the chicken gravy!',
          rating: 1,
          issue_category: 'Foreign Object Hazard',
          severity: 5,
          is_safety_flag: true,
          department: 'Food Safety & Hygiene',
          stage: stageOverrides['fb-demo-02']?.stage || 'investigating',
          progressPercent: 40,
          sla_hours: 2,
          assigned_to: 'Chief Safety Auditor',
          resolution_notes: stageOverrides['fb-demo-02']?.notes || 'Emergency batch recall initiated. Metal scrubbers replaced with nylon pads.',
          updated_at: '45 mins ago',
          created_at: '2026-10-29 20:15',
          timeline: [
            { stage: 'ingested', label: 'Ingested', timestamp: 'Oct 29, 20:15', completed: true },
            { stage: 'investigating', label: 'Investigating', timestamp: 'Oct 29, 20:25', completed: true },
            { stage: 'in_progress', label: 'In Progress', completed: false },
            { stage: 'resolved', label: 'Resolved', completed: false },
            { stage: 'verified', label: 'Verified', completed: false },
          ],
        },
        {
          id: 'fb-demo-03',
          feedback_id: 'FB-REC-1003',
          item: 'Dal Tadka',
          meal_type: 'Lunch',
          comment: 'Dal had strange sour smell and undercooked lentils.',
          rating: 1,
          issue_category: 'Spoilage & Taste',
          severity: 4,
          is_safety_flag: true,
          department: 'Kitchen Operations',
          stage: stageOverrides['fb-demo-03']?.stage || 'ingested',
          progressPercent: 20,
          sla_hours: 4,
          assigned_to: 'Head Chef & Triage Desk',
          resolution_notes: stageOverrides['fb-demo-03']?.notes,
          updated_at: '10 mins ago',
          created_at: '2026-10-30 10:15',
          timeline: [
            { stage: 'ingested', label: 'Ingested', timestamp: 'Oct 30, 10:15', completed: true },
            { stage: 'investigating', label: 'Investigating', completed: false },
            { stage: 'in_progress', label: 'In Progress', completed: false },
            { stage: 'resolved', label: 'Resolved', completed: false },
            { stage: 'verified', label: 'Verified', completed: false },
          ],
        },
        {
          id: 'fb-demo-04',
          feedback_id: 'FB-REC-1004',
          item: 'Masala Dosa',
          meal_type: 'Breakfast',
          comment: 'Dosa was crispy, chutney fresh and hot potato stuffing.',
          rating: 5,
          issue_category: 'Positive Appreciation',
          severity: 1,
          is_safety_flag: false,
          department: 'Kitchen Operations',
          stage: stageOverrides['fb-demo-04']?.stage || 'verified',
          progressPercent: 100,
          sla_hours: 24,
          assigned_to: 'Breakfast Line Team',
          resolution_notes: stageOverrides['fb-demo-04']?.notes || 'Positive benchmark recorded in shift handoff.',
          updated_at: 'Yesterday',
          created_at: '2026-10-29 08:30',
          timeline: [
            { stage: 'ingested', label: 'Ingested', timestamp: 'Oct 29, 08:30', completed: true },
            { stage: 'investigating', label: 'Investigating', timestamp: 'Oct 29, 08:45', completed: true },
            { stage: 'in_progress', label: 'In Progress', timestamp: 'Oct 29, 09:00', completed: true },
            { stage: 'resolved', label: 'Resolved', timestamp: 'Oct 29, 09:30', completed: true },
            { stage: 'verified', label: 'Verified', timestamp: 'Oct 29, 10:00', completed: true },
          ],
        },
      ];
    }

    return feedbackData.items.map((fb, idx) => {
      const routing = resolveDepartmentRouting(
        fb.issue_category,
        fb.analysis?.food_safety_flag || false,
        fb.analysis?.severity_score || 2
      );

      let defaultStage: PipelineStage = 'ingested';
      if (idx % 5 === 0) defaultStage = 'verified';
      else if (idx % 4 === 0) defaultStage = 'resolved';
      else if (idx % 3 === 0) defaultStage = 'in_progress';
      else if (idx % 2 === 0 || fb.analysis?.food_safety_flag) defaultStage = 'investigating';

      const currentStage = stageOverrides[fb.id]?.stage || defaultStage;
      const stageConfig = STAGES_CONFIG.find((s) => s.key === currentStage) || STAGES_CONFIG[0];
      const stageIndex = STAGES_CONFIG.findIndex((s) => s.key === currentStage);

      const timeline = STAGES_CONFIG.map((s, sIdx) => ({
        stage: s.key,
        label: s.title,
        completed: sIdx <= stageIndex,
        timestamp: sIdx <= stageIndex ? `${(stageIndex - sIdx + 1) * 2}h ago` : undefined,
      }));

      return {
        id: fb.id,
        feedback_id: fb.feedback_id || `FB-${fb.id.slice(0, 6).toUpperCase()}`,
        item: fb.item || 'Dining Service',
        meal_type: fb.meal_type || 'Lunch',
        comment: fb.comment || 'Feedback record without comment.',
        rating: fb.rating || 3,
        issue_category: fb.issue_category || 'Quality',
        severity: fb.analysis?.severity_score || (fb.rating ? 6 - fb.rating : 3),
        is_safety_flag: fb.analysis?.food_safety_flag || false,
        department: routing.department,
        stage: currentStage,
        progressPercent: stageConfig.percent,
        sla_hours: routing.department.includes('Safety') ? 2 : 24,
        assigned_to: routing.role,
        resolution_notes: stageOverrides[fb.id]?.notes,
        updated_at: 'Just now',
        created_at: fb.created_at || new Date().toISOString(),
        timeline,
      };
    });
  }, [feedbackData, stageOverrides]);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedStage !== 'ALL' && item.stage !== selectedStage) return false;
      if (selectedDept !== 'ALL' && item.department !== selectedDept) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.item.toLowerCase().includes(q) ||
          item.comment.toLowerCase().includes(q) ||
          item.feedback_id.toLowerCase().includes(q) ||
          item.meal_type.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, selectedStage, selectedDept, searchQuery]);

  // Selected item for journey view
  const selectedItem = useMemo(() => {
    if (selectedItemId) {
      const found = items.find((i) => i.id === selectedItemId);
      if (found) return found;
    }
    return filteredItems[0] || items[0] || null;
  }, [items, filteredItems, selectedItemId]);

  // Advance feedback stage
  const handleAdvanceStage = (itemId: string, nextStage: PipelineStage) => {
    setStageOverrides((prev) => ({
      ...prev,
      [itemId]: {
        stage: nextStage,
        notes: noteInput.trim() || prev[itemId]?.notes,
      },
    }));
    setNoteInput('');
  };

  const getNextStage = (current: PipelineStage): PipelineStage | null => {
    const idx = STAGES_CONFIG.findIndex((s) => s.key === current);
    if (idx < STAGES_CONFIG.length - 1) {
      return STAGES_CONFIG[idx + 1].key;
    }
    return null;
  };

  // Department list for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(i.department));
    return Array.from(set);
  }, [items]);

  // Stage distribution counts
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: items.length };
    STAGES_CONFIG.forEach((s) => (counts[s.key] = 0));
    items.forEach((i) => {
      counts[i.stage] = (counts[i.stage] || 0) + 1;
    });
    return counts;
  }, [items]);

  return (
    <div className="space-y-6 max-w-full text-left font-sans">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-950 tracking-tight">
                Feedback Progress &amp; Lifecycle Tracker
              </h1>
              <p className="text-xs text-slate-500">
                Track individual resolution milestones, progress percentage, and assigned department SLA for each feedback item.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                viewMode === 'cards'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Progress Cards</span>
            </button>
            <button
              onClick={() => setViewMode('journey')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                viewMode === 'journey'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <GitPullRequest className="w-3.5 h-3.5" />
              <span>Flow Journey</span>
            </button>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 5-Stage Metrics Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STAGES_CONFIG.map((stage) => {
          const count = stageCounts[stage.key] || 0;
          const isSelected = selectedStage === stage.key;

          return (
            <div
              key={stage.key}
              onClick={() => setSelectedStage(isSelected ? 'ALL' : stage.key)}
              className={`p-4 rounded-xl bg-white border cursor-pointer transition text-left space-y-2 ${
                isSelected
                  ? 'border-indigo-600 ring-2 ring-indigo-100 shadow-sm'
                  : 'border-slate-200/80 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-slate-400">
                  {stage.num}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold font-mono bg-indigo-50 text-indigo-700">
                  {stage.percent}%
                </span>
              </div>
              <div>
                <span className="text-xs font-bold text-slate-950 block">
                  {stage.title}
                </span>
                <span className="text-xl font-extrabold text-slate-900 font-mono mt-0.5 block">
                  {count}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  style={{ width: `${stage.percent}%` }}
                  className="bg-indigo-600 h-full rounded-full"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex-1 relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search feedback ID, food item, complaint keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-indigo-600 cursor-pointer font-medium"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Clear Filters */}
          {(selectedStage !== 'ALL' || selectedDept !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedStage('ALL');
                setSelectedDept('ALL');
                setSearchQuery('');
              }}
              className="text-xs text-indigo-600 hover:underline font-semibold px-2 py-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* View Mode 1: Individual Progress Cards for EACH Feedback */}
      {viewMode === 'cards' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
            <span>Showing progress for {filteredItems.length} customer feedback items</span>
            <span>Sorted by active lifecycle status</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredItems.map((item) => {
              const nextStage = getNextStage(item.stage);

              return (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 shadow-2xs space-y-4 text-left transition"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {item.feedback_id}
                        </span>
                        <h3 className="font-bold text-sm text-slate-950">
                          {item.item}
                        </h3>
                        <span className="text-xs text-slate-400 font-mono">
                          · {item.meal_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-indigo-600" />
                          {item.department}
                        </span>
                        <span>·</span>
                        <span className="font-mono">SLA: {item.sla_hours}h</span>
                      </div>
                    </div>

                    {/* Progress Badge */}
                    <div className="text-right">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                        <span>{item.progressPercent}%</span>
                        <span className="text-[10px] font-normal uppercase opacity-75">
                          {item.stage.replace('_', ' ')}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Student Review Quote */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <p className="text-slate-800 italic leading-relaxed">
                      "{item.comment}"
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1.5">
                      <span>Rating: ★ {item.rating}/5</span>
                      <span>Category: {item.issue_category}</span>
                    </div>
                  </div>

                  {/* Horizontal Progress Bar & 5-Step Indicators */}
                  <div className="space-y-2 pt-1">
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
                      <div
                        style={{ width: `${item.progressPercent}%` }}
                        className={`h-full transition-all duration-500 ${
                          item.progressPercent === 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                        }`}
                      />
                    </div>

                    {/* 5-Step Horizontal Breadcrumb */}
                    <div className="grid grid-cols-5 text-[10px] font-mono text-center gap-1 pt-0.5">
                      {STAGES_CONFIG.map((s, idx) => {
                        const currentIdx = STAGES_CONFIG.findIndex((sc) => sc.key === item.stage);
                        const isDone = idx <= currentIdx;
                        const isCurrent = idx === currentIdx;

                        return (
                          <div
                            key={s.key}
                            onClick={() => handleAdvanceStage(item.id, s.key)}
                            className={`py-1 rounded-md cursor-pointer transition ${
                              isCurrent
                                ? 'bg-indigo-600 text-white font-bold'
                                : isDone
                                ? 'bg-emerald-50 text-emerald-800 font-semibold'
                                : 'text-slate-400 hover:bg-slate-50'
                            }`}
                          >
                            <span>{s.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Resolution Notes / Action Footer */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div className="truncate text-slate-500 text-[11px]">
                      {item.resolution_notes ? (
                        <span className="text-slate-700">
                          <strong>Note:</strong> {item.resolution_notes}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">No notes logged yet.</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {nextStage ? (
                        <button
                          onClick={() => handleAdvanceStage(item.id, nextStage)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-2xs"
                        >
                          <span>Advance →</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Verified</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View Mode 2: Flow Journey Stepper View */}
      {viewMode === 'journey' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[520px]">
          {/* Left Flow Queue List */}
          <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200 p-4 space-y-2 overflow-y-auto max-h-[580px]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono pb-2 border-b border-slate-100">
              Select Feedback Flow ({filteredItems.length})
            </h3>

            {filteredItems.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItemId(item.id)}
                  className={`p-3.5 rounded-xl cursor-pointer transition text-left space-y-1.5 ${
                    isSelected
                      ? 'bg-indigo-50 border border-indigo-200 shadow-2xs'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{item.item}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold font-mono bg-white border border-slate-200 text-indigo-700">
                      {item.progressPercent}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">"{item.comment}"</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>{item.department}</span>
                    <span>SLA: {item.sla_hours}h</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Detailed Flow Journey Stepper with Arrows */}
          <div className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 p-6 space-y-6">
            {selectedItem ? (
              <>
                <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                      {selectedItem.feedback_id}
                    </span>
                    <h2 className="text-lg font-extrabold text-slate-950 mt-1">
                      {selectedItem.item} ({selectedItem.meal_type})
                    </h2>
                    <p className="text-xs text-slate-500">
                      Assigned to {selectedItem.department} · {selectedItem.sla_hours} Hours Target SLA
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-2xl font-extrabold text-indigo-600 font-mono">
                      {selectedItem.progressPercent}%
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono uppercase">
                      Progress Complete
                    </span>
                  </div>
                </div>

                {/* Evidence Quote */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Feedback Record:</span>
                  <p className="text-slate-800 text-sm font-medium italic">"{selectedItem.comment}"</p>
                </div>

                {/* Stepper with Arrows */}
                <div className="space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono block">
                    Milestone Progression Flow:
                  </span>

                  <div className="grid grid-cols-5 gap-1.5 items-center bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    {STAGES_CONFIG.map((s, index) => {
                      const currentIdx = STAGES_CONFIG.findIndex((sc) => sc.key === selectedItem.stage);
                      const isCompleted = index < currentIdx;
                      const isCurrent = index === currentIdx;

                      return (
                        <div
                          key={s.key}
                          onClick={() => handleAdvanceStage(selectedItem.id, s.key)}
                          className={`flex flex-col items-center text-center p-2 rounded-xl cursor-pointer transition ${
                            isCurrent
                              ? 'bg-indigo-600 text-white shadow-md'
                              : isCompleted
                              ? 'bg-emerald-50 text-emerald-900'
                              : 'text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mb-1 ${
                              isCurrent
                                ? 'bg-white text-indigo-600'
                                : isCompleted
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {isCompleted ? <Check className="w-3.5 h-3.5" /> : s.num}
                          </div>
                          <span className="text-[10px] font-bold truncate max-w-full">
                            {s.title}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Audit Resolution Notes Input */}
                <div className="p-4 rounded-xl bg-indigo-50/40 border border-indigo-100 space-y-3">
                  <span className="text-xs font-bold text-indigo-900 block">
                    Resolution Audit Trail &amp; Corrective Log:
                  </span>
                  <textarea
                    rows={2}
                    value={noteInput || selectedItem.resolution_notes || ''}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Document equipment fixes, temperature adjustments, or chef training..."
                    className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400">
                      Owner: {selectedItem.assigned_to}
                    </span>
                    {getNextStage(selectedItem.stage) ? (
                      <button
                        onClick={() => handleAdvanceStage(selectedItem.id, getNextStage(selectedItem.stage)!)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm"
                      >
                        <span>Advance to Next Stage</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                        ✓ Milestone 100% Completed
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">
                Select a feedback item on the left to inspect its flow.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
