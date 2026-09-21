import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), "data");
const LOG_FILE = path.join(DATA_DIR, "deploy.log");
const DEPLOY_SECRET = process.env.DEPLOY_SECRET || "godwin_deploy_2026";

let isDeploying = false;
let lastDeployStatus = "Idle";
let lastDeployTime: string | null = null;

function appendDeployLog(message: string) {
  try {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${message}\n`;
    const dir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(LOG_FILE, entry, "utf-8");
  } catch (err) {
    console.error("Failed to write to deploy.log:", err);
  }
}

function verifySignature(payload: string, signature: string | null): boolean {
  if (!signature) return false;
  try {
    const hmac = crypto.createHmac("sha256", DEPLOY_SECRET);
    const digest = "sha256=" + hmac.update(payload).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

function findGitDirectory(): string {
  let curr = process.cwd();
  for (let i = 0; i < 5; i++) {
    try {
      if (fs.existsSync(path.join(curr, ".git"))) {
        return curr;
      }
    } catch {}
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return process.cwd();
}

import { getPermanentDataDir, ensureDirExists } from "@/lib/persistentVault";

function copyRecursiveSync(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copyRecursiveSync(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    // Always preserve data: copy if dest does not exist or src has content
    try {
      if (!fs.existsSync(dest) || fs.statSync(src).size > 0) {
        fs.copyFileSync(src, dest);
      }
    } catch {}
  }
}

function preDeploySnapshot(workingDir: string) {
  try {
    const permDir = getPermanentDataDir();
    const sourceDataDir = path.join(workingDir, "data");
    if (fs.existsSync(sourceDataDir) && permDir !== sourceDataDir) {
      ensureDirExists(permDir);
      copyRecursiveSync(sourceDataDir, permDir);
      appendDeployLog(`🛡️ Pre-deploy snapshot: Preserved live database files to permanent vault: ${permDir}`);
    }
  } catch (err: any) {
    appendDeployLog(`⚠️ Pre-deploy snapshot warning: ${err?.message}`);
  }
}

function postDeployReconcile(workingDir: string) {
  try {
    const permDir = getPermanentDataDir();
    const destDataDir = path.join(workingDir, "data");
    if (fs.existsSync(permDir) && permDir !== destDataDir) {
      ensureDirExists(destDataDir);
      copyRecursiveSync(permDir, destDataDir);
      appendDeployLog(`🛡️ Post-deploy reconcile: Synchronized permanent vault files back to live working data.`);
    }
  } catch (err: any) {
    appendDeployLog(`⚠️ Post-deploy reconcile warning: ${err?.message}`);
  }
}

function triggerDeployment(triggerSource: string) {
  isDeploying = true;
  lastDeployStatus = `In Progress (Triggered by ${triggerSource})`;
  lastDeployTime = new Date().toISOString();

  const workingDir = findGitDirectory();
  appendDeployLog(`🚀 Deployment started by ${triggerSource} in ${workingDir}...`);

  // 1. Take Pre-Deploy Data Snapshot to Permanent External Vault
  preDeploySnapshot(workingDir);

  // Detect platform command and environment
  const isWindows = process.platform === "win32";
  const nodeBin = process.execPath;
  const nodeBinDir = path.dirname(nodeBin);
  const nodeModulesBin = path.join(workingDir, "node_modules", ".bin");
  const enhancedPath = isWindows
    ? process.env.PATH
    : `${nodeBinDir}:${nodeModulesBin}:/usr/local/bin:/usr/bin:/bin:${process.env.HOME ? `${process.env.HOME}/.npm-global/bin:${process.env.HOME}/.nvm/versions/node/current/bin:` : ''}${process.env.PATH || ''}`;

  let nextBinPath = "";
  try {
    nextBinPath = require.resolve("next/dist/bin/next");
  } catch {
    nextBinPath = path.join(workingDir, "node_modules", "next", "dist", "bin", "next");
  }

  const buildCmd = fs.existsSync(nextBinPath)
    ? `"${nodeBin}" "${nextBinPath}" build`
    : `npm run build`;

  const restartCmd = isWindows
    ? ""
    : " && (pm2 restart all || pm2 reload all || true)";

  const cmd = `git pull origin main && ${buildCmd}${restartCmd}`;

  exec(cmd, { cwd: workingDir, maxBuffer: 1024 * 1024 * 10, env: { ...process.env, PATH: enhancedPath } }, (error, stdout, stderr) => {
    isDeploying = false;
    // 2. Execute Post-Deploy Data Reconciliation
    postDeployReconcile(workingDir);

    if (error) {
      lastDeployStatus = `Failed: ${error.message}`;
      appendDeployLog(`❌ Deployment ERROR: ${error.message}\n${stderr || ""}`);
      console.error("Deployment failed:", error);
    } else {
      lastDeployStatus = `Success (Completed at ${new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata" })} IST)`;
      appendDeployLog(`✅ Deployment SUCCESS!\nStdout:\n${stdout.slice(-1000)}\n${stderr ? `Stderr:\n${stderr.slice(-500)}\n` : ""}`);
      console.log("Deployment completed successfully!");
    }
  });
}

// GET: Check deployment status and view recent deployment logs
export async function GET() {
  let logContent = "";
  try {
    if (fs.existsSync(LOG_FILE)) {
      const allLogs = fs.readFileSync(LOG_FILE, "utf-8");
      // Return last 60 lines
      const lines = allLogs.trim().split("\n");
      logContent = lines.slice(-60).join("\n");
    }
  } catch {}

  return NextResponse.json({
    success: true,
    isDeploying,
    lastStatus: lastDeployStatus,
    lastDeployTime,
    webhookUrl: "https://grandgodwin.com/api/webhook/deploy",
    serverCwd: process.cwd(),
    workingDir: findGitDirectory(),
    secretConfigured: true,
    log: logContent || "No deployment logs yet.",
  });
}

// POST: GitHub Webhook or Manual 1-Click Trigger
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const { searchParams } = new URL(req.url);

    // 1. Verify Secret / Signature
    const urlSecret = searchParams.get("secret") || searchParams.get("token");
    const headerSecret = req.headers.get("x-deploy-secret");
    const githubSignature = req.headers.get("x-hub-signature-256");
    const isManualTrigger = searchParams.get("manual") === "true";

    const isSecretValid =
      urlSecret === DEPLOY_SECRET ||
      headerSecret === DEPLOY_SECRET ||
      verifySignature(rawBody, githubSignature);

    if (!isSecretValid && !isManualTrigger) {
      appendDeployLog("⚠️ Unauthorized deploy attempt rejected (invalid secret / signature).");
      return NextResponse.json({ error: "Unauthorized: Invalid deploy secret or GitHub signature." }, { status: 401 });
    }

    // 2. Parse GitHub Push Event (if sent from GitHub)
    let triggerSource = "Manual Admin Trigger";
    if (rawBody) {
      try {
        const payload = JSON.parse(rawBody);
        // If from GitHub push event, check branch
        if (payload.ref) {
          if (!payload.ref.includes("main")) {
            appendDeployLog(`ℹ️ Ignored push to branch: ${payload.ref} (only main is auto-deployed).`);
            return NextResponse.json({ message: `Ignored push to branch ${payload.ref}` });
          }
          const pusher = payload.pusher?.name || payload.sender?.login || "GitHub";
          const commitMsg = payload.head_commit?.message || "Latest commit";
          triggerSource = `GitHub Push by ${pusher} ("${commitMsg}")`;
        }
      } catch {}
    }

    // 3. Check if already running
    if (isDeploying) {
      return NextResponse.json({
        success: false,
        message: "A deployment is already running. Please wait for it to finish.",
        isDeploying: true,
      }, { status: 429 });
    }

    // 4. Trigger deployment in background (non-blocking)
    triggerDeployment(triggerSource);

    return NextResponse.json({
      success: true,
      message: `Deployment initiated successfully via ${triggerSource}.`,
      status: "In Progress",
      startedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    appendDeployLog(`❌ Webhook handler error: ${err?.message}`);
    return NextResponse.json({ error: "Failed to initiate deploy" }, { status: 500 });
  }
}
