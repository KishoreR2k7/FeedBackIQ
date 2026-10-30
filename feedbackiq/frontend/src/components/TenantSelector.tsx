import React, { useState } from 'react';
import { Building, Plus, Check, Clock, Utensils, Tag, X } from 'lucide-react';
import { Organization, OrgTemplateType, CreateOrganizationInput, OrgTemplateConfig } from '../types';

interface TenantSelectorProps {
  currentOrg: Organization | null;
  organizations: Organization[];
  templates: Record<string, OrgTemplateConfig>;
  onSelectOrg: (org: Organization) => void;
  onCreateOrg: (data: CreateOrganizationInput) => Promise<void>;
  isOpenModal: boolean;
  onCloseModal: () => void;
  onOpenModal: () => void;
}

export const TenantSelector: React.FC<TenantSelectorProps> = ({
  currentOrg,
  organizations,
  templates,
  onSelectOrg,
  onCreateOrg,
  isOpenModal,
  onCloseModal,
  onOpenModal,
}) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [templateType, setTemplateType] = useState<OrgTemplateType>('college');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    setSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await onCreateOrg({
        name: name.trim(),
        slug: slug.trim(),
        template_type: templateType,
      });
      setName('');
      setSlug('');
      onCloseModal();
    } catch (err: any) {
      setError(err.message || 'Failed to onboard organization');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeTemplateConfig = currentOrg?.settings || templates[currentOrg?.template_type || 'college'] || {};

  return (
    <div className="space-y-6">
      {/* Active Organization Header Card */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">
                  {currentOrg?.name || 'No Active Tenant Selected'}
                </h3>
                {currentOrg && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                    {currentOrg.template_type}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                Tenant Slug: {currentOrg?.slug || 'none'} • UUID: {currentOrg?.id || 'none'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenModal}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              Onboard Organization
            </button>
          </div>
        </div>

        {/* Template Configuration Details */}
        {currentOrg && (
          <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2">
                <Utensils className="w-3.5 h-3.5 text-blue-600" />
                <span>Service / Meal Slots</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(activeTemplateConfig.meal_slots || ['Breakfast', 'Lunch', 'Dinner']).map(
                  (slot: string) => (
                    <span
                      key={slot}
                      className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-medium text-slate-700 shadow-2xs"
                    >
                      {slot}
                    </span>
                  )
                )}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2">
                <Tag className="w-3.5 h-3.5 text-blue-600" />
                <span>Configured Issue Taxonomy</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(
                  activeTemplateConfig.default_categories || [
                    'Taste & Flavor',
                    'Hygiene',
                    'Temperature',
                  ]
                )
                  .slice(0, 4)
                  .map((cat: string) => (
                    <span
                      key={cat}
                      className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-medium text-slate-700 shadow-2xs"
                    >
                      {cat}
                    </span>
                  ))}
                {(activeTemplateConfig.default_categories || []).length > 4 && (
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] text-slate-500">
                    +{activeTemplateConfig.default_categories.length - 4} more
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Escalation Resolution SLA</span>
              </div>
              <div className="text-base font-bold text-slate-900">
                {activeTemplateConfig.sla_resolution_hours || 24} Hours
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Target turnaround for high-risk recurring incidents
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Available Organization Tenants Table */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs">
        <h4 className="text-sm font-bold text-slate-900 mb-3">
          Configured Tenant Environments ({organizations.length})
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {organizations.map((org) => {
            const isSelected = org.id === currentOrg?.id;
            return (
              <div
                key={org.id}
                onClick={() => onSelectOrg(org)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-blue-50/80 border-blue-400 ring-1 ring-blue-400 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">{org.name}</span>
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase font-semibold border border-slate-200">
                    {org.template_type}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono truncate">
                    {org.slug}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal for Onboarding New Tenant */}
      {isOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="rounded-2xl bg-white border border-slate-200 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Onboard New Tenant</h3>
              <button
                onClick={onCloseModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Organization / Canteen Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. North Hostel Dining Hall"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tenant Slug (URL Safe)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. north-hostel-dining"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Template Preset
                </label>
                <select
                  value={templateType}
                  onChange={(e) => setTemplateType(e.target.value as OrgTemplateType)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition cursor-pointer"
                >
                  <option value="college">Higher Education Campus &amp; Hostel Mess</option>
                  <option value="corporate">Corporate Office Food Court</option>
                  <option value="hospital">Hospital Patient &amp; Staff Dining</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onCloseModal}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 disabled:opacity-50 transition"
                >
                  {isSubmitting ? 'Creating...' : 'Initialize Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
