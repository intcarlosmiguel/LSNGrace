import { svgToPdf } from './svgPdf';
import { worksheetMetadata } from '../src/core/analysis/worksheet';
import { prepareFigure, applyFigure } from './figureStyle';
import { figureMetadata, figureComments } from '../src/core/style/figure';
import { prepareMath, applyMath, mathMetadata } from './math';
import { isRegressionReport } from '../src/core/analysis/metadata';
import { asciiJson } from '../src/core/text/latex';
import { readLatexMetadata } from '../src/core/text/latex';
import { renderAsync } from '@resvg/resvg-js';
import { rasterSize, type RasterOptions } from '../src/core/export/raster';
import { pngResolution } from './pngResolution';
import { alphaSettings, prepareAlpha, applyAlpha } from './appearance';
import { RenderGate } from './renderGate';
import { createHash } from 'node:crypto';
import { BudgetCache } from '../src/core/cache';
import { normalizeGraceSvg } from '../src/rendering/native/normalizeSvg';
import { runGrace } from './runner';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { graceDiagnostics } from './diagnostics';
export type NativeFormat = 'svg' | 'png' | 'eps' | 'agr' | 'pdf';
const devices = { svg: 'SVG', png: 'PNG', eps: 'EPS' } as const;
const allowed =
  /^(?:version|page|link|map|reference|date|default|background|timestamp|r\d+|g\d+|with|world|stack|znorm|view|title|subtitle|xaxes|yaxes|xaxis|yaxis|altxaxis|altyaxis|legend|frame|s\d+|target|type|string|line|box|ellipse)$/i;
/** This endpoint accepts project declarations, never arbitrary Grace batch scripts. */
export function assertDeclarativeAgr(agr: string): void {
  if (typeof agr !== 'string' || !agr.trim() || Buffer.byteLength(agr) > 16 * 1024 * 1024)
    throw Error('Projeto AGR vazio ou maior que 16 MB.');
  const lines = agr.split(/\r?\n/);
  lines.forEach((line, index) => {
    const text = line.trim();
    if (!text || text.startsWith('#') || text === '&') return;
    if (!text.startsWith('@')) {
      if (!/^[\s,+\-.\deEdD]+$/.test(text))
        throw Error(`Linha ${index + 1}: dados numéricos inválidos.`);
      return;
    }
    if (/^@\s*page\s+size\s/i.test(text)) {
      const sizes = text
        .replace(/^@\s*page\s+size\s+/i, '')
        .split(/[\s,]+/)
        .map(Number);
      if (sizes.length !== 2 || sizes.some((n) => !Number.isFinite(n) || n <= 0 || n > 4096))
        throw Error('A página nativa deve ter dimensões entre 0 e 4096 pontos.');
    }
    const command = text.slice(1).trim();
    const first = command.match(/^\w+/)?.[0];
    if (!first || !allowed.test(first))
      throw Error(
        `Linha ${index + 1}: apenas parâmetros declarativos AGR são permitidos no motor local.`,
      );
    // Remove quoted text before looking for batch operations or statement chaining.
    const stripped = command.replace(/"(?:\\.|[^"\\])*"/g, '""');
    if (
      /"/.test(stripped.replace(/""/g, '')) ||
      /[;`$\\]/.test(stripped) ||
      /\b(?:read|load|exec|system|print|hardcopy|saveall|source|run|include|batch|pipe|netcdf|open|close|write|device|export|safe|nosafe|hotlink)\b/i.test(
        stripped,
      )
    )
      throw Error(`Linha ${index + 1}: operação externa não permitida no projeto.`);
    if (
      first.toLowerCase() === 'with' &&
      !/^with\s+(?:g\d+|string|line|box|ellipse)\s*$/i.test(command)
    )
      throw Error(`Linha ${index + 1}: contexto AGR não reconhecido.`);
  });
}
/** Grace uses ISO-8859-1, not UTF-8. Translate common Greek glyphs to native Symbol escapes. */
export function graceEncoding(agr: string): Buffer {
  const greek: Record<string, string> = {
    α: 'a',
    β: 'b',
    γ: 'g',
    δ: 'd',
    ε: 'e',
    ζ: 'z',
    η: 'h',
    θ: 'q',
    ι: 'i',
    κ: 'k',
    λ: 'l',
    μ: 'm',
    ν: 'n',
    ξ: 'x',
    ο: 'o',
    π: 'p',
    ρ: 'r',
    σ: 's',
    τ: 't',
    υ: 'u',
    φ: 'f',
    χ: 'c',
    ψ: 'y',
    ω: 'w',
    Γ: 'G',
    Δ: 'D',
    Θ: 'Q',
    Λ: 'L',
    Ξ: 'X',
    Π: 'P',
    Σ: 'S',
    Φ: 'F',
    Ψ: 'Y',
    Ω: 'W',
  };
  const punctuation: Record<string, string> = {
    '–': '-',
    '—': '-',
    '‘': "'",
    '’': "'",
    '“': "'",
    '”': "'",
    '−': '-',
  };
  // Scientific numeric blocks are ASCII: scan them once in the regex engine,
  // without allocating an array or an object for every character.
  const encoded = agr.replace(/[^\x00-\x7f]/gu, (char) => {
    if (greek[char]) return `\\f{Symbol}${greek[char]}\\f{}`;
    if (punctuation[char]) return punctuation[char];
    if (char.codePointAt(0)! <= 255) return char;
    throw Error(
      `O caractere “${char}” não pertence à codificação do Grace. Use escapes de texto do Grace.`,
    );
  });
  return Buffer.from(encoded, 'latin1');
}
let statusCache: Promise<{ available: boolean; version: string; devices: string[] }> | undefined;
export function graceStatus() {
  return (statusCache ??= (async () => {
    try {
      const result = await runGrace(['-version'], { timeout: 5000, maxBuffer: 1024 * 1024 });
      const output = result.stdout + result.stderr;
      return {
        available: true,
        version: output.match(/Grace-[\d.]+/)?.[0] ?? 'Grace',
        devices: ['SVG', 'PNG', 'EPS', 'PDF'],
      };
    } catch {
      statusCache = undefined;
      return { available: false, version: '', devices: [] };
    }
  })());
}
const renderCache = new BudgetCache<string, { output: Buffer; warnings: string[] }>(
  32 * 1024 * 1024,
  8,
);
const gate = new RenderGate(2);
const conversionGate = new RenderGate(1);
export async function renderGraceDetailed(
  agr: string,
  format: NativeFormat = 'svg',
  signal?: AbortSignal,
  options: RasterOptions = {},
): Promise<{ output: Buffer; warnings: string[] }> {
  if (!['svg', 'png', 'eps', 'agr', 'pdf'].includes(format))
    throw Error('Formato de exportação inválido.');
  signal?.throwIfAborted();
  if (typeof agr !== 'string' || Buffer.byteLength(agr) > 16 * 1024 * 1024)
    throw Error('Projeto AGR vazio ou maior que 16 MB.');
  if (options.dpi !== undefined && format !== 'png')
    throw Error('DPI só se aplica à exportação PNG.');
  const page = (agr.match(/^@\s*page size ([^\n]+)/m)?.[1] ?? '792,612')
    .split(/[\s,]+/)
    .map(Number);
  const pixels =
    format === 'png' && !options.nativePreview
      ? rasterSize(page, options.dpi ?? 96)
      : options.dpi === undefined
        ? undefined
        : rasterSize(page, options.dpi);
  const key =
    format +
    ':' +
    (options.dpi ?? 'default') +
    ':' +
    !!options.nativePreview +
    ':' +
    createHash('sha256').update(agr).digest('hex');
  const cached = renderCache.get(key);
  if (cached) return cached;
  assertDeclarativeAgr(agr);
  const alpha = alphaSettings(agr),
    latex = readLatexMetadata(agr),
    figure = figureMetadata(agr);
  if (
    format === 'pdf' ||
    (format === 'png' && (pixels || alpha.size || latex.size || figure.size))
  ) {
    const vector = await renderGraceDetailed(agr, 'svg', signal);
    const releaseConversion = await conversionGate.acquire(signal);
    try {
      signal?.throwIfAborted();
      let output: Buffer;
      if (format === 'pdf') output = await svgToPdf(vector.output, page, signal);
      else {
        const dpi = options.dpi ?? 96;
        const size = pixels ?? rasterSize(page, dpi);
        // Set both output dimensions: fitting only width can round the height incorrectly.
        const source = vector.output
          .toString('utf8')
          .replace(/<svg\b[^>]*>/, (tag) =>
            tag
              .replace(/\s(?:width|height)="[^"]*"/g, '')
              .replace(/>$/, ` width="${size.width}" height="${size.height}">`),
          );
        const rendered = await renderAsync(source, { font: { loadSystemFonts: true } }, signal);
        signal?.throwIfAborted();
        if (rendered.width !== size.width || rendered.height !== size.height)
          throw Error('As dimensões do PNG não correspondem à resolução solicitada.');
        output = pngResolution(Buffer.from(rendered.asPng()), dpi);
      }
      const result = { output, warnings: vector.warnings };
      renderCache.set(key, result, output.length);
      return result;
    } finally {
      releaseConversion();
    }
  }
  const math =
    format === 'svg'
      ? await prepareMath(agr)
      : { source: agr, replacements: [], warnings: [], metadata: latex };
  const figurePrepared = format === 'svg' ? prepareFigure(math.source) : undefined;
  const appearance =
    format === 'svg' || format === 'eps'
      ? prepareAlpha(figurePrepared?.source ?? math.source, format === 'eps')
      : { source: agr, paints: new Map<string, { hex: string; alpha: number }>() };
  const source = graceEncoding(appearance.source);
  const release = await gate.acquire(signal);
  let directory: string | undefined;
  try {
    signal?.throwIfAborted();
    directory = await mkdtemp(join(tmpdir(), 'lsngrace-native-'));
    const input = join(directory, 'project.agr'),
      output = join(directory, `figure.${format}`);
    await writeFile(input, source);
    const result = await runGrace(
      format === 'agr'
        ? [
            '-safe',
            '-noask',
            input,
            '-pexec',
            'default sformat "%.17g"',
            '-noprint',
            '-saveall',
            output,
          ]
        : [
            '-safe',
            '-noask',
            input,
            '-hdevice',
            devices[format as keyof typeof devices],
            '-printfile',
            output,
            '-hardcopy',
          ],
      {
        cwd: directory,
        timeout: 12000,
        maxBuffer: 2 * 1024 * 1024,
        signal,
        env: {
          PATH: process.env.PATH,
          LANG: 'C',
          LC_ALL: 'C',
          HOME: directory,
          GRACE_PRINT_CMD: '',
        },
      },
    );
    const diagnostics = graceDiagnostics(result.stderr);
    diagnostics.warnings.push(...math.warnings);
    if (latex.size && format === 'eps')
      diagnostics.warnings.push(
        'EPS usa a representação compatível do Grace para LaTeX. Use SVG/PNG para composição matemática completa.',
      );
    if (latex.size && format === 'agr')
      diagnostics.warnings.push(
        'LaTeX preservado para o LSNGrace; o Grace clássico usa uma representação compatível.',
      );
    if (figure.size && format === 'eps')
      diagnostics.warnings.push(
        'EPS usa a legenda vertical e os estilos compatíveis do Grace; use SVG/PNG para a composição e transparência completas.',
      );
    if (alpha.size && format === 'eps')
      diagnostics.warnings.push('EPS não suporta alpha; cores compostas sobre o fundo da página.');
    if (alpha.size && format === 'agr')
      diagnostics.warnings.push(
        'Alpha preservado em comentários do LSNGrace; o Grace clássico exibe cores opacas.',
      );
    if (diagnostics.errors.length) throw Error(`Grace: ${diagnostics.errors.join('\n')}`);
    const buffer = await readFile(output);
    if (!buffer.length) throw Error('O Grace produziu um arquivo vazio.');
    if (
      format === 'svg' &&
      (!buffer.toString('latin1').includes('<svg ') ||
        !/<\/svg>\s*$/.test(buffer.toString('latin1')))
    )
      throw Error('O Grace não produziu um SVG completo.');
    const complete = (output: Buffer) => {
      const result = { output, warnings: diagnostics.warnings };
      renderCache.set(key, result, output.byteLength);
      return result;
    };
    if (format === 'agr') {
      const worksheets = worksheetMetadata(agr);
      const worksheetIds = new Set(worksheets.map((m) => `${m.graphId}:${m.setId}`));
      let styleGraph = -1;
      const worksheetStyles = agr
        .split(/\r?\n/)
        .flatMap((line) => {
          const graph = line.match(/^@\s*with g(\d+)\s*$/i);
          if (graph) styleGraph = Number(graph[1]);
          const set = line.match(/^@\s*s(\d+)\s+/i);
          return set && worksheetIds.has(`${styleGraph}:${Number(set[1])}`)
            ? [`@with g${styleGraph}`, line]
            : [];
        })
        .join('\n');
      const regressionComments = agr
        .split(/\r?\n/)
        .flatMap((line) => {
          const match = line.match(/^# LSNGrace regression G(\d+) (.+)$/);
          if (!match) return [];
          try {
            const report: unknown = JSON.parse(match[2]);
            return isRegressionReport(report)
              ? [`# LSNGrace regression G${match[1]} ${asciiJson(report)}`]
              : [];
          } catch {
            return [];
          }
        })
        .join('\n');
      return complete(
        Buffer.from(
          buffer.toString('latin1').replace(/@version \d+/, '@version 50122') +
            '\n' +
            [...alpha.values()].map((v) => v.raw).join('\n') +
            '\n' +
            figureComments(figure) +
            '\n' +
            mathMetadata(latex) +
            '\n' +
            worksheetStyles +
            '\n' +
            worksheets
              .map((m) => `# LSNGrace worksheet G${m.graphId}.S${m.setId} ${asciiJson(m.sheet)}`)
              .join('\n') +
            '\n' +
            regressionComments +
            '\n',
          'latin1',
        ),
      );
    }
    if (format !== 'svg') return complete(buffer);
    // The native SVG driver writes Latin-1 and omits the namespace. Geometry is untouched.
    const svg = buffer
      .toString('latin1')
      .replace(/^<\?xml[^>]*>\s*/, '')
      .replace(/<!DOCTYPE[^>]*>\s*/, '')
      .replace(
        '<svg ',
        '<svg xmlns="http://www.w3.org/2000/svg" data-engine="grace" role="img" aria-label="Gráfico renderizado pelo Grace original" ',
      );
    if (!svg.includes('<svg ')) throw Error('O Grace não produziu um SVG válido.');
    return complete(
      Buffer.from(
        applyMath(
          figurePrepared
            ? applyFigure(applyAlpha(normalizeGraceSvg(svg), appearance.paints), figurePrepared)
            : applyAlpha(normalizeGraceSvg(svg), appearance.paints),
          math.replacements,
        ),
        'utf8',
      ),
    );
  } finally {
    release();
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}

/** Compatibility helper for callers that only need the native output bytes. */
export async function renderGrace(
  agr: string,
  format: NativeFormat = 'svg',
  signal?: AbortSignal,
): Promise<Buffer> {
  return (await renderGraceDetailed(agr, format, signal)).output;
}
