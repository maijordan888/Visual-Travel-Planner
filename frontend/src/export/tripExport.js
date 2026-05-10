const pad2 = (value) => String(value).padStart(2, '0');

const addDays = (dateString, offset) => {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

const addMinutesToTime = (time, minutes = 0) => {
  const match = String(time || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '';
  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]) + Number(minutes || 0), 0, 0);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

const normalizeTimeLabel = (time) => {
  const match = String(time || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return cleanText(time);
  return `${pad2(Number(match[1]))}:${match[2]}`;
};

const cleanText = (value) => String(value ?? '').trim();

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const toArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
};

const escapeMarkdown = (value) => cleanText(value).replaceAll('|', '\\|');

const escapeHtml = (value) => cleanText(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

export const BOOKLET_STYLE_OPTIONS = [
  {
    id: 'japan-cute',
    label: '和風手帳',
    asset: 'travel-booklet-sheet.png',
    accent: '#f97316',
    teal: '#0f766e',
    sky: '#2563eb',
    rose: '#be185d',
    paper: '#fffdf8',
    pageBg: '#edf5ec',
    dayBg: 'rgba(255, 253, 248, 0.94)',
    cardBg: '#ffffff',
    timelineLine: 'rgba(249, 115, 22, 0.78)',
    coverPosition: 'left top',
    stripPosition: 'center 96%',
    sideLeftPosition: '4% 92%',
    sideRightPosition: '82% 92%',
  },
  {
    id: 'airport-minimal',
    label: '清爽機場',
    asset: 'travel-theme-airport.png',
    accent: '#ef6c4d',
    teal: '#0f6f78',
    sky: '#2f6f95',
    rose: '#b85d4f',
    paper: '#fffefa',
    pageBg: '#e2f0ee',
    dayBg: 'rgba(255, 254, 250, 0.95)',
    cardBg: '#ffffff',
    timelineLine: 'rgba(239, 108, 77, 0.7)',
    coverPosition: 'left top',
    stripPosition: 'center 96%',
    sideLeftPosition: '2% 92%',
    sideRightPosition: '78% 92%',
  },
  {
    id: 'retro-rail',
    label: '復古鐵道',
    asset: 'travel-theme-rail.png',
    accent: '#9b6b45',
    teal: '#3f6f45',
    sky: '#2f5f83',
    rose: '#8f3f2b',
    paper: '#fff8e8',
    pageBg: '#f1e4c8',
    dayBg: 'rgba(255, 248, 232, 0.95)',
    cardBg: '#fffdf7',
    timelineLine: 'rgba(126, 88, 57, 0.38)',
    coverPosition: 'center top',
    stripPosition: 'center 96%',
    sideLeftPosition: '18% 92%',
    sideRightPosition: '67% 92%',
  },
  {
    id: 'coastal-weekend',
    label: '海岸週末',
    asset: 'travel-theme-coastal.png',
    accent: '#ef7d32',
    teal: '#087f8c',
    sky: '#0284c7',
    rose: '#d75f51',
    paper: '#fffef8',
    pageBg: '#e1f7f5',
    dayBg: 'rgba(255, 254, 248, 0.95)',
    cardBg: '#ffffff',
    timelineLine: 'rgba(239, 125, 50, 0.72)',
    coverPosition: 'right top',
    stripPosition: 'center 96%',
    sideLeftPosition: '8% 92%',
    sideRightPosition: '83% 92%',
  },
  {
    id: 'neon-night',
    label: '夜城市',
    asset: 'travel-theme-neon.png',
    accent: '#f59e0b',
    teal: '#06b6d4',
    sky: '#8b5cf6',
    rose: '#ec4899',
    paper: '#fffaf0',
    pageBg: '#050816',
    dayBg: 'rgba(255, 250, 240, 0.95)',
    cardBg: '#fffefa',
    timelineLine: 'rgba(245, 158, 11, 0.72)',
    darkBackdrop: true,
    coverPosition: 'left top',
    stripPosition: 'center 96%',
    sideLeftPosition: '8% 92%',
    sideRightPosition: '77% 92%',
  },
];

const getBookletStyle = (styleId) => (
  BOOKLET_STYLE_OPTIONS.find((style) => style.id === styleId) || BOOKLET_STYLE_OPTIONS[0]
);

const resolveBookletAssetUrl = (style, options = {}) => {
  if (options.styleAssetUrl) return options.styleAssetUrl;
  const baseUrl = options.assetBaseUrl || '/export-assets';
  return `${baseUrl.replace(/\/$/, '')}/${style.asset}`;
};

const getNodeTitle = (node) => cleanText(
  node?.selected_place_name
    || node?.name
    || node?.place_name
    || '未命名地點'
);

const buildMapsUrl = (point) => {
  if (point.placeId) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(point.title)}&query_place_id=${encodeURIComponent(point.placeId)}`;
  }
  if (point.lat !== null && point.lng !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${point.lat},${point.lng}`)}`;
  }
  if (point.address || point.title) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(point.address || point.title)}`;
  }
  return '';
};

const normalizeRoutePoint = ({
  nodeType,
  dayNumber,
  title,
  arrivalTime = '',
  departureTime = '',
  stayDurationMins = null,
  transportFromPreviousMins = null,
  transportMode = '',
  address = '',
  placeId = null,
  lat = null,
  lng = null,
  rating = null,
  photoUrl = null,
  types = [],
  tags = [],
  notes = '',
}) => {
  const point = {
    nodeType,
    dayNumber,
    title: cleanText(title) || '未命名地點',
    arrivalTime: normalizeTimeLabel(arrivalTime),
    departureTime: normalizeTimeLabel(departureTime),
    stayDurationMins: toNumberOrNull(stayDurationMins),
    transportFromPreviousMins: toNumberOrNull(transportFromPreviousMins),
    transportMode: cleanText(transportMode),
    address: cleanText(address),
    placeId: cleanText(placeId) || null,
    lat: toNumberOrNull(lat),
    lng: toNumberOrNull(lng),
    rating: toNumberOrNull(rating),
    photoUrl: cleanText(photoUrl) || null,
    types: toArray(types),
    tags: toArray(tags),
    notes: cleanText(notes),
  };
  return {
    ...point,
    mapsUrl: buildMapsUrl(point),
  };
};

export function normalizeTripForExport(tripData = {}, options = {}) {
  const meta = tripData.meta || tripData || {};
  const dayConfigs = tripData.dayConfigs || {};
  const nodesByDay = tripData.nodesByDay || {};
  const dayNumbers = Object.keys(dayConfigs).length
    ? Object.keys(dayConfigs).map(Number).filter(Number.isFinite).sort((a, b) => a - b)
    : Object.keys(nodesByDay).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const generatedAtUtc = options.generatedAtUtc || new Date().toISOString();

  const days = dayNumbers.map((dayNumber, index) => {
    const config = dayConfigs[dayNumber] || dayConfigs[String(dayNumber)] || {};
    const nodes = nodesByDay[dayNumber] || nodesByDay[String(dayNumber)] || [];
    const startTime = cleanText(config.startTime) || '09:00';
    let refTime = startTime;

    const start = normalizeRoutePoint({
      nodeType: 'start',
      dayNumber,
      title: config.startLocation || `Day ${dayNumber} 起點`,
      arrivalTime: startTime,
      departureTime: startTime,
      address: config.startAddress || '',
      lat: config.startLat,
      lng: config.startLng,
      notes: config.startNotes || '',
      photoUrl: config.startPhotoUrl || null,
    });

    const items = nodes
      .filter((node) => node?.status === 'confirmed' && getNodeTitle(node))
      .map((node) => {
        const transportMins = node.transport_time_mins ?? node.manual_transport_time ?? node.auto_transport_time ?? 0;
        const arrivalTime = cleanText(node.planned_arrival_time) || addMinutesToTime(refTime, transportMins);
        const stayDuration = node.planned_stay_duration ?? node.stayDurationMins ?? 0;
        const departureTime = cleanText(node.planned_departure_time) || addMinutesToTime(arrivalTime, stayDuration);
        refTime = departureTime || refTime;
        return normalizeRoutePoint({
          nodeType: 'regular',
          dayNumber,
          title: getNodeTitle(node),
          arrivalTime,
          departureTime,
          stayDurationMins: stayDuration,
          transportFromPreviousMins: transportMins,
          transportMode: node.transport_mode || 'transit',
          address: node.address || node.formatted_address || '',
          placeId: node.selected_place_id || node.place_id || null,
          lat: node.lat,
          lng: node.lng,
          rating: node.rating,
          photoUrl: node.photo_url || null,
          types: node.types,
          tags: node.tags,
          notes: node.notes || '',
        });
      });

    const endTransportMins = config.endNodeData?.manual_transport_time
      ?? config.endNodeData?.auto_transport_time
      ?? 0;
    const endArrivalTime = addMinutesToTime(refTime, endTransportMins) || refTime || config.maxReturnTime || '';
    const end = normalizeRoutePoint({
      nodeType: 'end',
      dayNumber,
      title: config.endLocation || `Day ${dayNumber} 終點`,
      arrivalTime: endArrivalTime,
      departureTime: '',
      transportFromPreviousMins: endTransportMins,
      transportMode: config.endNodeData?.transport_mode || 'transit',
      address: config.endAddress || '',
      lat: config.endLat,
      lng: config.endLng,
      notes: config.endNotes || '',
      photoUrl: config.endPhotoUrl || null,
    });

    return {
      dayNumber,
      date: addDays(meta.startDate || tripData.startDate || '', index),
      start,
      items,
      end,
      warnings: [],
    };
  });

  const places = days.flatMap((day) => [day.start, ...day.items, day.end]);

  return {
    meta: {
      tripId: meta.tripId || tripData.tripId || '',
      title: meta.tripTitle || tripData.tripTitle || '未命名行程',
      startDate: meta.startDate || tripData.startDate || '',
      endDate: meta.endDate || tripData.endDate || '',
      generatedAtUtc,
      source: options.source || 'current',
      localLastModifiedUtc: meta.localLastModifiedUtc || tripData.localLastModifiedUtc || null,
      sheetLastModifiedUtc: meta.sheetLastModifiedUtc || tripData.sheetLastModifiedUtc || null,
    },
    days,
    appendix: {
      places,
      unmatchedNotes: [],
      validationWarnings: options.validationWarnings || [],
    },
  };
}

const renderPlaceImage = (point, options = {}) => {
  if (options.includeImages === false || !point.photoUrl) return '';
  return `\n![${escapeMarkdown(point.title)}](${point.photoUrl})\n`;
};

const renderNotesBlock = (notes) => {
  if (!cleanText(notes)) return '';
  return `\n> 備註：${cleanText(notes).replace(/\n+/g, '\n> ')}\n`;
};

const renderTransportBlock = (point) => {
  if (point.nodeType === 'start' || point.transportFromPreviousMins === null) return '';
  const mode = point.transportMode ? `｜${point.transportMode}` : '';
  return `- 從上一站到此站：約 ${point.transportFromPreviousMins} 分鐘${mode}\n`;
};

const renderTimelineItem = (point, options = {}) => {
  const timeLabel = point.arrivalTime ? `${point.arrivalTime} ` : '';
  const typeLabel = point.nodeType === 'start' ? '出發' : point.nodeType === 'end' ? '抵達終點' : '抵達';
  const lines = [
    `### ${timeLabel}${typeLabel}｜${escapeMarkdown(point.title)}`,
    renderPlaceImage(point, options).trimEnd(),
  ].filter(Boolean);

  const details = [];
  if (point.departureTime && point.nodeType === 'regular') details.push(`- 離開：${point.departureTime}`);
  if (point.stayDurationMins !== null && point.nodeType === 'regular') details.push(`- 停留：${point.stayDurationMins} 分鐘`);
  if (point.address) details.push(`- 地址：${escapeMarkdown(point.address)}`);
  if (point.rating !== null) details.push(`- 評分：${point.rating}`);
  if (point.mapsUrl) details.push(`- Google Maps：${point.mapsUrl}`);
  const transport = renderTransportBlock(point).trimEnd();
  if (transport) details.push(transport);

  if (details.length) lines.push(details.join('\n'));
  const notes = renderNotesBlock(point.notes).trimEnd();
  if (notes) lines.push(notes);
  return `${lines.join('\n\n')}\n`;
};

const renderCover = (trip) => {
  const range = [trip.meta.startDate, trip.meta.endDate].filter(Boolean).join(' - ');
  return [
    `# ${escapeMarkdown(trip.meta.title)}`,
    range ? `> ${range}` : '',
    `> 離線行程文件｜產生時間 ${trip.meta.generatedAtUtc.slice(0, 16).replace('T', ' ')}`,
  ].filter(Boolean).join('\n\n');
};

const renderTripSummary = (trip) => {
  const firstDay = trip.days[0];
  const lastDay = trip.days[trip.days.length - 1];
  const confirmedCount = trip.days.reduce((count, day) => count + day.items.length, 0);
  const lines = [
    '## 行程摘要',
    `- 天數：${trip.days.length} 天`,
    `- 景點：${confirmedCount} 個已確認景點`,
  ];
  if (firstDay?.start?.title) lines.push(`- 起點：${escapeMarkdown(firstDay.start.title)}`);
  if (lastDay?.end?.title) lines.push(`- 終點：${escapeMarkdown(lastDay.end.title)}`);
  return lines.join('\n');
};

const renderDaySection = (day, options = {}) => [
  `## Day ${day.dayNumber}${day.date ? ` - ${day.date}` : ''}`,
  renderTimelineItem(day.start, options),
  ...day.items.map((item) => renderTimelineItem(item, options)),
  renderTimelineItem(day.end, options),
].join('\n');

const renderAppendix = (trip) => {
  const rows = trip.appendix.places
    .filter((point) => point.placeId || point.address || point.lat !== null || point.lng !== null)
    .map((point) => (
      `| Day ${point.dayNumber} | ${point.nodeType} | ${escapeMarkdown(point.title)} | ${escapeMarkdown(point.placeId || '')} | ${escapeMarkdown(point.address || '')} | ${point.lat ?? ''} | ${point.lng ?? ''} |`
    ));
  const warnings = trip.appendix.validationWarnings || [];
  return [
    '## Appendix',
    rows.length ? [
      '### 地點備援資訊',
      '| Day | Type | Name | PlaceID | Address | lat | lng |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      ...rows,
    ].join('\n') : '',
    warnings.length ? [
      '### 匯入檢查提醒',
      ...warnings.map((warning) => `- ${escapeMarkdown(warning.issue || warning.message || JSON.stringify(warning))}`),
    ].join('\n') : '',
  ].filter(Boolean).join('\n\n');
};

export function buildTripMarkdown(tripData, options = {}) {
  const trip = normalizeTripForExport(tripData, options);
  return [
    renderCover(trip),
    renderTripSummary(trip),
    ...trip.days.map((day) => renderDaySection(day, options)),
    renderAppendix(trip),
  ].filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n');
}

const formatDateRange = (trip) => [trip.meta.startDate, trip.meta.endDate].filter(Boolean).join(' - ');

const renderHtmlPoint = (point, options = {}) => {
  const details = [
    point.departureTime && point.nodeType === 'regular' ? `<li>離開：${escapeHtml(point.departureTime)}</li>` : '',
    point.stayDurationMins !== null && point.nodeType === 'regular' ? `<li>停留：${point.stayDurationMins} 分鐘</li>` : '',
    point.transportFromPreviousMins !== null && point.nodeType !== 'start' ? `<li>從上一站到此站：約 ${point.transportFromPreviousMins} 分鐘${point.transportMode ? `｜${escapeHtml(point.transportMode)}` : ''}</li>` : '',
    point.address ? `<li>地址：${escapeHtml(point.address)}</li>` : '',
    point.rating !== null ? `<li>評分：${point.rating}</li>` : '',
    point.mapsUrl ? `<li><a href="${escapeHtml(point.mapsUrl)}">Google Maps</a></li>` : '',
  ].filter(Boolean).join('');
  const typeText = point.nodeType === 'start' ? '出發' : point.nodeType === 'end' ? '終點' : '景點';
  return `
    <article class="timeline-card ${point.nodeType}">
      <div class="time-block">
        <span>${escapeHtml(point.arrivalTime || '--:--')}</span>
        <small>${typeText}</small>
      </div>
      <div class="body">
        <div class="card-heading"><h3>${escapeHtml(point.title)}</h3></div>
        ${options.includeImages !== false && point.photoUrl ? `<img class="place-photo" src="${escapeHtml(point.photoUrl)}" alt="${escapeHtml(point.title)}" loading="lazy" />` : ''}
        ${details ? `<ul>${details}</ul>` : ''}
        ${point.notes ? `<blockquote>${escapeHtml(point.notes).replace(/\n/g, '<br />')}</blockquote>` : ''}
      </div>
    </article>
  `;
};

export function buildTripPrintHtml(tripData, options = {}) {
  const trip = normalizeTripForExport(tripData, options);
  const confirmedCount = trip.days.reduce((count, day) => count + day.items.length, 0);
  const firstDay = trip.days[0];
  const lastDay = trip.days[trip.days.length - 1];
  const bookletStyle = getBookletStyle(options.bookletStyle);
  const assetSheetUrl = resolveBookletAssetUrl(bookletStyle, options);
  const pageBackground = bookletStyle.darkBackdrop
    ? `
        radial-gradient(circle at 12% 18%, rgba(255, 255, 255, 0.42) 0 1.3px, transparent 1.7px),
        radial-gradient(circle at 76% 12%, rgba(125, 211, 252, 0.46) 0 1.5px, transparent 1.9px),
        radial-gradient(circle at 88% 62%, rgba(244, 114, 182, 0.34) 0 1.4px, transparent 1.8px),
        radial-gradient(circle at 28% 72%, rgba(253, 186, 116, 0.34) 0 1.2px, transparent 1.7px),
        radial-gradient(circle at 50% 38%, rgba(14, 165, 233, 0.2), transparent 34%),
        linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 27, 75, 0.78) 44%, rgba(7, 10, 25, 0.98)),
        linear-gradient(180deg, #050816, #0f1230 52%, #050816)
      `
    : `
        linear-gradient(115deg, rgba(255, 247, 237, 0.9) 0 18%, transparent 18% 100%),
        linear-gradient(295deg, rgba(224, 242, 254, 0.72) 0 16%, transparent 16% 100%),
        radial-gradient(circle at 22px 22px, rgba(15, 118, 110, 0.16) 0 1.7px, transparent 1.9px),
        radial-gradient(circle at 60px 60px, rgba(249, 115, 22, 0.14) 0 1.4px, transparent 1.7px),
        repeating-linear-gradient(0deg, rgba(199, 185, 157, 0.08) 0 1px, transparent 1px 34px),
        repeating-linear-gradient(90deg, rgba(199, 185, 157, 0.07) 0 1px, transparent 1px 34px),
        linear-gradient(90deg, rgba(15, 118, 110, 0.08), transparent 42%),
        linear-gradient(180deg, ${bookletStyle.pageBg}, #fffaf0 54%, #f7fbff)
      `;
  const pageBackgroundSize = bookletStyle.darkBackdrop
    ? '220px 220px, 280px 280px, 260px 260px, 240px 240px, auto, auto, auto'
    : 'auto, auto, 96px 96px, 112px 112px, auto, auto, auto, auto';
  const dayHtml = trip.days.map((day) => `
    <section class="day">
      <div class="day-header">
        <span class="day-label">Day ${day.dayNumber}</span>
        <div>
          <h2>${day.date ? escapeHtml(day.date) : `第 ${day.dayNumber} 天`}</h2>
          <p>${escapeHtml(day.start.title)} 到 ${escapeHtml(day.end.title)}</p>
        </div>
      </div>
      ${renderHtmlPoint(day.start, options)}
      ${day.items.map((item) => renderHtmlPoint(item, options)).join('')}
      ${renderHtmlPoint(day.end, options)}
      <section class="memo-box">
        <h3>旅途中記一筆</h3>
        <div class="memo-lines"></div>
      </section>
    </section>
  `).join('');
  const appendixRows = trip.appendix.places
    .filter((point) => point.placeId || point.address || point.lat !== null || point.lng !== null)
    .map((point) => `
      <tr>
        <td>Day ${point.dayNumber}</td>
        <td>${escapeHtml(point.nodeType)}</td>
        <td>${escapeHtml(point.title)}</td>
        <td>${escapeHtml(point.placeId || '')}</td>
        <td>${escapeHtml(point.address || '')}</td>
      </tr>
    `).join('');
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(trip.meta.title)}｜離線行程</title>
  <style>
      :root {
        color: #243142;
        background: #f4f7f2;
        --asset-sheet: url("${escapeHtml(assetSheetUrl)}");
        --ink: #243142;
        --muted: #667085;
      --paper: ${bookletStyle.paper};
      --line: #e4dccb;
      --orange: ${bookletStyle.accent};
      --teal: ${bookletStyle.teal};
      --sky: ${bookletStyle.sky};
      --rose: ${bookletStyle.rose};
      --sun: #fef3c7;
      --day-bg: ${bookletStyle.dayBg};
      --card-bg: ${bookletStyle.cardBg};
      --timeline-line: ${bookletStyle.timelineLine};
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Inter", "Noto Sans TC", "Microsoft JhengHei", "Segoe UI", sans-serif;
      line-height: 1.6;
      background: ${pageBackground};
      background-size: ${pageBackgroundSize};
      min-height: 100vh;
    }
    body::before,
    body::after {
      content: "";
      position: fixed;
      z-index: 0;
      pointer-events: none;
      background-image: var(--asset-sheet);
      background-repeat: no-repeat;
      border: 0;
      border-radius: 8px;
      opacity: 0.22;
      filter: saturate(0.95);
    }
    body::before {
      width: 300px;
      height: 210px;
      left: max(18px, calc((100vw - 1040px) / 2 - 280px));
      top: 18vh;
      background-size: 1280px auto;
      background-position: ${bookletStyle.sideLeftPosition};
      transform: rotate(-8deg);
    }
    body::after {
      width: 320px;
      height: 220px;
      right: max(18px, calc((100vw - 1040px) / 2 - 292px));
      bottom: 8vh;
      background-size: 1320px auto;
      background-position: ${bookletStyle.sideRightPosition};
      transform: rotate(7deg);
    }
    main {
      position: relative;
      z-index: 1;
      max-width: 1040px;
      margin: 0 auto;
      padding: 28px 18px 64px;
    }
    .cover {
      min-height: 420px;
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
      background: var(--paper);
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(220px, 0.9fr);
      break-after: page;
    }
    .cover-copy { padding: 34px; display: flex; flex-direction: column; justify-content: space-between; gap: 28px; }
    .kicker { color: var(--teal); font-weight: 900; font-size: 0.82rem; }
    h1 { font-size: 2.6rem; line-height: 1.12; margin: 10px 0 12px; letter-spacing: 0; }
    .cover p { color: var(--muted); margin: 0; }
    .cover-photo {
      min-height: 100%;
      background:
        var(--asset-sheet),
        linear-gradient(135deg, #fed7aa, #bae6fd);
      background-size: 342% auto, cover;
      background-position: ${bookletStyle.coverPosition}, center;
      background-repeat: no-repeat;
      position: relative;
    }
    .cover-photo::after {
      content: "";
      position: absolute;
      inset: 18px;
      border: 2px solid rgba(255, 255, 255, 0.78);
      border-radius: 8px;
      pointer-events: none;
    }
    .stamp {
      align-self: flex-start;
      border: 2px solid var(--orange);
      color: var(--orange);
      border-radius: 999px;
      padding: 8px 14px;
      font-weight: 900;
      transform: rotate(-3deg);
    }
    .ticket-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin: 24px 0 28px;
    }
    .ticket {
      background: var(--paper);
      border: 1px dashed #d6c8ad;
      border-radius: 8px;
      padding: 12px;
      min-height: 82px;
      position: relative;
      break-inside: avoid;
    }
    .ticket span { display: block; color: var(--muted); font-size: 0.76rem; font-weight: 800; }
    .ticket strong { display: block; margin-top: 4px; font-size: 1rem; line-height: 1.35; }
    .ticket:nth-child(2) { border-color: color-mix(in srgb, var(--teal) 48%, #fff); background: color-mix(in srgb, var(--teal) 10%, #fff); }
    .ticket:nth-child(3) { border-color: color-mix(in srgb, var(--sky) 42%, #fff); background: color-mix(in srgb, var(--sky) 9%, #fff); }
    .ticket:nth-child(4) { border-color: color-mix(in srgb, var(--rose) 38%, #fff); background: color-mix(in srgb, var(--rose) 8%, #fff); }
    .doodle-strip {
      height: 132px;
      margin: -2px 0 22px;
      background-image:
        linear-gradient(rgba(255, 253, 248, 0.58), rgba(255, 253, 248, 0.58)),
        var(--asset-sheet);
      background-size: 100% 100%, 96% auto;
      background-position: center, ${bookletStyle.stripPosition};
      background-repeat: no-repeat;
      opacity: 1;
      break-inside: avoid;
    }
    .day {
      margin: 28px 0;
      padding: 22px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--day-bg);
      break-before: page;
      position: relative;
      overflow: hidden;
    }
    .day::before,
    .day::after {
      content: "";
      position: absolute;
      z-index: 0;
      pointer-events: none;
      background-image: var(--asset-sheet);
      background-repeat: no-repeat;
      opacity: 0.16;
      filter: saturate(0.9);
    }
    .day::before {
      right: -22px;
      top: 74px;
      width: 140px;
      height: 110px;
      background-size: 720px auto;
      background-position: 57% 93%;
      transform: rotate(8deg);
    }
    .day::after {
      left: -18px;
      bottom: 22px;
      width: 160px;
      height: 106px;
      background-size: 760px auto;
      background-position: 4% 93%;
      transform: rotate(-6deg);
    }
    .day > * { position: relative; z-index: 1; }
    .day-header {
      display: grid;
      grid-template-columns: 96px 1fr;
      gap: 16px;
      align-items: center;
      margin-bottom: 18px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--line);
      break-after: avoid;
    }
    .day-label {
      display: inline-flex;
      min-height: 64px;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      background:
        linear-gradient(135deg, rgba(15, 118, 110, 0.12), rgba(255, 255, 255, 0.92)),
        #fffdf8;
      border: 1px solid rgba(15, 118, 110, 0.38);
      color: var(--teal);
      font-weight: 900;
      font-size: 0.95rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.62);
    }
    h2 { margin: 0; font-size: 1.55rem; letter-spacing: 0; color: var(--ink); font-weight: 900; }
    .day-header p { margin: 4px 0 0; color: var(--muted); }
    .timeline-card {
      display: grid;
      grid-template-columns: 82px 1fr;
      gap: 14px;
      margin: 16px 0;
      break-inside: avoid;
    }
    .time-block {
      border-left: 4px solid var(--timeline-line);
      padding-left: 10px;
      color: var(--orange);
      font-weight: 900;
    }
    .time-block span { display: block; font-size: 1rem; }
    .time-block small { display: block; color: var(--muted); font-size: 0.72rem; margin-top: 2px; }
    .body {
      background: var(--card-bg);
      border: 1px solid #e7e0d1;
      border-radius: 8px;
      padding: 14px;
      box-shadow: 0 10px 22px rgba(36, 49, 66, 0.06);
    }
    .card-heading { margin-bottom: 10px; }
    h3 { margin: 0; font-size: 1.18rem; line-height: 1.35; }
    .place-photo {
      width: 100%;
      max-height: 250px;
      object-fit: cover;
      border-radius: 8px;
      margin: 2px 0 12px;
      background: #e5e7eb;
      border: 1px solid #f1f5f9;
    }
    ul { margin: 0; padding-left: 18px; color: #334155; }
    li + li { margin-top: 3px; }
    blockquote {
      margin: 12px 0 0;
      padding: 10px 12px;
      border: 1px solid #fed7aa;
      border-left: 4px solid var(--orange);
      border-radius: 8px;
      background: #fff7ed;
      color: #374151;
    }
    .memo-box {
      margin-top: 22px;
      padding: 14px;
      border: 1px dashed #c7b99d;
      border-radius: 8px;
      background: linear-gradient(#fff 0 0) padding-box;
      break-inside: avoid;
    }
    .memo-box h3 { font-size: 1rem; margin-bottom: 10px; color: var(--rose); }
    .memo-lines {
      height: 96px;
      background: repeating-linear-gradient(to bottom, transparent 0, transparent 27px, #e7e0d1 28px);
    }
    .appendix {
      margin: 28px 0;
      padding: 22px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      break-before: page;
    }
    .appendix h2 { margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 8px 6px; text-align: left; vertical-align: top; }
    th { color: var(--muted); background: #f8fafc; }
    .keepsake {
      margin-top: 18px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .keepsake div {
      min-height: 110px;
      border: 1px dashed #c7b99d;
      border-radius: 8px;
      padding: 12px;
      color: var(--muted);
      font-weight: 800;
      background: #fffdf8;
    }
    a { color: #0f766e; overflow-wrap: anywhere; }
    @media (max-width: 560px) {
      main { padding: 14px 10px 44px; }
      .cover { grid-template-columns: 1fr; min-height: 0; }
      .cover-copy { padding: 24px; }
      .cover-photo { min-height: 220px; }
      h1 { font-size: 2rem; }
      .ticket-grid { grid-template-columns: 1fr 1fr; }
      .doodle-strip {
        height: 96px;
        background-size: 100% 100%, 108% auto;
        background-position: center, center 96%;
      }
      .day { padding: 16px; }
      .day-header { grid-template-columns: 1fr; gap: 10px; }
      .timeline-card { grid-template-columns: 1fr; gap: 6px; }
      .time-block { border-left: 0; border-bottom: 3px solid var(--orange); padding: 0 0 6px; }
      .keepsake { grid-template-columns: 1fr; }
    }
    @media (max-width: 1280px) {
      body::before,
      body::after {
        opacity: 0.12;
        transform: none;
      }
    }
    @media print {
      body { background: #fff; }
      body::before,
      body::after { display: none; }
      main { max-width: none; padding: 0; }
      a { color: inherit; }
      .cover, .day, .appendix { box-shadow: none; }
    }
  </style>
</head>
<body>
  <main>
    <section class="cover">
      <div class="cover-copy">
        <div>
          <span class="kicker">TRAVEL BOOKLET</span>
          <h1>${escapeHtml(trip.meta.title)}</h1>
          <p>${escapeHtml(formatDateRange(trip))}</p>
        </div>
        <div class="stamp">OFFLINE COPY</div>
      </div>
      <div class="cover-photo" aria-label="travel booklet cover art"></div>
    </section>
    <section class="ticket-grid" aria-label="行程摘要">
      <article class="ticket"><span>DATES</span><strong>${escapeHtml(formatDateRange(trip) || '未設定')}</strong></article>
      <article class="ticket"><span>DAYS</span><strong>${trip.days.length} 天</strong></article>
      <article class="ticket"><span>ROUTE</span><strong>${escapeHtml(firstDay?.start?.title || '未設定')} → ${escapeHtml(lastDay?.end?.title || '未設定')}</strong></article>
      <article class="ticket"><span>PLACES</span><strong>${confirmedCount} 個景點</strong></article>
    </section>
    <div class="doodle-strip" aria-hidden="true"></div>
    ${dayHtml}
    <section class="appendix">
      <h2>Appendix</h2>
      ${appendixRows ? `
        <table>
          <thead><tr><th>Day</th><th>Type</th><th>Name</th><th>PlaceID</th><th>Address</th></tr></thead>
          <tbody>${appendixRows}</tbody>
        </table>
      ` : '<p>目前沒有額外地點備援資訊。</p>'}
      <section class="keepsake">
        <div>票根 / 收據</div>
        <div>紀念章 / 臨時筆記</div>
      </section>
    </section>
  </main>
</body>
</html>`;
}
