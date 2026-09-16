import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const DATA_DIR = process.env.PERSISTENT_DATA_DIR || path.join(process.cwd(), "data");
const CONFIG_FILE = path.join(DATA_DIR, "global_config.json");
const LOCAL_CONFIG_FILE = path.join(process.cwd(), "data", "global_config.json");

function readConfig(): any {
  for (const f of [CONFIG_FILE, LOCAL_CONFIG_FILE]) {
    try {
      if (fs.existsSync(f)) {
        const raw = fs.readFileSync(f, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch {}
  }
  return {};
}

function writeConfig(data: any): void {
  const list = [CONFIG_FILE];
  if (LOCAL_CONFIG_FILE !== CONFIG_FILE) list.push(LOCAL_CONFIG_FILE);

  for (const f of list) {
    try {
      const dir = path.dirname(f);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(f, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.error(`Error saving config to ${f}:`, e);
    }
  }
}

export async function GET() {
  try {
    const rawConfig = readConfig();

    const config = {
      geminiKey: rawConfig.geminiKey || "",
      model: rawConfig.model || "gemini-2.5-flash",
      slabs: rawConfig.slabs || { silver: 5, gold: 10, platinum: 15 },
      geofence: rawConfig.geofence || {
        enabled: true,
        lat: 28.64864864864865,
        lng: 77.21923732550276,
        radius: 50
      }
    };
    
    if (config.geofence && typeof config.geofence.radius !== 'number') {
      config.geofence.radius = 50;
    }
    if (config.geofence && (!config.geofence.lat || !config.geofence.lng)) {
      config.geofence.lat = 28.64864864864865;
      config.geofence.lng = 77.21923732550276;
    }
    
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json({ error: "Failed to load global config" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const existing = readConfig();

    const updated = { ...existing, ...body };
    writeConfig(updated);

    return NextResponse.json({ message: "Global settings updated successfully", config: updated });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update global settings" }, { status: 500 });
  }
}
