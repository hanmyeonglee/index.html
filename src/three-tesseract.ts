import { LitElement, css, html } from 'lit';
import { customElement, query } from 'lit/decorators.js';
import * as THREE from 'three';
import { tailwindSheet } from './shared-styles';

type Vec4 = { x: number; y: number; z: number; w: number };

@customElement('three-tesseract')
export class ThreeTesseract extends LitElement {
    static styles = css`
        :host {
            display: block;
            width: 100%;
            height: 100%;
        }

        #viewport {
            width: 100%;
            height: 100%;
        }

        canvas {
            display: block;
            width: 100%;
            height: 100%;
        }
    `;

    @query('#viewport')
    private readonly viewportEl!: HTMLDivElement;

    private scene?: THREE.Scene;
    private camera?: THREE.PerspectiveCamera;
    private renderer?: THREE.WebGLRenderer;
    private tesseractRoot?: THREE.Group;
    private frameId?: number;
    private resizeObserver?: ResizeObserver;

    private readonly vertices4D: Vec4[] = [];
    private readonly edges: Array<[number, number]> = [];
    private readonly positionArrays: Float32Array[] = [];

    private angleXW = 0;
    private angleYZ = 0;
    private angleZW = 0;

    connectedCallback(): void {
        super.connectedCallback();

        if (this.shadowRoot && !this.shadowRoot.adoptedStyleSheets.includes(tailwindSheet)) {
            this.shadowRoot.adoptedStyleSheets = [
                ...this.shadowRoot.adoptedStyleSheets,
                tailwindSheet,
            ];
        }
    }

    firstUpdated(): void {
        this.buildTesseractTopology();
        this.setupThreeScene();
        this.startRenderLoop();
    }

    disconnectedCallback(): void {
        this.stopRenderLoop();
        this.disposeThreeScene();
        super.disconnectedCallback();
    }

    private buildTesseractTopology(): void {
        this.vertices4D.length = 0;
        this.edges.length = 0;

        for (let i = 0; i < 16; i++) {
            this.vertices4D.push({
                x: (i & 1) ? 1 : -1,
                y: (i & 2) ? 1 : -1,
                z: (i & 4) ? 1 : -1,
                w: (i & 8) ? 1 : -1,
            });
        }

        for (let i = 0; i < 16; i++) {
            for (let bit = 0; bit < 4; bit++) {
                const j = i ^ (1 << bit);
                if (i < j) {
                    this.edges.push([i, j]);
                }
            }
        }
    }

    private setupThreeScene(): void {
        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
        this.camera.position.set(0, 0, 4.8);

        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
        });
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.viewportEl.append(this.renderer.domElement);

        const edgeCount = this.edges.length;
        const pointsCount = edgeCount * 2;

        const coreMaterial = new THREE.LineBasicMaterial({
            color: 0x00FFFF,
            transparent: true,
            opacity: 0.98,
            depthWrite: false,
            depthTest: false,
        });
        const glowNearMaterial = new THREE.LineBasicMaterial({
            color: 0x00FFFF,
            transparent: true,
            opacity: 0.28,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: false,
        });
        const glowFarMaterial = new THREE.LineBasicMaterial({
            color: 0x00FFFF,
            transparent: true,
            opacity: 0.14,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: false,
        });

        const corePositions = new Float32Array(pointsCount * 3);
        const nearPositions = new Float32Array(pointsCount * 3);
        const farPositions = new Float32Array(pointsCount * 3);
        this.positionArrays.push(corePositions, nearPositions, farPositions);

        const coreGeometry = new THREE.BufferGeometry();
        coreGeometry.setAttribute('position', new THREE.BufferAttribute(corePositions, 3));

        const nearGeometry = new THREE.BufferGeometry();
        nearGeometry.setAttribute('position', new THREE.BufferAttribute(nearPositions, 3));

        const farGeometry = new THREE.BufferGeometry();
        farGeometry.setAttribute('position', new THREE.BufferAttribute(farPositions, 3));

        const coreLines = new THREE.LineSegments(coreGeometry, coreMaterial);
        const glowNearLines = new THREE.LineSegments(nearGeometry, glowNearMaterial);
        const glowFarLines = new THREE.LineSegments(farGeometry, glowFarMaterial);

        glowNearLines.scale.setScalar(1.01);
        glowFarLines.scale.setScalar(1.02);

        this.tesseractRoot = new THREE.Group();
        this.tesseractRoot.add(coreLines, glowNearLines, glowFarLines);
        this.scene.add(this.tesseractRoot);

        this.resizeObserver = new ResizeObserver(() => {
            this.resizeRenderer();
        });
        this.resizeObserver.observe(this.viewportEl);
        this.resizeRenderer();
    }

    private rotateXW(v: Vec4, angle: number): Vec4 {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return { x: v.x * cos - v.w * sin, y: v.y, z: v.z, w: v.x * sin + v.w * cos };
    }

    private rotateYZ(v: Vec4, angle: number): Vec4 {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return { x: v.x, y: v.y * cos - v.z * sin, z: v.y * sin + v.z * cos, w: v.w };
    }

    private rotateZW(v: Vec4, angle: number): Vec4 {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return { x: v.x, y: v.y, z: v.z * cos - v.w * sin, w: v.z * sin + v.w * cos };
    }

    private project4DTo3D(v: Vec4): THREE.Vector3 {
        const wDistance = 10;
        const wFactor = wDistance / (wDistance - v.w);
        const x3 = v.x * wFactor;
        const y3 = v.y * wFactor;
        const z3 = v.z * wFactor;

        const visualScale = 0.8;
        return new THREE.Vector3(x3 * visualScale, y3 * visualScale, z3 * visualScale);
    }

    private updateTesseractLines(): void {
        const transformed = this.vertices4D.map((vertex) => {
            const r1 = this.rotateXW(vertex, this.angleXW);
            const r2 = this.rotateYZ(r1, this.angleYZ);
            const r3 = this.rotateZW(r2, this.angleZW);
            return this.project4DTo3D(r3);
        });

        for (const positions of this.positionArrays) {
            let cursor = 0;
            for (const [a, b] of this.edges) {
                const p0 = transformed[a];
                const p1 = transformed[b];

                positions[cursor++] = p0.x;
                positions[cursor++] = p0.y;
                positions[cursor++] = p0.z;
                positions[cursor++] = p1.x;
                positions[cursor++] = p1.y;
                positions[cursor++] = p1.z;
            }
        }

        if (!this.tesseractRoot) {
            return;
        }

        for (const line of this.tesseractRoot.children) {
            if (line instanceof THREE.LineSegments) {
                const attr = line.geometry.getAttribute('position') as THREE.BufferAttribute;
                attr.needsUpdate = true;
            }
        }
    }

    private resizeRenderer(): void {
        if (!this.renderer || !this.camera) {
            return;
        }

        const width = Math.max(1, this.viewportEl.clientWidth);
        const height = Math.max(1, this.viewportEl.clientHeight);

        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    private startRenderLoop(): void {
        const renderFrame = () => {
            if (!this.renderer || !this.scene || !this.camera) {
                return;
            }

            this.angleXW += 0.012;
            this.angleYZ += 0.009;
            this.angleZW += 0.007;
            this.updateTesseractLines();

            this.renderer.render(this.scene, this.camera);
            this.frameId = window.requestAnimationFrame(renderFrame);
        };

        this.frameId = window.requestAnimationFrame(renderFrame);
    }

    private stopRenderLoop(): void {
        if (this.frameId !== undefined) {
            window.cancelAnimationFrame(this.frameId);
            this.frameId = undefined;
        }
    }

    private disposeThreeScene(): void {
        this.resizeObserver?.disconnect();
        this.resizeObserver = undefined;

        this.tesseractRoot?.traverse((obj: THREE.Object3D) => {
            if (obj instanceof THREE.LineSegments) {
                obj.geometry.dispose();
                const material = obj.material;
                if (Array.isArray(material)) {
                    material.forEach((m) => m.dispose());
                } else {
                    material.dispose();
                }
            }
        });

        this.positionArrays.length = 0;
        this.scene?.clear();
        this.tesseractRoot = undefined;
        this.scene = undefined;
        this.camera = undefined;

        this.renderer?.dispose();
        this.renderer = undefined;
    }

    render() {
        return html`
            <div class="size-full grid place-items-center overflow-hidden">
                <div id="viewport" class="size-[85%]"></div>
            </div>
        `;
    }
}
