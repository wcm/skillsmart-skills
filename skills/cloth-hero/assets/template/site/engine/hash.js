// Spatial hash for particle neighbourhoods (after Müller's Ten Minute Physics): dense typed arrays, nothing allocated
// per frame. create() buckets every particle, queryAll() stores, for each particle, the lower-numbered particles
// within maxDist, so a solver can walk each close pair once.
// Cells as wide as the whole query (2 × maxDist) keep a lookup to 2 × 2 × 2 cells; each particle's cell is worked
// out once per create(), and the table is a power of two so a bucket is a bit-mask away.

export class SpatialHash {
  constructor(spacing, maxNumObjects) {
    this.spacing = spacing;
    let size = 1;
    while (size < 2 * maxNumObjects) size <<= 1;
    this.tableSize = size;
    this.mask = size - 1;
    this.cellStart = new Int32Array(size + 1);
    this.cellEntries = new Int32Array(maxNumObjects);
    this.cell = new Int32Array(3 * maxNumObjects); // each particle's integer cell coordinates
    this.queryIds = new Int32Array(4 * maxNumObjects);
    this.querySize = 0;
    this.maxNumObjects = maxNumObjects;
    this.firstAdjId = new Int32Array(maxNumObjects + 1);
    this.adjIds = new Int32Array(10 * maxNumObjects);
  }

  hashCoords(xi, yi, zi) {
    return (Math.imul(xi, 92837111) ^ Math.imul(yi, 689287499) ^ Math.imul(zi, 283923481)) & this.mask;
  }

  intCoord(c) { return Math.floor(c / this.spacing); }

  create(pos) {
    const n = Math.min(pos.length / 3, this.maxNumObjects);
    const { cellStart, cellEntries, cell } = this, inv = 1 / this.spacing;
    cellStart.fill(0);
    for (let i = 0; i < n; i++) {
      const xi = Math.floor(pos[3 * i] * inv), yi = Math.floor(pos[3 * i + 1] * inv), zi = Math.floor(pos[3 * i + 2] * inv);
      cell[3 * i] = xi; cell[3 * i + 1] = yi; cell[3 * i + 2] = zi;
      cellStart[this.hashCoords(xi, yi, zi)]++;
    }
    let start = 0;
    for (let i = 0; i < this.tableSize; i++) { start += cellStart[i]; cellStart[i] = start; }
    cellStart[this.tableSize] = start;
    for (let i = 0; i < n; i++) { const h = this.hashCoords(cell[3 * i], cell[3 * i + 1], cell[3 * i + 2]); cellStart[h]--; cellEntries[cellStart[h]] = i; }
  }

  query(pos, nr, maxDist) {
    const inv = 1 / this.spacing, x = pos[3 * nr], y = pos[3 * nr + 1], z = pos[3 * nr + 2];
    const x0 = Math.floor((x - maxDist) * inv), x1 = Math.floor((x + maxDist) * inv);
    const y0 = Math.floor((y - maxDist) * inv), y1 = Math.floor((y + maxDist) * inv);
    const z0 = Math.floor((z - maxDist) * inv), z1 = Math.floor((z + maxDist) * inv);
    const cap = this.queryIds.length, { cellStart, cellEntries, queryIds } = this;
    let q = 0;
    for (let xi = x0; xi <= x1; xi++)
      for (let yi = y0; yi <= y1; yi++)
        for (let zi = z0; zi <= z1; zi++) {
          const h = this.hashCoords(xi, yi, zi);
          for (let i = cellStart[h], end = cellStart[h + 1]; i < end && q < cap; i++) queryIds[q++] = cellEntries[i];
        }
    this.querySize = q;
  }

  queryAll(pos, maxDist) {
    let num = 0;
    const maxDist2 = maxDist * maxDist;
    const n = this.maxNumObjects;
    for (let id0 = 0; id0 < n; id0++) {
      this.firstAdjId[id0] = num;
      this.query(pos, id0, maxDist);
      const x = pos[3 * id0], y = pos[3 * id0 + 1], z = pos[3 * id0 + 2];
      for (let j = 0; j < this.querySize; j++) {
        const id1 = this.queryIds[j];
        if (id1 >= id0) continue;
        const dx = x - pos[3 * id1], dy = y - pos[3 * id1 + 1], dz = z - pos[3 * id1 + 2];
        if (dx * dx + dy * dy + dz * dz > maxDist2) continue;
        if (num >= this.adjIds.length) { const a = new Int32Array(2 * num); a.set(this.adjIds); this.adjIds = a; }
        this.adjIds[num++] = id1;
      }
    }
    this.firstAdjId[n] = num;
  }
}
