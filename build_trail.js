const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./temp_at_data.json', 'utf8'));
const features = data.operationalLayers[1].featureCollection.layers[0].featureSet.features;

// Web Mercator to WGS84 conversion
function toLatLon(x, y) {
  const lon = (x / 20037508.34) * 180;
  let lat = (y / 20037508.34) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
  return [parseFloat(lon.toFixed(6)), parseFloat(lat.toFixed(6))];
}

// Filter official route only
const official = features.filter(f => f.attributes.STATUS === 'Official A.T. Route');
console.log('Official route segments:', official.length);

// Extract all segments as arrays of [lon,lat] with their start/end for chaining
const segments = official
  .filter(f => f.geometry && f.geometry.paths && f.geometry.paths.length > 0)
  .map(f => {
    const pts = [];
    f.geometry.paths.forEach(path => {
      path.forEach(([x, y]) => {
        pts.push(toLatLon(x, y));
      });
    });
    return pts;
  })
  .filter(seg => seg.length > 0);

// Build a chain by connecting segment endpoints
// Start from the southernmost point (Springer Mountain, ~34.6 lat)
// Find the segment whose start or end is closest to Springer
const springerLon = -84.1927;
const springerLat = 34.6295;

function dist(coord, lon, lat) {
  return Math.sqrt((coord[0] - lon) ** 2 + (coord[1] - lat) ** 2);
}

// Build spatial index: map from rounded endpoint to segment indices
const endpointMap = new Map();
function key(coord) {
  return coord[0].toFixed(4) + ',' + coord[1].toFixed(4);
}

segments.forEach((seg, i) => {
  const startKey = key(seg[0]);
  const endKey = key(seg[seg.length - 1]);
  if (!endpointMap.has(startKey)) endpointMap.set(startKey, []);
  endpointMap.get(startKey).push({ idx: i, end: 'start' });
  if (!endpointMap.has(endKey)) endpointMap.set(endKey, []);
  endpointMap.get(endKey).push({ idx: i, end: 'end' });
});

// Find starting segment (closest to Springer)
let bestDist = Infinity;
let bestIdx = 0;
let bestReverse = false;
segments.forEach((seg, i) => {
  const d1 = dist(seg[0], springerLon, springerLat);
  const d2 = dist(seg[seg.length - 1], springerLon, springerLat);
  if (d1 < bestDist) { bestDist = d1; bestIdx = i; bestReverse = false; }
  if (d2 < bestDist) { bestDist = d2; bestIdx = i; bestReverse = true; }
});

console.log('Starting segment:', bestIdx, 'reverse:', bestReverse, 'dist:', bestDist.toFixed(6));

// Chain segments together
const used = new Set();
const chain = [];

function addSegment(idx, reverse) {
  used.add(idx);
  const seg = reverse ? [...segments[idx]].reverse() : segments[idx];
  // Skip first point if chain already has points (avoid duplicates)
  const start = chain.length > 0 ? 1 : 0;
  for (let i = start; i < seg.length; i++) {
    chain.push(seg[i]);
  }
}

addSegment(bestIdx, bestReverse);

// Greedy chaining: find the next segment whose start/end matches our chain's end
let iterations = 0;
const maxIter = segments.length;
while (used.size < segments.length && iterations < maxIter) {
  iterations++;
  const lastPt = chain[chain.length - 1];
  const lastKey = key(lastPt);

  let found = false;
  // Look in endpoint map first (fast)
  const candidates = endpointMap.get(lastKey) || [];
  for (const cand of candidates) {
    if (used.has(cand.idx)) continue;
    const reverse = cand.end === 'end'; // if matched on end, we need to reverse
    addSegment(cand.idx, reverse);
    found = true;
    break;
  }

  if (!found) {
    // Brute force: find nearest unused segment endpoint
    let nearDist = Infinity;
    let nearIdx = -1;
    let nearReverse = false;
    for (let i = 0; i < segments.length; i++) {
      if (used.has(i)) continue;
      const seg = segments[i];
      const d1 = dist(seg[0], lastPt[0], lastPt[1]);
      const d2 = dist(seg[seg.length - 1], lastPt[0], lastPt[1]);
      if (d1 < nearDist) { nearDist = d1; nearIdx = i; nearReverse = false; }
      if (d2 < nearDist) { nearDist = d2; nearIdx = i; nearReverse = true; }
    }
    if (nearIdx >= 0 && nearDist < 0.1) { // ~0.1 degree tolerance
      addSegment(nearIdx, nearReverse);
      found = true;
    } else {
      break;
    }
  }
}

console.log('Chained segments:', used.size, '/', segments.length);
console.log('Total points in chain:', chain.length);
console.log('Start:', chain[0], 'End:', chain[chain.length - 1]);

// Downsample to ~500 points for reasonable file size
const targetPoints = 500;
const step = Math.max(1, Math.floor(chain.length / targetPoints));
const sampled = [];
for (let i = 0; i < chain.length; i += step) {
  sampled.push(chain[i]);
}
// Always include last point
if (sampled[sampled.length - 1] !== chain[chain.length - 1]) {
  sampled.push(chain[chain.length - 1]);
}

console.log('Sampled points:', sampled.length);

const geojson = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { name: 'Appalachian Trail' },
    geometry: {
      type: 'LineString',
      coordinates: sampled
    }
  }]
};

fs.writeFileSync('./trail.json', JSON.stringify(geojson, null, 2));
console.log('Wrote trail.json');
