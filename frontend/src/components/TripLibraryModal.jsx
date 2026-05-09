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

function formatDateRange(trip) {
  const start = trip.start_date || trip.startDate;
  const end = trip.end_date || trip.endDate;
  if (!start && !end) return '未設定日期';
  if (start === end || !end) return start;
  return `${start} ~ ${end}`;
}

function formatModified(value) {
  if (!value) return '尚未同步';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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

  const currentTripId = currentTrip?.meta?.tripId;
  const currentNodeCount = useMemo(() => (
    Object.values(currentTrip?.nodesByDay || {}).reduce((sum, nodes) => sum + nodes.length, 0)
  ), [currentTrip]);

  const loadTrips = async () => {
    setError('');
    setStatusMessage('');
    setLoadingAction('list');
    try {
      const data = await api.listSheetTrips();
      setTrips(Array.isArray(data) ? data : data?.trips || []);
    } catch (err) {
      setError(err.message || '無法取得雲端行程列表');
    } finally {
      setLoadingAction('');
    }
  };

  useEffect(() => {
    if (isOpen) {
      setValidationErrors([]);
      setConfirmingDeleteId(null);
      loadTrips();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExport = async () => {
    if (!currentTripId) return;
    setError('');
    setValidationErrors([]);
    setLoadingAction('export');
    try {
      const result = await api.exportTripToSheet(currentTripId, currentTrip);
      onExported?.(result);
      setStatusMessage('已覆寫到雲端');
      await loadTrips();
    } catch (err) {
      setError(err.message || '匯出失敗');
    } finally {
      setLoadingAction('');
    }
  };

  const handleImport = async (tripId) => {
    setError('');
    setValidationErrors([]);
    setLoadingAction(`import:${tripId}`);
    try {
      const result = await api.importTripFromSheet(tripId);
      setValidationErrors(result.validation_errors || result.validationErrors || []);
      onImported?.(result.trip_data || result.tripData || result);
      setStatusMessage('已讀回雲端行程');
      onClose?.();
    } catch (err) {
      setError(err.message || '讀回失敗');
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
      setError(err.message || '刪除失敗');
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
            <p>雲端行程以 Google Sheets 為來源；目前先支援手動覆寫與讀回。</p>
          </div>
          <button className="trip-icon-btn" onClick={onClose} aria-label="關閉行程庫">
            <X size={18} />
          </button>
        </header>

        <section className="trip-current-panel">
          <div>
            <span className="trip-kicker">目前行程</span>
            <h3>{currentTrip?.meta?.tripTitle || '未命名行程'}</h3>
            <p>{currentTrip?.meta?.startDate} ~ {currentTrip?.meta?.endDate} · {currentNodeCount} 個景點</p>
            <p className="trip-muted">雲端更新：{formatModified(currentTrip?.meta?.sheetLastModifiedUtc)}</p>
          </div>
          <button className="btn primary" onClick={handleExport} disabled={isBusy}>
            {loadingAction === 'export' ? <Loader2 className="spin" size={16} /> : <Upload size={16} />}
            覆寫到雲端
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
          <div className="trip-library-alert success">
            {statusMessage}
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="trip-library-alert warning">
            <AlertTriangle size={16} />
            匯入時有 {validationErrors.length} 筆檢查提醒，請確認 Sheet 內容。
          </div>
        )}

        <div className="trip-list">
          {loadingAction === 'list' && trips.length === 0 ? (
            <div className="trip-empty-state">
              <Loader2 className="spin" size={22} />
              載入雲端行程中
            </div>
          ) : trips.length === 0 ? (
            <div className="trip-empty-state">目前沒有雲端行程</div>
          ) : trips.map((trip) => {
            const tripId = getTripId(trip);
            const isCurrentTrip = tripId === currentTripId;
            const isImporting = loadingAction === `import:${tripId}`;
            const isDeleting = loadingAction === `delete:${tripId}`;
            const confirmDelete = confirmingDeleteId === tripId;

            return (
              <article key={tripId} className={`trip-list-item ${isCurrentTrip ? 'current' : ''}`}>
                <div className="trip-list-main">
                  <div className="trip-list-title-row">
                    <h4>{getTripTitle(trip)}</h4>
                    {isCurrentTrip && <span>目前</span>}
                  </div>
                  <p>{formatDateRange(trip)} · {trip.days_count ?? trip.daysCount ?? '-'} 天 · {trip.node_count ?? trip.nodeCount ?? '-'} 個景點</p>
                  <p className="trip-muted">雲端更新：{formatModified(getLastModified(trip))}</p>
                </div>
                <div className="trip-list-actions">
                  <button className="btn outline" onClick={() => handleImport(tripId)} disabled={isBusy}>
                    {isImporting ? <Loader2 className="spin" size={16} /> : <Download size={16} />}
                    讀回
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
