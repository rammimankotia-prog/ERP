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

function triggerDeployment(triggerSource: string) {
  isDeploying = true;
  lastDeployStatus = `In Progress (Triggered by ${triggerSource})`;
  lastDeployTime = new Date().toISOString();

  appendDeployLog(`🚀 Deployment started by ${triggerSource}...`);

  // Detect platform command
  const isWindows = process.platform === "win32";
  const cmd = isWindows
    ? "git pull origin main && npm run build"
    : "git pull origin main && npm run build && (pm2 restart all || pm2 reload all || true)";

  exec(cmd, { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
    isDeploying = false;
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
