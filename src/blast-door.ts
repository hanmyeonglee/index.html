import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { tailwindSheet } from './shared-styles'

@customElement('blast-door')
export class BlastDoor extends LitElement {
    @state() private svgWidth = 1;
    @state() private doorHeight = 1;
    @state() private topPoints = '';
    @state() private bottomPoints = '';

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

        this.topPoints = [
            `0,0`,
            `0,${calculatedDoorHeight}`,
            `${shortSideLength},${calculatedDoorHeight}`,
            `${width - longSideLength},${calculatedDoorHeight - diagHeight}`,
            `${width},${calculatedDoorHeight - diagHeight}`,
            `${width},0`,
        ].join(' ');

        this.bottomPoints = [
            `${width},0`,
            `${width},${calculatedDoorHeight}`,
            `0,${calculatedDoorHeight}`,
            `0,${diagHeight}`,
            `${longSideLength},${diagHeight}`,
            `${width - shortSideLength},0`,
        ].join(' ');
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
                    <polygon class="door-fill" points=${this.topPoints}></polygon>
                </svg>

                <svg
                    id="door-bottom-svg"
                    class="door"
                    viewBox=${`0 0 ${this.svgWidth} ${this.doorHeight}`}
                    preserveAspectRatio="none"
                >
                    <polygon class="door-fill" points=${this.bottomPoints}></polygon>
                </svg>
            </div>
        `;
    }
}