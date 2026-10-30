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
        return 'bg-red-50 text-red-700 border border-red-200';
      case 'high':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'medium':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  const getStatusBadge = (status: TaskStatusType) => {
    switch (status) {
      case 'proposed':
        return 'bg-slate-100 text-slate-700 border border-slate-200';
      case 'awaiting_approval':
        return 'bg-amber-50 text-amber-800 border border-amber-200 animate-pulse';
      case 'assigned':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border border-blue-300';
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'verified':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold';
      case 'rejected':
        return 'bg-red-50 text-red-700 border border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  const getVerificationOutcomeBadge = (outcome: VerificationOutcomeType) => {
    switch (outcome) {
      case 'Improved':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'Worsened':
        return 'bg-red-50 text-red-700 border border-red-200';
      case 'No Clear Improvement':
        return 'bg-slate-100 text-slate-700 border border-slate-200';
      case 'Insufficient Evidence':
        return 'bg-slate-100 text-slate-600 border border-slate-200';
      default:
        return 'bg-slate-100 text-slate-600 border border-slate-200';
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
              <CheckSquare className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Prioritized Action Board &amp; CAPA
            </h2>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200 font-mono">
              Capability 3
            </span>
          </div>
          <p className="text-xs text-slate-600 max-w-2xl font-medium">
            Generates evidence-grounded corrective and preventive action recommendations (CAPA) with deterministic priority scoring, manager approvals, staff delegation, and closed-loop outcome verification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Notifications Button */}
          <button
            onClick={() => setShowNotificationsDrawer(!showNotificationsDrawer)}
            className="relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition shadow-xs"
          >
            <Bell className="w-4 h-4 text-blue-600" />
            <span>Alerts</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-600 text-white font-mono">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Persona Role Switcher for Testability */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-blue-600" /> Persona:
            </span>
            <select
              value={actingRole}
              onChange={(e) => setActingRole(e.target.value as any)}
              className="bg-transparent text-blue-700 font-bold focus:outline-none cursor-pointer text-xs"
            >
              <option value="org_admin" className="bg-white text-slate-800">
                Operations Manager (Admin)
              </option>
              <option value="quality_reviewer" className="bg-white text-slate-800">
                Quality Reviewer (Reviewer)
              </option>
              <option value="staff" className="bg-white text-slate-800">
                Kitchen Staff (Operator)
              </option>
            </select>
          </div>

          {/* Synthesize Tasks from Intelligence */}
          <button
            onClick={handleGenerateTasks}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Synthesizing...' : 'Generate Action Tasks'}</span>
          </button>
        </div>
      </div>

      {/* KPI Counters Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Tasks</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5 font-mono">{totalCount}</div>
          </div>
          <FileCheck className="w-5 h-5 text-slate-400" />
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Awaiting Approval</div>
            <div className="text-xl font-bold text-amber-600 mt-0.5 font-mono">{awaitingApprovalCount}</div>
          </div>
          <Clock className="w-5 h-5 text-amber-500" />
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">In Progress</div>
            <div className="text-xl font-bold text-blue-600 mt-0.5 font-mono">{inProgressCount}</div>
          </div>
          <PlayCircle className="w-5 h-5 text-blue-500" />
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Verified</div>
            <div className="text-xl font-bold text-emerald-600 mt-0.5 font-mono">{verifiedCount}</div>
          </div>
          <Award className="w-5 h-5 text-emerald-500" />
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between col-span-2 md:col-span-1">
          <div>
            <div className="text-[11px] font-semibold text-red-600 uppercase tracking-wider">Safety Overrides</div>
            <div className="text-xl font-bold text-red-600 mt-0.5 font-mono">{safetyOverrideCount}</div>
          </div>
          <ShieldAlert className="w-5 h-5 text-red-500" />
        </div>
      </div>

      {/* Notifications Drawer (Slide-down / Collapsible) */}
      {showNotificationsDrawer && (
        <div className="p-5 rounded-2xl bg-white border border-blue-200 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                In-App Notifications &amp; Delivery Telemetry
              </h3>
            </div>
            <button
              onClick={() => setShowNotificationsDrawer(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
            >
              Close
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="text-xs text-slate-500 py-3 text-center">
              No recent notifications dispatched for this organization.
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs ${notif.is_read
                      ? 'bg-slate-50 border-slate-200 opacity-70'
                      : 'bg-blue-50/40 border-blue-200'
                    }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{notif.title}</span>
                      <span
                        className={`text-[10px] px-2 py-0.2 rounded-md font-medium ${notif.delivery_status === 'delivered'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : notif.delivery_status === 'simulated'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                      >
                        {notif.delivery_status}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(notif.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">{notif.message}</p>
                  </div>
                  {!notif.is_read && (
                    <button
                      onClick={() => handleMarkNotificationRead(notif.id)}
                      className="shrink-0 text-[10px] px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
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
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Item */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by food item..."
              value={searchItem}
              onChange={(e) => setSearchItem(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 w-48 font-medium"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
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
            className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
          >
            <option value="">All Risk Levels</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {/* Responsible Department & Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
          >
            <option value="">All Departments &amp; Roles</option>
            <option value="Head Chef">Kitchen: Head Chef</option>
            <option value="Hygiene Supervisor">Hygiene: Hygiene Supervisor</option>
            <option value="Food Safety Officer">Food Safety: Safety Officer</option>
            <option value="Dining Hall Operations Supervisor">Service: Dining Operations Supervisor</option>
            <option value="Procurement & Kitchen Store Manager">Stores: Procurement Manager</option>
            <option value="Canteen Operations Manager">Operations: Canteen Manager</option>
            <option value="Quality Assurance Lead">QA: QA Lead</option>
          </select>
        </div>

        <button
          onClick={fetchTasks}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
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
                className={`p-6 rounded-2xl bg-white border transition-all shadow-xs hover:shadow-md ${isSafety
                    ? 'border-red-300 bg-red-50/20 ring-1 ring-red-300/40'
                    : 'border-slate-200 hover:border-blue-300'
                  }`}
              >
                {/* Task Header: Cluster Key, Priority Score, Risk, Safety override */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {task.item || task.issue_cluster_key}
                    </span>
                    {task.issue_category && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium border border-slate-200">
                        {task.issue_category}
                      </span>
                    )}
                    {task.meal_type && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium border border-slate-200">
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
                      <span className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-red-600 text-white shadow-xs">
                        <Flame className="w-3 h-3 text-white" />
                        Rule 9 Safety Floor
                      </span>
                    )}
                  </div>

                  {/* Priority Score & Status Badges */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Priority Score</div>
                      <div className="text-xl font-black text-blue-600 font-mono">
                        {task.priority_score.toFixed(1)} <span className="text-xs text-slate-400 font-normal">/ 100</span>
                      </div>
                    </div>

                    <div className="h-7 w-[1px] bg-slate-200" />

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
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Issue Summary
                      </div>
                      <p className="text-xs text-slate-800 mt-1 leading-relaxed font-medium">
                        {task.issue_summary}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1.5 font-mono">
                        <Info className="w-3.5 h-3.5 text-blue-600" />
                        Evidence &amp; Priority Rationale
                      </div>
                      <p className="text-[11px] text-slate-700 leading-relaxed">
                        {task.evidence_and_priority_reason}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
                      <div>
                        <span className="text-slate-500">Effort: </span>
                        <span className="font-semibold text-slate-800">{task.estimated_effort}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Approval Required: </span>
                        <span className="font-semibold text-slate-800">{task.required_approval}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Corrective & Preventive Action Plans */}
                  <div className="lg:col-span-7 space-y-3">
                    {/* Corrective Action (Immediate) */}
                    <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                          Suggested Corrective Action (Immediate)
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed font-medium">
                        {task.corrective_action}
                      </p>
                    </div>

                    {/* Preventive Action (Systemic) */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-blue-600" />
                          Suggested Preventive Action (Systemic Root-Cause)
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {task.preventive_action}
                      </p>
                    </div>

                    {/* Verification criteria & expected outcome */}
                    <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                      <div>
                        <strong className="text-slate-800">Expected Outcome:</strong> {task.expected_outcome}
                      </div>
                      <div>
                        <strong className="text-slate-800">Verification Criteria:</strong> {task.verification_criteria}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Controls: Assignee, Due date, Completion note, Action Buttons */}
                <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Metadata: Role, Assignee, Due Date */}
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <span className="text-slate-500">Dept &amp; Role:</span>
                      <span className="font-semibold text-blue-700">{task.responsible_role}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-700">
                      <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-500">Assignee:</span>
                      <span className="font-semibold text-slate-800">
                        {task.assignee_name || <em className="text-slate-400">Unassigned</em>}
                      </span>
                    </div>

                    {task.due_date && (
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-500">Due:</span>
                        <span className="font-semibold text-amber-700">
                          {new Date(task.due_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}

                    {task.completion_notes && (
                      <div className="text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
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
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-xs"
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
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                        <span>Reassign</span>
                      </button>
                    ) : null}

                    {/* Advance to In-Progress */}
                    {task.status === 'assigned' && (
                      <button
                        onClick={() => openStatusModal(task, 'in_progress')}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-xs"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        <span>Start Work</span>
                      </button>
                    )}

                    {/* Complete Task */}
                    {task.status === 'in_progress' && (
                      <button
                        onClick={() => openStatusModal(task, 'completed')}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Completed</span>
                      </button>
                    )}

                    {/* Outcome Verification Button */}
                    {(task.status === 'completed' || task.status === 'verified') && (
                      <button
                        onClick={() => openVerifyModal(task)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-xs"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>{task.status === 'verified' ? 'View Verification' : 'Verify Outcome'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Verification Result Display if Verified */}
                {task.verification_status && task.verification_status !== 'Pending' && (
                  <div className="mt-4 p-3.5 rounded-xl bg-blue-50/50 border border-blue-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
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
                      <div className="flex items-center gap-5 text-slate-700 font-mono text-[11px]">
                        <div>
                          Pre-Complaints:{' '}
                          <strong className="text-amber-700">
                            {task.verification_results.pre_action_complaints}
                          </strong>
                        </div>
                        <div>
                          Post-Complaints:{' '}
                          <strong className="text-emerald-700">
                            {task.verification_results.post_action_complaints}
                          </strong>
                        </div>
                        {task.verification_results.complaint_change_percent !== undefined && (
                          <div>
                            Change:{' '}
                            <strong
                              className={
                                task.verification_results.complaint_change_percent < 0
                                  ? 'text-emerald-700'
                                  : 'text-red-700'
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-blue-600" />
                Manager Authorization &amp; Assignment
              </h3>
              <button
                onClick={() => setActionModalType(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                {modalError}
              </div>
            )}

            <div className="text-xs text-slate-700 space-y-1">
              <div className="font-bold text-slate-900">{selectedTask.item || selectedTask.issue_cluster_key}</div>
              <p className="text-slate-600">{selectedTask.issue_summary}</p>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1.5 uppercase">
                  Approval Decision
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setApprovalDecision(true)}
                    className={`py-2 rounded-xl font-bold border transition ${approvalDecision
                        ? 'bg-blue-50 text-blue-700 border-blue-400'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                  >
                    ✓ Approve Action
                  </button>
                  <button
                    type="button"
                    onClick={() => setApprovalDecision(false)}
                    className={`py-2 rounded-xl font-bold border transition ${!approvalDecision
                        ? 'bg-red-50 text-red-700 border-red-300'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                  >
                    ✕ Reject Action
                  </button>
                </div>
              </div>

              {approvalDecision ? (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase">
                      Assign to Staff / Role
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Chef Sanjay, Quality Inspector..."
                      value={assigneeName}
                      onChange={(e) => setAssigneeName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase">
                      Target Due Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase">
                    Rejection Reason
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Provide operational reason for rejecting this CAPA recommendation..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-red-500"
                  />
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setActionModalType(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveSubmit}
                disabled={isSubmittingModal}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition disabled:opacity-50 shadow-xs"
              >
                {isSubmittingModal ? 'Submitting...' : 'Confirm Decision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Assign Task */}
      {actionModalType === 'assign' && selectedTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-600" />
                Delegate Task to Staff
              </h3>
              <button
                onClick={() => setActionModalType(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                {modalError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase">
                  Staff Assignee Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar (Kitchen Lead)"
                  value={assigneeName}
                  onChange={(e) => setAssigneeName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase">
                  Deadline / Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setActionModalType(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignSubmit}
                disabled={isSubmittingModal}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition disabled:opacity-50 shadow-xs"
              >
                {isSubmittingModal ? 'Assigning...' : 'Assign Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Update Progress / Completion */}
      {actionModalType === 'status' && selectedTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                Update Task Execution Progress
              </h3>
              <button
                onClick={() => setActionModalType(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                {modalError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase">
                  Target Status
                </label>
                <select
                  value={statusProgress}
                  onChange={(e) => setStatusProgress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase">
                  Execution &amp; Completion Notes
                </label>
                <textarea
                  rows={4}
                  placeholder="Detail the actual corrective/preventive actions taken (e.g. recalibrated bain-marie temperature, replaced supplier batch, inspected oil)..."
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setActionModalType(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusSubmit}
                disabled={isSubmittingModal}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition disabled:opacity-50 shadow-xs"
              >
                {isSubmittingModal ? 'Saving...' : 'Update Status'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Closed-Loop Outcome Verification */}
      {actionModalType === 'verify' && selectedTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-blue-600" />
                Before/After Statistical Outcome Verification
              </h3>
              <button
                onClick={() => setActionModalType(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                Close
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                {modalError}
              </div>
            )}

            <div className="text-xs text-slate-700">
              <div className="font-bold text-slate-900">{selectedTask.item || selectedTask.issue_cluster_key}</div>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Evaluation Window: Compares complaint volumes and customer ratings strictly before vs. after completion of corrective measures.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <label className="text-[11px] font-semibold text-slate-600 uppercase">
                Comparison Window:
              </label>
              <select
                value={verificationWindowDays}
                onChange={(e) => setVerificationWindowDays(parseInt(e.target.value, 10))}
                className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value={7}>7 Days Pre vs 7 Days Post</option>
                <option value={14}>14 Days Pre vs 14 Days Post</option>
                <option value={30}>30 Days Pre vs 30 Days Post</option>
              </select>

              <button
                onClick={handleRunVerification}
                disabled={isSubmittingModal}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition disabled:opacity-50 shadow-xs"
              >
                {isSubmittingModal ? 'Analyzing...' : 'Run Statistical Comparison'}
              </button>
            </div>

            {/* Verification Result Card */}
            {verificationResult && (
              <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-200 space-y-3 mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600 uppercase">
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
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Pre Complaints</div>
                    <div className="text-base font-bold text-amber-700 font-mono mt-0.5">
                      {verificationResult.pre_action_complaints}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Post Complaints</div>
                    <div className="text-base font-bold text-emerald-700 font-mono mt-0.5">
                      {verificationResult.post_action_complaints}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Volume Change</div>
                    <div
                      className={`text-base font-bold font-mono mt-0.5 ${(verificationResult.complaint_change_percent ?? 0) < 0
                          ? 'text-emerald-700'
                          : 'text-red-700'
                        }`}
                    >
                      {verificationResult.complaint_change_percent !== undefined
                        ? `${verificationResult.complaint_change_percent > 0 ? '+' : ''}${verificationResult.complaint_change_percent.toFixed(1)}%`
                        : 'N/A'}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Rating Delta</div>
                    <div className="text-base font-bold text-blue-700 font-mono mt-0.5">
                      {verificationResult.post_action_avg_rating && verificationResult.pre_action_avg_rating
                        ? `${(verificationResult.post_action_avg_rating - verificationResult.pre_action_avg_rating).toFixed(2)} ★`
                        : 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-white border border-blue-200 text-[11px] text-slate-700 space-y-1">
                  <span className="font-bold text-blue-900 uppercase tracking-wider block">
                    Non-Causal Analytical Disclosure
                  </span>
                  <p className="leading-relaxed">{verificationResult.non_causal_explanation}</p>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setActionModalType(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold"
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
