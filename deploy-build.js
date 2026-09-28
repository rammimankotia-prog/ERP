const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dataDirs = [
  path.join(process.cwd(), 'data'),
  process.env.PERSISTENT_DATA_DIR,
  '/home/u790942238/domains/grandgodwin.com/godwin_permanent_data',
  '/home/u790942238/domains/grandgodwin.com/hbuilds/versions/01a0d3e1-49d2-7368-b673-e6e029270fa9/nodejs/data'
].filter(Boolean);

function log(msg) {
  const line = `[${new Date().toISOString()}] [deploy-build] ${msg}\n`;
  console.log(msg);
  for (const d of dataDirs) {
    for (const f of ['deploy.log', 'deploy_debug.log']) {
      try {
        const full = path.join(d, f);
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
        fs.appendFileSync(full, line, 'utf-8');
      } catch {}
    }
  }
}

log('Starting deploy-build.js...');
log(`Node version: ${process.version}`);
log(`Working directory: ${process.cwd()}`);
log(`process.execPath: ${process.execPath}`);

const nodeBin = process.execPath;
const nodeBinDir = path.dirname(nodeBin);
const nodeModulesBin = path.join(process.cwd(), 'node_modules', '.bin');

const isWindows = process.platform === 'win32';
const enhancedPath = isWindows
  ? process.env.PATH
  : `${nodeBinDir}:${nodeModulesBin}:/usr/local/bin:/usr/bin:/bin:${process.env.HOME ? `${process.env.HOME}/.npm-global/bin:${process.env.HOME}/.nvm/versions/node/current/bin:` : ''}${process.env.PATH || ''}`;

const execEnv = {
  ...process.env,
  PATH: enhancedPath,
  NODE_ENV: 'production'
};

// Check if pre-compiled .next build is already deployed (saves 1GB+ RAM on Hostinger)
const buildIdFile = path.join(process.cwd(), '.next', 'BUILD_ID');
const serverDir = path.join(process.cwd(), '.next', 'server');

if (fs.existsSync(buildIdFile) && fs.existsSync(serverDir)) {
  const buildId = fs.readFileSync(buildIdFile, 'utf-8').trim();
  log(`✅ Verified pre-compiled production build (BUILD_ID: ${buildId}). Skipping compilation to avoid Hostinger memory limit!`);
  
  // Touch Phusion Passenger restart files
  const restartDirs = [
    path.join(process.cwd(), 'tmp'),
    '/home/u790942238/domains/grandgodwin.com/public_html/tmp',
    '/home/u790942238/domains/grandgodwin.com/tmp'
  ];
  for (const rDir of restartDirs) {
    try {
      if (!fs.existsSync(rDir)) fs.mkdirSync(rDir, { recursive: true });
      fs.writeFileSync(path.join(rDir, 'restart.txt'), String(Date.now()));
      log(`Touched ${path.join(rDir, 'restart.txt')}`);
    } catch {}
  }

  // Signal server process recycle so Phusion Passenger / supervisor loads fresh build
  if (!isWindows) {
    try {
      log('Triggering pkill -f server.js for supervisor to spawn fresh worker...');
      execSync('pkill -f "server.js" || true', { stdio: 'ignore' });
      log('pkill signal executed.');
    } catch (kErr) {
      log(`pkill notice: ${kErr.message}`);
    }
  }

  log('Build step completed successfully!');
  process.exit(0);
}

// Check next installation
const nextBin = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
const nextCliBuild = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'cli', 'next-build.js');

log(`nextBin exists: ${fs.existsSync(nextBin)}`);
log(`nextCliBuild exists: ${fs.existsSync(nextCliBuild)}`);

if (!fs.existsSync(nextCliBuild)) {
  log('next-build.js missing! Running npm install to fetch full next CLI...');
  try {
    const installOut = execSync('npm install next@16.2.4 --no-audit --no-fund --production=false', {
      encoding: 'utf-8',
      env: execEnv,
      stdio: 'pipe',
      timeout: 180000
    });
    log(`npm install output: ${installOut ? installOut.slice(-500) : 'done'}`);
  } catch (err) {
    log(`npm install error: ${err.message}\nSTDOUT:\n${err.stdout || ''}\nSTDERR:\n${err.stderr || ''}`);
  }
}

log(`Post-install nextCliBuild exists: ${fs.existsSync(nextCliBuild)}`);

// Generate Prisma
try {
  log('Running prisma generate...');
  const prismaOut = execSync('npx prisma generate', {
    encoding: 'utf-8',
    env: execEnv,
    stdio: 'pipe',
    timeout: 60000
  });
  log(`Prisma generate output: ${prismaOut ? prismaOut.slice(-300) : 'done'}`);
} catch (pErr) {
  log(`Prisma generate warning: ${pErr.message}`);
}

// Execute next build
try {
  log('Executing next build with node...');
  const buildOut = execSync(`"${nodeBin}" "${nextBin}" build`, {
    encoding: 'utf-8',
    env: execEnv,
    stdio: 'pipe',
    timeout: 300000
  });
  log(`next build success!\n${buildOut ? buildOut.slice(-500) : ''}`);
  log('Build completed successfully!');
  process.exit(0);
} catch (bErr) {
  log(`next build FAILED: ${bErr.message}\nSTDOUT:\n${bErr.stdout || ''}\nSTDERR:\n${bErr.stderr || ''}`);
  process.exit(1);
}
