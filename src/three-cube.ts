import { LitElement, css, html } from 'lit';
import { customElement, query } from 'lit/decorators.js';
import * as THREE from 'three';
import { tailwindSheet } from './shared-styles';

@customElement('three-cube')
export class ThreeCube extends LitElement {
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
	private cubeRoot?: THREE.Group;
	private frameId?: number;
	private resizeObserver?: ResizeObserver;

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
		this.setupThreeScene();
		this.startRenderLoop();
	}

	disconnectedCallback(): void {
		this.stopRenderLoop();
		this.disposeThreeScene();
		super.disconnectedCallback();
	}

	private setupThreeScene(): void {
		this.scene = new THREE.Scene();

		this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
		this.camera.position.set(0, 0, 3.2);

		this.renderer = new THREE.WebGLRenderer({
			antialias: true,
			alpha: true,
			powerPreference: 'high-performance',
		});
		this.renderer.setClearColor(0x000000, 0);
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.viewportEl.append(this.renderer.domElement);

		const geometry = new THREE.BoxGeometry(1.25, 1.25, 1.25);
		const faceMaterial = new THREE.MeshBasicMaterial({
			color: 0xffffff,
			transparent: true,
			opacity: 0.06,
			depthWrite: false,
		});
		const edgeCoreMaterial = new THREE.LineBasicMaterial({
			color: 0xffffff,
			transparent: true,
			opacity: 0.98,
			depthWrite: false,
			depthTest: false,
		});
		const edgeGlowNearMaterial = new THREE.LineBasicMaterial({
			color: 0xffffff,
			transparent: true,
			opacity: 0.28,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			depthTest: false,
		});
		const edgeGlowFarMaterial = new THREE.LineBasicMaterial({
			color: 0xffffff,
			transparent: true,
			opacity: 0.14,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			depthTest: false,
		});

		const cubeMesh = new THREE.Mesh(geometry, faceMaterial);
		const edgeLines = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeCoreMaterial);
		const glowEdgesNear = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeGlowNearMaterial);
		const glowEdgesFar = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeGlowFarMaterial);
		glowEdgesNear.scale.setScalar(1.01);
		glowEdgesFar.scale.setScalar(1.02);

		this.cubeRoot = new THREE.Group();
		this.cubeRoot.add(cubeMesh);
		this.cubeRoot.add(edgeLines);
		this.cubeRoot.add(glowEdgesNear);
		this.cubeRoot.add(glowEdgesFar);
		this.scene.add(this.cubeRoot);

		this.resizeObserver = new ResizeObserver(() => {
			this.resizeRenderer();
		});
		this.resizeObserver.observe(this.viewportEl);
		this.resizeRenderer();
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
			if (!this.renderer || !this.scene || !this.camera || !this.cubeRoot) {
				return;
			}

			this.cubeRoot.rotation.x += 0.016;
			this.cubeRoot.rotation.y += 0.028;

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

		if (this.cubeRoot) {
			this.cubeRoot.traverse((obj: THREE.Object3D) => {
				if (obj instanceof THREE.Mesh) {
					obj.geometry.dispose();

					const material = obj.material;
					if (Array.isArray(material)) {
						material.forEach((m) => m.dispose());
					} else {
						material.dispose();
					}
				}

				if (obj instanceof THREE.LineSegments) {
					obj.geometry.dispose();

					const lineMaterial = obj.material;
					if (Array.isArray(lineMaterial)) {
						lineMaterial.forEach((m) => m.dispose());
					} else {
						lineMaterial.dispose();
					}
				}
			});
		}

		this.scene?.clear();
		this.cubeRoot = undefined;
		this.scene = undefined;
		this.camera = undefined;

		this.renderer?.dispose();
		this.renderer = undefined;
	}

	render() {
		return html`
			<div class="size-full grid place-items-center overflow-hidden">
				<div id="viewport" class="size-[84%]"></div>
			</div>
		`;
	}
}
