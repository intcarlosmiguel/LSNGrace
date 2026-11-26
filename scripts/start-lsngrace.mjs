import { spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = path.join(root, '.lsngrace');
const url = 'http://127.0.0.1:1420';
const log = path.join(runtime, 'server.log');
const args = new Set(process.argv.slice(2));
process.env.PATH = `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH}`;

async function ready() {
  try {
    const response = await fetch(`${url}/api/grace/status`, { signal: AbortSignal.timeout(1500) });
    if (!response.ok || !(await response.json()).available) return false;
    const page = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return page.ok && (await page.text()).includes('<title>LSNGrace');
  } catch {
    return false;
  }
}

function run(command, parameters) {
  const result = spawnSync(command, parameters, { cwd: root, stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    throw new Error(`Falha ao executar ${command} ${parameters.join(' ')}.`);
  }
}

async function openWindow() {
  if (args.has('--no-open')) return;
  for (const browser of ['google-chrome', 'chromium', 'chromium-browser']) {
    if (spawnSync('which', [browser], { stdio: 'ignore' }).status === 0) {
      const child = spawn(browser, [`--app=${url}`, '--new-window'], {
        detached: true,
        stdio: 'ignore',
      });
      await new Promise((resolve, reject) => {
        child.once('spawn', resolve);
        child.once('error', reject);
      });
      child.unref();
      return;
    }
  }
  run('xdg-open', [url]);
}

async function main() {
  if (args.has('--help')) {
    console.log(
      'LSNGrace [--no-open]\nInicia o servidor local e abre a aplicação.\n--no-open: inicia sem abrir uma janela.\nLog: .lsngrace/server.log',
    );
    return;
  }
  if (Number(process.versions.node.split('.')[0]) < 24) {
    throw new Error('Instale Node.js 24 ou superior.');
  }
  if (await ready()) {
    await openWindow();
    console.log(`LSNGrace disponível em ${url}`);
    return;
  }
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', (error) =>
      reject(
        new Error(
          error.code === 'EADDRINUSE'
            ? 'A porta 1420 está ocupada. Encerre o serviço nessa porta e tente novamente.'
            : `Não foi possível abrir o servidor local: ${error.message}`,
        ),
      ),
    );
    probe.listen(1420, '127.0.0.1', resolve);
  });
  await new Promise((resolve) => probe.close(resolve));
  if (spawnSync('gracebat', ['-version'], { stdio: 'ignore' }).status !== 0) {
    throw new Error('Instale o Grace (gracebat) e tente novamente.');
  }
  mkdirSync(runtime, { recursive: true });
  const lock = path.join(runtime, 'starting');
  try {
    mkdirSync(lock);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error(
      `Outra inicialização está em andamento. Aguarde; se foi interrompida, remova ${lock}.`,
    );
  }
  let child;
  try {
    if (!existsSync(path.join(root, 'node_modules/vite/bin/vite.js'))) run('npm', ['ci']);
    console.log('Preparando o LSNGrace…');
    run('npm', ['run', 'build']);
    const fd = openSync(log, 'a');
    try {
      child = spawn(
        process.execPath,
        [
          path.join(root, 'node_modules/vite/bin/vite.js'),
          'preview',
          '--host',
          '127.0.0.1',
          '--port',
          '1420',
          '--strictPort',
        ],
        {
          cwd: root,
          detached: true,
          stdio: ['ignore', fd, fd],
        },
      );
    } finally {
      closeSync(fd);
    }
    let startupError;
    child.on('error', (error) => {
      startupError = error;
    });
    for (let attempt = 0; attempt < 60; attempt++) {
      if (startupError) throw startupError;
      if (child.exitCode !== null) throw new Error(`Servidor encerrado. Consulte ${log}.`);
      if (await ready()) {
        writeFileSync(path.join(runtime, 'server.pid'), String(child.pid));
        child.unref();
        await openWindow();
        console.log(`LSNGrace disponível em ${url}\nLog: ${log}`);
        return;
      }
      await delay(500);
    }
    throw new Error(`Servidor não ficou pronto. Consulte ${log}.`);
  } catch (error) {
    if (child?.pid) {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {}
    }
    throw error;
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`LSNGrace: ${error.message}`);
  process.exitCode = 1;
});
