import { useEffect, useMemo } from 'react';

const STORAGE_KEY = 'trip-export-preview-html';

export { STORAGE_KEY as TRIP_EXPORT_PREVIEW_STORAGE_KEY };

export default function TripExportPreview() {
  const html = useMemo(() => sessionStorage.getItem(STORAGE_KEY) || '', []);

  useEffect(() => {
    if (!html) return;
    document.open();
    document.write(html);
    document.close();

    const shouldPrint = new URLSearchParams(window.location.search).get('print') === '1';
    if (shouldPrint) {
      window.setTimeout(() => {
        window.focus();
        window.print();
      }, 600);
    }
  }, [html]);

  if (!html) {
    return (
      <main className="export-preview-empty">
        <h1>No export preview found</h1>
        <p>Go back to the planner and open the trip export again.</p>
      </main>
    );
  }

  return null;
}
