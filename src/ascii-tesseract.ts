import { LitElement, html, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { tailwindSheet } from './shared-styles'

type Point = [number, number];

@customElement('ascii-tesseract')
export class AsciiTesseract extends LitElement {
    connectedCallback() {
        super.connectedCallback();
        this.shadowRoot!.adoptedStyleSheets = [
            ...this.shadowRoot!.adoptedStyleSheets,
            tailwindSheet,
        ];
    }

    @property({ type: Number })
    angle = 0;

    static SIZE = 21;
    static HALFSIZE = Math.floor(AsciiTesseract.SIZE / 2);
    static CANVAS_SIZE = 41;
    static HALFCANVAS = Math.floor(AsciiTesseract.CANVAS_SIZE / 2);

    private createNewScreen(): string[][] {
        return Array.from({ length: AsciiTesseract.CANVAS_SIZE }, () => Array(AsciiTesseract.CANVAS_SIZE).fill(' '));
    }
    
    private screenArray: string[][] = this.createNewScreen();
    private readonly basePoints: Point[] = [
        [-AsciiTesseract.HALFSIZE, -AsciiTesseract.HALFSIZE],
        [AsciiTesseract.HALFSIZE, -AsciiTesseract.HALFSIZE],
        [AsciiTesseract.HALFSIZE, AsciiTesseract.HALFSIZE],
        [-AsciiTesseract.HALFSIZE, AsciiTesseract.HALFSIZE]
    ];

    private calculateRotation(): Point[] {
        const angleRad = this.angle * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
        return this.basePoints.map(([x, y]) => {
            const rotatedX = x * cosA - y * sinA;
            const rotatedY = x * sinA + y * cosA;
            return [Math.round(rotatedX), Math.round(rotatedY)] as Point;
        });
    }

    private drawLine(x0: number, y0: number, x1: number, y1: number): Point[] {
        const points: Point[] = [];

        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        while (true) {
            points.push([x0, y0]);
            if (x0 === x1 && y0 === y1) break;

            const err2 = err * 2;
            if (err2 > -dy) {
                err -= dy;
                x0 += sx;
            }
            if (err2 < dx) {
                err += dx;
                y0 += sy;
            }
        }

        return points;
    }

    private readonly lineASCII = "-\\|/";
    private chooseASCII(x0: number, y0: number, x1: number, y1: number): string {
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        return this.lineASCII[
            Number(dx > 2 * dy) * 0 +
            Number(2 * dx >= dy && dy > dx) * 1 +
            Number(dy > 2 * dx) * 2 +
            Number(2 * dy >= dx && dx > dy) * 3
        ];
    }

    private drawFrame() {
        const rotatedPoints = this.calculateRotation();
        const edge = rotatedPoints.flatMap((point, index) => {
            const nextPoint = rotatedPoints[(index + 1) % rotatedPoints.length];
            return this.drawLine(...point, ...nextPoint);
        });

        this.screenArray = this.createNewScreen();
        edge.map(([x, y]) => { return [x + AsciiTesseract.HALFCANVAS, y + AsciiTesseract.HALFCANVAS] })
            .filter(([x, y]) => x >= 0 && x < AsciiTesseract.CANVAS_SIZE && y >= 0 && y < AsciiTesseract.CANVAS_SIZE)
            .forEach(([x, y], index) => {
                const nextPoint = edge[(index + 1) % edge.length];
                const prevPoint = edge[(index - 1 + edge.length) % edge.length];
                this.screenArray[y][x] = this.chooseASCII(...prevPoint, ...nextPoint);
            });
    }

    protected willUpdate(changedProperties: PropertyValues) {
        if (changedProperties.has('angle')) {
            this.drawFrame();
        }
    }

    protected firstUpdated(_changedProperties: PropertyValues): void {
        setInterval(() => {
            this.angle = (this.angle + 5) % 360;
        }, 100);
    }

    render() {     
        return html`
            <div>
                <pre id="canvas" class="font-mono leading-[0.75em] tracking-[0.15em]">${
                    this.screenArray.map(row => row.join('')).join('\n')
                }</pre>
            </div>
        `;
    }
}