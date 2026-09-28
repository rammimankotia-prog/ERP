import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const LEADS_FILE = path.join(process.cwd(), "data", "ai_leads.json");

// Ensure data directory exists
if (!fs.existsSync(path.join(process.cwd(), "data"))) {
  fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
}

export async function GET() {
  try {
    if (fs.existsSync(LEADS_FILE)) {
      const leads = JSON.parse(fs.readFileSync(LEADS_FILE, "utf-8"));
      return NextResponse.json(leads);
    }
    return NextResponse.json([]);
  } catch (error) {
    return NextResponse.json({ error: "Failed to load leads" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const lead = await req.json();
    let leads = [];
    
    if (fs.existsSync(LEADS_FILE)) {
      leads = JSON.parse(fs.readFileSync(LEADS_FILE, "utf-8"));
    }
    
    // Add timestamp and ID
    const newLead = {
      ...lead,
      id: Date.now().toString(),
      timestamp: new Date().toLocaleString()
    };
    
    leads.unshift(newLead); // Newest first
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
    
    return NextResponse.json({ message: "Lead captured successfully", lead: newLead });
  } catch (error) {
    console.error("Error saving lead:", error);
    return NextResponse.json({ error: "Failed to save lead" }, { status: 500 });
  }
}
