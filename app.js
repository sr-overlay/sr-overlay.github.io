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
    corners: null,           // 4 points, normalised 0..1 of the camera picture (may lie slightly outside it), in tap order
    cornerSpace: "video",    // older saves stored screen-normalised corners (object-fit: cover); those are discarded
    viewScale: 1,            // 1 | 0.85 | 0.7 — shrink the displayed picture to leave a margin for off-picture corners
    layers: Object.assign({}, R.DEFAULTS),
    tableW: DATA.table.width, tableD: DATA.table.depth
  }, loadCompat());
  function loadCompat() { const o = load(); if (o.corners && o.cornerSpace !== "video") delete o.corners; o.cornerSpace = "video"; return o; }
  let calibrating = false, adjusting = false, tapped = [], dragIdx = -1, frozen = false, stream = null, source = video;

  function load() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(STORE, JSON.stringify({ scenarioId: state.scenarioId, side: state.side, mode: state.mode, corners: state.corners, cornerSpace: "video", viewScale: state.viewScale, layers: state.layers, tableW: state.tableW, tableD: state.tableD })); } catch (e) {} }
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
    if (typeof placeBanner === "function") placeBanner();
    $("freezeBtn").classList.toggle("active", frozen);
    document.querySelectorAll("#viewSeg button").forEach(b => b.classList.toggle("active", +b.dataset.view === state.viewScale));
    ["calBtn", "adjustBtn", "freezeBtn", "lensBtn"].forEach(id => $(id).disabled = state.mode === "map");
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
    showBanner(`<div class="bmsg">${prefix || ""}Drag the yellow handles onto the table corners (a magnifier appears while dragging).</div>` +
      '<div class="brow"><button id="bDone" class="primary">Done</button><button id="bFlip">Flip side</button><button id="bRedo">Re-tap</button></div>' + camToolsHtml());
    $("bDone").onclick = finishAdjust; bindCamTools();
    $("bFlip").onclick = () => $("flipBtn").onclick();
    $("bRedo").onclick = startCalibration;
    syncUI(); draw();
  }
  function finishAdjust() { adjusting = false; showBanner(null); save(); syncUI(); draw(); }
  $("flipBtn").onclick = () => { state.side = { attacker: "defender", defender: "attacker", left: "right", right: "left" }[state.side]; save(); syncUI(); draw(); };
  $("freezeBtn").onclick = () => { frozen = !frozen; if (source === video) frozen ? video.pause() : video.play().catch(() => {}); syncUI(); };
  $("layersBtn").onclick = () => togglePanel("layersPanel");
  $("lensBtn").onclick = () => { togglePanel("lensPanel"); if (!$("lensPanel").hidden) refreshDevices(); };
  $("lensPanel").querySelector(".close").addEventListener("click", () => {
    if (lensDirty && state.corners && state.mode === "camera" && !calibrating) { lensDirty = false; startAdjust("<span class='step'>Lens/zoom changed</span> — check the corners. "); }
  });
  document.querySelectorAll("#viewSeg button").forEach(b => b.onclick = () => setViewScale(+b.dataset.view));
  $("infoBtn").onclick = () => togglePanel("infoPanel");
  document.querySelectorAll(".panel .close").forEach(b => b.onclick = () => b.closest(".panel").hidden = true);
  document.querySelectorAll("[data-layer]").forEach(cb => cb.onchange = () => { state.layers[cb.dataset.layer] = cb.checked; save(); draw(); });
  ["tableW", "tableD"].forEach(id => $(id).onchange = () => { state.tableW = +$("tableW").value || 48; state.tableD = +$("tableD").value || 48; save(); draw(); });
  $("startCamBtn").onclick = () => { $("startPanel").hidden = true; state.mode = "camera"; startCamera(); syncUI(); };
  $("startMapBtn").onclick = () => { $("startPanel").hidden = true; state.mode = "map"; save(); syncUI(); draw(); };
  function togglePanel(id) { ["layersPanel", "infoPanel", "lensPanel"].forEach(p => { if (p !== id) $(p).hidden = true; }); $(id).hidden = !$(id).hidden; }

  function showBanner(html) { if (!html) { banner.hidden = true; return; } banner.innerHTML = html; banner.hidden = false; placeBanner(); }
  // While calibrating/adjusting, the banner is placed where it covers no corner: in an empty letterbox band if there
  // is one, else top / middle / bottom — whichever overlaps no placed handle and not the area where the next corner
  // is expected (near corners: lower part of the picture; far corners: upper part).
  const safeProbe = document.createElement("div");
  safeProbe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)";
  document.body.appendChild(safeProbe);
  function safeInsets() { const cs = getComputedStyle(safeProbe); return [parseFloat(cs.paddingTop) || 0, parseFloat(cs.paddingBottom) || 0]; }
  function placeBanner() {
    banner.style.top = banner.style.transform = banner.style.translate = "";
    if (banner.hidden || !document.body.classList.contains("calib") || state.mode !== "camera") return;
    const r = viewRect(), [, H] = stageSize(), bh = banner.offsetHeight, below = H - r.y - r.h;
    const [sat, sab] = safeInsets(), top = r.y - sat, bot = below - sab, pad = 8;
    const pts = calibrating ? tapped.map(toPx) : (cornersPx() || []);
    const zone = calibrating && tapped.length < 4 ? (tapped.length < 2 ? [r.y + 0.55 * r.h, r.y + r.h] : [r.y, r.y + 0.5 * r.h]) : null;
    const pref = top >= bh + 2 * pad ? sat + (top - bh) / 2 : bot >= bh + 2 * pad ? r.y + r.h + (bot - bh) / 2 : (H - bh) / 2;
    let best = pref, bs = Infinity;
    for (let y = sat + 4; y <= H - sab - bh - 4 + 0.1; y += 4) {
      const y0 = y - 30, y1 = y + bh + 30;                    // handle radius + label clearance
      let sc = pts.filter(p => p[1] > y0 && p[1] < y1).length * 10 + Math.abs(y - pref) / H * 0.5;
      if (zone) sc += Math.max(0, Math.min(y1, zone[1]) - Math.max(y0, zone[0])) / Math.max(1, zone[1] - zone[0]) * 5;
      if (sc < bs) { bs = sc; best = y; }
    }
    banner.style.top = Math.max(sat + 4, Math.min(best, H - sab - bh - 4)) + "px"; banner.style.transform = "none"; banner.style.translate = "-50% 0";
  }

  // ---------- Camera ----------
  // Ask for the full sensor (4:3, high res, no browser crop) so the field of view is as wide as possible.
  const CAM_STORE = "sr2026-camera-v1";   // { deviceId, label, zoom: { [deviceKey]: value } }
  const cam = (() => { try { return JSON.parse(localStorage.getItem(CAM_STORE)) || {}; } catch (e) { return {}; } })();
  function saveCam() { try { localStorage.setItem(CAM_STORE, JSON.stringify(cam)); } catch (e) {} }
  const ULTRA = /ultra\s*-?\s*wide|ultrawide|0\.5x|wide[- ]?angle/i, FRONT = /front|user|facing front|selfie|facetime/i, BACK = /back|rear|environment|facing back|world/i;
  let track = null, lensDirty = false, camList = [];

  function videoConstraints(deviceId, ptz) {
    const v = { width: { ideal: 4032 }, height: { ideal: 3024 }, aspectRatio: { ideal: 4 / 3 }, frameRate: { ideal: 30 }, resizeMode: { ideal: "none" } };
    if (deviceId) v.deviceId = { exact: deviceId }; else v.facingMode = { ideal: "environment" };
    if (ptz) v.zoom = true; // Chrome only exposes the zoom capability if it is requested ("true" = don't change it)
    return v;
  }
  async function openStream(deviceId) {
    stopStream();
    const gum = c => navigator.mediaDevices.getUserMedia({ audio: false, video: c });
    let ptz = false;
    try { ptz = !!(navigator.mediaDevices.getSupportedConstraints && navigator.mediaDevices.getSupportedConstraints().zoom); } catch (e) {}
    const tries = [videoConstraints(deviceId, ptz), videoConstraints(deviceId, false)];
    if (deviceId) tries.push(videoConstraints(null, false));
    // Progressively simpler (all "ideal", never exact/min except a chosen deviceId), ending with plain video: true.
    tries.push({ width: { ideal: 1920 }, height: { ideal: 1440 }, facingMode: { ideal: "environment" } }, { facingMode: "environment" }, true);
    let last;
    for (const c of tries) {
      try { return await gum(c); }
      catch (e) { last = e; console.warn("getUserMedia failed", e && e.name, c); if (e && (e.name === "NotAllowedError" || e.name === "SecurityError")) break; }
    }
    throw last;
  }
  function stopStream() { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; track = null; }
  function deviceKey() { if (!track) return ""; const st = track.getSettings ? track.getSettings() : {}; return st.deviceId || track.label || ""; }

  async function attachStream() {
    track = stream.getVideoTracks()[0] || null;
    video.srcObject = stream; await video.play().catch(() => {});
    source = video; frozen = false;
    // Lens/zoom extras must never break the camera.
    try { setupZoom(); } catch (e) { console.warn("zoom setup", e); $("zoomRow").hidden = true; }
    try { updateCamInfo(); } catch (e) {}
    layoutMedia(); syncUI(); draw();
  }

  async function startCamera() {
    const msg = $("camMsg");
    if (!window.isSecureContext) { msg.textContent = "Camera needs HTTPS (or http://localhost). Showing the map instead."; fallbackToMap(); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg.textContent = "This browser has no camera access. Showing the map instead."; fallbackToMap(); return; }
    try {
      stream = await openStream(cam.deviceId || null);
      await attachStream();
      try { if (navigator.wakeLock) await navigator.wakeLock.request("screen"); } catch (e) {}
      try { await autoPickLens(); } catch (e) { console.warn("lens auto-pick", e); }
      if (!state.corners) startCalibration();
      draw();
      watchForFrames();
    } catch (err) {
      camError(err);
    }
  }
  async function autoPickLens() {
      await refreshDevices();
      // Stored deviceId stale (ids can change)? Find the same lens by label. First run: prefer an ultra-wide back lens.
      const cur = currentDevice();
      let want = null;
      if (cam.label && (!cur || cur.label !== cam.label)) want = camList.find(d => d.label === cam.label);
      else if (!cam.deviceId && !cam.label) want = camList.find(d => ULTRA.test(d.label) && !FRONT.test(d.label));
      if (want && (!cur || want.deviceId !== cur.deviceId)) await switchCamera(want.deviceId, true);
  }
  // Visible error instead of a blank screen.
  function camError(err) {
    const name = err && (err.name || err.message) || String(err);
    const hint = name === "NotAllowedError" ? " Allow camera access for this site in the browser settings, then reload." :
                 name === "NotReadableError" ? " Another app may be using the camera." : "";
    $("camMsg").textContent = "Couldn't open the camera (" + name + ")." + hint + " Showing the map instead.";
    fallbackToMap();
  }
  // Stream opened but no picture (seen on some phones with unusual formats): retry with the simplest request.
  function watchForFrames() {
    setTimeout(async () => {
      if (!stream || video.videoWidth || state.mode !== "camera") return;
      try { stopStream(); stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "environment" } }); await attachStream(); }
      catch (e) { camError(e); return; }
      setTimeout(() => { if (stream && !video.videoWidth) { showBanner("<span class='step'>No camera picture.</span> Pick another camera under Lens, or reload the page.<br><button id='bX'>OK</button>"); $("bX").onclick = () => showBanner(null); } }, 4000);
    }, 5000);
  }

  function currentDevice() {
    if (!track) return null;
    const st = track.getSettings ? track.getSettings() : {};
    return camList.find(d => st.deviceId && d.deviceId === st.deviceId) || camList.find(d => d.label && d.label === track.label) || null;
  }
  function prettyLabel(d, i) {
    let l = d.label || `Camera ${i + 1}`;
    const m = /^camera2 (\d+), facing (back|front)/i.exec(l);          // Android: "camera2 2, facing back"
    if (m) l = `${m[2][0].toUpperCase() + m[2].slice(1)} camera ${m[1]}`;
    return ULTRA.test(l) ? l + " ★ wide" : l;
  }
  async function refreshDevices() {
    const sel = $("camSelect");
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) { sel.disabled = true; return; }
    let devs = [];
    try { devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput"); } catch (e) {}
    const back = devs.filter(d => BACK.test(d.label) && !FRONT.test(d.label));
    const notFront = devs.filter(d => !FRONT.test(d.label));
    camList = back.length ? back : (notFront.length ? notFront : devs);
    sel.innerHTML = "";
    camList.forEach((d, i) => { const o = document.createElement("option"); o.value = d.deviceId; o.textContent = prettyLabel(d, i); sel.appendChild(o); });
    const cur = currentDevice();
    if (cur) sel.value = cur.deviceId;
    sel.disabled = camList.length < 2 || !stream;
    updateCamInfo();
  }
  async function switchCamera(deviceId, auto) {
    const d = camList.find(x => x.deviceId === deviceId);
    try {
      stream = await openStream(deviceId);
      await attachStream();
      if (!auto || d) { cam.deviceId = deviceId; cam.label = d ? d.label : ""; saveCam(); }
      lensDirty = true;
      if (calibrating) { tapped = []; draw(); }
      if (calibrating || adjusting) refreshBanner();
    } catch (e) {
      $("camInfo").textContent = "Couldn't switch camera (" + (e && e.name || e) + ").";
      if (!stream) { try { stream = await openStream(null); await attachStream(); } catch (e2) { camError(e2); } } // don't leave a dead camera
    }
    try { await refreshDevices(); } catch (e) {}
  }
  $("camSelect").onchange = e => switchCamera(e.target.value, false).catch(err => { $("camInfo").textContent = "Couldn't switch camera (" + (err && err.name || err) + ")."; });

  function setupZoom() {
    const row = $("zoomRow"), sl = $("zoom");
    const caps = track && track.getCapabilities ? track.getCapabilities() : {};
    const z = caps && caps.zoom;
    if (!z || !(z.max > z.min)) { row.hidden = true; return; }
    sl.min = z.min; sl.max = z.max; sl.step = z.step || 0.1;
    const saved = cam.zoom && cam.zoom[deviceKey()];
    const v = saved != null && saved >= z.min && saved <= z.max ? saved : z.min;   // default: widest (some Androids go to 0.5–0.6×)
    sl.value = v; row.hidden = false; applyZoom(v, false);
  }
  function applyZoom(v, remember) {
    v = +v; $("zoomVal").textContent = v.toFixed(2).replace(/\.?0+$/, "") + "×";
    if (track) track.applyConstraints({ advanced: [{ zoom: v }] }).catch(() => {});
    if (remember) { cam.zoom = cam.zoom || {}; cam.zoom[deviceKey()] = v; saveCam(); lensDirty = true; }
  }
  $("zoom").oninput = e => { applyZoom(e.target.value, true); const bz = $("bZoom"); if (bz) { bz.value = e.target.value; $("bZoomVal").textContent = $("zoomVal").textContent; } };

  function updateCamInfo() {
    const el = $("camInfo"); if (!el) return;
    if (!stream) { el.textContent = "Camera not started."; return; }
    const st = track && track.getSettings ? track.getSettings() : {};
    const w = video.videoWidth || st.width, h = video.videoHeight || st.height;
    el.textContent = (w && h ? `Picture ${w}×${h}` : "") + ($("zoomRow").hidden ? " · this camera/browser doesn't offer zoom control" : "");
  }
  video.addEventListener("loadedmetadata", () => { layoutMedia(); updateCamInfo(); draw(); });
  video.addEventListener("resize", () => { layoutMedia(); updateCamInfo(); draw(); }); // rotation changes the stream's dimensions

  // ---------- View size (digital "zoom out" of the displayed picture) ----------
  const VIEWS = [1, 0.85, 0.7];
  function setViewScale(v) { state.viewScale = VIEWS.includes(v) ? v : 1; save(); layoutMedia(); syncUI(); draw(); const b = $("bView"); if (b) b.textContent = viewBtnLabel(); }
  function viewBtnLabel() { return "View " + Math.round(state.viewScale * 100) + "%"; }
  function viewBtnHtml() { return `<button id="bView" title="Shrink the picture to drag corners past its edge">${viewBtnLabel()}</button>`; }
  // Camera tools row shown in the calibrate/adjust banners (the bottom bar is hidden there): Lens panel, view size, inline zoom.
  function camToolsHtml() {
    const zr = $("zoomRow"), zs = $("zoom"), hasZoom = !zr.hidden && !!track;
    return `<div class="brow tools"><button id="bLens" title="Camera lens, zoom and view size">📷 Lens</button>${viewBtnHtml()}</div>` +
      (hasZoom ? `<label class="bzoom">Zoom <input id="bZoom" type="range" min="${zs.min}" max="${zs.max}" step="${zs.step}" value="${zs.value}"><span id="bZoomVal">${$("zoomVal").textContent}</span></label>` : "");
  }
  function bindCamTools() {
    bindViewBtn();
    $("bLens").onclick = () => { togglePanel("lensPanel"); if (!$("lensPanel").hidden) refreshDevices(); };
    const bz = $("bZoom");
    if (bz) bz.oninput = () => { $("zoom").value = bz.value; applyZoom(bz.value, true); $("bZoomVal").textContent = $("zoomVal").textContent; };
  }
  function refreshBanner() { if (calibrating) promptCorner(); else if (adjusting) startAdjust(); }
  function bindViewBtn() { const b = $("bView"); if (b) b.onclick = () => setViewScale(VIEWS[(VIEWS.indexOf(state.viewScale) + 1) % VIEWS.length]); }

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
    showBanner(`<div class="bmsg"><span class="step">Corner ${i + 1} of 4:</span> tap the <b>${CORNER_NAMES[i]}</b> table corner<br><span class="small">(${CORNER_HINT[i]}, standing at the ${G.SIDES[state.side]})</span>` +
      (i ? "" : `<br><span class="small tip">Table not all in view? Tap 📷 Lens for the wide lens / zoom.</span>`) + `</div>` +
      `<div class="brow"><button id="bSide">Change edge</button>${i ? '<button id="bUndo">Undo</button>' : ""}<button id="bCancel">Cancel</button></div>` + camToolsHtml());
    bindCamTools();
    $("bSide").onclick = () => togglePanel("layersPanel");
    if ($("bUndo")) $("bUndo").onclick = () => { tapped.pop(); promptCorner(); draw(); };
    $("bCancel").onclick = () => { calibrating = false; showBanner(null); syncUI(); draw(); };
  }

  function stageSize() { return [stage.clientWidth, stage.clientHeight]; }
  // The camera picture is shown letterboxed (contain) and scaled by state.viewScale, centred on the stage.
  // Corners are stored normalised to that picture rect, so they map to fixed video pixels whatever the view size.
  function srcDims() { return [source.videoWidth || source.naturalWidth || 0, source.videoHeight || source.naturalHeight || 0]; }
  function viewRect() {
    const [W, H] = stageSize(), [vw, vh] = srcDims(), k = state.viewScale || 1;
    let w = W * k, h = H * k;
    if (vw && vh) { const s = Math.min(W / vw, H / vh) * k; w = vw * s; h = vh * s; }
    return { x: (W - w) / 2, y: (H - h) / 2, w, h };
  }
  function layoutMedia() {
    const r = viewRect();
    [video, still].forEach(el => { el.style.left = r.x + "px"; el.style.top = r.y + "px"; el.style.width = r.w + "px"; el.style.height = r.h + "px"; });
    placeBanner();
  }
  function toPx(q) { const r = viewRect(); return [r.x + q[0] * r.w, r.y + q[1] * r.h]; }
  function toNorm(p) { const r = viewRect(); return [(p[0] - r.x) / r.w, (p[1] - r.y) / r.h]; }
  function cornersPx() { return state.corners ? state.corners.map(toPx) : null; }

  function evtPoint(e) { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

  stage.addEventListener("pointerdown", e => {
    if (state.mode !== "camera") return;
    const p = evtPoint(e);
    if (calibrating) {
      tapped.push(toNorm(p));
      drawLoupe(p);
      if (tapped.length === 4) {
        state.corners = tapped.slice();
        save();
        const ok = G.isConvexQuad(tapped.map(toPx));
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
    // Corners may go anywhere on screen, including the margin outside the camera picture.
    const [w, h] = stageSize(), p = evtPoint(e).map((v, i) => Math.min(i ? h : w, Math.max(0, v)));
    state.corners[dragIdx] = toNorm(p);
    drawLoupe(p); draw();
  });
  const endDrag = () => { if (dragIdx >= 0) { dragIdx = -1; loupe.hidden = true; save(); draw(); placeBanner(); } };
  stage.addEventListener("pointerup", endDrag); stage.addEventListener("pointercancel", endDrag);

  // Magnifier showing the camera image under the finger (source pixels, via the view rect; black beyond the picture).
  function drawLoupe(p) {
    const el = source, [vw, vh] = srcDims();
    if (!vw || !vh) return;
    const [cw] = stageSize(), r = viewRect(), s = r.w / vw, ox = r.x, oy = r.y;
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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); layoutMedia(); draw();
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
      dimMargin();
      const tp = tapped.map(toPx);
      tp.forEach((p, i) => handle(p, CORNER_NAMES[i], true));
      if (tp.length > 1) { ctx.beginPath(); tp.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.strokeStyle = "#ffd60a"; ctx.lineWidth = 2; ctx.stroke(); }
      return;
    }
    const cs = cornersPx();
    if (!cs) return;
    const H = G.homography(G.cornerTableCoords(state.side, state.tableW, state.tableD), cs);
    if (H) R.drawOverlay(ctx, H, DATA, scenario(), Object.assign(opts, { lineScale: 1 }));
    dimMargin(); // overlay stays visible but faded where it runs off the camera picture
    if (adjusting) cs.forEach((p, i) => handle(p, CORNER_NAMES[i], dragIdx === i));
  }
  function dimMargin() {
    const r = viewRect(), [w, h] = stageSize();
    if (r.x < 1 && r.y < 1) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.rect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fill("evenodd");
    if (state.viewScale < 1 || calibrating || adjusting) { ctx.setLineDash([6, 4]); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.strokeRect(r.x - 0.5, r.y - 0.5, r.w + 1, r.h + 1); }
    ctx.restore();
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
    if (params.get("view")) state.viewScale = +params.get("view") / (+params.get("view") > 1 ? 100 : 1);
    if (params.get("cn")) { const v = params.get("cn").split(",").map(Number); state.corners = [0, 1, 2, 3].map(i => [v[2 * i], v[2 * i + 1]]); }
    if (params.get("ui") === "0") document.body.classList.add("noui");
    if (params.get("adjust") === "1") setTimeout(() => startAdjust(), 0);
    if (params.get("cal") === "1") setTimeout(startCalibration, 0);
    if (params.get("img")) {
      source = still; still.hidden = false; video.hidden = true;
      still.onload = () => { layoutMedia(); resize(); window.__ready = true; };
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
  window.__fov = { viewRect, toPx, toNorm, cam, get track() { return track; }, get camList() { return camList; } };
})();
