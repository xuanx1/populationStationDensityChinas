// ── Editorial palette (NYT Pudding–style) ──────────────────
const PALETTE = {
  ink: "#1a1a1a",
  inkSoft: "#444444",
  inkMute: "#888888",
  rule: "#e5e5e5",
  ruleStrong: "#cfcfcf",
  paper: "#fbfaf7",
  paperWarm: "#f4f1ea",
  accent: "#c8102e",
  highlight: "#ffb000",      // amber — matches the moving train dot, reads on red heat
};

// ── Shared GeoJSON cache ───────────────────────────────────
// Every dataset is fetched at most once and reused across all panels.
const _dataCache = new Map();
function loadJSON(path) {
  if (!_dataCache.has(path)) {
    _dataCache.set(path, d3.json(path));
  }
  return _dataCache.get(path);
}

const app = d3
  .select("#app")
  .html("")
  .style("position", "fixed")
  .style("inset", "0")
  .style("padding", "0")
  .style("overflow", "hidden");

const mapElement = app
  .append("div")
  .attr("id", "map")
  .style("position", "absolute")
  .style("top", "0")
  .style("left", "0")
  .style("right", "0")
  .style("bottom", "0")
  .style("width", "100%")
  .style("height", "100%");


  // Loading screen — editorial paper with kicker + serif headline + red rule
  const loadingScreen = d3
    .select('body')
    .append('div')
    .attr('class', 'loading-screen')
    .style('position', 'fixed')
    .style('top', 0)
    .style('left', 0)
    .style('width', '100%')
    .style('height', '100%')
    .style('display', 'flex')
    .style('flex-direction', 'column')
    .style('justify-content', 'center')
    .style('align-items', 'center')
    .style('z-index', 1000);

  loadingScreen.append('div').attr('class', 'loading-kicker')
    .html('An Atlas In Progress <span class="hanzi">数据加载中</span>');
  loadingScreen.append('div').attr('class', 'loading-headline')
    .html('Mapping the <span class="accent">Iron Pulse</span><br/>of the Two Chinas');
  loadingScreen.append('div').attr('class', 'loading-rule');

  // Loading screen is dismissed by Promise.all over every fetch (see bottom of file).



// Use a single shared canvas renderer for all vector overlays
const sharedRenderer = L.canvas({ padding: 0.5 });

// Constrain viewport to the Two Chinas — mainland + Taiwan + a small frame.
const TWO_CHINAS_BOUNDS = L.latLngBounds([15, 70], [55, 138]);

const map = L.map(mapElement.node(), {
  zoomControl: false,
  preferCanvas: true,
  renderer: sharedRenderer,
  zoomSnap: 0.25,
  // ── Map is fully locked: no user pan, no user zoom ──
  dragging: false,
  scrollWheelZoom: false,
  doubleClickZoom: false,
  touchZoom: false,
  boxZoom: false,
  keyboard: false,
  zoomControl: false,
  worldCopyJump: false
});

// Fit the Two Chinas into the corridor BETWEEN the left leaderboard and the
// right figure column. We reserve the actual footprint of each side's panel
// (scaled to match the responsive --panel-scale CSS variable) so the map
// centres in the visible middle space — not in the whole viewport.
const LEADERBOARD_W = 320, RIGHT_COL_W = 467, EDGE = 20, BUFFER = 20;

function currentPanelScale() {
  // Mirror the CSS:
  //   --panel-scale-w: clamp(0.55, calc((100vw - 200px) / 1400), 1)
  //   --panel-scale-h: clamp(0.55, calc((100vh -  80px) / 1100), 1)
  //   --panel-scale  : min(--panel-scale-w, --panel-scale-h)
  const w = Math.min(1, Math.max(0.55, (window.innerWidth  - 200) / 1400));
  const h = Math.min(1, Math.max(0.55, (window.innerHeight -  80) /  880));
  return Math.min(w, h);
}

function refitMap() {
  const scale = currentPanelScale();
  const reserveLeft  = EDGE + LEADERBOARD_W * scale + BUFFER;
  const reserveRight = EDGE + RIGHT_COL_W   * scale + BUFFER;
  map.fitBounds(TWO_CHINAS_BOUNDS, {
    paddingTopLeft:     [reserveLeft, 60],
    paddingBottomRight: [reserveRight, 60]
  });
  map.setZoom(map.getZoom() + 0.5);
}
refitMap();
window.addEventListener("resize", refitMap);

// No remote tile layer — the editorial look is carried by the paper background
// plus the local vector layers (country / province / Taiwan outlines, station
// dots, population heat, rail network). Keeping everything offline-friendly.

// Editorial masthead — kicker / serif headline with red italic accent / standfirst
const title = L.control({ position: "topleft" });
title.onAdd = function () {
  const div = L.DomUtil.create("div", "info editorial-title");
  div.innerHTML = `
    <span class="kicker">An Atlas of the Two Chinas <span class="hanzi">人口 &amp; 车站</span></span>
    <h1>Mapping the <span class="accent">Iron Pulse</span><br/>of the Two Chinas <span class="hanzi">两个中国的<span class="accent">血脉</span></span></h1>
    <p class="standfirst">A reading of population density against the railway network across mainland China and Taiwan &mdash; province by province, station by station.</p>
  `;
  return div;
};
title.addTo(map);

// Attribution byline — Pudding-style hairline rule + uppercase sans
const attribution = L.control({ position: "bottomleft" });
attribution.onAdd = function () {
  const div = L.DomUtil.create("div", "info editorial-attribution");
  div.innerHTML = "<strong>Xuan</strong> &middot; Data Visualisation &amp; Information Aesthetics &middot; Fall &rsquo;24";
  return div;
};
attribution.addTo(map);

// Two discrete colour-dot scales — moved into the bottom-left toggle row below.
const LEGEND_ROWS = [
  {
    labelText: "Population density",
    scale: t => d3.interpolateRgb(PALETTE.paperWarm, PALETTE.accent)(t)
  },
  {
    labelText: "Station density",
    scale: t => d3.interpolateRgb(PALETTE.paperWarm, PALETTE.ink)(t)
  }
];

function buildLegendDotsHTML(rows, swatches = 5) {
  return `<div class="legend-dots">${rows.map(row => {
    const dots = Array.from({ length: swatches }, (_, i) => {
      const t = swatches === 1 ? 0 : i / (swatches - 1);
      return `<span class="legend-dot" style="background:${row.scale(t)}"></span>`;
    }).join("");
    return `<div class="legend-row">${dots}<span class="legend-label">${row.labelText}</span></div>`;
  }).join("")}</div>`;
}



// Inlined heatmap toggle icon — removes the hard-coded /populationStationDensityChinas/ path
const HEATMAP_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" opacity="0.55"/><circle cx="12" cy="12" r="10" opacity="0.3"/></svg>';

//thematic map
async function fetchDataMap() {
  try {
    const [StatResponse, TWStatResponse, chinaOutline, provinceOutline,
           populationHeatData, TWpopulationHeatData] = await Promise.all([
      loadJSON("data/hotosm_chn_railways_points_geojson.geojson"),
      loadJSON("data/hotosm_twn_railways_points_geojson.geojson"),
      loadJSON("data/geoBoundaries-CHN-ADM0_simplified.geojson"),
      loadJSON("data/gadm36_CHN_1.json"),
      loadJSON("data/hotosm_chn_populated_places_points_geojson.geojson"),
      loadJSON("data/hotosm_twn_populated_places_points_geojson.geojson"),
    ]);

    // Population heat — sharper, punchier
    const heatGradient = {
      0.0: "rgba(255,200,200,0.0)",
      0.25: "rgba(240,160,170,0.85)",
      0.5: "rgba(220,80,95,0.95)",
      0.75: "rgba(200,16,46,1.0)",
      1.0: "rgba(140,10,30,1.0)"
    };

    // Subsample the populated-places file (~150k+ pts) so canvas redraws stay cheap.
    // Even-stride sampling preserves the spatial distribution.
    const HEAT_TARGET = 20000;
    const cnStride = Math.max(1, Math.floor(populationHeatData.features.length / HEAT_TARGET));
    const twStride = Math.max(1, Math.floor(TWpopulationHeatData.features.length / Math.min(HEAT_TARGET, 4000)));

    const heatPoints = [];
    for (let i = 0; i < populationHeatData.features.length; i += cnStride) {
      const [lng, lat] = populationHeatData.features[i].geometry.coordinates;
      heatPoints.push([lat, lng, 1]);
    }
    const heatLayer = L.heatLayer(heatPoints, {
      radius: 5, blur: 4, maxZoom: 10, minOpacity: 0.35, gradient: heatGradient
    }).addTo(map);

    const TWheatPoints = [];
    for (let i = 0; i < TWpopulationHeatData.features.length; i += twStride) {
      const [lng, lat] = TWpopulationHeatData.features[i].geometry.coordinates;
      TWheatPoints.push([lat, lng, 1]);
    }
    const TWheatLayer = L.heatLayer(TWheatPoints, {
      radius: 5, blur: 4, maxZoom: 10, minOpacity: 0.35, gradient: heatGradient
    }).addTo(map);

    // National outline — ink, on top of heat
    L.geoJSON(chinaOutline, {
      style: { color: PALETTE.ink, weight: 1.2, opacity: 1, fillOpacity: 0 }
    }).addTo(map);

    // Province outlines — Pudding map grey, on top of heat
    L.geoJSON(provinceOutline, {
      style: { color: "#6f6a5e", weight: 0.6, opacity: 0.85, fillOpacity: 0 }
    }).addTo(map);

    // Taiwan outline — same hairline grey as mainland provinces. Taiwan isn't
    // in gadm36_CHN_1, so without this it has no permanent stroke on the map.
    loadJSON("data/twlvl1.geojson").then(twOutline => {
      L.geoJSON(twOutline, {
        style: { color: "#6f6a5e", weight: 0.6, opacity: 0.85, fillOpacity: 0 }
      }).addTo(map);
    });

    // Station dots — every railway point as a crisp ink dot.
    // Subsample heavily: at the zoom levels used here, 1.2 px dots overlap once
    // there are more than ~10 k visible. The CN file ships ~50 k points; we draw
    // ~10 k. Reduces per-pan canvas-redraw cost by ~5×.
    const STATION_TARGET = 10000;
    const stationLayer = L.layerGroup();
    const drawStations = (features, target) => {
      const stride = Math.max(1, Math.floor(features.length / target));
      for (let i = 0; i < features.length; i += stride) {
        const [lng, lat] = features[i].geometry.coordinates;
        L.circleMarker([lat, lng], {
          radius: 1.2,
          color: PALETTE.ink,
          fillColor: PALETTE.ink,
          weight: 0,
          fillOpacity: 0.85,
          renderer: sharedRenderer,
          interactive: false
        }).addTo(stationLayer);
      }
    };
    drawStations(StatResponse.features, STATION_TARGET);
    drawStations(TWStatResponse.features, 2000);
    stationLayer.addTo(map);

    // Toggle button + legend in a single bottom-left control, side by side.
    const toggleHeatMapButton = L.control({ position: "bottomleft" });
    toggleHeatMapButton.onAdd = function () {
      const div = L.DomUtil.create("div", "info combined-control");
      div.innerHTML = `
        <button id="toggleHeatMap" class="editorial-toggle" title="Toggle population heatmap">${HEATMAP_ICON_SVG}<span>Population</span></button>
        ${buildLegendDotsHTML(LEGEND_ROWS)}
      `;
      L.DomEvent.disableClickPropagation(div);
      return div;
    };
    toggleHeatMapButton.addTo(map);

    let heatMapLayerVisible = true;
    const toggleBtn = document.getElementById("toggleHeatMap");
    toggleBtn.addEventListener("click", function () {
      if (heatMapLayerVisible) {
        map.removeLayer(heatLayer);
        map.removeLayer(TWheatLayer);
        heatMapLayerVisible = false;
        toggleBtn.classList.add("off");
      } else {
        map.addLayer(heatLayer);
        map.addLayer(TWheatLayer);
        heatMapLayerVisible = true;
        toggleBtn.classList.remove("off");
      }
    });

    // ── Railway network: lines + train animation ──
    // Load line geometries AFTER the heat/stations are visible. The CN file is
    // ~97 MB so we defer it past first paint and stream it in.
    //
    // The train uses its OWN canvas renderer. setLatLng() is called ~60×/sec,
    // and each call invalidates the renderer's canvas. If the train shared the
    // canvas with ~tens of thousands of station dots + thousands of polylines,
    // every animation frame would re-rasterise the whole network. With its own
    // renderer, only the small region around the dot redraws each frame.
    // Amber against the page's red / ink / paper palette — same colour as the
    // province hover highlight so the moving dot and the hovered region read
    // as the same visual cue. Paper halo keeps it legible on dark heat zones.
    const TRAIN_COLOR = PALETTE.highlight;
    const trainRenderer = L.canvas({ padding: 0.5 });
    const trainMarker = L.circleMarker([0, 0], {
      radius: 4.5,
      color: PALETTE.paper,
      fillColor: TRAIN_COLOR,
      weight: 2,
      fillOpacity: 1,
      opacity: 1,
      renderer: trainRenderer
    }).addTo(map);

    const deferred = window.requestIdleCallback || (cb => setTimeout(cb, 0));
    deferred(async () => {
      const [cnLines, twLines] = await Promise.all([
        loadJSON("data/hotosm_chn_railways_lines_geojson.geojson"),
        loadJSON("data/hotosm_twn_railways_lines_geojson.geojson")
      ]);

      // Render the rail network as a thin ink hairline under the station dots.
      // Subsample features so the canvas has fewer polylines to redraw on pan/zoom.
      // The TRAIN still walks the full vertex set built below — only the visual
      // layer is thinned.
      const railStyle = { color: PALETTE.ink, weight: 0.6, opacity: 0.55, interactive: false };
      const RAIL_STRIDE_CN = 3;
      const cnRailSub = { type: "FeatureCollection", features: cnLines.features.filter((_, i) => i % RAIL_STRIDE_CN === 0) };
      L.geoJSON(cnRailSub, { style: railStyle, renderer: sharedRenderer }).addTo(map);
      L.geoJSON(twLines,   { style: railStyle, renderer: sharedRenderer }).addTo(map);

      // Re-add station dots so they sit on top of the rail hairlines.
      map.removeLayer(stationLayer);
      stationLayer.addTo(map);

      // ── Train follows ACTUAL line vertices ──
      // Flatten every LineString / MultiLineString into a list of [lng,lat] paths,
      // then pick a long one near the start, walk its vertices in order, then jump
      // to the next nearby path. The dot never flies — it traces the rails.
      const paths = [];
      for (const f of cnLines.features.concat(twLines.features)) {
        const g = f.geometry;
        if (!g) continue;
        if (g.type === "LineString" && g.coordinates.length > 1) {
          paths.push(g.coordinates);
        } else if (g.type === "MultiLineString") {
          for (const seg of g.coordinates) {
            if (seg.length > 1) paths.push(seg);
          }
        }
      }
      if (paths.length === 0) return;

      // Prefer longer paths first so the journey reads as continuous mainline track.
      paths.sort((a, b) => b.length - a.length);

      // Quadtree over path *heads* so we can jump to the closest unused path.
      const pathQT = d3.quadtree()
        .x(p => p[0][0])
        .y(p => p[0][1])
        .addAll(paths);

      const SECONDS_PER_DEGREE = 600; // ~ms per 1° travelled — feels train-like at this zoom
      let current = pathQT.find(116.4, 39.9) || paths[0];
      if (current) pathQT.remove(current);

      while (current) {
        // Walk every vertex of this path in order.
        for (let i = 0; i < current.length - 1; i++) {
          const [ax, ay] = current[i];
          const [bx, by] = current[i + 1];
          const segDeg = Math.hypot(bx - ax, by - ay);
          if (segDeg === 0) continue;
          const duration = Math.min(900, Math.max(60, segDeg * SECONDS_PER_DEGREE));

          await new Promise(resolve => {
            const start = performance.now();
            function step(t) {
              const k = Math.min(1, (t - start) / duration);
              trainMarker.setLatLng([ay + k * (by - ay), ax + k * (bx - ax)]);
              if (k < 1) requestAnimationFrame(step); else resolve();
            }
            requestAnimationFrame(step);
          });
        }

        // Find the next path whose head is closest to where we ended.
        const tail = current[current.length - 1];
        const next = pathQT.find(tail[0], tail[1]);
        if (!next) break;
        pathQT.remove(next);

        // If the next path starts more than ~50 km away, snap silently instead
        // of drawing a flight line across empty terrain.
        const gap = Math.hypot(next[0][0] - tail[0], next[0][1] - tail[1]);
        if (gap > 0.5) trainMarker.setLatLng([next[0][1], next[0][0]]);
        current = next;
      }
    });

  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

const _mapReady = fetchDataMap();



// Panel sizing/positioning. Inter-panel gap (PANEL.gap) matches the screen-edge
// offset on the right (PANEL.right), so the visual breathing room is consistent
// in both directions.
const PANEL = { width: 467, height: 230, right: 20, gap: 20 };

// Editorial card containers (shared style)
function makePanel(id, top) {
  return app.append("div")
    .attr("id", id)
    .attr("class", "editorial-panel")
    .style("position", "absolute")
    .style("top", top + "px")
    .style("right", PANEL.right + "px")
    .style("width", PANEL.width + "px")
    .style("height", PANEL.height + "px")
    .style("overflow", "hidden")
    .style("z-index", "1000");
}

// Mid-left leaderboard — same editorial card styling, anchored to the left edge.
app.append("div")
  .attr("id", "leaderboard")
  .attr("class", "editorial-panel")
  .style("position", "absolute")
  .style("top", "280px")
  .style("left", "20px")
  .style("width", "320px")
  .style("height", "440px")
  .style("overflow", "hidden")
  .style("z-index", "1000");

// Province → macro-region (matches GADM NAME_1 values).
const PROVINCE_REGION = {
  Beijing: "North", Tianjin: "North", Hebei: "North", Shanxi: "North",
  "Nei Mongol": "North", "Inner Mongolia": "North",
  Liaoning: "Northeast", Jilin: "Northeast", Heilongjiang: "Northeast",
  Shanghai: "East", Jiangsu: "East", Zhejiang: "East", Anhui: "East",
  Fujian: "East", Jiangxi: "East", Shandong: "East", Taiwan: "East",
  Henan: "Central", Hubei: "Central", Hunan: "Central",
  Guangdong: "South", Guangxi: "South", Hainan: "South",
  "Hong Kong": "South", Macao: "South",
  Chongqing: "Southwest", Sichuan: "Southwest", Guizhou: "Southwest",
  Yunnan: "Southwest", Xizang: "Southwest", Tibet: "Southwest",
  Shaanxi: "Northwest", Gansu: "Northwest", Qinghai: "Northwest",
  Ningxia: "Northwest", "Ningxia Hui": "Northwest",
  Xinjiang: "Northwest", "Xinjiang Uygur": "Northwest"
};
const REGION_HANZI = {
  North: "北", Northeast: "东北", East: "东", Central: "中",
  South: "南", Southwest: "西南", Northwest: "西北"
};

// Proper English display for GADM NAME_1 values that have awkward labels.
const PROVINCE_EN = {
  "Nei Mongol":     "Inner Mongolia",
  "Ningxia Hui":    "Ningxia",
  "Xinjiang Uygur": "Xinjiang",
  "Xizang":         "Tibet"
};

// Full Chinese province name (keyed by GADM NAME_1 — both raw and clean forms).
const PROVINCE_CN = {
  Anhui:"安徽", Beijing:"北京", Chongqing:"重庆", Fujian:"福建", Gansu:"甘肃",
  Guangdong:"广东", Guangxi:"广西", Guizhou:"贵州", Hainan:"海南", Hebei:"河北",
  Heilongjiang:"黑龙江", Henan:"河南", "Hong Kong":"香港", Hubei:"湖北", Hunan:"湖南",
  Jiangsu:"江苏", Jiangxi:"江西", Jilin:"吉林", Liaoning:"辽宁", Macao:"澳门",
  "Nei Mongol":"内蒙古", "Inner Mongolia":"内蒙古",
  Ningxia:"宁夏", "Ningxia Hui":"宁夏",
  Qinghai:"青海", Shaanxi:"陕西", Shandong:"山东", Shanghai:"上海", Shanxi:"山西",
  Sichuan:"四川", Taiwan:"台湾", Tianjin:"天津",
  Xinjiang:"新疆", "Xinjiang Uygur":"新疆",
  Xizang:"西藏", Tibet:"西藏",
  Yunnan:"云南", Zhejiang:"浙江"
};

// Full Chinese name for macro-regions.
const REGION_CN = {
  North:"华北", Northeast:"东北", East:"华东", Central:"华中",
  South:"华南", Southwest:"西南", Northwest:"西北"
};

const displayEN = name => PROVINCE_EN[name] || name;

// Bilingual EN + CN snippet for a province (used in tooltip values).
function provinceValueHTML(name) {
  const cn = PROVINCE_CN[name];
  return `${displayEN(name)}${cn ? ` <span class="cn">${cn}</span>` : ""}`;
}

// Province → single-character abbreviation (matches GADM NAME_1 values).
const PROVINCE_HANZI = {
  Anhui: "皖", Beijing: "京", Chongqing: "渝", Fujian: "闽", Gansu: "甘",
  Guangdong: "粤", Guangxi: "桂", Guizhou: "贵", Hainan: "琼", Hebei: "冀",
  Heilongjiang: "黑", Henan: "豫", "Hong Kong": "港", Hubei: "鄂", Hunan: "湘",
  Jiangsu: "苏", Jiangxi: "赣", Jilin: "吉", Liaoning: "辽", Macao: "澳",
  "Nei Mongol": "蒙", "Inner Mongolia": "蒙",
  Ningxia: "宁", "Ningxia Hui": "宁",
  Qinghai: "青", Shaanxi: "陕", Shandong: "鲁", Shanghai: "沪", Shanxi: "晋",
  Sichuan: "川", Taiwan: "台", Tianjin: "津",
  Xinjiang: "新", "Xinjiang Uygur": "新",
  Xizang: "藏", Tibet: "藏",
  Yunnan: "滇", Zhejiang: "浙"
};

// ── Single tracked hover-highlight layer ─────────────────────────────────
// Replaces the old `map.eachLayer(...).filter(NAME_1).removeLayer(...)` pattern,
// which would scrub the province *outlines* (also keyed by NAME_1) every time
// a chart mouseout fired, leaving Taiwan and the province strokes wiped from
// the map until full page reload. Now only the layer we added on this hover
// is the one we remove.
let _hoverHighlight = null;
function setHoverHighlight(layer) {
  if (_hoverHighlight) map.removeLayer(_hoverHighlight);
  _hoverHighlight = layer;
}
function clearHoverHighlight() {
  if (_hoverHighlight) { map.removeLayer(_hoverHighlight); _hoverHighlight = null; }
}
async function highlightProvinceByName(name, provincesResponse) {
  if (name === "Taiwan") {
    const tw = await loadJSON("data/twlvl1.geojson");
    setHoverHighlight(L.geoJSON(tw, {
      style: { color: PALETTE.highlight, weight: 2.5, opacity: 1, fillColor: PALETTE.highlight, fillOpacity: 0.6 }
    }).addTo(map));
  } else {
    const f = provincesResponse.features.find(p => p.properties['NAME_1'] === name);
    if (f) setHoverHighlight(L.geoJSON(f, {
      style: { color: PALETTE.highlight, weight: 2.5, opacity: 1, fillColor: PALETTE.highlight, fillOpacity: 0.6 }
    }).addTo(map));
  }
}

// Render the top-N province leaderboard inside the mid-left panel.
function renderLeaderboard(stationsByProvince, provincesResponse, taiwanResponse) {
  const TOP_N = 10;
  const ranked = Array.from(stationsByProvince, ([province, count]) => ({ province, count }))
    .filter(d => d.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_N);

  const maxCount = ranked[0]?.count || 1;

  const panel = d3.select("#leaderboard").html("");

  // Header — same pattern as the other figure panels
  const header = panel.append("div").attr("class", "leaderboard-header");
  const headRow = header.append("div").attr("class", "leaderboard-headrow");
  headRow.append("span").attr("class", "panel-num-html").text("Fig. 01");
  const k = headRow.append("span").attr("class", "panel-kicker-html");
  k.append("span").text("Volume");
  k.append("span").attr("class", "hanzi").text("数量");
  header.append("div").attr("class", "panel-title-html").text("Top provinces, by stations");

  // Rows
  const list = panel.append("ol").attr("class", "leaderboard-list");
  const rows = list.selectAll("li").data(ranked).enter().append("li")
    .attr("class", "leaderboard-row")
    .on("mouseover", function(event, d) {
      let highlight = null;
      if (d.province === "Taiwan") {
        loadJSON("data/twlvl1.geojson").then(tw => {
          highlight = L.geoJSON(tw, {
            style: { color: PALETTE.highlight, weight: 2.5, opacity: 1, fillColor: PALETTE.highlight, fillOpacity: 0.6 }
          }).addTo(map);
          d3.select(this).on("mouseout.lb", () => { if (highlight) map.removeLayer(highlight); });
        });
      } else {
        const province = provincesResponse.features.find(p => p.properties['NAME_1'] === d.province);
        if (province) {
          highlight = L.geoJSON(province, {
            style: { color: PALETTE.highlight, weight: 2.5, opacity: 1, fillColor: PALETTE.highlight, fillOpacity: 0.6 }
          }).addTo(map);
          d3.select(this).on("mouseout.lb", () => { if (highlight) map.removeLayer(highlight); });
        }
      }
    });

  rows.append("span").attr("class", "lb-rank").text((_, i) => String(i + 1).padStart(2, "0"));
  rows.append("span").attr("class", "lb-hanzi").text(d => PROVINCE_HANZI[d.province] || "·");
  rows.append("span").attr("class", "lb-name").html(d => {
    const cn = PROVINCE_CN[d.province];
    return `${displayEN(d.province)}${cn ? ` <span class="cn">${cn}</span>` : ""}`;
  });
  // Bar is positioned absolute starting at left:56px; cap width to the available
  // track (~65% of the row) so it never runs under the value column on the right.
  rows.append("span").attr("class", "lb-bar").style("width", d => `${(d.count / maxCount) * 65}%`);
  rows.append("span").attr("class", "lb-value").text(d => d.count.toLocaleString());
}

// ── Fig. 04 — Regions: total stations grouped by macro-region ─────────
function renderRegions(stationsByProvince, provincesResponse) {
  const totals = new Map();
  for (const [prov, count] of stationsByProvince) {
    const region = PROVINCE_REGION[prov];
    if (!region) continue;
    totals.set(region, (totals.get(region) || 0) + count);
  }
  const data = Array.from(totals, ([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count);
  const maxCount = data[0]?.count || 1;

  const panel = d3.select("#regions").html("");
  const header = panel.append("div").attr("class", "leaderboard-header");
  const headRow = header.append("div").attr("class", "leaderboard-headrow");
  headRow.append("span").attr("class", "panel-num-html").text("Fig. 04");
  const k = headRow.append("span").attr("class", "panel-kicker-html");
  k.append("span").text("Region");
  k.append("span").attr("class", "hanzi").text("地区");
  header.append("div").attr("class", "panel-title-html").text("Stations by macro-region");

  const list = panel.append("ol").attr("class", "leaderboard-list region-list");
  const rows = list.selectAll("li").data(data).enter().append("li")
    .attr("class", "leaderboard-row")
    .on("mouseover", function(event, d) {
      const provinces = Object.keys(PROVINCE_REGION).filter(p => PROVINCE_REGION[p] === d.region);
      const highlights = [];
      provinces.forEach(provName => {
        if (provName === "Taiwan") {
          loadJSON("data/twlvl1.geojson").then(tw => {
            highlights.push(L.geoJSON(tw, {
              style: { color: PALETTE.highlight, weight: 2.5, opacity: 1, fillColor: PALETTE.highlight, fillOpacity: 0.6 }
            }).addTo(map));
          });
        } else {
          const f = provincesResponse.features.find(p => p.properties['NAME_1'] === provName);
          if (f) {
            highlights.push(L.geoJSON(f, {
              style: { color: PALETTE.highlight, weight: 2.5, opacity: 1, fillColor: PALETTE.highlight, fillOpacity: 0.6 }
            }).addTo(map));
          }
        }
      });
      d3.select(this).on("mouseout.rg", () => highlights.forEach(h => map.removeLayer(h)));
    });

  rows.append("span").attr("class", "lb-rank").text((_, i) => String(i + 1).padStart(2, "0"));
  rows.append("span").attr("class", "lb-hanzi").text(d => REGION_HANZI[d.region] || "·");
  rows.append("span").attr("class", "lb-name").html(d => {
    const cn = REGION_CN[d.region];
    return `${d.region}${cn ? ` <span class="cn">${cn}</span>` : ""}`;
  });
  rows.append("span").attr("class", "lb-bar").style("width", d => `${(d.count / maxCount) * 65}%`);
  rows.append("span").attr("class", "lb-value").text(d => d.count.toLocaleString());
}

// Heatmap-bar panel removed — leaderboard (Fig. 01) carries the same data.
// Right-column wrapper so the two figure panels scale together as one block,
// keeping the vertical gap between them proportional on narrow viewports.
const rightColumn = app.append("div")
  .attr("id", "right-column")
  .style("position", "absolute")
  .style("top", "20px")
  .style("right", "20px")
  .style("width", PANEL.width + "px")
  .style("z-index", "1000");

rightColumn.append("div")
  .attr("id", "treemap")
  .attr("class", "editorial-panel")
  .style("width", "100%")
  .style("height", PANEL.height + "px")
  .style("overflow", "hidden");

rightColumn.append("div")
  .attr("id", "scatterplot")
  .attr("class", "editorial-panel")
  .style("width", "100%")
  .style("height", PANEL.height + "px")
  .style("margin-top", PANEL.gap + "px")
  .style("overflow", "hidden");

// Height sized to fit the 8 macro-regions × leaderboard-style rows + header.
rightColumn.append("div")
  .attr("id", "regions")
  .attr("class", "editorial-panel")
  .style("width", "100%")
  .style("height", "346px")
  .style("margin-top", PANEL.gap + "px")
  .style("overflow", "hidden");

//heatmap - no. of stations in each province
async function fetchDataStationsByProvince() {
  try {
    const [pointsResponse, provincesResponse, taiwanResponse, taiwanStationsResponse] = await Promise.all([
      loadJSON("data/hotosm_chn_railways_points_geojson.geojson"),
      loadJSON("data/gadm36_CHN_1.json"),
      loadJSON("data/taiwan.geojson"),
      loadJSON("data/hotosm_twn_railways_points_geojson.geojson")
    ]);

    // Map to store the number of stations in each province
    const stationsByProvince = new Map();

    provincesResponse.features.forEach(province => {
      const provinceName = province.properties['NAME_1'];
      stationsByProvince.set(provinceName, 0);
    });

    pointsResponse.features.forEach(station => {
      const stationCoords = station.geometry.coordinates;
      provincesResponse.features.forEach(province => {
        const provinceCoords = province.geometry.coordinates;
        if (provinceCoords.some(polygon => d3.polygonContains(polygon, stationCoords))) {
          const provinceName = province.properties['NAME_1'];
          stationsByProvince.set(provinceName, stationsByProvince.get(provinceName) + 1);
        }
      });
    });

    // Include Taiwan data
    taiwanResponse.features.forEach(province => {
      const provinceName = "Taiwan";
      stationsByProvince.set(provinceName, 0);
    });

    taiwanStationsResponse.features.forEach(station => {
      const stationCoords = station.geometry.coordinates;
      taiwanResponse.features.forEach(province => {
      const provinceCoords = province.geometry.coordinates;
      if (provinceCoords.some(polygon => d3.polygonContains(polygon, stationCoords))) {
        const provinceName = "Taiwan";
        stationsByProvince.set(provinceName, stationsByProvince.get(provinceName) + 1);
      }
      });
    });

    renderLeaderboard(stationsByProvince, provincesResponse, taiwanResponse);
    renderRegions(stationsByProvince, provincesResponse);

  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

const _statsReady = fetchDataStationsByProvince();




//treemap - no of stations in each province
async function fetchDataStationDensity() {
  try {
    const [pointsResponse, provincesResponse] = await Promise.all([
      loadJSON("data/hotosm_chn_railways_points_geojson.geojson"),
      loadJSON("data/gadm36_CHN_1.json")
    ]);

    // Map to store the density of stations in each province
    const stationDensityByProvince = new Map();

    provincesResponse.features.forEach(province => {
      const provinceName = province.properties['NAME_1'];
      const provinceAreaSteradians = d3.geoArea(province);
      const provinceArea = provinceAreaSteradians * (6371 * 6371) * 0.386102; // Convert steradians to square kilometers, then to square miles
      stationDensityByProvince.set(provinceName, { count: 0, area: provinceArea });
    });

    pointsResponse.features.forEach(station => {
      const stationCoords = station.geometry.coordinates;
      provincesResponse.features.forEach(province => {
        const provinceCoords = province.geometry.coordinates;
        if (provinceCoords.some(polygon => d3.polygonContains(polygon, stationCoords))) {
          const provinceName = province.properties['NAME_1'];
          const provinceData = stationDensityByProvince.get(provinceName);
          provinceData.count += 1;
          stationDensityByProvince.set(provinceName, provinceData);
        }
      });
    });

    // Calculate density (stations per unit area)
    stationDensityByProvince.forEach((value, key) => {
      value.density = value.count / value.area;
    });

    console.log("Density of Stations in Each Province:");
    console.log(stationDensityByProvince);

  
  // HTML header — identical structure to Fig 01 / 04 / 05 for consistent spacing
  const treemapSel = d3.select("#treemap").html("");
  const header02 = treemapSel.append("div").attr("class", "leaderboard-header");
  const headRow02 = header02.append("div").attr("class", "leaderboard-headrow");
  headRow02.append("span").attr("class", "panel-num-html").text("Fig. 02");
  const k02 = headRow02.append("span").attr("class", "panel-kicker-html");
  k02.append("span").text("Density");
  k02.append("span").attr("class", "hanzi").text("密度");
  header02.append("div").attr("class", "panel-title-html").text("Station density, by province");

  // Treemap chart — fills the panel exactly down to its 8 px bottom padding,
  // so the bottom margin reads the same as Fig 04 (where the leaderboard-list
  // fills the remaining space via flex:1).
  const CHART_W = PANEL.width - 32;                         // panel width minus padding 16 × 2
  const HEADER_H = 58;                                       // measured: headrow + title + margins
  const CHART_H = PANEL.height - 2 - 14 - HEADER_H - 17 - 1;  // panel - borders - padding - header
  const margin = { top: 0, right: 0, bottom: 0, left: 0 };
  const width = CHART_W - margin.left - margin.right;
  const height = CHART_H - margin.top - margin.bottom;

  const svg = treemapSel.append("svg")
    .attr("class", "panel-chart")
    .attr("width", CHART_W)
    .attr("height", CHART_H)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const root = d3.hierarchy({ children: Array.from(stationDensityByProvince, ([province, data]) => ({ province, ...data })) })
    .sum(d => d.density);

  const treemapLayout = d3.treemap()
    .size([width, height])
    .padding(2);

  treemapLayout(root);

  const color = d3.scaleSequential(
    t => d3.interpolateRgb(PALETTE.paperWarm, PALETTE.ink)(t)
  ).domain([0, d3.max(root.leaves(), d => d.data.density)]);

  const nodes = svg.selectAll('g')
    .data(root.leaves())
    .enter().append('g')
    .attr('transform', d => `translate(${d.x0},${d.y0})`);

  nodes.append('rect')
    .attr('width', d => d.x1 - d.x0)
    .attr('height', d => d.y1 - d.y0)
    .attr('fill', d => color(d.data.density))
    .style("stroke", PALETTE.paper)
    .style("stroke-width", 0.5);

  const treemapPanel = document.getElementById("treemap");
  function placeTooltipBesideCursor(event, panel, tooltip) {
    const [mx, my] = d3.pointer(event, panel);
    const tw = tooltip.node().offsetWidth;
    const th = tooltip.node().offsetHeight;
    const pw = panel.offsetWidth, ph = panel.offsetHeight;
    const OFF = 12;
    // Default: just to the right of and below the cursor.
    let left = mx + OFF;
    let top  = my + OFF;
    // Flip to the LEFT of cursor if it would overflow the panel's right edge.
    if (left + tw > pw - 4) left = mx - tw - OFF;
    // Flip ABOVE cursor if it would overflow the bottom.
    if (top + th > ph - 4)  top  = my - th - OFF;
    if (left < 4) left = 4;
    if (top  < 4) top  = 4;
    tooltip.style("left", `${left}px`).style("top", `${top}px`);
  }

  nodes.on("mouseover", function(event, d) {
    const tooltip = d3.select("#treemap")
      .append("div")
      .attr("class", "editorial-tooltip")
      .html(
        `<span class="label">Province &middot; 省</span>` +
        `<span class="value">${provinceValueHTML(d.data.province)}</span>` +
        `<span class="label">Area &middot; 面积</span>` +
        `<span class="value">${d.data.area.toFixed(2)} sq mi</span>` +
        `<span class="label">Density &middot; 密度</span>` +
        `<span class="value accent">${d.data.density.toFixed(2)} / mi&sup2;</span>`
      );

    placeTooltipBesideCursor(event, treemapPanel, tooltip);

    highlightProvinceByName(d.data.province, provincesResponse);
  })
  .on("mousemove", function(event) {
    const tooltip = d3.select("#treemap .editorial-tooltip");
    if (!tooltip.empty()) placeTooltipBesideCursor(event, treemapPanel, tooltip);
  })
  .on("mouseout", function() {
    d3.select(".editorial-tooltip").remove();
    clearHoverHighlight();
  });


  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

const _densityReady = fetchDataStationDensity();



// const vennDiv = app
//   .append("div")
//   .attr("id", "venn")
//   .style("position", "absolute")
//   .style("top", "700px")
//   .style("right", "20px")
//   .style("width", "700px")
//   .style("height", "320px")
//   .style("background", "rgba(255, 255, 255, 0.8)")
//   .style("border", "0px solid white")
//   .style("border-radius", "20px")
//   .style("box-shadow", "0 4px 8px rgba(0, 0, 0, 0.5)")
//   .style("overflow", "hidden")
//   .style("background", "black")
//   .style("opacity", "0.9")
//   .style("z-index", "1000");


// //venn diagram - lines intersecting in each province
// async function fetchDataVenn() {
//   try {
//     const [linesResponse, provincesResponse] = await Promise.all([
//       d3.json("data/hotosm_chn_railways_lines_geojson.geojson"),
//       d3.json("data/gadm36_CHN_1.json")
//     ]);

//     const intersections = d3.rollup(
//       linesResponse.features,
//       v => v.length,
//       d => {
//         const lineCoords = d.geometry.coordinates;
//         return provincesResponse.features.filter(province => {
//           const provinceCoords = province.geometry.coordinates;
//           // Check if line intersects with province
//           return lineCoords.some(lineCoord => 
//             provinceCoords.some(provinceCoord => 
//               d3.polygonContains(provinceCoord, lineCoord)
//             )
//           );
//         }).map(province => province.properties['NAME_1']);
//       }
//     );

//     console.log("Lines intersecting Provinces:");
//     console.log(intersections);

//   } catch (error) {
//     console.error("Error fetching data:", error);
//   }
// }

// fetchDataVenn();
  //hover for intersecting province glow effect



  // Scatterplot - per capita of train stations by population of each province from China_Provinces_Population.json
  async function fetchDataScatterPlot() {
    try {
      const [pointsResponse, provincesResponse, populationResponse, taiwanResponse, taiwanStationsResponse] = await Promise.all([
        loadJSON("data/hotosm_chn_railways_points_geojson.geojson"),
        loadJSON("data/gadm36_CHN_1.json"),
        loadJSON("data/China_Provinces_Population.json"),
        loadJSON("data/taiwan.geojson"),
        loadJSON("data/hotosm_twn_railways_points_geojson.geojson")
      ]);

      // get number of stations & population in each province
      const stationsByProvince = new Map();
      const populationByProvince = new Map();

      provincesResponse.features.forEach(province => {
        const provinceName = province.properties['NAME_1'];
        stationsByProvince.set(provinceName, 0);
      });

      pointsResponse.features.forEach(station => {
        const stationCoords = station.geometry.coordinates;
        provincesResponse.features.forEach(province => {
          const provinceCoords = province.geometry.coordinates;
          if (provinceCoords.some(polygon => d3.polygonContains(polygon, stationCoords))) {
            const provinceName = province.properties['NAME_1'];
            stationsByProvince.set(provinceName, stationsByProvince.get(provinceName) + 1);
          }
        });
      });

      // Include Taiwan data
      taiwanResponse.features.forEach(province => {
        const provinceName = "Taiwan";
        stationsByProvince.set(provinceName, 0);
      });

      taiwanStationsResponse.features.forEach(station => {
        const stationCoords = station.geometry.coordinates;
        taiwanResponse.features.forEach(province => {
          const provinceCoords = province.geometry.coordinates;
          if (provinceCoords.some(polygon => d3.polygonContains(polygon, stationCoords))) {
            const provinceName = "Taiwan";
            stationsByProvince.set(provinceName, stationsByProvince.get(provinceName) + 1);
          }
        });
      });

      Object.entries(populationResponse).forEach(([provinceName, population]) => {
        populationByProvince.set(provinceName, population);
      });

      //calculate per capita
      const scatterPlotData = Array.from(stationsByProvince, ([province, count]) => ({
        province,
        count,
        population: populationByProvince.get(province) || 0,
        perCapita: count > 0 ? (populationByProvince.get(province) || 0) / count : 0
      })).filter(d => d.province !== 'Hebei');

      console.log("Per Capita of Train Stations by Population:");
      console.log(scatterPlotData);

      // HTML header — identical structure to Fig 01 / 02 / 04 / 05.
      const scatterSel = d3.select("#scatterplot").html("");
      const header03 = scatterSel.append("div").attr("class", "leaderboard-header");
      const headRow03 = header03.append("div").attr("class", "leaderboard-headrow");
      headRow03.append("span").attr("class", "panel-num-html").text("Fig. 03");
      const k03 = headRow03.append("span").attr("class", "panel-kicker-html");
      k03.append("span").text("Per Capita");
      k03.append("span").attr("class", "hanzi").text("人均");
      header03.append("div").attr("class", "panel-title-html").text("People per station, by province");

      // Scatter chart — same sizing AND visual bottom as Fig 02.
      // margin.bottom must be 0 so the axis line sits at the SVG bottom, otherwise
      // there is extra empty space below the chart that Fig 02 doesn't have.
      const CHART_W = PANEL.width - 32;
      const HEADER_H = 58;
      const CHART_H = PANEL.height - 2 - 14 - HEADER_H - 17 - 1;
      const margin = { top: 4, right: 4, bottom: 0, left: 4 };
      const width = CHART_W - margin.left - margin.right;
      const height = CHART_H - margin.top - margin.bottom;

      const svg = scatterSel.append("svg")
        .attr("class", "panel-chart")
        .attr("width", CHART_W)
        .attr("height", CHART_H)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const x = d3.scaleLinear()
        .range([0, width])
        .domain([0, d3.max(scatterPlotData, d => d.population)]);

      const y = d3.scaleLinear()
        .range([height, 0])
        .domain([0, d3.max(scatterPlotData, d => d.perCapita)]);

      svg.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(5).tickSize(-height).tickFormat(''));

      svg.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(''));

      svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(0))
        .selectAll("path, line")
        .style("stroke", PALETTE.ink);

      const color = d3.scaleSequential(
        t => d3.interpolateRgb(PALETTE.ruleStrong, PALETTE.accent)(t)
      ).domain([0, d3.max(scatterPlotData, d => d.perCapita) * 0.7]);

      svg.selectAll("circle")
        .data(scatterPlotData)
        .enter().append("circle")
        .attr("cx", d => Math.max(14, Math.min(width - 10, x(d.population))))
        .attr("cy", d => Math.max(14, Math.min(height - 10, y(d.perCapita))))
        .attr("r", 4.5)
        .style("fill", d => color(d.perCapita))
        .style("stroke", PALETTE.ink)
        .style("stroke-width", 0.6)
        .style("opacity", 0.95);

    const scatterPanel = document.getElementById("scatterplot");
    function placeScatterTooltip(event, tooltip) {
      const [mx, my] = d3.pointer(event, scatterPanel);
      const tw = tooltip.node().offsetWidth;
      const th = tooltip.node().offsetHeight;
      const pw = scatterPanel.offsetWidth, ph = scatterPanel.offsetHeight;
      const OFF = 12;
      let left = mx + OFF;
      let top  = my + OFF;
      if (left + tw > pw - 4) left = mx - tw - OFF;
      if (top + th > ph - 4)  top  = my - th - OFF;
      if (left < 4) left = 4;
      if (top  < 4) top  = 4;
      tooltip.style("left", `${left}px`).style("top", `${top}px`);
    }
    svg.selectAll("circle")
      .on("mouseover", function(event, d) {
        const tooltip = d3.select("#scatterplot")
          .append("div")
          .attr("class", "editorial-tooltip")
          .html(
            `<span class="label">Province &middot; 省</span>` +
            `<span class="value">${provinceValueHTML(d.province)}</span>` +
            `<span class="label">Stations per capita &middot; 人均车站</span>` +
            `<span class="value accent">${Math.round(d.perCapita).toLocaleString()} people / station</span>`
          );

        placeScatterTooltip(event, tooltip);
        highlightProvinceByName(d.province, provincesResponse);
      })
      .on("mousemove", function(event) {
        const tooltip = d3.select("#scatterplot .editorial-tooltip");
        if (!tooltip.empty()) placeScatterTooltip(event, tooltip);
      })
      .on("mouseout", function() {
        d3.select(".editorial-tooltip").remove();
        clearHoverHighlight();
      });

    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }

  const _scatterReady = fetchDataScatterPlot();

  // Dismiss the loading screen the moment every data fetch + render has settled.
  // 300 ms fade — no extra delay.
  Promise.all([_mapReady, _statsReady, _densityReady, _scatterReady]).finally(() => {
    loadingScreen.transition().duration(300).style('opacity', 0).remove();
  });
