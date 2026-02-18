import { LitElement, html, svg } from 'lit'
import { customElement, query, state } from 'lit/decorators.js'
import gsap from 'gsap'

import "./App.css";
import './ascii-cube.js'

const INTRO_CONFIG = {
    geometry: {
        viewBoxSize: 100,
        ringRadius: 45,
        minVisibleSweep: 0.01,
        maxArcSweep: 359.99,
        ringStrokeWidth: 0.58,
    },
    draw: {
        durationMs: 1800,
        ease: 'power1.inOut',
    },
    arm: {
        fadeStartSweep: 322,
        fadeEndSweep: 360,
        minVisibleOpacity: 0.01,
        strokeWidth: 0.34,
    },
    pulse: {
        count: 4,
        expandDurationMs: 500,
        settleDurationMs: 750,
        ringScaleGain: 0.065,
        strokeScaleGain: 0.55,
        glowScaleGain: 1.35,
        shakeAmplitudeMin: 0,
        shakeAmplitudeMax: 0,
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
            innerBlurStdDeviation: 2.4,
            outerBlurStdDeviation: 100,
            innerAlpha: 0.86,
            outerAlpha: 0.98,
        },
    },
    glow: {
        baseInnerBlurStdDeviation: 2.8,
        baseOuterBlurStdDeviation: 7.8,
        blurGain: 1.2,
        baseInnerAlpha: 0.62,
        baseOuterAlpha: 0.48,
        maxInnerAlpha: 0.9,
        maxOuterAlpha: 0.82,
        alphaGain: 0.22,
    },
    flash: {
        fadeInMs: 400,
        holdMs: 50,
        fadeOutMs: 500,
        maxOpacity: 0.9,
    },
    cube: {
        fadeInMs: 900,
        startScale: 0.94,
        endScale: 1,
        ease: 'power2.out',
        offsetXPercent: 0,
        offsetYPercent: 0,
    },
    sideGlow: {
        fadeInMs: 520,
        maxOpacity: 1,
        widthVmin: 1.2,
        widthMinPx: 10,
        widthMaxPx: 18,
        heightVh: 78,
        heightMinPx: 360,
        heightMaxPx: 860,
        blurPx: 1.6,
        edgeOffsetVw: 1.5,
        edgeOffsetMinPx: 8,
        edgeOffsetMaxPx: 28,
        gradTop: 'rgba(70, 235, 255, 0.14)',
        gradUpper: 'rgba(62, 230, 255, 0.84)',
        gradMid: 'rgba(138, 92, 255, 1)',
        gradLower: 'rgba(72, 225, 255, 0.84)',
        gradBottom: 'rgba(90, 190, 255, 0.14)',
        glowNear: 'rgba(90, 235, 255, 0.88)',
        glowMid: 'rgba(132, 112, 255, 0.72)',
        glowFar: 'rgba(156, 94, 255, 0.58)',
        glowWide: 'rgba(90, 190, 255, 0.42)',
        glowNearRadiusPx: 20,
        glowMidRadiusPx: 46,
        glowFarRadiusPx: 100,
        glowWideRadiusPx: 150,
    },
};

@customElement('root-app')
export class App extends LitElement {
    @state()
    private sweepAngle = 0;

    @state()
    private armOpacity = 1;

    @state()
    private ringScale = 1;

    @state()
    private strokeScale = 1;

    @state()
    private glowScale = 1;

    @state()
    private shakeOffsetX = 0;

    @state()
    private shakeOffsetY = 0;

    @state()
    private loaderAngle = INTRO_CONFIG.loader.initialAngleDeg;

    @state()
    private isStablePhase = false;

    private drawTween?: gsap.core.Tween;
    private pulseTimeline?: gsap.core.Timeline;
    private shakeTween?: gsap.core.Tween;
    private flashTimeline?: gsap.core.Timeline;
    private stablePulseTween?: gsap.core.Tween;
    private loaderTween?: gsap.core.Tween;
    private cubeTween?: gsap.core.Tween;
    private sideGlowTween?: gsap.core.Tween;

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
        this.drawTween?.kill();
        this.pulseTimeline?.kill();
        this.shakeTween?.kill();
        this.flashTimeline?.kill();
        this.stablePulseTween?.kill();
        this.loaderTween?.kill();
        this.cubeTween?.kill();
        this.sideGlowTween?.kill();
        this.drawTween = undefined;
        this.pulseTimeline = undefined;
        this.shakeTween = undefined;
        this.flashTimeline = undefined;
        this.stablePulseTween = undefined;
        this.loaderTween = undefined;
        this.cubeTween = undefined;
        this.sideGlowTween = undefined;
    }

    private startIntroRingAnimation(): void {
        this.sweepAngle = 0;
        this.armOpacity = 1;
        this.ringScale = 1;
        this.strokeScale = 1;
        this.glowScale = 1;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
        this.loaderAngle = INTRO_CONFIG.loader.initialAngleDeg;
        this.isStablePhase = false;
        gsap.set(this.cubeLayer, {
            opacity: 0,
            '--intro-cube-scale': INTRO_CONFIG.cube.startScale,
        });
        gsap.set([this.sideGlowLeft, this.sideGlowRight], { opacity: 0 });

        const target = { value: 0 };
        this.drawTween?.kill();
        this.drawTween = gsap.to(target, {
            value: 360,
            duration: INTRO_CONFIG.draw.durationMs / 1000,
            ease: INTRO_CONFIG.draw.ease,
            onUpdate: () => {
                this.sweepAngle = target.value;
                this.armOpacity = this.calculateArmOpacity(this.sweepAngle);
            },
            onComplete: () => {
                this.sweepAngle = 360;
                this.armOpacity = 0;
                this.startPulsePhase();
            },
        });
    }

    private startPulsePhase(): void {
        this.pulseTimeline?.kill();

        const timeline = gsap.timeline();

        for (let idx = 0; idx < INTRO_CONFIG.pulse.count; idx++) {
            const isLastPulse = idx === INTRO_CONFIG.pulse.count - 1;
            const intensity = (idx + 1) / INTRO_CONFIG.pulse.count;
            const growScale = 1 + INTRO_CONFIG.pulse.ringScaleGain * intensity;
            const growStroke = 1 + INTRO_CONFIG.pulse.strokeScaleGain * intensity;
            const growGlow = 1 + INTRO_CONFIG.pulse.glowScaleGain * intensity;
            const shakeAmp = this.lerp(INTRO_CONFIG.pulse.shakeAmplitudeMin, INTRO_CONFIG.pulse.shakeAmplitudeMax, intensity);
            const growSec = INTRO_CONFIG.pulse.expandDurationMs / 1000;
            const settleSec = INTRO_CONFIG.pulse.settleDurationMs / 1000;

            timeline.to(this, {
                ringScale: growScale,
                strokeScale: growStroke,
                glowScale: growGlow,
                duration: growSec,
                ease: 'power2.out',
                onStart: () => {
                    this.startShake(shakeAmp, growSec + settleSec);
                },
            });

            if (isLastPulse) {
                timeline.call(() => {
                    this.triggerFlash();
                }, [], '>');
            }

            timeline.to(this, {
                ringScale: 1,
                strokeScale: 1,
                glowScale: 1,
                duration: settleSec,
                ease: 'power2.inOut',
            });
        }

        this.pulseTimeline = timeline;
    }

    private startShake(amplitude: number, durationSec: number): void {
        this.shakeTween?.kill();

        this.shakeTween = gsap.to({}, {
            duration: durationSec,
            ease: 'none',
            onUpdate: () => {
                this.shakeOffsetX = gsap.utils.random(-amplitude, amplitude, 0.01);
                this.shakeOffsetY = gsap.utils.random(-amplitude, amplitude, 0.01);
            },
            onComplete: () => {
                gsap.to(this, {
                    shakeOffsetX: 0,
                    shakeOffsetY: 0,
                    duration: 0.08,
                    ease: 'power2.out',
                });
            },
        });
    }

    private triggerFlash(): void {
        this.flashTimeline?.kill();
        this.sideGlowTween?.kill();

        this.flashTimeline = gsap.timeline({
            onComplete: () => {
                gsap.set(this.flashLayer, { display: 'none' });
                this.enterStablePhase();
            },
        });

        gsap.set(this.flashLayer, { display: 'block', opacity: 0 });

        this.flashTimeline
            .to(this.flashLayer, {
                opacity: INTRO_CONFIG.flash.maxOpacity,
                duration: INTRO_CONFIG.flash.fadeInMs / 1000,
                ease: 'power2.out',
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
                opacity: INTRO_CONFIG.sideGlow.maxOpacity,
                duration: INTRO_CONFIG.sideGlow.fadeInMs / 1000,
                ease: 'power2.out',
            }, '<');
    }

    private enterStablePhase(): void {
        this.isStablePhase = true;
        this.startStablePulse();
        this.startLoaderRotation();
        this.fadeInCube();
    }

    private startStablePulse(): void {
        this.stablePulseTween?.kill();

        this.stablePulseTween = gsap.to(this, {
            ringScale: 1 + INTRO_CONFIG.stablePulse.ringScaleGain,
            strokeScale: 1 + INTRO_CONFIG.stablePulse.strokeScaleGain,
            glowScale: 1 + INTRO_CONFIG.stablePulse.glowScaleGain,
            duration: INTRO_CONFIG.stablePulse.durationMs / 1000,
            ease: INTRO_CONFIG.stablePulse.ease,
            repeat: -1,
            yoyo: true,
        });
    }

    private startLoaderRotation(): void {
        this.loaderTween?.kill();

        this.loaderTween = gsap.to(this, {
            loaderAngle: this.loaderAngle + 360,
            duration: INTRO_CONFIG.loader.cycleDurationMs / 1000,
            ease: INTRO_CONFIG.loader.ease,
            repeat: -1,
            onRepeat: () => {
                this.loaderAngle -= 360;
            },
        });
    }

    private fadeInCube(): void {
        this.cubeTween?.kill();

        this.cubeTween = gsap.to(this.cubeLayer, {
            opacity: 1,
            '--intro-cube-scale': INTRO_CONFIG.cube.endScale,
            duration: INTRO_CONFIG.cube.fadeInMs / 1000,
            ease: INTRO_CONFIG.cube.ease,
        });
    }

    private lerp(start: number, end: number, t: number): number {
        return start + (end - start) * t;
    }

    private calculateArmOpacity(sweep: number): number {
        const { fadeStartSweep, fadeEndSweep } = INTRO_CONFIG.arm;

        if (sweep <= fadeStartSweep) {
            return 1;
        }

        if (sweep >= fadeEndSweep) {
            return 0;
        }

        const progress = (sweep - fadeStartSweep) / (fadeEndSweep - fadeStartSweep);
        return Math.max(0, 1 - progress * progress);
    }

    private getRingPath(): string {
        const clampedSweep = Math.max(INTRO_CONFIG.geometry.minVisibleSweep, Math.min(this.sweepAngle, INTRO_CONFIG.geometry.maxArcSweep));
        const radius = INTRO_CONFIG.geometry.ringRadius;
        const center = INTRO_CONFIG.geometry.viewBoxSize / 2;
        const startX = center + radius;
        const startY = center;
        const endRadian = (-clampedSweep * Math.PI) / 180;
        const endX = center + radius * Math.cos(endRadian);
        const endY = center + radius * Math.sin(endRadian);
        const largeArc = clampedSweep > 180 ? 1 : 0;

        return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 0 ${endX} ${endY}`;
    }

    private getRingEndPoint(): { x: number; y: number } {
        const clampedSweep = Math.max(INTRO_CONFIG.geometry.minVisibleSweep, Math.min(this.sweepAngle, INTRO_CONFIG.geometry.maxArcSweep));
        const radius = INTRO_CONFIG.geometry.ringRadius;
        const center = INTRO_CONFIG.geometry.viewBoxSize / 2;
        const endRadian = (-clampedSweep * Math.PI) / 180;

        return {
            x: center + radius * Math.cos(endRadian),
            y: center + radius * Math.sin(endRadian),
        };
    }

    private getLoaderArcPath(): string {
        const center = INTRO_CONFIG.geometry.viewBoxSize / 2;
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
        const center = INTRO_CONFIG.geometry.viewBoxSize / 2;
        const armEnd = this.getRingEndPoint();
        const shouldShowArm = this.armOpacity > INTRO_CONFIG.arm.minVisibleOpacity;
        const glowBlurScale = 1 + (this.glowScale - 1) * INTRO_CONFIG.glow.blurGain;
        const innerGlowBlur = INTRO_CONFIG.glow.baseInnerBlurStdDeviation * glowBlurScale;
        const outerGlowBlur = INTRO_CONFIG.glow.baseOuterBlurStdDeviation * glowBlurScale;
        const innerGlowAlpha = Math.min(
            INTRO_CONFIG.glow.maxInnerAlpha,
            INTRO_CONFIG.glow.baseInnerAlpha + (this.glowScale - 1) * INTRO_CONFIG.glow.alphaGain,
        );
        const outerGlowAlpha = Math.min(
            INTRO_CONFIG.glow.maxOuterAlpha,
            INTRO_CONFIG.glow.baseOuterAlpha + (this.glowScale - 1) * INTRO_CONFIG.glow.alphaGain,
        );
        const ringStrokeWidth = INTRO_CONFIG.geometry.ringStrokeWidth * this.strokeScale;
        const armStrokeWidth = INTRO_CONFIG.arm.strokeWidth * this.strokeScale;
        const loaderPath = this.getLoaderArcPath();
        const loaderGlowInnerBlur = INTRO_CONFIG.loader.glow.innerBlurStdDeviation * (0.9 + this.glowScale * 0.2);
        const loaderGlowOuterBlur = INTRO_CONFIG.loader.glow.outerBlurStdDeviation * (0.9 + this.glowScale * 0.25);
        const loaderGlowInnerAlpha = Math.min(1, INTRO_CONFIG.loader.glow.innerAlpha + (this.glowScale - 1) * 0.12);
        const loaderGlowOuterAlpha = Math.min(1, INTRO_CONFIG.loader.glow.outerAlpha + (this.glowScale - 1) * 0.1);
        const sideGlowStyle = [
            `--intro-side-glow-width: clamp(${INTRO_CONFIG.sideGlow.widthMinPx}px, ${INTRO_CONFIG.sideGlow.widthVmin}vmin, ${INTRO_CONFIG.sideGlow.widthMaxPx}px)`,
            `--intro-side-glow-height: clamp(${INTRO_CONFIG.sideGlow.heightMinPx}px, ${INTRO_CONFIG.sideGlow.heightVh}vh, ${INTRO_CONFIG.sideGlow.heightMaxPx}px)`,
            `--intro-side-glow-blur: ${INTRO_CONFIG.sideGlow.blurPx}px`,
            `--intro-side-glow-edge-offset: clamp(${INTRO_CONFIG.sideGlow.edgeOffsetMinPx}px, ${INTRO_CONFIG.sideGlow.edgeOffsetVw}vw, ${INTRO_CONFIG.sideGlow.edgeOffsetMaxPx}px)`,
            `--intro-side-glow-grad-top: ${INTRO_CONFIG.sideGlow.gradTop}`,
            `--intro-side-glow-grad-upper: ${INTRO_CONFIG.sideGlow.gradUpper}`,
            `--intro-side-glow-grad-mid: ${INTRO_CONFIG.sideGlow.gradMid}`,
            `--intro-side-glow-grad-lower: ${INTRO_CONFIG.sideGlow.gradLower}`,
            `--intro-side-glow-grad-bottom: ${INTRO_CONFIG.sideGlow.gradBottom}`,
            `--intro-side-glow-near-color: ${INTRO_CONFIG.sideGlow.glowNear}`,
            `--intro-side-glow-mid-color: ${INTRO_CONFIG.sideGlow.glowMid}`,
            `--intro-side-glow-far-color: ${INTRO_CONFIG.sideGlow.glowFar}`,
            `--intro-side-glow-wide-color: ${INTRO_CONFIG.sideGlow.glowWide}`,
            `--intro-side-glow-near-radius: ${INTRO_CONFIG.sideGlow.glowNearRadiusPx}px`,
            `--intro-side-glow-mid-radius: ${INTRO_CONFIG.sideGlow.glowMidRadiusPx}px`,
            `--intro-side-glow-far-radius: ${INTRO_CONFIG.sideGlow.glowFarRadiusPx}px`,
            `--intro-side-glow-wide-radius: ${INTRO_CONFIG.sideGlow.glowWideRadiusPx}px`,
        ].join('; ');
        const scaleTransform = `translate(${center} ${center}) scale(${this.ringScale}) translate(${-center} ${-center})`;
        const shakeTransform = `translate(${this.shakeOffsetX} ${this.shakeOffsetY})`;

        return html`
            <div id="intro-stage">
                <div id="intro-flash" aria-hidden="true"></div>
                <div id="intro-side-glow-left" class="intro-side-glow" style="${sideGlowStyle}" aria-hidden="true"></div>
                <div id="intro-side-glow-right" class="intro-side-glow" style="${sideGlowStyle}" aria-hidden="true"></div>
                <div id="intro-ring" aria-label="intro-circle">
                    <svg
                        id="intro-ring-svg"
                        viewBox="0 0 ${INTRO_CONFIG.geometry.viewBoxSize} ${INTRO_CONFIG.geometry.viewBoxSize}"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <defs>
                            <filter id="intro-ring-glow-outer" x="-40%" y="-40%" width="180%" height="180%">
                                <feGaussianBlur in="SourceGraphic" stdDeviation="${innerGlowBlur}" result="blurInner" />
                                <feGaussianBlur in="SourceGraphic" stdDeviation="${outerGlowBlur}" result="blurOuter" />
                                <feComposite in="blurInner" in2="SourceGraphic" operator="out" result="outerGlowInner" />
                                <feComposite in="blurOuter" in2="SourceGraphic" operator="out" result="outerGlowOuter" />
                                <feColorMatrix
                                    in="outerGlowInner"
                                    type="matrix"
                                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${innerGlowAlpha} 0"
                                    result="glowToneInner"
                                />
                                <feColorMatrix
                                    in="outerGlowOuter"
                                    type="matrix"
                                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${outerGlowAlpha} 0"
                                    result="glowToneOuter"
                                />
                                <feMerge>
                                    <feMergeNode in="glowToneOuter" />
                                    <feMergeNode in="glowToneInner" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                            <filter id="intro-loader-glow-outer" x="-55%" y="-55%" width="210%" height="210%">
                                <feGaussianBlur in="SourceGraphic" stdDeviation="${loaderGlowInnerBlur}" result="loaderBlurInner" />
                                <feGaussianBlur in="SourceGraphic" stdDeviation="${loaderGlowOuterBlur}" result="loaderBlurOuter" />
                                <feComposite in="loaderBlurInner" in2="SourceGraphic" operator="out" result="loaderGlowInner" />
                                <feComposite in="loaderBlurOuter" in2="SourceGraphic" operator="out" result="loaderGlowOuter" />
                                <feColorMatrix
                                    in="loaderGlowInner"
                                    type="matrix"
                                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${loaderGlowInnerAlpha} 0"
                                    result="loaderGlowInnerTone"
                                />
                                <feColorMatrix
                                    in="loaderGlowOuter"
                                    type="matrix"
                                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${loaderGlowOuterAlpha} 0"
                                    result="loaderGlowOuterTone"
                                />
                                <feMerge>
                                    <feMergeNode in="loaderGlowOuterTone" />
                                    <feMergeNode in="loaderGlowInnerTone" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>
                        <g transform="${shakeTransform}">
                            <g transform="${scaleTransform}">
                                ${shouldShowArm
                                    ? svg`
                                        <line
                                            id="intro-ring-arm"
                                            x1="${center}"
                                            y1="${center}"
                                            x2="${armEnd.x}"
                                            y2="${armEnd.y}"
                                            stroke-width="${armStrokeWidth}"
                                            opacity="${this.armOpacity}"
                                        ></line>
                                    `
                                    : null}
                                <path
                                    id="intro-ring-path"
                                    d="${ringPath}"
                                    stroke-width="${ringStrokeWidth}"
                                />
                                ${this.isStablePhase
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
                    <div
                        id="intro-cube"
                        aria-hidden="true"
                        style="--intro-cube-offset-x: ${INTRO_CONFIG.cube.offsetXPercent}%; --intro-cube-offset-y: ${INTRO_CONFIG.cube.offsetYPercent}%;"
                    >
                        <ascii-cube></ascii-cube>
                    </div>
                </div>
            </div>
        `;
    }
}