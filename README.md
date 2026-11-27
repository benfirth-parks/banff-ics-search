# Banff ICS for Search

An offline-capable web app (PWA) for running missing-person searches with the
Incident Command System: digital ICS 201-208 forms, operational periods, shift
handovers and transfer of command, plus simple field tools for team phones.

**v1 uses made-up training data only.** Do not enter real personal information.

## What's in v1
- **ICS forms 201-208** (ICS Canada fields, clean layout, printable). Data is
  entered once and flows between forms: objectives (201/202), organization
  (201/203/207), teams and assignments (204/207), safety (208 to 204), comms
  and hospitals (205/206 to 204).
- **Print IAP**: cover page plus the components ticked on the 202.
- **Operational periods**: roll over to the next period, copying org,
  objectives, comms, medical, safety and teams forward (unfinished assignments
  come forward as drafts). Past periods stay viewable and editable.
- **Handovers**: per-position shift handover (outgoing to incoming, summary,
  open-task checklist, timestamp). Transfer of command saves a snapshot of the
  201 briefing. Full position history.
- **Field view (phones)**: team assignment, one-tap check-ins with GPS, clue
  log with photo + GPS, assignment debrief, subject summary. Works offline.
- **Search basics**: subject profile, team status board with overdue
  check-in warning, clue log (links to CalTopo), debriefs per assignment.
- **Templates and pick-lists**: standard objectives, safety messages, team
  types, check-in statuses; sample staff list, radio channels, hospitals and
  helicopter companies (all fictional contacts). Editable under Reference.
- **Tabletop exercise**: "Load tabletop exercise" on the home screen, with the
  controller script in [docs/tabletop-scenario.md](docs/tabletop-scenario.md).

## Portal, feedback and Parks access
- Listed on the app portal (banff-app-portal) under Rescue and SAR, id `banff-ics-search`.
  `index.html` loads the portal tracker `t.js` with that id.
- `public/app-feedback.js` is a copy of the shared feedback box (master copy in
  the app-portal repo). Suggestions go to this site's Netlify form `app-feedback`.
- `netlify/edge-functions/parks-access.js` is an identical copy of the Parks
  access check (Canada only + portal Parks password). The master copy is in
  app-portal; update it there and copy it here.

## Search map
The **Search map** tab is the Lost Person search map builder (from
benfirth-parks/lost-person-probability, copied into `src/searchmap/`), built into
each incident:
- Fed from the forms: planning point (IPP/LKP/PLS), direction of travel, subject
  category and terrain live on the Subject profile and drive the map.
- One map per operational period; rollover copies it forward.
- Range rings and dispersion from the Lost Person Behavior table, ring-sector
  and trail segments, planned POD, and a CalTopo import file per period.
- "Create 204s" turns segments into ICS 204 assignments (segment = segment name).
- Debriefs take an achieved POD estimate; the map shows cumulative POD per
  segment across periods (1 - product of (1 - POD)).
- Ridge-and-creek segments and terrain shading need the terrain tiles that are
  deployed only with the Lost Person site, so ring sectors are the default here.
- Training use only, as in the source project. Sweep widths are exercise values.

## Sign-in
No accounts. Each incident gets a shared code (e.g. `ELK-4821`) shown in the
top bar. Others join with that code as Command post or Field team.

## Sync
Data is stored on the device first (IndexedDB), so everything works offline.
Multi-device sync uses Supabase:
1. Create a free Supabase project.
2. Run [supabase/schema.sql](supabase/schema.sql) in its SQL editor.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project settings →
   API) as Netlify environment variables, then redeploy.

Without those variables the app runs in local-only mode on one device.
Conflicts resolve per record, last edit wins.

## Develop
```
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build in dist/
```
Stack: Vite, React, TypeScript, Dexie (IndexedDB), vite-plugin-pwa, Supabase.
Incident types are modelled (`Incident.type`) so non-missing-person incidents
can be added later; the app can be wrapped natively (e.g. Capacitor) later.
