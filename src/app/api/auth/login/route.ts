import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

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
    username: "mail@godwinhotels.com",
    name: "Raman Mankotia",
    email: "mail@godwinhotels.com",
    password: "Jaimatadi@24", // Fallback if env variable is not set
    role: "Master Admin",
    status: "Active",
    createdAt: new Date().toISOString().split("T")[0],
    permissions: MASTER_ADMIN_PERMISSIONS,
  },
  {
    id: "sec-001",
    username: "sec@godwinhotels.com",
    name: "Security Team",
    email: "sec@godwinhotels.com",
    password: "Balaknath@99",
    role: "Security Guard",
    status: "Active",
    createdAt: new Date().toISOString().split("T")[0],
    permissions: { kiosk: { access: true } },
  },
  {
    id: "admin-002",
    username: "ksareen@godwinhotels.com",
    name: "K Sareen",
    email: "ksareen@godwinhotels.com",
    password: "Balaknath@99",
    role: "Master Admin",
    status: "Active",
    createdAt: "2026-09-17",
    permissions: MASTER_ADMIN_PERMISSIONS,
  },
  {
    id: "admin-003",
    username: "vsareen@godwinhotels.com",
    name: "V Sareen",
    email: "vsareen@godwinhotels.com",
    password: "Balaknath@99",
    role: "Master Admin",
    status: "Active",
    createdAt: "2026-09-17",
    permissions: MASTER_ADMIN_PERMISSIONS,
  },
  {
    id: "admin-004",
    employeeId: "GG-1002",
    username: "Generalmanager@godwinhotels.com",
    name: "Mr. Glen",
    email: "Generalmanager@godwinhotels.com",
    password: "Balaknath@99",
    role: "Master Admin",
    status: "Active",
    createdAt: "2026-09-20",
    permissions: MASTER_ADMIN_PERMISSIONS,
  }
];

function getUsers() {
  let users: any[] = [];
  // Try persistent dir first, then local data/
  for (const file of [USERS_FILE, LOCAL_USERS_FILE]) {
    try {
      if (fs.existsSync(file)) {
        const data = fs.readFileSync(file, "utf-8");
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
           users = parsed;
           break;
        }
      }
    } catch {}
  }

  if (users.length === 0) {
    // Write defaults to local data/ as fallback
    try {
      const dir = path.dirname(LOCAL_USERS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(LOCAL_USERS_FILE, JSON.stringify(DEFAULT_USERS, null, 2));
    } catch {}
    users = [...DEFAULT_USERS];
  }

  // Security: Always ensure the Master Admin password and email match environment variables if set,
  // overriding whatever might be stored in plaintext in the JSON files.
  const adminEmail = process.env.ADMIN_EMAIL || "mail@godwinhotels.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "Jaimatadi@24";
  
  const adminIndex = users.findIndex(u => u.id === "admin-001");
  const adminData = {
    id: "admin-001",
    username: adminEmail,
    name: "Raman Mankotia",
    email: adminEmail,
    password: adminPassword,
    role: "Master Admin",
    status: "Active",
    permissions: MASTER_ADMIN_PERMISSIONS,
  };

  if (adminIndex >= 0) {
    users[adminIndex] = { ...users[adminIndex], ...adminData };
  } else {
    users.unshift(adminData);
  }

  return users;
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

    let user = users.find(
      (u: any) =>
        (u.username?.toLowerCase() === inputUser ||
         u.email?.toLowerCase() === inputUser ||
         u.id?.toLowerCase() === inputUser ||
         u.employeeId?.toLowerCase() === inputUser ||
         (u.employeeId && u.employeeId.includes('-') && u.employeeId.split('-')[1]?.toLowerCase() === inputUser)) &&
        u.password === password
    );

    // STRICT SECURITY: Only authorized Master Admin accounts can access the ERP portal.
    // If user not found in admin users, check if they are an employee trying to log into admin
    if (!user) {
      try {
        const { getAllEmployees } = await import('@/lib/employeeData');
        const employees = await getAllEmployees();
        const isEmployee = employees.some((e: any) => {
          const eMail = (e.email || '').trim().toLowerCase();
          const eId = (e.employeeId || '').trim().toLowerCase();
          const rawId = (e.id || '').trim().toLowerCase();
          return (
            eMail === inputUser ||
            eId === inputUser ||
            rawId === inputUser ||
            (eId.includes('-') && eId.split('-')[1]?.toLowerCase() === inputUser)
          );
        });

        if (isEmployee) {
          return NextResponse.json(
            { error: "Access Denied: Employee accounts cannot access the Administrative ERP portal. Employees can only use the Punch Terminal at /kiosk." },
            { status: 403 }
          );
        }
      } catch {}

      return NextResponse.json({ error: "Invalid administrative credentials. Please verify your username and password." }, { status: 401 });
    }

    if (user.status !== "Active") {
      return NextResponse.json({ error: "Your account is currently inactive or suspended. Please contact Admin." }, { status: 403 });
    }

    // STRICT: Only Master Admin roles have access to the Executive ERP Portal
    const isMasterAdmin = user.id === "admin-001" || user.id === "admin-002" || user.id === "admin-003" || user.id === "admin-004" || user.role === "Master Admin";
    if (!isMasterAdmin) {
      return NextResponse.json(
        { error: "Access Denied: Administrative privileges required. Employees can only access the Punch Terminal at /kiosk." },
        { status: 403 }
      );
    }

    const permissions = MASTER_ADMIN_PERMISSIONS;

    const safeUser = {
      id: user.id,
      employeeId: user.employeeId,
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
