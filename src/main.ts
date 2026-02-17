import { LitElement, html } from 'lit'
import { customElement, query } from 'lit/decorators.js'
import { MatrixRainAnimation } from './matrix-rain-animation.js'

@customElement('main-app')
export class Main extends LitElement {
    private animation?: MatrixRainAnimation;

    @query('#matrix-rain-canvas')
    private readonly canvas!: HTMLCanvasElement;

    @query('#flash')
    private readonly flash!: HTMLElement;

    @query('#profile-container')
    private readonly profile!: HTMLElement;

    protected createRenderRoot(): HTMLElement | DocumentFragment {
        return this;
    }
    
    render() {
        return html`
            <div id="main-page" class="relative w-screen h-screen overflow-hidden bg-black select-none">
                <canvas id="matrix-rain-canvas" class="absolute top-0 left-0 w-full h-full z-<1>"></canvas>

                <div id="flash" class="absolute top-0 left-0 w-full h-full bg-white opacity-0 hidden z-<10> pointer-events-none"></div>

                <div id="profile-container" class="absolute top-[50%] left-[50%] transform -translate-x-1/2 -translate-y-1/2 opacity-0 z-<5> pointer-events-none">
                    
                </div>
            </div>
        `;
    }

    firstUpdated() {
        this.animation = new MatrixRainAnimation(this.canvas, this.flash, this.profile);
        this.animation.start();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.animation?.destroy();
    }
}