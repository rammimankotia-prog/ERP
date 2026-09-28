import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const EXCEL_FILE = path.join(process.cwd(), "data", "chatbot_data.xlsx");

export async function GET() {
  try {
    if (fs.existsSync(EXCEL_FILE)) {
      const fileBuffer = fs.readFileSync(EXCEL_FILE);
      
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="godwin_ai_knowledge.xlsx"',
        },
      });
    }
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to download file" }, { status: 500 });
  }
}
