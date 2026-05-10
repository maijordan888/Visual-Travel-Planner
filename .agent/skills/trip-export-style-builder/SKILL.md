---
name: trip-export-style-builder
description: Create or modify reusable offline trip export styles for the travel_ai project. Use when adding a new Markdown/HTML/PDF booklet style, changing TripExportModal style selection, generating static travel booklet artwork, tuning print CSS palettes, or validating that export themes render correctly across Markdown preview, HTML preview, and browser print/PDF.
---

# Trip Export Style Builder

Use this skill to add or adjust `travel_ai` offline export booklet styles. The output is a reusable style option that works through `TripExportModal`, `buildTripMarkdown()`, `buildTripPrintHtml()`, and `/export-preview`.

## Workflow

1. Read the project export contract:
   - `.agent/knowledge/travel-planner-logic/PROJECT_KNOWLEDGE.md`, section `Markdown/PDF Offline Export Contract`
   - `.agent/workflows/export-trip-markdown-pdf.md`
   - `references/style-contract.md`
2. Decide the style concept before editing:
   - style id in kebab-case
   - Traditional Chinese label
   - target mood
   - palette
   - generated asset plan
   - text contrast plan for light and dark areas
3. Add or update static assets in `frontend/public/export-assets/`.
4. Add or update the style object in `frontend/src/export/tripExport.js`.
5. Confirm `TripExportModal` can select the style without layout overflow.
6. Validate HTML preview through `/export-preview`, not a `blob:` URL.
7. Run `npm.cmd run build` in `frontend`.
8. Update project docs when behavior, style inventory, or workflow changes.

## Non-Negotiables

- Do not add a backend PDF engine for v1. PDF is produced by browser print from HTML.
- Do not use trip place photos as cover art. Place photos may appear inside timeline items only when `includeImages` is enabled.
- Do not leave black text on dark themes. Check appendix tables, memo boxes, links, empty states, timeline cards, and metadata tiles.
- Do not render blank handwriting placeholders. User-entered `tripMemo` appears only when filled.
- Keep the modal style selector as a style picker, not a single-cover picker.
- Generated artwork must be committed as static assets; the app must not call an AI image service at runtime.

## Expected Deliverables

- Updated style asset(s) under `frontend/public/export-assets/`.
- Updated `BOOKLET_STYLE_OPTIONS` or related renderer CSS in `frontend/src/export/tripExport.js`.
- UI selection still works in `frontend/src/components/TripExportModal.jsx` / `.css`.
- Documentation updated:
  - `.agent/knowledge/travel-planner-logic/PROJECT_KNOWLEDGE.md`
  - `.agent/workflows/export-trip-markdown-pdf.md`
  - this skill or `references/style-contract.md` if the reusable process changed
- Verification notes covering build, preview, and visual checks.

## Reference

Read `references/style-contract.md` when implementing. It contains the exact file map, style object fields, asset guidance, and QA checklist.
