// Kept apart from the map code so other modules can use it without loading the map bundle.
import type { SearchMapRec } from '../db/types';

const emptyRows = () => ['25', '50', '75', '95'].map((percent) => ({ percent, value: '' }));

export const DEFAULT_SETTINGS: SearchMapRec['settings'] = {
  manual: false, rings: emptyRows(), ringSource: '', dispersion: emptyRows(), dispersionSource: '',
  // Ridge tiles are bundled only with the Lost Person site, so start with ring sectors here.
  sectors: '8', segRings: ['25', '50', '75'],
  trailWidth: '50', trailPiece: '1', trailRings: ['25', '50', '75'],
};
