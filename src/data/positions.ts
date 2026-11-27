// ICS 203 / 207 positions. Keys are stable ids stored in OpPeriod.org.
import type { OrgSlot } from '../db/types';
export interface Position { key: string; title: string; section: string; parent?: string }

export const POSITIONS: Position[] = [
  { key: 'ic', title: 'Incident Commander', section: 'Command' },
  { key: 'dic', title: 'Deputy Incident Commander', section: 'Command', parent: 'ic' },
  { key: 'safety', title: 'Safety Officer', section: 'Command Staff', parent: 'ic' },
  { key: 'pio', title: 'Information Officer', section: 'Command Staff', parent: 'ic' },
  { key: 'liaison', title: 'Liaison Officer', section: 'Command Staff', parent: 'ic' },
  { key: 'ops', title: 'Operations Section Chief', section: 'Operations', parent: 'ic' },
  { key: 'ops-deputy', title: 'Operations Deputy', section: 'Operations', parent: 'ops' },
  { key: 'staging', title: 'Staging Area Manager', section: 'Operations', parent: 'ops' },
  { key: 'ground-branch', title: 'Ground Branch Director', section: 'Operations', parent: 'ops' },
  { key: 'air-ops', title: 'Air Operations Branch Director', section: 'Operations', parent: 'ops' },
  { key: 'helibase', title: 'Helibase Manager', section: 'Operations', parent: 'air-ops' },
  { key: 'plans', title: 'Planning Section Chief', section: 'Planning', parent: 'ic' },
  { key: 'resources-unit', title: 'Resources Unit Leader', section: 'Planning', parent: 'plans' },
  { key: 'situation-unit', title: 'Situation Unit Leader', section: 'Planning', parent: 'plans' },
  { key: 'documentation-unit', title: 'Documentation Unit Leader', section: 'Planning', parent: 'plans' },
  { key: 'demob-unit', title: 'Demobilization Unit Leader', section: 'Planning', parent: 'plans' },
  { key: 'tech-spec', title: 'Technical Specialist (Search Manager)', section: 'Planning', parent: 'plans' },
  { key: 'logistics', title: 'Logistics Section Chief', section: 'Logistics', parent: 'ic' },
  { key: 'comms-unit', title: 'Communications Unit Leader', section: 'Logistics', parent: 'logistics' },
  { key: 'medical-unit', title: 'Medical Unit Leader', section: 'Logistics', parent: 'logistics' },
  { key: 'supply-unit', title: 'Supply Unit Leader', section: 'Logistics', parent: 'logistics' },
  { key: 'facilities-unit', title: 'Facilities Unit Leader', section: 'Logistics', parent: 'logistics' },
  { key: 'ground-support', title: 'Ground Support Unit Leader', section: 'Logistics', parent: 'logistics' },
  { key: 'food-unit', title: 'Food Unit Leader', section: 'Logistics', parent: 'logistics' },
  { key: 'finance', title: 'Finance/Admin Section Chief', section: 'Finance/Admin', parent: 'ic' },
  { key: 'time-unit', title: 'Time Unit Leader', section: 'Finance/Admin', parent: 'finance' },
  { key: 'cost-unit', title: 'Cost Unit Leader', section: 'Finance/Admin', parent: 'finance' },
];

export const SECTIONS = ['Command', 'Command Staff', 'Operations', 'Planning', 'Logistics', 'Finance/Admin'];
export const SECTION_CHIEF: Record<string, string> = {
  Command: 'ic', 'Command Staff': 'ic', Operations: 'ops', Planning: 'plans', Logistics: 'logistics', 'Finance/Admin': 'finance',
};
type Org = Record<string, OrgSlot>;
export const isCustom = (key: string) => key.startsWith('x-');

/** Standard positions plus people added on the 203 (keys starting "x-"). */
export function orgPositions(org: Org = {}): Position[] {
  const extra = Object.entries(org).filter(([k]) => isCustom(k)).map(([key, v]) => ({
    key, title: v.title || 'Added position', section: v.section && SECTIONS.includes(v.section) ? v.section : 'Operations',
    parent: v.reportsTo || SECTION_CHIEF[v.section ?? 'Operations'] || 'ic',
  }));
  return [...POSITIONS, ...extra];
}

export const positionTitle = (key: string, org?: Org) =>
  POSITIONS.find((p) => p.key === key)?.title ?? (org?.[key]?.title || (isCustom(key) ? 'Added position' : key));

/** Default position a strike team reports to. */
export const defaultTeamLead = (org: Org) => (org['ground-branch']?.name ? 'ground-branch' : 'ops');
