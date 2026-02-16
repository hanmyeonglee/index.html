import tailwindStyles from './tailwind.css?inline';

const sheet = new CSSStyleSheet();
sheet.replaceSync(tailwindStyles);

export { sheet as tailwindSheet };
