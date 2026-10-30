export interface DepartmentRoutingInfo {
  department: string;
  role: string;
  code: 'kitchen' | 'hygiene' | 'procurement' | 'service' | 'facilities';
  badgeClass: string;
}

/**
 * Resolves the operational department and responsible in-charge role
 * based on issue category, food safety flags, or severity.
 */
export function resolveDepartmentRouting(
  category?: string | null,
  foodSafetyFlag?: boolean,
  severityScore?: number
): DepartmentRoutingInfo {
  if (foodSafetyFlag || (severityScore !== undefined && severityScore >= 5)) {
    return {
      department: 'Hygiene & Food Safety',
      role: 'Hygiene Supervisor',
      code: 'hygiene',
      badgeClass: 'bg-red-50 text-red-700 border-red-200',
    };
  }

  const cat = (category || '').toLowerCase().trim();

  if (cat === 'hygiene' || cat.includes('clean') || cat.includes('pest') || cat.includes('safety')) {
    return {
      department: 'Hygiene & Food Safety',
      role: 'Hygiene Supervisor',
      code: 'hygiene',
      badgeClass: 'bg-red-50 text-red-700 border-red-200',
    };
  }

  if (cat === 'freshness' || cat.includes('spoil') || cat.includes('rotten') || cat.includes('vendor')) {
    return {
      department: 'Procurement & Stores',
      role: 'Procurement & Kitchen Store Manager',
      code: 'procurement',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    };
  }

  if (cat === 'service' || cat === 'temperature' || cat.includes('wait') || cat.includes('queue') || cat.includes('counter')) {
    return {
      department: 'Dining Hall Operations',
      role: 'Dining Hall Operations Supervisor',
      code: 'service',
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    };
  }

  if (cat === 'ambience' || cat.includes('facility') || cat.includes('seat') || cat.includes('water')) {
    return {
      department: 'Facilities & Infrastructure',
      role: 'Facilities Manager',
      code: 'facilities',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    };
  }

  // Default for taste, portion size, recipe preparation, cooking defects:
  return {
    department: 'Kitchen & Food Production',
    role: 'Head Chef',
    code: 'kitchen',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  };
}
