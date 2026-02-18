import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { tailwindSheet } from './shared-styles'

type Point = { x: number; y: number };

@customElement('blast-door')
export class BlastDoor extends LitElement {
    @state() private svgWidth = 1;
    @state() private doorHeight = 1;
    @state() private topPath = '';
    @state() private bottomPath = '';
    @state() private topInsetPath = '';
    @state() private bottomInsetPath = '';
    @state() private topGlowPath = '';
    @state() private bottomGlowPath = '';

    private resizeObserver?: ResizeObserver;

    connectedCallback() {
        super.connectedCallback();
        this.shadowRoot!.adoptedStyleSheets = [
            ...this.shadowRoot!.adoptedStyleSheets,
            tailwindSheet,
        ];

        window.addEventListener('resize', this.handleResize);
    }

    disconnectedCallback() {
        window.removeEventListener('resize', this.handleResize);
        this.resizeObserver?.disconnect();
        super.disconnectedCallback();
    }

    firstUpdated() {
        this.resizeObserver = new ResizeObserver(() => {
            this.updateDoorGeometry();
        });

        this.resizeObserver.observe(this);
        this.updateDoorGeometry();
    }

    static DIAG_WIDTH_RATIO = 1 / 3;

    static DIAG_ANGLE_DEG = 20;
    static CORRECTION_FACTOR = (1 - Math.cos(BlastDoor.DIAG_ANGLE_DEG * Math.PI / 180)) / Math.sin(BlastDoor.DIAG_ANGLE_DEG * Math.PI / 180);
    
    static BLANK_HEIGHT_PX = 10;

    static CORNER_RADIUS_PX = 16;

    static styles = css`
        :host {
            --blank-height: ${BlastDoor.BLANK_HEIGHT_PX}px;
            --door-step-depth: 2vw;
            --short-side-length: calc((100vw * ${1 - BlastDoor.DIAG_WIDTH_RATIO} - ${BlastDoor.CORRECTION_FACTOR} * var(--blank-height)) * 0.5);
            --long-side-length: calc((100vw * ${1 - BlastDoor.DIAG_WIDTH_RATIO} + ${BlastDoor.CORRECTION_FACTOR} * var(--blank-height)) * 0.5);
            --diag-width: calc(100vw * ${BlastDoor.DIAG_WIDTH_RATIO});
            --diag-height: calc(var(--diag-width) * ${Math.tan(BlastDoor.DIAG_ANGLE_DEG * Math.PI / 180)});
            --upside-translate: calc(var(--diag-height) - var(--blank-height));
            --door-height: calc((100vh + var(--upside-translate)) * 0.5);
        }

        @media (orientation: portrait) {
            :host {
                --door-step-depth: 2.5vh;
            }
        }

        .door {
            width: 100%;
            height: var(--door-height);
            display: block;
        }

        .door-fill {
            fill: #8a8a8a;
        }

        .door-inner-fill {
            fill: rgba(0, 0, 0, 0.14);
        }

        .door-step-shadow {
            fill: none;
            stroke: rgba(0, 0, 0, 0.5);
            stroke-width: 2;
            stroke-linejoin: round;
            stroke-linecap: round;
            filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
        }

        .door-step-highlight {
            fill: none;
            stroke: rgba(255, 255, 255, 0.25);
            stroke-width: 1;
            stroke-linejoin: round;
            stroke-linecap: round;
            transform: translateY(-0.5px);
        }

        .door-outer-rim {
            fill: none;
            stroke: rgba(255, 255, 255, 0.2);
            stroke-width: 1;
            stroke-linejoin: round;
            stroke-linecap: round;
        }

        .door-glow-halo {
            fill: none;
            stroke-width: 8;
            stroke-linecap: round;
            opacity: 0.65;
            filter: blur(4px);
        }

        .door-glow-core {
            fill: none;
            stroke-width: 2.4;
            stroke-linecap: round;
            opacity: 0.95;
            filter: drop-shadow(0 0 3px rgba(59, 255, 255, 0.65)) drop-shadow(0 0 6px rgba(160, 86, 255, 0.55));
        }

        #door-bottom-svg {
            transform: translateY(calc(-1 * var(--upside-translate)));
        }
    `;

    private readonly handleResize = () => {
        this.updateDoorGeometry();
    };

    private resolveCssVarPx(variableName: string, dimension: 'width' | 'height' = 'width'): number {
        const probe = document.createElement('div');
        probe.style.position = 'absolute';
        probe.style.visibility = 'hidden';
        probe.style.pointerEvents = 'none';
        probe.style.left = '-99999px';
        probe.style.top = '-99999px';
        probe.style[dimension] = `var(${variableName})`;

        this.renderRoot.appendChild(probe);
        const computed = getComputedStyle(probe)[dimension];
        probe.remove();

        return parseFloat(computed) || 0;
    }

    private updateDoorGeometry() {
        const width = this.getBoundingClientRect().width || window.innerWidth;
        const shortSideLength = this.resolveCssVarPx('--short-side-length', 'width');
        const longSideLength = this.resolveCssVarPx('--long-side-length', 'width');
        const diagHeight = this.resolveCssVarPx('--diag-height', 'height');
        const calculatedDoorHeight = this.resolveCssVarPx('--door-height', 'height');
        const stepDepth = this.resolveCssVarPx('--door-step-depth', 'width');

        if (!width || !calculatedDoorHeight) {
            return;
        }

        this.svgWidth = width;
        this.doorHeight = calculatedDoorHeight;

        const topVertices = [
            { x: 0, y: 0 },
            { x: 0, y: calculatedDoorHeight },
            { x: shortSideLength, y: calculatedDoorHeight },
            { x: width - longSideLength, y: calculatedDoorHeight - diagHeight },
            { x: width, y: calculatedDoorHeight - diagHeight },
            { x: width, y: 0 },
        ];

        const bottomVertices = [
            { x: width, y: 0 },
            { x: width, y: calculatedDoorHeight },
            { x: 0, y: calculatedDoorHeight },
            { x: 0, y: diagHeight },
            { x: longSideLength, y: diagHeight },
            { x: width - shortSideLength, y: 0 },
        ];

        const insetTopVertices = this.buildInsetPolygon(topVertices, stepDepth);
        const insetBottomVertices = this.buildInsetPolygon(bottomVertices, stepDepth);
        const glowTrim = Math.max(10, stepDepth * 0.8);

        this.topPath = this.buildRoundedPath(topVertices, new Set([1, 2, 3, 4]), BlastDoor.CORNER_RADIUS_PX);
        this.bottomPath = this.buildRoundedPath(bottomVertices, new Set([0, 3, 4, 5]), BlastDoor.CORNER_RADIUS_PX);
        this.topInsetPath = this.buildRoundedPath(insetTopVertices, new Set([1, 2, 3, 4]), Math.max(BlastDoor.CORNER_RADIUS_PX * 0.8, 4));
        this.bottomInsetPath = this.buildRoundedPath(insetBottomVertices, new Set([0, 3, 4, 5]), Math.max(BlastDoor.CORNER_RADIUS_PX * 0.8, 4));

        this.topGlowPath = this.buildTrimmedPolylinePath(
            [topVertices[1], topVertices[2], topVertices[3], topVertices[4]],
            glowTrim,
            glowTrim,
        );
        this.bottomGlowPath = this.buildTrimmedPolylinePath(
            [bottomVertices[3], bottomVertices[4], bottomVertices[5], bottomVertices[0]],
            glowTrim,
            glowTrim,
        );
    }

    private movePointToward(from: Point, to: Point, distance: number): Point {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const length = Math.hypot(dx, dy);

        if (!length || distance <= 0) {
            return from;
        }

        const t = Math.min(1, distance / length);
        return {
            x: from.x + dx * t,
            y: from.y + dy * t,
        };
    }

    private buildTrimmedPolylinePath(points: Array<Point>, trimStart: number, trimEnd: number): string {
        if (points.length < 2) {
            return '';
        }

        const pathPoints = points.map((point) => ({ ...point }));
        pathPoints[0] = this.movePointToward(pathPoints[0], pathPoints[1], trimStart);

        const last = pathPoints.length - 1;
        pathPoints[last] = this.movePointToward(pathPoints[last], pathPoints[last - 1], trimEnd);

        const commands: string[] = [`M ${pathPoints[0].x},${pathPoints[0].y}`];
        for (let i = 1; i < pathPoints.length; i++) {
            commands.push(`L ${pathPoints[i].x},${pathPoints[i].y}`);
        }

        return commands.join(' ');
    }

    private polygonArea(vertices: Array<Point>): number {
        return vertices.map((current, i) => {
            const next = vertices[(i + 1) % vertices.length];
            return current.x * next.y - next.x * current.y;
        }).reduce((sum, value) => sum + value, 0) / 2;
    }

    private lineIntersection(
        a1: Point,
        a2: Point,
        b1: Point,
        b2: Point,
    ): Point | null {
        const a = { x: a2.x - a1.x, y: a2.y - a1.y };
        const b = { x: b2.x - b1.x, y: b2.y - b1.y };
        const denominator = a.x * b.y - a.y * b.x;

        if (Math.abs(denominator) < 0.0001) {
            return null;
        }

        const delta = { x: b1.x - a1.x, y: b1.y - a1.y };
        const t = (delta.x * b.y - delta.y * b.x) / denominator;

        return {
            x: a1.x + a.x * t,
            y: a1.y + a.y * t,
        };
    }

    private buildInsetPolygon(vertices: Array<Point>, insetDistance: number): Array<Point> {
        if (vertices.length < 3 || insetDistance <= 0) {
            return vertices;
        }

        const isCounterClockwise = this.polygonArea(vertices) > 0;
        const offsetLines: Array<{ start: Point; end: Point }> = vertices
            .map((start, i) => { return [start, vertices[(i + 1) % vertices.length]]; })
            .map(([start, end]) => {
                const edge = { x: end.x - start.x, y: end.y - start.y };
                const length = Math.hypot(edge.x, edge.y);

                if (!length) return { start, end };

                const inwardNormal = isCounterClockwise
                    ? { x: -edge.y / length, y: edge.x / length }
                    : { x: edge.y / length, y: -edge.x / length };

                const offset = { x: inwardNormal.x * insetDistance, y: inwardNormal.y * insetDistance };

                return {
                    start: { x: start.x + offset.x, y: start.y + offset.y },
                    end: { x: end.x + offset.x, y: end.y + offset.y },
                };
            });

        const insetVertices: Array<Point> = Array.from({ length: vertices.length })
            .map((_, i) => { return [offsetLines[(i - 1 + offsetLines.length) % offsetLines.length], offsetLines[i]]; })
            .map(([prev, current]) => 
                this.lineIntersection(
                    prev.start,
                    prev.end,
                    current.start,
                    current.end,
                ) ?? current.start);

        return insetVertices;
    }

    private buildRoundedPath(vertices: Array<Point>, roundedIndices: Set<number>, radius: number): string {
        const total = vertices.length;
        if (total < 3) {
            return '';
        }

        const starts: Array<Point> = new Array(total);
        const ends: Array<Point> = new Array(total);

        for (let i = 0; i < total; i++) {
            const previous = vertices[(i - 1 + total) % total];
            const current = vertices[i];
            const next = vertices[(i + 1) % total];

            if (!roundedIndices.has(i)) {
                starts[i] = current;
                ends[i] = current;
                continue;
            }

            const toPrevious = { x: previous.x - current.x, y: previous.y - current.y };
            const toNext = { x: next.x - current.x, y: next.y - current.y };

            const previousLength = Math.hypot(toPrevious.x, toPrevious.y);
            const nextLength = Math.hypot(toNext.x, toNext.y);

            if (!previousLength || !nextLength) {
                starts[i] = current;
                ends[i] = current;
                continue;
            }

            const usableRadius = Math.min(radius, previousLength / 2, nextLength / 2);

            const previousUnit = { x: toPrevious.x / previousLength, y: toPrevious.y / previousLength };
            const nextUnit = { x: toNext.x / nextLength, y: toNext.y / nextLength };

            starts[i] = {
                x: current.x + previousUnit.x * usableRadius,
                y: current.y + previousUnit.y * usableRadius,
            };

            ends[i] = {
                x: current.x + nextUnit.x * usableRadius,
                y: current.y + nextUnit.y * usableRadius,
            };
        }

        const lastEnd = ends[total - 1];
        const commands: string[] = [`M ${lastEnd.x},${lastEnd.y}`];

        for (let i = 0; i < total; i++) {
            const current = vertices[i];
            const start = starts[i];
            const end = ends[i];

            commands.push(`L ${start.x},${start.y}`);

            if (roundedIndices.has(i) && (start.x !== end.x || start.y !== end.y)) {
                commands.push(`Q ${current.x},${current.y} ${end.x},${end.y}`);
            }
        }

        commands.push('Z');
        return commands.join(' ');
    }

    render() {
        return html`
            <div id="door-cover" class="w-full h-full overflow-hidden">
                <svg
                    id="door-top-svg"
                    class="door"
                    viewBox=${`0 0 ${this.svgWidth} ${this.doorHeight}`}
                    preserveAspectRatio="none"
                >
                    <defs>
                        <linearGradient id="top-led-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stop-color="#2efbff"></stop>
                            <stop offset="100%" stop-color="#a86aff"></stop>
                        </linearGradient>
                    </defs>
                    <path class="door-fill" d=${this.topPath}></path>
                    <path class="door-inner-fill" d=${this.topInsetPath}></path>
                    <path class="door-step-shadow" d=${this.topInsetPath}></path>
                    <path class="door-step-highlight" d=${this.topInsetPath}></path>
                    <path class="door-glow-halo" d=${this.topGlowPath} stroke="url(#top-led-gradient)"></path>
                    <path class="door-glow-core" d=${this.topGlowPath} stroke="url(#top-led-gradient)"></path>
                    <path class="door-outer-rim" d=${this.topPath}></path>
                </svg>

                <svg
                    id="door-bottom-svg"
                    class="door"
                    viewBox=${`0 0 ${this.svgWidth} ${this.doorHeight}`}
                    preserveAspectRatio="none"
                >
                    <defs>
                        <linearGradient id="bottom-led-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stop-color="#2efbff"></stop>
                            <stop offset="100%" stop-color="#a86aff"></stop>
                        </linearGradient>
                    </defs>
                    <path class="door-fill" d=${this.bottomPath}></path>
                    <path class="door-inner-fill" d=${this.bottomInsetPath}></path>
                    <path class="door-step-shadow" d=${this.bottomInsetPath}></path>
                    <path class="door-step-highlight" d=${this.bottomInsetPath}></path>
                    <path class="door-glow-halo" d=${this.bottomGlowPath} stroke="url(#bottom-led-gradient)"></path>
                    <path class="door-glow-core" d=${this.bottomGlowPath} stroke="url(#bottom-led-gradient)"></path>
                    <path class="door-outer-rim" d=${this.bottomPath}></path>
                </svg>
            </div>
        `;
    }
}