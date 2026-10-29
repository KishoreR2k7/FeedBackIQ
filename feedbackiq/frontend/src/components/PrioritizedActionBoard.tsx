import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckSquare,
  ShieldAlert,
  Clock,
  UserCheck,
  Calendar,
  Sparkles,
  RefreshCw,
  Search,
  CheckCircle2,
  PlayCircle,
  Check,
  Award,
  Bell,
  Info,
  User,
  Shield,
  FileCheck,
  AlertTriangle,
  Flame,
} from 'lucide-react';
import { api } from '../services/api';
import {
  ActionTask,
  TaskStatusType,
  VerificationOutcomeType,
  VerificationResult,
  NotificationItem,
} from '../types';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';

interface PrioritizedActionBoardProps {
  orgId?: string;
  onRefreshData?: () => void;
}

export const PrioritizedActionBoard: React.FC<PrioritizedActionBoardProps> = ({
  orgId,
}) => {
  const [tasks, setTasks] = useState<ActionTask[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [actingRole, setActingRole] = useState<'org_admin' | 'staff' | 'quality_reviewer'>('org_admin');

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<string>('');
  const [searchItem, setSearchItem] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');

  // Modals state
  const [selectedTask, setSelectedTask] = useState<ActionTask | null>(null);
  const [actionModalType, setActionModalType] = useState<
    'approve' | 'assign' | 'status' | 'verify' | null
  >(null);

  // Form states for modals
  const [approvalDecision, setApprovalDecision] = useState<boolean>(true);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [assigneeName, setAssigneeName] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [statusProgress, setStatusProgress] = useState<string>('in_progress');
  const [completionNotes, setCompletionNotes] = useState<string>('');
  const [verificationWindowDays, setVerificationWindowDays] = useState<number>(7);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [isSubmittingModal, setIsSubmittingModal] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Notifications Drawer
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchTasks = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    try {
      const data = await api.getTasks(
        {
          status: statusFilter || undefined,
          risk_level: riskFilter || undefined,
          item: searchItem || undefined,
          responsible_role: roleFilter || undefined,
        },
        orgId
      );
      setTasks(data);
    } catch (err) {
      console.error('Failed to load action tasks:', err);
    } finally {
      setIsLoading(false);
    }
  }, [orgId, statusFilter, riskFilter, searchItem, roleFilter]);

  const fetchNotifications = useCallback(async () => {
    if (!orgId) return;
    try {
      const notifs = await api.getNotifications({ limit: 50 }, orgId);
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.is_read).length);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }, [orgId]);

  useEffect(() => {
    fetchTasks();
    fetchNotifications();
  }, [fetchTasks, fetchNotifications]);

  const handleGenerateTasks = async () => {
    if (!orgId) return;
    setIsGenerating(true);
    try {
      await api.generateTasks(orgId);
      await fetchTasks();
      await fetchNotifications();
    } catch (err) {
      console.error('Failed to synthesize tasks:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMarkNotificationRead = async (notifId: string) => {
    try {
      await api.markNotificationRead(notifId, orgId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  // Open modals
  const openApproveModal = (task: ActionTask) => {
    setSelectedTask(task);
    setApprovalDecision(true);
    setRejectionReason('');
    setAssigneeName(task.assignee_name || '');
    setDueDate(task.due_date ? task.due_date.substring(0, 10) : '');
    setModalError(null);
    setActionModalType('approve');
  };

  const openAssignModal = (task: ActionTask) => {
    setSelectedTask(task);
    setAssigneeName(task.assignee_name || 'Chef Executive');
    setDueDate(task.due_date ? task.due_date.substring(0, 10) : '');
    setModalError(null);
    setActionModalType('assign');
  };

  const openStatusModal = (task: ActionTask, nextStatus: string) => {
    setSelectedTask(task);
    setStatusProgress(nextStatus);
    setCompletionNotes(task.completion_notes || '');
    setModalError(null);
    setActionModalType('status');
  };

  const openVerifyModal = async (task: ActionTask) => {
    setSelectedTask(task);
    setVerificationResult(task.verification_results || null);
    setModalError(null);
    setActionModalType('verify');
  };

  // Submit Modal Actions
  const handleApproveSubmit = async () => {
    if (!selectedTask) return;
    setIsSubmittingModal(true);
    setModalError(null);
    try {
      await api.approveTask(
        selectedTask.id,
        {
          approved: approvalDecision,
          rejection_reason: approvalDecision ? undefined : rejectionReason,
          assignee_name: assigneeName || undefined,
          due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
        },
        actingRole,
        orgId
      );
      setActionModalType(null);
      await fetchTasks();
      await fetchNotifications();
    } catch (err: any) {
      setModalError(err.message || 'Failed to submit approval.');
    } finally {
      setIsSubmittingModal(false);
    }
  };

  const handleAssignSubmit = async () => {
    if (!selectedTask) return;
    if (!assigneeName.trim()) {
      setModalError('Assignee name is required.');
      return;
    }
    setIsSubmittingModal(true);
    setModalError(null);
    try {
      await api.assignTask(
        selectedTask.id,
        {
          assignee_id: '00000000-0000-0000-0000-000000000001',
          assignee_name: assigneeName,
          due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
        },
        actingRole,
        orgId
      );
      setActionModalType(null);
      await fetchTasks();
      await fetchNotifications();
    } catch (err: any) {
      setModalError(err.message || 'Failed to assign task.');
    } finally {
      setIsSubmittingModal(false);
    }
  };

  const handleStatusSubmit = async () => {
    if (!selectedTask) return;
    setIsSubmittingModal(true);
    setModalError(null);
    try {
      await api.updateTaskStatus(
        selectedTask.id,
        {
          status: statusProgress,
          completion_notes: completionNotes || undefined,
        },
        actingRole,
        orgId
      );
      setActionModalType(null);
      await fetchTasks();
      await fetchNotifications();
    } catch (err: any) {
      setModalError(err.message || 'Failed to update task status.');
    } finally {
      setIsSubmittingModal(false);
    }
  };

  const handleRunVerification = async () => {
    if (!selectedTask) return;
    setIsSubmittingModal(true);
    setModalError(null);
    try {
      const res = await api.verifyTask(selectedTask.id, verificationWindowDays, orgId);
      setVerificationResult(res);
      await fetchTasks();
    } catch (err: any) {
      setModalError(err.message || 'Failed to execute outcome verification.');
    } finally {
      setIsSubmittingModal(false);
    }
  };

  // Status badges & color helpers
  const getRiskBadge = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'critical':
        return 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
      case 'high':
        return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
      case 'medium':
        return 'bg-sky-500/15 text-sky-400 border border-sky-500/30';
      default:
        return 'bg-slate-500/15 text-slate-400 border border-slate-500/30';
    }
  };

  const getStatusBadge = (status: TaskStatusType) => {
    switch (status) {
      case 'proposed':
        return 'bg-purple-500/15 text-purple-300 border border-purple-500/30';
      case 'awaiting_approval':
        return 'bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse';
      case 'assigned':
        return 'bg-sky-500/15 text-sky-300 border border-sky-500/30';
      case 'in_progress':
        return 'bg-blue-500/20 text-blue-300 border border-blue-500/40';
      case 'completed':
        return 'bg-teal-500/15 text-teal-300 border border-teal-500/30';
      case 'verified':
        return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
      case 'rejected':
        return 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border border-slate-700';
    }
  };

  const getVerificationOutcomeBadge = (outcome: VerificationOutcomeType) => {
    switch (outcome) {
      case 'Improved':
        return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
      case 'Worsened':
        return 'bg-rose-500/20 text-rose-300 border border-rose-500/40';
      case 'No Clear Improvement':
        return 'bg-slate-500/20 text-slate-300 border border-slate-500/40';
      case 'Insufficient Evidence':
        return 'bg-amber-500/20 text-amber-300 border border-amber-500/40';
      default:
        return 'bg-slate-800 text-slate-400 border border-slate-700';
    }
  };

  // Summary counts
  const totalCount = tasks.length;
  const awaitingApprovalCount = tasks.filter((t) => t.status === 'awaiting_approval' || t.approval_status === 'awaiting_approval').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress' || t.status === 'assigned').length;
  const verifiedCount = tasks.filter((t) => t.status === 'verified').length;
  const safetyOverrideCount = tasks.filter((t) => t.is_safety_override).length;

  return (
    <div className="space-y-6">
      {/* Top Header & Persona Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/50 to-slate-950 border border-slate-800/90 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <CheckSquare className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Prioritized Action Board &amp; CAPA
            </h2>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              Implementation 3
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            Generates evidence-grounded corrective and preventive action recommendations (CAPA) with deterministic priority scoring, manager approvals, staff delegation, and closed-loop outcome verification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Notifications Button */}
          <button
            onClick={() => setShowNotificationsDrawer(!showNotificationsDrawer)}
            className="relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition shadow-sm"
          >
            <Bell className="w-4 h-4 text-amber-400" />
            <span>Alerts</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Persona Role Switcher for Testability */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-indigo-400" /> Persona:
            </span>
            <select
              value={actingRole}
              onChange={(e) => setActingRole(e.target.value as any)}
              className="bg-transparent text-emerald-300 font-semibold focus:outline-none cursor-pointer text-xs"
            >
              <option value="org_admin" className="bg-slate-900 text-slate-200">
                Operations Manager (Admin)
              </option>
              <option value="quality_reviewer" className="bg-slate-900 text-slate-200">
                Quality Reviewer (Reviewer)
              </option>
              <option value="staff" className="bg-slate-900 text-slate-200">
                Kitchen Staff (Operator)
              </option>
            </select>
          </div>

          {/* Synthesize Tasks from Intelligence */}
          <button
            onClick={handleGenerateTasks}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Synthesizing...' : 'Generate Action Tasks'}</span>
          </button>
        </div>
      </div>

      {/* KPI Counters Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-400 uppercase">Total Tasks</div>
            <div className="text-xl font-bold text-slate-100 mt-0.5">{totalCount}</div>
          </div>
          <FileCheck className="w-5 h-5 text-slate-500" />
        </div>

        <div className="p-4 rounded-xl bg-slate-900/40 border border-amber-500/30 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-amber-400 uppercase">Awaiting Approval</div>
            <div className="text-xl font-bold text-amber-300 mt-0.5">{awaitingApprovalCount}</div>
          </div>
          <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
        </div>

        <div className="p-4 rounded-xl bg-slate-900/40 border border-blue-500/30 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-blue-400 uppercase">In Progress</div>
            <div className="text-xl font-bold text-blue-300 mt-0.5">{inProgressCount}</div>
          </div>
          <PlayCircle className="w-5 h-5 text-blue-400" />
        </div>

        <div className="p-4 rounded-xl bg-slate-900/40 border border-emerald-500/30 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-emerald-400 uppercase">Verified</div>
            <div className="text-xl font-bold text-emerald-300 mt-0.5">{verifiedCount}</div>
          </div>
          <Award className="w-5 h-5 text-emerald-400" />
        </div>

        <div className="p-4 rounded-xl bg-slate-900/40 border border-rose-500/30 flex items-center justify-between col-span-2 md:col-span-1">
          <div>
            <div className="text-[11px] font-medium text-rose-400 uppercase">Safety Overrides</div>
            <div className="text-xl font-bold text-rose-300 mt-0.5">{safetyOverrideCount}</div>
          </div>
          <ShieldAlert className="w-5 h-5 text-rose-400" />
        </div>
      </div>

      {/* Notifications Drawer (Slide-down / Collapsible) */}
      {showNotificationsDrawer && (
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-amber-500/40 shadow-2xl space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                In-App Notifications &amp; Delivery Telemetry
              </h3>
            </div>
            <button
              onClick={() => setShowNotificationsDrawer(false)}
              className="text-slate-400 hover:text-slate-200 text-xs"
            >
              Close
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="text-xs text-slate-400 py-3 text-center">
              No recent notifications dispatched for this organization.
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs ${
                    notif.is_read
                      ? 'bg-slate-950/40 border-slate-800/60 opacity-70'
                      : 'bg-slate-950/90 border-amber-500/30'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200">{notif.title}</span>
                      <span
                        className={`text-[10px] px-2 py-0.2 rounded-md font-medium ${
                          notif.delivery_status === 'delivered'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : notif.delivery_status === 'simulated'
                            ? 'bg-sky-500/20 text-sky-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {notif.delivery_status}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(notif.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">{notif.message}</p>
                  </div>
                  {!notif.is_read && (
                    <button
                      onClick={() => handleMarkNotificationRead(notif.id)}
                      className="shrink-0 text-[10px] px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filter Controls Bar */}
      <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Item */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Filter by food item..."
              value={searchItem}
              onChange={(e) => setSearchItem(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 w-48"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none"
          >
            <option value="">All Lifecycle Stages</option>
            <option value="proposed">Proposed</option>
            <option value="awaiting_approval">Awaiting Approval</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Risk Filter */}
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none"
          >
            <option value="">All Risk Levels</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {/* Responsible Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none"
          >
            <option value="">All Roles</option>
            <option value="Head Chef">Head Chef</option>
            <option value="Food Safety Officer">Food Safety Officer</option>
            <option value="Quality Assurance Lead">Quality Assurance Lead</option>
            <option value="Canteen Operations Manager">Canteen Operations Manager</option>
            <option value="Hygiene Supervisor">Hygiene Supervisor</option>
          </select>
        </div>

        <button
          onClick={fetchTasks}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Action Tasks List / Cards */}
      {isLoading ? (
        <LoadingState
          message="Retrieving CAPA Action Board..."
          subtext="Loading prioritized corrective action plans, staff assignments, and verification benchmarks"
        />
      ) : tasks.length === 0 ? (
        <EmptyState
          title="No Action Tasks Found"
          description="Synthesize action recommendations from your recurrence intelligence assessments or broaden your filter settings."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {tasks.map((task) => {
            const isSafety = task.is_safety_override;

            return (
              <div
                key={task.id}
                className={`p-5 rounded-2xl bg-slate-900/40 border transition-all hover:border-slate-700/80 ${
                  isSafety
                    ? 'border-rose-500/30 bg-rose-950/10'
                    : 'border-slate-800/80'
                }`}
              >
                {/* Task Header: Cluster Key, Priority Score, Risk, Safety override */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/70">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-slate-200">
                      {task.item || task.issue_cluster_key}
                    </span>
                    {task.issue_category && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-medium">
                        {task.issue_category}
                      </span>
                    )}
                    {task.meal_type && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800/60 text-slate-400 font-medium">
                        {task.meal_type}
                      </span>
                    )}

                    {/* Risk Badge */}
                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${getRiskBadge(
                        task.risk_level
                      )}`}
                    >
                      {task.risk_level} Risk
                    </span>

                    {/* Safety Override Pill */}
                    {isSafety && (
                      <span className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        <Flame className="w-3 h-3 text-rose-400" />
                        Rule 9 Safety Floor
                      </span>
                    )}
                  </div>

                  {/* Priority Score & Status Badges */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Priority Score</div>
                      <div className="text-base font-extrabold text-emerald-400 font-mono">
                        {task.priority_score.toFixed(1)} <span className="text-xs text-slate-500 font-normal">/ 100</span>
                      </div>
                    </div>

                    <div className="h-7 w-[1px] bg-slate-800" />

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider ${getStatusBadge(
                          task.status
                        )}`}
                      >
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Body: Issue summary, Evidence, Corrective & Preventive Actions */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 py-4">
                  {/* Left Column: Summary & Evidence */}
                  <div className="lg:col-span-5 space-y-3">
                    <div>
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Issue Summary
                      </div>
                      <p className="text-xs text-slate-200 mt-1 leading-relaxed font-medium">
                        {task.issue_summary}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                        <Info className="w-3 h-3 text-sky-400" />
                        Evidence &amp; Priority Rationale
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {task.evidence_and_priority_reason}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                      <div>
                        <span className="text-slate-500">Effort: </span>
                        <span className="font-semibold text-slate-300">{task.estimated_effort}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Approval Required: </span>
                        <span className="font-semibold text-slate-300">{task.required_approval}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Corrective & Preventive Action Plans */}
                  <div className="lg:col-span-7 space-y-3">
                    {/* Corrective Action (Immediate) */}
                    <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Suggested Corrective Action (Immediate)
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        {task.corrective_action}
                      </p>
                    </div>

                    {/* Preventive Action (Systemic) */}
                    <div className="p-3.5 rounded-xl bg-sky-500/5 border border-sky-500/20 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5" />
                          Suggested Preventive Action (Systemic Root-Cause)
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        {task.preventive_action}
                      </p>
                    </div>

                    {/* Verification criteria & expected outcome */}
                    <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                      <div>
                        <strong className="text-slate-300">Expected Outcome:</strong> {task.expected_outcome}
                      </div>
                      <div>
                        <strong className="text-slate-300">Verification Criteria:</strong> {task.verification_criteria}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Controls: Assignee, Due date, Completion note, Action Buttons */}
                <div className="pt-4 border-t border-slate-800/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Metadata: Role, Assignee, Due Date */}
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <span className="text-slate-500">Role:</span>
                      <span className="font-semibold text-emerald-400">{task.responsible_role}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-300">
                      <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-slate-500">Assignee:</span>
                      <span className="font-semibold text-slate-200">
                        {task.assignee_name || <em className="text-slate-500">Unassigned</em>}
                      </span>
                    </div>

                    {task.due_date && (
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-slate-500">Due:</span>
                        <span className="font-medium text-amber-300">
                          {new Date(task.due_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}

                    {task.completion_notes && (
                      <div className="text-[11px] text-teal-300 bg-teal-500/10 px-2.5 py-1 rounded-md border border-teal-500/20">
                        <strong>Notes:</strong> {task.completion_notes}
                      </div>
                    )}
                  </div>

                  {/* Contextual Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Approve / Reject Controls (Awaiting Approval or Proposed) */}
                    {(task.status === 'awaiting_approval' ||
                      task.status === 'proposed' ||
                      task.approval_status === 'awaiting_approval') && (
                      <>
                        <button
                          onClick={() => openApproveModal(task)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Review &amp; Approve</span>
                        </button>
                      </>
                    )}

                    {/* Assignment Control (Approved but not assigned) */}
                    {task.status === 'assigned' || task.approval_status === 'approved' ? (
                      <button
                        onClick={() => openAssignModal(task)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-sky-400" />
                        <span>Reassign</span>
                      </button>
                    ) : null}

                    {/* Advance to In-Progress */}
                    {task.status === 'assigned' && (
                      <button
                        onClick={() => openStatusModal(task, 'in_progress')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        <span>Start Work</span>
                      </button>
                    )}

                    {/* Complete Task */}
                    {task.status === 'in_progress' && (
                      <button
                        onClick={() => openStatusModal(task, 'completed')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white transition shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Completed</span>
                      </button>
                    )}

                    {/* Outcome Verification Button */}
                    {(task.status === 'completed' || task.status === 'verified') && (
                      <button
                        onClick={() => openVerifyModal(task)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>{task.status === 'verified' ? 'View Verification' : 'Verify Outcome'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Verification Result Display if Verified */}
                {task.verification_status && task.verification_status !== 'Pending' && (
                  <div className="mt-4 p-3.5 rounded-xl bg-slate-950/80 border border-indigo-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">
                        Closed-Loop Outcome:
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-md font-bold ${getVerificationOutcomeBadge(
                          task.verification_status
                        )}`}
                      >
                        {task.verification_status}
                      </span>
                    </div>

                    {task.verification_results && (
                      <div className="flex items-center gap-5 text-slate-300 font-mono text-[11px]">
                        <div>
                          Pre-Complaints:{' '}
                          <strong className="text-amber-400">
                            {task.verification_results.pre_action_complaints}
                          </strong>
                        </div>
                        <div>
                          Post-Complaints:{' '}
                          <strong className="text-emerald-400">
                            {task.verification_results.post_action_complaints}
                          </strong>
                        </div>
                        {task.verification_results.complaint_change_percent !== undefined && (
                          <div>
                            Change:{' '}
                            <strong
                              className={
                                task.verification_results.complaint_change_percent < 0
                                  ? 'text-emerald-400'
                                  : 'text-rose-400'
                              }
                            >
                              {task.verification_results.complaint_change_percent > 0 ? '+' : ''}
                              {task.verification_results.complaint_change_percent.toFixed(1)}%
                            </strong>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Manager Review & Approval */}
      {actionModalType === 'approve' && selectedTask && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                Manager Authorization &amp; Assignment
              </h3>
              <button
                onClick={() => setActionModalType(null)}
                className="text-slate-400 hover:text-slate-200 text-xs"
              >
                Cancel
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {modalError}
              </div>
            )}

            <div className="text-xs text-slate-300 space-y-1">
              <div className="font-semibold text-white">{selectedTask.item || selectedTask.issue_cluster_key}</div>
              <p className="text-slate-400">{selectedTask.issue_summary}</p>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase">
                  Approval Decision
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setApprovalDecision(true)}
                    className={`py-2 rounded-xl font-bold border transition ${
                      approvalDecision
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    ✓ Approve Action
                  </button>
                  <button
                    type="button"
                    onClick={() => setApprovalDecision(false)}
                    className={`py-2 rounded-xl font-bold border transition ${
                      !approvalDecision
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    ✕ Reject Action
                  </button>
                </div>
              </div>

              {approvalDecision ? (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase">
                      Assign to Staff / Role
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Chef Sanjay, Quality Inspector..."
                      value={assigneeName}
                      onChange={(e) => setAssigneeName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase">
                      Target Due Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase">
                    Rejection Reason
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Provide operational reason for rejecting this CAPA recommendation..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-rose-500"
                  />
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setActionModalType(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveSubmit}
                disabled={isSubmittingModal}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {isSubmittingModal ? 'Submitting...' : 'Confirm Decision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Assign Task */}
      {actionModalType === 'assign' && selectedTask && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-sky-400" />
                Delegate Task to Staff
              </h3>
              <button
                onClick={() => setActionModalType(null)}
                className="text-slate-400 hover:text-slate-200 text-xs"
              >
                Cancel
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {modalError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase">
                  Staff Assignee Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar (Kitchen Lead)"
                  value={assigneeName}
                  onChange={(e) => setAssigneeName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase">
                  Deadline / Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setActionModalType(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignSubmit}
                disabled={isSubmittingModal}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {isSubmittingModal ? 'Assigning...' : 'Assign Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Update Progress / Completion */}
      {actionModalType === 'status' && selectedTask && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-400" />
                Update Task Execution Progress
              </h3>
              <button
                onClick={() => setActionModalType(null)}
                className="text-slate-400 hover:text-slate-200 text-xs"
              >
                Cancel
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {modalError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase">
                  Target Status
                </label>
                <select
                  value={statusProgress}
                  onChange={(e) => setStatusProgress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-teal-500"
                >
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase">
                  Execution &amp; Completion Notes
                </label>
                <textarea
                  rows={4}
                  placeholder="Detail the actual corrective/preventive actions taken (e.g. recalibrated bain-marie temperature, replaced supplier batch, inspected oil)..."
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setActionModalType(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusSubmit}
                disabled={isSubmittingModal}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {isSubmittingModal ? 'Saving...' : 'Update Status'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Closed-Loop Outcome Verification */}
      {actionModalType === 'verify' && selectedTask && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-indigo-400" />
                Before/After Statistical Outcome Verification
              </h3>
              <button
                onClick={() => setActionModalType(null)}
                className="text-slate-400 hover:text-slate-200 text-xs"
              >
                Close
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {modalError}
              </div>
            )}

            <div className="text-xs text-slate-300">
              <div className="font-semibold text-white">{selectedTask.item || selectedTask.issue_cluster_key}</div>
              <p className="text-slate-400 text-[11px] mt-0.5">
                Evaluation Window: Compares complaint volumes and customer ratings strictly before vs. after completion of corrective measures.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <label className="text-[11px] font-semibold text-slate-400 uppercase">
                Comparison Window:
              </label>
              <select
                value={verificationWindowDays}
                onChange={(e) => setVerificationWindowDays(parseInt(e.target.value, 10))}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none"
              >
                <option value={7}>7 Days Pre vs 7 Days Post</option>
                <option value={14}>14 Days Pre vs 14 Days Post</option>
                <option value={30}>30 Days Pre vs 30 Days Post</option>
              </select>

              <button
                onClick={handleRunVerification}
                disabled={isSubmittingModal}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {isSubmittingModal ? 'Analyzing...' : 'Run Statistical Comparison'}
              </button>
            </div>

            {/* Verification Result Card */}
            {verificationResult && (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-indigo-500/30 space-y-3 mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">
                    Verification Outcome
                  </span>
                  <span
                    className={`text-xs px-3 py-1 rounded-lg font-bold ${getVerificationOutcomeBadge(
                      verificationResult.verification_status
                    )}`}
                  >
                    {verificationResult.verification_status}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Pre Complaints</div>
                    <div className="text-base font-bold text-amber-400 font-mono mt-0.5">
                      {verificationResult.pre_action_complaints}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Post Complaints</div>
                    <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                      {verificationResult.post_action_complaints}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Volume Change</div>
                    <div
                      className={`text-base font-bold font-mono mt-0.5 ${
                        (verificationResult.complaint_change_percent ?? 0) < 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {verificationResult.complaint_change_percent !== undefined
                        ? `${verificationResult.complaint_change_percent > 0 ? '+' : ''}${verificationResult.complaint_change_percent.toFixed(1)}%`
                        : 'N/A'}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Rating Delta</div>
                    <div className="text-base font-bold text-indigo-300 font-mono mt-0.5">
                      {verificationResult.post_action_avg_rating && verificationResult.pre_action_avg_rating
                        ? `${(verificationResult.post_action_avg_rating - verificationResult.pre_action_avg_rating).toFixed(2)} ★`
                        : 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                  <span className="font-semibold text-slate-400 uppercase tracking-wider block">
                    Non-Causal Analytical Disclosure
                  </span>
                  <p className="leading-relaxed">{verificationResult.non_causal_explanation}</p>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setActionModalType(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
