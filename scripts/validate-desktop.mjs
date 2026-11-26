import { extractFile, listPackage, statFile } from '@electron/asar';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';

const archives = process.argv.slice(2);
if (!archives.length) {
  for (const platform of ['linux', 'win']) {
    const archive = `release/${platform}-unpacked/resources/app.asar`;
    if (existsSync(archive)) archives.push(archive);
  }
}
if (!archives.length) throw Error('Nenhum pacote desktop encontrado.');
for (const archive of archives) {
  let checked = 0;
  for (const entry of listPackage(archive)) {
    const name = entry.replace(/^\//, '');
    const info = statFile(archive, name);
    if (info.files || info.link || info.unpacked || info.size === undefined) continue;
    const bytes = extractFile(archive, name);
    if (bytes.length !== info.size) throw Error(`${archive}: tamanho inválido em ${name}`);
    if (info.integrity) {
      const hash = createHash(info.integrity.algorithm.toLowerCase()).update(bytes).digest('hex');
      if (hash !== info.integrity.hash) throw Error(`${archive}: conteúdo corrompido em ${name}`);
    }
    checked++;
  }
  const pkg = JSON.parse(extractFile(archive, 'package.json').toString());
  if (pkg.name !== 'lsngrace' || pkg.main !== 'dist-desktop/main.cjs')
    throw Error('Entrada desktop inválida.');
  if (!extractFile(archive, 'dist/index.html').toString().includes('<title>LSNGrace'))
    throw Error('Interface ausente.');
  console.log(`${archive}: ${checked} arquivos íntegros, versão ${pkg.version}.`);
}
