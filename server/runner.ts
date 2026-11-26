import { execFile, type ExecFileOptions } from 'node:child_process';
import { promisify } from 'node:util';
import { win32 } from 'node:path';

const execute = promisify(execFile);
/** Keep the original Grace engine on Linux; Windows uses the default WSL distro. */
export async function runScientific(
  command: 'gracebat' | 'python3',
  args: string[],
  options: ExecFileOptions = {},
) {
  if (process.platform !== 'win32') {
    return execute(command, args, { ...options, encoding: 'utf8' });
  }
  const translated = await Promise.all(
    args.map(async (argument) => {
      if (!win32.isAbsolute(argument)) return argument;
      const result = await execute('wsl.exe', ['--exec', 'wslpath', '-a', '-u', argument], {
        timeout: 5000,
        encoding: 'utf8',
        windowsHide: true,
      });
      return result.stdout.trim();
    }),
  );
  // No shell interpolation: project paths and Grace arguments remain separate arguments.
  return execute('wsl.exe', ['--exec', command, ...translated], {
    ...options,
    env: process.env,
    encoding: 'utf8',
    windowsHide: true,
  });
}

export const runGrace = (args: string[], options: ExecFileOptions = {}) =>
  runScientific('gracebat', args, options);
