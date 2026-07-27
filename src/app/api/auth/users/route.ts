import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const USERS_FILE = path.join(process.cwd(), "data", "users.json");

const DEFAULT_USERS = [
  {
    id: "admin-001",
    username: "Godwinhotels",
    name: "Godwin Admin",
    email: "mail@godwinhotels.com",
    password: "Godwindeluxe@99",
    role: "Admin",
    status: "Active",
    createdAt: new Date().toISOString().split("T")[0]
  }
];

function getUsers() {
  try {
    const dir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, JSON.stringify(DEFAULT_USERS, null, 2));
      return DEFAULT_USERS;
    }
    const data = fs.readFileSync(USERS_FILE, "utf-8");
    const users = JSON.parse(data);
    if (!Array.isArray(users) || users.length === 0) {
      fs.writeFileSync(USERS_FILE, JSON.stringify(DEFAULT_USERS, null, 2));
      return DEFAULT_USERS;
    }
    return users;
  } catch (error) {
    console.error("Error reading users file:", error);
    return DEFAULT_USERS;
  }
}

function saveUsers(users: any[]) {
  try {
    const dir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    return true;
  } catch (error) {
    console.error("Error saving users file:", error);
    return false;
  }
}

export async function GET() {
  try {
    const users = getUsers();
    // Return users without exposing sensitive passwords to non-admin calls, 
    // but include passwords for admin management editing if needed or mask them
    return NextResponse.json({ success: true, users });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, name, email, password, role, status } = body;

    if (!username || !password || !email || !name) {
      return NextResponse.json({ error: "All required fields must be provided." }, { status: 400 });
    }

    const users = getUsers();
    
    // Check for duplicate username or email
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
      createdAt: new Date().toISOString().split("T")[0]
    };

    users.push(newUser);
    saveUsers(users);

    return NextResponse.json({ success: true, user: newUser, message: "User created successfully." });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, username, name, email, password, role, status } = body;

    if (!id) {
      return NextResponse.json({ error: "User ID is required." }, { status: 400 });
    }

    const users = getUsers();
    const index = users.findIndex((u: any) => u.id === id);

    if (index === -1) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Check uniqueness if username or email changed
    const duplicate = users.find(
      (u: any) => u.id !== id && (u.username.toLowerCase() === (username?.toLowerCase() || "") || u.email.toLowerCase() === (email?.toLowerCase() || ""))
    );
    if (duplicate) {
      return NextResponse.json({ error: "Username or email is already taken by another user." }, { status: 409 });
    }

    const updatedUser = {
      ...users[index],
      username: username ? username.trim() : users[index].username,
      name: name ? name.trim() : users[index].name,
      email: email ? email.trim().toLowerCase() : users[index].email,
      role: role || users[index].role,
      status: status || users[index].status,
      // Only update password if a new non-empty password was provided
      password: password && password.trim() !== "" ? password.trim() : users[index].password
    };

    users[index] = updatedUser;
    saveUsers(users);

    return NextResponse.json({ success: true, user: updatedUser, message: "User updated successfully." });
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
      return NextResponse.json({ error: "Cannot delete the primary root administrator account (Godwinhotels)." }, { status: 403 });
    }

    const users = getUsers();
    const index = users.findIndex((u: any) => u.id === id);

    if (index === -1) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Check if trying to delete the last admin
    const activeAdmins = users.filter((u: any) => u.role === "Admin" && u.id !== id);
    if (users[index].role === "Admin" && activeAdmins.length === 0) {
      return NextResponse.json({ error: "Cannot delete the last remaining administrator account." }, { status: 403 });
    }

    users.splice(index, 1);
    saveUsers(users);

    return NextResponse.json({ success: true, message: "User deleted successfully." });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
