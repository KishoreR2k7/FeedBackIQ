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
    <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-6 backdrop-blur">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/60">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-slate-100">Core Engine Infrastructure</h2>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                isReady
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
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
          <p className="text-xs text-slate-400 mt-1">
            Real-time liveness & readiness telemetry across database, async sessions, and AI providers.
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-slate-200 disabled:opacity-50 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Checking...' : 'Ping Readiness Probe'}
        </button>
      </div>

      {/* Grid of Subsystem Checks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
        {/* PostgreSQL Database Subsystem */}
        <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>PostgreSQL (AsyncPG)</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                dbHealth?.connected
                  ? 'bg-emerald-500/10 text-emerald-300'
                  : 'bg-red-500/10 text-red-300'
              }`}
            >
              {dbHealth?.connected ? 'Connected' : 'Offline'}
            </span>
          </div>
          <div className="space-y-1.5 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="font-mono text-slate-200 capitalize">{dbHealth?.status || 'Unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span>Round-trip Latency:</span>
              <span className="font-mono text-emerald-400">{dbHealth?.latency_ms ?? '--'} ms</span>
            </div>
            <div className="flex justify-between">
              <span>Migrations:</span>
              <span className="text-slate-200">Alembic 001 applied</span>
            </div>
          </div>
        </div>

        {/* AI & LangChain LLM Provider Subsystem */}
        <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <Cpu className="w-4 h-4 text-purple-400" />
              <span>AI Engine (LangGraph)</span>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/10 text-purple-300">
              {llmEngine?.provider?.toUpperCase() || 'MOCK'}
            </span>
          </div>
          <div className="space-y-1.5 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Configured Model:</span>
              <span className="font-mono text-slate-200">{llmEngine?.model || 'gemini-1.5-flash'}</span>
            </div>
            <div className="flex justify-between">
              <span>Provider Status:</span>
              <span className="text-emerald-400">Ready for In-Context Graph</span>
            </div>
            <div className="flex justify-between">
              <span>Rule Engine:</span>
              <span className="text-slate-200">Deterministic Safety Safeguard</span>
            </div>
          </div>
        </div>

        {/* Multi-Tenant SaaS Environment */}
        <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>SaaS Platform Info</span>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-cyan-500/10 text-cyan-300">
              v{readiness?.version || '0.1.0'}
            </span>
          </div>
          <div className="space-y-1.5 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Deployment Mode:</span>
              <span className="capitalize text-slate-200">{readiness?.environment || 'Development'}</span>
            </div>
            <div className="flex justify-between">
              <span>Tenant Isolation:</span>
              <span className="text-emerald-400 font-medium">Server-Enforced</span>
            </div>
            <div className="flex justify-between">
              <span>API Gateway:</span>
              <span className="text-slate-200 font-mono">/api/v1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
