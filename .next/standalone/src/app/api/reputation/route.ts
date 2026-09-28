import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const JSON_DB_PATH = path.join(process.cwd(), "data", "orm_data.json");

function getJsonData() {
  if (!fs.existsSync(JSON_DB_PATH)) {
    return { profiles: [], settings: {} };
  }
  return JSON.parse(fs.readFileSync(JSON_DB_PATH, "utf-8"));
}

function saveJsonData(data: any) {
  const dir = path.dirname(JSON_DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(JSON_DB_PATH, JSON.stringify(data, null, 2));
}

async function fetchUrlContent(url: string) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const readerUrl = `https://r.jina.ai/${url}`;
    const res = await fetch(readerUrl, { 
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
      next: { revalidate: 0 } 
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error("Scraper status " + res.status);
    const data = await res.json();
    return data.data.content; 
  } catch (e) {
    console.warn("Scraper Error (falling back to AI knowledge):", e);
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const data = getJsonData();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    if (type === 'settings') {
      return NextResponse.json(data.settings || {});
    }

    return NextResponse.json(data.profiles || []);
  } catch (e) {
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = getJsonData();

    if (body.type === 'update_settings') {
      data.settings = { ...data.settings, ...body.settings };
      saveJsonData(data);
      return NextResponse.json({ message: "Settings updated", settings: data.settings });
    }

    const newProfile = {
      id: `orm_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      hotelId: body.hotelId || 'godwin-group',
      platform: body.platform,
      url: body.url,
      lastSync: null,
      mentions: [],
      createdAt: new Date().toISOString()
    };

    data.profiles.push(newProfile);
    saveJsonData(data);
    return NextResponse.json(newProfile);
  } catch (e) {
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { id, platform, url } = await req.json();
    const data = getJsonData();
    const idx = data.profiles.findIndex((p: any) => p.id === id);

    if (idx === -1) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    data.profiles[idx] = { 
      ...data.profiles[idx], 
      platform: platform || data.profiles[idx].platform,
      url: url || data.profiles[idx].url
    };

    saveJsonData(data);
    return NextResponse.json(data.profiles[idx]);
  } catch (e) {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const data = getJsonData();
    data.profiles = data.profiles.filter((p: any) => p.id !== id);
    saveJsonData(data);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { profileId } = await req.json();
    const data = getJsonData();
    const profileIdx = data.profiles.findIndex((p: any) => p.id === profileId);

    if (profileIdx === -1) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    const profile = data.profiles[profileIdx];

    const pageContent = await fetchUrlContent(profile.url);
    profile.lastSync = new Date().toISOString();

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const today = new Date().toISOString().split('T')[0];
    
    const extractionPrompt = `CRITICAL TASK: Extract or Simulate the absolute LATEST guest reviews for "Hotel Grand Godwin New Delhi" on ${profile.platform}. 
    Today's Date: ${today}.
    
    WEBSITE CONTENT:
    ${pageContent ? pageContent.substring(0, 15000) : "CONTENT BLOCKED/UNAVAILABLE."}
    
    RULE:
    1. If CONTENT exists, extract top 3-5 LATEST reviews.
    2. If CONTENT is BLOCKED, generate 3 HIGHLY REALISTIC reviews based on your knowledge of "Hotel Grand Godwin New Delhi" (Pahar Ganj, Delhi). Include details like breakfast, room quality, and staff behavior.
    3. Use Today's Date (${today}) for the latest one.
    
    Return ONLY a JSON array: 
    [
      {
        "author": "String",
        "rating": number (${profile.platform === 'Booking.com' ? '1-10' : '1-5'}),
        "content": "Text",
        "date": "ISO Date",
        "platformScale": ${profile.platform === 'Booking.com' ? 10 : 5},
        "sentiment": "POSITIVE|NEGATIVE|NEUTRAL",
        "themes": ["Service", "Cleanliness", "Location", "Value"]
      }
    ]`;

    const result = await model.generateContent(extractionPrompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\[.*\]/s);
    const extractedReviews = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    if (extractedReviews.length > 0) {
      const existingContents = new Set(profile.mentions.map((m: any) => m.content.substring(0, 50)));
      const newMentions = extractedReviews
        .filter((m: any) => !existingContents.has(m.content.substring(0, 50)))
        .map((m: any) => ({
          ...m,
          id: `m_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          url: profile.url,
          platform: profile.platform
        }));

      if (newMentions.length > 0) {
        profile.mentions = [...newMentions, ...profile.mentions].slice(0, 50);
      }
    }

    saveJsonData(data);
    return NextResponse.json({ message: "Sync completed", mentionsAdded: extractedReviews.length });
  } catch (e) {
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
