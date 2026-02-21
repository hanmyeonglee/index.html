import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { tailwindSheet } from './shared-styles';
import { randomInRange, sampleNormal } from './utils';

type MatrixDropConfig = {
    chars: string;
    spawnDelayMean: number;
    spawnDelayStd: number;
    durationMsMean: number;
    durationMsStd: number;
    scaleMean: number;
    scaleStd: number;
    changePossibility: number;
};

type MatrixDrop = {
    id: number;
    text: string;
    leftPct: number;
    startYVh: number;
    travelYVh: number;
    durationSec: number;
    opacity: number;
    scale: number;
};

const MATRIX_CONFIG: MatrixDropConfig = {
    chars: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~',
    spawnDelayMean: 250,
    spawnDelayStd: 50,
    durationMsMean: 2880,
    durationMsStd: 920,
    scaleMean: 2,
    scaleStd: 0.75,
    changePossibility: 0.6,
};

@customElement('intro-matrix-rain')
export class IntroMatrixRain extends LitElement {
    static styles = css`
        :host {
            position: absolute;
            inset: 0;
            display: block;
            pointer-events: none;
        }

        .matrix-drop {
            position: absolute;
            top: 0;
            color: rgba(126, 255, 145, var(--matrix-opacity, 0.82));
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: clamp(13px, 1.6vmin, 18px);
            font-weight: 600;
            letter-spacing: 0.08em;
            white-space: pre;
            text-shadow:
                0 0 6px rgba(105, 255, 129, 0.88),
                0 0 14px rgba(66, 232, 120, 0.62),
                0 0 26px rgba(36, 186, 94, 0.32);
            will-change: transform, opacity;
            transform: translate(-50%, var(--matrix-start-y, -18vh)) scale(var(--matrix-scale, 1));
            animation: matrix-drop-fall var(--matrix-duration, 2.1s) linear forwards;
        }

        @keyframes matrix-drop-fall {
            0% {
                opacity: 0;
                transform: translate(-50%, var(--matrix-start-y, -18vh)) scale(var(--matrix-scale, 1));
            }

            15% {
                opacity: var(--matrix-opacity, 0.82);
            }

            82% {
                opacity: calc(var(--matrix-opacity, 0.82) * 0.9);
            }

            100% {
                opacity: 0;
                transform: translate(-50%, calc(var(--matrix-start-y, -18vh) + var(--matrix-travel-y, 56vh))) scale(var(--matrix-scale, 1));
            }
        }
    `;

    @state()
    private matrixDrops: MatrixDrop[] = [];

    private spawnTimerId?: number;

    private dropIdSeed = 0;

    private readonly cleanupTimers = new Map<number, number>();

    private readonly changeTimers = new Map<number, number>();

    connectedCallback(): void {
        super.connectedCallback();

        if (this.shadowRoot && !this.shadowRoot.adoptedStyleSheets.includes(tailwindSheet)) {
            this.shadowRoot.adoptedStyleSheets = [
                ...this.shadowRoot.adoptedStyleSheets,
                tailwindSheet,
            ];
        }

        this.scheduleNextDrop(140);
    }

    disconnectedCallback(): void {
        this.stopAnimation();
        super.disconnectedCallback();
    }

    private stopAnimation(): void {
        if (this.spawnTimerId !== undefined) {
            window.clearTimeout(this.spawnTimerId);
            this.spawnTimerId = undefined;
        }

        Array.from(this.cleanupTimers.values()).map(window.clearTimeout);
        Array.from(this.changeTimers.values()).map(window.clearTimeout);

        this.cleanupTimers.clear();
        this.changeTimers.clear();
        this.matrixDrops = [];
    }

    private scheduleNextDrop(delayMs?: number): void {
        const sampledDelay = delayMs ?? sampleNormal(MATRIX_CONFIG.spawnDelayMean, MATRIX_CONFIG.spawnDelayStd, 220, 5200);

        this.spawnTimerId = window.setTimeout(() => {
            this.spawnDrop();
            this.scheduleNextDrop();
        }, sampledDelay);
    }

    private spawnDrop(): void {
        const dropId = ++this.dropIdSeed;
        const durationMs = sampleNormal(MATRIX_CONFIG.durationMsMean, MATRIX_CONFIG.durationMsStd, 650, 4300);
        const scale = sampleNormal(MATRIX_CONFIG.scaleMean, MATRIX_CONFIG.scaleStd, 0.66, 1.42);
        const textLength = randomInRange(1, 3);
        const randomGlyphCluster = (length: number) => Array.from({ length }, () => randomInRange(0, MATRIX_CONFIG.chars.length - 1)).map(i => MATRIX_CONFIG.chars[i]).join('\n');
        const drop: MatrixDrop = {
            id: dropId,
            text: randomGlyphCluster(textLength),
            leftPct: randomInRange(4, 96),
            startYVh: randomInRange(-20, 8),
            travelYVh: randomInRange(32, 76),
            durationSec: durationMs / 1000,
            opacity: sampleNormal(0.78, 0.12, 0.45, 0.98),
            scale,
        };

        this.matrixDrops = [...this.matrixDrops, drop];

        const cleanupTimerId = window.setTimeout(() => {
            this.removeDrop(dropId);
        }, durationMs + 120);
        this.cleanupTimers.set(dropId, cleanupTimerId);

        if (Math.random() <= MATRIX_CONFIG.changePossibility) {
            const changeTimerId = window.setTimeout(() => {
                this.matrixDrops = this.matrixDrops.map((currentDrop) => (
                    currentDrop.id === dropId
                        ? { ...currentDrop, text: randomGlyphCluster(currentDrop.text.length) }
                        : currentDrop
                ));
            }, durationMs * randomInRange(0.34, 0.74));

            this.changeTimers.set(dropId, changeTimerId);
        }
    }

    private removeDrop(dropId: number): void {
        this.matrixDrops = this.matrixDrops.filter((drop) => drop.id !== dropId);

        const cleanupTimerId = this.cleanupTimers.get(dropId);
        if (cleanupTimerId !== undefined) {
            window.clearTimeout(cleanupTimerId);
            this.cleanupTimers.delete(dropId);
        }

        const changeTimerId = this.changeTimers.get(dropId);
        if (changeTimerId !== undefined) {
            window.clearTimeout(changeTimerId);
            this.changeTimers.delete(dropId);
        }
    }

    render() {
        return html`
            <div class="intro-bg-matrix absolute inset-0">
                ${repeat(this.matrixDrops, (drop) => drop.id, (drop) => {
                    const matrixStyle = [
                        `left: ${drop.leftPct}%`,
                        `--matrix-start-y: ${drop.startYVh}vh`,
                        `--matrix-travel-y: ${drop.travelYVh}vh`,
                        `--matrix-duration: ${drop.durationSec}s`,
                        `--matrix-opacity: ${drop.opacity}`,
                        `--matrix-scale: ${drop.scale}`,
                    ].join('; ');

                    return html`<span class="matrix-drop whitespace-pre-line leading-2" style="${matrixStyle}">${drop.text}</span>`;
                })}
            </div>
        `;
    }
}
