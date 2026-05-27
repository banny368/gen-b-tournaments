/**
 * Gen B Tournaments — Particle System
 * =====================================
 * Cyberpunk animated canvas with floating neon particles,
 * connection lines, mouse parallax, and scanline overlay.
 *
 * Usage:
 *   <canvas id="particleCanvas"></canvas>
 *   <script>initParticles('particleCanvas')</script>
 *
 * Or call with options:
 *   initParticles('particleCanvas', { count: 80, mouse: true, scanlines: true })
 */

'use strict';

// ─── Default Options ──────────────────────────────────────────────────────────

const PARTICLE_DEFAULTS = {
  count:           90,          // Number of particles
  minRadius:       1,           // Min particle size
  maxRadius:       3,           // Max particle size
  minSpeed:        0.15,        // Min drift speed
  maxSpeed:        0.45,        // Max drift speed
  connectionDist:  140,         // Max px between connected particles
  mouse:           true,        // Respond to mouse parallax
  mouseStrength:   0.04,        // Parallax intensity (0 = none, 0.1 = strong)
  scanlines:       true,        // Render scanline overlay on hero sections
  colors: [                     // Neon particle colors
    '#00d4ff',   // neon-blue
    '#b14aed',   // neon-purple
    '#ff2d78',   // neon-pink
    '#00ff88',   // neon-green
    '#ffd700',   // neon-gold
  ],
  bgColor:        'transparent', // Canvas background
  maxFPS:          60,
};

// ─── Particle Class ───────────────────────────────────────────────────────────

class Particle {
  /**
   * @param {number} canvasW
   * @param {number} canvasH
   * @param {object} opts
   */
  constructor(canvasW, canvasH, opts) {
    this.opts   = opts;
    this.reset(canvasW, canvasH, true);
  }

  /**
   * Re-initialise position and motion.
   * @param {number} w
   * @param {number} h
   * @param {boolean} [randomY=false] - If true, randomise Y (initial spawn).
   */
  reset(w, h, randomY = false) {
    this.x       = Math.random() * w;
    this.y       = randomY ? Math.random() * h : (Math.random() > 0.5 ? -10 : h + 10);
    this.radius  = this._rand(this.opts.minRadius, this.opts.maxRadius);
    this.color   = this.opts.colors[Math.floor(Math.random() * this.opts.colors.length)];
    this.speed   = this._rand(this.opts.minSpeed, this.opts.maxSpeed);
    this.angle   = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.005;  // Slow angular drift
    this.alpha   = this._rand(0.3, 0.85);
    this.pulse   = Math.random() * Math.PI * 2;       // Phase for pulsing
    this.pulseSpeed = this._rand(0.015, 0.04);
  }

  _rand(min, max) {
    return min + Math.random() * (max - min);
  }

  /**
   * @param {number} w Canvas width
   * @param {number} h Canvas height
   * @param {{ x: number, y: number }} mouse Normalised mouse position
   */
  update(w, h, mouse) {
    this.angle   += this.rotSpeed;
    this.x       += Math.cos(this.angle) * this.speed;
    this.y       += Math.sin(this.angle) * this.speed;
    this.pulse   += this.pulseSpeed;

    // Mouse parallax
    if (this.opts.mouse) {
      this.x += (mouse.x - 0.5) * this.opts.mouseStrength;
      this.y += (mouse.y - 0.5) * this.opts.mouseStrength;
    }

    // Wrap around edges with a margin
    const margin = this.radius + 5;
    if (this.x < -margin)    this.x = w + margin;
    if (this.x > w + margin) this.x = -margin;
    if (this.y < -margin)    this.y = h + margin;
    if (this.y > h + margin) this.y = -margin;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    const pulseFactor = 0.7 + 0.3 * Math.sin(this.pulse);
    const alpha       = this.alpha * pulseFactor;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur  = 8;
    ctx.shadowColor = this.color;
    ctx.fillStyle   = this.color;

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * pulseFactor, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ─── Scanline Overlay ─────────────────────────────────────────────────────────

/**
 * Draws a subtle CRT scanline effect over the canvas.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 * @param {number} time  - Current timestamp for animation.
 */
function _drawScanlines(ctx, w, h, time) {
  const lineHeight = 3;
  const speed      = 0.3;
  const offset     = (time * speed) % (lineHeight * 2);

  ctx.save();
  ctx.globalAlpha = 0.025;
  ctx.fillStyle   = '#000';

  for (let y = -lineHeight + offset; y < h; y += lineHeight * 2) {
    ctx.fillRect(0, y, w, lineHeight);
  }

  // Subtle vignette
  const gradient = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.globalAlpha = 1;
  ctx.fillStyle   = gradient;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
}

// ─── Connection Lines ─────────────────────────────────────────────────────────

/**
 * Draws lines between particles that are within `connectionDist` of each other.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Particle[]} particles
 * @param {number} maxDist
 */
function _drawConnections(ctx, particles, maxDist) {
  const maxDistSq = maxDist * maxDist;

  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx   = particles[i].x - particles[j].x;
      const dy   = particles[i].y - particles[j].y;
      const distSq = dx * dx + dy * dy;

      if (distSq < maxDistSq) {
        const alpha  = (1 - distSq / maxDistSq) * 0.25;
        // Blend the two particle colours
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = particles[i].color;
        ctx.lineWidth   = 0.6;

        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}

// ─── Main Initializer ─────────────────────────────────────────────────────────

/**
 * Initialises and starts the particle animation on a canvas element.
 *
 * @param {string} canvasId      - ID of a <canvas> element, or 'auto' to create one.
 * @param {Partial<typeof PARTICLE_DEFAULTS>} [options]
 * @returns {{ stop: function, start: function, setCount: function }} Control handle.
 */
function initParticles(canvasId = 'particleCanvas', options = {}) {
  const opts = Object.assign({}, PARTICLE_DEFAULTS, options);

  // ── Canvas setup ──────────────────────────────────────────────────────────
  let canvas;

  if (canvasId === 'auto') {
    canvas = document.createElement('canvas');
    canvas.id = 'particleCanvas';
    Object.assign(canvas.style, {
      position: 'fixed',
      top:      '0',
      left:     '0',
      width:    '100%',
      height:   '100%',
      zIndex:   '0',
      pointerEvents: 'none',
    });
    document.body.prepend(canvas);
  } else {
    canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.warn(`[GenB] initParticles: canvas #${canvasId} not found. Creating one.`);
      canvas = document.createElement('canvas');
      canvas.id = canvasId;
      Object.assign(canvas.style, {
        position: 'fixed',
        top: '0', left: '0',
        width: '100%', height: '100%',
        zIndex: '0',
        pointerEvents: 'none',
      });
      document.body.prepend(canvas);
    }
  }

  const ctx = canvas.getContext('2d');

  // ── Dimensions ────────────────────────────────────────────────────────────
  let W = 0, H = 0;

  function _resize() {
    W = canvas.width  = canvas.offsetWidth  || window.innerWidth;
    H = canvas.height = canvas.offsetHeight || window.innerHeight;
  }

  _resize();
  const _resizeDebounced = _debounce(_resize, 200);
  window.addEventListener('resize', _resizeDebounced);

  // ── Particles ─────────────────────────────────────────────────────────────
  let particles = [];

  function _buildParticles(count) {
    particles = Array.from({ length: count }, () => new Particle(W, H, opts));
  }

  _buildParticles(opts.count);

  // ── Mouse tracking ────────────────────────────────────────────────────────
  const mouse = { x: 0.5, y: 0.5 };

  if (opts.mouse) {
    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX / window.innerWidth;
      mouse.y = e.clientY / window.innerHeight;
    }, { passive: true });
  }

  // ── RAF control ───────────────────────────────────────────────────────────
  let _rafId   = null;
  let _running = false;
  let _lastTime = 0;
  const _frameInterval = 1000 / opts.maxFPS;

  function _loop(timestamp) {
    if (!_running) return;

    _rafId = requestAnimationFrame(_loop);

    const elapsed = timestamp - _lastTime;
    if (elapsed < _frameInterval) return;      // Cap FPS
    _lastTime = timestamp - (elapsed % _frameInterval);

    // Clear
    ctx.clearRect(0, 0, W, H);

    if (opts.bgColor && opts.bgColor !== 'transparent') {
      ctx.fillStyle = opts.bgColor;
      ctx.fillRect(0, 0, W, H);
    }

    // Update & draw connections
    particles.forEach((p) => p.update(W, H, mouse));
    _drawConnections(ctx, particles, opts.connectionDist);
    particles.forEach((p) => p.draw(ctx));

    // Scanlines
    if (opts.scanlines) {
      _drawScanlines(ctx, W, H, timestamp);
    }
  }

  // ── Start ─────────────────────────────────────────────────────────────────
  function start() {
    if (_running) return;
    _running = true;
    _rafId   = requestAnimationFrame(_loop);
  }

  // ── Stop ──────────────────────────────────────────────────────────────────
  function stop() {
    _running = false;
    if (_rafId) {
      cancelAnimationFrame(_rafId);
      _rafId = null;
    }
  }

  // ── Set particle count dynamically ─────────────────────────────────────────
  function setCount(newCount) {
    _buildParticles(newCount);
  }

  start();

  // Pause when tab is hidden (performance)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  return { start, stop, setCount, canvas };
}

// ─── Hero Scanline (standalone) ──────────────────────────────────────────────

/**
 * Adds a CSS-based scanline overlay to elements matching a selector.
 * Lightweight alternative for sections that don't need a full canvas.
 *
 * @param {string} [selector='.hero-scanlines'] - CSS selector.
 */
function initScanlineOverlay(selector = '.hero-scanlines') {
  const els = document.querySelectorAll(selector);
  if (!els.length) return;

  // Inject style once
  if (!document.getElementById('genb-scanline-style')) {
    const style = document.createElement('style');
    style.id = 'genb-scanline-style';
    style.textContent = `
      .hero-scanlines {
        position: relative;
        overflow: hidden;
      }
      .hero-scanlines::after {
        content: '';
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(0, 0, 0, 0.04) 2px,
          rgba(0, 0, 0, 0.04) 4px
        );
        pointer-events: none;
        z-index: 1;
      }
    `;
    document.head.appendChild(style);
  }
}

// ─── Internal debounce (no dep on utils.js) ───────────────────────────────────
function _debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// ─── Auto-init if canvas#particleCanvas exists ────────────────────────────────
function _autoInit() {
  initScanlineOverlay();

  const canvas = document.getElementById('particleCanvas');
  if (canvas) {
    initParticles('particleCanvas');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _autoInit);
} else {
  _autoInit();
}

// ─── Expose globally ──────────────────────────────────────────────────────────
window.initParticles       = initParticles;
window.initScanlineOverlay = initScanlineOverlay;
window.GenBParticles       = { initParticles, initScanlineOverlay };

console.log('[GenB] particles.js loaded ✓');
