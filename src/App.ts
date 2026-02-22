import { LitElement, html, svg } from 'lit'
import { customElement, query, state } from 'lit/decorators.js'
import gsap from 'gsap'

import "./App.css";
import './ascii-cube.js'
import './intro-background-effects.ts'

type IntroPhase = 'draw' | 'pulse' | 'stable' | 'typing';

type PulseParticle = {
    id: number;
    angleDeg: number;
    durationSec: number;
    travelPx: number;
    delaySec: number;
    sizePx: number;
    alpha: number;
};

const INTRO_CONFIG = {
    geometry: {
        ringRadius: 45,
        ringStrokeWidth: 1,
    },
    draw: {
        durationMs: 1800,
        ease: 'power1.inOut',
    },
    arm: {
        strokeWidth: 0.5,
    },
    pulse: {
        count: 4,
        expandDurationMs: 250,
        settleDurationMs: 400,
        ringScaleGain: 0.15,
        strokeScaleGain: 0.55,
        glowScaleGain: 2,
        shakeAmplitudeMin: 0.05,
        shakeAmplitudeMax: 1.05,
    },
    stablePulse: {
        durationMs: 1300,
        ringScaleGain: 0.022,
        strokeScaleGain: 0.2,
        glowScaleGain: 0.48,
        ease: 'power1.inOut',
    },
    loader: {
        initialAngleDeg: 45,
        arcSweepDeg: 10,
        radiusOffset: 0.5,
        strokeWidth: 0.8,
        cycleDurationMs: 2000,
        ease: 'none',
        glow: {
            blurStdDeviation: 34,
            alpha: 0.94,
        },
    },
    glow: {
        blurStdDeviation: 5.3,
        blurGain: 1.2,
        alpha: 0.74,
        alphaGain: 0.22,
    },
    flash: {
        fadeInMs: 400,
        holdMs: 50,
        fadeOutMs: 500,
        maxOpacity: 1,
    },
    typing: {
        message: 'Hello, Nemo',
        startDelayAfterCubeMs: 300,
        charDelayMs: 250,
    },
    sideGlow: {
        blurPx: 1.6,
        tone: 'cyan',
    },
};

@customElement('root-app')
export class App extends LitElement {
    @state()
    private sweepAngle = 0;

    @state()
    private pulseLevel = 0;

    @state()
    private phase: IntroPhase = 'draw';

    @state()
    private shakeOffsetX = 0;

    @state()
    private shakeOffsetY = 0;

    @state()
    private loaderAngle = INTRO_CONFIG.loader.initialAngleDeg;

    @state()
    private typedMessage = '';

    @state()
    private backgroundReady = false;

    @state()
    private pulseParticles: PulseParticle[] = [];

    @state()
    private ringFillVisible = true;

    private masterTimeline?: gsap.core.Timeline;

    private particleIdSeed = 0;

    private readonly particleCleanupCalls = new Map<number, gsap.core.Tween>();

    @query('#intro-flash')
    private readonly flashLayer!: HTMLDivElement;

    @query('#intro-cube')
    private readonly cubeLayer!: HTMLDivElement;

    @query('#intro-side-glow-left')
    private readonly sideGlowLeft!: HTMLDivElement;

    @query('#intro-side-glow-right')
    private readonly sideGlowRight!: HTMLDivElement;

    protected createRenderRoot(): HTMLElement | DocumentFragment {
        return this;
    }

    protected firstUpdated(): void {
        this.startIntroRingAnimation();
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.clearPulseParticles();
        this.masterTimeline?.kill();
        this.masterTimeline = undefined;
    }

    private startIntroRingAnimation(): void {
        this.masterTimeline?.kill();

        this.sweepAngle = 0;
        this.pulseLevel = 0;
        this.phase = 'draw';
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
        this.loaderAngle = INTRO_CONFIG.loader.initialAngleDeg;
        this.typedMessage = '';
        this.backgroundReady = false;
        this.ringFillVisible = true;
        this.clearPulseParticles();
        gsap.set(this.cubeLayer, {
            opacity: 0,
            '--intro-cube-scale': 0.94,
        });
        gsap.set([this.sideGlowLeft, this.sideGlowRight], { opacity: 0 });
        gsap.set(this.flashLayer, { display: 'none', opacity: 0 });

        const target = { value: 0 };
        const master = gsap.timeline();

        master.to(target, {
            value: 360,
            duration: INTRO_CONFIG.draw.durationMs / 1000,
            ease: INTRO_CONFIG.draw.ease,
            onUpdate: () => {
                this.sweepAngle = target.value;
            },
        });

        master.call(() => {
            this.sweepAngle = 360;
            this.phase = 'pulse';
        });

        master.add(this.createPulseTimeline());

        master.call(() => {
            this.phase = 'stable';
        });

        master.add(this.createStableLoopTimeline(), '<');

        master.to(this.cubeLayer, {
            opacity: 1,
            '--intro-cube-scale': 1,
            duration: 0.9,
            ease: 'power2.out',
        }, '<');

        master.call(() => {
            this.phase = 'typing';
            this.typedMessage = '';
        }, [], `>+${INTRO_CONFIG.typing.startDelayAfterCubeMs / 1000}`);

        const message = INTRO_CONFIG.typing.message;
        for (let idx = 1; idx <= message.length; idx++) {
            master.call(() => {
                this.typedMessage = message.slice(0, idx);
            });

            if (idx < message.length) {
                master.to({}, { duration: INTRO_CONFIG.typing.charDelayMs / 1000 });
            }
        }

        master.call(() => {
            this.backgroundReady = true;
        });

        this.masterTimeline = master;
    }

    private createPulseTimeline(): gsap.core.Timeline {
        const timeline = gsap.timeline();
        const pulseCount = INTRO_CONFIG.pulse.count;
        const baseGrowSec = INTRO_CONFIG.pulse.expandDurationMs / 1000;
        const baseSettleSec = INTRO_CONFIG.pulse.settleDurationMs / 1000;
        const paceBias = 0.36;
        const rawPaceFactors = Array.from({ length: pulseCount }, (_, idx) => {
            const progress = pulseCount <= 1 ? 0 : idx / (pulseCount - 1);
            return gsap.utils.interpolate(1 + paceBias, 1 - paceBias, progress);
        });
        const meanPaceFactor = rawPaceFactors.reduce((sum, factor) => sum + factor, 0) / pulseCount;

        for (let idx = 0; idx < pulseCount; idx++) {
            const isLastPulse = idx === pulseCount - 1;
            const intensity = (idx + 1) / pulseCount;
            const shakeAmp = gsap.utils.interpolate(INTRO_CONFIG.pulse.shakeAmplitudeMin, INTRO_CONFIG.pulse.shakeAmplitudeMax, intensity);
            const paceFactor = rawPaceFactors[idx] / meanPaceFactor;
            const growSec = baseGrowSec * paceFactor;
            const settleSec = baseSettleSec * paceFactor;
            const shakeDurationSec = growSec + settleSec;

            if (!isLastPulse) {
                timeline.call(() => {
                    this.emitPulseParticles(intensity);
                });
            }

            timeline.to(this, {
                pulseLevel: intensity,
                duration: growSec,
                ease: 'power2.out',
            });

            timeline.addLabel('growEnd');

            timeline.to({}, {
                duration: shakeDurationSec,
                ease: 'none',
                onUpdate: () => {
                    this.shakeOffsetX = gsap.utils.random(-shakeAmp, shakeAmp, 0.01);
                    this.shakeOffsetY = gsap.utils.random(-shakeAmp, shakeAmp, 0.01);
                },
                onComplete: () => {
                    this.shakeOffsetX = 0;
                    this.shakeOffsetY = 0;
                },
            }, `<`);

            if (isLastPulse) {
                timeline.add(this.createFlashTimeline(), '<');
            }

            timeline.to(this, {
                pulseLevel: 0,
                duration: settleSec,
                ease: 'power2.inOut',
            });
        }

        return timeline;
    }

    private createFlashTimeline(): gsap.core.Timeline {
        const timeline = gsap.timeline({
            onStart: () => {
                this.clearPulseParticles();
                gsap.set(this.flashLayer, { display: 'block', opacity: 0 });
            },
            onComplete: () => {
                gsap.set(this.flashLayer, { display: 'none' });
            },
        });

        timeline
            .to(this.flashLayer, {
                opacity: INTRO_CONFIG.flash.maxOpacity,
                duration: INTRO_CONFIG.flash.fadeInMs / 1000,
                ease: 'power2.out',
            })
            .call(() => {
                this.ringFillVisible = false;
            })
            .to(this.flashLayer, {
                opacity: INTRO_CONFIG.flash.maxOpacity,
                duration: INTRO_CONFIG.flash.holdMs / 1000,
                ease: 'none',
            })
            .to(this.flashLayer, {
                opacity: 0,
                duration: INTRO_CONFIG.flash.fadeOutMs / 1000,
                ease: 'power2.in',
            }, '>')
            .to([this.sideGlowLeft, this.sideGlowRight], {
                opacity: 1,
                duration: 0.52,
                ease: 'power2.out',
            }, '<');

        return timeline;
    }

    private createStableLoopTimeline(): gsap.core.Timeline {
        const stableLoop = gsap.timeline();

        stableLoop.add(gsap.to(this, {
            pulseLevel: 1,
            duration: INTRO_CONFIG.stablePulse.durationMs / 1000,
            ease: INTRO_CONFIG.stablePulse.ease,
            repeat: -1,
            yoyo: true,
        }), 0);

        stableLoop.add(gsap.to(this, {
            loaderAngle: '+=360',
            duration: INTRO_CONFIG.loader.cycleDurationMs / 1000,
            ease: INTRO_CONFIG.loader.ease,
            repeat: -1,
        }), 0);

        return stableLoop;
    }

    private emitPulseParticles(intensity: number): void {
        const burstCount = Math.round(gsap.utils.interpolate(140, 420, intensity));
        const durationSec = gsap.utils.interpolate(0.95, 1.85, intensity);
        const particles = Array.from({ length: burstCount }, () => {
            const particleId = ++this.particleIdSeed;
            const spreadJitter = gsap.utils.random(-1.4, 1.4, 0.01);

            return {
                id: particleId,
                angleDeg: gsap.utils.random(0, 360) + spreadJitter,
                durationSec: gsap.utils.random(durationSec * 0.86, durationSec * 1.14, 0.001),
                travelPx: gsap.utils.random(
                    gsap.utils.interpolate(86, 164, intensity),
                    gsap.utils.interpolate(224, 362, intensity),
                    0.1,
                ),
                delaySec: gsap.utils.random(0, gsap.utils.interpolate(0.03, 0.07, intensity), 0.001),
                sizePx: gsap.utils.random(2, gsap.utils.interpolate(1.4, 2.2, intensity), 0.1),
                alpha: gsap.utils.random(0.9, gsap.utils.interpolate(0.86, 0.98, intensity), 0.01),
            } satisfies PulseParticle;
        });

        this.pulseParticles = [...this.pulseParticles, ...particles];

        for (const particle of particles) {
            const cleanupCall = gsap.delayedCall(particle.durationSec + particle.delaySec + 0.24, () => {
                this.removePulseParticle(particle.id);
            });

            this.particleCleanupCalls.set(particle.id, cleanupCall);
        }
    }

    private removePulseParticle(particleId: number): void {
        this.pulseParticles = this.pulseParticles.filter((particle) => particle.id !== particleId);
        this.particleCleanupCalls.get(particleId)?.kill();
        this.particleCleanupCalls.delete(particleId);
    }

    private clearPulseParticles(): void {
        for (const cleanupCall of this.particleCleanupCalls.values()) {
            cleanupCall.kill();
        }

        this.particleCleanupCalls.clear();
        this.pulseParticles = [];
    }

    private calculateArmOpacity(sweep: number): number {
        const fadeStartSweep = 322;
        const fadeEndSweep = 360;
        const progress = gsap.utils.normalize(fadeStartSweep, fadeEndSweep, sweep);
        const clampedProgress = gsap.utils.clamp(0, 1, progress);
        return 1 - clampedProgress * clampedProgress;
    }

    private getRingPath(): string {
        const clampedSweep = gsap.utils.clamp(0.01, 359.99, this.sweepAngle);
        const radius = INTRO_CONFIG.geometry.ringRadius;
        const center = 50;
        const startX = center + radius;
        const startY = center;
        const endRadian = (-clampedSweep * Math.PI) / 180;
        const endX = center + radius * Math.cos(endRadian);
        const endY = center + radius * Math.sin(endRadian);
        const largeArc = clampedSweep > 180 ? 1 : 0;

        return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 0 ${endX} ${endY}`;
    }

    private getRingFillPath(sweep: number): string {
        const clampedSweep = gsap.utils.clamp(0.01, 359.99, sweep);
        const radius = INTRO_CONFIG.geometry.ringRadius;
        const center = 50;
        const startX = center + radius;
        const startY = center;
        const endRadian = (-clampedSweep * Math.PI) / 180;
        const endX = center + radius * Math.cos(endRadian);
        const endY = center + radius * Math.sin(endRadian);
        const largeArc = clampedSweep > 180 ? 1 : 0;

        return `M ${center} ${center} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 0 ${endX} ${endY} Z`;
    }

    private getRingEndPoint(): { x: number; y: number } {
        const clampedSweep = gsap.utils.clamp(0.01, 359.99, this.sweepAngle);
        const radius = INTRO_CONFIG.geometry.ringRadius;
        const center = 50;
        const endRadian = (-clampedSweep * Math.PI) / 180;

        return {
            x: center + radius * Math.cos(endRadian),
            y: center + radius * Math.sin(endRadian),
        };
    }

    private getLoaderArcPath(): string {
        const center = 50;
        const radius = INTRO_CONFIG.geometry.ringRadius + INTRO_CONFIG.loader.radiusOffset;
        const startAngleDeg = this.loaderAngle;
        const endAngleDeg = startAngleDeg + INTRO_CONFIG.loader.arcSweepDeg;
        const startRad = (-startAngleDeg * Math.PI) / 180;
        const endRad = (-endAngleDeg * Math.PI) / 180;
        const x0 = center + radius * Math.cos(startRad);
        const y0 = center + radius * Math.sin(startRad);
        const x1 = center + radius * Math.cos(endRad);
        const y1 = center + radius * Math.sin(endRad);
        const largeArc = INTRO_CONFIG.loader.arcSweepDeg > 180 ? 1 : 0;

        return `M ${x0} ${y0} A ${radius} ${radius} 0 ${largeArc} 0 ${x1} ${y1}`;
    }

    render() {
        const ringPath = this.getRingPath();
        const center = 50;
        const fillSweep = gsap.utils.clamp(0, 360, this.sweepAngle);
        const isFullFill = fillSweep >= 359.99;
        const shouldShowFill = this.ringFillVisible;
        const ringFillPath = this.getRingFillPath(fillSweep);
        const armEnd = this.getRingEndPoint();
        const armOpacity = this.phase === 'draw' ? this.calculateArmOpacity(this.sweepAngle) : 0;
        const shouldShowArm = armOpacity > 0.01;
        const isStableLike = this.phase === 'stable' || this.phase === 'typing';
        const scaleConfig = isStableLike ? INTRO_CONFIG.stablePulse : INTRO_CONFIG.pulse;
        const ringScale = 1 + scaleConfig.ringScaleGain * this.pulseLevel;
        const strokeScale = 1 + scaleConfig.strokeScaleGain * this.pulseLevel;
        const glowScale = 1 + scaleConfig.glowScaleGain * this.pulseLevel;
        const glowBlurScale = 1 + (glowScale - 1) * INTRO_CONFIG.glow.blurGain;
        const mainGlowBlur = INTRO_CONFIG.glow.blurStdDeviation * glowBlurScale;
        const mainGlowAlpha = Math.min(1, INTRO_CONFIG.glow.alpha + (glowScale - 1) * INTRO_CONFIG.glow.alphaGain);
        const ringStrokeWidth = INTRO_CONFIG.geometry.ringStrokeWidth * strokeScale;
        const armStrokeWidth = INTRO_CONFIG.arm.strokeWidth * strokeScale;
        const loaderPath = this.getLoaderArcPath();
        const loaderGlowBlur = INTRO_CONFIG.loader.glow.blurStdDeviation * (0.9 + glowScale * 0.22);
        const loaderGlowAlpha = Math.min(1, INTRO_CONFIG.loader.glow.alpha + (glowScale - 1) * 0.12);
        const sideGlowStyle = [
            `--intro-side-glow-blur: ${INTRO_CONFIG.sideGlow.blurPx}px`,
            `--intro-side-glow-tone: ${INTRO_CONFIG.sideGlow.tone}`,
        ].join('; ');
        const pulseParticleNodes = this.pulseParticles.map((particle) => {
            const particleStyle = [
                `--particle-angle: ${particle.angleDeg}deg`,
                `--particle-duration: ${particle.durationSec}s`,
                `--particle-delay: ${particle.delaySec}s`,
                `--particle-travel: ${particle.travelPx}px`,
                `--particle-size: ${particle.sizePx}px`,
                `--particle-alpha: ${particle.alpha}`,
            ].join('; ');

            return html`<span class="intro-pulse-particle" style="${particleStyle}"></span>`;
        });
        const scaleTransform = `translate(${center} ${center}) scale(${ringScale}) translate(${-center} ${-center})`;
        const shakeTransform = `translate(${this.shakeOffsetX} ${this.shakeOffsetY})`;

        return html`
            <div id="intro-stage" class="relative grid size-full place-items-center">
                <div id="intro-background-slot" class="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
                    ${this.backgroundReady
                        ? html`<intro-background-effects></intro-background-effects>`
                        : null}
                </div>
                <div id="intro-flash" class="absolute inset-0 z-10 hidden opacity-0 pointer-events-none bg-zinc-100" aria-hidden="true"></div>
                <div id="intro-side-glow-left" class="intro-side-glow absolute top-1/2 left-0 z-3 -translate-y-1/2 opacity-0 pointer-events-none mix-blend-screen" style="${sideGlowStyle}" aria-hidden="true"></div>
                <div id="intro-side-glow-right" class="intro-side-glow absolute top-1/2 right-0 z-3 -translate-y-1/2 opacity-0 pointer-events-none mix-blend-screen" style="${sideGlowStyle}" aria-hidden="true"></div>
                <div id="intro-ring" class="relative z-2 grid aspect-square place-items-center" aria-label="intro-circle">
                    <div id="intro-ring-particles" class="absolute inset-0 z-1 pointer-events-none" aria-hidden="true">
                        ${pulseParticleNodes}
                    </div>
                    <svg
                        id="intro-ring-svg"
                        class="size-full overflow-visible"
                        viewBox="0 0 100 100"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <defs>
                            <filter id="intro-ring-glow-outer" x="-40%" y="-40%" width="180%" height="180%">
                                <feGaussianBlur in="SourceGraphic" stdDeviation="${mainGlowBlur}" result="mainBlur" />
                                <feComposite in="mainBlur" in2="SourceGraphic" operator="out" result="mainGlow" />
                                <feColorMatrix
                                    in="mainGlow"
                                    type="matrix"
                                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${mainGlowAlpha} 0"
                                    result="mainGlowTone"
                                />
                                <feMerge>
                                    <feMergeNode in="mainGlowTone" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                            <filter id="intro-loader-glow-outer" x="-55%" y="-55%" width="210%" height="210%">
                                <feGaussianBlur in="SourceGraphic" stdDeviation="${loaderGlowBlur}" result="loaderBlur" />
                                <feComposite in="loaderBlur" in2="SourceGraphic" operator="out" result="loaderGlow" />
                                <feColorMatrix
                                    in="loaderGlow"
                                    type="matrix"
                                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${loaderGlowAlpha} 0"
                                    result="loaderGlowTone"
                                />
                                <feMerge>
                                    <feMergeNode in="loaderGlowTone" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>
                        <g transform="${shakeTransform}">
                            <g transform="${scaleTransform}">
                                ${shouldShowFill
                                    ? (isFullFill
                                        ? svg`
                                            <circle
                                                id="intro-ring-fill"
                                                cx="${center}"
                                                cy="${center}"
                                                r="${INTRO_CONFIG.geometry.ringRadius}"
                                            />
                                        `
                                        : svg`
                                            <path
                                                id="intro-ring-fill"
                                                d="${ringFillPath}"
                                            />
                                        `)
                                    : null}
                                ${shouldShowArm
                                    ? svg`
                                        <line
                                            id="intro-ring-arm"
                                            x1="${center}"
                                            y1="${center}"
                                            x2="${armEnd.x}"
                                            y2="${armEnd.y}"
                                            stroke-width="${armStrokeWidth}"
                                            opacity="${armOpacity}"
                                        ></line>
                                    `
                                    : null}
                                <path
                                    id="intro-ring-path"
                                    d="${ringPath}"
                                    stroke-width="${ringStrokeWidth}"
                                />
                                ${isStableLike
                                    ? svg`
                                        <path
                                            id="intro-ring-loader"
                                            d="${loaderPath}"
                                            stroke-width="${INTRO_CONFIG.loader.strokeWidth}"
                                        />
                                    `
                                    : null}
                            </g>
                        </g>
                    </svg>
                    <div id="intro-cube" class="absolute left-1/2 top-1/2 z-4 grid place-items-center opacity-0 pointer-events-none" aria-hidden="true">
                        <ascii-cube></ascii-cube>
                    </div>
                    <div id="intro-typing" class="${this.phase === 'typing' ? 'is-visible' : ''} absolute left-1/2 z-5 w-max -translate-x-1/2 opacity-0 pointer-events-none transition-opacity duration-300 ease-out" aria-live="polite">
                        <div id="intro-typing-measure" class="invisible whitespace-pre font-mono text-2xl tracking-[0.02em]">$ ${INTRO_CONFIG.typing.message}_</div>
                        <div id="intro-typing-line" class="absolute inset-0 flex items-center whitespace-pre font-mono text-2xl tracking-[0.02em] text-[rgba(225,255,255,0.98)] [text-shadow:0_0_8px_rgba(116,237,255,0.58),0_0_18px_rgba(92,210,255,0.36)]">
                            <span id="intro-typing-prompt">$</span>
                            <span id="intro-typing-space">&nbsp;</span>
                            <span id="intro-typing-text">${this.typedMessage}</span>
                            <span id="intro-typing-cursor">_</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}