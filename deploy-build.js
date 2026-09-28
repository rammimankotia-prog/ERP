const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const logFile = path.join(process.cwd(), 'data', 'deploy_debug.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  try {
    const dir = path.dirname(logFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(logFile, line, 'utf-8');
  } catch {}
}

log('Starting deploy-build.js...');
log(`Node version: ${process.version}`);
log(`Working directory: ${process.cwd()}`);
log(`process.execPath: ${process.execPath}`);

// Check next installation
const nextBin = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
const nextCliBuild = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'cli', 'next-build.js');

log(`nextBin exists: ${fs.existsSync(nextBin)}`);
log(`nextCliBuild exists: ${fs.existsSync(nextCliBuild)}`);

if (!fs.existsSync(nextCliBuild)) {
  log('next-build.js missing! Running npm install...');
  try {
    const out = execSync('npm install --no-audit --no-fund --production=false', {
      encoding: 'utf-8',
      env: process.env,
      stdio: 'pipe',
      timeout: 180000
    });
    log(`npm install output: ${out ? out.slice(-500) : 'none'}`);
  } catch (err) {
    log(`npm install error: ${err.message}\n${err.stdout || ''}\n${err.stderr || ''}`);
  }
}

// Generate Prisma
try {
  log('Running prisma generate...');
  const prismaOut = execSync('npx prisma generate', {
    encoding: 'utf-8',
    env: process.env,
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
  const buildOut = execSync(`"${process.execPath}" "${nextBin}" build`, {
    encoding: 'utf-8',
    env: { ...process.env, NODE_ENV: 'production' },
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
