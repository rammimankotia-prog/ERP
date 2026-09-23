const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const nextBuildJs = path.join(rootDir, 'node_modules', 'next', 'dist', 'cli', 'next-build.js');
const nextBinJs = path.join(rootDir, 'node_modules', 'next', 'dist', 'bin', 'next');

if (!fs.existsSync(nextBuildJs) || !fs.existsSync(nextBinJs)) {
  console.log('📦 Next.js build module missing on server, installing dependencies...');
  try {
    execSync('npm install --no-audit --no-fund', { cwd: rootDir, stdio: 'inherit' });
  } catch (err) {
    console.error('npm install fallback...', err?.message || err);
    try {
      execSync('npm install next@16.2.4 --no-audit --no-fund', { cwd: rootDir, stdio: 'inherit' });
    } catch {}
  }
}

console.log('🚀 Executing Next.js production build...');
execSync(`"${process.execPath}" "${nextBinJs}" build`, { cwd: rootDir, stdio: 'inherit' });
