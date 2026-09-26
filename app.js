/* Steamroller 2026 table overlay — app controller. Plain JS, no dependencies. */
(function () {
  "use strict";
  const DATA = window.STEAMROLLER, G = window.Geom, R = window.Render;
  const $ = id => document.getElementById(id);
  const stage = $("stage"), video = $("video"), still = $("still"), canvas = $("overlay"), ctx = canvas.getContext("2d");
  const loupe = $("loupe"), lctx = loupe.getContext("2d"), banner = $("banner");
  const params = new URLSearchParams(location.search);
  const STORE = "sr2026-overlay-v1";

  const CORNER_NAMES = ["NEAR-LEFT", "NEAR-RIGHT", "FAR-RIGHT", "FAR-LEFT"];
  const CORNER_HINT = ["the corner closest to you on your left", "the corner closest to you on your right",
                       "the far corner on your right", "the far corner on your left"];

  const state = Object.assign({
    scenarioId: DATA.scenarios[0].id,
    side: "attacker",
    mode: "camera",          // "camera" | "map"
    corners: null,           // 4 points, normalised 0..1 of the stage, in tap order
    layers: Object.assign({}, R.DEFAULTS),
    tableW: DATA.table.width, tableD: DATA.table.depth
  }, load());
  let calibrating = false, adjusting = false, tapped = [], dragIdx = -1, frozen = false, stream = null, source = video;

  function load() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(STORE, JSON.stringify({ scenarioId: state.scenarioId, side: state.side, mode: state.mode, corners: state.corners, layers: state.layers, tableW: state.tableW, tableD: state.tableD })); } catch (e) {} }
  const scenario = () => DATA.scenarios.find(s => s.id === state.scenarioId) || DATA.scenarios[0];

  // ---------- UI setup ----------
  DATA.scenarios.forEach(s => { const o = document.createElement("option"); o.value = s.id; o.textContent = `${s.number}. ${s.name}`; $("scenario").appendChild(o); });
  ["side", "sideStart"].forEach(id => Object.entries(G.SIDES).forEach(([k, v]) => { const o = document.createElement("option"); o.value = k; o.textContent = v; $(id).appendChild(o); }));

  function syncUI() {
    $("scenario").value = state.scenarioId; $("side").value = state.side; $("sideStart").value = state.side;
    document.body.classList.toggle("map", state.mode === "map");
    $("modeBtn").textContent = state.mode === "map" ? "Camera" : "Map";
    $("adjustBtn").classList.toggle("active", adjusting);
    document.body.classList.toggle("calib", (calibrating || adjusting) && state.mode === "camera");
    $("freezeBtn").classList.toggle("active", frozen);
    ["calBtn", "adjustBtn", "freezeBtn"].forEach(id => $(id).disabled = state.mode === "map");
    document.querySelectorAll("[data-layer]").forEach(cb => cb.checked = !!state.layers[cb.dataset.layer]);
    $("tableW").value = state.tableW; $("tableD").value = state.tableD;
    const s = scenario();
    $("infoTitle").textContent = `Scenario ${s.number}: ${s.name}`;
    $("infoSummary").textContent = s.summary;
    $("infoScoring").innerHTML = s.scoring.map(x => `<li>${x.replace(/</g, "&lt;")}</li>`).join("");
    $("infoNotes").innerHTML = (s.notes || []).concat(s.elements.filter(e => e.note).map(e => e.note)).map(n => `<p>${n}</p>`).join("");
    $("infoSource").textContent = `Source: ${DATA.pack} (${DATA.publisher}), p. ${s.source.page}. Deployment: Attacker ${DATA.deployment.attacker}", Defender ${DATA.deployment.defender}". Positions are measured from the table edge to the edge of the base.`;
  }

  $("scenario").onchange = e => { state.scenarioId = e.target.value; save(); syncUI(); draw(); };
  $("side").onchange = $("sideStart").onchange = e => { state.side = e.target.value; save(); syncUI(); if (calibrating) promptCorner(); draw(); };
  $("modeBtn").onclick = () => { state.mode = state.mode === "map" ? "camera" : "map"; if (state.mode === "camera" && !stream && source === video) startCamera(); save(); syncUI(); draw(); };
  $("calBtn").onclick = () => startCalibration();
  $("adjustBtn").onclick = () => { if (!state.corners) return startCalibration(); adjusting ? finishAdjust() : startAdjust(); };
  function startAdjust(prefix) {
    adjusting = true; calibrating = false;
    showBanner((prefix || "") + "Drag the yellow handles onto the table corners (a magnifier appears while dragging).<br>" +
      '<button id="bDone" class="primary">Done</button><button id="bFlip">Flip side</button><button id="bRedo">Re-tap corners</button>');
    $("bDone").onclick = finishAdjust;
    $("bFlip").onclick = () => $("flipBtn").onclick();
    $("bRedo").onclick = startCalibration;
    syncUI(); draw();
  }
  function finishAdjust() { adjusting = false; showBanner(null); save(); syncUI(); draw(); }
  $("flipBtn").onclick = () => { state.side = { attacker: "defender", defender: "attacker", left: "right", right: "left" }[state.side]; save(); syncUI(); draw(); };
  $("freezeBtn").onclick = () => { frozen = !frozen; if (source === video) frozen ? video.pause() : video.play().catch(() => {}); syncUI(); };
  $("layersBtn").onclick = () => togglePanel("layersPanel");
  $("infoBtn").onclick = () => togglePanel("infoPanel");
  document.querySelectorAll(".panel .close").forEach(b => b.onclick = () => b.closest(".panel").hidden = true);
  document.querySelectorAll("[data-layer]").forEach(cb => cb.onchange = () => { state.layers[cb.dataset.layer] = cb.checked; save(); draw(); });
  ["tableW", "tableD"].forEach(id => $(id).onchange = () => { state.tableW = +$("tableW").value || 48; state.tableD = +$("tableD").value || 48; save(); draw(); });
  $("startCamBtn").onclick = () => { $("startPanel").hidden = true; state.mode = "camera"; startCamera(); syncUI(); };
  $("startMapBtn").onclick = () => { $("startPanel").hidden = true; state.mode = "map"; save(); syncUI(); draw(); };
  function togglePanel(id) { ["layersPanel", "infoPanel"].forEach(p => { if (p !== id) $(p).hidden = true; }); $(id).hidden = !$(id).hidden; }

  function showBanner(html) { if (!html) { banner.hidden = true; return; } banner.innerHTML = html; banner.hidden = false; }

  // ---------- Camera ----------
  async function startCamera() {
    const msg = $("camMsg");
    if (!window.isSecureContext) { msg.textContent = "Camera needs HTTPS (or http://localhost). Showing the map instead."; fallbackToMap(); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg.textContent = "This browser has no camera access. Showing the map instead."; fallbackToMap(); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
      video.srcObject = stream; await video.play().catch(() => {});
      source = video;
      try { if (navigator.wakeLock) await navigator.wakeLock.request("screen"); } catch (e) {}
      if (!state.corners) startCalibration();
      draw();
    } catch (err) {
      msg.textContent = "Couldn't open the camera (" + (err && err.name || err) + "). Showing the map instead.";
      fallbackToMap();
    }
  }
  function fallbackToMap() { $("startPanel").hidden = false; state.mode = "map"; syncUI(); draw(); }

  // ---------- Calibration ----------
  function startCalibration() {
    if (state.mode === "map") { state.mode = "camera"; syncUI(); }
    calibrating = true; adjusting = false; tapped = [];
    ["layersPanel", "infoPanel"].forEach(p => $(p).hidden = true);
    promptCorner(); syncUI(); draw();
  }
  function promptCorner() {
    const i = tapped.length;
    showBanner(`<span class="step">Corner ${i + 1} of 4:</span> tap the <b>${CORNER_NAMES[i]}</b> table corner<br><span class="small">(${CORNER_HINT[i]}, standing at the ${G.SIDES[state.side]})</span><br>` +
      `<button id="bSide">Change edge</button>${i ? '<button id="bUndo">Undo</button>' : ""}<button id="bCancel">Cancel</button>`);
    $("bSide").onclick = () => togglePanel("layersPanel");
    if ($("bUndo")) $("bUndo").onclick = () => { tapped.pop(); promptCorner(); draw(); };
    $("bCancel").onclick = () => { calibrating = false; showBanner(null); syncUI(); draw(); };
  }

  function stageSize() { return [stage.clientWidth, stage.clientHeight]; }
  function cornersPx() { const [w, h] = stageSize(); return state.corners ? state.corners.map(p => [p[0] * w, p[1] * h]) : null; }

  function evtPoint(e) { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

  stage.addEventListener("pointerdown", e => {
    if (state.mode !== "camera") return;
    const p = evtPoint(e);
    if (calibrating) {
      tapped.push(p);
      drawLoupe(p);
      if (tapped.length === 4) {
        const [w, h] = stageSize();
        state.corners = tapped.map(q => [q[0] / w, q[1] / h]);
        save();
        const ok = G.isConvexQuad(tapped);
        startAdjust(ok ? "<span class='step'>Calibrated.</span> " : "<span class='step'>Those corners cross over — check the order (or re-tap).</span> ");
      } else promptCorner();
      setTimeout(() => { loupe.hidden = true; }, 350);
      draw(); return;
    }
    if (adjusting && state.corners) {
      const cs = cornersPx(); let best = -1, bd = 48;
      cs.forEach((c, i) => { const d = Math.hypot(c[0] - p[0], c[1] - p[1]); if (d < bd) { bd = d; best = i; } });
      if (best >= 0) { dragIdx = best; stage.setPointerCapture(e.pointerId); drawLoupe(cs[best]); }
    }
  });
  stage.addEventListener("pointermove", e => {
    if (dragIdx < 0) return;
    const p = evtPoint(e), [w, h] = stageSize();
    state.corners[dragIdx] = [Math.min(1, Math.max(0, p[0] / w)), Math.min(1, Math.max(0, p[1] / h))];
    drawLoupe(p); draw();
  });
  const endDrag = () => { if (dragIdx >= 0) { dragIdx = -1; loupe.hidden = true; save(); draw(); } };
  stage.addEventListener("pointerup", endDrag); stage.addEventListener("pointercancel", endDrag);

  // Magnifier showing the camera image under the finger (source pixels, object-fit: cover).
  function drawLoupe(p) {
    const el = source, vw = el.videoWidth || el.naturalWidth, vh = el.videoHeight || el.naturalHeight;
    if (!vw || !vh) return;
    const [cw, ch] = stageSize(), s = Math.max(cw / vw, ch / vh), ox = (cw - vw * s) / 2, oy = (ch - vh * s) / 2;
    const zoom = 3, half = loupe.width / 2 / zoom; // in CSS px
    const sx = (p[0] - half - ox) / s, sy = (p[1] - half - oy) / s, sw = 2 * half / s;
    loupe.style.left = (p[0] < cw / 2 ? cw - loupe.width - 12 : 12) + "px";
    lctx.fillStyle = "#000"; lctx.fillRect(0, 0, loupe.width, loupe.height);
    try { lctx.drawImage(el, sx, sy, sw, sw, 0, 0, loupe.width, loupe.height); } catch (e) {}
    lctx.strokeStyle = "#ffd60a"; lctx.lineWidth = 1.5; lctx.beginPath();
    lctx.moveTo(loupe.width / 2, 0); lctx.lineTo(loupe.width / 2, loupe.height); lctx.moveTo(0, loupe.height / 2); lctx.lineTo(loupe.width, loupe.height / 2); lctx.stroke();
    loupe.hidden = false;
  }

  // ---------- Drawing ----------
  function resize() {
    const dpr = window.devicePixelRatio || 1, [w, h] = stageSize();
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
  }
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 300));

  function mapHomography() {
    const [w, h] = stageSize();
    const top = 70, bottom = 70, pad = 14;
    const side = state.side, rot = side === "left" || side === "right";
    const tw = rot ? state.tableD : state.tableW, td = rot ? state.tableW : state.tableD; // screen-space aspect
    const k = Math.min((w - 2 * pad) / tw, (h - top - bottom) / td);
    const x0 = (w - tw * k) / 2, y0 = top + (h - top - bottom - td * k) / 2;
    const screen = [[x0, y0 + td * k], [x0 + tw * k, y0 + td * k], [x0 + tw * k, y0], [x0, y0]];
    return G.homography(G.cornerTableCoords(side, state.tableW, state.tableD), screen);
  }

  function draw() {
    const [w, h] = stageSize();
    ctx.clearRect(0, 0, w, h);
    const opts = Object.assign({}, state.layers, { W: state.tableW, D: state.tableD, side: state.side });
    if (state.mode === "map") {
      const H = mapHomography();
      R.drawOverlay(ctx, H, DATA, scenario(), Object.assign(opts, { background: true }));
      edgeCaption(H); return;
    }
    if (calibrating) {
      tapped.forEach((p, i) => handle(p, CORNER_NAMES[i], true));
      if (tapped.length > 1) { ctx.beginPath(); tapped.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.strokeStyle = "#ffd60a"; ctx.lineWidth = 2; ctx.stroke(); }
      return;
    }
    const cs = cornersPx();
    if (!cs) return;
    const H = G.homography(G.cornerTableCoords(state.side, state.tableW, state.tableD), cs);
    if (H) R.drawOverlay(ctx, H, DATA, scenario(), Object.assign(opts, { lineScale: 1 }));
    if (adjusting) cs.forEach((p, i) => handle(p, CORNER_NAMES[i], dragIdx === i));
  }
  function handle(p, label, hot) {
    ctx.beginPath(); ctx.arc(p[0], p[1], hot ? 16 : 13, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,214,10,0.25)"; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = "#ffd60a"; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p[0] - 6, p[1]); ctx.lineTo(p[0] + 6, p[1]); ctx.moveTo(p[0], p[1] - 6); ctx.lineTo(p[0], p[1] + 6); ctx.stroke();
    ctx.font = "bold 12px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.lineWidth = 3; ctx.strokeStyle = "#000"; ctx.fillStyle = "#ffd60a";
    const [w] = stageSize(), lx = Math.min(w - 42, Math.max(42, p[0])), ly = p[1] < 40 ? p[1] + 32 : p[1] - 22;
    ctx.strokeText(label, lx, ly); ctx.fillText(label, lx, ly);
  }
  function edgeCaption(H) {
    const [w, h] = stageSize();
    ctx.font = "13px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#bbb";
    const bottomY = G.apply(H, ...G.cornerTableCoords(state.side, state.tableW, state.tableD)[0])[1];
    ctx.fillText(`▲ you are at the ${G.SIDES[state.side]} ▲`, w / 2, Math.min(h - 58, bottomY + 18));
  }

  // ---------- Test / demo hooks (headless screenshots) ----------
  // ?img=<url>&cn=x1,y1,..,x4,y4 (normalised corners, tap order)&scenario=<id>&side=<side>&mode=map&layers=dims,advance&ui=0
  function applyParams() {
    if (params.get("scenario")) state.scenarioId = params.get("scenario");
    if (params.get("side")) state.side = params.get("side");
    if (params.get("mode")) state.mode = params.get("mode");
    if (params.get("layers")) params.get("layers").split(",").forEach(l => { if (l.startsWith("-")) state.layers[l.slice(1)] = false; else state.layers[l] = true; });
    if (params.get("cn")) { const v = params.get("cn").split(",").map(Number); state.corners = [0, 1, 2, 3].map(i => [v[2 * i], v[2 * i + 1]]); }
    if (params.get("ui") === "0") document.body.classList.add("noui");
    if (params.get("adjust") === "1") setTimeout(() => startAdjust(), 0);
    if (params.get("cal") === "1") setTimeout(startCalibration, 0);
    if (params.get("img")) {
      source = still; still.hidden = false; video.hidden = true;
      still.onload = () => { resize(); window.__ready = true; };
      still.src = params.get("img");
      $("startPanel").hidden = true; return true;
    }
    if (params.get("mode") === "map") { $("startPanel").hidden = true; }
    return false;
  }

  const isTest = applyParams();
  syncUI(); resize();
  if (!isTest) {
    if (state.mode === "map" && !params.get("mode")) { /* remember last choice, still offer camera */ }
    window.__ready = true;
  }
  window.__state = state;
})();
