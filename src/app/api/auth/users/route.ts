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
  quotations: { view: true, edit: true, delete: true },
  fleet: { view: true, edit: true },
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

function getActiveUsersFile(): string {
  if (fs.existsSync(USERS_FILE)) return USERS_FILE;
  return LOCAL_USERS_FILE;
}

function getUsers() {
  try {
    for (const file of [USERS_FILE, LOCAL_USERS_FILE]) {
      if (fs.existsSync(file)) {
        const data = fs.readFileSync(file, "utf-8");
        const users = JSON.parse(data);
        if (Array.isArray(users) && users.length > 0) return users;
      }
    }
  } catch (error) {
    console.error("Error reading users file:", error);
  }
  saveUsers(DEFAULT_USERS);
  return DEFAULT_USERS;
}

function saveUsers(users: any[]) {
  try {
    // Save to active file (PERSISTENT_DATA_DIR if set, otherwise local)
    const targetFile = fs.existsSync(DATA_DIR) ? USERS_FILE : LOCAL_USERS_FILE;
    const dir = path.dirname(targetFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(targetFile, JSON.stringify(users, null, 2));
    return true;
  } catch (error) {
    console.error("Error saving users file:", error);
    return false;
  }
}

export async function GET() {
  try {
    const users = getUsers();
    // Strip passwords from response
    const safeUsers = users.map(({ password, ...u }: any) => u);
    return NextResponse.json({ success: true, users: safeUsers });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, name, email, password, role, status, permissions } = body;

    if (!username || !password || !email || !name) {
      return NextResponse.json({ error: "All required fields must be provided." }, { status: 400 });
    }

    const users = getUsers();

    const existing = users.find(
      (u: any) => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase()
    );
    if (existing) {
      return NextResponse.json({ error: "A user with this username or email already exists." }, { status: 409 });
    }

    const newUser = {
      id: `usr-${Date.now()}`,
      username: username.trim(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: role || "Staff",
      status: status || "Active",
      createdAt: new Date().toISOString().split("T")[0],
      permissions: permissions || {},
    };

    users.push(newUser);
    saveUsers(users);

    const { password: _pw, ...safeUser } = newUser;
    return NextResponse.json({ success: true, user: safeUser, message: "User created successfully." });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, username, name, email, password, role, status, permissions } = body;

    if (!id) {
      return NextResponse.json({ error: "User ID is required." }, { status: 400 });
    }

    const users = getUsers();
    const index = users.findIndex((u: any) => u.id === id);

    if (index === -1) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const duplicate = users.find(
      (u: any) => u.id !== id && (u.username.toLowerCase() === (username?.toLowerCase() || "") || u.email.toLowerCase() === (email?.toLowerCase() || ""))
    );
    if (duplicate) {
      return NextResponse.json({ error: "Username or email is already taken by another user." }, { status: 409 });
    }

    // Master Admin always keeps full permissions
    const isMasterAdmin = users[index].id === "admin-001" || users[index].role === "Master Admin";

    const updatedUser = {
      ...users[index],
      username: username ? username.trim() : users[index].username,
      name: name ? name.trim() : users[index].name,
      email: email ? email.trim().toLowerCase() : users[index].email,
      role: isMasterAdmin ? "Master Admin" : (role || users[index].role),
      status: isMasterAdmin ? "Active" : (status || users[index].status),
      password: password && password.trim() !== "" ? password.trim() : users[index].password,
      permissions: isMasterAdmin ? MASTER_ADMIN_PERMISSIONS : (permissions !== undefined ? permissions : users[index].permissions),
    };

    users[index] = updatedUser;
    saveUsers(users);

    const { password: _pw, ...safeUser } = updatedUser;
    return NextResponse.json({ success: true, user: safeUser, message: "User updated successfully." });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "User ID is required." }, { status: 400 });
    }

    if (id === "admin-001") {
      return NextResponse.json({ error: "Cannot delete the Master Admin account." }, { status: 403 });
    }

    const users = getUsers();
    const index = users.findIndex((u: any) => u.id === id);

    if (index === -1) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    users.splice(index, 1);
    saveUsers(users);

    return NextResponse.json({ success: true, message: "User deleted successfully." });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
