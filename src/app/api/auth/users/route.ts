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
    username: "mail@godwinhotels.com",
    name: "Raman Mankotia",
    email: "mail@godwinhotels.com",
    password: "Jaimatadi@24",
    role: "Master Admin",
    status: "Active",
    createdAt: new Date().toISOString().split("T")[0],
    permissions: MASTER_ADMIN_PERMISSIONS,
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
  }
];

const EMPLOYEES_FILE = path.join(DATA_DIR, "hr_employees.json");
const LOCAL_EMPLOYEES_FILE = path.join(process.cwd(), "data", "hr_employees.json");
const BACKUP_EMPLOYEES_FILE = path.join(process.cwd(), "data", "hr_employees_backup.json");
const DELETED_USERS_FILE = path.join(DATA_DIR, "deleted_users.json");
const LOCAL_DELETED_USERS_FILE = path.join(process.cwd(), "data", "deleted_users.json");

function getDeletedUserIds(): string[] {
  for (const file of [DELETED_USERS_FILE, LOCAL_DELETED_USERS_FILE]) {
    try {
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map((id: any) => String(id).toLowerCase().trim());
      }
    } catch {}
  }
  return [];
}

function saveDeletedUserId(id: string) {
  try {
    const list = getDeletedUserIds();
    const cleanId = id.toLowerCase().trim();
    if (!list.includes(cleanId)) {
      list.push(cleanId);
      for (const targetFile of [DELETED_USERS_FILE, LOCAL_DELETED_USERS_FILE]) {
        const dir = path.dirname(targetFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(targetFile, JSON.stringify(list, null, 2), "utf-8");
      }
    }
  } catch {}
}

function getUsers(): any[] {
  let users: any[] = [];
  try {
    for (const file of [USERS_FILE, LOCAL_USERS_FILE]) {
      if (fs.existsSync(file)) {
        const data = fs.readFileSync(file, "utf-8");
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          users = parsed;
          break;
        }
      }
    }
  } catch (error) {
    console.error("Error reading users file:", error);
  }

  if (users.length === 0) {
    users = [...DEFAULT_USERS];
  }

  const deletedIds = getDeletedUserIds();

  // Also read deleted_employees.json (from employee-side delete) to prevent resurrection
  const DELETED_EMP_FILE = path.join(process.cwd(), 'data', 'deleted_employees.json');
  try {
    if (fs.existsSync(DELETED_EMP_FILE)) {
      const raw = fs.readFileSync(DELETED_EMP_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const k of parsed) {
          const normalized = String(k).toLowerCase().trim();
          if (!deletedIds.includes(normalized)) deletedIds.push(normalized);
        }
      }
    }
  } catch {}

  // Auto-sync employees from hr_employees.json into users list
  try {
    let employees: any[] = [];
    // Only read from primary file (not backup) to avoid resurrecting deleted employees
    for (const empFile of [EMPLOYEES_FILE, LOCAL_EMPLOYEES_FILE]) {
      if (fs.existsSync(empFile)) {
        try {
          const empData = JSON.parse(fs.readFileSync(empFile, "utf-8"));
          if (Array.isArray(empData) && empData.length > 0) {
            employees = empData;
            break;
          }
        } catch {}
      }
    }

    let modified = false;
    for (const emp of employees) {
      const empId = (emp.id || "").trim().toLowerCase();
      const empCode = (emp.employeeId || "").trim().toLowerCase();
      const empEmail = (emp.email || "").trim().toLowerCase();
      const empName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim().toLowerCase();

      // Skip explicitly deleted users
      if ((empId && deletedIds.includes(empId)) || (empCode && deletedIds.includes(empCode)) || (empEmail && deletedIds.includes(empEmail))) {
        continue;
      }

      // Robust matching: Case-insensitive on ID, EmployeeId, Email, or Username
      const existingIdx = users.findIndex((u: any) => {
        const uId = (u.id || "").trim().toLowerCase();
        const uEmpId = (u.employeeId || "").trim().toLowerCase();
        const uEmail = (u.email || "").trim().toLowerCase();
        const uUsername = (u.username || "").trim().toLowerCase();
        const uName = (u.name || "").trim().toLowerCase();

        // 1. Direct ID / Employee Code match (case-insensitive)
        if (uId && (uId === empId || uId === empCode)) return true;
        if (uEmpId && (uEmpId === empId || uEmpId === empCode)) return true;

        // 2. Email match
        if (empEmail && (uEmail === empEmail || uUsername === empEmail)) return true;

        // 3. Username matches employee code
        if (empCode && uUsername === empCode) return true;

        // 4. Same exact full name AND matching role/department (prevent duplicate staff member)
        if (empName && uName === empName && empEmail && uEmail.includes("godwinhotels.com")) return true;

        return false;
      });

      if (existingIdx !== -1) {
        // Update employeeId link if not set
        if (!users[existingIdx].employeeId && (emp.employeeId || emp.id)) {
          users[existingIdx].employeeId = emp.employeeId || emp.id;
          modified = true;
        }
      } else {
        // Auto-register employee in users list
        const fullName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.name || "Staff Member";
        const desig = (emp.designation || "").toLowerCase();
        const dept = (emp.department?.name || emp.department || "").toLowerCase();
        let role = "Employee";
        let perms: any = { kiosk: { access: true } };

        if (desig.includes("manager") || desig.includes("supervisor")) {
          role = "Manager";
          perms = {
            hr: {
              employees: { view: true, edit: true },
              attendance: { view: true, edit: true },
              shifts: { view: true, edit: true },
              leave: { view: true, approve: true },
              reports: { view: true }
            },
            kiosk: { access: true }
          };
        } else if (desig.includes("guard") || dept.includes("security")) {
          role = "Security Guard";
          perms = { kiosk: { access: true } };
        } else if (desig.includes("admin")) {
          role = "Admin";
          perms = MASTER_ADMIN_PERMISSIONS;
        }

        const creationDate = emp.createdAt
          ? (emp.createdAt.includes("T") ? emp.createdAt.split("T")[0] : emp.createdAt)
          : new Date().toISOString().split("T")[0];

        users.push({
          id: emp.id || emp.employeeId,
          employeeId: emp.employeeId || emp.id,
          username: emp.employeeId || emp.email || `user-${Date.now()}`,
          name: fullName,
          email: emp.email || `${(emp.employeeId || "staff").toLowerCase()}@godwinhotels.com`,
          password: emp.password || "Godwin@123",
          role: emp.role || role,
          status: emp.status === "ACTIVE" || !emp.status ? "Active" : "Inactive",
          createdAt: creationDate,
          permissions: perms,
        });
        modified = true;
      }
    }

    // Deduplicate any accidental duplicate entries in users array
    const seen = new Set<string>();
    const deduplicated: any[] = [];
    for (const u of users) {
      const idKey = (u.id || "").trim().toLowerCase();
      const emailKey = (u.email || "").trim().toLowerCase();
      const usernameKey = (u.username || "").trim().toLowerCase();

      // If user has the same id or exact same email+username, skip duplicate
      const uniqueKey = idKey || `${emailKey}_${usernameKey}`;
      if (uniqueKey && seen.has(uniqueKey)) {
        modified = true;
        continue;
      }
      if (uniqueKey) seen.add(uniqueKey);
      deduplicated.push(u);
    }
    users = deduplicated;

    if (modified) {
      saveUsers(users);
    }
  } catch (syncErr) {
    console.warn("Failed to auto-sync employees to users list:", syncErr);
  }

  return users;
}

function saveUsers(users: any[]) {
  try {
    for (const targetFile of [USERS_FILE, LOCAL_USERS_FILE]) {
      const dir = path.dirname(targetFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(targetFile, JSON.stringify(users, null, 2), "utf-8");
    }
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
    const { id, username, name, email, password, role, status, permissions, createdAt } = body;

    if (!username || !password || !email || !name) {
      return NextResponse.json({ error: "All required fields must be provided." }, { status: 400 });
    }

    const users = getUsers();
    const finalId = (id && id.trim()) || `usr-${Date.now()}`;
    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    const existing = users.find(
      (u: any) =>
        u.id.toLowerCase() === finalId.toLowerCase() ||
        u.username.toLowerCase() === cleanUsername.toLowerCase() ||
        u.email.toLowerCase() === cleanEmail
    );
    if (existing) {
      return NextResponse.json({ error: "A user with this User ID, username, or email already exists." }, { status: 409 });
    }

    const finalCreatedAt = createdAt ? createdAt.trim() : new Date().toISOString().split("T")[0];

    const newUser = {
      id: finalId,
      employeeId: finalId,
      username: cleanUsername,
      name: name.trim(),
      email: cleanEmail,
      password,
      role: role || "Staff",
      status: status || "Active",
      createdAt: finalCreatedAt,
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
    const { id, newId, username, name, email, password, role, status, permissions, createdAt } = body;

    if (!id) {
      return NextResponse.json({ error: "User ID is required." }, { status: 400 });
    }

    const users = getUsers();
    const index = users.findIndex((u: any) => u.id === id || (u.id && u.id.toLowerCase() === id.toLowerCase()));

    if (index === -1) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const currentUserId = users[index].id;
    const isMasterAdmin = currentUserId === "admin-001" || users[index].role === "Master Admin";

    // Handle User ID renaming if requested
    let finalId = currentUserId;
    if (newId && newId.trim() !== "" && newId.trim() !== currentUserId) {
      if (isMasterAdmin) {
        return NextResponse.json({ error: "Cannot change User ID for Master Admin account." }, { status: 403 });
      }
      const trimmedNewId = newId.trim();
      const idExists = users.some(
        (u: any) => u.id !== currentUserId && u.id.toLowerCase() === trimmedNewId.toLowerCase()
      );
      if (idExists) {
        return NextResponse.json({ error: "A user with this User ID already exists." }, { status: 409 });
      }
      finalId = trimmedNewId;
    }

    // Check duplicate username or email with other users
    const cleanUsername = username ? username.trim() : users[index].username;
    const cleanEmail = email ? email.trim().toLowerCase() : users[index].email;

    const duplicate = users.find(
      (u: any) =>
        u.id !== currentUserId &&
        (
          (cleanUsername && u.username.toLowerCase() === cleanUsername.toLowerCase()) ||
          (cleanEmail && u.email.toLowerCase() === cleanEmail.toLowerCase())
        )
    );
    if (duplicate) {
      return NextResponse.json({ error: "Username or email is already taken by another user." }, { status: 409 });
    }

    const updatedCreatedAt = createdAt ? createdAt.trim() : (users[index].createdAt || new Date().toISOString().split("T")[0]);

    const updatedUser = {
      ...users[index],
      id: finalId,
      employeeId: users[index].employeeId || finalId,
      username: cleanUsername,
      name: name ? name.trim() : users[index].name,
      email: cleanEmail,
      role: isMasterAdmin ? "Master Admin" : (role || users[index].role),
      status: isMasterAdmin ? "Active" : (status || users[index].status),
      password: password && password.trim() !== "" ? password.trim() : users[index].password,
      permissions: isMasterAdmin ? MASTER_ADMIN_PERMISSIONS : (permissions !== undefined ? permissions : users[index].permissions),
      createdAt: updatedCreatedAt,
    };

    users[index] = updatedUser;
    saveUsers(users);

    // CRITICAL: Synchronize changes to hr_employees.json so auto-sync never re-creates or duplicates
    try {
      for (const empFile of [EMPLOYEES_FILE, LOCAL_EMPLOYEES_FILE, BACKUP_EMPLOYEES_FILE]) {
        if (fs.existsSync(empFile)) {
          const empData = JSON.parse(fs.readFileSync(empFile, "utf-8"));
          if (Array.isArray(empData)) {
            let empModified = false;
            for (let i = 0; i < empData.length; i++) {
              const emp = empData[i];
              const matchId = emp.id === currentUserId || emp.employeeId === currentUserId;
              const matchEmail = emp.email && emp.email.toLowerCase() === users[index].email.toLowerCase();

              if (matchId || matchEmail) {
                emp.id = finalId;
                emp.employeeId = finalId;
                if (cleanEmail) emp.email = cleanEmail;
                if (name) {
                  const parts = name.trim().split(" ");
                  emp.firstName = parts[0] || emp.firstName;
                  emp.lastName = parts.slice(1).join(" ") || "";
                }
                if (status) emp.status = status === "Active" ? "ACTIVE" : "INACTIVE";
                if (role && !isMasterAdmin) emp.role = role;
                if (updatedCreatedAt) {
                  try {
                    emp.createdAt = new Date(updatedCreatedAt).toISOString();
                  } catch {}
                }
                emp.updatedAt = new Date().toISOString();
                empModified = true;
              }
            }
            if (empModified) {
              fs.writeFileSync(empFile, JSON.stringify(empData, null, 2), "utf-8");
            }
          }
        }
      }
    } catch (empSyncErr) {
      console.warn("Failed to sync employee record:", empSyncErr);
    }

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
    const index = users.findIndex((u: any) => u.id === id || (u.id && u.id.toLowerCase() === id.toLowerCase()));

    if (index === -1) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const deletedUser = users.splice(index, 1)[0];
    saveUsers(users);

    // Record deleted ID to prevent auto-sync from resurrecting it
    if (deletedUser.id) saveDeletedUserId(deletedUser.id);
    if (deletedUser.employeeId) saveDeletedUserId(deletedUser.employeeId);
    if (deletedUser.email) saveDeletedUserId(deletedUser.email);

    // Also update hr_employees.json so the employee is removed or marked inactive
    try {
      for (const empFile of [EMPLOYEES_FILE, LOCAL_EMPLOYEES_FILE, BACKUP_EMPLOYEES_FILE]) {
        if (fs.existsSync(empFile)) {
          const empData = JSON.parse(fs.readFileSync(empFile, "utf-8"));
          if (Array.isArray(empData)) {
            const filtered = empData.filter(
              (e: any) =>
                e.id !== deletedUser.id &&
                e.employeeId !== deletedUser.id &&
                (!e.email || e.email.toLowerCase() !== deletedUser.email?.toLowerCase())
            );
            if (filtered.length !== empData.length) {
              fs.writeFileSync(empFile, JSON.stringify(filtered, null, 2), "utf-8");
            }
          }
        }
      }
    } catch {}

    return NextResponse.json({ success: true, message: "User deleted successfully." });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
