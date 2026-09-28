const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const data = [
  { Question: 'What is the check-in time?', Answer: 'Standard check-in time at Godwin Hotels is 12:00 PM.' },
  { Question: 'What is the check-out time?', Answer: 'Standard check-out time is 11:00 AM.' },
  { Question: 'Is breakfast included?', Answer: 'Breakfast is included in all Direct Booking and Superior/Executive room plans.' },
  { Question: 'Do you have airport pickup?', Answer: 'Yes, we provide airport pickup services. Sedan is ₹2500 and SUV is ₹4500 per trip.' },
  { Question: 'What is the address of Hotel Grand Godwin?', Answer: 'Hotel Grand Godwin is located at Plot No. 8502/41, Arakashan Rd, behind Sheela Cinema Street, Ram Nagar, Paharganj, New Delhi, Delhi 110055.' },
  { Question: 'What is the address of Godwin Deluxe?', Answer: 'Godwin Deluxe is located at 8501, 15, Arakashan Rd, Ram Nagar, Paharganj, New Delhi, Delhi 110055.' },
  { Question: 'How to contact booking team?', Answer: 'You can contact our booking team at book@godwinhotels.com or call +91 8860081999.' }
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'ChatbotData');

const filePath = path.join(process.cwd(), 'data', 'chatbot_data.xlsx');
XLSX.writeFile(wb, filePath);

console.log('Excel file created at:', filePath);
