import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');

  if (!key) {
    return NextResponse.json({ error: "API Key is required" }, { status: 400 });
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ 
        error: data.error?.message || "Failed to fetch models from Google",
        status: response.status 
      }, { status: response.status });
    }

    // Filter for generateContent supported models
    const models = data.models
      .filter((m: any) => m.supportedGenerationMethods.includes('generateContent'))
      .map((m: any) => m.name.replace('models/', ''));

    return NextResponse.json({ models });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Network error" }, { status: 500 });
  }
}
