import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const LOCAL_USERS_FILE = path.join(process.cwd(), "data", "users.json");
const EMPLOYEES_FILE = path.join(DATA_DIR, "hr_employees.json");
const LOCAL_EMPLOYEES_FILE = path.join(process.cwd(), "data", "hr_employees.json");
const REVOKED_FILE = path.join(DATA_DIR, "revoked_sessions.json");
const LOCAL_REVOKED_FILE = path.join(process.cwd(), "data", "revoked_sessions.json");

function readJson<T>(file: string, fallbackFile: string = "", fallback: T = [] as unknown as T): T {
  for (const f of [file, fallbackFile]) {
    if (f) {
      try {
        if (fs.existsSync(f)) {
          const content = fs.readFileSync(f, "utf-8");
          const parsed = JSON.parse(content);
          if (parsed !== undefined && parsed !== null) return parsed as unknown as T;
        }
      } catch {}
    }
  }
  return fallback;
}

function writeJson(file: string, data: any, localMirror: string = ""): void {
  const list = [file];
  if (localMirror && localMirror !== file) list.push(localMirror);
  for (const target of list) {
    try {
      const dir = path.dirname(target);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(target, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error(`Error writing ${target}:`, err);
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, employeeId, email, username, reason } = body;

    if (!userId && !employeeId && !email && !username) {
      return NextResponse.json({ error: "Target identifier required for deactivation." }, { status: 400 });
    }

    // Protect Master Admin from deactivation
    if (userId === "admin-001" || username?.toLowerCase() === "mail@godwinhotels.com" || email?.toLowerCase() === "mail@godwinhotels.com") {
      return NextResponse.json({ error: "Cannot deactivate Master Admin account." }, { status: 403 });
    }

    const now = new Date().toISOString();

    // 1. Record in Revoked Sessions Registry
    const revoked = readJson<any[]>(REVOKED_FILE, LOCAL_REVOKED_FILE, []);
    const revocationEntry = {
      userId: userId || null,
      employeeId: employeeId || null,
      email: email ? email.toLowerCase().trim() : null,
      username: username ? username.toLowerCase().trim() : null,
      reason: reason || "Administrator deactivated account",
      revokedAt: now,
      timestamp: Date.now()
    };
    revoked.unshift(revocationEntry);
    // Keep last 1000 revocation records
    writeJson(REVOKED_FILE, revoked.slice(0, 1000), LOCAL_REVOKED_FILE);

    // 2. Update status in users.json if matching user exists
    const users = readJson<any[]>(USERS_FILE, LOCAL_USERS_FILE, []);
    let userUpdated = false;
    const updatedUsers = users.map((u: any) => {
      if (u.id === "admin-001") return u;
      const matchId = userId && u.id === userId;
      const matchEmail = email && u.email && u.email.toLowerCase() === email.toLowerCase();
      const matchUser = username && u.username && u.username.toLowerCase() === username.toLowerCase();
      if (matchId || matchEmail || matchUser) {
        userUpdated = true;
        return {
          ...u,
          status: "Inactive",
          deactivatedAt: now,
          updatedAt: now
        };
      }
      return u;
    });
    if (userUpdated) {
      writeJson(USERS_FILE, updatedUsers, LOCAL_USERS_FILE);
    }

    // 3. Update status in hr_employees.json if matching employee exists
    const employees = readJson<any[]>(EMPLOYEES_FILE, LOCAL_EMPLOYEES_FILE, []);
    let employeeUpdated = false;
    const updatedEmployees = employees.map((e: any) => {
      const matchId = (userId && (e.id === userId || e.employeeId === userId)) || 
                      (employeeId && (e.id === employeeId || e.employeeId === employeeId));
      const matchEmail = email && e.email && e.email.toLowerCase() === email.toLowerCase();
      if (matchId || matchEmail) {
        employeeUpdated = true;
        return {
          ...e,
          status: "RESIGNED", // standard inactive status in HR
          deactivatedAt: now,
          updatedAt: now
        };
      }
      return e;
    });
    if (employeeUpdated) {
      writeJson(EMPLOYEES_FILE, updatedEmployees, LOCAL_EMPLOYEES_FILE);
    }

    return NextResponse.json({
      success: true,
      revoked: true,
      message: "Account deactivated and all active sessions revoked across the platform.",
      revocationEntry
    });
  } catch (err: any) {
    console.error("Error in /api/auth/deactivate:", err);
    return NextResponse.json({ error: err.message || "Deactivation failed" }, { status: 500 });
  }
}
