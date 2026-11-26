import { mathjax } from '@mathjax/src/js/mathjax.js';
import { TeX } from '@mathjax/src/js/input/tex.js';
import { SVG } from '@mathjax/src/js/output/svg.js';
import { liteAdaptor } from '@mathjax/src/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import { MathJaxNewcmFont } from '@mathjax/mathjax-newcm-font/js/svg.js';
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js';
import '@mathjax/src/js/input/tex/textmacros/TextMacrosConfiguration.js';
import { latexParts, readLatexMetadata, asciiJson } from '../src/core/text/latex';
import { BudgetCache } from '../src/core/cache';
mathjax.asyncLoad = (name: string) => {
  if (!name.startsWith('@mathjax/mathjax-newcm-font/js/'))
    throw Error('Fonte matemática não disponível localmente.');
  return import(name);
};
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const tex = new TeX({ packages: ['base', 'ams', 'textmacros'], maxBuffer: 16384, maxMacros: 1000 });
const document = mathjax.document('', {
  InputJax: tex,
  OutputJax: new SVG({ fontCache: 'none', fontData: MathJaxNewcmFont }),
});
type Formula = { body: string; view: number[]; factor: number; width: number };
const cache = new BudgetCache<string, Formula>(4 * 1024 * 1024, 128);
let queue: Promise<unknown> = Promise.resolve();
const xml = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
function plainTex(text: string) {
  const escaped: Record<string, string> = {
    '\\': '\\textbackslash{}',
    '{': '\\{',
    '}': '\\}',
    '%': '\\%',
    '#': '\\#',
    $: '\\$',
    '&': '\\&',
    _: '\\_',
    '^': '\\textasciicircum{}',
    '~': '\\textasciitilde{}',
  };
  return '\\text{' + text.replace(/[\\{}%#$&_^~]/g, (c) => escaped[c]) + '}';
}

async function formula(text: string): Promise<Formula> {
  const existing = cache.get(text);
  if (existing) return existing;
  const operation = queue.then(async () => {
    const cached = cache.get(text);
    if (cached) return cached;
    const parts = latexParts(text)!;
    const expression = parts.map((p) => (p.math ? p.text : plainTex(p.text))).join('');
    const node = await document.convertPromise(expression, {
      display: false,
      em: 1000,
      ex: 442,
      containerWidth: 100000,
    });
    const outer = adaptor.outerHTML(node),
      svg = outer.match(/<svg\b[\s\S]*<\/svg>/)?.[0];
    if (!svg || /data-mml-node="merror"/.test(svg)) throw Error('Fórmula LaTeX inválida.');
    const view = svg
        .match(/viewBox="([^"]+)"/)![1]
        .split(/\s+/)
        .map(Number),
      body = svg.replace(/^<svg\b[^>]*>/, '').replace(/<\/svg>$/, '');
    // Inline figure labels must fit the line reserved by the classic Grace layout.
    const factor = Math.min(1, 1350 / view[3]),
      result = { body, view, factor, width: (view[2] / 1000) * factor };
    cache.set(text, result, body.length * 2);
    return result;
  });
  queue = operation.catch(() => {});
  return operation;
}
export type MathReplacement = {
  marker: string;
  key: string;
  text: string;
  formula: Formula;
  markerEm: number;
  center: boolean;
};
export async function prepareMath(source: string) {
  const metadata = readLatexMetadata(source),
    replacements: MathReplacement[] = [],
    warnings: string[] = [];
  if (!metadata.size) return { source, replacements, warnings, metadata };
  const forbidden = new Set(source.match(/H\d+H+/g) ?? []);
  const entries = new Map<string, MathReplacement>();
  let counter = 0;
  for (const [key, text] of metadata) {
    if (!latexParts(text)) continue;
    try {
      const math = await formula(text);
      let marker = '';
      do {
        const number = String(counter++),
          extra = Math.max(
            0,
            Math.ceil((math.width - (2 * 0.722 + number.length * 0.556)) / 0.722),
          );
        marker = 'H' + number + 'H'.repeat(extra + 1);
      } while (forbidden.has(marker));
      const entry = {
        marker,
        key,
        text,
        formula: math,
        markerEm: [...marker].reduce((w, c) => w + (c === 'H' ? 0.722 : 0.556), 0),
        center: !key.endsWith('.legend'),
      };
      entries.set(key, entry);
      replacements.push(entry);
    } catch {
      warnings.push('Uma fórmula LaTeX está incompleta ou inválida; revise o texto no inspetor.');
    }
  }
  let graph = -1;
  const output = source
    .split('\n')
    .map((line) => {
      const scope = line.match(/^@\s*with g(\d+)\s*$/i);
      if (scope) {
        graph = +scope[1];
        return line;
      }
      const match = line.match(
        /^(@\s*)(title|subtitle|(?:alt[xy]|[xy])axis label|s\d+ legend) ("(?:\\.|[^"\\])*")\s*$/i,
      );
      if (!match) return line;
      const key = `g${graph}.` + match[2].toLowerCase().replace(/ /g, '.'),
        entry = entries.get(key);
      return entry ? `${match[1]}${match[2]} "\\f{Helvetica}${entry.marker}\\f{}"` : line;
    })
    .join('\n');
  return { source: output, replacements, warnings, metadata };
}
export function applyMath(svg: string, entries: MathReplacement[]): string {
  for (const entry of entries) {
    const pattern = new RegExp(`<text\\b([^>]*)>${entry.marker}<\\/text>`, 'g');
    svg = svg.replace(pattern, (_all, attributes: string, offsetInSvg: number) => {
      const parentAt = svg.lastIndexOf('<g style="fill:', offsetInSvg),
        color =
          svg.slice(parentAt, parentAt + 130).match(/fill:\s*(#[\da-f]{6})/i)?.[1] ?? '#000000';
      const matrix = attributes.match(/transform="([^"]+)"/)?.[1];
      if (!matrix) return _all;
      const fontSize = Number(attributes.match(/font-size:\s*([\d.]+)/)?.[1] ?? 612),
        f = entry.formula,
        scale = (fontSize / 1000) * f.factor;
      const [vx, vy, vw, vh] = f.view,
        width = vw * scale,
        height = vh * scale,
        offset = entry.center ? (entry.markerEm * fontSize - width) / 2 : 0;
      return `<g data-lsn-text="${entry.key}" aria-label="${xml(entry.text)}" transform="${matrix}"><svg x="${offset}" y="${vy * scale}" width="${width}" height="${height}" viewBox="${vx} ${vy} ${vw} ${vh}" color="${color}" overflow="visible">${f.body}</svg></g>`;
    });
  }
  return svg;
}
export const mathMetadata = (metadata: Map<string, string>) =>
  [...metadata].map(([key, text]) => `# LSNGrace latex ${key} ${asciiJson(text)}`).join('\n');
