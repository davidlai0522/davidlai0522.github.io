"use strict";

const CYAN = "#00e5ff", GREEN = "#39ff88", AMBER = "#ffb300";

// ---------- shared helpers ----------
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  // two-link IK: returns elbow and (clamped) end point. sign picks the elbow side.
  function ik2(bx, by, L1, L2, tx, ty, sign) {
    let dx = tx - bx, dy = ty - by;
    const d0 = Math.hypot(dx, dy) || 1e-6;
    const d = clamp(d0, Math.abs(L1 - L2) + 1, L1 + L2 - 0.5);
    const ux = dx / d0, uy = dy / d0;
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
    const hh = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    return {
      ex: bx + a * ux - sign * hh * uy, ey: by + a * uy + sign * hh * ux,
      hx: bx + ux * d, hy: by + uy * d,
    };
  }

// ---------- footer year ----------
document.getElementById("yr").textContent = new Date().getFullYear();

// ---------- typed text ----------
(function () {
  const lines = ["perception.", "motion planning.", "control.", "robot learning.", "research."];
  const el = document.getElementById("typed");
  let li = 0, ci = 0, del = false;
  (function tick() {
    const word = lines[li];
    el.textContent = "I work on " + word.slice(0, ci);
    if (!del && ci < word.length) ci++;
    else if (!del) { del = true; return setTimeout(tick, 1200); }
    else if (ci > 0) ci--;
    else { del = false; li = (li + 1) % lines.length; }
    setTimeout(tick, del ? 30 : 70);
  })();
})();

// ---------- scroll reveal + skill bars ----------
(function () {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      e.target.querySelectorAll(".skill").forEach((s) => {
        s.querySelector("i").style.width = s.dataset.v + "%";
      });
      io.unobserve(e.target);
    }
  }, { threshold: 0, rootMargin: "0px 0px -10% 0px" });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
})();

// ---------- background: blueprint grid + wandering AMR swarm with LiDAR ----------
(function () {
  const c = document.getElementById("bg"), g = c.getContext("2d");
  let w, h, bots = [];
  const mouse = { x: -999, y: -999 };
  function resize() {
    w = c.width = innerWidth; h = c.height = innerHeight;
    const n = Math.min(14, Math.max(5, Math.floor((w * h) / 140000)));
    bots = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h, th: Math.random() * 6.28, turn: 0, trail: [],
    }));
  }
  addEventListener("resize", resize);
  addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  resize();
  (function frame(t) {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = "rgba(0,229,255,.05)"; g.lineWidth = 1;
    for (let x = 0; x < w; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (const b of bots) {
      // wander, steer back from edges, flee from the cursor
      b.turn += (Math.random() - 0.5) * 0.02; b.turn *= 0.97;
      const dm = Math.hypot(b.x - mouse.x, b.y - mouse.y);
      let ax = 0, ay = 0;
      if (dm < 150) { ax = (b.x - mouse.x) / dm; ay = (b.y - mouse.y) / dm; }
      if (b.x < 60) ax += 1; if (b.x > w - 60) ax -= 1;
      if (b.y < 60) ay += 1; if (b.y > h - 60) ay -= 1;
      if (ax || ay) { let e = Math.atan2(ay, ax) - b.th; e = Math.atan2(Math.sin(e), Math.cos(e)); b.turn = e * 0.08; }
      b.th += b.turn;
      const v = dm < 150 ? 2.2 : 0.8;
      b.x += v * Math.cos(b.th); b.y += v * Math.sin(b.th);
      b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 60) b.trail.shift();
      g.strokeStyle = "rgba(57,255,136,.12)"; g.beginPath();
      b.trail.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke();
      // rotating LiDAR fan
      const sweep = b.th + Math.sin(t / 600 + b.x) * 0.6;
      const grad = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, 90);
      grad.addColorStop(0, "rgba(0,229,255,.16)"); grad.addColorStop(1, "rgba(0,229,255,0)");
      g.fillStyle = grad; g.beginPath(); g.moveTo(b.x, b.y);
      g.arc(b.x, b.y, 90, sweep - 0.5, sweep + 0.5); g.closePath(); g.fill();
      g.strokeStyle = "rgba(0,229,255,.35)"; g.lineWidth = 1.5;
      g.beginPath(); g.arc(b.x, b.y, 7, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x + 11 * Math.cos(b.th), b.y + 11 * Math.sin(b.th)); g.stroke();
    }
    requestAnimationFrame(frame);
  })(0);
})();

// ---------- hero: robot arm sketching my portrait (cross-hatching like a pen plotter + 2-link IK) ----------
(function () {
  const c = document.getElementById("arm"), g = c.getContext("2d");
  const W = c.width, H = c.height;
  const S = 330, PAPER = { x: 115, y: 12 }, BASE = { x: W / 2, y: H - 8 }, L1 = 240, L2 = 240, HOME = { x: W / 2 + 60, y: 200 };
  // hatch layers: darker areas collect more layers [darkness threshold, line angle]
  const LEVELS = [[0.36, 0], [0.55, Math.PI / 4], [0.72, -Math.PI / 4], [0.86, Math.PI / 2]], SPACING = 3.6;
  const ink = document.createElement("canvas"); ink.width = W; ink.height = H;
  const ig = ink.getContext("2d");
  let path = [], i = 0, pen = { ...HOME }, hold = 0, fade = 0, fast = false;
  c.addEventListener("click", () => (fast = !fast));

  // photo -> darkness map: crop on the face, blur, stretch contrast, fade out the lab background
  function darkness(img) {
    const t = document.createElement("canvas"); t.width = t.height = S;
    const tg = t.getContext("2d");
    tg.filter = "blur(1px)"; tg.drawImage(img, 140, 5, 180, 180, 0, 0, S, S);
    const px = tg.getImageData(0, 0, S, S).data, lum = new Float32Array(S * S);
    for (let k = 0; k < S * S; k++) lum[k] = (0.299 * px[k * 4] + 0.587 * px[k * 4 + 1] + 0.114 * px[k * 4 + 2]) / 255;
    const sorted = Float32Array.from(lum).sort(), lo = sorted[Math.floor(S * S * 0.02)], hi = sorted[Math.floor(S * S * 0.98)];
    const dark = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const k = y * S + x, a = clamp((lum[k] - lo) / (hi - lo), 0, 1);
      const r = Math.hypot((x - S * 0.52) / (S * 0.34), (y - S * 0.5) / (S * 0.62)), f = clamp((r - 1) / 0.25, 0, 1);
      dark[k] = 1 - (a * (1 - f) + f);
    }
    return dark;
  }
  // hatch lines -> one path; pen lifts (down: false) to travel between strokes
  function buildPath(dark) {
    const pts = [], D = S * 1.5;
    let flip = false;
    for (const [th, ang] of LEVELS) {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      for (let off = -D; off < D; off += SPACING) {
        const runs = [];
        let run = [];
        for (let t = -D; t < D; t += 2) {
          const x = S / 2 + ca * t - sa * off, y = S / 2 + sa * t + ca * off;
          if (x >= 0 && y >= 0 && x < S && y < S && dark[(y | 0) * S + (x | 0)] > th) run.push({ x: PAPER.x + x, y: PAPER.y + y });
          else { if (run.length > 2) runs.push(run); run = []; }
        }
        if (run.length > 2) runs.push(run);
        if (flip) { runs.reverse(); runs.forEach((r) => r.reverse()); } // boustrophedon: less travel
        if (runs.length) flip = !flip;
        for (const r of runs) {
          const last = pts.length ? pts[pts.length - 1] : HOME, d = Math.hypot(r[0].x - last.x, r[0].y - last.y);
          for (let s = 6; s < d; s += 6) pts.push({ x: last.x + ((r[0].x - last.x) * s) / d, y: last.y + ((r[0].y - last.y) * s) / d, down: false });
          r.forEach((p, k) => pts.push({ ...p, down: k > 0 }));
        }
      }
    }
    return pts;
  }
  const img = new Image();
  img.onload = () => {
    path = buildPath(darkness(img));
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { drawInk(1, path.length - 1); i = path.length; }
  };
  img.src = "img/david.jpeg";

  function drawInk(from, to) {
    ig.strokeStyle = "#1b2433"; ig.lineWidth = 0.9; ig.lineCap = "round";
    ig.beginPath();
    for (let k = Math.max(1, from); k <= to; k++) if (path[k].down) { ig.moveTo(path[k - 1].x, path[k - 1].y); ig.lineTo(path[k].x, path[k].y); }
    ig.stroke();
  }

  (function frame() {
    if (path.length) {
      if (i < path.length) {
        const to = Math.min(path.length - 1, i + (fast ? 90 : 22));
        drawInk(i, to); i = to + 1; pen = path[to];
      } else if (hold < 240) hold++;
      else if (fade < 60) { fade++; pen = { x: pen.x + (HOME.x - pen.x) * 0.05, y: pen.y + (HOME.y - pen.y) * 0.05 }; }
      else { ig.clearRect(0, 0, W, H); i = 0; hold = 0; fade = 0; }
    }
    g.clearRect(0, 0, W, H);
    // paper sheet
    g.fillStyle = "#f3eee2"; g.shadowColor = "rgba(0,229,255,.35)"; g.shadowBlur = 18;
    g.fillRect(PAPER.x - 8, PAPER.y - 8, S + 16, S + 16); g.shadowBlur = 0;
    g.globalAlpha = 1 - fade / 60; g.drawImage(ink, 0, 0); g.globalAlpha = 1;
    // arm
    const q = ik2(BASE.x, BASE.y, L1, L2, pen.x, pen.y, 1), up = pen.down === false;
    g.lineCap = "round"; g.strokeStyle = "rgba(0,229,255,.6)"; g.lineWidth = 12;
    g.shadowColor = "#00e5ff"; g.shadowBlur = 12;
    g.beginPath(); g.moveTo(BASE.x, BASE.y); g.lineTo(q.ex, q.ey); g.lineTo(q.hx, q.hy); g.stroke(); g.shadowBlur = 0;
    g.fillStyle = "rgba(0,229,255,.25)"; g.fillRect(BASE.x - 40, BASE.y - 4, 80, 12);
    g.fillStyle = "#05080d"; g.strokeStyle = "#39ff88"; g.lineWidth = 2;
    for (const [x, y] of [[BASE.x, BASE.y], [q.ex, q.ey]]) { g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); g.stroke(); }
    // pen tip: hollow when lifted, solid when drawing
    g.strokeStyle = g.fillStyle = "#ffb300"; g.shadowColor = "#ffb300"; g.shadowBlur = 10; g.lineWidth = 2;
    g.beginPath(); g.arc(q.hx, q.hy, up ? 6 : 4, 0, 7); up ? g.stroke() : g.fill(); g.shadowBlur = 0;
    // telemetry
    const pct = path.length ? Math.round((100 * Math.min(i, path.length)) / path.length) : 0;
    g.fillStyle = "#39ff88"; g.font = "12px monospace";
    g.fillText(i < path.length ? `sketching... ${pct}%${fast ? "  (fast)" : ""}` : "portrait done", 12, H - 34);
    g.fillText(`pen ${up ? "up" : "down"} (${q.hx.toFixed(0)}, ${q.hy.toFixed(0)})`, 12, H - 18);
    requestAnimationFrame(frame);
  })();
})();

// ---------- robot lab: AMR / dual-arm / humanoid ----------
(function () {
  const c = document.getElementById("rob"), g = c.getContext("2d");
  const W = c.width, H = c.height;
  const mouse = { x: W / 2, y: H / 2 };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  c.addEventListener("mousemove", (e) => {
    const r = c.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (W / r.width);
    mouse.y = (e.clientY - r.top) * (H / r.height);
  });

  function limb(p, bx, by, color, w) {
    g.strokeStyle = color; g.lineWidth = w; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); g.moveTo(bx, by); g.lineTo(p.ex, p.ey); g.lineTo(p.hx, p.hy); g.stroke();
    g.fillStyle = "#05080d"; g.strokeStyle = GREEN; g.lineWidth = 2;
    for (const [x, y] of [[bx, by], [p.ex, p.ey]]) { g.beginPath(); g.arc(x, y, w * 0.6, 0, 7); g.fill(); g.stroke(); }
  }
  function text(lines) {
    g.fillStyle = GREEN; g.font = "12px monospace";
    lines.forEach((s, i) => g.fillText(s, 12, 22 + i * 16));
  }

  // ----- AMR: unicycle robot, 2D LiDAR, potential-field avoidance -----
  const amr = (function () {
    const obs = [[250, 150, 50, 140], [450, 40, 50, 150], [450, 260, 50, 120], [650, 120, 50, 160]];
    const R = 120, N = 36;
    const bot = { x: 80, y: 330, th: -0.5 };
    let goal = { x: 880, y: 90 }, trail = [], hits = [];
    const blocked = (x, y) => x < 0 || y < 0 || x > W || y > H ||
      obs.some(([ox, oy, ow, oh]) => x >= ox && x <= ox + ow && y >= oy && y <= oy + oh);
    c.addEventListener("click", () => { if (active === "amr") { goal = { x: mouse.x, y: mouse.y }; trail = []; } });

    function step() {
      hits = []; let rx = 0, ry = 0;
      for (let i = 0; i < N; i++) {
        const a = bot.th + (i / N) * 2 * Math.PI, ca = Math.cos(a), sa = Math.sin(a);
        let d = R;
        for (let s = 8; s < R; s += 3) if (blocked(bot.x + ca * s, bot.y + sa * s)) { d = s; break; }
        hits.push({ x: bot.x + ca * d, y: bot.y + sa * d, hit: d < R });
        if (d < R) { const k = ((R - d) / R) ** 2; rx -= ca * k; ry -= sa * k; }
      }
      const gx = goal.x - bot.x, gy = goal.y - bot.y, gd = Math.hypot(gx, gy);
      const dx = gx / (gd || 1) + rx * 0.4, dy = gy / (gd || 1) + ry * 0.4;
      let err = Math.atan2(dy, dx) - bot.th;
      err = Math.atan2(Math.sin(err), Math.cos(err));
      const w = clamp(3 * err, -3, 3);
      const v = gd < 10 ? 0 : 130 * Math.max(0, Math.cos(err)) * Math.min(1, gd / 60);
      const nx = bot.x + v * Math.cos(bot.th) / 60, ny = bot.y + v * Math.sin(bot.th) / 60;
      if (!blocked(nx, ny)) { bot.x = nx; bot.y = ny; }
      bot.th += w / 60;
      if (!trail.length || Math.hypot(bot.x - trail[trail.length - 1].x, bot.y - trail[trail.length - 1].y) > 6) trail.push({ x: bot.x, y: bot.y });
      if (trail.length > 150) trail.shift();
      return { v, w, gd };
    }

    return {
      draw(t) {
        const s = step();
        g.fillStyle = "#26384a"; g.strokeStyle = CYAN; g.lineWidth = 1;
        for (const [x, y, w, h] of obs) { g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h); }
        g.strokeStyle = "rgba(0,229,255,.12)";
        for (const p of hits) { g.beginPath(); g.moveTo(bot.x, bot.y); g.lineTo(p.x, p.y); g.stroke(); }
        g.fillStyle = AMBER;
        for (const p of hits) if (p.hit) g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
        g.strokeStyle = "rgba(57,255,136,.5)"; g.lineWidth = 2; g.beginPath();
        trail.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke();
        g.strokeStyle = GREEN; g.lineWidth = 2; g.beginPath();
        g.arc(goal.x, goal.y, 10 + 3 * Math.sin(t / 200), 0, 7); g.stroke();
        g.fillStyle = "#05080d"; g.strokeStyle = CYAN; g.lineWidth = 3;
        g.beginPath(); g.arc(bot.x, bot.y, 13, 0, 7); g.fill(); g.stroke();
        g.strokeStyle = AMBER; g.beginPath(); g.moveTo(bot.x, bot.y);
        g.lineTo(bot.x + 18 * Math.cos(bot.th), bot.y + 18 * Math.sin(bot.th)); g.stroke();
        text([`v ${s.v.toFixed(0)} px/s`, `w ${s.w.toFixed(2)} rad/s`, `dist to goal ${s.gd.toFixed(0)}`]);
      },
    };
  })();

  // ----- dual-arm: both arms hold a box that follows the cursor -----
  const dual = (function () {
    const BL = { x: 240, y: 390 }, BR = { x: 720, y: 390 }, L1 = 190, L2 = 170, BW = 80;
    const box = { x: W / 2, y: 250 };
    return {
      draw() {
        const tx = clamp(mouse.x, 400, 560), ty = clamp(mouse.y, 170, 330);
        box.x += (tx - box.x) * 0.1; box.y += (ty - box.y) * 0.1;
        g.fillStyle = "rgba(0,229,255,.2)";
        for (const b of [BL, BR]) g.fillRect(b.x - 45, b.y, 90, 14);
        const l = ik2(BL.x, BL.y, L1, L2, box.x - BW / 2, box.y, -1);
        const r = ik2(BR.x, BR.y, L1, L2, box.x + BW / 2, box.y, 1);
        limb(l, BL.x, BL.y, CYAN, 14); limb(r, BR.x, BR.y, CYAN, 14);
        g.fillStyle = "rgba(255,179,0,.25)"; g.strokeStyle = AMBER; g.lineWidth = 2;
        g.fillRect(box.x - BW / 2, box.y - 30, BW, 60); g.strokeRect(box.x - BW / 2, box.y - 30, BW, 60);
        g.fillStyle = AMBER;
        g.fillRect(l.hx - 6, l.hy - 18, 8, 36); g.fillRect(r.hx - 2, r.hy - 18, 8, 36);
        text([`object (${box.x.toFixed(0)}, ${box.y.toFixed(0)})`, `left ee (${l.hx.toFixed(0)}, ${l.hy.toFixed(0)})`, `right ee (${r.hx.toFixed(0)}, ${r.hy.toFixed(0)})`]);
      },
    };
  })();

  // ----- humanoid: IK-driven walking gait, head tracks cursor -----
  const human = (function () {
    const GY = 380, TL = 60, SL = 60, AL = 40;
    let ph = 0, ground = 0;
    return {
      draw() {
        const sp = clamp((mouse.x - W / 2) / 300, -1, 1), a = Math.abs(sp) < 0.08 ? 0 : Math.abs(sp);
        const dir = sp < 0 ? -1 : 1, S = 45 * a, phd = 0.16 * a;
        ph += phd; ground += -dir * S * phd;
        g.strokeStyle = "rgba(0,229,255,.35)"; g.lineWidth = 2;
        g.beginPath(); g.moveTo(0, GY); g.lineTo(W, GY); g.stroke();
        for (let x = ((ground % 60) + 60) % 60; x < W; x += 60) { g.beginPath(); g.moveTo(x, GY); g.lineTo(x - 12, GY + 14); g.stroke(); }

        const cx = W / 2, hipY = GY - 108 + 3 * a * Math.cos(2 * ph), shY = hipY - 85;
        g.save(); g.translate(cx, 0); g.scale(dir, 1);
        const leg = (p, col) => {
          const fx = -S * Math.cos(p), lift = 22 * a * Math.max(0, Math.sin(p));
          const q = ik2(0, hipY, TL, SL, fx, GY - lift, -1);
          limb(q, 0, hipY, col, 10);
          g.strokeStyle = col; g.lineWidth = 6; g.beginPath(); g.moveTo(q.hx, q.hy); g.lineTo(q.hx + 14, q.hy); g.stroke();
        };
        const arm = (p, col) => {
          const q = ik2(0, shY, AL, AL, 0.7 * S * Math.cos(p), shY + 72, -1);
          limb(q, 0, shY, col, 8);
        };
        arm(ph, "rgba(0,229,255,.45)"); leg(ph + Math.PI, "rgba(0,229,255,.45)");
        g.strokeStyle = CYAN; g.lineWidth = 22; g.lineCap = "round";
        g.shadowColor = CYAN; g.shadowBlur = 12;
        g.beginPath(); g.moveTo(0, hipY); g.lineTo(0, shY); g.stroke(); g.shadowBlur = 0;
        leg(ph, CYAN); arm(ph + Math.PI, CYAN);
        const hy = shY - 30, ang = Math.atan2(mouse.y - hy, (mouse.x - cx) * dir);
        g.fillStyle = "#05080d"; g.strokeStyle = CYAN; g.lineWidth = 3;
        g.beginPath(); g.arc(0, hy, 18, 0, 7); g.fill(); g.stroke();
        g.fillStyle = AMBER; g.beginPath();
        g.arc(7 * Math.cos(ang), hy + 7 * Math.sin(ang), 4, 0, 7); g.fill();
        g.restore();
        text([`speed ${(dir * a).toFixed(2)}`, `gait phase ${(ph % (2 * Math.PI)).toFixed(2)} rad`, `stride ${(2 * S).toFixed(0)} px`]);
      },
    };
  })();

  const demos = { amr, dual, humanoid: human };
  let active = "amr";
  function select(k) {
    active = k;
    document.querySelectorAll("[data-robot]").forEach((b) => b.classList.toggle("on", b.dataset.robot === k));
  }
  document.querySelectorAll("[data-robot]").forEach((b) => b.addEventListener("click", () => select(b.dataset.robot)));
  select("amr");
  (function frame(t) {
    g.clearRect(0, 0, W, H);
    demos[active].draw(t);
    requestAnimationFrame(frame);
  })(0);
})();

// ---------- learning & control lab: pendulum control / Q-learning / VLA ----------
(function () {
  const c = document.getElementById("labc"), g = c.getContext("2d");
  const W = c.width, H = c.height;
  const ctl = document.getElementById("labctl");
  const el = (tag, props, parent) => { const e = Object.assign(document.createElement(tag), props); parent.appendChild(e); return e; };
  const txt = (lines, x, y, col) => { g.fillStyle = col || GREEN; g.font = "12px monospace"; lines.forEach((s, i) => g.fillText(s, x, y + i * 16)); };
  const wrap = (s, n) => { const out = []; let line = ""; for (const w of s.split(" ")) { if ((line + " " + w).length > n) { out.push(line); line = w; } else line = line ? line + " " + w : w; } out.push(line); return out; };

  // ----- control: cart-pole balanced by PD on angle + PD on cart position -----
  const control = (function () {
    const gr = 9.8, M = 1, m = 0.1, l = 0.5;
    let x, xd, th, thd, Kp = 40, Kd = 8, on = true, fallen = 0, hist = [];
    const reset = () => { x = 0; xd = 0; th = 0.1; thd = 0; fallen = 0; hist = []; };
    const push = (d) => { thd += d * 1.5; };
    reset();
    c.addEventListener("click", (e) => {
      if (active !== "control") return;
      const r = c.getBoundingClientRect(); push((e.clientX - r.left) / r.width < 0.34 ? -1 : 1);
    });
    function sim() {
      const dt = 1 / 240;
      for (let i = 0; i < 4; i++) {
        let F = on ? Kp * th + Kd * thd + 1 * x + 2 * xd : 0;
        F = clamp(F, -30, 30);
        const s = Math.sin(th), co = Math.cos(th);
        const tmp = (F + m * l * thd * thd * s) / (M + m);
        const thdd = (gr * s - co * tmp) / (l * (4 / 3 - m * co * co / (M + m)));
        const xdd = tmp - m * l * thdd * co / (M + m);
        xd += xdd * dt; x += xd * dt; thd += thdd * dt; th += thd * dt;
      }
      hist.push(th); if (hist.length > 400) hist.shift();
      if (Math.abs(th) > 1.3 || Math.abs(x) > 3) { if (++fallen > 90) reset(); } else fallen = 0;
    }
    return {
      ui(root) {
        const b = el("button", { textContent: "controller: ON" }, root);
        b.onclick = () => { on = !on; b.textContent = "controller: " + (on ? "ON" : "OFF"); };
        const mk = (name, min, max, val, set) => {
          const lab = el("label", {}, root); const span = el("span", { textContent: `${name} ${val}` }, lab);
          const r = el("input", { type: "range", min, max, value: val, step: 1 }, lab);
          r.oninput = () => { set(+r.value); span.textContent = `${name} ${r.value}`; };
        };
        mk("Kp", 5, 80, Kp, (v) => (Kp = v)); mk("Kd", 0, 15, Kd, (v) => (Kd = v));
        el("button", { textContent: "push", onclick: () => push(Math.random() < 0.5 ? -1 : 1) }, root);
        el("button", { textContent: "reset", onclick: reset }, root);
      },
      draw() {
        sim();
        const cx = 330 + x * 100, cy = 330;
        g.strokeStyle = "rgba(0,229,255,.4)"; g.lineWidth = 2; g.beginPath(); g.moveTo(20, cy + 16); g.lineTo(640, cy + 16); g.stroke();
        g.strokeStyle = CYAN; g.lineWidth = 5; g.lineCap = "round"; g.shadowColor = CYAN; g.shadowBlur = 10;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(th) * 180, cy - Math.cos(th) * 180); g.stroke(); g.shadowBlur = 0;
        g.fillStyle = "#05080d"; g.strokeStyle = GREEN; g.lineWidth = 2;
        g.fillRect(cx - 40, cy, 80, 28); g.strokeRect(cx - 40, cy, 80, 28);
        g.fillStyle = AMBER; g.beginPath(); g.arc(cx + Math.sin(th) * 180, cy - Math.cos(th) * 180, 9, 0, 7); g.fill();
        // angle history plot
        g.strokeStyle = "rgba(0,229,255,.3)"; g.lineWidth = 1; g.strokeRect(680, 60, 260, 140);
        g.beginPath(); g.moveTo(680, 130); g.lineTo(940, 130); g.stroke();
        g.strokeStyle = GREEN; g.lineWidth = 2; g.beginPath();
        hist.forEach((v, i) => { const px = 680 + i * 260 / 400, py = 130 - clamp(v, -0.7, 0.7) * 100; i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke();
        txt(["pole angle (rad)"], 686, 54, AMBER);
        txt([`theta ${th.toFixed(3)} rad`, `cart x ${x.toFixed(2)} m`, `controller ${on ? "ON" : "OFF"}`, fallen ? "FELL: resetting" : ""], 680, 230);
      },
    };
  })();

  // ----- RL: tabular Q-learning on the cliff-walking gridworld -----
  const rl = (function () {
    const COLS = 12, ROWS = 5, CS = 56, OX = 20, OY = 60, A = [[0, -1], [1, 0], [0, 1], [-1, 0]], ARROW = ["^", ">", "v", "<"];
    const alpha = 0.5, gamma = 0.95, eps = 0.1;
    let Q, pos, ret, steps, rets, episodes, fast = true;
    const cliff = (x, y) => y === 4 && x > 0 && x < COLS - 1;
    const startEp = () => { pos = { x: 0, y: 4 }; ret = 0; steps = 0; };
    const reset = () => { Q = new Float32Array(COLS * ROWS * 4); rets = []; episodes = 0; startEp(); };
    const best = (s) => { let b = 0; for (let a = 1; a < 4; a++) if (Q[s * 4 + a] > Q[s * 4 + b]) b = a; return b; };
    reset();
    function step() {
      const s = pos.y * COLS + pos.x;
      const a = Math.random() < eps ? Math.floor(Math.random() * 4) : best(s);
      let nx = clamp(pos.x + A[a][0], 0, COLS - 1), ny = clamp(pos.y + A[a][1], 0, ROWS - 1), r = -1, done = false;
      if (cliff(nx, ny)) { r = -100; nx = 0; ny = 4; }
      else if (nx === COLS - 1 && ny === 4) done = true;
      const ns = ny * COLS + nx;
      const target = r + (done ? 0 : gamma * Q[ns * 4 + best(ns)]);
      Q[s * 4 + a] += alpha * (target - Q[s * 4 + a]);
      pos = { x: nx, y: ny }; ret += r; steps++;
      if (done || steps > 200) { rets.push(ret); episodes++; if (rets.length > 300) rets.shift(); startEp(); }
    }
    return {
      ui(root) {
        el("button", { textContent: "reset learning", onclick: reset }, root);
        const b = el("button", { textContent: "speed: fast" }, root);
        b.onclick = () => { fast = !fast; b.textContent = "speed: " + (fast ? "fast" : "slow"); };
      },
      draw() {
        for (let i = 0; i < (fast ? 30 : 2); i++) step();
        g.font = "20px monospace"; g.textAlign = "center";
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
          const px = OX + x * CS, py = OY + y * CS, s = y * COLS + x;
          if (cliff(x, y)) g.fillStyle = "rgba(255,0,85,.35)";
          else { const v = Q[s * 4 + best(s)]; g.fillStyle = `rgba(57,255,136,${clamp((v + 40) / 40, 0, 1) * 0.4})`; }
          g.fillRect(px, py, CS, CS);
          g.strokeStyle = "rgba(0,229,255,.2)"; g.strokeRect(px, py, CS, CS);
          g.fillStyle = CYAN;
          if (!cliff(x, y) && !(x === COLS - 1 && y === 4) && Q[s * 4 + best(s)] !== 0) g.fillText(ARROW[best(s)], px + CS / 2, py + CS / 2 + 7);
          if (x === 0 && y === 4) { g.fillStyle = AMBER; g.fillText("S", px + CS / 2, py + CS / 2 + 7); }
          if (x === COLS - 1 && y === 4) { g.fillStyle = AMBER; g.fillText("G", px + CS / 2, py + CS / 2 + 7); }
        }
        g.textAlign = "left";
        g.fillStyle = CYAN; g.beginPath(); g.arc(OX + pos.x * CS + CS / 2, OY + pos.y * CS + CS / 2, 10, 0, 7); g.fill();
        txt(["red = cliff (-100, back to start). Each step = -1."], OX, 48, AMBER);
        // return curve
        g.strokeStyle = "rgba(0,229,255,.3)"; g.strokeRect(720, 60, 220, 140);
        g.strokeStyle = GREEN; g.lineWidth = 2; g.beginPath();
        rets.forEach((v, i) => { const px = 720 + i * 220 / 300, py = 60 + (clamp(v, -150, 0) / -150) * 140; i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke();
        txt(["episode return (top = 0)"], 720, 54, AMBER);
        txt([`episodes ${episodes}`, `epsilon ${eps}  alpha ${alpha}  gamma ${gamma}`], 720, 230);
      },
    };
  })();

  // ----- VLA: language instruction -> grounded action chunk -> arm executes -----
  const vla = (function () {
    const TY = 395, BS = 40, BASE = { x: 60, y: 390 }, L = 260, HOVER = 280, REST = TY - BS / 2;
    const COL = { red: "#ff4d6d", green: GREEN, blue: "#4da3ff" };
    const DEST = { left: 150, right: 560, bin: 560, box: 560, tray: 150 };
    const home = { x: 300, y: 230 };
    const blocks = [{ c: "red", x: 220 }, { c: "green", x: 340 }, { c: "blue", x: 460 }].map((b) => ({ ...b, y: REST, hx: b.x }));
    let hand = { ...home }, queue = [], plan = [], idx = -1, cur = null, held = null, target = null, wait = 0, info = ['pick an instruction below'];
    function run(s) {
      if (cur || queue.length) { info = ["busy: wait for the current action to finish"]; return; }
      s = s.toLowerCase();
      const color = Object.keys(COL).find((k) => s.includes(k));
      if (!color) { info = [`"${s}"`, "grounding failed: no known object (red / green / blue)"]; return; }
      const dk = Object.keys(DEST).find((k) => s.includes(k)), b = blocks.find((q) => q.c === color), dx = dk ? DEST[dk] : b.x;
      target = b;
      queue = [
        { t: "reach", x: b.x, y: HOVER }, { t: "descend", x: b.x, y: REST }, { t: "grasp" }, { t: "lift", x: b.x, y: HOVER },
        { t: "move", x: dx, y: HOVER }, { t: "lower", x: dx, y: REST }, { t: "release" }, { t: "retreat", x: dx, y: HOVER }, { t: "home", x: home.x, y: home.y },
      ];
      plan = queue.map((q) => q.t); idx = -1;
      info = [`instruction: "${s}"`, `grounded: object=${color}, target=${dk || "same place"}`];
    }
    function update() {
      if (wait > 0) { wait--; return; }
      if (!cur && queue.length) { cur = queue.shift(); idx++; }
      if (!cur) return;
      if (cur.t === "grasp") { held = target; wait = 25; cur = null; return; }
      if (cur.t === "release") { held = null; target.x = hand.x; target.y = REST; wait = 25; cur = null; return; }
      const dx = cur.x - hand.x, dy = cur.y - hand.y, d = Math.hypot(dx, dy);
      if (d < 4) { cur = null; if (!queue.length) idx = -1; return; }
      hand.x += (dx / d) * Math.min(7, d); hand.y += (dy / d) * Math.min(7, d);
    }
    return {
      ui(root) {
        for (const s of ["put the red block in the right bin", "move the blue block to the left tray", "pick up the green block",
          "put the green block in the bin", "move the red block to the left tray", "put the blue block in the right bin"])
          el("button", { textContent: `"${s}"`, onclick: () => run(s) }, root);
      },
      draw() {
        update();
        if (held) { held.x = hand.x; held.y = hand.y; }
        g.fillStyle = "rgba(0,229,255,.18)"; g.fillRect(0, TY, 640, 25);
        g.strokeStyle = AMBER; g.lineWidth = 2; g.strokeRect(DEST.left - 40, TY - 6, 80, 6); g.strokeRect(DEST.right - 40, TY - 6, 80, 6);
        txt(["tray"], DEST.left - 12, TY - 12, AMBER); txt(["bin"], DEST.right - 8, TY - 12, AMBER);
        for (const b of blocks) {
          g.fillStyle = COL[b.c]; g.globalAlpha = 0.85; g.fillRect(b.x - BS / 2, b.y - BS / 2, BS, BS); g.globalAlpha = 1;
        }
        const q = ik2(BASE.x, BASE.y, L, L, hand.x, hand.y, -1);
        g.strokeStyle = CYAN; g.lineWidth = 14; g.lineCap = "round"; g.lineJoin = "round";
        g.beginPath(); g.moveTo(BASE.x, BASE.y); g.lineTo(q.ex, q.ey); g.lineTo(q.hx, q.hy); g.stroke();
        g.fillStyle = "#05080d"; g.strokeStyle = GREEN; g.lineWidth = 2;
        for (const [x, y] of [[BASE.x, BASE.y], [q.ex, q.ey]]) { g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); g.stroke(); }
        g.strokeStyle = AMBER; g.lineWidth = 4;
        const o = held ? BS / 2 + 3 : 12;
        for (const s of [-1, 1]) { g.beginPath(); g.moveTo(q.hx + s * o, q.hy - 18); g.lineTo(q.hx + s * o, q.hy + 18); g.stroke(); }
        // policy readout panel
        g.strokeStyle = "rgba(0,229,255,.3)"; g.lineWidth = 1; g.strokeRect(660, 20, 285, 380);
        txt(["VLA policy (toy)"], 672, 42, AMBER);
        let y = 66;
        for (const s of info) for (const w of wrap(s, 36)) { txt([w], 672, y, CYAN); y += 16; }
        y += 8;
        if (plan.length) { txt(["action chunk:"], 672, y, AMBER); y += 18; }
        plan.forEach((p, i) => { txt([(i === idx ? "> " : "  ") + p], 672, y, i === idx ? GREEN : "#6b7c8c"); y += 16; });
      },
    };
  })();

  const demos = { control, rl, vla };
  let active = "control";
  function select(k) {
    active = k; ctl.innerHTML = ""; demos[k].ui(ctl);
    document.querySelectorAll("[data-lab]").forEach((b) => b.classList.toggle("on", b.dataset.lab === k));
  }
  document.querySelectorAll("[data-lab]").forEach((b) => b.addEventListener("click", () => select(b.dataset.lab)));
  select("control");
  (function frame() {
    g.clearRect(0, 0, W, H);
    demos[active].draw();
    requestAnimationFrame(frame);
  })();
})();

// ---------- robot academy: four learning games for non-robotics visitors ----------
(function () {
  const c = document.getElementById("acadc"), g = c.getContext("2d");
  const W = c.width, H = c.height;
  const ctl = document.getElementById("acadctl");
  const el = (tag, props, parent) => { const e = Object.assign(document.createElement(tag), props); parent.appendChild(e); return e; };
  const say = (s, x, y, col, size, align) => {
    g.fillStyle = col || GREEN; g.font = `${size || 13}px monospace`; g.textAlign = align || "left"; g.fillText(s, x, y); g.textAlign = "left";
  };

  // shared input: pointer (in canvas pixels) and keys pressed while the canvas has focus
  const ptr = { x: W / 2, y: H / 2, down: false }, keys = new Set();
  const toCanvas = (e) => { const r = c.getBoundingClientRect(); ptr.x = (e.clientX - r.left) * (W / r.width); ptr.y = (e.clientY - r.top) * (H / r.height); };
  c.addEventListener("pointerdown", (e) => { toCanvas(e); ptr.down = true; c.focus(); games[active].tap && games[active].tap(); });
  c.addEventListener("pointermove", toCanvas);
  addEventListener("pointerup", () => (ptr.down = false));
  c.addEventListener("keydown", (e) => { if (e.key.startsWith("Arrow") || e.key === " ") e.preventDefault(); keys.add(e.key); games[active].tap && e.key === " " && games[active].tap(); });
  c.addEventListener("keyup", (e) => keys.delete(e.key));
  c.addEventListener("blur", () => keys.clear());

  // ----- 1. balance the stick (feedback control) -----
  const balance = (function () {
    const gr = 9.8, M = 1, m = 0.1, l = 1.0, PX = 80, SLOW = 0.7;
    let x, xd, th, thd, time, state, auto = false;
    const reset = () => { x = 0; xd = 0; th = (Math.random() < 0.5 ? -1 : 1) * 0.05; thd = 0; time = 0; state = "play"; };
    reset();
    return {
      tap() { if (state !== "play") reset(); },
      ui(root) {
        const b = el("button", { textContent: "let the robot try" }, root);
        b.onclick = () => { auto = !auto; b.textContent = auto ? "I'll do it myself" : "let the robot try"; reset(); };
        el("button", { textContent: "restart", onclick: reset }, root);
      },
      draw() {
        if (state === "play") {
          const left = keys.has("ArrowLeft") || (ptr.down && ptr.x < W / 2);
          const right = keys.has("ArrowRight") || (ptr.down && ptr.x >= W / 2);
          const F = auto ? clamp(60 * th + 15 * thd + 1.5 * x + 3 * xd, -30, 30) : (right ? 12 : 0) - (left ? 12 : 0);
          const dt = SLOW / 240;
          for (let i = 0; i < 4; i++) {
            const s = Math.sin(th), co = Math.cos(th), tmp = (F + m * l * thd * thd * s) / (M + m);
            const thdd = (gr * s - co * tmp) / (l * (4 / 3 - m * co * co / (M + m))), xdd = tmp - m * l * thdd * co / (M + m);
            xd += xdd * dt; x += xd * dt; thd += thdd * dt; th += thd * dt;
          }
          time += 1 / 60;
          if (Math.abs(th) > 0.8) state = "fell";
          else if (Math.abs(x) > 5.5) state = "off";
          else if (time >= 10 && !auto) { state = "won"; }
        }
        const cx = W / 2 + x * PX, cy = 330;
        g.strokeStyle = "rgba(0,229,255,.4)"; g.lineWidth = 2; g.beginPath(); g.moveTo(20, cy + 30); g.lineTo(W - 20, cy + 30); g.stroke();
        g.fillStyle = "rgba(0,229,255,.08)"; g.fillRect(0, 0, W / 2, H);
        say("<- push left", 20, H - 12, "#8a9bab"); say("push right ->", W - 20, H - 12, "#8a9bab", 13, "right");
        g.strokeStyle = state === "play" ? CYAN : "#ff4d6d"; g.lineWidth = 6; g.lineCap = "round";
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(th) * 220, cy - Math.cos(th) * 220); g.stroke();
        g.fillStyle = AMBER; g.beginPath(); g.arc(cx + Math.sin(th) * 220, cy - Math.cos(th) * 220, 11, 0, 7); g.fill();
        g.fillStyle = "#05080d"; g.strokeStyle = GREEN; g.lineWidth = 2; g.fillRect(cx - 45, cy, 90, 30); g.strokeRect(cx - 45, cy, 90, 30);
        say(`${Math.min(time, 10).toFixed(1)} / 10 s`, 20, 34, GREEN, 22);
        if (auto) say("robot controller in charge", 20, 58, AMBER);
        const msg = { fell: "It fell! Click or press space to retry.", off: "Ran off the track! Click to retry.", won: "You did it! Well done!" }[state];
        if (msg) say(msg, W / 2, 140, state === "won" ? GREEN : "#ff4d6d", 22, "center");
      },
    };
  })();

  // ----- 2. drive blind with LiDAR (sensing and mapping) -----
  const lidar = (function () {
    const R = 110, N = 60, goal = { x: 900, y: 60 };
    let obs, bot, seen, bumps, reveal = false, state, flash = 0;
    const blocked = (x, y) => x < 4 || y < 4 || x > W - 4 || y > H - 4 ||
      obs.some(([ox, oy, ow, oh]) => x >= ox && x <= ox + ow && y >= oy && y <= oy + oh);
    const hitsBody = (x, y) => { for (let a = 0; a < 6.28; a += 0.8) if (blocked(x + 10 * Math.cos(a), y + 10 * Math.sin(a))) return true; return false; };
    function newMap() {
      obs = [];
      while (obs.length < 9) {
        const w = 40 + Math.random() * 120, h = 40 + Math.random() * 120, x = Math.random() * (W - w), y = Math.random() * (H - h);
        const near = (px, py) => px > x - 50 && px < x + w + 50 && py > y - 50 && py < y + h + 50;
        if (!near(60, 360) && !near(goal.x, goal.y)) obs.push([x, y, w, h]);
      }
      bot = { x: 60, y: 360, th: -0.6 }; seen = []; bumps = 0; state = "play";
    }
    newMap();
    return {
      ui(root) {
        const b = el("button", { textContent: "reveal the real map" }, root);
        b.onclick = () => { reveal = !reveal; b.textContent = reveal ? "hide the map" : "reveal the real map"; };
        el("button", { textContent: "new map", onclick: newMap }, root);
      },
      draw() {
        if (state === "play") {
          let turn = 0, v = 0;
          if (ptr.down) {
            let e = Math.atan2(ptr.y - bot.y, ptr.x - bot.x) - bot.th; e = Math.atan2(Math.sin(e), Math.cos(e));
            turn = clamp(e, -0.07, 0.07); v = Math.abs(e) < 1.2 ? 2.4 : 0;
          }
          if (keys.has("ArrowLeft")) turn = -0.06; if (keys.has("ArrowRight")) turn = 0.06;
          if (keys.has("ArrowUp")) v = 2.4; if (keys.has("ArrowDown")) v = -1.5;
          bot.th += turn;
          const nx = bot.x + v * Math.cos(bot.th), ny = bot.y + v * Math.sin(bot.th);
          if (!hitsBody(nx, ny)) { bot.x = nx; bot.y = ny; } else if (v && !flash) { bumps++; flash = 20; }
          if (Math.hypot(bot.x - goal.x, bot.y - goal.y) < 22) { state = "won"; }
        }
        if (flash) flash--;
        const hits = [];
        for (let i = 0; i < N; i++) {
          const a = (i / N) * 6.283, ca = Math.cos(a), sa = Math.sin(a);
          for (let s = 12; s < R; s += 3) if (blocked(bot.x + ca * s, bot.y + sa * s)) { hits.push([bot.x + ca * s, bot.y + sa * s]); break; }
        }
        for (const p of hits) if (Math.random() < 0.3) seen.push(p);
        if (seen.length > 8000) seen.splice(0, 1000);
        g.fillStyle = flash ? "rgba(255,0,85,.12)" : "rgba(0,0,0,.4)"; g.fillRect(0, 0, W, H);
        if (reveal) { g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 1; for (const [x, y, w, h] of obs) g.strokeRect(x, y, w, h); }
        g.fillStyle = "rgba(0,229,255,.35)"; for (const [x, y] of seen) g.fillRect(x - 1, y - 1, 2, 2);
        g.strokeStyle = "rgba(255,179,0,.15)"; g.lineWidth = 1;
        for (const [x, y] of hits) { g.beginPath(); g.moveTo(bot.x, bot.y); g.lineTo(x, y); g.stroke(); }
        g.fillStyle = AMBER; for (const [x, y] of hits) g.fillRect(x - 2, y - 2, 4, 4);
        g.strokeStyle = GREEN; g.lineWidth = 3; g.beginPath(); g.arc(goal.x, goal.y, 16, 0, 7); g.stroke(); say("goal", goal.x, goal.y + 34, GREEN, 13, "center");
        g.fillStyle = "#05080d"; g.strokeStyle = CYAN; g.lineWidth = 3; g.beginPath(); g.arc(bot.x, bot.y, 10, 0, 7); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(bot.x, bot.y); g.lineTo(bot.x + 15 * Math.cos(bot.th), bot.y + 15 * Math.sin(bot.th)); g.stroke();
        say(`bumps: ${bumps}`, 20, 30, AMBER, 16);
        if (state === "won") say(`Made it with ${bumps} bumps! Well done!`, W / 2, H / 2, GREEN, 22, "center");
      },
    };
  })();

  // ----- 3. reach the target (kinematics) -----
  const reach = (function () {
    const B = { x: W / 2, y: 400 }, L1 = 180, L2 = 150, RAD = Math.PI / 180;
    let a1 = 90, a2 = 0, tgt, t0, state, solving = null, s1, s2, v1, v2;
    const fk = (q1, q2) => {
      const ex = B.x + L1 * Math.cos(q1 * RAD), ey = B.y - L1 * Math.sin(q1 * RAD);
      return { ex, ey, hx: ex + L2 * Math.cos((q1 + q2) * RAD), hy: ey - L2 * Math.sin((q1 + q2) * RAD) };
    };
    function newTarget() {
      const p = fk(25 + Math.random() * 130, -130 + Math.random() * 260);
      tgt = { x: p.hx, y: p.hy }; t0 = performance.now(); state = "play"; solving = null;
    }
    function ikSolve() {
      const x = tgt.x - B.x, y = B.y - tgt.y;
      const c2 = clamp((x * x + y * y - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1);
      const sols = [1, -1].map((s) => {
        const q2 = s * Math.acos(c2), q1 = Math.atan2(y, x) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
        return [q1 / RAD, q2 / RAD];
      }).filter(([q1, q2]) => q1 >= 0 && q1 <= 180 && Math.abs(q2) <= 150);
      sols.sort((p, q) => Math.abs(p[0] - a1) - Math.abs(q[0] - a1));
      if (sols.length) solving = sols[0];
    }
    const sync = () => { if (s1) { s1.value = a1; s2.value = a2; v1.textContent = `joint 1 ${a1.toFixed(0)} deg`; v2.textContent = `joint 2 ${a2.toFixed(0)} deg`; } };
    newTarget();
    return {
      ui(root) {
        const mk = (lab, min, max, val, set) => {
          const l = el("label", {}, root), span = el("span", {}, l);
          const r = el("input", { type: "range", min, max, value: val, step: 1 }, l);
          r.oninput = () => { solving = null; set(+r.value); sync(); };
          return [r, span];
        };
        [s1, v1] = mk("joint 1", 0, 180, a1, (v) => (a1 = v));
        [s2, v2] = mk("joint 2", -150, 150, a2, (v) => (a2 = v));
        sync();
        el("button", { textContent: "solve with IK", onclick: ikSolve }, root);
        el("button", { textContent: "new target", onclick: newTarget }, root);
      },
      draw(t) {
        if (solving) {
          a1 += (solving[0] - a1) * 0.08; a2 += (solving[1] - a2) * 0.08; sync();
          if (Math.abs(solving[0] - a1) < 0.2 && Math.abs(solving[1] - a2) < 0.2) solving = null;
        }
        const p = fk(a1, a2), d = Math.hypot(p.hx - tgt.x, p.hy - tgt.y);
        if (state === "play" && d < 10) { state = "won"; }
        g.strokeStyle = "rgba(0,229,255,.12)"; g.setLineDash([4, 6]); g.beginPath(); g.arc(B.x, B.y, L1 + L2, Math.PI, 0); g.stroke(); g.setLineDash([]);
        const pr = 14 + 3 * Math.sin(t / 150);
        g.strokeStyle = AMBER; g.lineWidth = 2; g.beginPath(); g.arc(tgt.x, tgt.y, pr, 0, 7); g.stroke();
        g.beginPath(); g.moveTo(tgt.x - 22, tgt.y); g.lineTo(tgt.x + 22, tgt.y); g.moveTo(tgt.x, tgt.y - 22); g.lineTo(tgt.x, tgt.y + 22); g.stroke();
        g.strokeStyle = CYAN; g.lineWidth = 14; g.lineCap = "round"; g.shadowColor = CYAN; g.shadowBlur = 12;
        g.beginPath(); g.moveTo(B.x, B.y); g.lineTo(p.ex, p.ey); g.lineTo(p.hx, p.hy); g.stroke(); g.shadowBlur = 0;
        g.fillStyle = "#05080d"; g.strokeStyle = GREEN; g.lineWidth = 2;
        for (const [x, y] of [[B.x, B.y], [p.ex, p.ey]]) { g.beginPath(); g.arc(x, y, 10, 0, 7); g.fill(); g.stroke(); }
        say("joint 1", B.x + 16, B.y - 8, GREEN, 12); say("joint 2", p.ex + 16, p.ey, GREEN, 12);
        const secs = state === "play" ? (performance.now() - t0) / 1000 : null;
        say(`distance to target: ${d.toFixed(0)} px`, 20, 30, AMBER, 16);
        if (secs !== null) say(`time: ${secs.toFixed(1)} s`, 20, 54, GREEN, 16);
        if (state === "won") say("Touched it! Well done! Try 'new target'.", W / 2, 40, GREEN, 20, "center");
      },
    };
  })();

  // ----- 4. train the robot (reinforcement learning) -----
  const train = (function () {
    const COLS = 7, ROWS = 5, CS = 70, OX = (W - COLS * CS) / 2, OY = 30, A = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const walls = new Set(["3,0", "3,1", "3,2", "1,3", "5,3", "5,4"]), START = { x: 0, y: 4 }, GOAL = { x: 6, y: 0 };
    const MAXP = 6; // preference cap: keeps the robot re-teachable after long self-training
    const free = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS && !walls.has(x + "," + y);
    // distance-to-goal for every cell (breadth-first search): the automatic reward function uses it
    const dist = new Map([[GOAL.x + "," + GOAL.y, 0]]), q = [GOAL];
    while (q.length) { const p = q.shift(); for (const [dx, dy] of A) { const k = p.x + dx + "," + (p.y + dy); if (free(p.x + dx, p.y + dy) && !dist.has(k)) { dist.set(k, dist.get(p.x + "," + p.y) + 1); q.push({ x: p.x + dx, y: p.y + dy }); } } }
    // mode: "teach" = visitor gives feedback, "solo" = robot uses what it learned (no learning), "auto" = self-training
    let pref, bot, prop, trips, mode = "teach", recent = [], msg = "", soloMoves = 0, soloTimer = 0, trail = [], btn = {};
    const P = (x, y, a) => pref[(y * COLS + x) * 4 + a];
    const valid = () => [0, 1, 2, 3].filter((a) => free(bot.x + A[a][0], bot.y + A[a][1]));
    const atGoal = () => bot.x === GOAL.x && bot.y === GOAL.y;
    function propose() {
      const acts = valid();
      if (mode === "solo") { prop = acts.reduce((b, a) => (P(bot.x, bot.y, a) > P(bot.x, bot.y, b) ? a : b)); return; }
      const ws = acts.map((a) => Math.exp(P(bot.x, bot.y, a))), sum = ws.reduce((s, w) => s + w, 0);
      let r = Math.random() * sum, i = 0;
      while ((r -= ws[i]) > 0) i++;
      prop = acts[Math.min(i, acts.length - 1)];
    }
    const isGood = () => dist.get(bot.x + A[prop][0] + "," + (bot.y + A[prop][1])) < dist.get(bot.x + "," + bot.y);
    function feedback(good) {
      recent.push(isGood()); if (recent.length > 30) recent.shift();
      const k = (bot.y * COLS + bot.x) * 4 + prop;
      pref[k] = clamp(pref[k] + (good ? 1 : -1), -MAXP, MAXP);
      if (good) {
        bot = { x: bot.x + A[prop][0], y: bot.y + A[prop][1] };
        if (atGoal()) {
          bot = { ...START };
          if (mode === "teach") { trips++; msg = trips === 1 ? "Charged! Now press 'let it try alone' to see what it learned." : `Charged! (${trips} trips) Try 'let it try alone' again.`; }
        }
      }
      propose();
    }
    function setMode(m) {
      mode = m; bot = { ...START }; trail = [{ ...bot }]; soloMoves = 0; soloTimer = 0;
      if (m === "solo") msg = "Trying alone with what it learned...";
      if (m === "auto") msg = "";
      if (m === "teach" && !msg) msg = "";
      btn.good.disabled = btn.bad.disabled = m !== "teach";
      btn.solo.textContent = m === "solo" ? "stop" : "let it try alone";
      btn.auto.textContent = m === "auto" ? "stop self-training" : "let it train itself";
      btn.solo.classList.toggle("on", m === "solo"); btn.auto.classList.toggle("on", m === "auto");
      propose();
    }
    function soloStep() {
      if (++soloTimer < 18) return;
      soloTimer = 0;
      bot = { x: bot.x + A[prop][0], y: bot.y + A[prop][1] }; soloMoves++; trail.push({ ...bot });
      if (atGoal()) { msg = `Made it alone in ${soloMoves} moves! (best possible: ${dist.get(START.x + "," + START.y)})`; setMode("teach"); return; }
      if (soloMoves >= 30) { msg = "It got lost. Teach it some more, or let it train itself."; setMode("teach"); return; }
      propose();
    }
    function reset() { pref = new Float32Array(COLS * ROWS * 4); trips = 0; recent = []; msg = ""; if (btn.good) setMode("teach"); else { bot = { ...START }; propose(); } }
    reset();
    return {
      ui(root) {
        btn.good = el("button", { textContent: "good robot", onclick: () => feedback(true) }, root);
        btn.bad = el("button", { textContent: "bad robot", onclick: () => feedback(false) }, root);
        btn.solo = el("button", { onclick: () => setMode(mode === "solo" ? "teach" : "solo") }, root);
        btn.auto = el("button", { onclick: () => setMode(mode === "auto" ? "teach" : "auto") }, root);
        el("button", { textContent: "forget everything", onclick: reset }, root);
        setMode(mode === "solo" ? "teach" : mode);
      },
      draw() {
        if (mode === "auto") for (let i = 0; i < 3; i++) feedback(isGood());
        if (mode === "solo") soloStep();
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
          const px = OX + x * CS, py = OY + y * CS;
          if (walls.has(x + "," + y)) { g.fillStyle = "#26384a"; g.fillRect(px, py, CS, CS); continue; }
          g.strokeStyle = "rgba(0,229,255,.2)"; g.lineWidth = 1; g.strokeRect(px, py, CS, CS);
          // what the robot has learned: arrow toward its favourite move, brighter = more confident
          let b = 0; for (let a = 1; a < 4; a++) if (P(x, y, a) > P(x, y, b)) b = a;
          const conf = clamp(P(x, y, b) / MAXP, 0, 1);
          if (conf > 0) {
            g.strokeStyle = `rgba(57,255,136,${0.2 + 0.6 * conf})`; g.lineWidth = 3;
            const cx = px + CS / 2, cy = py + CS / 2;
            g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + A[b][0] * 22, cy + A[b][1] * 22); g.stroke();
          }
        }
        if (mode === "solo" && trail.length > 1) {
          g.strokeStyle = "rgba(0,229,255,.6)"; g.lineWidth = 4; g.beginPath();
          trail.forEach((p, i) => { const x = OX + p.x * CS + CS / 2, y = OY + p.y * CS + CS / 2; i ? g.lineTo(x, y) : g.moveTo(x, y); });
          g.stroke();
        }
        const gx = OX + GOAL.x * CS + CS / 2, gy = OY + GOAL.y * CS + CS / 2;
        g.strokeStyle = GREEN; g.lineWidth = 3; g.strokeRect(gx - 12, gy - 18, 24, 36); g.fillStyle = GREEN; g.fillRect(gx - 5, gy - 24, 10, 6); g.fillRect(gx - 8, gy - 4, 16, 18);
        const bx = OX + bot.x * CS + CS / 2, by = OY + bot.y * CS + CS / 2;
        g.strokeStyle = AMBER; g.setLineDash([6, 5]); g.lineWidth = 3;
        g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + A[prop][0] * CS * 0.8, by + A[prop][1] * CS * 0.8); g.stroke(); g.setLineDash([]);
        g.fillStyle = "#05080d"; g.strokeStyle = CYAN; g.lineWidth = 3; g.beginPath(); g.arc(bx, by, 18, 0, 7); g.fill(); g.stroke();
        g.fillStyle = CYAN; g.fillRect(bx - 8, by - 5, 4, 4); g.fillRect(bx + 4, by - 5, 4, 4);
        const acc = recent.length ? Math.round((100 * recent.filter(Boolean).length) / recent.length) : 0;
        say(`smart moves (last 30): ${acc}%`, 20, H - 40, AMBER, 15);
        say(mode === "auto" ? "training itself with a reward function..." : msg || "teach me the way to my battery", 20, H - 16, GREEN, 15);
      },
    };
  })();

  // ----- grasping: parallel gripper vs 5-finger dexterous hand -----
  const grasp = (function () {
    const TABLE = 385;
    const SHAPES = {
      box: { rx: 35, ry: 35, round: false, fragile: false, col: AMBER },
      ball: { rx: 34, ry: 34, round: true, fragile: false, col: "#4da3ff" },
      egg: { rx: 24, ry: 32, round: true, fragile: true, col: "#f3ead8" },
    };
    // grip-force window [min, max]: below min the object slips, above max a fragile object breaks
    const NEED = { parallel: { box: [3, 10], ball: [6, 10], egg: [2, 4] }, hand: { box: [2, 10], ball: [2, 10], egg: [1, 6] } };
    const SEG = [34, 28, 22], FOFF = [-6, -2, 2, 6];
    let mode = "parallel", kind = "box", force = 5, obj, hand = { x: 250, y: 150 }, open = 150, curl = [0, 0, 0, 0, 0];
    let held = false, judged = false, offY = 0, msg = "", broken = 0, liftedNow = false;
    const done = { parallel: false, hand: false };
    const S = () => SHAPES[kind];
    const inside = (px, py) => { const dx = (px - obj.x) / S().rx, dy = (py - obj.y) / S().ry; return S().round ? dx * dx + dy * dy <= 1 : Math.abs(dx) <= 1 && Math.abs(dy) <= 1; };
    const newObj = () => { obj = { x: 620, y: TABLE - S().ry, vy: 0 }; held = false; judged = false; broken = 0; liftedNow = false; };
    newObj();

    // finger joint points for the dexterous hand (side view: thumb on the left, 4 fingers on the right)
    function finger(i) {
      const thumb = i === 4, side = thumb ? -1 : 1;
      const p = [{ x: hand.x + (thumb ? -38 : 38 + FOFF[i]), y: hand.y }];
      for (let k = 0; k < 3; k++) {
        const a = Math.PI / 2 - side * 0.25 + side * curl[i] * (k + 1) * 0.7;
        p.push({ x: p[k].x + SEG[k] * Math.cos(a), y: p[k].y + SEG[k] * Math.sin(a) });
      }
      return p;
    }
    const touching = (p) => { for (let k = 0; k < 3; k++) for (let s = 0.34; s <= 1; s += 0.33) if (inside(p[k].x + (p[k + 1].x - p[k].x) * s, p[k].y + (p[k + 1].y - p[k].y) * s)) return true; return false; };

    function update() {
      hand.x += (clamp(ptr.x, 100, 860) - hand.x) * 0.25;
      hand.y += (clamp(ptr.y, 60, TABLE - 75) - hand.y) * 0.25;
      let contact = false;
      const closing = ptr.down && !broken;
      if (mode === "parallel") {
        if (closing) {
          const dy = hand.y + 45 - obj.y, s = S();
          let cw = null;
          if (Math.abs(dy) < s.ry) cw = s.round ? 2 * s.rx * Math.sqrt(1 - (dy / s.ry) ** 2) : 2 * s.rx;
          if (cw !== null && (held || Math.abs(obj.x - hand.x) < open / 2) && open <= cw + 6) { open = cw; contact = true; if (!held) obj.x = hand.x; }
          else open = Math.max(cw !== null && Math.abs(obj.x - hand.x) < open / 2 ? cw : 4, open - 6);
        } else open = Math.min(150, open + 8);
      } else {
        let n = 0, thumb = false;
        for (let i = 0; i < 5; i++) {
          if (!closing) { curl[i] = Math.max(0, curl[i] - 0.06); continue; }
          // curl until the next small step would push into the object
          curl[i] += 0.035;
          const blocked = touching(finger(i));
          curl[i] -= 0.035;
          if (blocked) { if (i === 4) thumb = true; else n++; }
          else if (curl[i] < 1.25) curl[i] += 0.035;
        }
        contact = closing && thumb && n >= 2;
      }

      if (contact && !judged) {
        judged = true;
        const [mn, mx] = NEED[mode][kind], s = S();
        const offCentre = mode === "parallel" && s.round && Math.abs(hand.y + 45 - obj.y) > 0.45 * s.ry;
        if (s.fragile && force > mx) { broken = 90; msg = "Crack! Too much force for an egg."; }
        else if (offCentre) msg = "Slipped! A flat gripper must grab round things around the middle.";
        else if (force < mn) msg = "Slipping! Not enough grip force for this object.";
        else { held = true; offY = obj.y - hand.y; msg = "Got it. Now lift it up!"; }
      }
      if (!closing) { held = false; judged = false; liftedNow = false; }
      if (held) {
        obj.x = hand.x; obj.y = Math.min(hand.y + offY, TABLE - S().ry);
        if (!liftedNow && obj.y + S().ry < TABLE - 110) {
          liftedNow = true; done[mode] = true;
          msg = `Lifted the ${kind} with the ${mode === "parallel" ? "parallel gripper" : "5-finger hand"}!`;
        }
      } else {
        obj.vy += 0.6; obj.y = Math.min(obj.y + obj.vy, TABLE - S().ry);
        if (obj.y >= TABLE - S().ry) obj.vy = 0;
      }
      if (broken && --broken === 0) { newObj(); msg = "New egg. Try a gentler grip."; }
    }

    function drawObj() {
      const s = S();
      g.fillStyle = s.col; g.strokeStyle = "#05080d"; g.lineWidth = 2;
      if (s.round) { g.beginPath(); g.ellipse(obj.x, obj.y, s.rx, s.ry, 0, 0, 7); g.fill(); }
      else g.fillRect(obj.x - s.rx, obj.y - s.ry, 2 * s.rx, 2 * s.ry);
      if (broken) {
        g.beginPath(); g.moveTo(obj.x - s.rx, obj.y); for (let k = 1; k <= 6; k++) g.lineTo(obj.x - s.rx + (k * 2 * s.rx) / 6, obj.y + (k % 2 ? -7 : 7)); g.stroke();
        g.fillStyle = AMBER; g.beginPath(); g.ellipse(obj.x, TABLE - 3, 34, 5, 0, 0, 7); g.fill();
      }
    }

    return {
      ui(root) {
        const modes = [["parallel", "parallel gripper"], ["hand", "5-finger hand"]].map(([k, t]) => {
          const b = el("button", { textContent: t, className: k === mode ? "on" : "" }, root);
          b.onclick = () => { mode = k; modes.forEach((x) => x.classList.toggle("on", x === b)); newObj(); msg = ""; };
          return b;
        });
        const objs = ["box", "ball", "egg"].map((k) => {
          const b = el("button", { textContent: k, className: k === kind ? "on" : "" }, root);
          b.onclick = () => { kind = k; objs.forEach((x) => x.classList.toggle("on", x === b)); newObj(); msg = ""; };
          return b;
        });
        const l = el("label", {}, root), span = el("span", { textContent: `grip force ${force}` }, l);
        const r = el("input", { type: "range", min: 1, max: 10, value: force, step: 1 }, l);
        r.oninput = () => { force = +r.value; span.textContent = `grip force ${force}`; };
      },
      draw() {
        update();
        g.fillStyle = "rgba(0,229,255,.15)"; g.fillRect(0, TABLE, W, H - TABLE);
        g.strokeStyle = "rgba(0,229,255,.5)"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, TABLE); g.lineTo(W, TABLE); g.stroke();
        drawObj();
        g.strokeStyle = "rgba(0,229,255,.5)"; g.lineWidth = 8; g.lineCap = "round";
        g.beginPath(); g.moveTo(hand.x, 0); g.lineTo(hand.x, hand.y - 24); g.stroke();
        if (mode === "parallel") {
          g.fillStyle = "#0e2230"; g.strokeStyle = CYAN; g.lineWidth = 2;
          g.fillRect(hand.x - 95, hand.y - 22, 190, 22); g.strokeRect(hand.x - 95, hand.y - 22, 190, 22);
          g.fillStyle = CYAN; g.shadowColor = CYAN; g.shadowBlur = 10;
          g.fillRect(hand.x - open / 2 - 12, hand.y, 12, 75); g.fillRect(hand.x + open / 2, hand.y, 12, 75); g.shadowBlur = 0;
        } else {
          g.fillStyle = "#0e2230"; g.strokeStyle = CYAN; g.lineWidth = 2;
          g.fillRect(hand.x - 52, hand.y - 30, 104, 30); g.strokeRect(hand.x - 52, hand.y - 30, 104, 30);
          for (let i = 0; i < 5; i++) {
            const p = finger(i);
            g.strokeStyle = i === 4 ? CYAN : `rgba(0,229,255,${0.45 + i * 0.15})`; g.lineWidth = i === 4 ? 11 : 8; g.lineJoin = "round";
            g.beginPath(); p.forEach((q, k) => (k ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.stroke();
            g.fillStyle = GREEN; for (const q of p.slice(1, 3)) { g.beginPath(); g.arc(q.x, q.y, 3, 0, 7); g.fill(); }
          }
          say("thumb", hand.x - 90, hand.y - 8, "#8a9bab", 11); say("4 fingers", hand.x + 58, hand.y - 8, "#8a9bab", 11);
        }
        say(`grip force: ${force}/10`, 20, 30, AMBER, 16);
        g.fillStyle = "rgba(255,179,0,.2)"; g.fillRect(20, 40, 150, 8); g.fillStyle = AMBER; g.fillRect(20, 40, 15 * force, 8);
        say(`parallel gripper ${done.parallel ? "[done]" : "[ ]"}   5-finger hand ${done.hand ? "[done]" : "[ ]"}`, W - 20, 30, GREEN, 14, "right");
        if (msg) say(msg, W / 2, 80, msg.startsWith("Lifted") || msg.startsWith("Got") ? GREEN : "#ff4d6d", 18, "center");
      },
    };
  })();

  const games = { grasp, balance, lidar, reach, train };
  let active = "balance";
  function select(k) {
    active = k; ctl.innerHTML = ""; games[k].ui(ctl);
    document.querySelectorAll("[data-game]").forEach((b) => b.classList.toggle("on", b.dataset.game === k));
  }
  document.querySelectorAll("[data-game]").forEach((b) => b.addEventListener("click", () => select(b.dataset.game)));
  select("grasp");
  (function frame(t) {
    g.clearRect(0, 0, W, H);
    games[active].draw(t);
    requestAnimationFrame(frame);
  })(0);
})();

// ---------- "what I do at work": topic tabs -> demo cards -> one shared stage ----------
// To add a demo: add an entry to a topic's items (id = "<panel>:<sub-demo key>"), plus its panel/code.
// To add a topic: add another object to TOPICS.
(function () {
  const TOPICS = [
    {
      name: "Perception",
      summary: "Turning camera and sensor data into objects, depth and meaning.",
      items: [
        {
          id: "percep:", title: "What the robot sees", sub: "Detection, depth & segmentation",
          instr: "Drag the objects. Switch the view. Dim the lights.",
          how: "Perception turns raw camera pixels into understanding: which objects are there (detection boxes), exactly which pixels belong to each one (segmentation) and how far away they are (depth). Confidence drops in bad light or when objects hide behind each other, which is why robots combine several sensors: a depth camera works even in the dark. The grasp points show how perception feeds grasping. I build perception like this for real robots.",
        },
      ],
    },
    {
      name: "Grasping & manipulation",
      summary: "Grasping with parallel grippers and dexterous hands, dual-arm manipulation and VLA models.",
      items: [
        {
          id: "game:grasp", title: "Grasp it", sub: "Parallel grippers & 5-finger hands",
          instr: "Hold the mouse to close the hand, move up to lift. Try both hands and all three objects.",
          how: "Grasping looks easy for people but is one of the hardest problems in robotics. A parallel gripper is simple, strong and precise, but round things slip unless you grab them around the middle. A 5-finger dexterous hand wraps around almost any shape and spreads the force (gentler on an egg), but has 20+ joints to coordinate. Deciding where to grab and how hard to squeeze is grasp planning and force control: my day job, on real parallel grippers and dexterous hands.",
        },
        {
          id: "game:reach", title: "Reach the target", sub: "Inverse kinematics",
          instr: "Turn the two joint sliders until the gripper touches the target. Then press 'solve with IK'.",
          how: "Finding the joint angles that put the hand at a point is inverse kinematics (IK). You solved it by trial and error; a robot solves it with geometry in a fraction of a millisecond. Real arms have 6 or 7 joints and humanoids 30+, so IK runs behind every reach, grasp and step. I work on kinematics and motion planning for dual-arm manipulators and humanoids.",
        },
        {
          id: "robot:dual", title: "Dual-arm manipulator", sub: "Two arms, one object",
          instr: "Move your cursor: both arms carry the box together.",
          how: "Two arms must move in sync so they don't drop or crush what they hold. Each arm solves its own inverse kinematics, but both share one goal: where the object should be. Dual-arm robots can handle big, heavy or floppy things a single arm can't. I develop software for dual-arm manipulators.",
        },
        {
          id: "lab:vla", title: "Language to action", sub: "VLA models",
          instr: "Pick an instruction. The arm carries it out.",
          how: "A vision-language-action (VLA) model reads an instruction, looks at the scene and outputs robot actions, step by step (the action list on the right). In this demo a simple keyword matcher stands in for the model; the arm motion and pick-and-place steps are real. I work on VLA models that turn instructions like these into real robot behaviour.",
        },
      ],
    },
    {
      name: "Mobile robots",
      summary: "Navigation for AMRs: LiDAR sensing, mapping, path planning and obstacle avoidance.",
      items: [
        {
          id: "game:lidar", title: "Drive blind", sub: "LiDAR sensing & mapping",
          instr: "Hold the mouse where you want to go (or use the arrow keys). Reach the green goal.",
          how: "Robots don't 'see' a map, they measure it. A LiDAR spins a laser and measures the distance to whatever it hits: the orange dots. The dots you collect become a map. Building a map while working out where you are on it is called SLAM. It is how warehouse robots, robot vacuums and self-driving cars find their way. I build navigation software for AMRs that works like this.",
        },
        {
          id: "robot:amr", title: "Obstacle avoidance", sub: "AMR navigation",
          instr: "Click anywhere to give the robot a new goal.",
          how: "The robot scans around itself with a 360-degree LiDAR. Close obstacles push it away while the goal pulls it forward, so it steers around things without a map. Real AMRs combine this reactive layer with maps and path planners. I build AMR navigation: sensing, localization and obstacle avoidance.",
        },
        {
          id: "astar:", title: "Path planning", sub: "A*, Dijkstra, RRT",
          instr: "Pick an algorithm. Drag S and G, draw walls, then try 'race all 4' and 'drive robot'.",
          how: "A* searches toward the goal using a guess of the remaining distance, so it finds the shortest path while checking few squares. Dijkstra spreads out evenly like a ripple: always shortest, but slow. Greedy rushes straight at the goal: fast, but often not shortest. RRT grows random branches and works without a grid, which scales to arms with many joints; its wobbly path is smoothed afterwards. Draw walls in front of the driving robot and it replans. I write planners like these for mobile robots and robot arms.",
        },
      ],
    },
    {
      name: "Humanoids & control",
      summary: "Controllers and motion that keep humanoids and robot arms balanced and smooth.",
      items: [
        {
          id: "game:balance", title: "Balance the stick", sub: "Feedback control",
          instr: "Arrow keys (click the canvas first), or hold the left/right side. Survive 10 seconds.",
          how: "That is feedback control: measure the angle, push the cart under the falling stick. A robot does it hundreds of times per second with a controller. Press 'let the robot try' to see one. The same idea keeps humanoids, drones and self-balancing scooters upright. I write controllers like this for humanoids and dual-arm manipulators.",
        },
        {
          id: "lab:control", title: "Tune a controller", sub: "PD control",
          instr: "Change the gains, push the pole, or switch the controller off.",
          how: "A PD controller pushes the cart in proportion to the tilt (Kp) and to how fast the tilt is changing (Kd). Too little Kp and it falls; too little Kd and it wobbles. The plot shows the angle over time. Tuning controllers with control theory is daily work on real robots.",
        },
        {
          id: "robot:humanoid", title: "Humanoid walking", sub: "Gait & balance",
          instr: "Move your cursor right or left of centre to walk. The head follows you.",
          how: "Each foot follows a planned stepping path, and inverse kinematics turns it into hip and knee angles. Real humanoids add balance control on top, adjusting every step so they don't fall. I work on humanoid robots: walking, balance and whole-body motion.",
        },
      ],
    },
    {
      name: "Robot learning",
      summary: "Reinforcement learning in MuJoCo simulation to teach robots new skills.",
      items: [
        {
          id: "game:train", title: "Train the robot", sub: "Learning from rewards",
          instr: "Teach it the way with 'good robot' / 'bad robot'. Then press 'let it try alone'.",
          how: "You are the reward signal. That is reinforcement learning (RL): the robot tries things, gets rewarded or punished, and slowly prefers what worked. 'Let it try alone' shows what it learned from you: no more help, just its own choices. 'Let it train itself' replaces you with a reward function (+1 for getting closer to the battery) so it can practise on its own, far faster than any human could teach it. I use RL in MuJoCo simulation to teach robots skills such as grasping and walking.",
        },
        {
          id: "lab:rl", title: "Q-learning", sub: "Reinforcement learning",
          instr: "Watch it learn. Red squares are a cliff.",
          how: "Q-learning tries moves, gets rewards (-1 per step, -100 for falling off the cliff) and remembers how good each move is in each square. Shading shows how good a square is; arrows show the best move. The curve on the right rises as it learns. I use reinforcement learning, trained in MuJoCo simulation, to teach robots new skills.",
        },
      ],
    },
  ];
  const SUB = { game: "data-game", robot: "data-robot", lab: "data-lab" };
  const el = (tag, props, parent) => { const e = Object.assign(document.createElement(tag), props); parent.appendChild(e); return e; };
  const tabs = document.getElementById("topics"), sum = document.getElementById("topicsum"), row = document.getElementById("cardsrow");
  const title = document.getElementById("stitle"), instr = document.getElementById("sinstr"), how = document.getElementById("show");

  function showItem(it) {
    const [panel, key] = it.id.split(":");
    document.querySelectorAll("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== panel));
    if (SUB[panel]) document.querySelector(`[${SUB[panel]}="${key}"]`).click();
    row.querySelectorAll(".wcard").forEach((b) => b.classList.toggle("on", b.dataset.item === it.id));
    title.textContent = it.title; instr.textContent = it.instr; how.textContent = it.how;
  }
  function showTopic(t) {
    tabs.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.textContent === t.name));
    sum.textContent = t.summary;
    row.innerHTML = "";
    for (const it of t.items) {
      const b = el("button", { className: "wcard" }, row);
      b.dataset.item = it.id;
      el("b", { textContent: it.title }, b); el("span", { textContent: it.sub }, b);
      b.onclick = () => showItem(it);
    }
    showItem(t.items[0]);
  }
  for (const t of TOPICS) el("button", { textContent: t.name, role: "tab", onclick: () => showTopic(t) }, tabs);
  addEventListener("open-demo", (e) => {
    for (const t of TOPICS) { const it = t.items.find((i) => i.id === e.detail); if (it) { showTopic(t); showItem(it); } }
  });
  showTopic(TOPICS[0]);
})();

// ---------- path planning: A* / Dijkstra / Greedy / RRT, race mode, robot that replans ----------
(function () {
  const c = document.getElementById("grid"), g = c.getContext("2d");
  const COLS = 48, ROWS = 24, S = c.width / COLS; // 20 px cells
  const speedEl = document.getElementById("speed");
  const NAMES = { astar: "A*", dijkstra: "Dijkstra", greedy: "Greedy", rrt: "RRT" };
  const idx = (x, y) => y * COLS + x;
  let wall = new Uint8Array(COLS * ROWS), start = { x: 3, y: 12 }, goal = { x: COLS - 4, y: 12 };
  let algo = "astar", runs = [], race = false, order = [], robot = null, msg = "", drag = null, paintVal = 0;

  const isWall = (px, py) => { const x = Math.floor(px / S), y = Math.floor(py / S); return x < 0 || y < 0 || x >= COLS || y >= ROWS || wall[idx(x, y)] === 1; };
  // straight segment free of walls, with a safety margin m so the robot does not clip corners
  function segFree(a, b, m = 5) {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3));
    for (let k = 0; k <= n; k++) {
      const x = a.x + ((b.x - a.x) * k) / n, y = a.y + ((b.y - a.y) * k) / n;
      if (isWall(x - m, y - m) || isWall(x + m, y - m) || isWall(x - m, y + m) || isWall(x + m, y + m)) return false;
    }
    return true;
  }
  const center = (p) => ({ x: (p.x + 0.5) * S, y: (p.y + 0.5) * S });
  const pathLen = (p) => p.reduce((s, q, i) => (i ? s + Math.hypot(q.x - p[i - 1].x, q.y - p[i - 1].y) : 0), 0) / S;

  // A*, Dijkstra and Greedy are the same best-first search with different priorities
  function* gridSearch(kind, src, run) {
    const wg = kind === "greedy" ? 0 : 1, wh = kind === "dijkstra" ? 0 : 1;
    const h = (x, y) => Math.hypot(x - goal.x, y - goal.y);
    const gS = new Map([[idx(src.x, src.y), 0]]), came = new Map(), open = [{ x: src.x, y: src.y, f: 0 }];
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const n = open.splice(bi, 1)[0], ni = idx(n.x, n.y);
      if (run.explored.has(ni)) continue;
      run.explored.set(ni, gS.get(ni)); run.frontier.delete(ni);
      if (n.x === goal.x && n.y === goal.y) {
        const p = [center(n)];
        let k = ni;
        while (came.has(k)) { k = came.get(k); p.push(center({ x: k % COLS, y: Math.floor(k / COLS) })); }
        return p.reverse();
      }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = n.x + dx, y = n.y + dy;
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS || wall[idx(x, y)]) continue;
        if (dx && dy && (wall[idx(n.x + dx, n.y)] || wall[idx(n.x, n.y + dy)])) continue; // no corner cutting
        const gi = idx(x, y), ng = gS.get(ni) + Math.hypot(dx, dy);
        if (ng < (gS.get(gi) ?? Infinity)) {
          gS.set(gi, ng); came.set(gi, ni);
          open.push({ x, y, f: wg * ng + wh * h(x, y) }); run.frontier.add(gi);
        }
      }
      yield;
    }
    return null;
  }

  function* rrt(src, run) {
    const a = center(src), b = center(goal), nodes = [{ ...a, p: -1 }];
    for (let it = 0; it < 8000; it++) {
      const q = Math.random() < 0.1 ? b : { x: Math.random() * c.width, y: Math.random() * c.height };
      let ni = 0, nd = Infinity;
      nodes.forEach((n, i) => { const d = Math.hypot(n.x - q.x, n.y - q.y); if (d < nd) { nd = d; ni = i; } });
      if (nd < 1) continue;
      const n = nodes[ni], st = Math.min(22, nd);
      const nw = { x: n.x + ((q.x - n.x) / nd) * st, y: n.y + ((q.y - n.y) / nd) * st, p: ni };
      if (!segFree(n, nw, 3)) { yield; continue; }
      nodes.push(nw); run.edges.push([n, nw]);
      if (Math.hypot(nw.x - b.x, nw.y - b.y) < 30 && segFree(nw, b, 3)) {
        const p = [b];
        for (let k = nodes.length - 1; k >= 0; k = nodes[k].p) p.push(nodes[k]);
        return p.reverse();
      }
      yield;
    }
    return null;
  }

  // shortcut smoothing: from each point jump to the farthest point still in straight-line sight
  function smooth(p) {
    if (!p || p.length < 3) return p;
    const out = [p[0]];
    for (let i = 0; i < p.length - 1;) {
      let j = p.length - 1;
      while (j > i + 1 && !segFree(p[i], p[j])) j--;
      out.push(p[j]); i = j;
    }
    return out;
  }

  function makeRun(kind, src) {
    const run = { kind, explored: new Map(), frontier: new Set(), edges: [], path: null, smooth: null, done: false };
    run.gen = kind === "rrt" ? rrt(src, run) : gridSearch(kind, src, run);
    return run;
  }
  function advance(run, n) {
    for (let k = 0; k < n && !run.done; k++) {
      const r = run.gen.next();
      if (r.done) { run.done = true; run.path = r.value; run.smooth = smooth(r.value); }
    }
  }
  const explored = (r) => (r.kind === "rrt" ? r.edges.length : r.explored.size);

  function plan(k) {
    algo = k; race = false; robot = null; msg = ""; runs = [makeRun(algo, start)];
    document.querySelectorAll("[data-algo]").forEach((b) => b.classList.toggle("on", b.dataset.algo === algo));
  }
  function startRace() {
    race = true; robot = null; msg = ""; order = [];
    runs = Object.keys(NAMES).map((k) => makeRun(k, start));
    document.querySelectorAll("[data-algo]").forEach((b) => b.classList.remove("on"));
  }
  function drive() {
    if (race || !runs.length) plan(algo);
    const run = runs[0];
    advance(run, 1e7);
    if (!run.path) { msg = "no path to drive"; return; }
    const p = run.smooth;
    robot = { x: p[0].x, y: p[0].y, th: Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x), path: p, i: 1, blocked: false };
    msg = "driving...";
  }
  // after an edit: replan instantly (and from the robot's position if it is driving)
  function edited() {
    if (race) { race = false; runs = []; plan(algo); return; }
    if (robot && !robot.done) {
      const rest = [{ x: robot.x, y: robot.y }, ...robot.path.slice(robot.i)];
      let ok = !robot.blocked;
      for (let k = 1; ok && k < rest.length; k++) if (!segFree(rest[k - 1], rest[k], 4)) ok = false;
      if (ok) return;
      const run = makeRun(algo, { x: Math.floor(robot.x / S), y: Math.floor(robot.y / S) });
      advance(run, 1e7); runs = [run];
      if (run.path) { robot.path = run.smooth; robot.i = 1; robot.blocked = false; msg = "obstacle on the path: replanned!"; }
      else { robot.blocked = true; msg = "no way through: robot waiting"; }
      return;
    }
    robot = null;
    if (runs.length && runs[0].done) { runs = [makeRun(algo, start)]; advance(runs[0], 1e7); msg = ""; }
  }

  function updateRobot() {
    if (!robot || robot.blocked || robot.done) return;
    const t = robot.path[robot.i];
    if (!t) { robot.done = true; msg = "goal reached!"; return; }
    const dx = t.x - robot.x, dy = t.y - robot.y, d = Math.hypot(dx, dy);
    let e = Math.atan2(dy, dx) - robot.th;
    e = Math.atan2(Math.sin(e), Math.cos(e));
    robot.th += Math.max(-0.15, Math.min(0.15, e));
    const v = Math.min(2.4, d) * Math.max(0.15, Math.cos(e));
    robot.x += v * Math.cos(robot.th); robot.y += v * Math.sin(robot.th);
    if (d < 4) robot.i++;
  }

  // ---- drawing ----
  function drawWorld() {
    g.strokeStyle = "rgba(0,229,255,.06)"; g.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) { g.beginPath(); g.moveTo(x * S, 0); g.lineTo(x * S, c.height); g.stroke(); }
    for (let y = 0; y <= ROWS; y++) { g.beginPath(); g.moveTo(0, y * S); g.lineTo(c.width, y * S); g.stroke(); }
    g.fillStyle = "#2a3f55"; g.strokeStyle = "rgba(0,229,255,.35)";
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (wall[idx(x, y)]) { g.fillRect(x * S, y * S, S, S); g.strokeRect(x * S + 0.5, y * S + 0.5, S - 1, S - 1); }
    for (const [p, col, t] of [[start, GREEN, "S"], [goal, AMBER, "G"]]) {
      const q = center(p);
      g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 12;
      g.beginPath(); g.arc(q.x, q.y, S * 0.55, 0, 7); g.fill(); g.shadowBlur = 0;
      g.fillStyle = "#05080d"; g.font = "bold 13px monospace"; g.textAlign = "center"; g.fillText(t, q.x, q.y + 5); g.textAlign = "left";
    }
  }
  function drawRun(run) {
    let maxG = 1;
    for (const v of run.explored.values()) if (v > maxG) maxG = v;
    for (const [i, v] of run.explored) {
      g.fillStyle = `hsla(${185 + 95 * (v / maxG)},100%,55%,.28)`;
      g.fillRect((i % COLS) * S, Math.floor(i / COLS) * S, S, S);
    }
    g.fillStyle = "rgba(255,179,0,.8)";
    for (const i of run.frontier) g.fillRect((i % COLS) * S + S / 2 - 3, Math.floor(i / COLS) * S + S / 2 - 3, 6, 6);
    if (run.edges.length) {
      g.strokeStyle = "rgba(0,229,255,.5)"; g.lineWidth = 1; g.beginPath();
      for (const [a, b] of run.edges) { g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); }
      g.stroke();
    }
    drawWorld();
    if (run.path) {
      const line = (p) => { g.beginPath(); p.forEach((q, k) => (k ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.stroke(); };
      g.strokeStyle = "rgba(57,255,136,.35)"; g.lineWidth = 2; g.setLineDash([5, 5]); line(run.path); g.setLineDash([]);
      g.strokeStyle = GREEN; g.lineWidth = 4; g.shadowColor = GREEN; g.shadowBlur = 14; line(run.smooth); g.shadowBlur = 0;
    }
  }
  function drawRobot() {
    if (!robot) return;
    const grad = g.createRadialGradient(robot.x, robot.y, 0, robot.x, robot.y, 80);
    grad.addColorStop(0, "rgba(0,229,255,.3)"); grad.addColorStop(1, "rgba(0,229,255,0)");
    g.fillStyle = grad; g.beginPath(); g.moveTo(robot.x, robot.y); g.arc(robot.x, robot.y, 80, robot.th - 0.6, robot.th + 0.6); g.closePath(); g.fill();
    g.fillStyle = "#05080d"; g.strokeStyle = CYAN; g.lineWidth = 3;
    g.beginPath(); g.arc(robot.x, robot.y, 9, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = AMBER; g.beginPath(); g.moveTo(robot.x, robot.y); g.lineTo(robot.x + 13 * Math.cos(robot.th), robot.y + 13 * Math.sin(robot.th)); g.stroke();
  }
  function label(s, x, y, col) {
    g.font = "bold 14px monospace"; const w = g.measureText(s).width;
    g.fillStyle = "rgba(5,8,13,.85)"; g.fillRect(x - 6, y - 16, w + 12, 22);
    g.fillStyle = col; g.fillText(s, x, y);
  }
  const summary = (r) => `${NAMES[r.kind]}: explored ${explored(r)}` + (r.done ? (r.path ? ` | path ${pathLen(r.path).toFixed(1)} squares` : " | no path") : " | searching...");

  (function frame() {
    const sp = +speedEl.value;
    for (const r of runs) if (!r.done) { advance(r, sp); if (r.done && race) order.push(r.kind); }
    updateRobot();
    g.clearRect(0, 0, c.width, c.height);
    if (race) {
      runs.forEach((r, k) => {
        const ox = (k % 2) * c.width / 2, oy = Math.floor(k / 2) * c.height / 2;
        g.save(); g.translate(ox, oy); g.scale(0.5, 0.5); drawRun(r); g.restore();
        const rank = order.indexOf(r.kind);
        label(`${rank >= 0 ? "#" + (rank + 1) + " " : ""}${summary(r)}`, ox + 10, oy + 24, rank === 0 ? GREEN : CYAN);
      });
      g.strokeStyle = "rgba(0,229,255,.6)"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(c.width / 2, 0); g.lineTo(c.width / 2, c.height); g.moveTo(0, c.height / 2); g.lineTo(c.width, c.height / 2); g.stroke();
    } else {
      if (runs[0]) drawRun(runs[0]); else drawWorld();
      drawRobot();
      if (runs[0]) label(summary(runs[0]), 12, 26, CYAN);
      if (msg) label(msg, 12, 54, msg.startsWith("no") ? "#ff4d6d" : GREEN);
    }
    requestAnimationFrame(frame);
  })();

  // ---- input ----
  function cellOf(e) {
    const r = c.getBoundingClientRect();
    return {
      x: Math.min(COLS - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * COLS))),
      y: Math.min(ROWS - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * ROWS))),
    };
  }
  const same = (a, b) => a.x === b.x && a.y === b.y;
  function paint(p) {
    if (same(p, start) || same(p, goal)) return;
    if (robot && Math.floor(robot.x / S) === p.x && Math.floor(robot.y / S) === p.y) return;
    if (wall[idx(p.x, p.y)] === paintVal) return;
    wall[idx(p.x, p.y)] = paintVal; edited();
  }
  c.addEventListener("pointerdown", (e) => {
    const p = cellOf(e);
    if (same(p, start)) drag = "start";
    else if (same(p, goal)) drag = "goal";
    else { drag = "paint"; paintVal = wall[idx(p.x, p.y)] ? 0 : 1; paint(p); }
    c.setPointerCapture(e.pointerId);
  });
  c.addEventListener("pointermove", (e) => {
    const p = cellOf(e);
    if (!drag) { c.style.cursor = same(p, start) || same(p, goal) ? "grab" : "crosshair"; return; }
    if (drag === "paint") return paint(p);
    const other = drag === "start" ? goal : start, cur = drag === "start" ? start : goal;
    if (wall[idx(p.x, p.y)] || same(p, other) || same(p, cur)) return;
    cur.x = p.x; cur.y = p.y; robot = null; edited();
  });
  c.addEventListener("pointerup", () => (drag = null));

  document.querySelectorAll("[data-algo]").forEach((b) => b.addEventListener("click", () => plan(b.dataset.algo)));
  document.getElementById("race").addEventListener("click", startRace);
  document.getElementById("drive").addEventListener("click", drive);
  document.getElementById("clear").addEventListener("click", () => { wall.fill(0); runs = []; race = false; robot = null; msg = ""; });
  document.getElementById("rand").addEventListener("click", () => {
    wall.fill(0); runs = []; race = false; robot = null; msg = "";
    // random wall segments look more like a building than scattered noise
    for (let n = 0; n < 22; n++) {
      const horiz = Math.random() < 0.5, len = 4 + Math.floor(Math.random() * 9);
      let x = Math.floor(Math.random() * COLS), y = Math.floor(Math.random() * ROWS);
      for (let k = 0; k < len; k++) { if (x < COLS && y < ROWS) wall[idx(x, y)] = 1; horiz ? x++ : y++; }
    }
    for (const p of [start, goal]) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = p.x + dx, y = p.y + dy; if (x >= 0 && y >= 0 && x < COLS && y < ROWS) wall[idx(x, y)] = 0;
    }
    plan(algo);
  });
})();

// ---------- perception: camera / depth / segmentation views with detections and grasp points ----------
(function () {
  const c = document.getElementById("perc"), g = c.getContext("2d"), W = c.width, H = c.height;
  const ctl = document.getElementById("perctl");
  const FAR = 150, NEAR = 410; // screen y of the far and near table edges
  const TYPES = {
    cup: { w: 52, h: 62, col: "#ff4d6d", base: 0.95 },
    ball: { w: 58, h: 58, col: "#4da3ff", base: 0.97 },
    box: { w: 84, h: 66, col: "#ffb300", base: 0.96 },
    bottle: { w: 34, h: 108, col: "#39ff88", base: 0.9 },
  };
  let objs = [{ t: "cup", x: 0.3, z: 0.35 }, { t: "ball", x: 0.55, z: 0.6 }, { t: "box", x: 0.72, z: 0.2 }, { t: "bottle", x: 0.45, z: 0.12 }];
  let view = "camera", boxes = true, grasps = false, light = 0.8, drag = null;

  // simple perspective: z = 0 is near the camera, z = 1 is the far edge of the table
  const scale = (z) => 1 - 0.55 * z;
  function bbox(o) {
    const s = scale(o.z), T = TYPES[o.t], cx = W / 2 + (o.x - 0.5) * W * 0.9 * s, by = NEAR - o.z * (NEAR - FAR);
    const w = T.w * s * 1.3, h = T.h * s * 1.3;
    return { x0: cx - w / 2, y0: by - h, x1: cx + w / 2, y1: by, cx, w, h };
  }
  const area = (b) => (b.x1 - b.x0) * (b.y1 - b.y0);
  function confidence(o) {
    const b = bbox(o);
    let hidden = 0;
    for (const p of objs) {
      if (p === o || p.z >= o.z) continue; // only nearer objects can hide this one
      const q = bbox(p), ix = Math.max(0, Math.min(b.x1, q.x1) - Math.max(b.x0, q.x0)), iy = Math.max(0, Math.min(b.y1, q.y1) - Math.max(b.y0, q.y0));
      hidden += (ix * iy) / area(b);
    }
    return TYPES[o.t].base * (0.3 + 0.7 * light) * (1 - 0.85 * Math.min(1, hidden));
  }

  function drawShape(o, b, fill) {
    const s = scale(o.z);
    g.fillStyle = fill;
    if (o.t === "ball") { g.beginPath(); g.arc(b.cx, b.y1 - b.h / 2, b.w / 2, 0, 7); g.fill(); }
    else if (o.t === "cup") {
      g.fillRect(b.x0, b.y0, b.w, b.h);
      g.strokeStyle = fill; g.lineWidth = 6 * s; g.beginPath(); g.arc(b.x1 + 4 * s, b.y0 + b.h / 2, b.h / 4, -1.4, 1.4); g.stroke();
    } else if (o.t === "bottle") {
      g.fillRect(b.x0, b.y0 + b.h * 0.3, b.w, b.h * 0.7);
      g.fillRect(b.cx - b.w * 0.2, b.y0, b.w * 0.4, b.h * 0.32);
    } else g.fillRect(b.x0, b.y0, b.w, b.h);
  }

  function draw() {
    const sorted = [...objs].sort((p, q) => q.z - p.z); // far to near
    const tl = { x: W / 2 - W * 0.45 * scale(1), y: FAR }, tr = { x: W / 2 + W * 0.45 * scale(1), y: FAR };
    // background and table
    if (view === "depth") {
      g.fillStyle = "#050505"; g.fillRect(0, 0, W, H);
      const gr = g.createLinearGradient(0, FAR, 0, NEAR); gr.addColorStop(0, "#333"); gr.addColorStop(1, "#bbb"); g.fillStyle = gr;
    } else if (view === "segmentation") {
      g.fillStyle = "#0b0f18"; g.fillRect(0, 0, W, H); g.fillStyle = "#3b2d5c";
    } else {
      const wall = g.createLinearGradient(0, 0, 0, FAR); wall.addColorStop(0, "#1a2433"); wall.addColorStop(1, "#24344a");
      g.fillStyle = wall; g.fillRect(0, 0, W, H);
      const gr = g.createLinearGradient(0, FAR, 0, NEAR); gr.addColorStop(0, "#5a4632"); gr.addColorStop(1, "#8a6a48"); g.fillStyle = gr;
    }
    g.beginPath(); g.moveTo(tl.x, tl.y); g.lineTo(tr.x, tr.y); g.lineTo(W * 0.95, NEAR); g.lineTo(W * 0.05, NEAR); g.closePath(); g.fill();

    for (const o of sorted) {
      const b = bbox(o), conf = confidence(o);
      if (view === "depth") { const v = Math.round(255 * (1 - o.z * 0.8)); drawShape(o, b, `rgb(${v},${v},${v})`); }
      else if (view === "segmentation") { g.globalAlpha = Math.max(0.25, conf); drawShape(o, b, TYPES[o.t].col); g.globalAlpha = 1; }
      else {
        drawShape(o, b, TYPES[o.t].col);
        g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(b.x0 + b.w * 0.15, b.y0 + b.h * 0.12, b.w * 0.12, b.h * 0.5); // highlight
      }
    }
    // poor light: darken and add sensor noise (the depth camera uses its own infrared light, so it is not affected)
    if (view !== "depth") {
      g.fillStyle = `rgba(0,0,0,${(1 - light) * 0.8})`; g.fillRect(0, 0, W, H);
      g.fillStyle = "rgba(200,200,200,.35)";
      for (let i = 0; i < (1 - light) * 2500; i++) g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    // detections
    let found = 0;
    for (const o of sorted) {
      const b = bbox(o), conf = confidence(o), ok = conf >= 0.5;
      if (ok) found++;
      if (view === "depth") {
        g.fillStyle = "rgba(0,0,0,.7)"; g.fillRect(b.cx - 30, b.y0 - 22, 60, 18);
        g.fillStyle = "#fff"; g.font = "12px monospace"; g.textAlign = "center"; g.fillText(`${(0.4 + o.z * 1.2).toFixed(2)} m`, b.cx, b.y0 - 9); g.textAlign = "left";
        continue;
      }
      if (boxes) {
        const col = ok ? TYPES[o.t].col : "#ff4d6d";
        g.strokeStyle = col; g.lineWidth = 2; g.setLineDash(ok ? [] : [5, 4]); g.strokeRect(b.x0 - 4, b.y0 - 4, b.w + 8, b.h + 8); g.setLineDash([]);
        const txt = `${ok ? o.t : "?"} ${Math.round(conf * 100)}%`;
        g.font = "bold 12px monospace"; const tw = g.measureText(txt).width;
        g.fillStyle = col; g.fillRect(b.x0 - 4, b.y0 - 22, tw + 10, 18);
        g.fillStyle = "#05080d"; g.fillText(txt, b.x0 + 1, b.y0 - 9);
      }
      if (grasps && ok) {
        const y = o.t === "bottle" ? b.y0 + b.h * 0.6 : b.y1 - b.h / 2, L = 14;
        g.strokeStyle = AMBER; g.lineWidth = 3;
        g.beginPath();
        g.moveTo(b.x0 - L, y); g.lineTo(b.x0 - 2, y); g.moveTo(b.x0 - 2, y - 8); g.lineTo(b.x0 - 2, y + 8);
        g.moveTo(b.x1 + L, y); g.lineTo(b.x1 + 2, y); g.moveTo(b.x1 + 2, y - 8); g.lineTo(b.x1 + 2, y + 8);
        g.stroke();
      }
    }
    // camera frame overlay
    g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 2;
    for (const [x, y, dx, dy] of [[12, 12, 1, 1], [W - 12, 12, -1, 1], [12, H - 12, 1, -1], [W - 12, H - 12, -1, -1]]) {
      g.beginPath(); g.moveTo(x, y + dy * 24); g.lineTo(x, y); g.lineTo(x + dx * 24, y); g.stroke();
    }
    g.fillStyle = "rgba(5,8,13,.75)"; g.fillRect(28, 24, 330, 24);
    g.fillStyle = GREEN; g.font = "13px monospace";
    g.fillText(view === "depth" ? "DEPTH CAMERA  (bright = near)" : `${view.toUpperCase()}  detected ${found}/${objs.length}`, 36, 41);
    requestAnimationFrame(draw);
  }

  // controls
  const el = (tag, props, parent) => { const e = Object.assign(document.createElement(tag), props); parent.appendChild(e); return e; };
  const views = ["camera", "depth", "segmentation"].map((v) => {
    const b = el("button", { textContent: v, className: v === view ? "on" : "" }, ctl);
    b.onclick = () => { view = v; views.forEach((x) => x.classList.toggle("on", x === b)); };
    return b;
  });
  const tog = (label, get, set) => {
    const b = el("button", {}, ctl);
    const sync = () => { b.textContent = `${label}: ${get() ? "on" : "off"}`; b.classList.toggle("on", get()); };
    b.onclick = () => { set(!get()); sync(); }; sync();
  };
  tog("boxes", () => boxes, (v) => (boxes = v));
  tog("grasp points", () => grasps, (v) => (grasps = v));
  const l = el("label", {}, ctl), span = el("span", { textContent: "light" }, l);
  const r = el("input", { type: "range", min: 5, max: 100, value: light * 100 }, l);
  r.oninput = () => (light = r.value / 100);
  el("button", { textContent: "shuffle", onclick: () => objs.forEach((o) => { o.x = 0.15 + Math.random() * 0.7; o.z = Math.random() * 0.9; }) }, ctl);

  // drag objects around the table
  const toCanvas = (e) => { const b = c.getBoundingClientRect(); return { x: (e.clientX - b.left) * (W / b.width), y: (e.clientY - b.top) * (H / b.height) }; };
  c.addEventListener("pointerdown", (e) => {
    const p = toCanvas(e);
    for (const o of [...objs].sort((a, b) => a.z - b.z)) {
      const b = bbox(o);
      if (p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1) { drag = { o, dx: b.cx - p.x, dy: b.y1 - p.y }; c.setPointerCapture(e.pointerId); break; }
    }
  });
  c.addEventListener("pointermove", (e) => {
    const p = toCanvas(e);
    if (!drag) {
      c.style.cursor = objs.some((o) => { const b = bbox(o); return p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1; }) ? "grab" : "default";
      return;
    }
    const z = clamp((NEAR - (p.y + drag.dy)) / (NEAR - FAR), 0, 1);
    drag.o.z = z; drag.o.x = clamp(0.5 + (p.x + drag.dx - W / 2) / (W * 0.9 * scale(z)), 0.05, 0.95);
  });
  c.addEventListener("pointerup", () => (drag = null));
  draw();
})();


// ---------- skills: skill -> proof map (where each skill was actually used) ----------
(function () {
  // proof targets: "demo:<work item id>" opens a demo, "#id" scrolls to a project card or timeline entry
  const P = {
    dGrasp: ["demo", "Grasp it", "demo:game:grasp"], dReach: ["demo", "Reach the target", "demo:game:reach"], dDual: ["demo", "Dual-arm manipulator", "demo:robot:dual"],
    dVla: ["demo", "Language to action", "demo:lab:vla"], dPercep: ["demo", "What the robot sees", "demo:percep:"], dLidar: ["demo", "Drive blind", "demo:game:lidar"],
    dAmr: ["demo", "Obstacle avoidance", "demo:robot:amr"], dPlan: ["demo", "Path planning", "demo:astar:"], dBal: ["demo", "Balance the stick", "demo:game:balance"],
    dCtrl: ["demo", "Tune a controller", "demo:lab:control"], dHum: ["demo", "Humanoid walking", "demo:robot:humanoid"], dTrain: ["demo", "Train the robot", "demo:game:train"], dQ: ["demo", "Q-learning", "demo:lab:rl"],
    pDream: ["project", "DREAM", "#p-dream"], pBus: ["project", "WhenIs199Coming", "#p-bus"], pNav: ["project", "Seamless navigation", "#p-seamless"],
    pLost: ["project", "Lost and Found", "#p-lostfound"], pQr: ["project", "BigFuture Kindergarten", "#p-bigfuture"], pPan: ["project", "Pandemic Survival Pack", "#p-pandemic"],
    tSpec: ["timeline", "Robotics Specialist, Schaeffler", "#tl-specialist"], tIntern: ["timeline", "Electrical Engineer Intern, Schaeffler", "#tl-intern"], tBsc: ["timeline", "B.Eng. Mechanical Engineering, NTU", "#tl-bsc"],
  };
  const GROUPS = [
    { name: "Languages", color: "#ffb300", skills: { "C++": ["tIntern"], "Python": ["pDream", "pBus", "pLost", "pQr", "pPan", "tIntern"] } },
    { name: "Robotics", color: "#00e5ff", skills: {
      "ROS / ROS 2": ["tIntern"], "Perception": ["dPercep", "pLost", "pQr"], "Grasping": ["dGrasp", "tSpec"],
      "Motion planning": ["dReach", "dDual", "pDream"], "Path planning": ["dPlan", "pNav", "tSpec"], "Kinematics": ["dReach", "dHum", "tIntern"],
      "Control theory": ["dBal", "dCtrl"], "Navigation (AMR)": ["dLidar", "dAmr", "pNav", "tIntern"] } },
    { name: "Robot learning", color: "#39ff88", skills: { "Reinforcement learning": ["dTrain", "dQ", "pDream"], "VLA models": ["dVla"] } },
    { name: "Simulation & tools", color: "#b388ff", skills: { "MuJoCo": ["dTrain", "dQ"], "Physics simulation": ["tIntern"], "Git / GitHub": ["tSpec", "tIntern", "tBsc"] } },
  ];
  const KIND = { demo: "#00e5ff", project: "#39ff88", timeline: "#ffb300" };
  const el = (tag, props, parent) => { const e = Object.assign(document.createElement(tag), props); parent.appendChild(e); return e; };
  const box = document.getElementById("skillchips"), proof = document.getElementById("proof");
  let pinned = null;

  function go(target) {
    if (target.startsWith("demo:")) {
      dispatchEvent(new CustomEvent("open-demo", { detail: target.slice(5) }));
      const stage = document.querySelector(".stage");
      // wait a frame so the newly opened demo has its final layout before scrolling
      requestAnimationFrame(() => { stage.scrollIntoView({ behavior: "smooth", block: "start" }); flash(stage); });
    } else {
      const t = document.querySelector(target);
      t.scrollIntoView({ behavior: "smooth", block: "center" }); flash(t);
    }
  }
  function flash(t) { t.classList.remove("flash"); void t.offsetWidth; t.classList.add("flash"); }
  function show(skill, color, keys) {
    proof.innerHTML = "";
    el("h3", { textContent: skill, style: `color:${color}` }, proof);
    const ul = el("ul", {}, proof);
    for (const k of keys) {
      const [kind, label, target] = P[k];
      const b = el("button", {}, el("li", {}, ul));
      el("b", { textContent: kind.toUpperCase(), style: `--k:${KIND[kind]}` }, b);
      el("span", { textContent: label }, b);
      b.onclick = () => go(target);
    }
  }
  for (const grp of GROUPS) {
    const g = el("div", { className: "sgroup", style: `--c:${grp.color}` }, box);
    el("h3", { textContent: grp.name }, g);
    const row = el("div", { className: "chips2" }, g);
    for (const [skill, keys] of Object.entries(grp.skills)) {
      const b = el("button", { className: "schip", style: `--c:${grp.color}` }, row);
      b.append(skill); el("sup", { textContent: keys.length }, b);
      b.onmouseenter = () => { if (!pinned) show(skill, grp.color, keys); };
      b.onclick = () => {
        pinned = pinned === b ? null : b;
        box.querySelectorAll(".schip").forEach((x) => x.classList.toggle("on", x === pinned));
        show(skill, grp.color, keys);
      };
    }
  }
})();

// ---------- project videos: click a card to open the video in a large player that grows out of the card ----------
(function () {
  const modal = document.getElementById("vmodal"), box = modal.querySelector(".vbox"), frameBox = modal.querySelector(".vframe");
  const mYear = modal.querySelector("small"), mTitle = modal.querySelector("h3"), mDesc = modal.querySelector("p"), mPick = modal.querySelector(".vpick-slot");
  let lastCard = null;
  const play = (id) => {
    frameBox.innerHTML = "";
    const f = Object.assign(document.createElement("iframe"), {
      src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`, title: mTitle.textContent,
      allow: "autoplay; encrypted-media; picture-in-picture; fullscreen", allowFullscreen: true,
    });
    frameBox.appendChild(f);
  };
  function open(card) {
    lastCard = card;
    mYear.textContent = card.querySelector("small").textContent;
    mTitle.textContent = card.querySelector("h4").textContent;
    mDesc.textContent = card.querySelector("p").textContent;
    // optional test picker (cards with several videos)
    mPick.innerHTML = "";
    const picks = card.querySelectorAll("[data-pick]");
    picks.forEach((p, i) => {
      const b = Object.assign(document.createElement("button"), { textContent: p.title || p.textContent, className: i === 0 ? "on" : "" });
      b.onclick = () => { mPick.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); play(p.dataset.pick); };
      mPick.appendChild(b);
    });
    play(picks.length ? picks[0].dataset.pick : card.querySelector(".vthumb").dataset.yt);
    // grow from the card: start the box at the card's position and scale
    const r = card.getBoundingClientRect();
    box.style.setProperty("--ox", `${r.left + r.width / 2 - innerWidth / 2}px`);
    box.style.setProperty("--oy", `${r.top + r.height / 2 - innerHeight / 2}px`);
    modal.hidden = false; document.body.style.overflow = "hidden";
    requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add("open")));
    modal.querySelector(".vclose").focus();
  }
  function close() {
    modal.classList.remove("open"); document.body.style.overflow = "";
    setTimeout(() => { modal.hidden = true; frameBox.innerHTML = ""; lastCard && lastCard.focus(); }, 250);
  }
  document.querySelectorAll(".vid").forEach((card) => {
    card.tabIndex = 0; card.setAttribute("role", "button");
    card.addEventListener("click", () => open(card));
    card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(card); } });
  });
  modal.querySelector(".vclose").onclick = close;
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) close(); });
})();
