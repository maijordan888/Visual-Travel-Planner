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
    arrivalTime: cleanText(arrivalTime),
    departureTime: cleanText(departureTime),
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

const renderHtmlPoint = (point, options = {}) => {
  const details = [
    point.departureTime && point.nodeType === 'regular' ? `<li>離開：${escapeHtml(point.departureTime)}</li>` : '',
    point.stayDurationMins !== null && point.nodeType === 'regular' ? `<li>停留：${point.stayDurationMins} 分鐘</li>` : '',
    point.transportFromPreviousMins !== null && point.nodeType !== 'start' ? `<li>從上一站到此站：約 ${point.transportFromPreviousMins} 分鐘${point.transportMode ? `｜${escapeHtml(point.transportMode)}` : ''}</li>` : '',
    point.address ? `<li>地址：${escapeHtml(point.address)}</li>` : '',
    point.rating !== null ? `<li>評分：${point.rating}</li>` : '',
    point.mapsUrl ? `<li><a href="${escapeHtml(point.mapsUrl)}">Google Maps</a></li>` : '',
  ].filter(Boolean).join('');
  return `
    <article class="timeline-card ${point.nodeType}">
      <div class="time">${escapeHtml(point.arrivalTime || '')}</div>
      <div class="body">
        <p class="type">${point.nodeType === 'start' ? '出發' : point.nodeType === 'end' ? '終點' : '景點'}</p>
        <h3>${escapeHtml(point.title)}</h3>
        ${options.includeImages !== false && point.photoUrl ? `<img src="${escapeHtml(point.photoUrl)}" alt="${escapeHtml(point.title)}" loading="lazy" />` : ''}
        ${details ? `<ul>${details}</ul>` : ''}
        ${point.notes ? `<blockquote>${escapeHtml(point.notes).replace(/\n/g, '<br />')}</blockquote>` : ''}
      </div>
    </article>
  `;
};

export function buildTripPrintHtml(tripData, options = {}) {
  const trip = normalizeTripForExport(tripData, options);
  const dayHtml = trip.days.map((day) => `
    <section class="day">
      <h2>Day ${day.dayNumber}${day.date ? ` - ${escapeHtml(day.date)}` : ''}</h2>
      ${renderHtmlPoint(day.start, options)}
      ${day.items.map((item) => renderHtmlPoint(item, options)).join('')}
      ${renderHtmlPoint(day.end, options)}
    </section>
  `).join('');
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(trip.meta.title)}｜離線行程</title>
  <style>
    :root { color: #1f2937; background: #f8fafc; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Noto Sans TC", "Segoe UI", sans-serif; line-height: 1.6; }
    main { max-width: 780px; margin: 0 auto; padding: 32px 18px 56px; }
    header { border-bottom: 3px solid #fb923c; padding-bottom: 22px; margin-bottom: 24px; }
    h1 { font-size: 2.2rem; margin: 0 0 8px; letter-spacing: 0; }
    h2 { break-after: avoid; margin: 34px 0 16px; font-size: 1.45rem; }
    .summary { display: grid; gap: 8px; padding: 16px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; }
    .timeline-card { display: grid; grid-template-columns: 70px 1fr; gap: 14px; margin: 16px 0; break-inside: avoid; }
    .time { color: #f97316; font-weight: 800; padding-top: 4px; }
    .body { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
    .type { margin: 0 0 4px; color: #6b7280; font-size: 0.82rem; font-weight: 800; }
    h3 { margin: 0 0 10px; font-size: 1.15rem; }
    img { width: 100%; max-height: 260px; object-fit: cover; border-radius: 8px; margin: 4px 0 12px; background: #e5e7eb; }
    ul { margin: 0; padding-left: 18px; }
    blockquote { margin: 12px 0 0; padding: 10px 12px; border-left: 4px solid #fb923c; background: #fff7ed; color: #374151; }
    a { color: #ea580c; }
    @media (max-width: 560px) {
      main { padding: 22px 12px 44px; }
      h1 { font-size: 1.75rem; }
      .timeline-card { grid-template-columns: 1fr; gap: 6px; }
      .time { padding: 0; }
    }
    @media print {
      body { background: #fff; }
      main { max-width: none; padding: 0; }
      a { color: inherit; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(trip.meta.title)}</h1>
      <p>${escapeHtml([trip.meta.startDate, trip.meta.endDate].filter(Boolean).join(' - '))}</p>
    </header>
    <section class="summary">
      <strong>行程摘要</strong>
      <span>天數：${trip.days.length} 天</span>
      <span>景點：${trip.days.reduce((count, day) => count + day.items.length, 0)} 個已確認景點</span>
    </section>
    ${dayHtml}
  </main>
</body>
</html>`;
}
