import { LitElement, html, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { tailwindSheet } from './shared-styles'

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
    private points: [number, number][] = Array.from(
        { length: Math.floor(Math.pow(AsciiTesseract.SIZE, 2)) },
        (_, i) => {
            return [
                Math.floor(i / AsciiTesseract.SIZE) - AsciiTesseract.HALFSIZE,
                (i % AsciiTesseract.SIZE) - AsciiTesseract.HALFSIZE
            ] as [number, number];
        }
    ).filter(([x, y]) => x === -AsciiTesseract.HALFSIZE || x === AsciiTesseract.HALFSIZE || y === -AsciiTesseract.HALFSIZE || y === AsciiTesseract.HALFSIZE);

    private drawPoints() {
        this.screenArray = this.createNewScreen();
        this.points
            .map(([x, y]) => { return [x + AsciiTesseract.HALFCANVAS, y + AsciiTesseract.HALFCANVAS] as [number, number]; })
            .filter(([x, y]) => x >= 0 && x < AsciiTesseract.CANVAS_SIZE && y >= 0 && y < AsciiTesseract.CANVAS_SIZE)
            .forEach(([x, y]) => { this.screenArray[y][x] = '#'; });
    }

    private calculateRotation() {
        const angleRad = this.angle * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
        this.points = this.points.map(([x, y]) => {
            const newX = Math.round(x * cosA - y * sinA);
            const newY = Math.round(x * sinA + y * cosA);
            return [newX, newY] as [number, number];
        });
    }

    protected willUpdate(changedProperties: PropertyValues) {
        if (changedProperties.has('angle')) {
            this.calculateRotation();
            this.drawPoints();
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