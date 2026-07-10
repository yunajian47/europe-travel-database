
const state = {
  places: [],
  filtered: [],
  map: null,
  markers: new Map(),
  markerLayer: null,
  activeCountry: "",
  activeType: "",
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
  closePreview: document.querySelector("#closePreview"),
};

function formatNumber(n) {
  return new Intl.NumberFormat("zh-Hant").format(n);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
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

function setupMap() {
  state.map = L.map("map", {
    zoomControl: true,
    preferCanvas: true,
  }).setView([50.8, 10.4], 4);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(state.map);

  state.markerLayer = L.layerGroup().addTo(state.map);
  setTimeout(() => state.map.invalidateSize(), 100);
}

function markerIcon(place) {
  const color = {
    "nature": "#15803d",
    "coast-lake-mountain": "#0369a1",
    "restaurant": "#b45309",
    "cafe-dessert": "#a16207",
    "bar": "#7c3aed",
    "market": "#be123c",
    "museum": "#1d4ed8",
    "castle": "#9333ea",
    "church": "#0f766e",
  }[place.type] || "#0f766e";
  return L.divIcon({
    className: "",
    html: `<div class="dot-marker" style="background:${color}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function renderStats() {
  const countries = new Set(state.places.map(p => p.country));
  const types = new Set(state.places.map(p => p.typeLabel));
  els.statsGrid.innerHTML = [
    ["總地點數", state.places.length],
    ["國家/地區數", countries.size],
    ["分類數", types.size],
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
  els.cards.innerHTML = state.filtered.map(place => `
    <article class="place-card" id="card-${place.id}">
      <img src="${place.photo}" alt="${escapeHtml(place.name)}" loading="lazy">
      <div class="card-main">
        <h2 class="card-title">${escapeHtml(place.name)}</h2>
        <div class="meta-line">
          <span class="pill type">${escapeHtml(place.typeLabel)}</span>
          <span class="pill">${escapeHtml(place.country)} / ${escapeHtml(place.region)}</span>
          <span class="pill rating">★ ${place.rating} · ${formatNumber(place.reviewCount)}</span>
          <span class="pill">${escapeHtml(place.cost)}</span>
        </div>
        <p class="card-reason">${escapeHtml(place.reason)}</p>
        <div class="card-actions">
          <button class="primary-button" type="button" data-preview="${place.id}">預覽</button>
          <a class="link-button" href="${place.googleMapsUrl}" target="_blank" rel="noopener">Google Maps</a>
        </div>
      </div>
    </article>
  `).join("");
}

function renderMarkers() {
  state.markerLayer.clearLayers();
  state.markers.clear();
  const bounds = [];

  for (const place of state.filtered) {
    const marker = L.marker([place.lat, place.lng], { icon: markerIcon(place) });
    marker.bindPopup(`
      <p class="popup-title">${escapeHtml(place.name)}</p>
      <div>${escapeHtml(place.country)} / ${escapeHtml(place.typeLabel)}</div>
      <div>★ ${place.rating} · ${formatNumber(place.reviewCount)}</div>
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
    state.map.fitBounds(bounds, { padding: [28, 28], maxZoom: 6 });
  }
  setTimeout(() => state.map.invalidateSize(), 60);
}

function openPreview(id) {
  const place = state.places.find(item => item.id === id);
  if (!place) return;
  els.previewContent.innerHTML = `
    <img class="preview-image" src="${place.photo}" alt="${escapeHtml(place.name)}">
    <div class="preview-body">
      <h2>${escapeHtml(place.name)}</h2>
      <div class="meta-line">
        <span class="pill type">${escapeHtml(place.typeLabel)}</span>
        <span class="pill">${escapeHtml(place.country)} / ${escapeHtml(place.region)}</span>
        <span class="pill rating">★ ${place.rating} · ${formatNumber(place.reviewCount)} 則評論</span>
      </div>
      <p>${escapeHtml(place.description)}</p>
      <div class="preview-grid">
        <div class="info-box"><span>花費估算</span><strong>${escapeHtml(place.cost)}</strong></div>
        <div class="info-box"><span>座標</span><strong>${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}</strong></div>
        <div class="info-box"><span>推薦理由</span><strong>${escapeHtml(place.reason)}</strong></div>
        <div class="info-box"><span>資料提醒</span><strong>${escapeHtml(place.dataNote)}</strong></div>
      </div>
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
  const response = await fetch(`assets/places.json?v=${Date.now()}`);
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
