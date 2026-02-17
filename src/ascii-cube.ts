import { LitElement, html, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { tailwindSheet } from './shared-styles'

type Point = [number, number];
type PointInfo = [...Point, number];
type Point3D = [number, number, number];

@customElement('ascii-cube')
export class AsciiCube extends LitElement {
    connectedCallback() {
        super.connectedCallback();
        this.shadowRoot!.adoptedStyleSheets = [
            ...this.shadowRoot!.adoptedStyleSheets,
            tailwindSheet,
        ];
    }

    @property({ type: Number })
    angleX = 0;
    
    @property({ type: Number })
    angleY = 0;

    static SIZE = 20;
    static HALFSIZE = Math.floor(AsciiCube.SIZE / 2);
    static CANVAS_SIZE = 40;
    static HALFCANVAS = Math.floor(AsciiCube.CANVAS_SIZE / 2);

    static Z_OFFSET = Math.round(Math.sqrt(3) * AsciiCube.HALFSIZE * 5);
    static FOV = AsciiCube.CANVAS_SIZE * 2;

    private createNewScreen(): string[][] {
        return Array.from({ length: AsciiCube.CANVAS_SIZE }, () => Array(AsciiCube.CANVAS_SIZE).fill(' '));
    }
    
    private screenArray: string[][] = this.createNewScreen();
    
    static BASE_POINTS: Point3D[] = [
        [-AsciiCube.HALFSIZE, -AsciiCube.HALFSIZE, -AsciiCube.HALFSIZE],
        [AsciiCube.HALFSIZE, -AsciiCube.HALFSIZE, -AsciiCube.HALFSIZE],
        [AsciiCube.HALFSIZE, AsciiCube.HALFSIZE, -AsciiCube.HALFSIZE],
        [-AsciiCube.HALFSIZE, AsciiCube.HALFSIZE, -AsciiCube.HALFSIZE],
        [-AsciiCube.HALFSIZE, -AsciiCube.HALFSIZE, AsciiCube.HALFSIZE],
        [AsciiCube.HALFSIZE, -AsciiCube.HALFSIZE, AsciiCube.HALFSIZE],
        [AsciiCube.HALFSIZE, AsciiCube.HALFSIZE, AsciiCube.HALFSIZE],
        [-AsciiCube.HALFSIZE, AsciiCube.HALFSIZE, AsciiCube.HALFSIZE]
    ];
    static EDGES: [number, number][] = [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7]
    ];

    private calculateRotation(): Point3D[] {
        const radX = this.angleX * Math.PI / 180;
        const radY = this.angleY * Math.PI / 180;
        const sinX = Math.sin(radX);
        const cosX = Math.cos(radX);
        const sinY = Math.sin(radY);
        const cosY = Math.cos(radY);

        return AsciiCube.BASE_POINTS
            .map(([x, y, z]) => { return [x, y*cosX - z*sinX, y*sinX + z*cosX] })
            .map(([x, y, z]) => { return [x*cosY+z*sinY, y, -x*sinY+z*cosY] })
            .map(_ => _.map(Math.round) as Point3D);
    }

    private projectTo2D(points: Point3D[]): Point[] {
        return points.map(([x, y, z]) => {
            const scale = AsciiCube.FOV / (z + AsciiCube.Z_OFFSET);
            return [Math.round(x * scale), Math.round(y * scale)];
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
        const projectedPoints = this.projectTo2D(rotatedPoints);
        const edges = [
            ...(
                AsciiCube.EDGES.flatMap(([i0, i1]) => {
                    const [x0, y0] = projectedPoints[i0];
                    const [x1, y1] = projectedPoints[i1];
                    return this.drawLine(x0, y0, x1, y1);
                })
            ),
            ...(
                projectedPoints.map(([x, y]) => [x, y, 1])
            )
        ];

        const newScreen = this.createNewScreen();
        edges.map(([x, y, brightness]) => { return [x + AsciiCube.HALFCANVAS, y + AsciiCube.HALFCANVAS, brightness] })
             .filter(([x, y, _]) => x >= 0 && x < AsciiCube.CANVAS_SIZE && y >= 0 && y < AsciiCube.CANVAS_SIZE)
             .forEach(([x, y, brightness]) => {
                newScreen[y][x] = this.chooseASCII(brightness);
             });

        this.screenArray = newScreen;
    }

    protected willUpdate(changedProperties: PropertyValues) {
        if (changedProperties.has('angleX') || changedProperties.has('angleY')) {
            this.drawFrame();
        }
    }

    protected firstUpdated(_changedProperties: PropertyValues): void {
        setInterval(() => {
            this.angleX = (this.angleX + 5) % 360;
            this.angleY = (this.angleY + 5) % 360;
        }, 80);
    }

    render() {     
        return html`
            <div>
                <pre id="canvas" class="font-mono leading-[0.75em] tracking-[0.15em] text-yellow-500 text-sm">${
                    this.screenArray.map(row => row.join('')).join('\n')
                }</pre>
            </div>
        `;
    }
}