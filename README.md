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

## Feedback
A **💬 Feedback** button sits bottom-left on every screen. Entries (problem / idea /
question, message, optional name, screen and device) go to Netlify Forms: see
the Netlify project → Forms → `feedback`, where you can also turn on email
notifications. Offline entries are queued and sent when the device reconnects.

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
