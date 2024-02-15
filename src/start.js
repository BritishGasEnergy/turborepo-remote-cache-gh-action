import {
  debug,
  exportVariable,
  info,
  saveState,
  setFailed,
} from '@actions/core';
import getFreePort from 'get-port';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { waitUntilUsedOnHost } from 'tcp-port-used';
import { fileURLToPath } from 'url';
import { host, port, storagePath, storageProvider, teamId, token } from './inputs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function getPort() {
  if (port) {
    debug(`Using specified port: ${port}`);
    return port;
  }

  debug('Getting available port...');
  const freePort = await getFreePort();
  debug(`Available port found: ${freePort}`);

  return freePort;
}

async function main() {
  const port = await getPort();

  debug('Starting Turbo Cache Server...');
  const subprocess = spawn(
    'node',
    [resolve(__dirname, '..', 'start_and_log')],
    {
      detached: true,
      stdio: 'pipe',
      env: {
        ...process.env,
        HOST: host,
        PORT: port.toString(),
        TURBO_TOKEN: token,
        STORAGE_PROVIDER: storageProvider,
        STORAGE_PATH: storagePath,
      },
    },
  );

  subprocess.stdout?.on('data', (data) => debug(data.toString()));
  subprocess.stderr?.on('data', (data) => debug(data.toString()));
  const pid = subprocess.pid?.toString();

  try {
    debug(`Waiting for port ${port} to be used...`);
    await waitUntilUsedOnHost(port, host, 250, 5000);
    info('Spawned Turbo Cache Server:');
    info(`  PID: ${pid}`);
    info(`  Listening on port: ${port}`);
    saveState('pid', subprocess.pid?.toString());

    debug('Export environment variables...');
    exportVariable('TURBO_API', `http://${host}:${port}`);
    exportVariable('TURBO_TOKEN', token);
    exportVariable('TURBO_TEAM', teamId);

    process.exit(0);
  } catch (e) {
    throw new Error(`Turbo server failed to start on port: ${port}\n${e}`);
  }
}

main().catch(setFailed);
