# Trip Export Style Contract

This reference is for adding or changing offline export booklet styles in `travel_ai`.

## File Map

- `frontend/src/export/tripExport.js`
  - `BOOKLET_STYLE_OPTIONS`: style ids, labels, asset names, palette tokens, image positioning, dark-theme flags.
  - `buildTripPrintHtml()`: HTML structure and CSS variables for the offline booklet.
  - `buildTripMarkdown()`: Markdown text export; normally style-independent.
- `frontend/public/export-assets/`
  - Static generated artwork used by HTML preview/download and style selector thumbnails.
- `frontend/src/components/TripExportModal.jsx`
  - Style selector state and style option rendering.
- `frontend/src/components/TripExportModal.css`
  - Export modal layout, style dropdown, preview card sizing.
- `frontend/src/components/TripExportPreview.jsx`
  - `/export-preview` route that renders generated HTML from `sessionStorage`.
- `.agent/workflows/export-trip-markdown-pdf.md`
  - User-facing export workflow and QA notes.
- `.agent/knowledge/travel-planner-logic/PROJECT_KNOWLEDGE.md`
  - Architecture-level contract and current style inventory.

## Style Object Fields

Each entry in `BOOKLET_STYLE_OPTIONS` should include:

```js
{
  id: 'style-id',
  label: '繁中名稱',
  asset: 'asset-file.png',
  accent: '#...',
  teal: '#...',
  sky: '#...',
  rose: '#...',
  paper: '#...',
  pageBg: '#...',
  dayBg: 'rgba(...)',
  cardBg: '#...' or 'rgba(...)',
  timelineLine: 'rgba(...)',
  stampColor: '#...',
  timeColor: '#...',
  coverPosition: 'left top',
  stripPosition: 'center 96%',
  sideLeftPosition: '8% 92%',
  sideRightPosition: '82% 92%',
}
```

Add these for dark styles:

```js
{
  ink: '#eef6ff',
  muted: '#b7c7df',
  line: 'rgba(125, 211, 252, 0.22)',
  ticketBase: '#0b1223',
  subtleBase: '#111a31',
  darkBackdrop: true,
}
```

## Asset Guidance

- Use one static sheet-style artwork per booklet style.
- Prefer wide travel-collage sheets that can serve as cover art, doodle strip, thumbnail, and side decoration.
- Leave generous safe margins in generated artwork because CSS reuses the same sheet at multiple crop positions.
- Avoid important visual elements at the extreme top, bottom, left, or right edge.
- Use transparent or light backgrounds only when the CSS page background provides enough separation.
- For dark themes, make artwork bright enough to remain visible on deep navy/black backgrounds.

Suggested prompt shape for generated assets:

```text
Wide watercolor travel stationery collage sheet, [theme], multiple small travel illustrations with generous safe margins, clean off-white/transparent-feeling background, no text, no logos, no people, offline editorial booklet asset, high detail, soft paper texture.
```

After generation:

- Save to `frontend/public/export-assets/<style-id>.png`.
- Check that the cover crop, strip crop, and side crops all have useful content.
- If artwork is clipped, regenerate with larger safe margins before compensating with CSS.

## Implementation Steps

1. Pick a unique `id` and Traditional Chinese `label`.
2. Add the static asset under `frontend/public/export-assets/`.
3. Add the style object to `BOOKLET_STYLE_OPTIONS`.
4. Tune CSS variables through style object values before changing the global booklet CSS.
5. Use `darkBackdrop: true` only when the whole page should be dark.
6. If changing modal layout, keep the style picker compact enough for laptop viewports and ensure `.trip-export-body` remains scrollable.
7. Update the style inventory in project knowledge and workflow docs.

## Visual QA Checklist

Run `npm.cmd run build` from `frontend`.

Open the app and verify:

- `TripExportModal` shows the new style in the style picker.
- Collapsed style preview is legible and not clipped.
- Expanded style options are selectable and do not overflow the modal.
- `開啟 HTML` opens `/export-preview`.
- `下載 HTML` saves a `.html` file using the same booklet renderer.
- Downloaded HTML embeds the selected style asset so the cover/doodle artwork still works offline.
- Desktop HTML preview has useful side decoration and does not feel empty on wide screens.
- Mobile/narrow preview has no overlapping text or clipped controls.
- Timeline cards, summary tiles, appendix, memo, links, and empty states have readable text.
- Place thumbnails render only when `includeImages` is enabled and `photo_url` exists.
- Markdown preview/download content remains structurally unchanged unless the task explicitly changes Markdown.

## Documentation Checklist

Update `.agent/knowledge/travel-planner-logic/PROJECT_KNOWLEDGE.md` when:

- Adding, removing, or renaming a style id.
- Changing export route behavior.
- Changing offline HTML generation scope.
- Changing style selection semantics.

Update `.agent/workflows/export-trip-markdown-pdf.md` when:

- User operation steps change.
- Modal controls move or change names.
- Preview/download behavior changes.

Update this skill when:

- The reusable style creation process changes.
- New required style object fields are added.
- Asset generation rules change.
