import { LitElement, html, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { tailwindSheet } from './shared-styles'

type Point = [number, number];
type PointInfo = [...Point, number];

@customElement('ascii-square')
export class AsciiSquare extends LitElement {
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
    static HALFSIZE = Math.floor(AsciiSquare.SIZE / 2);
    static CANVAS_SIZE = 41;
    static HALFCANVAS = Math.floor(AsciiSquare.CANVAS_SIZE / 2);

    private createNewScreen(): string[][] {
        return Array.from({ length: AsciiSquare.CANVAS_SIZE }, () => Array(AsciiSquare.CANVAS_SIZE).fill(' '));
    }
    
    private screenArray: string[][] = this.createNewScreen();
    private readonly basePoints: Point[] = [
        [-AsciiSquare.HALFSIZE, -AsciiSquare.HALFSIZE],
        [AsciiSquare.HALFSIZE, -AsciiSquare.HALFSIZE],
        [AsciiSquare.HALFSIZE, AsciiSquare.HALFSIZE],
        [-AsciiSquare.HALFSIZE, AsciiSquare.HALFSIZE]
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

    private drawLine(x0: number, y0: number, x1: number, y1: number): PointInfo[] {
        const points: PointInfo[] = [];

        const isSteep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
        if (isSteep) {
            [x0, y0] = [y0, x0];
            [x1, y1] = [y1, x1];
        }

        if (x0 > x1) {
            [x0, x1] = [x1, x0];
            [y0, y1] = [y1, y0];
        }

        const dx = x1 - x0;
        const dy = y1 - y0;
        const grad = dy / dx;

        let exactY = y0;
        for (let x = x0; x <= x1; x++) {
            const y = Math.floor(exactY);
            const diff = exactY - y;

            points.push([isSteep ? y : x, isSteep ? x : y, 1 - diff]);
            points.push([isSteep ? y + 1 : x, isSteep ? x : y + 1, diff]);
            exactY += grad;
        }

        return points;
    }

    private readonly DENSITY = [" .'`^\",", ":;Il!i>", "<~+_-?]", "[}{1)(|", "\\/tfjrx", "nuvczXY", "UJCLQ0O", "Zmwqpdb", "khao*#M", "W&8%B@$"];
    private chooseASCII(brightness: number): string {
        const ASCIIs = this.DENSITY[Math.floor(brightness * (this.DENSITY.length - 1))];
        return ASCIIs[Math.floor(Math.random() * ASCIIs.length)];
    }

    private drawFrame() {
        const rotatedPoints = this.calculateRotation();
        const edges = [
            ...(
                rotatedPoints.flatMap((point, index) => {
                    const nextPoint = rotatedPoints[(index + 1) % rotatedPoints.length];
                    return this.drawLine(...point, ...nextPoint);
                })
            ),
            ...(
                rotatedPoints.map(([x, y]) => [x, y, 1])
            )
        ];

        const newScreen = this.createNewScreen();
        edges.map(([x, y, brightness]) => { return [x + AsciiSquare.HALFCANVAS, y + AsciiSquare.HALFCANVAS, brightness] })
             .filter(([x, y, _]) => x >= 0 && x < AsciiSquare.CANVAS_SIZE && y >= 0 && y < AsciiSquare.CANVAS_SIZE)
             .forEach(([x, y, brightness]) => {
                newScreen[y][x] = this.chooseASCII(brightness);
             });

        this.screenArray = newScreen;
    }

    protected willUpdate(changedProperties: PropertyValues) {
        if (changedProperties.has('angle')) {
            this.drawFrame();
        }
    }

    protected firstUpdated(_changedProperties: PropertyValues): void {
        setInterval(() => {
            this.angle = (this.angle + 5) % 360;
        }, 80);
    }

    render() {     
        return html`
            <div>
                <pre id="canvas" class="font-mono leading-[0.75em] tracking-[0.15em] text-green-500 text-sm">${
                    this.screenArray.map(row => row.join('')).join('\n')
                }</pre>
            </div>
        `;
    }
}