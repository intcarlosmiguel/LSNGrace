import type { Scene, Graph } from '../scene/types';
export type LatexPart = { math: boolean; text: string };
export function latexParts(text: string): LatexPart[] | null {
  const parts: LatexPart[] = [];
  let plain = '',
    i = 0,
    found = false;
  while (i < text.length) {
    if (text[i] === '\\' && text[i + 1] === '$') {
      plain += '$';
      i += 2;
      continue;
    }
    const open = text.startsWith('$$', i)
      ? '$$'
      : text[i] === '$'
        ? '$'
        : text.startsWith('\\(', i)
          ? '\\('
          : text.startsWith('\\[', i)
            ? '\\['
            : '';
    if (!open) {
      plain += text[i++];
      continue;
    }
    const close = open === '\\(' ? '\\)' : open === '\\[' ? '\\]' : open;
    let end = i + open.length;
    while (end < text.length) {
      if (text.startsWith(close, end) && text[end - 1] !== '\\') break;
      end++;
    }
    if (end >= text.length) {
      plain += text.slice(i);
      break;
    }
    if (plain) {
      parts.push({ math: false, text: plain });
      plain = '';
    }
    parts.push({ math: true, text: text.slice(i + open.length, end) });
    found = true;
    i = end + close.length;
  }
  if (plain) parts.push({ math: false, text: plain });
  return found ? parts : null;
}
export const hasLatex = (text: string) => /(?<!\\)\$|\\[([]/.test(text);
const greek: Record<string, string> = {
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  varepsilon: 'ε',
  zeta: 'ζ',
  eta: 'η',
  theta: 'θ',
  vartheta: 'θ',
  iota: 'ι',
  kappa: 'κ',
  lambda: 'λ',
  mu: 'μ',
  nu: 'ν',
  xi: 'ξ',
  omicron: 'ο',
  pi: 'π',
  rho: 'ρ',
  sigma: 'σ',
  tau: 'τ',
  upsilon: 'υ',
  phi: 'φ',
  varphi: 'φ',
  chi: 'χ',
  psi: 'ψ',
  omega: 'ω',
  Gamma: 'Γ',
  Delta: 'Δ',
  Theta: 'Θ',
  Lambda: 'Λ',
  Xi: 'Ξ',
  Pi: 'Π',
  Sigma: 'Σ',
  Phi: 'Φ',
  Psi: 'Ψ',
  Omega: 'Ω',
};
/** Readable native fallback; original LaTeX is stored separately for an exact round trip. */
export function latexToGrace(text: string): string {
  if (!hasLatex(text)) return text;
  const convert = (value: string) => {
    let v = value;
    for (let i = 0; i < 5; i++)
      v = v
        .replace(/\\(?:d?frac)\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
        .replace(/\\sqrt\{([^{}]*)\}/g, 'sqrt($1)');
    v = v
      .replace(/\\(?:left|right)\b/g, '')
      .replace(/\\(text|mathrm|mathbf|mathit|operatorname)\{([^{}]*)\}/g, '$2');
    v = v.replace(
      /\\([a-zA-Z]+)/g,
      (_, name: string) =>
        greek[name] ??
        { cdot: '·', times: 'x', infty: 'inf', pm: '±', leq: '<=', geq: '>=' }[name] ??
        name,
    );
    v = v
      .replace(/\^\{([^{}]*)\}/g, '\\S$1\\N')
      .replace(/_\{([^{}]*)\}/g, '\\s$1\\N')
      .replace(/\^([\w+-])/g, '\\S$1\\N')
      .replace(/_([\w+-])/g, '\\s$1\\N')
      .replace(/[{}]/g, '');
    return [...v]
      .map((c) => (c.codePointAt(0)! <= 255 || Object.values(greek).includes(c) ? c : '?'))
      .join('');
  };
  const parts = latexParts(text);
  if (!parts) return convert(text).replace(/\\$/, '');
  return parts
    .map((part) => (part.math ? convert(part.text.replace(/\$|\\[()[\]]/g, '')) : part.text))
    .join('');
}
export function asciiJson(value: unknown): string {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw Error('Valor não serializável.');
  return encoded.replace(
    /[^\x20-\x7e]/g,
    (char) => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'),
  );
}
export function readLatexMetadata(source: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const match of source.matchAll(
    /^# LSNGrace latex (g\d+\.(?:title|subtitle|(?:alt[xy]|[xy])axis\.label|s\d+\.legend)) ("[^\n]*")\s*$/gm,
  )) {
    const text = JSON.parse(match[2]);
    if (typeof text !== 'string' || text.length > 16384)
      throw Error('Texto LaTeX inválido ou maior que 16 mil caracteres.');
    values.set(match[1], text);
  }
  return values;
}
export function graphLatex(graph: Graph): [string, string][] {
  const fields: [string, string][] = [
    ['title', graph.title.text],
    ['subtitle', graph.subtitle.text],
    ...Object.entries(graph.axes).map(
      ([id, a]) => [`${id}.label`, a.label.text] as [string, string],
    ),
    ...graph.sets.map((s) => [`s${s.id}.legend`, s.legend] as [string, string]),
  ];
  return fields.filter(([, v]) => hasLatex(v)).map(([key, v]) => [`g${graph.id}.${key}`, v]);
}
export function restoreLatex(scene: Scene, values: Map<string, string>) {
  for (const [key, value] of values) {
    const [, id, field] = key.match(/^g(\d+)\.(.+)$/)!;
    const graph = scene.graphs.find((g) => g.id === +id);
    if (!graph) continue;
    if (field === 'title' || field === 'subtitle') graph[field].text = value;
    else if (field.endsWith('.label')) {
      const axis = graph.axes[field.slice(0, -6) as keyof Graph['axes']];
      if (axis) axis.label.text = value;
    } else {
      const set = graph.sets.find((s) => s.id === Number(field.match(/^s(\d+)/)?.[1]));
      if (set) set.legend = value;
    }
  }
}
