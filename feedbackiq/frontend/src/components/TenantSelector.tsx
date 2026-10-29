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
      <div className="rounded-2xl bg-gradient-to-r from-slate-900/90 to-slate-900/40 border border-slate-800 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-100">
                  {currentOrg?.name || 'No Active Tenant Selected'}
                </h3>
                {currentOrg && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase">
                    {currentOrg.template_type}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Tenant Slug: {currentOrg?.slug || 'none'} • UUID: {currentOrg?.id || 'none'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenModal}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition"
            >
              <Plus className="w-4 h-4" />
              Onboard Organization
            </button>
          </div>
        </div>

        {/* Template Configuration Details */}
        {currentOrg && (
          <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-slate-950/40 border border-slate-800/60 p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-2">
                <Utensils className="w-3.5 h-3.5 text-emerald-400" />
                <span>Service / Meal Slots</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(activeTemplateConfig.meal_slots || ['Breakfast', 'Lunch', 'Dinner']).map(
                  (slot: string) => (
                    <span
                      key={slot}
                      className="px-2 py-0.5 rounded bg-slate-800/80 text-[11px] text-slate-300"
                    >
                      {slot}
                    </span>
                  )
                )}
              </div>
            </div>

            <div className="rounded-xl bg-slate-950/40 border border-slate-800/60 p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-2">
                <Tag className="w-3.5 h-3.5 text-cyan-400" />
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
                      className="px-2 py-0.5 rounded bg-slate-800/80 text-[11px] text-slate-300"
                    >
                      {cat}
                    </span>
                  ))}
                {(activeTemplateConfig.default_categories || []).length > 4 && (
                  <span className="px-2 py-0.5 rounded bg-slate-800/80 text-[11px] text-slate-400">
                    +{activeTemplateConfig.default_categories.length - 4} more
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-slate-950/40 border border-slate-800/60 p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-2">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Escalation Resolution SLA</span>
              </div>
              <div className="text-base font-bold text-slate-100">
                {activeTemplateConfig.sla_resolution_hours || 24} Hours
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Target turnaround for high-risk recurring incidents
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Available Organization Tenants Table */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5">
        <h4 className="text-sm font-semibold text-slate-200 mb-3">
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
                    ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/20'
                    : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-200">{org.name}</span>
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase font-medium">
                    {org.template_type}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">slug: {org.slug}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Tenant Modal */}
      {isOpenModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl relative">
            <button
              onClick={onCloseModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-slate-100">Onboard New Organization</h3>
            <p className="text-xs text-slate-400 mt-1">
              Select an organization template. The platform automatically adapts taxonomy, meal slots, and SLA rules.
            </p>

            {error && (
              <div className="mt-3 p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-xs text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal College Dining Hall"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tenant Slug (Unique identifier)
                </label>
                <input
                  type="text"
                  required
                  placeholder="royal-college-dining"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Template Architecture
                </label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {[
                    { id: 'college', name: 'Higher Education Campus', desc: 'Hostels, mess, meal slots' },
                    { id: 'restaurant', name: 'Dining Restaurant', desc: 'Lunch/dinner service, table QR' },
                    { id: 'corporate_cafeteria', name: 'Corporate Cafeteria', desc: 'Multi-counter, fast shifts' },
                    { id: 'custom', name: 'Custom Enterprise', desc: 'Configurable taxonomy & SLAs' },
                  ].map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setTemplateType(tpl.id as OrgTemplateType)}
                      className={`p-3 rounded-xl border text-left transition ${
                        templateType === tpl.id
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-200">{tpl.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{tpl.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onCloseModal}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition"
                >
                  {isSubmitting ? 'Creating Tenant...' : 'Initialize Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
