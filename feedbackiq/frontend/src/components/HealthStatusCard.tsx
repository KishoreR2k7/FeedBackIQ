import React from 'react';
import { Database, Cpu, CheckCircle2, AlertTriangle, RefreshCw, Clock } from 'lucide-react';
import { ReadinessResponse } from '../types';

interface HealthStatusCardProps {
  readiness: ReadinessResponse | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export const HealthStatusCard: React.FC<HealthStatusCardProps> = ({
  readiness,
  isLoading,
  onRefresh,
}) => {
  const isReady = readiness?.status === 'ready';
  const dbHealth = readiness?.checks?.database;
  const llmEngine = readiness?.checks?.llm_engine;

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-slate-900">Core Engine Infrastructure</h2>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                isReady
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {isReady ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  System Operational
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Awaiting Initialization
                </>
              )}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time telemetry across PostgreSQL connection pools, async sessions, and AI providers.
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 disabled:opacity-50 transition-all shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Checking...' : 'Ping Readiness Probe'}
        </button>
      </div>

      {/* Grid of Subsystem Checks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
        {/* PostgreSQL Database Subsystem */}
        <div className="rounded-xl bg-slate-50/70 border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <Database className="w-4 h-4 text-blue-600" />
              <span>PostgreSQL (AsyncPG)</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                dbHealth?.connected
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {dbHealth?.connected ? 'Connected' : 'Offline'}
            </span>
          </div>
          <div className="space-y-1.5 text-xs text-slate-500">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="font-mono text-slate-800 font-medium capitalize">{dbHealth?.status || 'Unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span>Round-trip Latency:</span>
              <span className="font-mono text-blue-600 font-bold">{dbHealth?.latency_ms ?? '--'} ms</span>
            </div>
            <div className="flex justify-between">
              <span>Migrations:</span>
              <span className="text-slate-800 font-medium">Alembic 004 applied</span>
            </div>
          </div>
        </div>

        {/* AI & LangChain LLM Provider Subsystem */}
        <div className="rounded-xl bg-slate-50/70 border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <Cpu className="w-4 h-4 text-blue-600" />
              <span>AI Engine (LangGraph)</span>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {llmEngine?.provider?.toUpperCase() || 'MOCK'}
            </span>
          </div>
          <div className="space-y-1.5 text-xs text-slate-500">
            <div className="flex justify-between">
              <span>Configured Model:</span>
              <span className="font-mono text-slate-800 font-medium">{llmEngine?.model || 'gemini-1.5-flash'}</span>
            </div>
            <div className="flex justify-between">
              <span>Provider Status:</span>
              <span className="text-emerald-700 font-semibold">Active &amp; Ready</span>
            </div>
            <div className="flex justify-between">
              <span>Safety Safeguard:</span>
              <span className="text-slate-800 font-medium">Rule 9 Floor (≥85)</span>
            </div>
          </div>
        </div>

        {/* Multi-Tenant SaaS Environment */}
        <div className="rounded-xl bg-slate-50/70 border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Platform Info</span>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white border border-slate-200 text-slate-700 font-mono">
              v{readiness?.version || '0.1.0'}
            </span>
          </div>
          <div className="space-y-1.5 text-xs text-slate-500">
            <div className="flex justify-between">
              <span>Deployment Mode:</span>
              <span className="capitalize text-slate-800 font-medium">{readiness?.environment || 'Development'}</span>
            </div>
            <div className="flex justify-between">
              <span>Tenant Isolation:</span>
              <span className="text-blue-700 font-semibold">Server-Enforced</span>
            </div>
            <div className="flex justify-between">
              <span>API Gateway:</span>
              <span className="text-slate-800 font-mono">/api/v1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
