/** Small arithmetic grammar shared by Grace-style and LaTeX fits. Never executes code. */
type Node =
  | { kind: 'number'; value: number }
  | { kind: 'variable'; name: string }
  | { kind: 'binary'; op: string; left: Node; right: Node }
  | { kind: 'function'; name: string; args: Node[] }
  | { kind: 'negative'; value: Node };
const functions: Record<string, { arity: number; fn: (...args: number[]) => number }> = {
  sin: { arity: 1, fn: Math.sin },
  cos: { arity: 1, fn: Math.cos },
  tan: { arity: 1, fn: Math.tan },
  asin: { arity: 1, fn: Math.asin },
  acos: { arity: 1, fn: Math.acos },
  atan: { arity: 1, fn: Math.atan },
  atan2: { arity: 2, fn: Math.atan2 },
  asinh: { arity: 1, fn: Math.asinh },
  acosh: { arity: 1, fn: Math.acosh },
  atanh: { arity: 1, fn: Math.atanh },
  sinh: { arity: 1, fn: Math.sinh },
  cosh: { arity: 1, fn: Math.cosh },
  tanh: { arity: 1, fn: Math.tanh },
  exp: { arity: 1, fn: Math.exp },
  ln: { arity: 1, fn: Math.log },
  log: { arity: 1, fn: Math.log },
  log10: { arity: 1, fn: Math.log10 },
  log2: { arity: 1, fn: Math.log2 },
  sqr: { arity: 1, fn: (x) => x * x },
  sgn: { arity: 1, fn: Math.sign },
  minof: { arity: 2, fn: Math.min },
  maxof: { arity: 2, fn: Math.max },
  sqrt: { arity: 1, fn: Math.sqrt },
  abs: { arity: 1, fn: Math.abs },
  pow: { arity: 2, fn: Math.pow },
};
const greek = [
  'alpha',
  'beta',
  'gamma',
  'delta',
  'epsilon',
  'theta',
  'lambda',
  'mu',
  'nu',
  'sigma',
  'tau',
  'phi',
  'omega',
];
const greekGlyphs = ['α', 'β', 'γ', 'δ', 'ε', 'θ', 'λ', 'μ', 'ν', 'σ', 'τ', 'φ', 'ω'];
function normalizeLatex(input: string) {
  let s = input.trim();
  if (s.startsWith('$$') && s.endsWith('$$')) s = s.slice(2, -2);
  else if (s.startsWith('$') && s.endsWith('$')) s = s.slice(1, -1);
  else if ((s.startsWith('\\(') && s.endsWith('\\)')) || (s.startsWith('\\[') && s.endsWith('\\]')))
    s = s.slice(2, -2);
  s = s.replace(/−/g, '-').replace(/[×·]/g, '*').replace(/π/g, 'pi');
  greekGlyphs.forEach((v, i) => {
    s = s.replaceAll(v, greek[i]);
  });
  let i = 0;
  const group = (depth: number): string => {
    if (depth > 48) throw Error('Fórmula muito aninhada.');
    let out = '';
    const argument = () => {
      while (/\s/.test(s[i] ?? '') && i < s.length) i++;
      if (s[i] !== '{') throw Error('Use chaves no argumento LaTeX. Ex.: \\frac{x}{a_1}.');
      i++;
      return group(depth + 1);
    };
    while (i < s.length) {
      const c = s[i++];
      if (c === '}') {
        if (depth === 0) throw Error('Chave inesperada na fórmula.');
        return out;
      }
      if (c === '{') {
        out += '(' + group(depth + 1) + ')';
        continue;
      }
      if (c !== '\\') {
        out += c;
        continue;
      }
      if (/[ ,;!]/.test(s[i] ?? '')) {
        i++;
        out += ' ';
        continue;
      }
      const command = s.slice(i).match(/^[a-zA-Z]+/)?.[0];
      if (!command) throw Error('Comando LaTeX inválido.');
      i += command.length;
      if (command === 'left' || command === 'right') continue;
      if (command === 'cdot' || command === 'times') {
        out += '*';
        continue;
      }
      if (command === 'frac' || command === 'dfrac' || command === 'tfrac') {
        const a = argument(),
          b = argument();
        out += `((${a})/(${b}))`;
        continue;
      }
      if (command === 'sqrt') {
        out += `sqrt(${argument()})`;
        continue;
      }
      if (command === 'operatorname' || command === 'mathrm') {
        const name = argument().trim();
        if (!/^[a-zA-Z]+$/.test(name)) throw Error('Nome de função inválido.');
        out += name;
        continue;
      }
      if (Object.hasOwn(functions, command) || greek.includes(command) || command === 'pi') {
        out += ' ' + command + ' ';
        continue;
      }
      throw Error(`Comando LaTeX não suportado: \\${command}.`);
    }
    if (depth > 0) throw Error('Falta fechar uma chave na fórmula.');
    return out;
  };
  return group(0)
    .replace(
      /\b([a-z]+)\s*_\s*(?:\(\s*([0-9]+)\s*\)|([0-9]+))/gi,
      (_, name, grouped, bare) => name + (grouped ?? bare),
    )
    .trim()
    .replace(/^y\s*=\s*/i, '');
}
const escapeXml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
function text(node: Node): string {
  if (node.kind === 'number') return String(node.value);
  if (node.kind === 'variable') return node.name;
  if (node.kind === 'negative') return `(-${text(node.value)})`;
  if (node.kind === 'function') return `${node.name}(${node.args.map(text).join(', ')})`;
  return `(${text(node.left)} ${node.op} ${text(node.right)})`;
}
function math(node: Node): string {
  if (node.kind === 'number') return `<mn>${node.value}</mn>`;
  if (node.kind === 'variable') {
    const m = node.name.match(/^([a-z]+)(\d+)$/);
    const glyph = (v: string) => greekGlyphs[greek.indexOf(v)] ?? v;
    return m
      ? `<msub><mi>${escapeXml(glyph(m[1]))}</mi><mn>${m[2]}</mn></msub>`
      : `<mi>${escapeXml(glyph(node.name))}</mi>`;
  }
  if (node.kind === 'negative') return `<mrow><mo>−</mo>${math(node.value)}</mrow>`;
  if (node.kind === 'function') {
    if (node.name === 'sqrt') return `<msqrt>${math(node.args[0])}</msqrt>`;
    return `<mrow><mi mathvariant="normal">${node.name}</mi><mo>(</mo>${node.args.map(math).join('<mo>,</mo>')}<mo>)</mo></mrow>`;
  }
  if (node.op === '/') return `<mfrac>${math(node.left)}${math(node.right)}</mfrac>`;
  if (node.op === '^') return `<msup>${math(node.left)}${math(node.right)}</msup>`;
  return `<mrow><mo>(</mo>${math(node.left)}<mo>${node.op === '*' ? '·' : node.op === '-' ? '−' : node.op}</mo>${math(node.right)}<mo>)</mo></mrow>`;
}
export function compileExpression(
  input: string,
  options: { variables?: string[]; allowConstant?: boolean } = {},
) {
  if (!input.trim() || input.length > 4096)
    throw Error('Informe uma fórmula de até 4096 caracteres.');
  const normalized = normalizeLatex(input),
    tokens: string[] = [];
  let offset = 0;
  while (offset < normalized.length) {
    if (/\s/.test(normalized[offset])) {
      offset++;
      continue;
    }
    const token = normalized
      .slice(offset)
      .match(
        /^(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[a-zA-Z][a-zA-Z0-9]*|\*\*|[+\-*/^(),])/i,
      )?.[0];
    if (!token) throw Error(`Símbolo não suportado na fórmula: ${normalized[offset]}.`);
    tokens.push(token === '**' ? '^' : token.toLowerCase());
    offset += token.length;
    if (tokens.length > 512) throw Error('Fórmula muito longa.');
  }
  let pos = 0,
    depth = 0;
  const parameters = new Set<string>();
  const peek = () => tokens[pos];
  const expect = (t: string) => {
    if (tokens[pos++] !== t) throw Error(`Esperado “${t}” na fórmula.`);
  };
  const parse = (min = 0): Node => {
    if (++depth > 64) throw Error('Fórmula muito aninhada.');
    let node: Node;
    const token = tokens[pos++];
    if (token === '+' || token === '-') {
      const value = parse(25);
      node = token === '-' ? { kind: 'negative', value } : value;
    } else if (token === '(') {
      node = parse();
      expect(')');
    } else if (token && /^\d|^\.\d/.test(token)) {
      const value = Number(token);
      if (!Number.isFinite(value)) throw Error('Número inválido.');
      node = { kind: 'number', value };
    } else if (token && Object.hasOwn(functions, token)) {
      let power: Node | undefined;
      if (peek() === '^') {
        pos++;
        power = parse(31);
      }
      const args: Node[] = [];
      if (peek() === '(') {
        pos++;
        args.push(parse());
        while (peek() === ',') {
          pos++;
          args.push(parse());
        }
        expect(')');
      } else args.push(parse(25));
      if (args.length !== functions[token].arity)
        throw Error(`${token} exige ${functions[token].arity} argumento(s).`);
      node = { kind: 'function', name: token, args };
      if (power) node = { kind: 'binary', op: '^', left: node, right: power };
    } else if (token === 'pi' || token === 'e')
      node = { kind: 'number', value: token === 'pi' ? Math.PI : Math.E };
    else if (
      token === 'x' ||
      options.variables?.includes(token) ||
      /^a[0-9]$/.test(token ?? '') ||
      greek.some((name) => new RegExp(`^${name}[0-9]?$`).test(token ?? ''))
    ) {
      node = { kind: 'variable', name: token };
      if (token !== 'x') parameters.add(token);
    } else
      throw Error(
        `Variável ou função desconhecida: ${token ?? 'fim da fórmula'}. Use x e parâmetros a0…a9 ou letras gregas.`,
      );
    while (pos < tokens.length) {
      const next = peek(),
        implicit = next === '(' || /^[a-z]/.test(next) || /^(?:\d|\.\d)/.test(next);
      const precedence =
        next === '+' || next === '-'
          ? 10
          : next === '*' || next === '/' || implicit
            ? 20
            : next === '^'
              ? 30
              : -1;
      if (precedence < min) break;
      const op = implicit ? '*' : tokens[pos++];
      const right = parse(op === '^' ? precedence : precedence + 1);
      node = { kind: 'binary', op, left: node, right };
    }
    depth--;
    return node;
  };
  const tree = parse();
  if (pos !== tokens.length) throw Error('Fórmula incompleta ou parênteses incompatíveis.');
  const names = [...parameters].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  if (!options.allowConstant && (!names.length || names.length > 10))
    throw Error('Use de 1 a 10 parâmetros ajustáveis (a0…a9 ou letras gregas).');
  if (options.variables && names.some((name) => !options.variables!.includes(name)))
    throw Error('Use apenas as colunas indicadas na tabela.');
  const indices = new Map(names.map((n, i) => [n, i]));
  const evaluateNode = (node: Node, x: number, p: number[]): number => {
    if (node.kind === 'number') return node.value;
    if (node.kind === 'variable') return node.name === 'x' ? x : p[indices.get(node.name)!];
    if (node.kind === 'negative') return -evaluateNode(node.value, x, p);
    if (node.kind === 'function')
      return functions[node.name].fn(...node.args.map((n) => evaluateNode(n, x, p)));
    const a = evaluateNode(node.left, x, p),
      b = evaluateNode(node.right, x, p);
    return node.op === '+'
      ? a + b
      : node.op === '-'
        ? a - b
        : node.op === '*'
          ? a * b
          : node.op === '/'
            ? a / b
            : a ** b;
  };
  return {
    parameters: names,
    normalized: text(tree),
    mathml: `<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>y</mi><mo>=</mo>${math(tree)}</math>`,
    evaluate: (x: number, p: number[]) => evaluateNode(tree, x, p),
  };
}
