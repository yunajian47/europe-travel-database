const BANK_RATE_NOTE = "匯率採臺灣銀行 2026/07/10 15:09 牌告賣出價；台銀未直接牌告的小幣別以 EUR 或 USD 牌告賣出價交叉估算，金額進位到新台幣個位數。";

const DIRECT_BOT_RATES = {
  USD: 32.415,
  EUR: 37.29,
  GBP: 44.08,
  CHF: 40.29,
  SEK: 3.39
};

const CURRENCY_RATES = {
  ...DIRECT_BOT_RATES,
  DKK: 5.0,
  NOK: 3.18,
  PLN: 8.78,
  CZK: 1.51,
  HUF: 0.092,
  RON: 7.34,
  BGN: 19.07,
  BAM: 19.07,
  RSD: 0.318,
  ALL: 0.38,
  MKD: 0.606,
  ISK: 0.262,
  MDL: 1.89,
  UAH: 0.78,
  BYN: 10.7
};

const CURRENCY_SYMBOLS = {
  USD: "US$",
  EUR: "€",
  GBP: "£",
  CHF: "CHF",
  SEK: "SEK",
  DKK: "DKK",
  NOK: "NOK",
  PLN: "PLN",
  CZK: "CZK",
  HUF: "HUF",
  RON: "RON",
  BGN: "BGN",
  BAM: "BAM",
  RSD: "RSD",
  ALL: "ALL",
  MKD: "MKD",
  ISK: "ISK",
  MDL: "MDL",
  UAH: "UAH",
  BYN: "BYN"
};

const COUNTRY_CURRENCY = {
  Albania: "ALL",
  Andorra: "EUR",
  Austria: "EUR",
  Belarus: "BYN",
  Belgium: "EUR",
  "Bosnia and Herzegovina": "BAM",
  Bulgaria: "BGN",
  Croatia: "EUR",
  Czechia: "CZK",
  Denmark: "DKK",
  Estonia: "EUR",
  Finland: "EUR",
  France: "EUR",
  Germany: "EUR",
  Greece: "EUR",
  Hungary: "HUF",
  Iceland: "ISK",
  Ireland: "EUR",
  Italy: "EUR",
  Kosovo: "EUR",
  Latvia: "EUR",
  Liechtenstein: "CHF",
  Lithuania: "EUR",
  Luxembourg: "EUR",
  Malta: "EUR",
  Moldova: "MDL",
  Monaco: "EUR",
  Montenegro: "EUR",
  Netherlands: "EUR",
  "North Macedonia": "MKD",
  Norway: "NOK",
  Poland: "PLN",
  Portugal: "EUR",
  Romania: "RON",
  "San Marino": "EUR",
  Serbia: "RSD",
  Slovakia: "EUR",
  Slovenia: "EUR",
  Spain: "EUR",
  Sweden: "SEK",
  Switzerland: "CHF",
  Ukraine: "UAH",
  "United Kingdom": "GBP",
  "Vatican City": "EUR"
};

const state = {
  places: [],
  filtered: [],
  map: null,
  markers: new Map(),
  markerLayer: null
};

const els = {
  statsGrid: document.querySelector("#statsGrid"),
  searchInput: document.querySelector("#searchInput"),
  countryFilter: document.querySelector("#countryFilter"),
  typeFilter: document.querySelector("#typeFilter"),
  ratingFilter: document.querySelector("#ratingFilter"),
  reviewFilter: document.querySelector("#reviewFilter"),
  sortSelect: document.querySelector("#sortSelect"),
  resetBtn: document.querySelector("#resetBtn"),
  countryChips: document.querySelector("#countryChips"),
  typeChips: document.querySelector("#typeChips"),
  resultCount: document.querySelector("#resultCount"),
  validationStatus: document.querySelector("#validationStatus"),
  cards: document.querySelector("#cards"),
  dialog: document.querySelector("#previewDialog"),
  previewContent: document.querySelector("#previewContent"),
  closePreview: document.querySelector("#closePreview")
};

function formatNumber(value) {
  return new Intl.NumberFormat("zh-Hant").format(value);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function inBounds(place, bounds) {
  const box = bounds[place.country];
  if (!box) return false;
  const [south, north, west, east] = box;
  return place.lat >= south && place.lat <= north && place.lng >= west && place.lng <= east;
}

function uniqueByLocation(places) {
  const seen = new Set();
  const dupes = [];
  for (const place of places) {
    const key = `${place.name.toLowerCase()}|${place.country}|${place.lat.toFixed(4)}|${place.lng.toFixed(4)}`;
    if (seen.has(key)) dupes.push(place);
    seen.add(key);
  }
  return dupes;
}

function detectCostCurrency(cost) {
  if (/£/.test(cost)) return "GBP";
  if (/€/.test(cost)) return "EUR";
  if (/CHF/i.test(cost)) return "CHF";
  if (/DKK/i.test(cost)) return "DKK";
  if (/SEK/i.test(cost)) return "SEK";
  if (/NOK/i.test(cost)) return "NOK";
  if (/ISK/i.test(cost)) return "ISK";
  if (/PLN/i.test(cost)) return "PLN";
  if (/RON/i.test(cost)) return "RON";
  if (/BGN/i.test(cost)) return "BGN";
  if (/BAM/i.test(cost)) return "BAM";
  if (/HUF/i.test(cost)) return "HUF";
  if (/BYN/i.test(cost)) return "BYN";
  if (/UAH/i.test(cost)) return "UAH";
  if (/MDL/i.test(cost)) return "MDL";
  if (/RSD/i.test(cost)) return "RSD";
  if (/ALL/i.test(cost)) return "ALL";
  if (/MKD/i.test(cost)) return "MKD";
  if (/USD|US\$/i.test(cost)) return "USD";
  return null;
}

function parseCostRange(cost) {
  const free = /free/i.test(cost) || /免費/.test(cost);
  const nums = cost.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (free) return nums.length > 0 ? [0, nums[0]] : [0, 0];
  if (nums.length === 0) return null;
  return nums.length === 1 ? [nums[0], nums[0]] : [nums[0], nums[1]];
}

function formatLocalAmount(code, value) {
  if (value === 0) return `${CURRENCY_SYMBOLS[code] ?? code}0`;
  const rounded = value >= 100 ? Math.ceil(value) : Math.ceil(value * 10) / 10;
  return `${CURRENCY_SYMBOLS[code] ?? code}${formatNumber(rounded)}`;
}

function costEstimate(place) {
  const original = place.cost || "";
  const localCode = COUNTRY_CURRENCY[place.country] || detectCostCurrency(original) || "EUR";
  const sourceCode = detectCostCurrency(original) || localCode;
  const range = parseCostRange(original);
  const localRate = CURRENCY_RATES[localCode];
  const sourceRate = CURRENCY_RATES[sourceCode];
  const isDirectBot = Boolean(DIRECT_BOT_RATES[localCode]);

  if (!range || !sourceRate || !localRate) {
    return {
      compact: `當地：${original || "依現場"}｜台幣：依現場`,
      local: original || "依現場",
      twd: "依現場",
      note: BANK_RATE_NOTE
    };
  }

  const twdRange = range.map(amount => Math.ceil(amount * sourceRate));
  const localRange = sourceCode === localCode
    ? range
    : twdRange.map(amount => amount / localRate);
  const localText = localRange[0] === localRange[1]
    ? formatLocalAmount(localCode, localRange[0])
    : `${formatLocalAmount(localCode, localRange[0])}-${formatLocalAmount(localCode, localRange[1]).replace(CURRENCY_SYMBOLS[localCode] ?? localCode, "")}`;
  const twdText = twdRange[0] === twdRange[1]
    ? `NT$${formatNumber(twdRange[0])}`
    : `NT$${formatNumber(twdRange[0])}-${formatNumber(twdRange[1])}`;
  const note = isDirectBot
    ? `${localCode} 採臺銀賣出價換算。`
    : `${localCode} 為台銀未直接牌告幣別，台幣金額由台銀 EUR/USD 賣出價交叉估算。`;

  return {
    compact: `${localText}｜${twdText}`,
    local: localText,
    twd: twdText,
    note
  };
}

function visualMarkup(place, variant = "card") {
  const title = escapeHtml(place.name);
  const location = escapeHtml(`${place.country} / ${place.region}`);
  const label = escapeHtml(place.typeLabel);
  const initial = escapeHtml(String(place.name || "?").trim().slice(0, 1).toUpperCase());
  return `
    <div class="place-visual place-visual-${variant} visual-${escapeHtml(place.type)}" aria-label="${title}">
      <span class="visual-initial">${initial}</span>
      <span class="visual-label">${label}</span>
      <span class="visual-title">${title}</span>
      <span class="visual-location">${location}</span>
    </div>
  `;
}

function photoSourceMarkup() {
  return `<p class="photo-credit">圖片：CSS 產生的穩定視覺圖卡，不依賴外部圖片來源，因此不會因熱連結或圖源失效而破圖。</p>`;
}

function setupMap() {
  state.map = L.map("map", {
    zoomControl: true,
    preferCanvas: true,
    worldCopyJump: false,
    maxBounds: [[32, -28], [72, 45]],
    maxBoundsViscosity: 0.25
  }).setView([50.8, 10.4], 4);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    minZoom: 3,
    attribution: "&copy; OpenStreetMap contributors",
    crossOrigin: true
  }).addTo(state.map);

  state.markerLayer = L.layerGroup().addTo(state.map);
  requestAnimationFrame(() => state.map.invalidateSize(true));
  setTimeout(() => state.map.invalidateSize(true), 300);
  window.addEventListener("resize", () => state.map.invalidateSize(true));
}

function markerIcon(place) {
  const color = {
    nature: "#15803d",
    "coast-lake-mountain": "#0369a1",
    restaurant: "#b45309",
    "cafe-dessert": "#a16207",
    bar: "#7c3aed",
    market: "#be123c",
    museum: "#1d4ed8",
    castle: "#9333ea",
    church: "#0f766e"
  }[place.type] || "#0f766e";
  return L.divIcon({
    className: "custom-marker",
    html: `<div class="dot-marker" style="background:${color}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
}

function renderStats() {
  const countries = new Set(state.places.map(p => p.country));
  const types = new Set(state.places.map(p => p.typeLabel));
  els.statsGrid.innerHTML = [
    ["總地點數", state.places.length],
    ["國家/地區數", countries.size],
    ["分類數", types.size]
  ].map(([label, value]) => `<div class="stat"><strong>${formatNumber(value)}</strong><span>${label}</span></div>`).join("");
}

function fillSelects() {
  const countries = [...new Set(state.places.map(p => p.country))].sort((a, b) => a.localeCompare(b));
  const types = [...new Map(state.places.map(p => [p.type, p.typeLabel])).entries()].sort((a, b) => a[1].localeCompare(b[1], "zh-Hant"));
  els.countryFilter.innerHTML = `<option value="">全部國家/地區</option>` + countries.map(country =>
    `<option value="${escapeHtml(country)}">${escapeHtml(country)}</option>`
  ).join("");
  els.typeFilter.innerHTML = `<option value="">全部類型</option>` + types.map(([type, label]) =>
    `<option value="${escapeHtml(type)}">${escapeHtml(label)}</option>`
  ).join("");
}

function countsBy(key) {
  return state.places.reduce((acc, place) => {
    const value = key === "country" ? place.country : place.type;
    const label = key === "country" ? place.country : place.typeLabel;
    if (!acc[value]) acc[value] = { value, label, count: 0 };
    acc[value].count += 1;
    return acc;
  }, {});
}

function renderChips() {
  const countryCounts = Object.values(countsBy("country")).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const typeCounts = Object.values(countsBy("type")).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "zh-Hant"));
  els.countryChips.innerHTML = countryCounts.map(item =>
    `<button class="chip ${els.countryFilter.value === item.value ? "active" : ""}" data-country="${escapeHtml(item.value)}">${escapeHtml(item.label)} ${item.count}</button>`
  ).join("");
  els.typeChips.innerHTML = typeCounts.map(item =>
    `<button class="chip ${els.typeFilter.value === item.value ? "active" : ""}" data-type="${escapeHtml(item.value)}">${escapeHtml(item.label)} ${item.count}</button>`
  ).join("");
}

function applyFilters() {
  const q = els.searchInput.value.trim().toLowerCase();
  const country = els.countryFilter.value;
  const type = els.typeFilter.value;
  const minRating = Number(els.ratingFilter.value);
  const minReviews = Number(els.reviewFilter.value);
  const sort = els.sortSelect.value;

  state.filtered = state.places.filter(place => {
    const haystack = `${place.name} ${place.country} ${place.region} ${place.typeLabel} ${place.reason} ${place.description}`.toLowerCase();
    return (!q || haystack.includes(q))
      && (!country || place.country === country)
      && (!type || place.type === type)
      && place.rating >= minRating
      && place.reviewCount >= minReviews;
  });

  state.filtered.sort((a, b) => {
    if (sort === "reviews") return b.reviewCount - a.reviewCount;
    if (sort === "rating") return b.rating - a.rating || b.reviewCount - a.reviewCount;
    if (sort === "region") return a.country.localeCompare(b.country) || a.region.localeCompare(b.region) || a.name.localeCompare(b.name);
    return (b.rating * 100000 + b.reviewCount) - (a.rating * 100000 + a.reviewCount);
  });

  renderChips();
  renderCards();
  renderMarkers();
}

function renderCards() {
  els.resultCount.textContent = `${formatNumber(state.filtered.length)} 個地點`;
  els.cards.innerHTML = state.filtered.map(place => {
    const cost = costEstimate(place);
    return `
      <article class="place-card" id="card-${place.id}">
        ${visualMarkup(place, "card")}
        <div class="card-main">
          <h2 class="card-title">${escapeHtml(place.name)}</h2>
          <div class="meta-line">
            <span class="pill type">${escapeHtml(place.typeLabel)}</span>
            <span class="pill">${escapeHtml(place.country)} / ${escapeHtml(place.region)}</span>
            <span class="pill rating">★ ${place.rating} · ${formatNumber(place.reviewCount)}</span>
          </div>
          <div class="cost-line" title="${escapeHtml(cost.note)}">
            <span>${escapeHtml(cost.local)}</span>
            <strong>${escapeHtml(cost.twd)}</strong>
          </div>
          <p class="card-reason">${escapeHtml(place.reason)}</p>
          <div class="card-actions">
            <button class="primary-button" type="button" data-preview="${place.id}">預覽</button>
            <a class="link-button" href="${place.googleMapsUrl}" target="_blank" rel="noopener">Google Maps</a>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderMarkers() {
  state.markerLayer.clearLayers();
  state.markers.clear();
  const bounds = [];

  for (const place of state.filtered) {
    const marker = L.marker([place.lat, place.lng], { icon: markerIcon(place) });
    const cost = costEstimate(place);
    marker.bindPopup(`
      <p class="popup-title">${escapeHtml(place.name)}</p>
      <div>${escapeHtml(place.country)} / ${escapeHtml(place.typeLabel)}</div>
      <div>★ ${place.rating} · ${formatNumber(place.reviewCount)}</div>
      <div>${escapeHtml(cost.compact)}</div>
      <button class="popup-button" type="button" data-popup-preview="${place.id}">預覽</button>
    `);
    marker.on("popupopen", () => {
      const btn = document.querySelector(`[data-popup-preview="${place.id}"]`);
      if (btn) btn.addEventListener("click", () => openPreview(place.id));
    });
    marker.addTo(state.markerLayer);
    state.markers.set(place.id, marker);
    bounds.push([place.lat, place.lng]);
  }

  if (bounds.length > 0) {
    state.map.fitBounds(bounds, { padding: [28, 28], maxZoom: 5.5 });
  }
  setTimeout(() => state.map.invalidateSize(true), 80);
  setTimeout(() => state.map.invalidateSize(true), 400);
}

function openPreview(id) {
  const place = state.places.find(item => item.id === id);
  if (!place) return;
  const cost = costEstimate(place);
  els.previewContent.innerHTML = `
    ${visualMarkup(place, "preview")}
    <div class="preview-body">
      <h2>${escapeHtml(place.name)}</h2>
      <div class="meta-line">
        <span class="pill type">${escapeHtml(place.typeLabel)}</span>
        <span class="pill">${escapeHtml(place.country)} / ${escapeHtml(place.region)}</span>
        <span class="pill rating">★ ${place.rating} · ${formatNumber(place.reviewCount)} 則評論</span>
      </div>
      <p>${escapeHtml(place.description)}</p>
      ${photoSourceMarkup()}
      <div class="preview-grid">
        <div class="info-box"><span>當地常用貨幣</span><strong>${escapeHtml(cost.local)}</strong></div>
        <div class="info-box"><span>約合新台幣</span><strong>${escapeHtml(cost.twd)}</strong></div>
        <div class="info-box"><span>座標</span><strong>${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}</strong></div>
        <div class="info-box"><span>推薦理由</span><strong>${escapeHtml(place.reason)}</strong></div>
      </div>
      <p class="rate-note">${escapeHtml(cost.note)} ${escapeHtml(BANK_RATE_NOTE)}</p>
      <div class="card-actions">
        <button class="primary-button" type="button" id="focusMapBtn">在地圖查看</button>
        <a class="link-button" href="${place.googleMapsUrl}" target="_blank" rel="noopener">開啟 Google Maps</a>
      </div>
    </div>
  `;
  els.dialog.showModal();
  document.querySelector("#focusMapBtn").addEventListener("click", () => {
    els.dialog.close();
    state.map.setView([place.lat, place.lng], 12);
    const marker = state.markers.get(place.id);
    if (marker) marker.openPopup();
    document.querySelector(".map-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => state.map.invalidateSize(true), 300);
  });
}

function validateData(data) {
  const outOfBounds = data.places.filter(place => !inBounds(place, data.countryBounds));
  const dupes = uniqueByLocation(data.places);
  const missingMap = data.places.filter(place => !place.googleMapsUrl || !place.googleMapsUrl.includes("google.com/maps"));
  const ok = outOfBounds.length === 0 && dupes.length === 0 && missingMap.length === 0;
  els.validationStatus.textContent = ok
    ? `座標國家檢查通過 · 地圖標記 ${state.filtered.length}/${state.filtered.length}`
    : `需檢查：座標 ${outOfBounds.length}、重複 ${dupes.length}、連結 ${missingMap.length}`;
  els.validationStatus.style.color = ok ? "#0f766e" : "#b42318";
}

function bindEvents(data) {
  [els.searchInput, els.countryFilter, els.typeFilter, els.ratingFilter, els.reviewFilter, els.sortSelect]
    .forEach(el => el.addEventListener("input", () => {
      applyFilters();
      validateData(data);
    }));

  els.resetBtn.addEventListener("click", () => {
    els.searchInput.value = "";
    els.countryFilter.value = "";
    els.typeFilter.value = "";
    els.ratingFilter.value = "0";
    els.reviewFilter.value = "0";
    els.sortSelect.value = "recommended";
    applyFilters();
    validateData(data);
  });

  els.countryChips.addEventListener("click", event => {
    const btn = event.target.closest("[data-country]");
    if (!btn) return;
    els.countryFilter.value = els.countryFilter.value === btn.dataset.country ? "" : btn.dataset.country;
    applyFilters();
  });

  els.typeChips.addEventListener("click", event => {
    const btn = event.target.closest("[data-type]");
    if (!btn) return;
    els.typeFilter.value = els.typeFilter.value === btn.dataset.type ? "" : btn.dataset.type;
    applyFilters();
  });

  els.cards.addEventListener("click", event => {
    const btn = event.target.closest("[data-preview]");
    if (btn) openPreview(btn.dataset.preview);
  });

  els.closePreview.addEventListener("click", () => els.dialog.close());
  els.dialog.addEventListener("click", event => {
    if (event.target === els.dialog) els.dialog.close();
  });
}

async function init() {
  setupMap();
  const response = await fetch(`assets/places.json?v=20260710v4`);
  const data = await response.json();
  state.places = data.places;
  renderStats();
  fillSelects();
  bindEvents(data);
  applyFilters();
  validateData(data);
}

init().catch(error => {
  console.error(error);
  els.validationStatus.textContent = "網站載入失敗，請檢查資料檔。";
  els.validationStatus.style.color = "#b42318";
});
