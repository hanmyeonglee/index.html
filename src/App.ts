import { LitElement, html, svg } from 'lit'
import { customElement, query, state } from 'lit/decorators.js'
import gsap from 'gsap'

import "./App.css";
import './ascii-cube.js'

const INTRO_CONFIG = {
    geometry: {
        ringRadius: 45,
        ringStrokeWidth: 0.58,
    },
    draw: {
        durationMs: 1800,
        ease: 'power1.inOut',
    },
    arm: {
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
        startDelayAfterCubeMs: 240,
        charDelayMs: 66,
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

    @state()
    private typingVisible = false;

    @state()
    private typedMessage = '';

    private drawTween?: gsap.core.Tween;
    private pulseTimeline?: gsap.core.Timeline;
    private shakeTween?: gsap.core.Tween;
    private flashTimeline?: gsap.core.Timeline;
    private stablePulseTween?: gsap.core.Tween;
    private loaderTween?: gsap.core.Tween;
    private cubeTween?: gsap.core.Tween;
    private sideGlowTween?: gsap.core.Tween;
    private typingTimeline?: gsap.core.Timeline;

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
        this.typingTimeline?.kill();
        this.drawTween = undefined;
        this.pulseTimeline = undefined;
        this.shakeTween = undefined;
        this.flashTimeline = undefined;
        this.stablePulseTween = undefined;
        this.loaderTween = undefined;
        this.cubeTween = undefined;
        this.sideGlowTween = undefined;
        this.typingTimeline = undefined;
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
        this.typingVisible = false;
        this.typedMessage = '';
        gsap.set(this.cubeLayer, {
            opacity: 0,
            '--intro-cube-scale': 0.94,
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
                opacity: 1,
                duration: 0.52,
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
            '--intro-cube-scale': 1,
            duration: 0.9,
            ease: 'power2.out',
            onComplete: () => {
                this.startTyping();
            },
        });
    }

    private startTyping(): void {
        this.typingTimeline?.kill();
        this.typingVisible = true;
        this.typedMessage = '';

        const message = INTRO_CONFIG.typing.message;
        const timeline = gsap.timeline({
            delay: INTRO_CONFIG.typing.startDelayAfterCubeMs / 1000,
        });

        let cursor = 0;
        for (let idx = 1; idx <= message.length; idx++) {
            timeline.call(() => {
                this.typedMessage = message.slice(0, idx);
            }, [], cursor);

            if (idx < message.length) {
                cursor += INTRO_CONFIG.typing.charDelayMs / 1000;
            }
        }

        this.typingTimeline = timeline;
    }

    private lerp(start: number, end: number, t: number): number {
        return start + (end - start) * t;
    }

    private calculateArmOpacity(sweep: number): number {
        const fadeStartSweep = 322;
        const fadeEndSweep = 360;

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
        const clampedSweep = Math.max(0.01, Math.min(this.sweepAngle, 359.99));
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

    private getRingEndPoint(): { x: number; y: number } {
        const clampedSweep = Math.max(0.01, Math.min(this.sweepAngle, 359.99));
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
        const armEnd = this.getRingEndPoint();
        const shouldShowArm = this.armOpacity > 0.01;
        const glowBlurScale = 1 + (this.glowScale - 1) * INTRO_CONFIG.glow.blurGain;
        const mainGlowBlur = INTRO_CONFIG.glow.blurStdDeviation * glowBlurScale;
        const mainGlowAlpha = Math.min(1, INTRO_CONFIG.glow.alpha + (this.glowScale - 1) * INTRO_CONFIG.glow.alphaGain);
        const ringStrokeWidth = INTRO_CONFIG.geometry.ringStrokeWidth * this.strokeScale;
        const armStrokeWidth = INTRO_CONFIG.arm.strokeWidth * this.strokeScale;
        const loaderPath = this.getLoaderArcPath();
        const loaderGlowBlur = INTRO_CONFIG.loader.glow.blurStdDeviation * (0.9 + this.glowScale * 0.22);
        const loaderGlowAlpha = Math.min(1, INTRO_CONFIG.loader.glow.alpha + (this.glowScale - 1) * 0.12);
        const sideGlowStyle = [
            `--intro-side-glow-blur: ${INTRO_CONFIG.sideGlow.blurPx}px`,
            `--intro-side-glow-tone: ${INTRO_CONFIG.sideGlow.tone}`,
        ].join('; ');
        const scaleTransform = `translate(${center} ${center}) scale(${this.ringScale}) translate(${-center} ${-center})`;
        const shakeTransform = `translate(${this.shakeOffsetX} ${this.shakeOffsetY})`;

        return html`
            <div id="intro-stage" class="relative grid size-full place-items-center">
                <div id="intro-flash" class="absolute inset-0 z-10 hidden opacity-0 pointer-events-none bg-zinc-100" aria-hidden="true"></div>
                <div id="intro-side-glow-left" class="intro-side-glow absolute top-1/2 left-[clamp(8px,1.5vw,28px)] z-3 -translate-y-1/2 rounded-full opacity-0 pointer-events-none" style="${sideGlowStyle}" aria-hidden="true"></div>
                <div id="intro-side-glow-right" class="intro-side-glow absolute top-1/2 right-[clamp(8px,1.5vw,28px)] z-3 -translate-y-1/2 rounded-full opacity-0 pointer-events-none" style="${sideGlowStyle}" aria-hidden="true"></div>
                <div id="intro-ring" class="relative z-2 grid aspect-square place-items-center" aria-label="intro-circle">
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
                    <div id="intro-cube" class="absolute left-1/2 top-1/2 z-4 grid place-items-center opacity-0 pointer-events-none" aria-hidden="true">
                        <ascii-cube></ascii-cube>
                    </div>
                    <div id="intro-typing" class="${this.typingVisible ? 'is-visible' : ''} absolute left-1/2 z-5 w-max -translate-x-1/2 opacity-0 pointer-events-none transition-opacity duration-300 ease-out" aria-live="polite">
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