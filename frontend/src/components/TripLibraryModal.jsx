import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Cloud,
  Download,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../api';
import './TripLibraryModal.css';

const getTripId = (trip) => trip.trip_id || trip.tripId || trip.id;
const getTripTitle = (trip) => trip.trip_name || trip.tripTitle || trip.title || '未命名行程';
const getLastModified = (trip) => trip.last_modified_utc || trip.sheetLastModifiedUtc || null;

function summarizeNodes(nodesByDay = {}) {
  return Object.values(nodesByDay).reduce((summary, nodes = []) => {
    nodes.forEach((node) => {
      if (node?.status === 'confirmed') summary.confirmed += 1;
      if (node?.status === 'pending_options') summary.pending += 1;
    });
    return summary;
  }, { confirmed: 0, pending: 0 });
}

function formatDateRange(trip) {
  const start = trip.start_date || trip.startDate;
  const end = trip.end_date || trip.endDate;
  if (!start && !end) return '未設定日期';
  if (start === end || !end) return start;
  return `${start} ~ ${end}`;
}

function formatModified(value) {
  if (!value) return '尚未儲存';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function isLocalNewer(currentTrip) {
  const local = currentTrip?.meta?.localLastModifiedUtc;
  const sheet = currentTrip?.meta?.sheetLastModifiedUtc;
  if (!local || !sheet) return Boolean(local);
  return new Date(local) > new Date(sheet);
}

export default function TripLibraryModal({
  isOpen,
  onClose,
  currentTrip,
  onExported,
  onImported,
}) {
  const [trips, setTrips] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [loadingAction, setLoadingAction] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [confirmingImportId, setConfirmingImportId] = useState(null);
  const [confirmingExport, setConfirmingExport] = useState(false);

  const currentTripId = currentTrip?.meta?.tripId;
  const currentNodeSummary = useMemo(() => (
    summarizeNodes(currentTrip?.nodesByDay)
  ), [currentTrip]);
  const localNewer = isLocalNewer(currentTrip);

  const loadTrips = async () => {
    setError('');
    setStatusMessage('');
    setLoadingAction('list');
    try {
      const data = await api.listSheetTrips();
      setTrips(Array.isArray(data) ? data : data?.trips || []);
    } catch (err) {
      setError(err.message || '無法讀取雲端行程列表');
    } finally {
      setLoadingAction('');
    }
  };

  useEffect(() => {
    if (isOpen) {
      setValidationErrors([]);
      setConfirmingDeleteId(null);
      setConfirmingImportId(null);
      setConfirmingExport(false);
      loadTrips();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExport = async () => {
    if (!currentTripId) return;
    if (currentTrip?.meta?.sheetLastModifiedUtc && !confirmingExport) {
      setConfirmingExport(true);
      setStatusMessage('這會用目前畫面上的行程覆寫同一個雲端行程。再按一次「確認儲存」繼續。');
      return;
    }

    setError('');
    setValidationErrors([]);
    setLoadingAction('export');
    try {
      const result = await api.exportTripToSheet(currentTripId, currentTrip);
      onExported?.(result);
      setConfirmingExport(false);
      setStatusMessage('已儲存到雲端');
      await loadTrips();
    } catch (err) {
      setError(err.message || '儲存到雲端失敗');
    } finally {
      setLoadingAction('');
    }
  };

  const handleImport = async (tripId) => {
    if (localNewer && confirmingImportId !== tripId) {
      setConfirmingImportId(tripId);
      setStatusMessage('目前本機行程有尚未儲存的變更。再按一次「確認載入」才會用雲端行程取代目前畫面。');
      return;
    }

    setError('');
    setValidationErrors([]);
    setLoadingAction(`import:${tripId}`);
    try {
      const result = await api.importTripFromSheet(tripId);
      const issues = result.validation_errors || result.validationErrors || [];
      setValidationErrors(issues);
      onImported?.(result.trip_data || result.tripData || result);
      setConfirmingImportId(null);
      setStatusMessage(
        issues.length > 0
          ? `已載入雲端行程，但有 ${issues.length} 個欄位提醒需要檢查`
          : '已載入雲端行程'
      );
      if (issues.length === 0) onClose?.();
    } catch (err) {
      setError(err.message || '載入雲端行程失敗');
    } finally {
      setLoadingAction('');
    }
  };

  const handleDelete = async (tripId) => {
    if (confirmingDeleteId !== tripId) {
      setConfirmingDeleteId(tripId);
      return;
    }

    setError('');
    setLoadingAction(`delete:${tripId}`);
    try {
      await api.deleteSheetTrip(tripId);
      setStatusMessage('已刪除雲端行程');
      setConfirmingDeleteId(null);
      await loadTrips();
    } catch (err) {
      setError(err.message || '刪除雲端行程失敗');
    } finally {
      setLoadingAction('');
    }
  };

  const isBusy = Boolean(loadingAction);

  return (
    <div className="trip-library-backdrop" role="dialog" aria-modal="true">
      <div className="trip-library-modal glass-panel">
        <header className="trip-library-header">
          <div>
            <div className="trip-library-title">
              <Cloud size={20} />
              <h2>行程庫</h2>
            </div>
            <p>用 Google Sheets 儲存、載入或刪除雲端行程。</p>
          </div>
          <button className="trip-icon-btn" onClick={onClose} aria-label="關閉行程庫">
            <X size={18} />
          </button>
        </header>

        <section className="trip-current-panel">
          <div>
            <span className="trip-kicker">目前畫面</span>
            <h3>{currentTrip?.meta?.tripTitle || '未命名行程'}</h3>
            <p>
              {currentTrip?.meta?.startDate} ~ {currentTrip?.meta?.endDate}
              {' · '}
              {currentNodeSummary.confirmed} 個已確認景點
              {currentNodeSummary.pending > 0 && ` / ${currentNodeSummary.pending} 個待決定`}
            </p>
            <p className="trip-muted">
              雲端時間：{formatModified(currentTrip?.meta?.sheetLastModifiedUtc)}
              {localNewer && ' · 本機有未儲存變更'}
            </p>
          </div>
          <button className="btn primary" onClick={handleExport} disabled={isBusy}>
            {loadingAction === 'export' ? <Loader2 className="spin" size={16} /> : <Upload size={16} />}
            {confirmingExport ? '確認儲存' : '儲存到雲端'}
          </button>
        </section>

        <div className="trip-library-toolbar">
          <h3>雲端行程</h3>
          <button className="btn outline" onClick={loadTrips} disabled={isBusy}>
            {loadingAction === 'list' ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
            重新整理
          </button>
        </div>

        {error && (
          <div className="trip-library-alert error">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        {statusMessage && !error && (
          <div className={`trip-library-alert ${confirmingExport || confirmingImportId ? 'warning' : 'success'}`}>
            {statusMessage}
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="trip-library-alert warning">
            <AlertTriangle size={16} />
            <div>
              <strong>載入時有 {validationErrors.length} 個提醒</strong>
              <ul className="trip-validation-list">
                {validationErrors.slice(0, 5).map((issue, index) => (
                  <li key={`${issue.row || 'meta'}-${issue.field}-${index}`}>
                    {issue.row ? `Row ${issue.row} · ` : ''}
                    {issue.field}: {issue.issue}
                  </li>
                ))}
              </ul>
              {validationErrors.length > 5 && (
                <span>還有 {validationErrors.length - 5} 個提醒未顯示</span>
              )}
            </div>
          </div>
        )}

        <div className="trip-list">
          {loadingAction === 'list' && trips.length === 0 ? (
            <div className="trip-empty-state">
              <Loader2 className="spin" size={22} />
              正在讀取雲端行程
            </div>
          ) : trips.length === 0 ? (
            <div className="trip-empty-state">目前沒有雲端行程</div>
          ) : trips.map((trip) => {
            const tripId = getTripId(trip);
            const isCurrentTrip = tripId === currentTripId;
            const isImporting = loadingAction === `import:${tripId}`;
            const isDeleting = loadingAction === `delete:${tripId}`;
            const confirmDelete = confirmingDeleteId === tripId;
            const confirmImport = confirmingImportId === tripId;

            return (
              <article key={tripId} className={`trip-list-item ${isCurrentTrip ? 'current' : ''}`}>
                <div className="trip-list-main">
                  <div className="trip-list-title-row">
                    <h4>{getTripTitle(trip)}</h4>
                    {isCurrentTrip && <span>目前</span>}
                  </div>
                  <p>{formatDateRange(trip)} · {trip.days_count ?? trip.daysCount ?? '-'} 天 · {trip.node_count ?? trip.nodeCount ?? '-'} 個已確認景點</p>
                  <p className="trip-muted">雲端時間：{formatModified(getLastModified(trip))}</p>
                </div>
                <div className="trip-list-actions">
                  <button className={`btn outline ${confirmImport ? 'confirming' : ''}`} onClick={() => handleImport(tripId)} disabled={isBusy}>
                    {isImporting ? <Loader2 className="spin" size={16} /> : <Download size={16} />}
                    {confirmImport ? '確認載入' : '載入'}
                  </button>
                  <button
                    className={`btn danger ${confirmDelete ? 'confirming' : ''}`}
                    onClick={() => handleDelete(tripId)}
                    disabled={isBusy && !isDeleting}
                  >
                    {isDeleting ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />}
                    {confirmDelete ? '確認刪除' : '刪除'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
