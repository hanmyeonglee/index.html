import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { tailwindSheet } from './shared-styles';
import './intro-matrix-rain.ts';
import './intro-laser-beam.ts';

@customElement('intro-background-effects')
export class IntroBackgroundEffects extends LitElement {
    static styles = css`
        :host {
            position: absolute;
            inset: 0;
            display: block;
            overflow: hidden;
            pointer-events: none;
        }
    `;

    connectedCallback(): void {
        super.connectedCallback();

        if (this.shadowRoot && !this.shadowRoot.adoptedStyleSheets.includes(tailwindSheet)) {
            this.shadowRoot.adoptedStyleSheets = [
                ...this.shadowRoot.adoptedStyleSheets,
                tailwindSheet,
            ];
        }

    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
    }

    render() {
        return html`
            <intro-matrix-rain></intro-matrix-rain>
            <intro-laser-beam></intro-laser-beam>
        `;
    }
}
