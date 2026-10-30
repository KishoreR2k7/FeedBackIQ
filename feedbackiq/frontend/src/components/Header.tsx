import React from 'react';
import {
  Activity,
  BookOpen,
  Layers,
  ChevronDown,
  Menu,
  X,
  Utensils,
} from 'lucide-react';
import { Organization, ReadinessResponse } from '../types';

interface HeaderProps {
  currentOrg: Organization | null;
  organizations: Organization[];
  onSelectOrg: (org: Organization) => void;
  onOpenCreateOrgModal: () => void;
  readiness: ReadinessResponse | null;
  isChecking: boolean;
  onRefreshHealth: () => void;
  onNavigateTab?: (tab: string) => void;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
  userRole?: 'student' | 'manager' | 'admin';
  onSelectUserRole?: (role: 'student' | 'manager' | 'admin') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentOrg,
  organizations,
  onSelectOrg,
  onOpenCreateOrgModal,
  readiness,
  isChecking,
  onRefreshHealth,
  onNavigateTab,
  isMobileMenuOpen,
  onToggleMobileMenu,
  userRole = 'admin',
  onSelectUserRole,
}) => {
  const isReady = readiness?.status === 'ready';

  return (
    <header className="h-16 border-b border-slate-200 bg-white sticky top-0 z-30 px-3 sm:px-6 flex items-center justify-between shadow-2xs">
      {/* Brand & Mobile Toggle */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            aria-label="Toggle navigation menu"
            className="md:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
          >
            {isMobileMenuOpen ? (
              <X className="w-5 h-5 text-slate-700" />
            ) : (
              <Menu className="w-5 h-5 text-slate-700" />
            )}
          </button>
        )}

        <button
          onClick={() => onNavigateTab && onNavigateTab('dashboard')}
          className="flex items-center gap-2.5 text-left group"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-900 tracking-tight group-hover:text-blue-600 transition">
                FeedbackIQ
              </span>
              <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                SaaS MVP
              </span>
            </div>
          </div>
        </button>

        {/* Student Portal Quick Access Pill */}
        {onNavigateTab && (
          <button
            onClick={() => onNavigateTab('student-portal')}
            className="hidden lg:flex items-center gap-1.5 ml-2 px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 rounded-lg border border-emerald-200 transition"
          >
            <Utensils className="w-3.5 h-3.5 text-emerald-600" />
            <span>Student Portal</span>
          </button>
        )}
      </div>

      {/* Right Controls: Role Switcher, Tenant Switcher, Health Status, API Docs */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* User Role Switcher */}
        {onSelectUserRole && (
          <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-lg transition-colors">
            <select
              value={userRole}
              onChange={(e) => onSelectUserRole(e.target.value as any)}
              aria-label="Active user role"
              className="appearance-none bg-transparent text-xs font-semibold text-slate-700 pl-2.5 pr-6 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="admin">Role: Admin</option>
              <option value="manager">Role: Canteen Manager</option>
              <option value="student">Role: Student</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 pointer-events-none" />
          </div>
        )}

        {/* Active Tenant Dropdown */}
        <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors max-w-[140px] sm:max-w-[220px]">
          <select
            value={currentOrg?.id || ''}
            onChange={(e) => {
              if (e.target.value === '__create_new__') {
                onOpenCreateOrgModal();
              } else {
                const found = organizations.find((o) => o.id === e.target.value);
                if (found) onSelectOrg(found);
              }
            }}
            aria-label="Select active tenant organization"
            className="w-full appearance-none bg-transparent text-xs font-semibold text-slate-800 pl-2.5 pr-6 py-1.5 focus:outline-none cursor-pointer truncate"
          >
            {organizations.length === 0 ? (
              <option value="" className="text-slate-400">
                No Tenants
              </option>
            ) : (
              organizations.map((org) => (
                <option key={org.id} value={org.id} className="text-slate-800">
                  {org.name} ({org.template_type})
                </option>
              ))
            )}
            <option value="__create_new__" className="text-blue-600 font-semibold">
              + Onboard New Tenant...
            </option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-1.5 pointer-events-none" />
        </div>

        {/* Backend & DB Health Indicator */}
        <button
          onClick={onRefreshHealth}
          title="Click to ping Backend & PostgreSQL service health"
          className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
            isReady
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/60'
              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/60'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isReady ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          <span className="hidden md:inline">
            {isChecking ? 'Checking...' : isReady ? 'Services Online' : 'Degraded'}
          </span>
          <Activity
            className={`w-3.5 h-3.5 opacity-70 shrink-0 ${isChecking ? 'animate-spin' : ''}`}
          />
        </button>

        {/* Swagger / OpenAPI Docs */}
        <a
          href="/api/v1/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-slate-300 transition shadow-2xs"
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
          <span>API Docs</span>
        </a>
      </div>
    </header>
  );
};
