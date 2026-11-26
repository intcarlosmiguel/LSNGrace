export type RasterOptions = { dpi?: number; nativePreview?: boolean };
/** Page dimensions are points (1/72 inch); raster pixels depend on the output DPI. */
export function rasterSize(page: readonly number[], dpi: number) {
  if (!Number.isFinite(dpi) || dpi <= 0) throw Error('Informe um DPI maior que zero.');
  if (Math.round(dpi / 0.0254) > 0xffffffff)
    throw Error('O DPI excede o limite de resolução do formato PNG.');
  if (page.length !== 2 || page.some((pt) => !Number.isFinite(pt) || pt <= 0))
    throw Error('Dimensões de página inválidas.');
  const [width, height] = page.map((pt) => Math.round((pt * dpi) / 72));
  if (![width, height].every((n) => Number.isFinite(n) && n >= 1))
    throw Error('A resolução resulta em uma imagem menor que 1 pixel.');
  if (width > 20000 || height > 20000 || width * height > 144_000_000)
    throw Error(
      'A imagem excede 144 milhões de pixels ou 20.000 pixels por lado. Reduza o DPI ou o tamanho da imagem.',
    );
  return { width, height };
}
