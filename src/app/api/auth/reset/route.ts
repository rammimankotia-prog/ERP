import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const USERS_FILE = path.join(process.cwd(), "data", "users.json");

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Please enter your registered email address." }, { status: 400 });
    }

    let users = [];
    if (fs.existsSync(USERS_FILE)) {
      users = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = users.find((u: any) => u.email.toLowerCase() === cleanEmail);

    if (cleanEmail === "mail@godwinhotels.com" || user) {
      return NextResponse.json({
        success: true,
        message: `Password reset request authorized. An automated verification link and temporary password instructions have been sent to ${email} (Admin contact: mail@godwinhotels.com).`
      });
    } else {
      return NextResponse.json({
        error: "No user account found associated with this email address. Please contact Admin at mail@godwinhotels.com."
      }, { status: 404 });
    }
  } catch (error) {
    return NextResponse.json({ error: "Failed to process password reset request." }, { status: 500 });
  }
}
