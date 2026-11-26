/** Store physical resolution as a standard PNG pHYs chunk, including its CRC. */
export function pngResolution(png: Buffer, dpi: number): Buffer {
  const chunk = Buffer.alloc(21);
  chunk.writeUInt32BE(9, 0);
  chunk.write('pHYs', 4, 'ascii');
  const ppm = Math.round(dpi / 0.0254);
  chunk.writeUInt32BE(ppm, 8);
  chunk.writeUInt32BE(ppm, 12);
  chunk[16] = 1;
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, 17)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 17);
  const parts = [png.subarray(0, 8), chunk];
  for (let offset = 8; offset < png.length;) {
    const end = offset + png.readUInt32BE(offset) + 12;
    if (png.toString('ascii', offset + 4, offset + 8) !== 'pHYs')
      parts.push(png.subarray(offset, end));
    offset = end;
  }
  // IHDR must precede every other chunk.
  const header = parts.splice(2, 1)[0];
  return Buffer.concat([parts[0], header, ...parts.slice(1)]);
}
