import { useSyncState } from '../lib/hooks';
import { fmtTime } from './ui';

export function SyncBadge() {
  const s = useSyncState();
  const label = {
    'local-only': 'Local only', offline: 'Offline, will sync', syncing: 'Syncing…', synced: `Synced ${fmtTime(s.lastSync)}`, error: 'Sync error',
  }[s.status];
  return (
    <span className={'sync ' + s.status} title={s.error ?? ''}>
      ● {label}{s.pending > 0 && s.status !== 'local-only' ? ` · ${s.pending} pending` : ''}
    </span>
  );
}
