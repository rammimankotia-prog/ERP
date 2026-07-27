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

    // Return clean user object without sensitive password
    const safeUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status
    };

    return NextResponse.json({ success: true, user: safeUser, message: "Login successful!" });
  } catch (error) {
    return NextResponse.json({ error: "Authentication failed due to server error." }, { status: 500 });
  }
}
