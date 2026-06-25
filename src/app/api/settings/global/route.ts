import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const CONFIG_FILE = path.join(process.cwd(), "data", "global_config.json");

// Ensure data directory exists
const DATA_DIR = path.dirname(CONFIG_FILE);
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export async function GET() {
  try {
    const config = fs.existsSync(CONFIG_FILE) 
      ? JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"))
      : { 
          geminiKey: "", 
          model: "gemini-1.5-flash", 
          slabs: { silver: 5, gold: 10, platinum: 15 } 
        };
    
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json({ error: "Failed to load global config" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const existing = fs.existsSync(CONFIG_FILE) 
      ? JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"))
      : {};

    const updated = { ...existing, ...body };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2));

    return NextResponse.json({ message: "Global settings updated successfully" });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update global settings" }, { status: 500 });
  }
}
