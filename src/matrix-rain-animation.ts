import gsap from 'gsap';

// ─── Types ───────────────────────────────────────────────────────────
interface RainDrop {
  x: number;
  y: number;
  speed: number;
  chars: string[];
  trail: number;
  opacity: number;
  fontSize: number;
}

interface CircleChar {
  angle: number;       // current angle on circle
  radius: number;      // target radius
  currentRadius: number;
  char: string;
  opacity: number;
  glow: number;
  fromX: number;       // where it detached from rain
  fromY: number;
  progress: number;    // 0→1 gathering progress
  gathered: boolean;
  colorProgress: number; // 0 = green, 1 = white
}

// ─── Katakana / Latin character pool ─────────────────────────────────
const MATRIX_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';

function randomChar(): string {
  return MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
}

// ─── Main animation class ────────────────────────────────────────────
export class MatrixRainAnimation {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private flashEl: HTMLElement;
  private profileEl: HTMLElement;

  private width = 0;
  private height = 0;
  private dpr = 1;

  // rain state
  private drops: RainDrop[] = [];
  private columnCount = 0;
  private baseFontSize = 16;

  // circle chars
  private circleChars: CircleChar[] = [];
  private circleCharCount = 60;
  private circleRadius = 0;
  private circleRotation = 0;

  // animation phases & speed control
  private speedMultiplier = 1;
  private rotationSpeed = 0.3;          // radians/s base
  private phase: 'rain' | 'gathering' | 'accelerating' | 'flash' | 'done' = 'rain';
  private elapsed = 0;                  // total seconds elapsed

  // timing (seconds)
  private readonly RAIN_ONLY_DURATION = 2.0;
  private readonly GATHER_DURATION = 3.0;
  private readonly ACCEL_DURATION = 4;
  private readonly FLASH_DELAY = 0.0;   // flash triggers after accel

  // shake
  private shakeIntensity = 0;

  // glow circle (after flash)
  private glowCircle = { radius: 0, opacity: 0, glow: 0 };

  // side glow (after flash)
  private sideGlow = { opacity: 0, width: 5 };

  private rafId = 0;
  private lastTime = 0;
  private running = false;
  private onDone?: () => void;

  // circle center offset (fraction of height, 0.5 = center)
  private readonly CIRCLE_CENTER_Y = 0.40;

  constructor(canvas: HTMLCanvasElement, flashEl: HTMLElement, profileEl: HTMLElement, onDone?: () => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.flashEl = flashEl;
    this.profileEl = profileEl;
    this.onDone = onDone;
  }

  // ─── Public API ──────────────────────────────────────────────────
  start() {
    this.resize();
    window.addEventListener('resize', this.onResize);
    this.initDrops();
    this.initCircleChars();
    this.running = true;
    this.lastTime = performance.now();
    this.elapsed = 0;
    this.phase = 'rain';
    this.tick(this.lastTime);
    this.schedulePhases();
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
    gsap.killTweensOf(this);
    gsap.killTweensOf(this.glowCircle);
    gsap.killTweensOf(this.sideGlow);
  }

  // ─── Resize ──────────────────────────────────────────────────────
  private onResize = () => this.resize();

  private resize() {
    this.dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.circleRadius = Math.min(this.width, this.height) * 0.18;
    this.columnCount = Math.floor(this.width / this.baseFontSize);

    // refresh drops for new size
    if (this.drops.length) this.initDrops();
  }

  // ─── Init rain drops ────────────────────────────────────────────
  private initDrops() {
    this.drops = [];
    // ~1.5x density: every column + 50% extra random columns
    for (let i = 0; i < this.columnCount; i++) {
      this.drops.push(this.createDrop(i, true));
    }
    const extraCount = Math.floor(this.columnCount * 0.5);
    for (let i = 0; i < extraCount; i++) {
      const col = Math.floor(Math.random() * this.columnCount);
      this.drops.push(this.createDrop(col, true));
    }
  }

  private createDrop(col: number, randomY = false): RainDrop {
    const trail = 8 + Math.floor(Math.random() * 16);
    const chars: string[] = [];
    for (let j = 0; j < trail; j++) chars.push(randomChar());
    // random font size between 15 and 30
    const fontSize = 15 + Math.floor(Math.random() * 16);
    return {
      x: col * this.baseFontSize + (Math.random() - 0.5) * 4,
      y: randomY ? -Math.random() * this.height : -Math.random() * 100,
      speed: 80 + Math.random() * 160,
      chars,
      trail,
      opacity: 0.6 + Math.random() * 0.4,
      fontSize,
    };
  }

  // ─── Init circle chars ──────────────────────────────────────────
  private initCircleChars() {
    this.circleChars = [];
    for (let i = 0; i < this.circleCharCount; i++) {
      const angle = (Math.PI * 2 * i) / this.circleCharCount;
      // pick a random rain column origin
      const col = Math.floor(Math.random() * this.columnCount);
      this.circleChars.push({
        angle,
        radius: this.circleRadius,
        currentRadius: this.circleRadius * 3, // start far away
        char: randomChar(),
        opacity: 0,
        glow: 0,
        fromX: col * this.baseFontSize,
        fromY: -Math.random() * this.height * 0.3,
        progress: 0,
        gathered: false,
        colorProgress: 0,
      });
    }
  }

  // ─── Phase scheduling with GSAP ─────────────────────────────────
  private schedulePhases() {
    const tl = gsap.timeline();

    // Phase 1 → rain only (already running)
    tl.to(this, {
      duration: this.RAIN_ONLY_DURATION,
      ease: 'none',
      onComplete: () => { this.phase = 'gathering'; },
    });

    // Phase 2 → gathering: circle chars fly in
    tl.to(this, {
      duration: this.GATHER_DURATION,
      speedMultiplier: 1.4,
      ease: 'power1.in',
    }, `>`)

    // each circle char gathers
    this.circleChars.forEach((cc, i) => {
      const delay = this.RAIN_ONLY_DURATION + (i / this.circleCharCount) * (this.GATHER_DURATION * 0.6);
      gsap.to(cc, {
        progress: 1,
        opacity: 1,
        glow: 8,
        duration: this.GATHER_DURATION * 0.7,
        delay,
        ease: 'power2.inOut',
        onUpdate: () => {
          cc.currentRadius = gsap.utils.interpolate(this.circleRadius * 3, this.circleRadius, cc.progress);
          if (cc.progress > 0.9) cc.gathered = true;
          // randomise char occasionally
          if (Math.random() < 0.05) cc.char = randomChar();
        },
      });
    });

    // Phase 3 → accelerating
    tl.to(this, {
      duration: this.ACCEL_DURATION,
      speedMultiplier: 6,
      rotationSpeed: 9,
      shakeIntensity: 6,
      ease: 'power2.in',
      onStart: () => { this.phase = 'accelerating'; },
    }, `>`);

    // circle chars turn green → white during acceleration
    tl.to(this.circleChars, {
        colorProgress: 1,
        duration: 0.4,
        stagger: {
            amount: this.ACCEL_DURATION * 0.55,
        },
        ease: 'power2.in',
    }, `<+${this.ACCEL_DURATION * 0.35}`);

    // Phase 4 → flash
    tl.call(() => this.triggerFlash(), [], `>+${this.FLASH_DELAY}`);
  }

  // ─── Flash effect ───────────────────────────────────────────────
  private triggerFlash() {
    this.phase = 'flash';

    // white screen flash
    gsap.set(this.flashEl, { opacity: 0, display: 'block' });
    gsap.to(this.flashEl, {
      opacity: 1,
      duration: 0.15,
      ease: 'power4.in',
      onComplete: () => {
        // hide rain, show glow circle
        this.drops = [];
        this.circleChars.forEach(c => { c.opacity = 0; });
        this.glowCircle = { radius: this.circleRadius, opacity: 1, glow: 10 };

        gsap.to(this.flashEl, {
          opacity: 0,
          duration: 1.2,
          ease: 'power2.out',
          onComplete: () => {
            this.flashEl.style.display = 'none';
          },
        });

        // glow circle pulses — subtle border glow only
        gsap.to(this.glowCircle, {
          glow: 4,
          duration: 2,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });

        // side glow fade in + pulse
        gsap.to(this.sideGlow, {
          opacity: 0.35,
          duration: 1.5,
          delay: 0.3,
          ease: 'power2.out',
          onComplete: () => {
            gsap.to(this.sideGlow, {
              opacity: 0.15,
              duration: 3,
              ease: 'sine.inOut',
              yoyo: true,
              repeat: -1,
            });
          },
        });

        this.phase = 'done';
        this.shakeIntensity = 0;

        // show profile container
        gsap.to(this.profileEl, {
          opacity: 1,
          duration: 1.5,
          delay: 0.5,
          ease: 'power2.out',
          onComplete: () => {
            this.onDone?.();
          },
        });
      },
    });
  }

  // ─── Main loop ──────────────────────────────────────────────────
  private tick = (now: number) => {
    if (!this.running) return;
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.elapsed += dt;

    this.update(dt);
    this.draw();

    this.rafId = requestAnimationFrame(this.tick);
  };

  // ─── Update ─────────────────────────────────────────────────────
  private update(dt: number) {
    // update rain drops
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i];
      d.y += d.speed * this.speedMultiplier * dt;
      // randomly change leading char
      if (Math.random() < 0.05) d.chars[0] = randomChar();
      // reset when off screen
      if (d.y - d.trail * d.fontSize > this.height) {
        Object.assign(d, this.createDrop(Math.floor(d.x / this.baseFontSize)));
      }
    }

    // update circle rotation
    this.circleRotation += this.rotationSpeed * dt;

    // randomise circle chars
    for (const cc of this.circleChars) {
      if (Math.random() < 0.04) cc.char = randomChar();
    }
  }

  // ─── Draw ───────────────────────────────────────────────────────
  private draw() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // apply shake
    ctx.save();
    if (this.shakeIntensity > 0.1) {
      const sx = (Math.random() - 0.5) * this.shakeIntensity * 2;
      const sy = (Math.random() - 0.5) * this.shakeIntensity * 2;
      ctx.translate(sx, sy);
    }

    // black bg with slight persistence (trail effect)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, 0, w, h);

    // ── draw rain ───────────────────────────────────────────────
    for (const d of this.drops) {
      for (let j = 0; j < d.trail; j++) {
        const charY = d.y - j * d.fontSize;
        if (charY < -d.fontSize || charY > h + d.fontSize) continue;

        const brightness = 1 - j / d.trail;
        const alpha = brightness * d.opacity;

        if (j === 0) {
          // leading char is brightest white-green
          ctx.fillStyle = `rgba(180, 255, 180, ${alpha})`;
          ctx.shadowColor = '#00ff41';
          ctx.shadowBlur = 12;
        } else {
          const g = Math.floor(100 + 155 * brightness);
          ctx.fillStyle = `rgba(0, ${g}, 0, ${alpha * 0.8})`;
          ctx.shadowColor = `rgba(0, ${g}, 0, 0.6)`;
          ctx.shadowBlur = 6 * brightness;
        }

        ctx.font = `${d.fontSize}px "MS Gothic", "Courier New", monospace`;
        ctx.fillText(d.chars[j] || randomChar(), d.x, charY);
      }
    }
    ctx.shadowBlur = 0;

    // ── draw circle characters ──────────────────────────────────
    const cx = w / 2;
    const cy = h * this.CIRCLE_CENTER_Y;

    for (const cc of this.circleChars) {
      if (cc.opacity <= 0.01) continue;

      const angle = cc.angle + this.circleRotation;
      const r = cc.currentRadius;

      const tx = cx + Math.cos(angle) * r;
      const ty = cy + Math.sin(angle) * r;

      // interpolate from origin
      const x = gsap.utils.interpolate(cc.fromX, tx, cc.progress);
      const y = gsap.utils.interpolate(cc.fromY, ty, cc.progress);

      // Glow — interpolate green → white
      const cp = cc.colorProgress;
      const cr = Math.round(0 + 255 * cp);
      const cg = 255;
      const cb = Math.round(65 + 190 * cp);
      ctx.shadowColor = `rgb(${cr}, ${cg}, ${cb})`;
      ctx.shadowBlur = cc.glow + cp * 6;

      const alpha = cc.opacity;
      ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha})`;
      ctx.font = `bold ${this.baseFontSize + 2}px "MS Gothic", "Courier New", monospace`;
      ctx.fillText(cc.char, x, y);
    }
    ctx.shadowBlur = 0;

    // ── draw glow circle (after flash) ──────────────────────────
    if (this.phase === 'done' && this.glowCircle.opacity > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, this.glowCircle.radius, 0, Math.PI * 2);
      ctx.closePath();

      // border-only glow, transparent inside
      ctx.strokeStyle = `rgba(255, 255, 255, ${this.glowCircle.opacity * 0.9})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
      ctx.shadowBlur = this.glowCircle.glow;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // ── draw side glow (after flash) ────────────────────────────
    if (this.phase === 'done' && this.sideGlow.opacity > 0) {
      const gw = this.sideGlow.width;
      const alpha = this.sideGlow.opacity;

      // left side
      const leftGrad = ctx.createLinearGradient(0, 0, gw, 0);
      leftGrad.addColorStop(0, `rgba(0, 255, 255, ${alpha})`);
      leftGrad.addColorStop(1, 'rgba(0, 255, 0, 0)');
      ctx.fillStyle = leftGrad;
      ctx.fillRect(0, 0, gw, h);

      // right side
      const rightGrad = ctx.createLinearGradient(w, 0, w - gw, 0);
      rightGrad.addColorStop(0, `rgba(0, 255, 255, ${alpha})`);
      rightGrad.addColorStop(1, 'rgba(0, 255, 0, 0)');
      ctx.fillStyle = rightGrad;
      ctx.fillRect(w - gw, 0, gw, h);
    }

    ctx.restore();
  }
}
