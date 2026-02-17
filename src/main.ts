import { LitElement, html } from 'lit'
import { customElement, query } from 'lit/decorators.js'
import { MatrixRainAnimation } from './matrix-rain-animation.js'
import './ascii-cube.js'
import gsap from 'gsap'

@customElement('main-app')
export class Main extends LitElement {
    private animation?: MatrixRainAnimation;

    @query('#matrix-rain-canvas')
    private readonly canvas!: HTMLCanvasElement;

    @query('#flash')
    private readonly flash!: HTMLElement;

    @query('#profile-container')
    private readonly profile!: HTMLElement;

    @query('#typing-text')
    private readonly typingText!: HTMLElement;

    @query('#cursor')
    private readonly cursor!: HTMLElement;

    @query('#typing-container')
    private readonly typingContainer!: HTMLElement;

    protected createRenderRoot(): HTMLElement | DocumentFragment {
        return this;
    }
    
    render() {
        return html`
            <div id="main-page" class="relative w-screen h-screen overflow-hidden bg-black select-none">
                <canvas id="matrix-rain-canvas" class="absolute top-0 left-0 w-full h-full z-<1>"></canvas>

                <div id="flash" class="absolute top-0 left-0 w-full h-full bg-white opacity-0 hidden z-<10> pointer-events-none"></div>

                <div id="profile-container" class="absolute top-[40%] left-[50%] -translate-x-1/2 -translate-y-1/2 opacity-0 z-<5> flex flex-col items-center">
                    <ascii-cube></ascii-cube>
                </div>

                <div id="typing-container" class="mt-15 absolute top-[58%] left-[50%] -translate-x-1/2 opacity-0 z-<5>">
                    <div class="inline-flex items-center font-mono text-white text-4xl tracking-wider whitespace-nowrap">
                        <span id="typing-text"></span><span id="cursor" class="opacity-0 ml-px">_</span>
                    </div>
                </div>
            </div>
        `;
    }

    firstUpdated() {
        this.animation = new MatrixRainAnimation(
            this.canvas,
            this.flash,
            this.profile,
            () => this.startTypingAnimation(),
        );
        this.animation.start();
    }

    private startTypingAnimation() {
        // fade in typing container
        gsap.to(this.typingContainer, { opacity: 1, duration: 0.5 });

        const text = '$ Hello, Nemo';
        const typingEl = this.typingText;
        const cursorEl = this.cursor;

        // show cursor with blink
        gsap.to(cursorEl, { opacity: 1, duration: 0.1 });
        const blink = gsap.to(cursorEl, {
            opacity: 0,
            duration: 0.5,
            repeat: -1,
            yoyo: true,
            ease: 'steps(1)',
        });

        // wait a beat, then type
        const tl = gsap.timeline({ delay: 0.8 });
        blink.pause();
        gsap.set(cursorEl, { opacity: 1 });

        for (let i = 0; i < text.length; i++) {
            tl.call(() => {
                typingEl.textContent = text.slice(0, typingEl.textContent!.length + 1);
            }, [], i === 0 ? 0 : `>+${0.06 + Math.random() * 0.06}`);
        }

        // after typing done, resume cursor blink
        tl.call(() => { blink.restart(); }, [], '>+0.3');
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.animation?.destroy();
    }
}