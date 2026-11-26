import { runScientific } from './runner';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
// Use the system's vector SVG/PDF engines. No Python packages or network access.
const converter = String.raw`
import ctypes as C
import ctypes.util
import math
import sys
from pathlib import Path

class Rect(C.Structure):
    _fields_ = [(name, C.c_double) for name in ('x', 'y', 'width', 'height')]
class Error(C.Structure):
    _fields_ = [('domain', C.c_uint), ('code', C.c_int), ('message', C.c_char_p)]

def load(name):
    path = ctypes.util.find_library(name)
    if not path:
        raise RuntimeError('Biblioteca ausente: ' + name + '. PDF requer Cairo e librsvg do sistema.')
    return C.CDLL(path)
def function(lib, name, result, *args):
    fn = getattr(lib, name)
    fn.restype = result
    fn.argtypes = list(args)
    return fn

rsvg, cairo, gobj, glib = [load(n) for n in ('rsvg-2', 'cairo', 'gobject-2.0', 'glib-2.0')]
ptr, errptr = C.c_void_p, C.POINTER(Error)
new_svg = function(rsvg, 'rsvg_handle_new_from_data', ptr, C.c_char_p, C.c_size_t, C.POINTER(errptr))
render = function(rsvg, 'rsvg_handle_render_document', C.c_int, ptr, ptr, C.POINTER(Rect), C.POINTER(errptr))
new_pdf = function(cairo, 'cairo_pdf_surface_create', ptr, C.c_char_p, C.c_double, C.c_double)
new_context = function(cairo, 'cairo_create', ptr, ptr)
status = function(cairo, 'cairo_status', C.c_int, ptr)
surface_status = function(cairo, 'cairo_surface_status', C.c_int, ptr)
status_text = function(cairo, 'cairo_status_to_string', C.c_char_p, C.c_int)
finish = function(cairo, 'cairo_surface_finish', None, ptr)
destroy_context = function(cairo, 'cairo_destroy', None, ptr)
destroy_surface = function(cairo, 'cairo_surface_destroy', None, ptr)
unref = function(gobj, 'g_object_unref', None, ptr)
free_error = function(glib, 'g_error_free', None, errptr)
width, height = map(float, sys.argv[3:5])
if not all(math.isfinite(n) and 0 < n <= 4096 for n in (width, height)):
    raise RuntimeError('Tamanho de página PDF inválido.')
error, handle, surface, context = errptr(), None, None, None
try:
    data = Path(sys.argv[1]).read_bytes()
    handle = new_svg(data, len(data), C.byref(error))
    if not handle:
        raise RuntimeError(error.contents.message.decode('utf-8', 'replace') if error else 'SVG inválido.')
    surface = new_pdf(sys.argv[2].encode(), width, height)
    context = new_context(surface)
    viewport = Rect(0, 0, width, height)
    if not render(handle, context, C.byref(viewport), C.byref(error)):
        raise RuntimeError(error.contents.message.decode('utf-8', 'replace') if error else 'Falha ao renderizar PDF.')
    if status(context):
        raise RuntimeError(status_text(status(context)).decode())
    finish(surface)
    if surface_status(surface):
        raise RuntimeError(status_text(surface_status(surface)).decode())
finally:
    if context: destroy_context(context)
    if surface: destroy_surface(surface)
    if handle: unref(handle)
    if error: free_error(error)
`;
export async function svgToPdf(
  svg: Buffer,
  page: readonly number[],
  signal?: AbortSignal,
): Promise<Buffer> {
  const directory = await mkdtemp(join(tmpdir(), 'lsngrace-pdf-'));
  try {
    const input = join(directory, 'figure.svg'),
      output = join(directory, 'figure.pdf');
    await writeFile(input, svg);
    try {
      await runScientific(
        'python3',
        ['-c', converter, input, output, String(page[0]), String(page[1])],
        {
          timeout: 30000,
          maxBuffer: 1024 * 1024,
          signal,
        },
      );
    } catch (error) {
      signal?.throwIfAborted();
      const e = error as Error & { stderr?: string };
      throw Error(
        `Não foi possível gerar o PDF vetorial. Verifique Python 3, Cairo e librsvg. ${e.stderr?.trim().split('\n').at(-1) ?? e.message}`,
      );
    }
    signal?.throwIfAborted();
    const pdf = await readFile(output);
    if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-')))
      throw Error('O conversor não produziu um PDF válido.');
    return pdf;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
