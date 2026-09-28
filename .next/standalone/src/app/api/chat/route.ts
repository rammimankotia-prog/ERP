import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { searchLocalExcel } from "@/lib/excel-search";
import path from "path";
import fs from "fs";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const getConfig = () => {
  const configFile = path.join(process.cwd(), "data", "ai_config.json");
  if (fs.existsSync(configFile)) {
    return JSON.parse(fs.readFileSync(configFile, "utf-8"));
  }
  return { botName: "Godwin AI", greetingMessage: "", leadGenEnabled: true, qaList: [] };
};

const getSystemPrompt = (botName: string, leadGenEnabled: boolean) => `
You are ${botName}, the expert travel consultant for Hotel Grand Godwin and Hotel Godwin Deluxe. 
Your goal is to help staff and agents manage reservations and tour planning.

${leadGenEnabled ? `
LEAD GENERATION PROTOCOL:
When a user expresses interest in booking, inquiry, or pricing, you MUST try to collect the following details politely:
1. Full Name
2. Email Address
3. Mobile Number
4. Check-in Date
5. Check-out Date

Once you have ALL or SOME of these details, you must call the 'captureLead' tool to save them in our database. 
Do not wait for all details if the user is hesitant, but capture what you get.
` : ''}

PROPERTY CONTEXT:
- Hotel Grand Godwin: Plot No. 8502/41, Arakashan Rd, Paharganj.
- Hotel Godwin Deluxe: 8501, 15, Arakashan Rd, Paharganj.
- Fleet: Sedan (₹2500/day), SUV (₹4500/day).

SKILLS:
1. ITINERARY GENERATION: When asked for a tour plan, provide a day-by-day itinerary including Morning, Afternoon, and Evening activities. 
2. PRICING: Calculate B2B prices (Silver: -5%, Gold: -10%, Platinum: -15% from B2C).
3. POLICY: Handle cancellation and check-in/out queries.

FORMAT:
If generating an itinerary, use the following structure:
DAY [Number]: [Title]
- Morning: [Activity]
- Afternoon: [Activity]
- Evening: [Activity]
- Stay: [Hotel Name]
- Inclusions: [List]

When asked about revenue or agent performance, answer professionally based on the context provided.
If the GEMINI_API_KEY is missing, warn the user.
`;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const apiKey = searchParams.get('apiKey');

    if (!apiKey) {
      return NextResponse.json({ error: "API Key required for model discovery" }, { status: 400 });
    }

    // Attempt a lightweight probe to see if the key is valid
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (response.ok) {
        return NextResponse.json({ 
          status: "valid",
          models: data.models?.map((m: any) => m.name.split('/').pop()) || [],
          message: "API Key is valid and models retrieved."
        });
      } else {
        return NextResponse.json({ 
          status: "invalid",
          error: data.error?.message || "Invalid API Key",
          code: data.error?.status || "REJECTED"
        }, { status: response.status });
      }
    } catch (probeError: any) {
      return NextResponse.json({ 
        status: "error",
        error: "Failed to connect to Google API service."
      }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: "Discovery internal error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { message, history, apiKey: clientKey, model: clientModel } = await req.json();

    // 0. Load server-side global config if exists
    const globalConfigFile = path.join(process.cwd(), "data", "global_config.json");
    let globalConfig: any = {};
    if (fs.existsSync(globalConfigFile)) {
      globalConfig = JSON.parse(fs.readFileSync(globalConfigFile, "utf-8"));
    }

    const activeKey = clientKey || globalConfig.geminiKey || process.env.GEMINI_API_KEY;
    const activeModel = clientModel || globalConfig.model || "gemini-1.5-flash";

    if (!activeKey) {
      return NextResponse.json({ 
        error: "MISSING_KEY",
        response: "AI Assistant is currently offline. Please add GEMINI_API_KEY in settings." 
      }, { status: 401 });
    }

    try {
      // 1. Check local manual Q&A list first
      const config = getConfig();
      const manualMatch = config.qaList?.find((item: any) => 
        message.toLowerCase().includes(item.question.toLowerCase()) || 
        item.question.toLowerCase().includes(message.toLowerCase())
      );
      
      if (manualMatch) {
        return NextResponse.json({ 
          response: manualMatch.answer, 
          source: 'local_excel' 
        });
      }

      // 2. Check local Excel
      const localAnswer = await searchLocalExcel(message);
      if (localAnswer) {
        return NextResponse.json({ 
          response: localAnswer,
          source: 'local_excel'
        });
      }

      // 3. Fallback to Gemini with Google Search and Lead Tool
      const activeGenAI = new GoogleGenerativeAI(activeKey);
      
      const systemPrompt = getSystemPrompt(config.botName, config.leadGenEnabled);

      // Gemini Limitation: Built-in tools (google_search) and Function Calling 
      // cannot currently be combined in the same request.
      const tools: any[] = [];
      
      if (config.leadGenEnabled) {
        // Prioritize Lead Generation for ERP/Business logic
        tools.push({
          functionDeclarations: [{
            name: "captureLead",
            description: "Captures user contact and booking interest details into the AI Leads database.",
            parameters: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING", description: "Customer full name" },
                email: { type: "STRING", description: "Customer email address" },
                mobile: { type: "STRING", description: "Customer mobile number" },
                checkIn: { type: "STRING", description: "Desired check-in date" },
                checkOut: { type: "STRING", description: "Desired check-out date" },
                notes: { type: "STRING", description: "Any other details or requirements" }
              }
            }
          }]
        });
      } else {
        // Only use Google Search if lead generation is off
        tools.push({ googleSearch: {} });
      }

      const model = activeGenAI.getGenerativeModel({ 
        model: activeModel,
        tools: tools as any
      });

      const chat = model.startChat({
        history: [
          { role: "user", parts: [{ text: systemPrompt }] },
          { role: "model", parts: [{ text: `Understood. I am ready to assist as ${config.botName}. I will also collect lead information as per the protocol.` }] },
          ...history.map((h: any) => ({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.text }]
          }))
        ],
      });

      const result = await chat.sendMessage(message);
      const response = await result.response;
      
      // Handle Function Calls (Leads)
      const calls = response.functionCalls();
      if (calls && calls.length > 0) {
        const call = calls[0];
        if (call.name === "captureLead") {
          // Save the lead via internal fetch to our own API
          try {
            await fetch(`${new URL(req.url).origin}/api/leads`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(call.args)
            });
          } catch (err) {
            console.error("Failed to trigger lead capture:", err);
          }
          
          // Generate a follow-up response confirming the interest
          const followUp = await chat.sendMessage([
            { functionResponse: { name: "captureLead", response: { status: "success", message: "Lead saved to database" } } }
          ]);
          return NextResponse.json({ response: followUp.response.text(), source: 'web_search' });
        }
      }

      return NextResponse.json({ 
        response: response.text(),
        source: 'gemini_web'
      });
    } catch (apiError: any) {
      console.error(`Gemini SDK Error [Model: ${activeModel}]:`, apiError.message);
      
      const isNotFoundError = apiError.message?.includes("404") || apiError.message?.includes("not found");
      const isForbiddenError = apiError.message?.includes("403") || apiError.message?.includes("permission");

      // Attempt multi-version fallback if SDK fails
      if (isNotFoundError || isForbiddenError) {
        try {
          // Try v1beta first
          const versions = ['v1beta', 'v1'];
          for (const version of versions) {
            console.log(`Attempting ${version} Raw Fallback for ${activeModel}...`);
            const url = `https://generativelanguage.googleapis.com/${version}/models/${activeModel}:generateContent?key=${activeKey}`;
            
            const rawResponse = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: message || "Hello" }] }]
              })
            });
            
            const rawData = await rawResponse.json();
            if (rawResponse.ok) {
              return NextResponse.json({ 
                response: rawData.candidates?.[0]?.content?.parts?.[0]?.text || "Connected via Fallback." 
              });
            }
            
            // If it's a 404 on v1beta, it might work on v1. If it's something else, stop.
            if (rawResponse.status !== 404) break;
          }

          return NextResponse.json({ 
            error: "API_REJECTED",
            details: `The model '${activeModel}' could not be reached on v1 or v1beta.`,
            response: `Please use the 'SCAN FOR WORKING MODELS' button in settings to see what your key supports.`,
          }, { status: 404 });

        } catch (fallbackError) {
          // Fall through
        }
      }
      
      return NextResponse.json({ 
        error: "API_REJECTED",
        details: apiError.message || "Unknown API error",
        response: `The model ${activeModel} is not responding. Please check your Google AI Studio console.`
      }, { status: 403 });
    }

  } catch (error) {
    console.error("Internal Server Error:", error);
    return NextResponse.json({ 
      error: "SERVER_ERROR", 
      response: "Failed to fetch response from AI. Please try again." 
    }, { status: 500 });
  }
}
