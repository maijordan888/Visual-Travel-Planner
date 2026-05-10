import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clipboard,
  Download,
  FileCode2,
  FileText,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import { api } from '../api';
import {
  BOOKLET_STYLE_OPTIONS,
  buildTripMarkdown,
  buildTripPrintHtml,
} from '../export/tripExport';
import { TRIP_EXPORT_PREVIEW_STORAGE_KEY } from './TripExportPreview';
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
  const [openInNewWindow, setOpenInNewWindow] = useState(false);
  const [bookletStyle, setBookletStyle] = useState(BOOKLET_STYLE_OPTIONS[0].id);
  const [isStyleMenuOpen, setIsStyleMenuOpen] = useState(false);
  const [tripMemo, setTripMemo] = useState('');
  const [copied, setCopied] = useState(false);

  const activeTrip = sourceTrip || currentTrip;
  const title = activeTrip?.meta?.tripTitle || '未命名行程';
  const selectedStyle = BOOKLET_STYLE_OPTIONS.find((option) => option.id === bookletStyle)
    || BOOKLET_STYLE_OPTIONS[0];
  const sourceLabel = sourceTrip ? '雲端最新資料' : '目前畫面資料';

  const markdown = useMemo(() => buildTripMarkdown(activeTrip, {
    source: sourceTrip ? 'sheet' : 'current',
    includeImages,
    tripMemo,
    validationWarnings,
  }), [activeTrip, includeImages, sourceTrip, tripMemo, validationWarnings]);

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
          ? `已載入雲端資料，另有 ${issues.length} 個提醒需要確認。`
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

  const buildPrintHtml = () => buildTripPrintHtml(activeTrip, {
    source: sourceTrip ? 'sheet' : 'current',
    includeImages,
    tripMemo,
    validationWarnings,
    bookletStyle,
    assetBaseUrl: `${window.location.origin}/export-assets`,
  });

  const openPreview = (html) => {
    sessionStorage.setItem(TRIP_EXPORT_PREVIEW_STORAGE_KEY, html);
    const previewUrl = '/export-preview';

    if (openInNewWindow) {
      const previewWindow = window.open(previewUrl, '_blank');
      if (previewWindow) {
        previewWindow.focus();
        setStatusMessage('已在新視窗開啟 HTML。');
        return;
      }
      setStatusMessage('瀏覽器阻擋新視窗，已改在目前視窗開啟。');
    }

    window.location.assign(previewUrl);
  };

  const handleOpenHtmlView = () => {
    openPreview(buildPrintHtml());
  };

  const handleDownloadHtml = () => {
    downloadTextFile(makeFilename(title, 'html'), buildPrintHtml(), 'text/html;charset=utf-8');
  };

  const handleSelectStyle = (styleId) => {
    setBookletStyle(styleId);
    setIsStyleMenuOpen(false);
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
            <p>產生可離線閱讀的 Markdown 與 HTML 行程手冊。</p>
          </div>
          <button className="trip-export-icon-btn" onClick={onClose} aria-label="關閉匯出視窗">
            <X size={18} />
          </button>
        </header>

        <div className="trip-export-body">
          <section className="trip-export-controls" aria-label="匯出設定">
            <div className="trip-export-control-group">
              <div className="trip-export-group-heading">
                <span>資料與內容</span>
                <small>來源：{sourceLabel}</small>
              </div>
              <div className="trip-export-control-row">
                <button className="btn primary trip-export-control-btn" onClick={handleImportLatest} disabled={isImporting}>
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
                <label className="trip-export-toggle">
                  <input
                    type="checkbox"
                    checked={openInNewWindow}
                    onChange={(event) => setOpenInNewWindow(event.target.checked)}
                  />
                  新視窗開啟
                </label>
              </div>
              <label className="trip-export-memo">
                <span>旅途備註</span>
                <textarea
                  value={tripMemo}
                  onChange={(event) => setTripMemo(event.target.value)}
                  rows={3}
                  placeholder="可以輸入想放進離線文件的提醒、集合資訊、臨時備註。沒填就不輸出這個區塊。"
                />
              </label>
            </div>

          <div className="trip-export-control-group">
            <div className="trip-export-group-heading">
              <span>列印版風格</span>
              <small>{selectedStyle.label}</small>
            </div>
            <div className="trip-style-select">
              <button
                type="button"
                className="trip-style-select-trigger"
                onClick={() => setIsStyleMenuOpen((value) => !value)}
                aria-expanded={isStyleMenuOpen}
                aria-controls="trip-style-menu"
              >
                <span
                  className="trip-style-preview"
                  style={{ '--theme-sheet': `url(/export-assets/${selectedStyle.asset})` }}
                  aria-hidden="true"
                />
                <span className="trip-style-name">{selectedStyle.label}</span>
                <span className="trip-style-caret" aria-hidden="true">⌄</span>
              </button>
              {isStyleMenuOpen && (
                <div className="trip-style-options" id="trip-style-menu" aria-label="列印版風格">
                  {BOOKLET_STYLE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`trip-style-option ${bookletStyle === option.id ? 'active' : ''}`}
                      style={{ '--theme-sheet': `url(/export-assets/${option.asset})` }}
                      onClick={() => handleSelectStyle(option.id)}
                      aria-pressed={bookletStyle === option.id}
                    >
                      <span aria-hidden="true" />
                      <strong>{option.label}</strong>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="trip-export-control-group">
            <div className="trip-export-group-heading">
              <span>輸出動作</span>
              <small>HTML 可預覽，也可下載成單檔保存</small>
            </div>
            <div className="trip-export-control-row action-row">
              <button className="btn primary trip-export-action-btn" onClick={handleCopy}>
                {copied ? <Check size={16} /> : <Clipboard size={16} />}
                {copied ? '已複製' : '複製 Markdown'}
              </button>
              <button className="btn primary trip-export-action-btn" onClick={handleDownloadMarkdown}>
                <Download size={16} />
                下載 .md
              </button>
              <button className="btn primary trip-export-action-btn" onClick={handleOpenHtmlView}>
                <FileCode2 size={16} />
                開啟 HTML
              </button>
              <button className="btn primary trip-export-action-btn" onClick={handleDownloadHtml}>
                <Download size={16} />
                下載 HTML
              </button>
            </div>
          </div>
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
                      {issue.row ? `Row ${issue.row}：` : ''}
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
              <span>來源：{sourceLabel}</span>
            </div>
            <pre>{markdown}</pre>
          </section>
        </div>
      </div>
    </div>
  );
}
