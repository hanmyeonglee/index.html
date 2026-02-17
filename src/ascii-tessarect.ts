import { LitElement, html, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { tailwindSheet } from './shared-styles'

type Point = [number, number];
type PointInfo = [...Point, number];
type Point3D = [number, number, number];
type Point4D = [number, number, number, number];

@customElement('ascii-tessarect')
export class AsciiTessarect extends LitElement {
    connectedCallback() {
        super.connectedCallback();
        this.shadowRoot!.adoptedStyleSheets = [
            ...this.shadowRoot!.adoptedStyleSheets,
            tailwindSheet,
        ];
    }

    @property({ type: Number })
    angleXY = 0;
    
    @property({ type: Number })
    angleYZ = 0;

    @property({ type: Number })
    angleZW = 0;

    @property({ type: Number })
    angleWX = 0;

    static SIZE = 10;
    static HALFSIZE = Math.floor(AsciiTessarect.SIZE / 2);
    static CANVAS_SIZE = 60;
    static HALFCANVAS = Math.floor(AsciiTessarect.CANVAS_SIZE / 2);

    static Z_OFFSET = Math.round(Math.sqrt(3) * AsciiTessarect.HALFSIZE * 5);
    static W_OFFSET = Math.round(2 * AsciiTessarect.HALFSIZE * 5);
    static MAX_RADIUS_4D = AsciiTessarect.SIZE;
    static MAX_RADIUS_3D = AsciiTessarect.MAX_RADIUS_4D * (AsciiTessarect.W_OFFSET / (AsciiTessarect.W_OFFSET - AsciiTessarect.MAX_RADIUS_4D));
    static MAX_RADIUS_2D_NORMAL = AsciiTessarect.MAX_RADIUS_3D * (AsciiTessarect.Z_OFFSET / (AsciiTessarect.Z_OFFSET - AsciiTessarect.MAX_RADIUS_3D));
    static FOV = AsciiTessarect.HALFCANVAS / AsciiTessarect.MAX_RADIUS_2D_NORMAL * 1.7;

    private createNewScreen(): string[][] {
        return Array.from({ length: AsciiTessarect.CANVAS_SIZE }, () => Array(AsciiTessarect.CANVAS_SIZE).fill(' '));
    }
    
    private screenArray: string[][] = this.createNewScreen();
    
    static BASE_POINTS: Point4D[] = Array.from({ length: 16 }, (_, i) => {
        const x = (i & 1) ? AsciiTessarect.HALFSIZE : -AsciiTessarect.HALFSIZE;
        const y = (i & 2) ? AsciiTessarect.HALFSIZE : -AsciiTessarect.HALFSIZE;
        const z = (i & 4) ? AsciiTessarect.HALFSIZE : -AsciiTessarect.HALFSIZE;
        const w = (i & 8) ? AsciiTessarect.HALFSIZE : -AsciiTessarect.HALFSIZE;
        return [x, y, z, w];
    });
    static EDGES: [number, number][] = [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
        [8, 9], [9, 10], [10, 11], [11, 8],
        [12, 13], [13, 14], [14, 15], [15, 12],
        [8, 12], [9, 13], [10, 14], [11, 15],
        [0, 8], [1, 9], [2, 10], [3, 11],
        [4, 12], [5, 13], [6, 14], [7, 15],
    ]

    private calculateRotation(): Point4D[] {
        const [sinXY, cosXY, sinYZ, cosYZ, sinZW, cosZW, sinWX, cosWX] = [
            this.angleXY, this.angleYZ, this.angleZW, this.angleWX
        ].map(_ => _ * Math.PI / 180).flatMap(angle => [Math.sin(angle), Math.cos(angle)]);

        return AsciiTessarect.BASE_POINTS
            .map(([x, y, z, w]) => { return [x*cosXY - y*sinXY, x*sinXY + y*cosXY, z, w] })
            .map(([x, y, z, w]) => { return [x, y*cosYZ - z*sinYZ, y*sinYZ + z*cosYZ, w] })
            .map(([x, y, z, w]) => { return [x, y, z*cosZW - w*sinZW, z*sinZW + w*cosZW] })
            .map(([x, y, z, w]) => { return [w*sinWX + x*cosWX, y, z, w*cosWX - x*sinWX] });
    }

    private projectTo2D(points: Point4D[]): Point[] {
        return points.map(([x, y, z, w]) => {
            const scale = AsciiTessarect.W_OFFSET / (w + AsciiTessarect.W_OFFSET);
            return [x, y, z].map(_ => _ * scale) as Point3D;
        }).map(([x, y, z]) => {
            const scale = AsciiTessarect.Z_OFFSET / (z + AsciiTessarect.Z_OFFSET);
            return [x, y].map(_ => _ * scale) as Point;
        }).map(_ => _.map(v => AsciiTessarect.FOV * v).map(Math.round) as Point);
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
                AsciiTessarect.EDGES.flatMap(([i0, i1]) => 
                    this.drawLine(...projectedPoints[i0], ...projectedPoints[i1]))
            ),
            ...(
                projectedPoints.map(([x, y]) => [x, y, 1])
            )
        ];

        const newScreen = this.createNewScreen();
        edges.map(([x, y, brightness]) => { return [x + AsciiTessarect.HALFCANVAS, y + AsciiTessarect.HALFCANVAS, brightness] })
             .filter(([x, y, _]) => x >= 0 && x < AsciiTessarect.CANVAS_SIZE && y >= 0 && y < AsciiTessarect.CANVAS_SIZE)
             .forEach(([x, y, brightness]) => {
                newScreen[y][x] = this.chooseASCII(brightness);
             });

        this.screenArray = newScreen;
    }

    protected willUpdate(changedProperties: PropertyValues) {
        if (changedProperties.has('angleXY') || changedProperties.has('angleYZ') || changedProperties.has('angleZW') || changedProperties.has('angleWX')) {
            this.drawFrame();
        }
    }

    protected firstUpdated(_changedProperties: PropertyValues): void {
        setInterval(() => {
            this.angleXY = (this.angleXY + 0.5 + Math.random()) % 360;
            this.angleYZ = (this.angleYZ + 1 + Math.random()) % 360;
            this.angleZW = (this.angleZW + 1.5 + Math.random()) % 360;
            this.angleWX = (this.angleWX + Math.random()) % 360;
        }, 30);
    }

    render() {     
        return html`
            <div>
                <pre id="canvas" class="font-mono leading-[0.75em] tracking-[0.15em] text-yellow-500 text-[0.5rem] select-none">${
                    this.screenArray.map(row => row.join('')).join('\n')
                }</pre>
            </div>
        `;
    }
}