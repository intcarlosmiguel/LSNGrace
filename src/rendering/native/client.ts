import type { Scene } from '../../core/scene/types';
import { serializeAgr } from '../../core/agr/serializer';
import type { RasterOptions } from '../../core/export/raster';
export async function requestGraceOutput(
  scene: Scene,
  format: 'svg' | 'png' | 'eps' | 'agr' | 'pdf' = 'svg',
  signal?: AbortSignal,
  options: RasterOptions = {},
): Promise<{ blob: Blob; warnings: string[] }> {
  const response = await fetch('/api/grace/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agr: serializeAgr(scene), format, ...options }),
    signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Motor Grace indisponível.' }));
    throw Error(error.error ?? 'O Grace não conseguiu processar o projeto.');
  }
  if (response.headers.get('X-LSNGrace-Engine') !== 'gracebat')
    throw Error('Inicie o servidor local do LSNGrace para usar o Grace original.');
  return {
    blob: await response.blob(),
    warnings: readNativeWarnings(response.headers.get('X-LSNGrace-Warnings')),
  };
}
export function readNativeWarnings(header: string | null): string[] {
  if (!header) return [];
  try {
    const values = JSON.parse(decodeURIComponent(header));
    return Array.isArray(values)
      ? values.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}
export async function requestGrace(
  scene: Scene,
  format: 'svg' | 'png' | 'eps' | 'agr' | 'pdf' = 'svg',
  signal?: AbortSignal,
): Promise<Blob> {
  return (await requestGraceOutput(scene, format, signal)).blob;
}
/** SVG from a native driver is still sanitized before insertion into the document. */
export function safeNativeSvg(source: string): string {
  const document = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg')
    throw Error('SVG inválido retornado pelo Grace.');
  const allowed = new Set([
    'svg',
    'g',
    'path',
    'line',
    'rect',
    'circle',
    'ellipse',
    'polygon',
    'polyline',
    'text',
    'tspan',
    'defs',
    'pattern',
    'clipPath',
    'use',
    'title',
    'desc',
  ]);
  for (const element of [...document.querySelectorAll('*')]) {
    if (!allowed.has(element.localName)) {
      element.remove();
      continue;
    }
    for (const attr of [...element.attributes])
      if (
        /^on/i.test(attr.name) ||
        (attr.localName === 'href' && !attr.value.startsWith('#')) ||
        (attr.name === 'style' &&
          /@import|expression\(|javascript:|url\(\s*(?!#)/i.test(attr.value))
      )
        element.removeAttribute(attr.name);
  }
  return new XMLSerializer().serializeToString(document.documentElement);
}
