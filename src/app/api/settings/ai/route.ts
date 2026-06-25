import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_FILE = path.join(DATA_DIR, "ai_config.json");
const EXCEL_FILE = path.join(DATA_DIR, "chatbot_data.xlsx");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export async function GET() {
  try {
    const config = fs.existsSync(CONFIG_FILE) 
      ? JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"))
      : { botName: "Godwin AI", greetingMessage: "Hello!", qaList: [], leadGenEnabled: true };
    
    return NextResponse.json({
      ...config,
      excelExists: fs.existsSync(EXCEL_FILE)
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load config" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const botName = formData.get("botName") as string;
    const greetingMessage = formData.get("greetingMessage") as string;
    const leadGenEnabled = formData.get("leadGenEnabled") === "true";
    const qaListRaw = formData.get("qaList") as string;
    const qaList = qaListRaw ? JSON.parse(qaListRaw) : [];
    const file = formData.get("file") as File | null;

    // Save JSON config
    const config = { botName, greetingMessage, leadGenEnabled, qaList };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

    // Handle File Upload
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(EXCEL_FILE, buffer);
    }

    return NextResponse.json({ message: "AI Settings updated successfully" });
  } catch (error) {
    console.error("Error updating AI settings:", error);
    return NextResponse.json({ error: "Failed to update AI settings" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    if (fs.existsSync(EXCEL_FILE)) {
      fs.unlinkSync(EXCEL_FILE);
      return NextResponse.json({ message: "Excel knowledge base deleted" });
    }
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
