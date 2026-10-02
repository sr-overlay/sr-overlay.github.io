/* Warmachine table overlay (Steamroller 2026 / Tales from the Frontlines) — app controller (v7, photo-first). Plain JS, no dependencies. */
(function () {
  "use strict";
  const VERSION = "v9";
  const PACKS = { sr2026: window.STEAMROLLER, tftf: window.TFTF };
  let DATA = window.STEAMROLLER;
  const G = window.Geom, R = window.Render;
  const $ = id => document.getElementById(id);
  const stage = $("stage"), canvas = $("overlay"), ctx = canvas.getContext("2d");
  const loupe = $("loupe"), lctx = loupe.getContext("2d"), banner = $("banner");
  const params = new URLSearchParams(location.search);
  const STORE = "sr2026-overlay-v4";
  const MAX_PHOTO = 2048;

  const CORNER_NAMES = ["NEAR-LEFT", "NEAR-RIGHT", "FAR-RIGHT", "FAR-LEFT"];
  const CORNER_HINT = ["the corner closest to you on your left", "the corner closest to you on your right",
                       "the far corner on your right", "the far corner on your left"];

  // Corners are stored normalised to the picture (0..1 = picture edges; may go slightly outside for off-picture corners).
  const state = Object.assign({
    scenarioId: DATA.scenarios[0].id,
    side: "attacker",
    mode: "camera",          // "camera" (photo view) | "map"
    photoCorners: null,      // corners on the current photo
    lastPhoto: null,         // { w, h, corners } of the previous photo, to offer "same as last time"
    layers: Object.assign({}, R.DEFAULTS),
    tableW: DATA.table.width, tableD: DATA.table.depth,
    pack: null,              // "sr2026" | "tftf"; null until chosen on the welcome screen
    scenarioByPack: {}
  }, load());
  if (state.pack && PACKS[state.pack]) DATA = PACKS[state.pack];
  if (state.layers.bgBlur === undefined) state.layers.bgBlur = true;
  let src = null;            // "photo" once a photo is loaded, else null
  let photo = null;          // { canvas, w, h, name }
  let calibrating = false, adjusting = false, tapped = [], dragIdx = -1;
  const view = { z: 1, tx: 0, ty: 0 };   // pinch-zoom on top of the contain fit (photo only)

  function load() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(STORE, JSON.stringify({ pack: state.pack, scenarioByPack: state.scenarioByPack, scenarioId: state.scenarioId, side: state.side, mode: state.mode, photoCorners: null, lastPhoto: state.lastPhoto, layers: state.layers, tableW: state.tableW, tableD: state.tableD })); } catch (e) {} }
  const scenario = () => DATA.scenarios.find(s => s.id === state.scenarioId) || DATA.scenarios[0];
  const curCorners = () => state.photoCorners;
  function setCorners(c) { state.photoCorners = c; if (photo && c) state.lastPhoto = { w: photo.w, h: photo.h, corners: c }; save(); }

  // ---------- UI setup ----------
  function buildScenarioOptions() {
    $("scenario").innerHTML = "";
    DATA.scenarios.forEach(s => { const o = document.createElement("option"); o.value = s.id; o.textContent = `${s.number}. ${s.name}`; $("scenario").appendChild(o); });
    if (!DATA.scenarios.some(s => s.id === state.scenarioId)) state.scenarioId = (state.scenarioByPack || {})[state.pack] || DATA.scenarios[0].id;
  }
  // Scenario pack: Steamroller 2026 or Tales from the Frontlines. Remembered; switchable from the start screen and Info.
  function setPack(id) {
    if (!PACKS[id]) return;
    if (state.pack) (state.scenarioByPack = state.scenarioByPack || {})[state.pack] = state.scenarioId;
    state.pack = id; DATA = PACKS[id];
    const remembered = (state.scenarioByPack || {})[id];
    state.scenarioId = DATA.scenarios.some(s => s.id === remembered) ? remembered : DATA.scenarios[0].id;
    buildScenarioOptions(); save(); syncUI(); draw();
  }
  document.querySelectorAll("[data-pack]").forEach(b => b.onclick = () => {
    setPack(b.dataset.pack); $("welcomePanel").hidden = true; document.body.classList.remove("welcome");
    calibrating = adjusting = false; showBanner(null); $("startPanel").hidden = false;
    resize();   // bars were hidden behind the welcome screen: re-measure them so the photo fits between them
  });
  // Welcome / pack choice: shown on EVERY page load (last-chosen pack highlighted), and from Info -> "Change pack / Home".
  function showWelcome() { ["startPanel", "layersPanel", "infoPanel"].forEach(p => $(p).hidden = true); $("welcomePanel").hidden = false; document.body.classList.add("welcome"); syncUI(); }
  $("changePackBtn").onclick = showWelcome;
  $("infoPackBtn").onclick = showWelcome;
  buildScenarioOptions();
  ["side", "sideStart"].forEach(id => Object.entries(G.SIDES).forEach(([k, v]) => { const o = document.createElement("option"); o.value = k; o.textContent = v; $(id).appendChild(o); }));

  function syncUI() {
    $("scenario").value = state.scenarioId; $("side").value = state.side; $("sideStart").value = state.side;
    const map = state.mode === "map";
    document.body.classList.toggle("map", map);
    document.body.classList.toggle("photo", src === "photo");
    $("modeBtn").textContent = map ? (src === "photo" ? "Photo" : "Camera") : "Map";
    $("adjustBtn").classList.toggle("active", adjusting);
    document.body.classList.toggle("calib", (calibrating || adjusting) && !map);
    ["adjustBtn", "saveBtn"].forEach(id => $(id).disabled = map || !photo);
    document.querySelectorAll("[data-layer]").forEach(cb => cb.checked = !!state.layers[cb.dataset.layer]);
    $("tableW").value = state.tableW; $("tableD").value = state.tableD;
    $("fitBtn").hidden = !(src === "photo" && !map && view.z > 1.01);
    const s = scenario();
    $("infoTitle").textContent = `Scenario ${s.number}: ${s.name}`;
    $("infoSummary").textContent = s.summary;
    $("infoScoring").innerHTML = s.scoring.map(x => `<li>${x.replace(/</g, "&lt;")}</li>`).join("");
    $("infoNotes").innerHTML = (s.notes || []).concat(s.elements.filter(e => e.note).map(e => e.note)).map(n => `<p>${n}</p>`).join("");
    placeBanner();
    const pk = DATA.short || DATA.pack;
    $("backToPhotoBtn").hidden = !photo;
    $("packName").textContent = pk; $("startTitle").textContent = pk + " Overlay";
    document.querySelectorAll("[data-pack]").forEach(b => b.classList.toggle("chosen", b.dataset.pack === state.pack));
    $("infoSource").textContent = `Source: ${DATA.pack} (${DATA.publisher}), p. ${s.source.page}. Deployment: Attacker ${DATA.deployment.attacker}", Defender ${DATA.deployment.defender}". Positions are measured from the table edge to the edge of the base.`;
  }

  $("scenario").onchange = e => { state.scenarioId = e.target.value; save(); syncUI(); draw(); };
  $("side").onchange = $("sideStart").onchange = e => { state.side = e.target.value; save(); syncUI(); if (calibrating) promptCorner(); draw(); };
  $("modeBtn").onclick = () => {
    if (state.mode === "map") {
      if (!src) { $("startPanel").hidden = false; return; }
      state.mode = "camera";
    } else state.mode = "map";
    save(); syncUI(); layoutMedia(); draw();
  };
  $("adjustBtn").onclick = () => { if (!curCorners()) return startCalibration(); adjusting ? finishAdjust() : startAdjust(); };
  function startAdjust(prefix) {
    adjusting = true; calibrating = false;
    // Compact: one line of text + one row of buttons, placed clear of all four handles (see placeBanner).
    showBanner('<div class="bmsg">' + (prefix || "") + 'Drag the yellow handles onto the table corners' + (src === "photo" ? ' <span class="small">(pinch to zoom)</span>' : "") + '</div>' +
      '<div class="brow"><button id="bDone" class="primary">Done</button><button id="bFlip">Flip side</button><button id="bRedo">Re-tap</button></div>');
    $("bDone").onclick = finishAdjust;
    $("bFlip").onclick = () => $("flipBtn").onclick();
    $("bRedo").onclick = startCalibration;
    syncUI(); draw();
  }
  function finishAdjust() { adjusting = false; showBanner(null); save(); syncUI(); draw(); }
  $("flipBtn").onclick = () => { state.side = { attacker: "defender", defender: "attacker", left: "right", right: "left" }[state.side]; save(); syncUI(); draw(); };
  $("layersBtn").onclick = () => togglePanel("layersPanel");
  $("infoBtn").onclick = () => togglePanel("infoPanel");
  document.querySelectorAll(".panel .close").forEach(b => b.onclick = () => b.closest(".panel").hidden = true);
  document.querySelectorAll("[data-layer]").forEach(cb => cb.onchange = () => { state.layers[cb.dataset.layer] = cb.checked; save(); draw(); });
  ["tableW", "tableD"].forEach(id => $(id).onchange = () => { state.tableW = +$("tableW").value || 48; state.tableD = +$("tableD").value || 48; save(); draw(); });
  $("takePhotoBtn").onclick = () => { $("fileCam").value = ""; $("fileCam").click(); };
  $("choosePhotoBtn").onclick = () => { $("fileGal").value = ""; $("fileGal").click(); };
  $("retakeBtn").onclick = () => { $("fileCam").value = ""; $("fileCam").click(); };
  ["fileCam", "fileGal"].forEach(id => $(id).onchange = e => { const f = e.target.files && e.target.files[0]; if (f) loadPhotoFile(f); });
  $("startMapBtn").onclick = () => { $("startPanel").hidden = true; state.mode = "map"; save(); syncUI(); draw(); };
  $("backToPhotoBtn").onclick = () => { $("startPanel").hidden = true; state.mode = "camera"; save(); syncUI(); draw(); };
  $("saveBtn").onclick = () => saveImage();
  $("fitBtn").onclick = () => { resetView(); syncUI(); draw(); };
  function togglePanel(id) { ["layersPanel", "infoPanel"].forEach(p => { if (p !== id) $(p).hidden = true; }); $(id).hidden = !$(id).hidden; }

  function showBanner(html) { if (!html) { banner.hidden = true; return; } banner.innerHTML = html; banner.hidden = false; placeBanner(); }
  let toastTimer = 0;
  function toast(msg, ms) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, ms || 2500); }

  // Calibrate/adjust banner placement: never over a handle. Prefer the black letterbox above/below the picture,
  // else the screen edge (top/bottom) farthest from every handle. Recomputed whenever handles move or the view changes.
  function bannerHandles() {
    if (adjusting) return cornersPx() || [];
    if (calibrating) return tapped.map(toPx);
    return [];
  }
  function placeBanner() {
    const st = banner.style;
    st.top = st.left = st.width = st.transform = st.translate = ""; banner.classList.remove("mini");
    if (banner.hidden || !document.body.classList.contains("calib")) return;
    const r = picRect(), [W, H] = stageSize(), m = 6, hs = bannerHandles();
    const top = Math.max(0, r.y), bottom = Math.max(0, H - (r.y + r.h)), left = Math.max(0, r.x), right = Math.max(0, W - (r.x + r.w));
    const fullW = Math.min(W * 0.94, 440);
    // Candidates in order of preference: {x, y(top) or yc(centre) or yb(bottom), w, mini}
    const C = [];
    C.push({ x: (W - fullW) / 2, yIn: [0, top], w: fullW }, { x: (W - fullW) / 2, yIn: [H - bottom, H], w: fullW });
    if (left >= 140) C.push({ x: m, yIn: [0, H], w: left - 2 * m });
    if (right >= 140) C.push({ x: W - right + m, yIn: [0, H], w: right - 2 * m });
    const edgeOrder = calibrating && tapped.length >= 2 ? ["b", "t"] : ["t", "b"];
    for (const mini of [false, true]) for (const e of edgeOrder) C.push({ x: (W - fullW) / 2, edge: e, w: fullW, mini });
    const clear = (bx, by, bw, bh) => Math.min(1e9, ...hs.map(p => {
      const dx = Math.max(bx - (p[0] + 18), 0, (p[0] - 18) - (bx + bw)), dy = Math.max(by - (p[1] + 18), 0, (p[1] - 36) - (by + bh));
      return dx > 0 || dy > 0 ? Math.hypot(dx, dy) : -Math.min(bx + bw - p[0], p[0] - bx, by + bh - p[1] + 36, p[1] + 18 - by) - 1;
    }));
    let best = null;
    for (const c of C) {
      banner.classList.toggle("mini", !!c.mini); st.left = c.x + "px"; st.width = c.w + "px"; st.translate = "0 0"; st.transform = "none";
      const bh = banner.offsetHeight;
      let y;
      if (c.yIn) { if (c.yIn[1] - c.yIn[0] < bh + 2 * m) continue; y = (c.yIn[0] + c.yIn[1] - bh) / 2; }
      else y = c.edge === "t" ? m : H - bh - m;
      const cl = clear(c.x, y, c.w, bh);
      if (!best || (cl > 4 && best.cl <= 4) || (best.cl <= 4 && cl > best.cl)) best = Object.assign({ y, cl }, c);
      if (cl > 4) break;
    }
    if (!best) return;
    banner.classList.toggle("mini", !!best.mini); st.left = best.x + "px"; st.width = best.w + "px"; st.top = best.y + "px"; st.translate = "0 0"; st.transform = "none";
    window.__bannerClear = best.cl;
  }

  // ---------- Photo ----------
  async function decodeImage(file) {
    // Respect EXIF orientation: createImageBitmap(from-image), else an <img> (browsers apply EXIF to <img> and drawImage).
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) { console.warn("createImageBitmap failed, using <img>", e); }
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url;
      await (img.decode ? img.decode() : new Promise((res, rej) => { img.onload = res; img.onerror = rej; }));
      return img;
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
  async function loadPhotoFile(file) {
    toast("Loading photo…", 8000);
    let bmp;
    try { bmp = await decodeImage(file); }
    catch (e) { toast("Couldn't read that image (" + (e && e.name || e) + "). Try a JPEG/PNG photo.", 5000); return false; }
    const iw = bmp.width || bmp.naturalWidth, ih = bmp.height || bmp.naturalHeight;
    const k = Math.min(1, MAX_PHOTO / Math.max(iw, ih));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(iw * k)); c.height = Math.max(1, Math.round(ih * k));
    const cx = c.getContext("2d"); cx.imageSmoothingQuality = "high"; cx.drawImage(bmp, 0, 0, c.width, c.height);
    if (bmp.close) bmp.close();
    usePhoto(c, file.name || "photo", iw, ih);
    $("toast").hidden = true;
    return true;
  }
  function usePhoto(c, name, origW, origH) {
    const prev = state.lastPhoto;
    photo = { canvas: c, w: c.width, h: c.height, name, origW: origW || c.width, origH: origH || c.height };
    BLUR.levels = BLUR.out = BLUR.tmp = null; BLUR.key = "";
    src = "photo"; state.mode = "camera"; state.photoCorners = null;
    ["startPanel", "layersPanel", "infoPanel"].forEach(p => $(p).hidden = true);
    resetView(); layoutMedia();
    const same = prev && prev.corners && Math.abs(prev.w / prev.h - photo.w / photo.h) < 0.01;
    startCalibration(same);
    window.__photoLoaded = (window.__photoLoaded || 0) + 1;
  }

  // ---------- Background blur (photo only): sharp table, gradually blurrier/darker further from its edge ----------
  // Blur levels are made once per photo on small padded canvases (ctx.filter where it works, else downscale/upscale),
  // then composited at photo resolution through masks built from a low-res distance field of the calibrated quad.
  const BLUR = { levels: null, out: null, tmp: null, key: "", last: 0, timer: 0 };
  function canFilter() {
    try { const c = document.createElement("canvas").getContext("2d"); c.filter = "blur(2px)"; return c.filter === "blur(2px)"; } catch (e) { return false; }
  }
  function mkCanvas(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function buildBlurLevels() {
    const t0 = performance.now(), W = photo.w, H = photo.h, L = Math.max(W, H), useFilter = canFilter();
    BLUR.levels = [0.003, 0.008, 0.018].map(f => {
      const r = f * L;                                  // blur radius in photo px
      const k = useFilter ? Math.min(1, 4 / r) : Math.min(1, 1.2 / r);   // work scale: ~4px filter blur, or pure resample blur
      const w = Math.max(2, Math.round(W * k)), h = Math.max(2, Math.round(H * k)), p = useFilter ? 8 : 1;
      // Shrink in halving steps (smooth), into a padded canvas whose margin repeats the edge pixels (no dark borders).
      let srcC = photo.canvas, sw = W, sh = H;
      while (sw / 2 > w * 1.5) { const c = mkCanvas(sw / 2, sh / 2), x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(srcC, 0, 0, c.width, c.height); srcC = c; sw = c.width; sh = c.height; }
      const pad = mkCanvas(w + 2 * p, h + 2 * p), px = pad.getContext("2d"); px.imageSmoothingQuality = "high";
      px.drawImage(srcC, 0, 0, sw, sh, p, p, w, h);
      px.drawImage(pad, p, p, 1, h, 0, p, p, h); px.drawImage(pad, p + w - 1, p, 1, h, p + w, p, p, h);
      px.drawImage(pad, 0, p, w + 2 * p, 1, 0, 0, w + 2 * p, p); px.drawImage(pad, 0, p + h - 1, w + 2 * p, 1, 0, p + h, w + 2 * p, p);
      let c = pad;
      if (useFilter) { c = mkCanvas(pad.width, pad.height); const x = c.getContext("2d"); x.filter = `blur(${(r * k).toFixed(2)}px)`; x.drawImage(pad, 0, 0); x.filter = "none"; }
      return { c, p, w, h };
    });
    // The blurred/darkened background is kept as a separate half-res layer with alpha (transparent over the table),
    // drawn over the sharp photo — compositing at reduced resolution keeps corner dragging responsive.
    const ks = Math.min(1, 1024 / L);
    BLUR.out = mkCanvas(W * ks, H * ks); BLUR.tmp = mkCanvas(W * ks, H * ks); BLUR.key = "";
    window.__blurInfo = { levelsMs: Math.round(performance.now() - t0), filter: useFilter };
  }
  function quadDistField(q, mw, mh) {    // q in photo px; distance (photo px) outside the quad, 0 inside
    const W = photo.w, H = photo.h, sx = W / mw, sy = H / mh, d = new Float32Array(mw * mh);
    for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) {
      const x = (i + 0.5) * sx, y = (j + 0.5) * sy;
      let inside = false, best = Infinity;
      for (let a = 0, b = 3; a < 4; b = a++) {
        const [x1, y1] = q[a], [x2, y2] = q[b];
        if ((y1 > y) !== (y2 > y) && x < (x2 - x1) * (y - y1) / (y2 - y1) + x1) inside = !inside;
        const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L2));
        const ex = x1 + t * dx - x, ey = y1 + t * dy - y, e = ex * ex + ey * ey; if (e < best) best = e;
      }
      d[j * mw + i] = inside ? 0 : Math.sqrt(best);
    }
    return d;
  }
  function buildBlurComposite() {
    const t0 = performance.now(), W = photo.w, H = photo.h, cn = state.photoCorners;
    if (!BLUR.levels) buildBlurLevels();
    const q = cn.map(c => [c[0] * W, c[1] * H]);
    let area = 0; for (let a = 0, b = 3; a < 4; b = a++) area += q[b][0] * q[a][1] - q[a][0] * q[b][1];
    const size = Math.sqrt(Math.abs(area) / 2) || Math.max(W, H) / 2;   // ~table width in photo px
    // Long, gentle ramp: at least ~40% of the photo, so even a small/thin table in a wide photo fades out slowly.
    const ramp = Math.max(0.9 * size, 0.4 * Math.max(W, H)), mw = Math.max(16, Math.round(256 * W / Math.max(W, H))), mh = Math.max(16, Math.round(256 * H / Math.max(W, H)));
    const off = 0.8 * Math.max(W / mw, H / mh) + 0.015 * Math.max(W, H);   // a sharp margin right at the edge          // start just outside the edge so the table itself stays sharp after upscaling
    const dist = quadDistField(q, mw, mh), n = BLUR.levels.length;
    const mask = mkCanvas(mw, mh), mx = mask.getContext("2d"), img = mx.createImageData(mw, mh);
    const o = BLUR.out.getContext("2d"), tx = BLUR.tmp.getContext("2d"), OW = BLUR.out.width, OH = BLUR.out.height;
    o.globalCompositeOperation = "source-over"; o.globalAlpha = 1; o.clearRect(0, 0, OW, OH);
    const tOf = v => { const t = Math.max(0, Math.min(1, (v - off) / ramp)); return t * t * (1.6 - 0.6 * t); };  // ease-in
    for (let k = 0; k <= n; k++) {          // k < n: blur level k; k == n: darkening
      for (let p = 0; p < dist.length; p++) {
        const t = tOf(dist[p]);
        const a = k < n ? Math.max(0, Math.min(1, t * n - k)) : 0.26 * t;
        img.data[4 * p] = img.data[4 * p + 1] = img.data[4 * p + 2] = 0; img.data[4 * p + 3] = Math.round(a * 255);
      }
      mx.putImageData(img, 0, 0);
      if (k === n) { o.imageSmoothingEnabled = true; o.drawImage(mask, 0, 0, OW, OH); break; }
      const lv = BLUR.levels[k];
      tx.globalCompositeOperation = "copy"; tx.imageSmoothingEnabled = true; tx.drawImage(mask, 0, 0, OW, OH);
      tx.globalCompositeOperation = "source-in"; tx.drawImage(lv.c, lv.p, lv.p, lv.w, lv.h, 0, 0, OW, OH);
      tx.globalCompositeOperation = "source-over";
      o.drawImage(BLUR.tmp, 0, 0);
    }
    BLUR.key = JSON.stringify(cn); BLUR.last = performance.now();
    window.__blurMs = Math.round(BLUR.last - t0); window.__blurBuilds = (window.__blurBuilds || 0) + 1;
  }
  // Draw the photo into rect (x,y,w,h): sharp photo, plus the blurred background layer when calibrated and enabled.
  function drawPhoto(c, x, y, w, h, allowStale) {
    c.drawImage(photo.canvas, x, y, w, h);
    if (!state.layers.bgBlur || calibrating || !state.photoCorners) return;
    const key = JSON.stringify(state.photoCorners);
    if (key !== BLUR.key) {
      if (allowStale && BLUR.key && dragIdx >= 0 && performance.now() - BLUR.last < 80) {   // throttle while dragging
        clearTimeout(BLUR.timer); BLUR.timer = setTimeout(() => requestDraw(), 80);
      } else {
        try { buildBlurComposite(); } catch (e) { console.warn("blur", e); return; }
      }
    }
    if (BLUR.key) { c.imageSmoothingEnabled = true; c.drawImage(BLUR.out, x, y, w, h); }
  }

  // ---------- Calibration ----------
  function startCalibration(offerPrevious) {
    if (state.mode === "map") { state.mode = "camera"; }
    calibrating = true; adjusting = false; tapped = [];
    ["layersPanel", "infoPanel"].forEach(p => $(p).hidden = true);
    syncUI(); promptCorner(offerPrevious); draw();
  }
  function promptCorner(offerPrevious) {
    const i = tapped.length;
    const prevOk = offerPrevious === true || (offerPrevious !== false && src === "photo" && i === 0 && state.lastPhoto && photo && Math.abs(state.lastPhoto.w / state.lastPhoto.h - photo.w / photo.h) < 0.01);
    showBanner(`<span class="step">Corner ${i + 1} of 4:</span> tap the <b>${CORNER_NAMES[i]}</b> table corner<br><span class="small">(${CORNER_HINT[i]}, standing at the ${G.SIDES[state.side]})</span>` +
      `<div class="brow"><button id="bSide">Change edge</button>${i ? '<button id="bUndo">Undo</button>' : ""}${prevOk && i === 0 ? '<button id="bPrev">Same as last photo</button>' : ""}<button id="bCancel">Cancel</button></div>`);
    $("bSide").onclick = () => togglePanel("layersPanel");
    if ($("bUndo")) $("bUndo").onclick = () => { tapped.pop(); promptCorner(); draw(); };
    if ($("bPrev")) $("bPrev").onclick = () => { setCorners(state.lastPhoto.corners.map(p => p.slice())); startAdjust("<span class='step'>Using the corners from your last photo.</span> "); };
    $("bCancel").onclick = () => { calibrating = false; showBanner(null); syncUI(); draw(); };
  }
  function registerTap(p) {
    tapped.push(toNorm(p));
    drawLoupe(p);
    if (tapped.length === 4) {
      setCorners(tapped.map(q => q.slice()));
      const ok = G.isConvexQuad(tapped.map(toPx));
      tapped = [];
      startAdjust(ok ? "<span class='step'>Calibrated.</span> " : "<span class='step'>Those corners cross over — check the order (or re-tap).</span> ");
    } else promptCorner();
    setTimeout(() => { if (dragIdx < 0) loupe.hidden = true; }, 350);
    draw();
  }

  // ---------- Coordinates ----------
  function stageSize() { return [stage.clientWidth, stage.clientHeight]; }
  function srcDims() {
    if (src === "photo" && photo) return [photo.w, photo.h];
    return [0, 0];
  }
  // Contain-fit picture rect (before pinch zoom).
  // The picture is fitted between the top and bottom bars so no part of the table hides under them.
  const bars = { top: 0, bottom: 0 };
  function measureBars() {
    const t = $("topbar").offsetHeight, b = $("bottombar").offsetHeight;
    if (t) bars.top = t; if (b) bars.bottom = b;
  }
  function baseRect() {
    const [W, H] = stageSize(), [vw, vh] = srcDims();
    if (!vw || !vh) return { x: 0, y: 0, w: W, h: H };
    const avail = H - bars.top - bars.bottom;
    const s = Math.min(W / vw, avail / vh), w = vw * s, h = vh * s;
    return { x: (W - w) / 2, y: bars.top + (avail - h) / 2, w, h };
  }
  function picRect() { const b = baseRect(); return { x: b.x * view.z + view.tx, y: b.y * view.z + view.ty, w: b.w * view.z, h: b.h * view.z }; }
  function toPx(q) { const r = picRect(); return [r.x + q[0] * r.w, r.y + q[1] * r.h]; }
  function toNorm(p) { const r = picRect(); return [(p[0] - r.x) / r.w, (p[1] - r.y) / r.h]; }
  function cornersPx() { const c = curCorners(); return c ? c.map(toPx) : null; }
  function layoutMedia() { placeBanner(); }
  function resetView() { view.z = 1; view.tx = 0; view.ty = 0; }
  function clampView() {
    const b = baseRect();
    view.z = Math.min(8, Math.max(1, view.z));
    const lo = (a, len) => (a + len) * (1 - view.z), hi = a => a * (1 - view.z);
    view.tx = Math.min(hi(b.x), Math.max(lo(b.x, b.w), view.tx));
    view.ty = Math.min(hi(b.y), Math.max(lo(b.y, b.h), view.ty));
    if (view.z === 1) view.tx = view.ty = 0;
  }
  function zoomAt(p, z) {   // keep the picture point under screen point p fixed
    const bx = (p[0] - view.tx) / view.z, by = (p[1] - view.ty) / view.z;
    view.z = Math.min(8, Math.max(1, z)); view.tx = p[0] - bx * view.z; view.ty = p[1] - by * view.z; clampView();
  }

  // ---------- Pointer input: taps, handle drags, pinch-zoom / pan (photo) ----------
  function evtPoint(e) { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  const pts = new Map();
  let gesture = null;   // { type: "tap"|"pan"|"pinch"|"drag", ... }
  const canZoom = () => src === "photo" && state.mode === "camera";
  stage.addEventListener("pointerdown", e => {
    if (state.mode !== "camera" || !src) return;
    const p = evtPoint(e); pts.set(e.pointerId, p);
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    if (pts.size === 2 && canZoom()) {
      if (dragIdx >= 0) { dragIdx = -1; loupe.hidden = true; document.body.classList.remove("dragging"); save(); }
      const [a, b] = [...pts.values()];
      gesture = { type: "pinch", z0: view.z, tx0: view.tx, ty0: view.ty, m0: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d0: Math.max(10, Math.hypot(a[0] - b[0], a[1] - b[1])) };
      return;
    }
    if (pts.size > 1) return;
    if (calibrating) { gesture = { type: "tap", p0: p, tx0: view.tx, ty0: view.ty }; return; }
    if (adjusting && curCorners()) {
      const cs = cornersPx(); let best = -1, bd = 48;
      cs.forEach((c, i) => { const d = Math.hypot(c[0] - p[0], c[1] - p[1]); if (d < bd) { bd = d; best = i; } });
      if (best >= 0) { dragIdx = best; document.body.classList.add("dragging"); gesture = { type: "drag", off: [cs[best][0] - p[0], cs[best][1] - p[1]] }; drawLoupe(cs[best]); draw(); return; }
    }
    if (canZoom()) gesture = { type: "pan", p0: p, tx0: view.tx, ty0: view.ty };
  });
  stage.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId) || !gesture) return;
    const p = evtPoint(e); pts.set(e.pointerId, p);
    if (gesture.type === "pinch") {
      if (pts.size < 2) return;
      const [a, b] = [...pts.values()], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const bx = (gesture.m0[0] - gesture.tx0) / gesture.z0, by = (gesture.m0[1] - gesture.ty0) / gesture.z0;
      view.z = Math.min(8, Math.max(1, gesture.z0 * d / gesture.d0)); view.tx = m[0] - bx * view.z; view.ty = m[1] - by * view.z; clampView();
      syncFit(); requestDraw(); return;
    }
    if (gesture.type === "drag" && dragIdx >= 0) {
      const [w, h] = stageSize(), q = [Math.min(w, Math.max(0, p[0] + gesture.off[0])), Math.min(h, Math.max(0, p[1] + gesture.off[1]))];
      curCorners()[dragIdx] = toNorm(q);
      drawLoupe(q); requestDraw(); return;
    }
    if (gesture.type === "tap" && Math.hypot(p[0] - gesture.p0[0], p[1] - gesture.p0[1]) > 12 && canZoom() && view.z > 1.01) gesture.type = "pan";
    if (gesture.type === "pan") { view.tx = gesture.tx0 + p[0] - gesture.p0[0]; view.ty = gesture.ty0 + p[1] - gesture.p0[1]; clampView(); requestDraw(); }
  });
  function endPointer(e, cancelled) {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size === 0) { document.body.classList.remove("dragging"); placeBanner(); }
    const g = gesture;
    if (g && g.type === "pinch") { if (pts.size === 0) gesture = null; return; }
    gesture = null;
    if (!g) return;
    if (g.type === "tap" && !cancelled && calibrating) registerTap(g.p0);
    if (g.type === "drag") { dragIdx = -1; loupe.hidden = true; setCorners(curCorners()); draw(); }
  }
  stage.addEventListener("pointerup", e => endPointer(e, false));
  stage.addEventListener("pointercancel", e => endPointer(e, true));
  stage.addEventListener("wheel", e => {
    if (!canZoom()) return; e.preventDefault();
    zoomAt(evtPoint(e), view.z * Math.exp(-e.deltaY * 0.0015)); syncFit(); draw(); placeBanner();
  }, { passive: false });
  function syncFit() { $("fitBtn").hidden = !(canZoom() && view.z > 1.01); }

  // Put the magnifier in the screen corner farthest from the finger and every handle.
  function placeLoupe(p) {
    const [W, H] = stageSize(), L = 160, m = 12, pts2 = bannerHandles().concat([p]);
    const cands = [[m, 70], [W - L - m, 70], [m, H - L - m], [W - L - m, H - L - m]];
    let best = cands[0], bd = -1;
    for (const c of cands) {
      const d = Math.min(...pts2.map(q => Math.hypot(Math.max(c[0] - q[0], 0, q[0] - c[0] - L), Math.max(c[1] - q[1], 0, q[1] - c[1] - L))));
      if (d > bd + 1) { bd = d; best = c; }
    }
    loupe.style.left = best[0] + "px"; loupe.style.top = best[1] + "px";
  }
  // Magnifier showing the picture under the finger.
  function drawLoupe(p) {
    if (!photo) return;
    const el = photo.canvas, [vw, vh] = srcDims();
    if (!vw || !vh) return;
    const [cw] = stageSize(), r = picRect(), s = r.w / vw;
    const zoom = 3, half = loupe.width / 2 / zoom;
    const sx = (p[0] - half - r.x) / s, sy = (p[1] - half - r.y) / s, sw = 2 * half / s;
    placeLoupe(p);
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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); measureBars(); clampView(); layoutMedia(); syncUI(); draw();
  }
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 300));

  function mapHomography() {
    const [w, h] = stageSize();
    const top = 70, bottom = 70, pad = 14;
    const side = state.side, rot = side === "left" || side === "right";
    const tw = rot ? state.tableD : state.tableW, td = rot ? state.tableW : state.tableD;
    const k = Math.min((w - 2 * pad) / tw, (h - top - bottom) / td);
    const x0 = (w - tw * k) / 2, y0 = top + (h - top - bottom - td * k) / 2;
    const screen = [[x0, y0 + td * k], [x0 + tw * k, y0 + td * k], [x0 + tw * k, y0], [x0, y0]];
    return G.homography(G.cornerTableCoords(side, state.tableW, state.tableD), screen);
  }

  let rafPending = false;
  function requestDraw() { if (rafPending) return; rafPending = true; requestAnimationFrame(() => { rafPending = false; draw(); }); }
  function overlayOpts(extra) { return Object.assign({}, state.layers, { W: state.tableW, D: state.tableD, side: state.side }, extra || {}); }

  function draw() {
    const [w, h] = stageSize();
    ctx.clearRect(0, 0, w, h);
    if (state.mode === "map") {
      const H = mapHomography();
      R.drawOverlay(ctx, H, DATA, scenario(), overlayOpts({ background: true }));
      edgeCaption(H); return;
    }
    if (src === "photo" && photo) {
      const r = picRect();
      ctx.imageSmoothingQuality = "high";
      drawPhoto(ctx, r.x, r.y, r.w, r.h, true);
    }
    if (calibrating) {
      const tp = tapped.map(toPx);
      tp.forEach((p, i) => handle(p, CORNER_NAMES[i], true));
      if (tp.length > 1) { ctx.beginPath(); tp.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.strokeStyle = "#ffd60a"; ctx.lineWidth = 2; ctx.stroke(); }
      return;
    }
    const cs = cornersPx();
    if (!cs) return;
    const H = G.homography(G.cornerTableCoords(state.side, state.tableW, state.tableD), cs);
    if (H) R.drawOverlay(ctx, H, DATA, scenario(), overlayOpts({ lineScale: 1 }));
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

  // ---------- Export (photo + overlay at photo resolution, looks the same as on screen) ----------
  function exportCanvas() {
    if (!photo) return null;
    const b = baseRect(), k = photo.w / b.w;            // photo px per on-screen px (unzoomed fit)
    const capH = 30, out = document.createElement("canvas");
    out.width = photo.w; out.height = Math.round(photo.h + capH * k);
    const c = out.getContext("2d");
    c.setTransform(k, 0, 0, k, 0, 0);
    drawPhoto(c, 0, 0, b.w, b.h, false);
    const cn = state.photoCorners;
    if (cn) {
      const cs = cn.map(q => [q[0] * b.w, q[1] * b.h]);
      const H = G.homography(G.cornerTableCoords(state.side, state.tableW, state.tableD), cs);
      c.save(); c.beginPath(); c.rect(0, 0, b.w, b.h); c.clip();
      if (H) R.drawOverlay(c, H, DATA, scenario(), overlayOpts({ lineScale: 1 }));
      c.restore();
    }
    const s = scenario();
    c.fillStyle = "#111"; c.fillRect(0, b.h, b.w, capH);
    c.textAlign = "left"; c.textBaseline = "middle";
    c.font = "bold 12px system-ui, sans-serif"; c.fillStyle = "#fff";
    c.fillText(`${DATA.short || DATA.pack} · ${s.number}. ${s.name}`, 8, b.h + 10, b.w - 16);
    c.font = "9px system-ui, sans-serif"; c.fillStyle = "#aaa";
    c.fillText(`Standing at the ${G.SIDES[state.side]} · sr-overlay.github.io · unofficial fan tool`, 8, b.h + 22, b.w - 16);
    return out;
  }
  async function saveImage() {
    const out = exportCanvas();
    if (!out) { toast("Take a photo first."); return; }
    const blob = await new Promise(res => out.toBlob(res, "image/jpeg", 0.9));
    if (!blob) { toast("Couldn't create the image."); return; }
    const name = `steamroller-${scenario().id}.jpg`;
    window.__lastExport = { w: out.width, h: out.height, size: blob.size, type: blob.type, name };
    let file = null; try { file = new File([blob], name, { type: "image/jpeg" }); } catch (e) {}
    if (file && navigator.canShare && navigator.share) {
      try { if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: `${DATA.short || DATA.pack} — ${scenario().name}` }); window.__lastExport.via = "share"; return; } }
      catch (e) { if (e && e.name === "AbortError") return; console.warn("share failed, downloading", e); }
    }
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    window.__lastExport.via = "download"; toast("Image saved");
  }

  // ---------- Test / demo hooks ----------
  // ?img=<url> (loaded as a photo) &pcn=x1,y1,..,x4,y4 (photo corners, normalised, tap order) &scenario=&side=&mode=map&layers=dims,-labels&ui=0&adjust=1&cal=1
  async function applyParams() {
    if (params.get("pack")) { setPack(params.get("pack")); $("welcomePanel").hidden = true; $("startPanel").hidden = false; }
    if (params.get("scenario")) state.scenarioId = params.get("scenario");
    if (params.get("side")) state.side = params.get("side");
    if (params.get("mode")) state.mode = params.get("mode");
    if (params.get("layers")) params.get("layers").split(",").forEach(l => { if (l.startsWith("-")) state.layers[l.slice(1)] = false; else state.layers[l] = true; });
    if (params.get("ui") === "0") document.body.classList.add("noui");
    if (params.get("mode") === "map") $("startPanel").hidden = true;
    if (params.get("img")) {
      const blob = await (await fetch(params.get("img"))).blob();
      await loadPhotoFile(new File([blob], "test.jpg", { type: blob.type }));
      const v = (params.get("pcn") || params.get("cn") || "").split(",").map(Number);
      if (v.length === 8) { calibrating = false; showBanner(null); state.photoCorners = [0, 1, 2, 3].map(i => [v[2 * i], v[2 * i + 1]]); }
      if (params.get("adjust") === "1") startAdjust(); else if (params.get("cal") === "1") startCalibration(false);
      syncUI(); draw();
    }
  }

  if (!params.get("pack")) showWelcome();
  syncUI(); resize();
  applyParams().catch(e => console.error(e)).then(() => { window.__ready = true; });
  window.__placeBanner = placeBanner;
  window.__state = state;
  window.__app = { toPx, toNorm, picRect, baseRect, cornersPx, exportCanvas, view, loadPhotoFile, get photo() { return photo; }, get src() { return src; }, get calibrating() { return calibrating; }, get adjusting() { return adjusting; }, VERSION, get blurKey() { return BLUR.key; } };
})();
