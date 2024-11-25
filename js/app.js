// import * as d3 from "d3";
// import "leaflet";
// import * as venn from "venn.js";
// import 'leaflet.markercluster';
// import "leaflet/dist/leaflet.css";
// import "leaflet.heat";

//retrieve data & create viz - Heatmap, tree map, venn diagram, thematic map
//station name - features.name:en + features.name (from points)
//stations from points - features.geometry.coordinates
//rail lines - features.geometry.coordinates

//province name gadm36_CHN_1 - features.properties.NAME_1
//province shape gadm36_CHN_1 - features.geometry.coordinates


// Heatmap, tree map, venn diagram - windowed, right side, click to expand and enable hover
// thematic map - full screen, animated flow map

//https://d3js.org/d3-scale-chromatic/sequential


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


  // Loading screen --------------------------------------------
  const loadingScreen = d3
    .select('body')
    .append('div')
    .attr('class', 'loading-screen')
    .style('position', 'fixed')
    .style('top', 0)
    .style('left', 0)
    .style('width', '100%')
    .style('height', '100%')
    .style('background', '#373737')
    .style('display', 'flex')
    .style('justify-content', 'center')
    .style('align-items', 'center')
    .style('z-index', 1000);

  // Add text clipping mask and loading wave animation
  const waveText = loadingScreen
    .append('div')
    .style('color', 'white')
    .style('font-size', '14px')
    .style('font-family', "'Open Sans', sans-serif")
    .style('font-weight', 'bold')
    .style('position', 'relative')
    .style('overflow', 'hidden')
    .style('width', '250px')
    .style('height', '50px')
    .style('text-align', 'center')
    .style('line-height', '50px')
    .style('padding', '10px')
    .text("Assembling Train Stations...");

  const wave = waveText
    .append('div')
    .style('position', 'absolute')
    .style('top', '0')
    .style('left', '-200px')
    .style('width', '200px')
    .style('height', '6px')
    .style(
      'background',
      'linear-gradient(to right, #00c6ff 0%, rgba(255, 255, 255, 0.2) 50%, #0072ff 100%)'
    )
    .style('border-radius', '10px') // Add rounded edges
    .style('animation', 'wave 2s infinite');

  d3.select('head').append('style').text(`
    @keyframes wave {
      0% { left: -200px; }
      50% { left: 100px; }
      100% { left: -200px; }
    }
  `);

  // Remove loading screen after 16s
    loadingScreen.transition().duration(16000).style('opacity', 0).remove();



//create leaflet map
const map = L.map(mapElement.node(), { zoomControl: false }).setView([35.5, 120.0], 4.5);

// Tile Layer
const tileLayer = L.tileLayer("https://tile.jawg.io/jawg-dark/{z}/{x}/{y}{r}.png?access-token={accessToken}", {
  // minZoom: 4.2,
  maxZoom: 12,
  attribution: '<a href="https://jawg.io" title="Tiles Courtesy of Jawg Maps" target="_blank">&copy; <b>Jawg</b>Maps<a/>',
  accessToken: '0XIwJCK3vkKyeaK2AJ93EcmGVY66M1EidVdHdLtdFO7N4ebcYje1xq0RFTxNHrIk'
}).addTo(map);

//title - Population/Station Density Index in China
const title = L.control({ position: "topleft" });
title.onAdd = function (map) {
  const div = L.DomUtil.create("div", "info title");
  div.style.color = "white";
  div.style.fontSize = "36px";
  div.style.fontWeight = "regular";
  div.style.fontFamily = "Open Sans, sans-serif";
  div.style.padding = "0px";
  div.style.paddingLeft = "1px";
  div.style.paddingBottom = "15px";
  div.style.textShadow = "3px 3px 2px rgba(0, 0, 0, 0.9)";
  div.innerHTML = "Population – Station Density Index <br/> In the Two Chinas";
  return div;
};
title.addTo(map);

//name, subject, course, semester
const attribution = L.control({ position: "bottomleft" });
attribution.onAdd = function (map) {
  const div = L.DomUtil.create("div", "info attribution");
  div.style.color = "white";
  div.style.fontSize = "12px";
  div.style.fontFamily = "Open Sans, sans-serif";
  div.style.padding = "0px";
  div.style.paddingLeft = "1px";
  div.style.textShadow = "2px 2px 4px rgba(0, 0, 0, 0.5)";
  div.innerHTML = "Data Visualisation & Information Aesthetics | Fall '24 | Xuan";
  return div;
};
attribution.addTo(map);


// Population Density Legend
const populationDensityLegend = L.control({ position: "topleft" });
populationDensityLegend.onAdd = function (map) {
  const div = L.DomUtil.create("div", "info legend");
  const gradient = d3.scaleSequential(d3.interpolateCool).domain([0, 1]);

  const legendSvg = d3.select(div)
    .append("svg")
    .attr("width", 290)
    .attr("height", 20)
    .style("padding-left", "1px");

  const gradientBar = legendSvg.append("defs")
    .append("linearGradient")
    .attr("id", "populationGradient")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "100%")
    .attr("y2", "0%");

  for (let i = 0; i <= 100; i++) {
    gradientBar.append("stop")
      .attr("offset", `${i}%`)
      .attr("stop-color", gradient(i / 100));
  }

  legendSvg.append("rect")
    .attr("x", 0)
    .attr("y", 2)
    .attr("width", 140)
    .attr("height", 15)
    .style("fill", "url(#populationGradient)")
    .style("stroke", "white")
    .style("stroke-width", "2px")
    .style("filter", "drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.5))");

  legendSvg.append("text")
    .attr("x", 150)
    .attr("y", 13)
    .style("fill", "white")
    .style("font-size", "12px")
    .style("font-family", "Open Sans, sans-serif")
    .style("font-weight", "bold")
    .style("text-shadow", "2px 2px 4px rgba(0, 0, 0, 0.5)")
    .text("Population Density");

  return div;
};
populationDensityLegend.addTo(map);


// Station Density Legend
const stationDensityLegend = L.control({ position: "topleft" });
stationDensityLegend.onAdd = function (map) {
  const div = L.DomUtil.create("div", "info legend");
  const gradient = t => d3.interpolateRgb("#4d4d4d", "#ffff00")(t);

  const legendSvg = d3.select(div)
    .append("svg")
    .attr("width", 290)
    .attr("height", 20)
    .style("padding-left", "1px");

  const gradientBar = legendSvg.append("defs")
    .append("linearGradient")
    .attr("id", "stationGradient")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "100%")
    .attr("y2", "0%");

  for (let i = 0; i <= 100; i++) {
    gradientBar.append("stop")
      .attr("offset", `${i}%`)
      .attr("stop-color", gradient(i / 100));
  }

  legendSvg.append("rect")
    .attr("x", 0)
    .attr("y", 2)
    .attr("width", 140)
    .attr("height", 15)
    .style("fill", "url(#stationGradient)")
    .style("stroke", "white")
    .style("stroke-width", "2px")
    .style("filter", "drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.5))");

  legendSvg.append("text")
    .attr("x", 150)
    .attr("y", 13)
    .style("fill", "white")
    .style("font-size", "12px")
    .style("font-family", "Open Sans, sans-serif")
    .style("font-weight", "bold")
    .style("text-shadow", "2px 2px 4px rgba(0, 0, 0, 0.5)")
    .text("Station Density");

  return div;
};
stationDensityLegend.addTo(map);



//thematic map
async function fetchDataMap() {
  try {
    const [StatResponse, RouteResponse, TWStatResponse, TWRouteResponse] = await Promise.all([
      d3.json("data/hotosm_chn_railways_points_geojson.geojson"),
      d3.json("data/hotosm_chn_railways_lines_geojson.geojson"),
      d3.json("data/hotosm_twn_railways_points_geojson.geojson"),
      d3.json("data/hotosm_twn_railways_lines_geojson.geojson")
    ]);

//     const stationMap = d3.rollup(
//       StatResponse.features,
//         v => v.length,
//         d => d.properties['name:en'] || d.properties.name,
//         d => d.geometry.coordinates
//       );

//     console.log("Stations mapped:");
//     console.log(stationMap);


    const stationRoute = d3.rollup(
      RouteResponse.features,
      v => v.length,
      d => d.geometry.coordinates
    );

  console.log("CN Route mapped:");
  console.log(stationRoute);

    const TWRoute = d3.rollup(
    TWRouteResponse.features,
    v => v.length,
    d => d.geometry.coordinates
    );

  console.log("TW Route mapped:");
  console.log(TWRoute);



//outline country china with geoBoundaries-CHN-ADM0_simplified.geojson
const chinaOutline = await d3.json("data/geoBoundaries-CHN-ADM0_simplified.geojson");

L.geoJSON(chinaOutline, {
  style: {
    // color: "#ff7800",
    color: "white",
    weight: 3,
    opacity: 0.7,
    fillOpacity: 0
  }
}).addTo(map);


// overlay population heat map from hotosm_chn_populated_places_points_geojson.geojson
const populationHeatData = await d3.json("data/hotosm_chn_populated_places_points_geojson.geojson");

const heatPoints = populationHeatData.features.map(feature => {
  const [lng, lat] = feature.geometry.coordinates;
  return [lat, lng, 1]; // 1 - intensity of the heat
});

const heatLayer = L.heatLayer(heatPoints, {
  radius: 5,
  blur: 15,
  maxZoom: 10,
  opacity: 0.5
}).addTo(map);


// overlay TW population heat map from hotosm_twn_populated_places_points_geojson.geojson
const TWpopulationHeatData = await d3.json("data/hotosm_twn_populated_places_points_geojson.geojson");

const TWheatPoints = TWpopulationHeatData.features.map(feature => {
  const [lng, lat] = feature.geometry.coordinates;
  return [lat, lng, 1]; // 1 - intensity of the heat
});


  const TWheatLayer = L.heatLayer(TWheatPoints, {
  radius: 5,
  blur: 15,
  maxZoom: 10,
  opacity: 0.5
}).addTo(map);



// Toggle button to show/hide heat map layer
const toggleHeatMapButton = L.control({ position: "bottomleft" });

toggleHeatMapButton.onAdd = function () {
  const div = L.DomUtil.create("div", "info toggle-heatmap-button");
  div.innerHTML = '<button id="toggleHeatMap" style="background: rgba(1, 156, 222, 0.2); border: 1px solid #4181f2; cursor: pointer; border-radius: 2px; padding-top: 5px; margin-left: -2px;"><img src="https://github.com/xuanx1/populationStationDensityChinas/blob/5cb8f0ddf55f8156210057baefe2a631775d7029/images/heatmap.svg" alt="Heat Map" style="width: 18px; height: 19px; filter: invert(38%) sepia(100%) saturate(1000%) hue-rotate(200deg) brightness(100%) contrast(400%);"></button>';
  return div;
};

toggleHeatMapButton.addTo(map);

let heatMapLayerVisible = true;

document.getElementById("toggleHeatMap").addEventListener("click", function () {
  if (heatMapLayerVisible) {
    map.removeLayer(heatLayer);
    map.removeLayer(TWheatLayer);
    heatMapLayerVisible = false;
  } else {
    map.addLayer(heatLayer);
    map.addLayer(TWheatLayer);
    heatMapLayerVisible = true;
  }
});



// overlay province outline from gadm36_CHN_1.json
const provinceOutline = await d3.json("data/gadm36_CHN_1.json");

L.geoJSON(provinceOutline, {
  style: {
    color: "white",
    weight: 1,
    opacity: 0.4,
    fillOpacity: 0
  }
}).addTo(map);


// Add points to the map with features.geometry.coordinates from data/hotosm_chn_railways_points_geojson.geojson
StatResponse.features.forEach(station => {
  const coords = station.geometry.coordinates; // Leaflet [lat, lng]
  L.circleMarker([coords[1], coords[0]], {
    radius: 0.0001,
    color: 'yellow',
    weight: 3,
    fillOpacity: 0.3,
    opacity: 0.2,
  }).addTo(map);
});


TWStatResponse.features.forEach(station => {
  const coords = station.geometry.coordinates; // Leaflet [lat, lng]
  L.circleMarker([coords[1], coords[0]], {
    radius: 0.0001,
    color: 'yellow',
    weight: 3,
    fillOpacity: 0.3,
    opacity: 0.2,
  }).addTo(map);
});


// Create a random moving dot moving from station to the next closest station and to the next for 5s, do not jump around, move like a train from stops to stops without using movingMarker plugin
const stations = StatResponse.features.concat(TWStatResponse.features);

function getClosestStation(currentStation, remainingStations) {
  let closestStation = null;
  let closestDistance = Infinity;

  remainingStations.forEach(station => {
    const distance = L.latLng(currentStation.geometry.coordinates[1], currentStation.geometry.coordinates[0])
      .distanceTo([station.geometry.coordinates[1], station.geometry.coordinates[0]]);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestStation = station;
    }
  });

  return closestStation;
}

async function moveTrain() {
  let currentStation = stations[0];
  let remainingStations = stations.slice(1);

  while (remainingStations.length > 0) {
    const nextStation = getClosestStation(currentStation, remainingStations);
    if (!nextStation) break;

    const currentLatLng = [currentStation.geometry.coordinates[1], currentStation.geometry.coordinates[0]];
    const nextLatLng = [nextStation.geometry.coordinates[1], nextStation.geometry.coordinates[0]];

    const marker = L.circleMarker(currentLatLng, {
      radius: 3,
      color: 'white',
      weight: 1,
      fillOpacity: 0.5,
      opacity: 0.5,
    }).addTo(map);

    await new Promise(resolve => {
      const duration = 100; // Reduced duration to move further distance in the same time
      const startTime = performance.now();

      function animate(time) {
        const t = (time - startTime) / duration;
        if (t < 1) {
          const lat = currentLatLng[0] + t * (nextLatLng[0] - currentLatLng[0]);
          const lng = currentLatLng[1] + t * (nextLatLng[1] - currentLatLng[1]);
          marker.setLatLng([lat, lng]);
          requestAnimationFrame(animate);
        } else {
          marker.setLatLng(nextLatLng);
          resolve();
        }
      }

      requestAnimationFrame(animate);
    });

    currentStation = nextStation;
    remainingStations = remainingStations.filter(station => station !== nextStation);
  }
}

moveTrain();



} catch (error) {
  console.error("Error fetching data:", error);
}
}

fetchDataMap();



//create a small windowed div for each viz
const heatmapDiv = app
  .append("div")
  .attr("id", "heatmap")
  .style("position", "absolute")
  .style("top", "20px")
  .style("right", "20px")
  .style("width", "467px")
  .style("height", "213px")
  .style("background", "rgba(0, 0, 0, 0.7)")
  .style("border", "0px solid white")
  .style("border-radius", "12px")
  .style("box-shadow", "0 4px 8px rgba(0, 0, 0, 0.5)")
  .style("overflow", "hidden")
  .style("opacity", "0.9")
  .style("z-index", "1000");

//heatmap - no. of stations in each province
async function fetchDataStationsByProvince() {
  try {
    const [pointsResponse, provincesResponse, taiwanResponse, taiwanStationsResponse] = await Promise.all([
      d3.json("data/hotosm_chn_railways_points_geojson.geojson"),
      d3.json("data/gadm36_CHN_1.json"),
      d3.json("data/taiwan.geojson"),
      d3.json("data/hotosm_twn_railways_points_geojson.geojson")
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

    console.log("Number of Stations in Each Province:");
    console.log(stationsByProvince);
   
    // Create a 2D heatmap to show the number of stations in each province
    const heatmapData = Array.from(stationsByProvince, ([province, count]) => ({ province, count }));

    const margin = { top: 40, right: 13, bottom: 17, left: 13 };
    const width = 467 - margin.left - margin.right;
    const height = 213 - margin.top - margin.bottom;

    const svg = d3.select("#heatmap")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    svg.append("text")
      .attr("x", 0)
      .attr("y", -13)
      .attr("text-anchor", "start")
      .style("font-size", "16px")
      .style("font-weight", "regular")
      .style("font-family", "Open Sans, sans-serif")
      .style("fill", "white")
      .text("Number of Stations in Each Province");

    const x = d3.scaleBand()
      .range([0, width])
      .padding(0.1)
      .domain(heatmapData.map(d => d.province));

    const y = d3.scaleLinear()
      .range([height, 0])
      .domain([0, 1]); // uniform bar height

    const color = d3.scaleSequential(d3.interpolateCool)
      .domain([0, d3.max(heatmapData, d => d.count) * 1.2]); // accentuate range

    svg.selectAll(".tile")
      .data(heatmapData)
      .enter().append("rect")
      .attr("class", "tile")
      .attr("x", d => x(d.province))
      .attr("width", x.bandwidth())
      .attr("y", 0) // uniform bar height
      .attr("height", height) // uniform bar height
      .attr("fill", d => color(d.count));

    // 2D heat map - upon hovering each bar, window showing number of stations
    svg.selectAll(".tile")
      .on("mouseover", async function(event, d) {
        const [x, y] = d3.pointer(event);
        const tooltip = d3.select("#heatmap")
          .append("div")
          .attr("class", "tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0, 0, 0, 0.8)")
          .style("color", "white")
          .style("padding", "10px")
          .style("border-radius", "7px")
          .style("pointer-events", "none")
          .style("font-family", "Open Sans, sans-serif")
          .style("font-size", "16px")
          .style("line-height", "24px")
          .style("border", "1px solid white")
          .style("box-shadow", "0 4px 8px rgba(0, 0, 0, 0.5)")
          .html(`Province <span style="color: #d2e531; font-weight: bold;">${d.province}</span><br>No. of Stations <span style="color: #d2e531; font-weight: bold;">${d.count}</span>`);

        const tooltipWidth = tooltip.node().offsetWidth;
        const tooltipHeight = tooltip.node().offsetHeight;
        const heatmapWidth = d3.select("#heatmap").node().offsetWidth;
        const heatmapHeight = d3.select("#heatmap").node().offsetHeight;

        let left = x + 15;
        let top = y - tooltipHeight - 15;

        if (left + tooltipWidth > heatmapWidth) {
          left = heatmapWidth - tooltipWidth - 15;
        }

        if (left < 0) {
          left = 15;
        }

        if (top < 0) {
          top = y + 15;
        }

        tooltip.style("left", `${left}px`).style("top", `${top}px`);

        // Highlight province on the map
        const provinceName = d.province;
        if (provinceName === "Taiwan" && d.count === 664) {
          const taiwanOutline = await d3.json("data/tw lvl1.geoJSON");
          const taiwanLayer = L.geoJSON(taiwanOutline, {
            style: {
              color: "#ffeebc",
              weight: 3,
              opacity: 1,
              fillOpacity: 0.8
            }
          }).addTo(map);
          d3.select(this).on("mouseout", function() {
            d3.select(".tooltip").remove();
            map.removeLayer(taiwanLayer);
          });
        } else {
          const province = provincesResponse.features.find(p => p.properties['NAME_1'] === provinceName);
          if (province) {
            L.geoJSON(province, {
              style: {
                color: "#ffeebc",
                weight: 3,
                opacity: 1,
                fillOpacity: 0.8
              }
            }).addTo(map);
          }
        }
      })
      .on("mouseout", function() {
        d3.select(".tooltip").remove();

        // Remove highlighted province
        map.eachLayer(layer => {
          if (layer.feature && (layer.feature.properties['NAME_1'] || layer.feature.properties['NAME'])) {
            map.removeLayer(layer);
          }
        });
      });



  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

fetchDataStationsByProvince();




const treeMapDiv = app
  .append("div")
  .attr("id", "treemap")
  .style("position", "absolute")
  .style("top", "250px")
  .style("right", "20px")
  .style("width", "467px")
  .style("height", "213px")
  .style("background", "rgba(0, 0, 0, 0.7)")
  .style("border", "0px solid white")
  .style("border-radius", "12px")
  .style("box-shadow", "0 4px 8px rgba(0, 0, 0, 0.5)")
  .style("overflow", "hidden")
  .style("opacity", "0.9")
  .style("z-index", "1000");


//treemap - no of stations in each province
async function fetchDataStationDensity() {
  try {
    const [pointsResponse, provincesResponse] = await Promise.all([
      d3.json("data/hotosm_chn_railways_points_geojson.geojson"),
      d3.json("data/gadm36_CHN_1.json")
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

  
  // Create a treemap to show the density of stations in each province
  const margin = { top: 40, right: 13, bottom: 17, left: 13 };
  const width = 467 - margin.left - margin.right;
  const height = 213 - margin.top - margin.bottom;

  const svg = d3.select("#treemap")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

svg.append("text")
  .attr("x", 0)
  .attr("y", -13)
  .attr("text-anchor", "start")
  .style("font-size", "16px")
  .style("font-weight", "regular")
  .style("font-family", "Open Sans, sans-serif")
  .style("fill", "white")
  .text("Density of Stations in Each Province");
  
  const root = d3.hierarchy({ children: Array.from(stationDensityByProvince, ([province, data]) => ({ province, ...data })) })
    .sum(d => d.density);

  const treemapLayout = d3.treemap()
    .size([width, height])
    .padding(2);

  treemapLayout(root);

  const color = d3.scaleSequential(d3.interpolateCool)
    .domain([0, d3.max(root.leaves(), d => d.data.density)]);

  const nodes = svg.selectAll('g')
    .data(root.leaves())
    .enter().append('g')
    .attr('transform', d => `translate(${d.x0},${d.y0})`);

  nodes.append('rect')
    .attr('width', d => d.x1 - d.x0)
    .attr('height', d => d.y1 - d.y0)
    .attr('fill', d => color(d.data.density));

  //tree map - upon hovering each bar, window showing province name, province area, density of stations
  nodes.on("mouseover", function(event, d) {
    const [x, y] = d3.pointer(event);
    const tooltip = d3.select("#treemap")
      .append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("padding", "10px")
      .style("border-radius", "7px")
      .style("pointer-events", "none")
      .style("font-family", "Open Sans, sans-serif")
      .style("font-size", "16px")
      .style("line-height", "24px") // adjust line height
      .style("border", "1px solid white")
      .style("box-shadow", "0 4px 8px rgba(0, 0, 0, 0.5)")
      .html(`Province <span style="color: #d2e531; font-weight: bold;">${d.data.province}</span><br>Area <span style="color: #d2e531; font-weight: bold;">${d.data.area.toFixed(2)} sq mi</span><br>Density <span style="color: #d2e531; font-weight: bold;">${d.data.density.toFixed(2)} Stations / mi&sup2;</span>`);

      
    const tooltipWidth = tooltip.node().offsetWidth;
    const tooltipHeight = tooltip.node().offsetHeight;
    const treemapWidth = d3.select("#treemap").node().offsetWidth;
    const treemapHeight = d3.select("#treemap").node().offsetHeight;

    let left = x + 15;
    let top = y - tooltipHeight - 15;

    if (left + tooltipWidth > treemapWidth) {
      left = treemapWidth - tooltipWidth - 15;
    }

    if (left < 0) {
      left = 15;
    }

    if (top < 0) {
      top = y + 15;
    }

    tooltip.style("left", `${left}px`).style("top", `${top}px`);

    // Highlight province on the map
    const provinceName = d.data.province;
    const province = provincesResponse.features.find(p => p.properties['NAME_1'] === provinceName);
    if (province) {
      L.geoJSON(province, {
        style: {
          color: "#ffeebc",
          weight: 3,
          opacity: 1,
          fillOpacity: 0.8
        }
      }).addTo(map);
    }
  })
  .on("mouseout", function() {
    d3.select(".tooltip").remove();

    // Remove highlighted province
    map.eachLayer(layer => {
      if (layer.feature && layer.feature.properties['NAME_1']) {
        map.removeLayer(layer);
      }
    });
  });

  
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

fetchDataStationDensity();



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



  //per capita of train stations per province with Scatterplot
  const scatterPlotDiv = app
    .append("div")
    .attr("id", "scatterplot")
    .style("position", "absolute")
    .style("top", "480px")
    .style("right", "20px")
    .style("width", "467px")
    .style("height", "213px")
    .style("background", "rgba(0, 0, 0, 0.7)")
    .style("border", "0px solid white")
    .style("border-radius", "12px")
    .style("box-shadow", "0 4px 8px rgba(0, 0, 0, 0.5)")
    .style("overflow", "hidden")
    .style("opacity", "0.9")
    .style("z-index", "1000");

  // Scatterplot - per capita of train stations by population of each province from China_Provinces_Population.json
  async function fetchDataScatterPlot() {
    try {
      const [pointsResponse, provincesResponse, populationResponse, taiwanResponse, taiwanStationsResponse] = await Promise.all([
        d3.json("data/hotosm_chn_railways_points_geojson.geojson"),
        d3.json("data/gadm36_CHN_1.json"),
        d3.json("data/China_Provinces_Population.json"),
        d3.json("data/taiwan.geojson"),
        d3.json("data/hotosm_twn_railways_points_geojson.geojson")
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

      // Create a scatterplot to show the per capita of train stations by population of each province
      const margin = { top: 47, right: 13, bottom: 17, left: 13 };
      const width = 467 - margin.left - margin.right;
      const height = 213 - margin.top - margin.bottom;

      const svg = d3.select("#scatterplot")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // title
      svg.append("text")
        .attr("x", 0)
        .attr("y", -18)
        .attr("text-anchor", "start")
        .style("font-size", "16px")
        .style("font-weight", "regular")
        .style("font-family", "Open Sans, sans-serif")
        .style("fill", "white")
        .attr("dy", "0px")
        .text("Per Capita of Train Stations by Population");
      
      // x-y axises settings
      const x = d3.scaleLinear()
        .range([0, width])
        .domain([0, d3.max(scatterPlotData, d => d.population)]);

      const y = d3.scaleLinear()
        .range([height, 0])
        .domain([0, d3.max(scatterPlotData, d => d.perCapita)]);

      // Add grid lines
      svg.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(5).tickSize(-height).tickFormat(''))
        .selectAll("line")
        .style("stroke", "white")
        .style("stroke-opacity", 0.2);

      svg.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(''))
        .selectAll("line")
        .style("stroke", "white")
        .style("stroke-opacity", 0.2);

      svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(0))
        .selectAll("path, line")
        .style("stroke", "white");

      // svg.append("g")
      //   .call(d3.axisLeft(y).ticks(0))
      //   .selectAll("path, line")
      //   .style("stroke", "white");
      
      // data points settings
      const color = d3.scaleSequential(d3.interpolateCool)
        .domain([0, d3.max(scatterPlotData, d => d.perCapita) * 0.7]); // Increase contrast

      svg.selectAll("circle")
        .data(scatterPlotData)
        .enter().append("circle")
        .attr("cx", d => Math.max(14, Math.min(width - 10, x(d.population))))
        .attr("cy", d => Math.max(14, Math.min(height - 10, y(d.perCapita))))
        .attr("r", 3.5)
        .style("fill", d => color(d.perCapita))
        .style("opacity", 0.9);


    //scatterplot- upon hovering each dot, window showing province name, per capita of stations
    svg.selectAll("circle")
      .on("mouseover", async function(event, d) {
      const [x, y] = d3.pointer(event);
      const tooltip = d3.select("#scatterplot")
      .append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("padding", "10px")
      .style("border-radius", "7px")
      .style("pointer-events", "none")
      .style("font-family", "Open Sans, sans-serif")
      .style("font-size", "16px")
      .style("line-height", "24px") // adjust line height
      .style("border", "1px solid white")
      .style("box-shadow", "0 4px 8px rgba(0, 0, 0, 0.5)")
      .html(`Province <span style="color: #d2e531; font-weight: bold;">${d.province}</span><br>Stations Per Capita <span style="color: #d2e531; font-weight: bold;">${Math.round(d.perCapita)} People / Station</span>`);


      const tooltipWidth = tooltip.node().offsetWidth;
      const tooltipHeight = tooltip.node().offsetHeight;
      const scatterplotWidth = d3.select("#scatterplot").node().offsetWidth;
      const scatterplotHeight = d3.select("#scatterplot").node().offsetHeight;

      let left = x + 15;
      let top = y - tooltipHeight - 15;

      if (left + tooltipWidth > scatterplotWidth) {
      left = scatterplotWidth - tooltipWidth - 15;
      }

      if (left < 0) {
      left = 15;
      }

      if (top < 0) {
      top = y + 15;
      }

      tooltip.style("left", `${left}px`).style("top", `${top}px`);

// Highlight province on the map
const provinceName = d.province;
if (provinceName === "Taiwan" && d.count === 664) {
  const taiwanOutline = await d3.json("data/tw lvl1.geoJSON");
  const taiwanLayer = L.geoJSON(taiwanOutline, {
    style: {
      color: "#ffeebc",
      weight: 3,
      opacity: 1,
      fillOpacity: 0.8
    }
  }).addTo(map);
  d3.select(this).on("mouseout", function() {
    d3.select(".tooltip").remove();
    map.removeLayer(taiwanLayer);
  });
} else {
  const province = provincesResponse.features.find(p => p.properties['NAME_1'] === provinceName);
  if (province) {
    L.geoJSON(province, {
      style: {
        color: "#ffeebc",
        weight: 3,
        opacity: 1,
        fillOpacity: 0.8
      }
    }).addTo(map);
  }
}
})
.on("mouseout", function() {
d3.select(".tooltip").remove();

// Remove highlighted province
map.eachLayer(layer => {
  if (layer.feature && (layer.feature.properties['NAME_1'] || layer.feature.properties['NAME'])) {
    map.removeLayer(layer);
  }
});
});


    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }

  fetchDataScatterPlot();
