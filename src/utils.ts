export function randomInRange(min: number, max: number): number {
    return Math.floor(min + Math.random() * (max - min));
}

export function sampleNormal(mean: number, std: number, min: number, max: number): number {
    const val = gaussian();
    const sampled = mean + val * std;
    return Math.min(max, Math.max(min, sampled));
}

function gaussian(): number {
    const u1 = 1 - Math.random();
    const u2 = 1 - Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
