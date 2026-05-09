import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clipboard,
  Download,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
  X,
} from 'lucide-react';
import { api } from '../api';
import { buildTripMarkdown, buildTripPrintHtml } from '../export/tripExport';
import './TripExportModal.css';

const makeFilename = (title, extension) => {
  const safeTitle = String(title || 'trip')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'trip';
  return `${safeTitle}.${extension}`;
};

const downloadTextFile = (filename, content, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export default function TripExportModal({
  isOpen,
  onClose,
  currentTrip,
  onImported,
}) {
  const [sourceTrip, setSourceTrip] = useState(null);
  const [validationWarnings, setValidationWarnings] = useState([]);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [includeImages, setIncludeImages] = useState(true);
  const [copied, setCopied] = useState(false);

  const activeTrip = sourceTrip || currentTrip;
  const title = activeTrip?.meta?.tripTitle || '未命名行程';
  const markdown = useMemo(() => buildTripMarkdown(activeTrip, {
    source: sourceTrip ? 'sheet' : 'current',
    includeImages,
    validationWarnings,
  }), [activeTrip, includeImages, sourceTrip, validationWarnings]);

  if (!isOpen) return null;

  const handleImportLatest = async () => {
    const tripId = currentTrip?.meta?.tripId;
    if (!tripId) return;
    setError('');
    setStatusMessage('');
    setIsImporting(true);
    try {
      const result = await api.importTripFromSheet(tripId);
      const tripData = result.trip_data || result.tripData || result;
      const issues = result.validation_errors || result.validationErrors || [];
      setSourceTrip(tripData);
      setValidationWarnings(issues);
      onImported?.(tripData);
      setStatusMessage(
        issues.length
          ? `已載入雲端資料，但有 ${issues.length} 個檢查提醒。`
          : '已載入雲端最新資料。'
      );
    } catch (err) {
      setError(err.message || '載入雲端資料失敗');
    } finally {
      setIsImporting(false);
    }
  };

  const handleCopy = async () => {
    setError('');
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (err) {
      setError('無法複製到剪貼簿，請改用下載 .md。');
    }
  };

  const handleDownloadMarkdown = () => {
    downloadTextFile(makeFilename(title, 'md'), markdown, 'text/markdown;charset=utf-8');
  };

  const handleOpenPrintView = () => {
    const html = buildTripPrintHtml(activeTrip, {
      source: sourceTrip ? 'sheet' : 'current',
      includeImages,
      validationWarnings,
    });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <div className="trip-export-backdrop" role="dialog" aria-modal="true">
      <div className="trip-export-modal glass-panel">
        <header className="trip-export-header">
          <div>
            <div className="trip-export-title">
              <FileText size={20} />
              <h2>匯出行程</h2>
            </div>
            <p>產生可離線閱讀的 Markdown，並可用瀏覽器列印成 PDF。</p>
          </div>
          <button className="trip-export-icon-btn" onClick={onClose} aria-label="關閉匯出視窗">
            <X size={18} />
          </button>
        </header>

        <section className="trip-export-actions">
          <button className="btn outline" onClick={handleImportLatest} disabled={isImporting}>
            {isImporting ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
            先載入雲端最新
          </button>
          <label className="trip-export-toggle">
            <input
              type="checkbox"
              checked={includeImages}
              onChange={(event) => setIncludeImages(event.target.checked)}
            />
            顯示景點縮圖
          </label>
          <button className="btn outline" onClick={handleCopy}>
            {copied ? <Check size={16} /> : <Clipboard size={16} />}
            {copied ? '已複製' : '複製 Markdown'}
          </button>
          <button className="btn outline" onClick={handleDownloadMarkdown}>
            <Download size={16} />
            下載 .md
          </button>
          <button className="btn primary" onClick={handleOpenPrintView}>
            <Printer size={16} />
            開啟列印版
          </button>
        </section>

        {error && (
          <div className="trip-export-alert error">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}
        {statusMessage && !error && (
          <div className="trip-export-alert success">{statusMessage}</div>
        )}
        {validationWarnings.length > 0 && (
          <div className="trip-export-alert warning">
            <AlertTriangle size={16} />
            <div>
              <strong>雲端資料有 {validationWarnings.length} 個提醒</strong>
              <ul>
                {validationWarnings.slice(0, 4).map((issue, index) => (
                  <li key={`${issue.row || 'meta'}-${issue.field || index}`}>
                    {issue.row ? `Row ${issue.row} · ` : ''}
                    {issue.field ? `${issue.field}: ` : ''}
                    {issue.issue || issue.message || JSON.stringify(issue)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <section className="trip-export-preview">
          <div className="trip-export-preview-heading">
            <h3>Markdown 預覽</h3>
            <span>{sourceTrip ? '來源：雲端最新資料' : '來源：目前畫面資料'}</span>
          </div>
          <pre>{markdown}</pre>
        </section>
      </div>
    </div>
  );
}
