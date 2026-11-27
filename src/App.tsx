import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { IncidentLayout } from './pages/IncidentLayout';
import { Overview } from './pages/Overview';
import { FormsPage } from './pages/FormsPage';
import { OpsPage } from './pages/OpsPage';
import { TeamsPage } from './pages/TeamsPage';
import { CluesPage } from './pages/CluesPage';
import { SubjectPage } from './pages/SubjectPage';
import { ReferencePage } from './pages/ReferencePage';
import { FieldPage } from './pages/FieldPage';
import { PrintIap } from './pages/PrintIap';
const RescuePage = lazy(() => import('./modules/rescue/RescuePage').then((m) => ({ default: m.RescuePage })));
const AvalanchePage = lazy(() => import('./avalanche/AvalanchePage').then((m) => ({ default: m.AvalanchePage })));
import { AvControlPage } from './modules/avcontrol/AvControlPage';
const SearchMapTab = lazy(() => import('./searchmap/SearchMapTab').then((m) => ({ default: m.SearchMapTab })));

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/reference" element={<ReferencePage />} />
        <Route path="/i/:incidentId/field" element={<FieldPage />} />
        <Route path="/i/:incidentId/print" element={<PrintIap />} />
        <Route path="/i/:incidentId" element={<IncidentLayout />}>
          <Route index element={<Overview />} />
          <Route path="forms/:form?" element={<FormsPage />} />
          <Route path="periods" element={<OpsPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="map" element={<Suspense fallback={<p>Loading map…</p>}><SearchMapTab /></Suspense>} />
          <Route path="rescue/:tab?" element={<Suspense fallback={<p>Loading…</p>}><RescuePage /></Suspense>} />
          <Route path="avalanche" element={<Suspense fallback={<p>Loading…</p>}><AvalanchePage /></Suspense>} />
          <Route path="avcontrol" element={<AvControlPage />} />
          <Route path="clues" element={<CluesPage />} />
          <Route path="subject" element={<SubjectPage />} />
          <Route path="reference" element={<ReferencePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
}
