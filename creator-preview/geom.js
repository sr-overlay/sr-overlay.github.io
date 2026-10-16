/* Geometry helpers: homography, table coordinates, scenario element positions. No dependencies. */
(function (root) {
  "use strict";
  const MM_PER_INCH = 25.4;

  // Solve A x = b (n x n) by Gaussian elimination with partial pivoting.
  function solve(A, b) {
    const n = b.length;
    const M = A.map((row, i) => row.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) return null;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r][c] / M[c][c];
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    return M.map((row, i) => row[n] / row[i]);
  }

  // Homography H (row-major, length 9, H[8]=1) mapping src[i] -> dst[i], 4 point pairs.
  function homography(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const h = solve(A, b);
    if (!h) return null;
    return h.concat([1]);
  }

  function apply(H, x, y) {
    const w = H[6] * x + H[7] * y + H[8];
    return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w, w];
  }

  function invert(H) {
    const [a, b, c, d, e, f, g, h, i] = H;
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    const det = a * A + b * B + c * C;
    if (Math.abs(det) < 1e-15) return null;
    const inv = [A, -(b * i - c * h), b * f - c * e,
                 B, a * i - c * g, -(a * f - c * d),
                 C, -(a * h - b * g), a * e - b * d].map(v => v / det);
    return inv.map(v => v / inv[8]);
  }

  // Is the quad (screen points in order) convex and non-self-intersecting?
  function isConvexQuad(p) {
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const a = p[i], b = p[(i + 1) % 4], c = p[(i + 2) % 4];
      const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (Math.abs(z) < 1e-9) return false;
      const s = Math.sign(z);
      if (sign === 0) sign = s; else if (s !== sign) return false;
    }
    return true;
  }

  /*
   * Table coordinates: x 0..W left->right as printed in the packet, y 0..D with the
   * Defender (blue) edge at y=0 and the Attacker (red) edge at y=D.
   * Returns table coords for the corners the user taps, in tap order:
   * [near-left, near-right, far-right, far-left] as seen by someone standing at `side`.
   */
  const SIDES = {
    attacker: "Attacker (red) edge",
    defender: "Defender (blue) edge",
    left: "Attacker's left flank",
    right: "Attacker's right flank"
  };
  function cornerTableCoords(side, W, D) {
    switch (side) {
      case "defender": return [[W, 0], [0, 0], [0, D], [W, D]];
      case "left":     return [[0, 0], [0, D], [W, D], [W, 0]];
      case "right":    return [[W, D], [W, 0], [0, 0], [0, D]];
      default:         return [[0, D], [W, D], [W, 0], [0, 0]]; // attacker
    }
  }

  function baseRadiusIn(el) { return (el.base || 30) / 2 / MM_PER_INCH; }

  // Centre of an element in table inches. Positions are edge-of-table to edge-of-base.
  function elementCentre(el, W, D) {
    const r = baseRadiusIn(el), p = el.pos;
    let x, y;
    if (p.left != null) x = p.left + r; else if (p.right != null) x = W - p.right - r; else x = W / 2;
    if (p.top != null) y = p.top + r; else if (p.bottom != null) y = D - p.bottom - r; else y = D / 2;
    return { x, y, r };
  }

  const api = { homography, apply, invert, solve, isConvexQuad, cornerTableCoords, SIDES, elementCentre, baseRadiusIn, MM_PER_INCH };
  if (typeof module !== "undefined") module.exports = api;
  root.Geom = api;
})(typeof window !== "undefined" ? window : globalThis);
