import type { Incident, OpPeriod } from '../db/types';
export interface FormProps { incident: Incident; op: OpPeriod; update: (c: Partial<OpPeriod>) => void }
