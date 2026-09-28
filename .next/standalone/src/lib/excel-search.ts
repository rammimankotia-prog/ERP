import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

export async function searchLocalExcel(query: string): Promise<string | null> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'chatbot_data.xlsx');
    
    if (!fs.existsSync(filePath)) {
      console.warn('Excel data file not found at:', filePath);
      return null;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert sheet to JSON
    const data: any[] = XLSX.utils.sheet_to_json(worksheet);
    
    const lowerQuery = query.toLowerCase();
    
    // Simple keyword matching for demo
    // In a production app, you might use Fuse.js or semantic search
    for (const row of data) {
      const question = (row.Question || row.question || '').toString().toLowerCase();
      const answer = (row.Answer || row.answer || '').toString();
      
      if (question && lowerQuery.includes(question) || question.includes(lowerQuery)) {
        return answer;
      }
      
      // Check if any keywords match
      const keywords = question.split(' ').filter((k: string) => k.length > 3);
      const matches = keywords.filter((k: string) => lowerQuery.includes(k));
      if (matches.length >= 2) { // Match if at least 2 significant keywords match
        return answer;
      }
    }

    return null;
  } catch (error) {
    console.error('Error searching Excel:', error);
    return null;
  }
}
