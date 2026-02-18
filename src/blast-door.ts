import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { tailwindSheet } from './shared-styles'

@customElement('blast-door')
export class BlastDoor extends LitElement {
    @state() private svgWidth = 1;
    @state() private doorHeight = 1;
    @state() private topPath = '';
    @state() private bottomPath = '';

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
    
    static BLANK_HEIGHT_PX = 15;

    static CORNER_RADIUS_PX = 16;

    static styles = css`
        :host {
            --blank-height: ${BlastDoor.BLANK_HEIGHT_PX}px;
            --short-side-length: calc((100vw * ${1 - BlastDoor.DIAG_WIDTH_RATIO} - ${BlastDoor.CORRECTION_FACTOR} * var(--blank-height)) * 0.5);
            --long-side-length: calc((100vw * ${1 - BlastDoor.DIAG_WIDTH_RATIO} + ${BlastDoor.CORRECTION_FACTOR} * var(--blank-height)) * 0.5);
            --diag-width: calc(100vw * ${BlastDoor.DIAG_WIDTH_RATIO});
            --diag-height: calc(var(--diag-width) * ${Math.tan(BlastDoor.DIAG_ANGLE_DEG * Math.PI / 180)});
            --upside-translate: calc(var(--diag-height) - var(--blank-height));
            --door-height: calc((100vh + var(--upside-translate)) * 0.5);
        }

        .door {
            width: 100%;
            height: var(--door-height);
            display: block;
        }

        .door-fill {
            fill: gray;
            width: 100%;
            height: var(--door-height);
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

        this.topPath = this.buildRoundedPath(topVertices, new Set([1, 2, 3, 4]), BlastDoor.CORNER_RADIUS_PX);
        this.bottomPath = this.buildRoundedPath(bottomVertices, new Set([0, 3, 4, 5]), BlastDoor.CORNER_RADIUS_PX);
    }

    private buildRoundedPath(vertices: Array<{ x: number; y: number }>, roundedIndices: Set<number>, radius: number): string {
        const total = vertices.length;
        if (total < 3) {
            return '';
        }

        const starts: Array<{ x: number; y: number }> = new Array(total);
        const ends: Array<{ x: number; y: number }> = new Array(total);

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
                    <path class="door-fill" d=${this.topPath}></path>
                </svg>

                <svg
                    id="door-bottom-svg"
                    class="door"
                    viewBox=${`0 0 ${this.svgWidth} ${this.doorHeight}`}
                    preserveAspectRatio="none"
                >
                    <path class="door-fill" d=${this.bottomPath}></path>
                </svg>
            </div>
        `;
    }
}