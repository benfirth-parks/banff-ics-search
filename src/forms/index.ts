import type { ComponentType } from 'react';
import type { FormProps } from './common';
import { Ics201 } from './Ics201';
import { Ics202 } from './Ics202';
import { Ics203 } from './Ics203';
import { Ics204 } from './Ics204';
import { Ics205 } from './Ics205';
import { Ics206 } from './Ics206';
import { Ics207 } from './Ics207';
import { Ics208 } from './Ics208';

export const FORMS: { num: string; title: string; Component: ComponentType<FormProps>; iap: boolean }[] = [
  { num: '201', title: 'Incident Briefing', Component: Ics201, iap: false },
  { num: '202', title: 'Incident Objectives', Component: Ics202, iap: true },
  { num: '203', title: 'Organization Assignment List', Component: Ics203, iap: true },
  { num: '204', title: 'Assignment List', Component: Ics204, iap: true },
  { num: '205', title: 'Incident Radio Communications Plan', Component: Ics205, iap: true },
  { num: '206', title: 'Medical Plan', Component: Ics206, iap: true },
  { num: '207', title: 'Incident Organization Chart', Component: Ics207, iap: true },
  { num: '208', title: 'Safety Message / Plan', Component: Ics208, iap: true },
];
