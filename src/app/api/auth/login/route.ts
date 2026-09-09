import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const LOCAL_USERS_FILE = path.join(process.cwd(), "data", "users.json");

const MASTER_ADMIN_PERMISSIONS = {
  hr: {
    employees: { view: true, edit: true, delete: true },
    attendance: { view: true, edit: true },
    shifts: { view: true, edit: true },
    leave: { view: true, approve: true },
    payroll: { view: true, edit: true },
    reports: { view: true },
  },
  userAccess: { view: true, edit: true },
  settings: { view: true, edit: true },
};

const DEFAULT_USERS = [
  {
    id: "admin-001",
    username: "Godwinhotels",
    name: "Raman Mankotia",
    email: "mail@godwinhotels.com",
    password: "Godwindeluxe@99",
    role: "Master Admin",
    status: "Active",
    createdAt: new Date().toISOString().split("T")[0],
    permissions: MASTER_ADMIN_PERMISSIONS,
  }
];

function getUsers() {
  // Try persistent dir first, then local data/
  for (const file of [USERS_FILE, LOCAL_USERS_FILE]) {
    try {
      if (fs.existsSync(file)) {
        const data = fs.readFileSync(file, "utf-8");
        const users = JSON.parse(data);
        if (Array.isArray(users) && users.length > 0) return users;
      }
    } catch {}
  }
  // Write defaults to local data/ as fallback
  try {
    const dir = path.dirname(LOCAL_USERS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_USERS_FILE, JSON.stringify(DEFAULT_USERS, null, 2));
  } catch {}
  return DEFAULT_USERS;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: "Please enter both username/email and password." }, { status: 400 });
    }

    const users = getUsers();
    const inputUser = username.trim().toLowerCase();

    const user = users.find(
      (u: any) =>
        (u.username.toLowerCase() === inputUser || u.email.toLowerCase() === inputUser) &&
        u.password === password
    );

    if (!user) {
      return NextResponse.json({ error: "Invalid username or password. Please verify your credentials." }, { status: 401 });
    }

    if (user.status !== "Active") {
      return NextResponse.json({ error: "Your account is currently inactive or suspended. Please contact Admin." }, { status: 403 });
    }

    // Master Admin always gets full permissions regardless of stored data
    const isMasterAdmin = user.id === "admin-001" || user.role === "Master Admin";
    const permissions = isMasterAdmin ? MASTER_ADMIN_PERMISSIONS : (user.permissions || {});

    const safeUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      permissions,
    };

    return NextResponse.json({ success: true, user: safeUser, message: "Login successful!" });
  } catch (error) {
    return NextResponse.json({ error: "Authentication failed due to server error." }, { status: 500 });
  }
}
