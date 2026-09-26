/* Canvas rendering of a scenario through a table->screen homography. Depends on geom.js. */
(function (root) {
  "use strict";
  const G = root.Geom || (typeof require !== "undefined" ? require("./geom.js") : null);

  const COLORS = {
    attacker: "#ff3b30", defender: "#2f8cff", neutral: "#ffd60a",
    attackerFill: "rgba(255,59,48,0.20)", defenderFill: "rgba(47,140,255,0.20)"
  };
  const DEFAULTS = {
    zones: true, advance: false, killBox: true, ranges: true, flagRadius: true,
    dims: false, labels: true, centre: true, background: false, lineScale: 1
  };

  function findEl(s, q) {
    return s.elements.find(e => e.kind === q.kind && (q.base == null || e.base === q.base) && (q.owner == null || e.owner === q.owner));
  }

  function drawOverlay(ctx, H, data, scenario, userOpts) {
    const o = Object.assign({}, DEFAULTS, userOpts || {});
    const W = o.W || data.table.width, D = o.D || data.table.depth;
    const LS = o.lineScale;
    const P = (x, y) => G.apply(H, x, y);
    const ppi = (x, y) => {
      const a = P(x, y), b = P(x + 1, y), c = P(x, y + 1);
      return (Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - a[0], c[1] - a[1])) / 2;
    };
    const path = (pts, close) => {
      ctx.beginPath();
      pts.forEach((p, i) => { const q = P(p[0], p[1]); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
      if (close) ctx.closePath();
    };
    const circlePts = (cx, cy, r, n) => { const a = []; n = n || 64; for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2; a.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } return a; };
    const stroke = (color, width, dash, shadow) => {
      ctx.setLineDash(dash ? dash.map(d => d * LS) : []);
      if (shadow !== false) { ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.lineWidth = (width + 2) * LS; ctx.stroke(); }
      ctx.strokeStyle = color; ctx.lineWidth = width * LS; ctx.stroke(); ctx.setLineDash([]);
    };
    const text = (str, x, y, color, sizeIn, opt) => {
      opt = opt || {};
      const q = P(x, y);
      const px = Math.max(opt.min || 10, Math.min(opt.max || 30, sizeIn * ppi(x, y)));
      ctx.font = `${opt.bold === false ? "" : "bold "}${px.toFixed(1)}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineJoin = "round"; ctx.lineWidth = Math.max(2, px / 5); ctx.strokeStyle = "rgba(0,0,0,0.8)";
      ctx.strokeText(str, q[0], q[1]); ctx.fillStyle = color; ctx.fillText(str, q[0], q[1]);
    };

    ctx.save();
    // Table surface (map mode)
    if (o.background) {
      path([[0, 0], [W, 0], [W, D], [0, D]], true);
      ctx.fillStyle = "#2f4a2c"; ctx.fill();
      // 6" grid
      for (let g = 6; g < Math.max(W, D); g += 6) {
        if (g < W) { path([[g, 0], [g, D]]); stroke("rgba(255,255,255,0.08)", 1, null, false); }
        if (g < D) { path([[0, g], [W, g]]); stroke("rgba(255,255,255,0.08)", 1, null, false); }
      }
    }

    // Deployment zones
    const dz = data.deployment;
    if (o.zones) {
      path([[0, 0], [W, 0], [W, dz.defender], [0, dz.defender]], true); ctx.fillStyle = COLORS.defenderFill; ctx.fill();
      path([[0, D - dz.attacker], [W, D - dz.attacker], [W, D], [0, D]], true); ctx.fillStyle = COLORS.attackerFill; ctx.fill();
      path([[0, dz.defender], [W, dz.defender]]); stroke(COLORS.defender, 3);
      path([[0, D - dz.attacker], [W, D - dz.attacker]]); stroke(COLORS.attacker, 3);
      if (o.labels) {
        text(`DEFENDER deploy ${dz.defender}"`, W * 0.5, dz.defender / 2, COLORS.defender, 1.1, { max: 22 });
        text(`ATTACKER deploy ${dz.attacker}"`, W * 0.5, D - dz.attacker / 2, COLORS.attacker, 1.1, { max: 22 });
      }
    }
    if (o.advance) {
      const a = dz.advanceDeploymentExtra;
      path([[0, dz.defender + a], [W, dz.defender + a]]); stroke(COLORS.defender, 1.5, [10, 6]);
      path([[0, D - dz.attacker - a], [W, D - dz.attacker - a]]); stroke(COLORS.attacker, 1.5, [10, 6]);
      if (o.labels) {
        text(`AD ${dz.defender + a}"`, W / 2 + 8, dz.defender + a + 0.8, COLORS.defender, 0.8, { max: 16 });
        text(`AD ${dz.attacker + a}"`, W / 2 + 8, D - dz.attacker - a - 0.8, COLORS.attacker, 0.8, { max: 16 });
      }
    }
    if (o.killBox) {
      const k = data.killBox;
      path([[0, k], [W, k]]); stroke("rgba(47,140,255,0.9)", 1.5, [3, 6]);
      path([[0, D - k], [W, D - k]]); stroke("rgba(255,59,48,0.9)", 1.5, [3, 6]);
      if (o.labels) {
        text(`Kill Box ${k}"`, 4, k + 0.8, COLORS.defender, 0.75, { max: 15, bold: false });
        text(`Kill Box ${k}"`, 4, D - k - 0.8, COLORS.attacker, 0.75, { max: 15, bold: false });
      }
    }
    if (o.centre) { path([[0, D / 2], [W, D / 2]]); stroke("rgba(255,255,255,0.45)", 1, [2, 8], false); }

    // Table outline
    path([[0, 0], [W, 0], [W, D], [0, D]], true); stroke("#ffffff", 3);
    // Edge ticks every 6" to help check calibration
    for (let t = 6; t < W; t += 6) { path([[t, 0], [t, 0.8]]); stroke("#fff", 1.5, null, false); path([[t, D], [t, D - 0.8]]); stroke("#fff", 1.5, null, false); }
    for (let t = 6; t < D; t += 6) { path([[0, t], [0.8, t]]); stroke("#fff", 1.5, null, false); path([[W, t], [W - 0.8, t]]); stroke("#fff", 1.5, null, false); }

    if (!scenario) { ctx.restore(); return; }

    const els = scenario.elements.map(el => Object.assign({}, el, G.elementCentre(el, W, D)));
    const colorOf = el => COLORS[el.owner] || COLORS.neutral;

    // Scenario-specific rings (e.g. Earthworks, blast radius)
    (scenario.rings || []).forEach(ring => {
      els.filter(e => e.kind === ring.of && (ring.base == null || e.base === ring.base)).forEach(e => {
        path(circlePts(e.x, e.y, e.r + ring.radius), true);
        ctx.fillStyle = "rgba(255,255,255,0.10)"; ctx.fill();
      });
    });

    // Control / choice ranges
    if (o.ranges || o.flagRadius) {
      els.forEach(e => {
        const c = colorOf(e);
        if (o.ranges && (e.kind === "objective" || e.kind === "cache")) {
          path(circlePts(e.x, e.y, e.r + 3), true); stroke(c, 1.5, [6, 5]);
        }
        if (o.flagRadius && e.kind === "flag") {
          path(circlePts(e.x, e.y, e.r + 5), true); stroke(c, 1.2, [2, 5]);
        }
      });
    }

    // Arrows (objective movement)
    (scenario.arrows || []).forEach(a => {
      const A = els[scenario.elements.indexOf(findEl(scenario, a.from))];
      const B = els[scenario.elements.indexOf(findEl(scenario, a.to))];
      if (!A || !B) return;
      const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
      const s = [A.x + ux * (A.r + 0.3), A.y + uy * (A.r + 0.3)], t = [B.x - ux * (B.r + 0.6), B.y - uy * (B.r + 0.6)];
      path([s, t]); stroke(colorOf(A), 2, [8, 5]);
      const q = P(t[0], t[1]), q0 = P(t[0] - ux, t[1] - uy);
      const ang = Math.atan2(q[1] - q0[1], q[0] - q0[0]), hl = 12 * LS;
      ctx.beginPath(); ctx.moveTo(q[0], q[1]);
      ctx.lineTo(q[0] - hl * Math.cos(ang - 0.45), q[1] - hl * Math.sin(ang - 0.45));
      ctx.lineTo(q[0] - hl * Math.cos(ang + 0.45), q[1] - hl * Math.sin(ang + 0.45));
      ctx.closePath(); ctx.fillStyle = colorOf(A); ctx.fill();
      if (o.labels && a.label) text(a.label, (s[0] + t[0]) / 2, (s[1] + t[1]) / 2 - 0.7, colorOf(A), 0.7, { max: 14, bold: false });
    });

    // Dimension lines, as printed on the packet diagram
    if (o.dims) {
      els.forEach(e => {
        const p = e.pos, c = "rgba(255,255,255,0.9)";
        if (p.top != null) { path([[e.x, 0], [e.x, e.y - e.r]]); stroke(c, 1, [4, 4], false); text(`${p.top}"`, e.x + 1.1, p.top / 2, "#fff", 0.8, { max: 16 }); }
        if (p.bottom != null) { path([[e.x, D], [e.x, e.y + e.r]]); stroke(c, 1, [4, 4], false); text(`${p.bottom}"`, e.x + 1.1, D - p.bottom / 2, "#fff", 0.8, { max: 16 }); }
        if (p.left != null) { path([[0, e.y], [e.x - e.r, e.y]]); stroke(c, 1, [4, 4], false); text(`${p.left}"`, p.left / 2, e.y - 0.8, "#fff", 0.8, { max: 16 }); }
        if (p.right != null) { path([[W, e.y], [e.x + e.r, e.y]]); stroke(c, 1, [4, 4], false); text(`${p.right}"`, W - p.right / 2, e.y - 0.8, "#fff", 0.8, { max: 16 }); }
      });
    }

    // Elements at true size
    els.forEach(e => {
      const c = colorOf(e);
      if (e.kind === "objective") {
        path(circlePts(e.x, e.y, e.r, 48), true);
      } else if (e.kind === "cache") {
        const h = e.r; path([[e.x - h, e.y - h], [e.x + h, e.y - h], [e.x + h, e.y + h], [e.x - h, e.y + h]], true);
      } else { // flag: triangle inscribed in its 30mm base
        // point the triangle toward the far side of the table from the viewer
        const up = { attacker: -Math.PI / 2, defender: Math.PI / 2, left: 0, right: Math.PI }[o.side || "attacker"];
        const pts = [0, 1, 2].map(i => { const t = up + i * 2 * Math.PI / 3; return [e.x + e.r * 1.25 * Math.cos(t), e.y + e.r * 1.25 * Math.sin(t)]; });
        path(pts, true);
      }
      ctx.fillStyle = c; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
      stroke("#ffffff", 2);
      if (o.labels) {
        const tag = e.kind === "objective" ? `${e.base}` : e.kind === "flag" ? "F" : "C";
        const k = ppi(e.x, e.y);
        if (k * e.r * 2 >= 22) text(tag, e.x, e.y, "#fff", e.r * 1.1, { min: 9, max: 26 });
        else text(tag, e.x, e.y - e.r - 0.9, c, 0.9, { min: 10, max: 18 });
      }
    });

    ctx.restore();
  }

  const api = { drawOverlay, COLORS, DEFAULTS };
  if (typeof module !== "undefined") module.exports = api;
  root.Render = api;
})(typeof window !== "undefined" ? window : globalThis);
