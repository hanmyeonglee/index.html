import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { tailwindSheet } from './shared-styles';
import { randomInRange } from './utils';

type Side = 'top' | 'right' | 'bottom' | 'left';

type Point = {
    x: number;
    y: number;
};

type LaserBeam = {
    id: number;
    pathD: string;
    pathLength: number;
    start: Point;
    end: Point;
    drawDurationMs: number;
    fadeDelayMs: number;
    fadeDurationMs: number;
};

const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];
const DEG_45 = 45;
const DUAL_BEAM_CHANCE = 0.14;

@customElement('intro-laser-beam')
export class IntroLaserBeam extends LitElement {
    static styles = css`
        :host {
            position: absolute;
            inset: 0;
            display: block;
            pointer-events: none;
        }

        .beam-layer {
            position: absolute;
            inset: 0;
            overflow: hidden;
        }

        .beam-svg {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            overflow: visible;
        }

        .beam-group {
            position: absolute;
            inset: 0;
            opacity: 1;
            animation: beam-fade var(--beam-fade-duration, 620ms) ease-out var(--beam-fade-delay, 260ms) forwards;
        }

        .beam-path {
            fill: none;
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke-dasharray: var(--beam-path-length, 100px);
            stroke-dashoffset: var(--beam-path-length, 100px);
            animation: beam-draw var(--beam-draw-duration, 18ms) linear forwards;
        }

        .beam-path.glow {
            stroke-width: clamp(2.4px, 0.55vmin, 5.8px);
            opacity: 0.9;
            filter:
                drop-shadow(0 0 5px rgba(255, 228, 100, 0.95))
                drop-shadow(0 0 14px rgba(255, 168, 56, 0.84))
                drop-shadow(0 0 30px rgba(255, 80, 26, 0.62))
                drop-shadow(0 0 52px rgba(255, 30, 20, 0.36));
        }

        .beam-path.core {
            stroke-width: clamp(1.1px, 0.22vmin, 2.7px);
            opacity: 0.98;
        }

        @keyframes beam-draw {
            from {
                stroke-dashoffset: var(--beam-path-length, 100px);
            }

            to {
                stroke-dashoffset: 0;
            }
        }

        @keyframes beam-fade {
            from {
                opacity: 1;
            }

            to {
                opacity: 0;
            }
        }
    `;

    @state()
    private beams: LaserBeam[] = [];

    private beamIdSeed = 0;

    private spawnTimerId?: number;

    private readonly cleanupTimerIds = new Map<number, number>();

    connectedCallback(): void {
        super.connectedCallback();

        if (this.shadowRoot && !this.shadowRoot.adoptedStyleSheets.includes(tailwindSheet)) {
            this.shadowRoot.adoptedStyleSheets = [
                ...this.shadowRoot.adoptedStyleSheets,
                tailwindSheet,
            ];
        }

        this.scheduleNextBeam(320);
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

        for (const timerId of this.cleanupTimerIds.values()) {
            window.clearTimeout(timerId);
        }

        this.cleanupTimerIds.clear();
        this.beams = [];
    }

    private scheduleNextBeam(delayMs?: number): void {
        const nextDelay = delayMs ?? randomInRange(4500, 7500);

        this.spawnTimerId = window.setTimeout(() => {
            this.spawnBeam();

            if (Math.random() < DUAL_BEAM_CHANCE) {
                this.spawnBeam();
            }

            this.scheduleNextBeam();
        }, nextDelay);
    }

    private spawnBeam(): void {
        const rect = this.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 40) {
            return;
        }

        const beamId = ++this.beamIdSeed;
        const points = this.createLaserPoints(rect.width, rect.height);
        const pathMetrics = this.createPathMetrics(points);
        if (pathMetrics.pathLength < 2) {
            return;
        }

        const drawDurationMs = randomInRange(10, 20);
        const finalDrawEndMs = drawDurationMs;
        const fadeDelayMs = finalDrawEndMs + randomInRange(160, 260);
        const fadeDurationMs = randomInRange(1020, 1980);

        const beam: LaserBeam = {
            id: beamId,
            pathD: pathMetrics.pathD,
            pathLength: pathMetrics.pathLength,
            start: points[0],
            end: points[points.length - 1],
            drawDurationMs,
            fadeDelayMs,
            fadeDurationMs,
        };

        this.beams = [...this.beams, beam];

        const cleanupMs = fadeDelayMs + fadeDurationMs + 50;
        const cleanupId = window.setTimeout(() => {
            this.beams = this.beams.filter((currentBeam) => currentBeam.id !== beamId);
            this.cleanupTimerIds.delete(beamId);
        }, cleanupMs);

        this.cleanupTimerIds.set(beamId, cleanupId);
    }

    private createLaserPoints(width: number, height: number): Point[] {
        const margin = 8;
        const startSide = SIDES[randomInRange(0, SIDES.length)];
        const endSide = this.pickDifferentSide(startSide);
        const startPoint = this.pickPointOnSide(startSide, width, height, margin);
        const endPoint = this.pickPointOnSide(endSide, width, height, margin);

        const points: Point[] = [startPoint];
        let current = startPoint;
        let prevDirIndex = randomInRange(0, 8);

        const wanderCount = randomInRange(2, 6);
        for (let idx = 0; idx < wanderCount; idx++) {
            const next = this.pickWanderPoint(current, endPoint, width, height, margin, prevDirIndex);
            points.push(next.point);
            current = next.point;
            prevDirIndex = next.dirIndex;
        }

        const finalPath = this.connectToTarget(current, endPoint);
        points.push(...finalPath);

        return this.compactPoints(points);
    }

    private createPathMetrics(points: Point[]): { pathD: string; pathLength: number } {
        if (points.length < 2) {
            return { pathD: '', pathLength: 0 };
        }

        let pathD = `M ${points[0].x} ${points[0].y}`;
        let pathLength = 0;

        for (let idx = 1; idx < points.length; idx++) {
            const prev = points[idx - 1];
            const curr = points[idx];
            pathD += ` L ${curr.x} ${curr.y}`;
            pathLength += Math.hypot(curr.x - prev.x, curr.y - prev.y);
        }

        return { pathD, pathLength };
    }

    private pickDifferentSide(side: Side): Side {
        const candidates = this.getPerpendicularSides(side);
        return candidates[randomInRange(0, candidates.length)];
    }

    private getPerpendicularSides(side: Side): Side[] {
        if (side === 'top' || side === 'bottom') {
            return ['left', 'right'];
        }

        return ['top', 'bottom'];
    }

    private pickPointOnSide(side: Side, width: number, height: number, margin: number): Point {
        if (side === 'top') {
            return { x: randomInRange(margin, width - margin), y: margin };
        }

        if (side === 'right') {
            return { x: width - margin, y: randomInRange(margin, height - margin) };
        }

        if (side === 'bottom') {
            return { x: randomInRange(margin, width - margin), y: height - margin };
        }

        return { x: margin, y: randomInRange(margin, height - margin) };
    }

    private pickWanderPoint(current: Point, target: Point, width: number, height: number, margin: number, prevDirIndex: number): { point: Point; dirIndex: number } {
        const turnCandidates = [-2, -1, 1, 2];
        const shuffledTurns = this.shuffle(turnCandidates);

        for (const turn of shuffledTurns) {
            const dirIndex = this.wrapDirIndex(prevDirIndex + turn);
            const dir = this.dirFromIndex(dirIndex);
            const distance = randomInRange(90, 260);
            const nextPoint: Point = {
                x: current.x + dir.x * distance,
                y: current.y + dir.y * distance,
            };

            if (!this.isInside(nextPoint, width, height, margin)) {
                continue;
            }

            return { point: nextPoint, dirIndex };
        }

        const fallback = this.connectToTarget(current, target);
        return {
            point: fallback[0] ?? target,
            dirIndex: prevDirIndex,
        };
    }

    private connectToTarget(current: Point, target: Point): Point[] {
        const points: Point[] = [];
        const dx = target.x - current.x;
        const dy = target.y - current.y;

        if (dx === 0 && dy === 0) {
            return points;
        }

        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        const sx = Math.sign(dx);
        const sy = Math.sign(dy);

        let cursor = { ...current };

        if (absDx > absDy) {
            const horizontalFirst = absDx - absDy;
            if (horizontalFirst > 0) {
                cursor = {
                    x: cursor.x + sx * horizontalFirst,
                    y: cursor.y,
                };
                points.push(cursor);
            }
        } else if (absDy > absDx) {
            const verticalFirst = absDy - absDx;
            if (verticalFirst > 0) {
                cursor = {
                    x: cursor.x,
                    y: cursor.y + sy * verticalFirst,
                };
                points.push(cursor);
            }
        }

        if (cursor.x !== target.x || cursor.y !== target.y) {
            points.push(target);
        }

        return points;
    }

    private compactPoints(points: Point[]): Point[] {
        if (points.length <= 1) {
            return points;
        }

        const compacted: Point[] = [points[0]];
        for (let idx = 1; idx < points.length; idx++) {
            const prev = compacted[compacted.length - 1];
            const curr = points[idx];
            if (prev.x === curr.x && prev.y === curr.y) {
                continue;
            }
            compacted.push(curr);
        }

        return compacted;
    }

    private dirFromIndex(index: number): Point {
        const angleRad = (index * DEG_45 * Math.PI) / 180;
        return {
            x: Math.round(Math.cos(angleRad)),
            y: Math.round(Math.sin(angleRad)),
        };
    }

    private wrapDirIndex(index: number): number {
        return ((index % 8) + 8) % 8;
    }

    private isInside(point: Point, width: number, height: number, margin: number): boolean {
        return point.x >= margin && point.x <= width - margin && point.y >= margin && point.y <= height - margin;
    }

    private shuffle<T>(list: T[]): T[] {
        const copied = [...list];

        for (let idx = copied.length - 1; idx > 0; idx--) {
            const swapIndex = randomInRange(0, idx + 1);
            [copied[idx], copied[swapIndex]] = [copied[swapIndex], copied[idx]];
        }

        return copied;
    }

    render() {
        return html`
            <div class="beam-layer absolute inset-0">
                ${repeat(this.beams, (beam) => beam.id, (beam) => {
                    const beamStyle = [
                        `--beam-fade-delay: ${beam.fadeDelayMs}ms`,
                        `--beam-fade-duration: ${beam.fadeDurationMs}ms`,
                    ].join('; ');

                    const pathStyle = [
                        `--beam-path-length: ${beam.pathLength}px`,
                        `--beam-draw-duration: ${beam.drawDurationMs}ms`,
                    ].join('; ');

                    const gradientId = `beam-gradient-${beam.id}`;

                    return html`
                        <div class="beam-group" style="${beamStyle}">
                            <svg class="beam-svg" width="100%" height="100%">
                                <defs>
                                    <linearGradient
                                        id="${gradientId}"
                                        gradientUnits="userSpaceOnUse"
                                        x1="${beam.start.x}"
                                        y1="${beam.start.y}"
                                        x2="${beam.end.x}"
                                        y2="${beam.end.y}"
                                    >
                                        <stop offset="0%" stop-color="rgba(255, 236, 92, 0.98)" />
                                        <stop offset="42%" stop-color="rgba(255, 183, 42, 0.96)" />
                                        <stop offset="74%" stop-color="rgba(255, 88, 36, 0.94)" />
                                        <stop offset="100%" stop-color="rgba(255, 36, 24, 0.9)" />
                                    </linearGradient>
                                </defs>
                                <path
                                    class="beam-path glow"
                                    style="${pathStyle}"
                                    d="${beam.pathD}"
                                    stroke="url(#${gradientId})"
                                ></path>
                                <path
                                    class="beam-path core"
                                    style="${pathStyle}"
                                    d="${beam.pathD}"
                                    stroke="url(#${gradientId})"
                                ></path>
                            </svg>
                        </div>
                    `;
                })}
            </div>
        `;
    }
}
