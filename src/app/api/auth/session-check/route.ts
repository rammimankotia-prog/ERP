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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || searchParams.get("id");
    const employeeId = searchParams.get("employeeId") || searchParams.get("empId");
    const email = (searchParams.get("email") || "").trim().toLowerCase();
    const username = (searchParams.get("username") || "").trim().toLowerCase();

    if (!userId && !employeeId && !email && !username) {
      return NextResponse.json({ active: false, reason: "NO_IDENTIFIER_PROVIDED" });
    }

    // 1. Check Revoked Sessions list
    const revoked = readJson<any[]>(REVOKED_FILE, LOCAL_REVOKED_FILE, []);
    const isRevoked = revoked.some((r: any) => {
      const matchId = userId && (r.userId === userId || r.id === userId);
      const matchEmpId = employeeId && (r.employeeId === employeeId || r.id === employeeId);
      const matchEmail = email && r.email && r.email.toLowerCase() === email;
      const matchUser = username && r.username && r.username.toLowerCase() === username;
      return matchId || matchEmpId || matchEmail || matchUser;
    });

    if (isRevoked) {
      return NextResponse.json({ active: false, reason: "SESSION_REVOKED" });
    }

    // 2. Check System Users (Admin / Staff / Guard users in users.json)
    if (userId || username || email) {
      const users = readJson<any[]>(USERS_FILE, LOCAL_USERS_FILE, []);
      const matchedUser = users.find((u: any) => {
        if (userId && u.id === userId) return true;
        if (username && (u.username || "").toLowerCase() === username) return true;
        if (email && (u.email || "").toLowerCase() === email) return true;
        return false;
      });

      if (matchedUser) {
        if (matchedUser.status !== "Active") {
          return NextResponse.json({ active: false, reason: "USER_INACTIVE", status: matchedUser.status });
        }
        return NextResponse.json({ active: true, userType: "SYSTEM_USER", status: matchedUser.status });
      }
    }

    // 3. Check HR Employees (in hr_employees.json)
    if (employeeId || email) {
      const employees = readJson<any[]>(EMPLOYEES_FILE, LOCAL_EMPLOYEES_FILE, []);
      const matchedEmp = employees.find((e: any) => {
        if (employeeId && (e.id === employeeId || e.employeeId === employeeId)) return true;
        if (email && (e.email || "").toLowerCase() === email) return true;
        return false;
      });

      if (matchedEmp) {
        if (matchedEmp.status && matchedEmp.status !== "ACTIVE") {
          return NextResponse.json({ active: false, reason: "EMPLOYEE_INACTIVE", status: matchedEmp.status });
        }
        return NextResponse.json({ active: true, userType: "HR_EMPLOYEE", status: matchedEmp.status });
      }
    }

    // If identifier was provided but not found anywhere
    return NextResponse.json({ active: false, reason: "ACCOUNT_NOT_FOUND" });
  } catch (err: any) {
    console.error("Error in /api/auth/session-check:", err);
    return NextResponse.json({ active: false, reason: "SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = body.userId || body.id;
    const employeeId = body.employeeId || body.empId;
    const email = (body.email || "").trim().toLowerCase();
    const username = (body.username || "").trim().toLowerCase();

    const url = new URL(req.url);
    if (userId) url.searchParams.set("userId", userId);
    if (employeeId) url.searchParams.set("employeeId", employeeId);
    if (email) url.searchParams.set("email", email);
    if (username) url.searchParams.set("username", username);

    const getReq = new NextRequest(url);
    return GET(getReq);
  } catch {
    return NextResponse.json({ active: false, reason: "INVALID_BODY" }, { status: 400 });
  }
}
