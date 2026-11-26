/** Shared declarative field table prevents parser/exporter drift. */
type Codec = { read: (s: string) => unknown; write: (v: unknown) => string };
export const numeric: Codec = {
  read: (s) => {
    const n = Number(s.replace(/[dD]/g, 'e'));
    if (!s.trim() || !Number.isFinite(n)) throw Error('Número inválido');
    return n;
  },
  write: (v) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) throw Error('Valor numérico não finito');
    return String(v);
  },
};
export const quoted: Codec = {
  read: (s) => {
    if (!/^"(?:\\.|[^"\\])*"$/.test(s)) throw Error('Texto sem aspas válidas');
    return s.slice(1, -1).replace(/\\"/g, '"');
  },
  write: (v) =>
    `"${String(v)
      .replace(/"/g, '\\"')
      .replace(/[\r\n]/g, ' ')}"`,
};
const word: Codec = { read: (s) => s.toLowerCase(), write: (v) => String(v) };
const enumeration = (...values: string[]): Codec => ({
  read: (s) => {
    const value = values.find((v) => v.toLowerCase() === s.toLowerCase());
    if (!value) throw Error(`Esperado: ${values.join(', ')}`);
    return value;
  },
  write: (v) => {
    if (!values.includes(String(v))) throw Error('Valor enumerado inválido');
    return String(v);
  },
});
const onoff: Codec = {
  read: (s) => {
    if (!/^(on|off)$/i.test(s)) throw Error('Esperado on/off');
    return s.toLowerCase() === 'on';
  },
  write: (v) => (v ? 'on' : 'off'),
};
const bool: Codec = {
  read: (s) => {
    if (!/^(true|false)$/i.test(s)) throw Error('Esperado true/false');
    return s.toLowerCase() === 'true';
  },
  write: (v) => String(v),
};
const tuple = (size: number): Codec => ({
  read: (s) => {
    const list = s.split(/[\s,]+/).map((v) => numeric.read(v));
    if (list.length !== size) throw Error(`Esperados ${size} números`);
    return list;
  },
  write: (v) => (v as number[]).map((n) => numeric.write(n)).join(', '),
});
export interface Field {
  optional?: boolean;
  command: string;
  path: string;
  codec: Codec;
}
const field = (command: string, path: string, codec = numeric): Field => ({ command, path, codec });
const optional = (command: string, path: string, codec = numeric): Field => ({
  ...field(command, path, codec),
  optional: true,
});
const strokes = (command: string, path: string) => [
  field(`${command} color`, `${path}.color`),
  field(`${command} linewidth`, `${path}.width`),
  field(`${command} linestyle`, `${path}.style`),
];
const text = (command: string, path: string, size = 'size') => [
  field(command, `${path}.text`, quoted),
  field(`${command} font`, `${path}.font`),
  field(`${command} color`, `${path}.color`),
  field(`${command} ${size}`, `${path}.size`),
];
export const pageFields = [
  field('page size', 'page.size', tuple(2)),
  field('background color', 'page.background'),
  field('page background fill', 'page.fill', onoff),
];
export const graphFields: Field[] = [
  field('world', 'world', tuple(4)),
  field('view', 'viewport', tuple(4)),
  ...text('title', 'title'),
  ...text('subtitle', 'subtitle'),
  ...['xaxis', 'yaxis', 'altxaxis', 'altyaxis'].flatMap((axis) => {
    const p = `axes.${axis}`;
    const fields = [
      field(axis, `${p}.enabled`, onoff),
      optional(`${axis} type zero`, `${p}.zero`, bool),
      optional(`${axis} offset`, `${p}.offset`, tuple(2)),
      ...text(`${axis} label`, `${p}.label`, 'char size'),
      field(`${axis} bar`, `${p}.bar.enabled`, onoff),
      ...strokes(`${axis} bar`, `${p}.bar`),
      field(`${axis} tick`, `${p}.ticks.enabled`, onoff),
      field(`${axis} tick major`, `${p}.ticks.major`),
      field(`${axis} tick minor ticks`, `${p}.ticks.minorCount`),
      field(`${axis} tick place rounded`, `${p}.ticks.rounded`, bool),
      field(`${axis} tick place`, `${p}.ticks.place`, enumeration('normal', 'opposite', 'both')),
      field(`${axis} tick major size`, `${p}.ticks.majorSize`),
      field(`${axis} tick minor size`, `${p}.ticks.minorSize`),
      ...strokes(`${axis} tick major`, `${p}.ticks.majorStroke`),
      ...strokes(`${axis} tick minor`, `${p}.ticks.minorStroke`),
      field(`${axis} tick major grid`, `${p}.ticks.majorGrid`, onoff),
      field(`${axis} tick minor grid`, `${p}.ticks.minorGrid`, onoff),
      field(`${axis} ticklabel`, `${p}.tickLabels.enabled`, onoff),
      field(
        `${axis} ticklabel format`,
        `${p}.tickLabels.format`,
        enumeration('decimal', 'exponential', 'power', 'scientific', 'general'),
      ),
      field(`${axis} ticklabel prec`, `${p}.tickLabels.precision`),
      field(
        `${axis} ticklabel place`,
        `${p}.tickLabels.place`,
        enumeration('normal', 'opposite', 'both'),
      ),
      field(`${axis} ticklabel angle`, `${p}.tickLabels.angle`),
      optional(`${axis} ticklabel skip`, `${p}.tickLabels.skip`),
      optional(`${axis} ticklabel stagger`, `${p}.tickLabels.stagger`),
      field(`${axis} ticklabel char size`, `${p}.tickLabels.size`),
      field(`${axis} ticklabel font`, `${p}.tickLabels.font`),
      field(`${axis} ticklabel color`, `${p}.tickLabels.color`),
      field(`${axis} ticklabel prepend`, `${p}.tickLabels.prepend`, quoted),
      field(`${axis} ticklabel append`, `${p}.tickLabels.append`, quoted),
    ];
    if (axis === 'xaxis' || axis === 'yaxis')
      fields.push(
        field(
          `${axis[0]}axes scale`,
          `${p}.scale`,
          enumeration('Normal', 'Logarithmic', 'Reciprocal'),
        ),
        field(`${axis[0]}axes invert`, `${p}.inverted`, onoff),
      );
    return fields;
  }),
  field('legend', 'legend.enabled', onoff),
  field('legend loctype', 'legend.coordinates', enumeration('view', 'world')),
  field('legend font', 'legend.font'),
  field('legend char size', 'legend.size'),
  field('legend color', 'legend.color'),
  field('legend length', 'legend.length'),
  field('legend vgap', 'legend.vgap'),
  field('legend hgap', 'legend.hgap'),
  field('legend invert', 'legend.inverted', bool),
  ...strokes('legend box', 'legend.box'),
  field('legend box pattern', 'legend.box.pattern'),
  field('legend box fill color', 'legend.box.fill.color'),
  field('legend box fill pattern', 'legend.box.fill.pattern'),
  ...strokes('frame', 'frame'),
  field('frame type', 'frame.type'),
  field('frame pattern', 'frame.pattern'),
  field('frame background color', 'frame.background.color'),
  field('frame background pattern', 'frame.background.pattern'),
];
export const setFields: Field[] = [
  field('hidden', 'hidden', bool),
  field('type', 'type', word),
  field('legend', 'legend', quoted),
  field('comment', 'comment', quoted),
  field('symbol', 'symbol.type'),
  field('symbol size', 'symbol.size'),
  field('symbol color', 'symbol.color'),
  field('symbol linewidth', 'symbol.width'),
  field('symbol linestyle', 'symbol.style'),
  field('symbol fill color', 'symbol.fill.color'),
  field('symbol fill pattern', 'symbol.fill.pattern'),
  field('symbol char', 'symbol.character'),
  field('symbol char font', 'symbol.font'),
  field('symbol skip', 'symbol.skip'),
  field('line type', 'line.connection'),
  ...strokes('line', 'line'),
  field('fill type', 'fill.type'),
  field('fill rule', 'fill.rule'),
  field('fill color', 'fill.color'),
  field('fill pattern', 'fill.pattern'),
  field('errorbar', 'errorBars.enabled', onoff),
  field('errorbar place', 'errorBars.place', enumeration('normal', 'opposite', 'both')),
  field('errorbar color', 'errorBars.color'),
  field('errorbar pattern', 'errorBars.pattern'),
  field('errorbar size', 'errorBars.size'),
  field('errorbar linewidth', 'errorBars.width'),
  field('errorbar linestyle', 'errorBars.style'),
  field('errorbar riser linewidth', 'errorBars.riserWidth'),
  field('errorbar riser linestyle', 'errorBars.riserStyle'),
  field('errorbar riser clip', 'errorBars.clip', onoff),
  field('errorbar riser clip length', 'errorBars.clipLength'),
];
export function getPath(object: unknown, path: string): unknown {
  return path.split('.').reduce((o, p) => (o as Record<string, unknown>)[p], object);
}
export function setPath(object: unknown, path: string, value: unknown) {
  const keys = path.split('.');
  let target = object as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) target = target[key] as Record<string, unknown>;
  target[keys.at(-1)!] = value;
}
/** Prefer longest directive first: tick major size must precede tick major. */
export function readField(object: unknown, statement: string, fields: Field[]): boolean {
  for (const f of [...fields].sort((a, b) => b.command.length - a.command.length)) {
    if (statement.toLowerCase().startsWith(f.command + ' ')) {
      const value = statement.slice(f.command.length + 1);
      // A prefix alone is not a recognized directive (e.g. ticklabel offset).
      if (f.codec === numeric && !/^[+\-.\d]/.test(value)) continue;
      if (f.codec === quoted && !value.startsWith('"')) continue;
      if (f.codec === onoff && !/^(on|off)$/i.test(value)) continue;
      setPath(object, f.path, f.codec.read(value));
      return true;
    }
  }
  return false;
}
export function writeFields(object: unknown, fields: Field[], prefix = '') {
  return fields
    .filter((f) => !f.optional || getPath(object, f.path) !== undefined)
    .map((f) => `@    ${prefix}${f.command} ${f.codec.write(getPath(object, f.path))}`);
}
