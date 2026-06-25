'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { useTheme } from './ThemeProvider';

// --- Constants & Types ---
const COUNTRY_CODES = [
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+1', country: 'USA/Canada', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
];

const PROPERTY_DETAILS: Record<string, any> = {
  'Hotel Grand Godwin': {
    address: 'Plot No. 8502/41, Arakashan Rd, behind Sheela Cinema Street, Ram Nagar, Paharganj, New Delhi, Delhi 110055',
    email: 'book@godwinhotels.com',
    phone: '+91 8860081994',
    web: 'https://www.godwinhotels.com',
    gstin: '07AADFH8059B1ZJ'
  },
  'Godwin Deluxe': {
    address: '8501, 15, Arakashan Rd, Ram Nagar, Paharganj, New Delhi, Delhi 110055',
    email: 'book@godwinhotels.com',
    phone: '+91 8860081992',
    web: 'https://www.godwinhotels.com',
    gstin: '07AADFH8059B1ZJ'
  }
};

const BANK_DETAILS: Record<string, any> = {
  'Hotel Grand Godwin': {
    beneficiary: 'Hotel Grand Godwin',
    bank: 'Bank of Maharashtra',
    accountNo: '20055206511',
    ifsc: 'MAHB0000140',
    branch: 'Karol Bagh - New Delhi - 110005',
    gstin: '07AADFH8059B1ZJ',
    payLink: 'https://hotelgrandgodwin.hotelpay.co.in/'
  },
  'Godwin Deluxe': {
    beneficiary: 'Hotel Godwin Deluxe',
    bank: 'Bank of Maharashtra',
    accountNo: '60041200947',
    ifsc: 'MAHB0000343',
    branch: 'Connaught Place - New Delhi - 110001',
    gstin: '07AADCB5838k1ZF',
    payLink: 'https://godwindeluxe.hotelpay.co.in/'
  }
};

const ROOM_OPTIONS: Record<string, string[]> = {
  'Hotel Grand Godwin': ['Superior Room', 'Executive Room', 'Studio Room'],
  'Godwin Deluxe': ['Deluxe Room', 'Premier Room', 'Premier Twin', 'Premier Studio'],
};

interface Room {
  id: number;
  category: string;
  adults: number;
  children: number;
  count: number;
  tariff: string;
  extraBed: { status: string; count: number; rate: string };
  extraChild: { status: string; count: number; rate: string };
  meals: { breakfast: boolean; lunch: boolean; dinner: boolean };
}

export default function QuotationForm({ editId }: { editId?: string }) {
  const router = useRouter();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState('Hotel Grand Godwin');
  const [docType, setDocType] = useState<'QUOTATION' | 'RATE_SHEET'>('QUOTATION');

  // --- Common State ---
  const [quotationId, setQuotationId] = useState(`QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [companyName, setCompanyName] = useState('');
  const [guestType, setGuestType] = useState('General');
  const [isFinalized, setIsFinalized] = useState(false);

  // --- Individual Quotation Specific State ---
  const [checkIn, setCheckIn] = useState(new Date().toISOString().split('T')[0]);
  const [checkOut, setCheckOut] = useState(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [nights, setNights] = useState(1);
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([
    {
      id: 1,
      category: ROOM_OPTIONS['Hotel Grand Godwin'][0],
      adults: 2,
      children: 0,
      count: 1,
      tariff: '',
      extraBed: { status: 'None', count: 1, rate: '' },
      extraChild: { status: 'None', count: 1, rate: '' },
      meals: { breakfast: true, lunch: false, dinner: false }
    }
  ]);

  const [earlyCheckInTime, setEarlyCheckInTime] = useState('10:00');
  const [earlyCheckInFee, setEarlyCheckInFee] = useState('');
  const [lateCheckOutTime, setLateCheckOutTime] = useState('14:00');
  const [lateCheckOutFee, setLateCheckOutFee] = useState('');

  const [pickupCharge, setPickupCharge] = useState('');
  const [dropCharge, setDropCharge] = useState('');
  const [sightseeingCharge, setSightseeingCharge] = useState('');

  const [discountPercent, setDiscountPercent] = useState(0);

  // --- SMTP Settings ---
  const [smtpSettings, setSmtpSettings] = useState({
    host: 'smtp.gmail.com',
    port: '465',
    user: '',
    pass: '',
    fromName: 'Godwin Hotels Reservation'
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('GODWIN_SMTP');
    if (saved) setSmtpSettings(JSON.parse(saved));
  }, []);

  // --- Rate Matrix Specific State ---
  const [validityStart, setValidityStart] = useState(new Date().toISOString().split('T')[0]);
  const [validityEnd, setValidityEnd] = useState(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
  const [rateMatrix, setRateMatrix] = useState<Record<string, any>>({});

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // --- Data Loading Logic ---
  useEffect(() => {
    if (editId && mounted) {
      const existing = JSON.parse(localStorage.getItem('godwin_quotations') || '[]');
      const found = existing.find((q: any) => q.id === editId || q.quotationId === editId);
      if (found) {
        setQuotationId(found.quotationId);
        setSelectedHotel(found.hotel);
        setDocType(found.docType);
        setIsFinalized(found.status === 'FINALIZED');
        
        const g = found.guest;
        setFirstName(g.firstName || '');
        setLastName(g.lastName || '');
        setEmail(g.email || '');
        setPhone(g.phone || '');
        setCountryCode(g.countryCode || '+91');
        setGuestType(g.guestType || 'General');
        setCompanyName(g.companyName || '');
        setWhatsappConsent(!!g.whatsappConsent);

        setIsFinalized(found.status === 'FINALIZED');
        if (found.docType === 'QUOTATION') {
          setCheckIn(found.stay.checkIn);
          setCheckOut(found.stay.checkOut);
          setNights(found.stay.nights);
          setEarlyCheckInTime(found.stay.earlyCheckInTime || '10:00');
          setLateCheckOutTime(found.stay.lateCheckOutTime || '14:00');
          setRooms(found.rooms);
          setDiscountPercent(found.discountPercent || 0);
        } else {
          setValidityStart(found.validityStart);
          setValidityEnd(found.validityEnd);
          setRateMatrix(found.rateMatrix || {});
        }
      }
    }
  }, [editId, mounted]);

  // --- Theme Colors ---
  const colors = {
    bg: theme === 'light' ? '#f0f4f8' : '#0a0f1d',
    card: theme === 'light' ? '#ffffff' : '#151c2c',
    text: theme === 'light' ? '#1e293b' : '#f8fafc',
    textMuted: theme === 'light' ? '#64748b' : '#94a3b8',
    border: theme === 'light' ? '#e2e8f0' : '#2d3748',
    inputBg: theme === 'light' ? '#ffffff' : '#0f172a',
    inputBorder: theme === 'light' ? '#e2e8f0' : '#334155',
    headerBg: theme === 'light' ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' : 'linear-gradient(135deg, #020617 0%, #1e293b 100%)',
    sidebarGradient: theme === 'light' 
      ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' 
      : 'linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%)',
    highlight: theme === 'light' ? '#eff6ff' : '#1e293b',
    hover: theme === 'light' ? '#f1f5f9' : '#334155',
    shadow: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.3)',
  };

  useEffect(() => {
    if (checkIn && checkOut) {
      const start = new Date(checkIn);
      const end = new Date(checkOut);
      const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      setNights(diff >= 0 ? diff : 0);
    }
  }, [checkIn, checkOut]);

  // --- Calculations ---
  const effectiveNights = (nights === 0 && checkIn && checkIn === checkOut) ? 1 : (nights || 1);

  const roomRentTotal = rooms.reduce((acc, r) => acc + (Number(r.tariff) * r.count * effectiveNights), 0);

  const extraBedTotal = rooms.reduce((acc, r) => {
    const rate = r.extraBed.status === 'Charged' ? Number(r.extraBed.rate) : 0;
    return acc + (rate * r.extraBed.count * r.count * effectiveNights);
  }, 0);

  const extraChildTotal = rooms.reduce((acc, r) => {
    const rate = r.extraChild.status === 'Charged' ? Number(r.extraChild.rate) : 0;
    return acc + (rate * r.extraChild.count * r.count * effectiveNights);
  }, 0);

  const extraOccupancyTotal = extraBedTotal + extraChildTotal;

  const servicesTotal = Number(earlyCheckInFee || 0) + Number(lateCheckOutFee || 0) + Number(pickupCharge || 0) + Number(dropCharge || 0) + Number(sightseeingCharge || 0);

  // Tax Inclusive Logic: Total is already the final price
  const subtotalWithTaxes = roomRentTotal + extraOccupancyTotal + servicesTotal;
  const discountAmount = (subtotalWithTaxes * discountPercent) / 100;
  const grandTotal = subtotalWithTaxes - discountAmount;

  const totalGst = (grandTotal * 5) / 105;
  const cgst = totalGst / 2;
  const sgst = totalGst / 2;

  const totalAdults = rooms.reduce((acc, r) => acc + (r.adults * r.count), 0);
  const totalChildren = rooms.reduce((acc, r) => acc + (r.children * r.count), 0);

  // --- Handlers ---
  const addRoom = () => {
    setRooms([...rooms, {
      id: Date.now(),
      category: ROOM_OPTIONS[selectedHotel][0],
      adults: 2,
      children: 0,
      count: 1,
      tariff: '',
      extraBed: { status: 'None', count: 1, rate: '' },
      extraChild: { status: 'None', count: 1, rate: '' },
      meals: { breakfast: true, lunch: false, dinner: false }
    }]);
  };

  const updateRoom = (id: number, field: keyof Room, value: any) => {
    setRooms(rooms.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const removeRoom = (id: number) => {
    if (rooms.length > 1) {
      setRooms(rooms.filter(r => r.id !== id));
    } else {
      alert('At least one room is required.');
    }
  };

  const updateMatrixRate = (category: string, occupancy: string, plan: string, value: string) => {
    setRateMatrix(prev => ({
      ...prev,
      [category]: { ...prev[category], [occupancy]: { ...prev[category][occupancy], [plan]: value } }
    }));
  };

  const handleSave = async (isDraft = false) => {
    if (!firstName) return alert('First Name is mandatory.');

    if (docType === 'QUOTATION') {
      const invalidRoom = rooms.find(r => !r.category || r.count <= 0 || r.adults <= 0 || !r.tariff);
      if (invalidRoom) return alert('All room columns (Category, Qty, Adults, Rate) must be filled correctly.');
    }

    setIsSaving(true);
    try {
      const data = {
        id: editId || quotationId,
        quotationId,
        hotel: selectedHotel,
        docType,
        guest: { firstName, lastName, email, phone, countryCode, guestType, companyName, whatsappConsent },
        ...(docType === 'QUOTATION' ? {
          stay: { checkIn, checkOut, nights, earlyCheckInTime, lateCheckOutTime },
          rooms,
          financials: { grandTotal }
        } : {
          validityStart,
          validityEnd,
          rateMatrix
        }),
        status: isDraft ? 'DRAFT' : 'FINALIZED',
        totalAmount: docType === 'QUOTATION' ? grandTotal : 0,
        createdAt: new Date().toISOString()
      };

      const existing = JSON.parse(localStorage.getItem('godwin_quotations') || '[]');
      const updated = editId ? existing.map((q: any) => q.id === editId ? data : q) : [data, ...existing];
      localStorage.setItem('godwin_quotations', JSON.stringify(updated));
      await new Promise(r => setTimeout(r, 800));
      if (!isDraft) setIsFinalized(true);
      alert('✅ Saved successfully!');
      
      if (!editId) {
        router.push(`/quotations/${quotationId}`);
      }
    } catch (e) { alert('❌ Error saving.'); } finally { setIsSaving(false); }
  };

  const getMealPlanCode = (meals: any) => {
    if (meals.breakfast && meals.lunch && meals.dinner) return 'AP (All Meals)';
    if (meals.breakfast && (meals.lunch || meals.dinner)) return 'MAP (Breakfast + 1 Meal)';
    if (meals.breakfast) return 'CP (Breakfast Included)';
    if (meals.lunch || meals.dinner) return 'EP+ (Meals Included)';
    return 'EP (Room Only)';
  };

  const handlePrint = async () => {
    if (!printRef.current) return;
    setIsSaving(true);
    try {
      // Create a clone for high-quality capture
      const element = printRef.current;
      const canvas = await html2canvas(element, { 
        scale: 3, // Higher scale for print quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Godwin_Quotation_${quotationId}.pdf`);
    } catch (e) { 
      console.error("PDF Generation Error:", e);
      alert('❌ Error generating PDF.'); 
    }
    finally { setIsSaving(false); }
  };

  const handleExport = () => {
    console.log("Generating Excel for:", quotationId);
    try {
      const ws_data = [
        ["GODWIN HOTELS GROUP - OFFICIAL QUOTATION", "", "", "", "", ""],
        ["Hotel Property", selectedHotel, "Quotation ID", quotationId, "Status", isFinalized ? "FINALIZED" : "DRAFT"],
        ["Date of Issue", new Date().toLocaleDateString(), "Valid Until", checkIn, "", ""],
        ["", "", "", "", "", ""],
        ["--- GUEST INFORMATION ---", "", "", "--- STAY DETAILS ---", "", ""],
        ["Guest Name", `${firstName} ${lastName}`, "", "Check-in Date", checkIn, `Time: ${earlyCheckInTime}`],
        ["Contact Email", email, "", "Check-out Date", checkOut, `Time: ${lateCheckOutTime}`],
        ["Contact Phone", `${countryCode} ${phone}`, "", "Total Nights", effectiveNights, ""],
        ["Organization", companyName || "N/A", "", "Guest Count", `${totalAdults} Adults, ${totalChildren} Children`, ""],
        ["", "", "", "", "", ""],
        ["--- ROOM & MEAL BREAKDOWN ---", "", "", "", "", ""],
        ["Category", "Qty", "Occupancy", "Meal Plan", "Tariff (per night)", "Total Amount"],
        ...rooms.map(r => [
          r.category,
          r.count,
          `${r.adults}A + ${r.children}C`,
          getMealPlanCode(r.meals),
          r.tariff,
          Number(r.tariff) * r.count * effectiveNights
        ]),
        ["", "", "", "", "", ""],
        ["--- FINANCIAL SUMMARY ---", "", "", "", "", ""],
        ["Room Rent Total", "", "", "", "", roomRentTotal],
        ["Extra Bed Charges", "", "", "", "", extraBedTotal],
        ["Extra Child Charges", "", "", "", "", extraChildTotal],
        ["Other Services", "", "", "", "", servicesTotal],
        ["Discount Applied", "", "", "", `${discountPercent}%`, `-${discountAmount}`],
        ["GRAND TOTAL (Tax Incl.)", "", "", "", "", grandTotal],
        ["GST Breakdown (5%)", "", "", "", "", `CGST: ${cgst} | SGST: ${sgst}`],
        ["", "", "", "", "", ""],
        ["--- BANKING DETAILS FOR PAYMENT ---", "", "", "", "", ""],
        ["Beneficiary", BANK_DETAILS[selectedHotel].beneficiary, "", "", "", ""],
        ["Bank Name", BANK_DETAILS[selectedHotel].bank, "", "", "", ""],
        ["Account Number", BANK_DETAILS[selectedHotel].accountNo, "", "", "", ""],
        ["IFSC Code", BANK_DETAILS[selectedHotel].ifsc, "", "", "", ""],
        ["Branch", BANK_DETAILS[selectedHotel].branch, "", "", "", ""],
        ["Payment Link", BANK_DETAILS[selectedHotel].payLink, "", "", "", ""],
        ["", "", "", "", "", ""],
        ["Note: This is a computer generated document and does not require a signature.", "", "", "", "", ""]
      ];

      const ws = XLSX.utils.aoa_to_sheet(ws_data);
      
      // Basic column width configuration
      ws['!cols'] = [
        { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 20 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Quotation Detail");
      XLSX.writeFile(wb, `Godwin_Quotation_${quotationId}.xlsx`);
      console.log("Excel generated successfully");
    } catch (err) {
      console.error("Excel Generation Error:", err);
      alert("❌ Error generating Excel file.");
    }
  };

  const handleSendEmail = async () => {
    if (!isFinalized) {
      alert('🔒 Please "FINALIZE NOW" the quotation before sending it to the client.');
      return;
    }
    if (!firstName || !email) {
      alert('⚠️ Please fill Guest Name and Email before sending.');
      return;
    }
    if (!smtpSettings.user || !smtpSettings.pass) {
      alert('⚙️ Please configure SMTP settings (Gear icon) before sending.');
      setIsSettingsOpen(true);
      return;
    }
    setIsSaving(true);
    try {
      const hotel = PROPERTY_DETAILS[selectedHotel];
      const mealPlanInfo = rooms.map(r => `${r.category}: ${getMealPlanCode(r.meals)}`).join(', ');

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: `Stay Quotation: ${quotationId} - ${selectedHotel}`,
          smtpSettings,
          html: `
            <div style="background-color: #f0f4f8; padding: 50px 20px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b;">
              <div style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 30px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);">
                
                <!-- Brand Header -->
                <div style="background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%); padding: 50px 40px; text-align: center; color: #ffffff;">
                  <h1 style="margin: 0; font-size: 32px; font-weight: 900; letter-spacing: -0.03em; line-height: 1;">${selectedHotel}</h1>
                  <p style="margin: 12px 0 0; font-size: 14px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.2em; font-weight: 700;">Official Stay Quotation</p>
                </div>

                <div style="padding: 50px 45px;">
                  <div style="margin-bottom: 40px;">
                    <p style="font-size: 18px; color: #1e293b; margin: 0 0 10px;">Dear <strong>${firstName} ${lastName}</strong>,</p>
                    <p style="font-size: 16px; line-height: 1.7; color: #475569; margin: 0;">Warm greetings from <strong>Godwin Hotels Group</strong>. We are pleased to share the requested quotation for your upcoming visit to the capital city.</p>
                  </div>
                  
                  <!-- Booking Matrix -->
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 24px; padding: 35px; margin-bottom: 45px;">
                    <h3 style="margin: 0 0 25px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.15em; color: #1d4ed8; font-weight: 900;">Proposal Overview</h3>
                    
                    <div style="display: grid; gap: 15px;">
                      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #eef2f6; padding-bottom: 12px;">
                        <span style="color: #64748b; font-size: 14px;">Quotation ID</span>
                        <span style="color: #1e293b; font-size: 14px; font-weight: 800; color: #1d4ed8;">#${quotationId}</span>
                      </div>
                      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #eef2f6; padding-bottom: 12px;">
                        <span style="color: #64748b; font-size: 14px;">Stay Period</span>
                        <span style="color: #1e293b; font-size: 14px; font-weight: 700;">${checkIn} to ${checkOut} (${effectiveNights} Night)</span>
                      </div>
                      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #eef2f6; padding-bottom: 12px;">
                        <span style="color: #64748b; font-size: 14px;">Occupancy</span>
                        <span style="color: #1e293b; font-size: 14px; font-weight: 700;">${totalAdults} Adult(s), ${totalChildren} Child(ren)</span>
                      </div>
                      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #eef2f6; padding-bottom: 12px;">
                        <span style="color: #64748b; font-size: 14px;">Meal Plan</span>
                        <span style="color: #1e293b; font-size: 14px; font-weight: 800; color: #1e3a8a;">${mealPlanInfo}</span>
                      </div>
                      <div style="display: flex; justify-content: space-between; padding-top: 15px; margin-top: 5px;">
                        <span style="color: #1e293b; font-size: 22px; font-weight: 900;">Total Amount</span>
                        <span style="color: #1d4ed8; font-size: 22px; font-weight: 900;">${formatCurrency(grandTotal)}</span>
                      </div>
                      <p style="margin: 10px 0 0; font-size: 11px; color: #94a3b8; text-align: right;">* Inclusive of all applicable taxes (5% GST)</p>
                    </div>
                  </div>

                  <!-- Secure Payment -->
                  <div style="margin-bottom: 50px;">
                    <h3 style="margin: 0 0 25px; font-size: 18px; color: #1e293b; font-weight: 900; display: flex; align-items: center; gap: 10px;">
                      <span style="width: 32px; height: 32px; background: #dcfce7; color: #166534; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px;">✓</span> 
                      Secure Booking Confirmation
                    </h3>
                    
                    <div style="background: #ffffff; border: 2px solid #f1f5f9; border-radius: 20px; padding: 25px; display: flex; align-items: center; gap: 30px;">
                      <div style="flex: 1;">
                        <p style="margin: 0 0 15px; font-size: 14px; color: #475569; line-height: 1.5;">To confirm your reservation, please complete the payment using our secure gateway or bank transfer details below.</p>
                        <a href="${BANK_DETAILS[selectedHotel].payLink}" style="display: inline-block; background: #1d4ed8; color: #ffffff; padding: 12px 25px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 14px;">PAY SECURELY NOW</a>
                      </div>
                      <div style="text-align: center;">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(BANK_DETAILS[selectedHotel].payLink)}" alt="Scan to Pay" style="width: 100px; height: 100px; border-radius: 12px; border: 4px solid #f8fafc;" />
                        <p style="margin: 8px 0 0; font-size: 10px; color: #94a3b8; font-weight: 700;">SCAN TO PAY</p>
                      </div>
                    </div>

                    <div style="margin-top: 25px; padding: 20px; background: #f1f5f9; border-radius: 15px; font-size: 13px; color: #475569;">
                      <strong>Bank Details:</strong> ${BANK_DETAILS[selectedHotel].bank} | <strong>A/c:</strong> ${BANK_DETAILS[selectedHotel].accountNo} | <strong>IFSC:</strong> ${BANK_DETAILS[selectedHotel].ifsc}
                    </div>
                  </div>

                  <!-- Hotel Contact Details -->
                  <div style="border-top: 1px solid #f1f5f9; padding-top: 40px; text-align: center;">
                    <p style="margin: 0; font-size: 16px; font-weight: 800; color: #1e293b;">${selectedHotel}</p>
                    <p style="margin: 8px 0; font-size: 13px; color: #64748b; line-height: 1.5;">${hotel.address}</p>
                    <p style="margin: 15px 0 0; font-size: 14px; color: #1d4ed8; font-weight: 700;">
                      Phone: ${hotel.phone} &nbsp; | &nbsp; Email: ${hotel.email}
                    </p>
                    <p style="margin: 8px 0 0; font-size: 14px;">
                      <a href="${hotel.web}" style="color: #3b82f6; text-decoration: none; font-weight: 700; border-bottom: 2px solid #dbeafe;">${hotel.web.replace('https://', '')}</a>
                    </p>
                  </div>
                </div>

                <div style="background-color: #1e293b; padding: 25px; text-align: center; color: #94a3b8; font-size: 11px;">
                  This is an official communication from Godwin Hotels Group. <br/>
                  © ${new Date().getFullYear()} All Rights Reserved.
                </div>
              </div>
            </div>
          `
        })
      });
      if (res.ok) alert('🚀 Premium Proposal sent to client successfully!');
      else {
        const err = await res.json();
        alert(`❌ Error: ${err.error}`);
      }
    } catch (e) { 
      console.error(e);
      alert('❌ Error generating or sending email.'); 
    } finally { setIsSaving(false); }
  };


  if (!mounted) return null;

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, transition: 'all 0.3s ease', padding: '2rem' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>

        {/* Top Controls: Mode & Theme */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
          <div style={{ display: 'flex', background: colors.card, padding: '0.4rem', borderRadius: '18px', border: `1px solid ${colors.border}` }}>
            <button onClick={() => setDocType('QUOTATION')} style={{ padding: '0.8rem 2rem', borderRadius: '14px', border: 'none', fontWeight: 800, cursor: 'pointer', background: docType === 'QUOTATION' ? colors.headerBg : 'transparent', color: docType === 'QUOTATION' ? 'white' : colors.textMuted }}>📋 INDIVIDUAL</button>
            <button onClick={() => setDocType('RATE_SHEET')} style={{ padding: '0.8rem 2rem', borderRadius: '14px', border: 'none', fontWeight: 800, cursor: 'pointer', background: docType === 'RATE_SHEET' ? colors.headerBg : 'transparent', color: docType === 'RATE_SHEET' ? 'white' : colors.textMuted }}>📊 CONTRACT</button>
          </div>

           <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => setIsSettingsOpen(true)}
              style={{
                width: '50px', height: '50px', borderRadius: '15px', border: `1px solid ${colors.border}`,
                background: colors.card, color: colors.text, cursor: 'pointer', fontSize: '1.2rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
              }}
            >
              ⚙️
            </button>
            <button
              onClick={() => {}} // Global theme handled in Sidebar
              style={{
                width: '50px', height: '50px', borderRadius: '15px', border: `1px solid ${colors.border}`,
                background: colors.card, color: colors.text, cursor: 'default', fontSize: '1.2rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                opacity: 0.5
              }}
              title="Theme controlled from sidebar"
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
        </div>

        <header style={{ background: colors.headerBg, padding: '2.5rem', borderRadius: '30px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', boxShadow: `0 20px 25px -5px ${colors.shadow}`, border: theme === 'dark' ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 900, margin: 0, letterSpacing: '-0.03em' }}>{selectedHotel}</h1>
            <p style={{ margin: '0.5rem 0 0', opacity: 0.9, color: '#ffffff', fontSize: '0.9rem', maxWidth: '600px' }}>{PROPERTY_DETAILS[selectedHotel].address}</p>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1.5rem', opacity: 0.9, color: '#ffffff', fontSize: '0.85rem', fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>📞 {PROPERTY_DETAILS[selectedHotel].phone}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>✉️ {PROPERTY_DETAILS[selectedHotel].email}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>🌐 {PROPERTY_DETAILS[selectedHotel].web}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.1)' }}>
            {Object.keys(PROPERTY_DETAILS).map(h => (
              <button key={h} onClick={() => setSelectedHotel(h)} style={{ padding: '0.8rem 1.5rem', border: 'none', borderRadius: '10px', background: selectedHotel === h ? '#3b82f6' : 'transparent', color: 'white', fontWeight: 800, cursor: 'pointer' }}>{h === 'Hotel Grand Godwin' ? 'GRAND' : 'DELUXE'}</button>
            ))}
          </div>
        </header>

        <main style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '2.5rem', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

            {/* 1. Guest Information */}
            <section style={{ background: colors.card, padding: '2.5rem', borderRadius: '28px', border: `1px solid ${colors.border}`, color: colors.text }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ width: '36px', height: '36px', background: '#3b82f6', color: 'white', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>1</span>
                Guest & Organization
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', background: colors.bg, padding: '0.4rem', borderRadius: '12px', border: `1px solid ${colors.border}` }}>
                    {['General', 'Travel Agent', 'Corporate'].map(t => (
                      <button key={t} onClick={() => setGuestType(t)} style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', border: 'none', fontWeight: 800, cursor: 'pointer', background: guestType === t ? colors.card : 'transparent', color: guestType === t ? '#3b82f6' : colors.textMuted }}>{t}</button>
                    ))}
                  </div>
                </div>
                <div className="group">
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: colors.textMuted, marginBottom: '0.5rem' }}>First Name</label>
                  <input value={firstName} onChange={e => setFirstName(e.target.value)} style={{ width: '100%', padding: '0.9rem', borderRadius: '10px', border: `1.5px solid ${colors.border}`, background: colors.inputBg, color: colors.text }} placeholder="Guest Name" />
                </div>
                <div className="group">
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: colors.textMuted, marginBottom: '0.5rem' }}>Last Name</label>
                  <input value={lastName} onChange={e => setLastName(e.target.value)} style={{ width: '100%', padding: '0.9rem', borderRadius: '10px', border: `1.5px solid ${colors.border}`, background: colors.inputBg, color: colors.text }} />
                </div>
                <div className="group" style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: colors.textMuted, marginBottom: '0.5rem' }}>Company / Agency Name</label>
                  <input value={companyName} onChange={e => setCompanyName(e.target.value)} style={{ width: '100%', padding: '0.9rem', borderRadius: '10px', border: `1.5px solid ${colors.border}`, background: colors.inputBg, color: colors.text }} />
                </div>
                <div className="group">
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: colors.textMuted, marginBottom: '0.5rem' }}>Email ID</label>
                  <input value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '0.9rem', borderRadius: '10px', border: `1.5px solid ${colors.border}`, background: colors.inputBg, color: colors.text }} placeholder="guest@example.com" />
                </div>
                <div className="group">
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: colors.textMuted, marginBottom: '0.5rem' }}>Mobile Number</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select value={countryCode} onChange={e => setCountryCode(e.target.value)} style={{ padding: '0.9rem', borderRadius: '10px', border: `1.5px solid ${colors.border}`, background: colors.inputBg, color: colors.text }}>
                      {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                    </select>
                    <input value={phone} onChange={e => setPhone(e.target.value)} style={{ flex: 1, padding: '0.9rem', borderRadius: '10px', border: `1.5px solid ${colors.border}`, background: colors.inputBg, color: colors.text }} placeholder="Phone Number" />
                  </div>
                </div>
                {docType === 'QUOTATION' && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '1rem', background: theme === 'light' ? '#f0fdf4' : '#064e3b', borderRadius: '12px', border: `1px solid ${theme === 'light' ? '#dcfce7' : '#065f46'}` }}>
                      <input type="checkbox" checked={whatsappConsent} onChange={e => setWhatsappConsent(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                      <span style={{ fontWeight: 700, color: theme === 'light' ? '#166534' : '#34d399', fontSize: '0.85rem' }}>WhatsApp Notifications Enabled</span>
                    </label>
                  </div>
                )}
              </div>
            </section>

            {/* 2. Stay / Validity */}
            <section style={{ background: colors.card, padding: '2.5rem', borderRadius: '28px', border: `1px solid ${colors.border}`, color: colors.text }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ width: '36px', height: '36px', background: '#ea580c', color: 'white', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>2</span>
                {docType === 'QUOTATION' ? 'Stay Details' : 'Contract Validity'}
              </h2>
              {docType === 'QUOTATION' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: colors.textMuted, marginBottom: '0.5rem' }}>Check-in</label>
                      <input
                        type="date"
                        value={checkIn}
                        onChange={e => setCheckIn(e.target.value)}
                        onClick={(e) => (e.target as any).showPicker?.()}
                        min={new Date().toISOString().split('T')[0]}
                        style={{ width: '100%', padding: '0.9rem', borderRadius: '10px', border: `1.5px solid ${colors.border}`, background: colors.inputBg, color: colors.text, cursor: 'pointer' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: colors.textMuted, marginBottom: '0.5rem' }}>Check-out</label>
                      <input
                        type="date"
                        value={checkOut}
                        onChange={e => setCheckOut(e.target.value)}
                        onClick={(e) => (e.target as any).showPicker?.()}
                        min={checkIn || new Date().toISOString().split('T')[0]}
                        style={{ width: '100%', padding: '0.9rem', borderRadius: '10px', border: `1.5px solid ${colors.border}`, background: colors.inputBg, color: colors.text, cursor: 'pointer' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: colors.textMuted, marginBottom: '0.5rem' }}>Stay Status</label>
                      <div style={{
                        padding: '0.9rem',
                        background: (nights === 0 && checkIn === checkOut) ? '#fef3c7' : colors.bg,
                        color: (nights === 0 && checkIn === checkOut) ? '#92400e' : colors.text,
                        borderRadius: '10px',
                        textAlign: 'center',
                        fontWeight: 900,
                        border: (nights === 0 && checkIn === checkOut) ? '2px solid #f59e0b' : `1px solid ${colors.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.3s ease'
                      }}>
                        {nights === 0 && checkIn === checkOut ? '☀️ DAY USE' : `🌙 ${nights} Nights`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div style={{ padding: '1.25rem', background: colors.bg, borderRadius: '15px' }}>
                      <p style={{ margin: '0 0 0.75rem', fontSize: '0.7rem', fontWeight: 800, color: colors.textMuted }}>EARLY CHECK-IN</p>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="time"
                          value={earlyCheckInTime}
                          onChange={e => setEarlyCheckInTime(e.target.value)}
                          onClick={(e) => (e.target as any).showPicker?.()}
                          style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: `1px solid ${colors.border}`, background: colors.inputBg, color: colors.text, cursor: 'pointer' }}
                        />
                        <input type="number" value={earlyCheckInFee} onChange={e => setEarlyCheckInFee(e.target.value)} placeholder="₹" style={{ width: '80px', padding: '0.6rem', borderRadius: '8px', border: `1px solid ${colors.border}`, background: colors.inputBg, color: colors.text }} />
                      </div>
                    </div>
                    <div style={{ padding: '1.25rem', background: colors.bg, borderRadius: '15px' }}>
                      <p style={{ margin: '0 0 0.75rem', fontSize: '0.7rem', fontWeight: 800, color: colors.textMuted }}>LATE CHECK-OUT</p>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="time"
                          value={lateCheckOutTime}
                          onChange={e => setLateCheckOutTime(e.target.value)}
                          onClick={(e) => (e.target as any).showPicker?.()}
                          style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: `1px solid ${colors.border}`, background: colors.inputBg, color: colors.text, cursor: 'pointer' }}
                        />
                        <input type="number" value={lateCheckOutFee} onChange={e => setLateCheckOutFee(e.target.value)} placeholder="₹" style={{ width: '80px', padding: '0.6rem', borderRadius: '8px', border: `1px solid ${colors.border}`, background: colors.inputBg, color: colors.text }} />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: colors.textMuted, marginBottom: '0.5rem' }}>Start Date</label>
                    <input type="date" value={validityStart} onChange={e => setValidityStart(e.target.value)} style={{ width: '100%', padding: '0.9rem', borderRadius: '10px', border: `1.5px solid ${colors.border}`, background: colors.inputBg, color: colors.text }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: colors.textMuted, marginBottom: '0.5rem' }}>End Date</label>
                    <input type="date" value={validityEnd} onChange={e => setValidityEnd(e.target.value)} style={{ width: '100%', padding: '0.9rem', borderRadius: '10px', border: `1.5px solid ${colors.border}`, background: colors.inputBg, color: colors.text }} />
                  </div>
                </div>
              )}
            </section>

            {/* 3. Room Entry */}
            <section style={{ background: colors.card, padding: '2.5rem', borderRadius: '28px', border: `1px solid ${colors.border}`, color: colors.text }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ width: '36px', height: '36px', background: '#7c3aed', color: 'white', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>3</span>
                  Room Categories
                </h2>
                {docType === 'QUOTATION' && (
                  <button onClick={addRoom} style={{ padding: '0.6rem 1.2rem', borderRadius: '100px', border: '2px solid #7c3aed', background: 'transparent', color: '#7c3aed', fontWeight: 800, cursor: 'pointer' }}>+ ADD ROOM</button>
                )}
              </div>

              {docType === 'QUOTATION' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {rooms.map((room, index) => (
                    <div key={room.id} style={{ padding: '2rem', background: colors.bg, borderRadius: '20px', border: `1px solid ${colors.border}`, position: 'relative' }}>
                      <button
                        onClick={() => removeRoom(room.id)}
                        style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.7rem', fontWeight: 900, cursor: 'pointer' }}
                      >
                        ✕ REMOVE
                      </button>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 0.8fr 1.2fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div>
                          <label style={{ fontSize: '0.7rem', fontWeight: 800, color: colors.textMuted }}>Category</label>
                          <select value={room.category} onChange={e => updateRoom(room.id, 'category', e.target.value)} style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: `1px solid ${colors.border}`, background: colors.inputBg, color: colors.text }}>
                            {ROOM_OPTIONS[selectedHotel].map(o => <option key={o}>{o}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.7rem', fontWeight: 800, color: colors.textMuted }}>Qty</label>
                          <input type="number" value={room.count} onChange={e => updateRoom(room.id, 'count', Number(e.target.value))} style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: `1px solid ${colors.border}`, background: colors.inputBg, color: colors.text }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.7rem', fontWeight: 800, color: colors.textMuted }}>Adults</label>
                          <input type="number" value={room.adults} onChange={e => updateRoom(room.id, 'adults', Number(e.target.value))} style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: `1px solid ${colors.border}`, background: colors.inputBg, color: colors.text }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.7rem', fontWeight: 800, color: colors.textMuted }}>Rate (₹)</label>
                          <input type="number" value={room.tariff} onChange={e => updateRoom(room.id, 'tariff', e.target.value)} style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: `2px solid #3b82f6`, background: colors.inputBg, color: colors.text, fontWeight: 900 }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: colors.card, borderRadius: '12px', border: `1px solid ${colors.border}` }}>
                        <div style={{ display: 'flex', gap: '1.5rem' }}>
                          {['breakfast', 'lunch', 'dinner'].map(m => (
                            <label key={m} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 700 }}>
                              <input type="checkbox" checked={(room.meals as any)[m]} onChange={e => updateRoom(room.id, 'meals', { ...room.meals, [m]: e.target.checked })} />
                              {m.charAt(0).toUpperCase() + m.slice(1)}
                            </label>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                          <input type="number" placeholder="Ex. Bed ₹" value={room.extraBed.rate} onChange={e => updateRoom(room.id, 'extraBed', { ...room.extraBed, rate: e.target.value, status: e.target.value ? 'Charged' : 'None' })} style={{ width: '90px', padding: '0.4rem', borderRadius: '6px', border: `1px solid ${colors.border}`, background: colors.inputBg, color: colors.text, fontSize: '0.75rem' }} />
                          <input type="number" placeholder="Ex. Child ₹" value={room.extraChild.rate} onChange={e => updateRoom(room.id, 'extraChild', { ...room.extraChild, rate: e.target.value, status: e.target.value ? 'Charged' : 'None' })} style={{ width: '90px', padding: '0.4rem', borderRadius: '6px', border: `1px solid ${colors.border}`, background: colors.inputBg, color: colors.text, fontSize: '0.75rem' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: colors.bg, color: colors.textMuted, fontSize: '0.7rem' }}>
                        <th style={{ padding: '1rem', textAlign: 'left' }}>CATEGORY</th>
                        <th style={{ padding: '1rem', textAlign: 'center' }}>EP</th>
                        <th style={{ padding: '1rem', textAlign: 'center' }}>CP</th>
                        <th style={{ padding: '1rem', textAlign: 'center' }}>MAP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ROOM_OPTIONS[selectedHotel].map(c => (
                        <tr key={c} style={{ borderBottom: `1px solid ${colors.border}` }}>
                          <td style={{ padding: '1rem', fontWeight: 800 }}>{c}</td>
                          <td style={{ padding: '0.5rem' }}><input value={rateMatrix[c]?.double?.ep} onChange={e => updateMatrixRate(c, 'double', 'ep', e.target.value)} style={{ width: '100%', padding: '0.6rem', border: 'none', background: 'transparent', textAlign: 'center', color: colors.text, fontWeight: 800 }} placeholder="-" /></td>
                          <td style={{ padding: '0.5rem' }}><input value={rateMatrix[c]?.double?.cp} onChange={e => updateMatrixRate(c, 'double', 'cp', e.target.value)} style={{ width: '100%', padding: '0.6rem', border: 'none', background: 'transparent', textAlign: 'center', color: colors.text, fontWeight: 800 }} placeholder="-" /></td>
                          <td style={{ padding: '0.5rem' }}><input value={rateMatrix[c]?.double?.map} onChange={e => updateMatrixRate(c, 'double', 'map', e.target.value)} style={{ width: '100%', padding: '0.6rem', border: 'none', background: 'transparent', textAlign: 'center', color: colors.text, fontWeight: 800 }} placeholder="-" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <aside style={{ position: 'sticky', top: '2rem' }}>
             <div style={{ background: colors.sidebarGradient, color: 'white', borderRadius: '35px', padding: '2.5rem', boxShadow: theme === 'light' ? '0 25px 50px -12px rgba(59, 130, 246, 0.5)' : '0 25px 50px -12px rgba(0, 0, 0, 0.5)', border: theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 900, opacity: 0.9, color: '#ffffff', letterSpacing: '0.15em' }}>INVOICE SUMMARY</p>
                <h3 style={{ margin: '0.5rem 0 2rem', fontSize: '1.75rem', fontWeight: 900, color: '#ffffff' }}>{docType === 'QUOTATION' ? 'Quotation Calculation' : 'Contract Sheet'}</h3>
                
                {docType === 'QUOTATION' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 1, color: '#ffffff', fontWeight: 600 }}>
                        <span>Room Rent ({nights === 0 && checkIn === checkOut ? 'Day Use' : `${nights}N`})</span>
                        <span>{formatCurrency(roomRentTotal)}</span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 1, color: '#ffffff', fontWeight: 600 }}>
                        <span>Extra Bed</span>
                        <span>{formatCurrency(extraBedTotal)}</span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 1, color: '#ffffff', fontWeight: 600 }}>
                        <span>Extra Child</span>
                        <span>{formatCurrency(extraChildTotal)}</span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 1, color: '#ffffff', fontWeight: 600, alignItems: 'center' }}>
                        <span>Discount ({discountPercent}%)</span>
                        <input type="number" value={discountPercent} onChange={e => setDiscountPercent(Number(e.target.value))} style={{ width: '60px', padding: '0.3rem', background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '6px', textAlign: 'center', fontWeight: 800 }} />
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ffffff', fontWeight: 900, fontSize: '1.1rem', background: 'rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '15px' }}>
                        <span>Total (Incl. GST)</span>
                        <span>{formatCurrency(grandTotal)}</span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.9, fontSize: '0.85rem', color: '#ffffff' }}>
                        <span>Included GST (5%)</span>
                        <span>{formatCurrency(cgst + sgst)}</span>
                     </div>
                     <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.2)', margin: '0.5rem 0' }} />
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>Amount to Pay</span>
                        <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#ffffff' }}>{formatCurrency(grandTotal)}</span>
                     </div>
                  </div>
              ) : (
                <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: '0.9rem' }}>Matrix Generation Mode</p>
                  <p style={{ margin: '1rem 0 0', opacity: 0.6, fontSize: '0.8rem', lineHeight: '1.5' }}>This will export a professional rate sheet based on your matrix inputs.</p>
                </div>
              )}

                 <div style={{ marginTop: '3rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <button onClick={() => handleSave(true)} disabled={isSaving || isFinalized} style={{ width: '100%', padding: '1.2rem', borderRadius: '18px', border: '2px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'white', fontWeight: 800, cursor: 'pointer' }}>💾 SAVE DRAFT</button>
                    <button onClick={() => handleSave(false)} disabled={isSaving || isFinalized} style={{ width: '100%', padding: '1.2rem', borderRadius: '18px', border: 'none', background: '#ffffff', color: '#1d4ed8', fontWeight: 900, fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 10px 30px rgba(255, 255, 255, 0.2)' }}>{isFinalized ? '✓ FINALIZED' : '🚀 FINALIZE NOW'}</button>
                 </div>

                 <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem', background: 'rgba(255,255,255,0.1)', borderRadius: '25px', opacity: isFinalized ? 1 : 0.7 }}>
                     <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 900, color: 'white', opacity: 0.8, letterSpacing: '0.1em', textAlign: 'center' }}>{isFinalized ? 'QUOTATION ACTIONS' : 'ACTIONS LOCKED'}</p>
                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <button 
                          onClick={() => {
                            if (!isFinalized) return alert('🔒 Please "FINALIZE NOW" before printing.');
                            handlePrint();
                          }} 
                          disabled={isSaving} 
                          style={{ padding: '1rem', borderRadius: '15px', border: 'none', background: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 800, cursor: isSaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                        >
                          🖨️ PRINT
                        </button>
                        <button 
                          onClick={() => {
                            if (!isFinalized) return alert('🔒 Please "FINALIZE NOW" before exporting.');
                            handleExport();
                          }} 
                          disabled={isSaving} 
                          style={{ padding: '1rem', borderRadius: '15px', border: 'none', background: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 800, cursor: isSaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                        >
                          📊 EXCEL
                        </button>
                      </div>
                      <button 
                        onClick={handleSendEmail} 
                        disabled={isSaving} 
                        style={{ 
                          width: '100%', 
                          padding: '1.2rem', 
                          borderRadius: '15px', 
                          border: 'none', 
                          background: isSaving ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.95)', 
                          color: '#1d4ed8', 
                          fontWeight: 900, 
                          cursor: isSaving ? 'not-allowed' : 'pointer', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: '0.5rem',
                          boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                        }}
                      >
                        {isSaving ? '⏳ SENDING...' : '✉️ SEND TO CLIENT EMAIL'}
                      </button>
                     {!isFinalized && <p style={{ margin: 0, fontSize: '0.65rem', textAlign: 'center', opacity: 0.8, fontWeight: 700 }}>Finalize quote to enable actions</p>}
                  </div>
            </div>
          </aside>
        </main>

        {/* --- HIDDEN PRINT TEMPLATE --- */}
        <div style={{ 
          position: 'absolute', 
          left: '-9999px', 
          top: 0, 
          width: '850px',
          zIndex: -1,
          overflow: 'hidden'
        }}>
          <div ref={printRef} style={{ padding: '40px', background: 'white', color: '#0f172a', width: '850px', fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}>
             <div style={{ borderBottom: '4px solid #1d4ed8', paddingBottom: '30px', marginBottom: '35px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                   <h1 style={{ margin: 0, color: '#1d4ed8', fontSize: '36px', fontWeight: 900, letterSpacing: '-0.02em' }}>{selectedHotel}</h1>
                   <p style={{ margin: '8px 0', fontSize: '14px', color: '#475569', maxWidth: '450px', lineHeight: '1.5' }}>{PROPERTY_DETAILS[selectedHotel].address}</p>
                   <div style={{ marginTop: '12px', fontSize: '13px', color: '#1e293b', display: 'flex', gap: '20px', fontWeight: 600 }}>
                      <span>📞 {PROPERTY_DETAILS[selectedHotel].phone}</span>
                      <span>✉️ {PROPERTY_DETAILS[selectedHotel].email}</span>
                      <span>🌐 {PROPERTY_DETAILS[selectedHotel].web.replace('https://', '')}</span>
                   </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                   <div style={{ background: '#1d4ed8', color: 'white', padding: '8px 15px', borderRadius: '8px', display: 'inline-block', marginBottom: '10px', fontSize: '12px', fontWeight: 900, letterSpacing: '0.1em' }}>OFFICIAL PROPOSAL</div>
                   <h2 style={{ margin: 0, fontSize: '20px', color: '#1e293b', fontWeight: 800 }}>QUOTATION</h2>
                   <p style={{ margin: '5px 0', fontSize: '14px', fontWeight: 700 }}>ID: <span style={{ color: '#1d4ed8' }}>{quotationId}</span></p>
                   <p style={{ margin: '0', fontSize: '13px', color: '#64748b' }}>Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
             </div>

             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '40px' }}>
                <div style={{ background: '#f8fafc', padding: '25px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                   <h3 style={{ margin: '0 0 15px', fontSize: '11px', color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 900 }}>GUEST INFORMATION</h3>
                   <p style={{ margin: '6px 0', fontSize: '15px', color: '#1e293b' }}><strong>Name:</strong> {firstName} {lastName}</p>
                   {email && <p style={{ margin: '6px 0', fontSize: '15px', color: '#1e293b' }}><strong>Email:</strong> {email}</p>}
                   {phone && <p style={{ margin: '6px 0', fontSize: '15px', color: '#1e293b' }}><strong>Phone:</strong> {countryCode} {phone}</p>}
                   {companyName && <p style={{ margin: '6px 0', fontSize: '15px', color: '#1e293b' }}><strong>Organization:</strong> {companyName}</p>}
                </div>
                <div style={{ background: '#f8fafc', padding: '25px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                   <h3 style={{ margin: '0 0 15px', fontSize: '11px', color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 900 }}>STAY DETAILS</h3>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <p style={{ margin: '4px 0', fontSize: '14px' }}><strong>Check-in:</strong><br/>{checkIn}<br/><span style={{fontSize: '11px', color: '#64748b'}}>Time: {earlyCheckInTime}</span></p>
                      <p style={{ margin: '4px 0', fontSize: '14px' }}><strong>Check-out:</strong><br/>{checkOut}<br/><span style={{fontSize: '11px', color: '#64748b'}}>Time: {lateCheckOutTime}</span></p>
                   </div>
                   <p style={{ margin: '12px 0 4px', fontSize: '14px' }}><strong>Duration:</strong> {effectiveNights} Night(s)</p>
                   <p style={{ margin: '4px 0', fontSize: '14px' }}><strong>Occupancy:</strong> {totalAdults} Adults, {totalChildren} Children</p>
                </div>
             </div>

             <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', marginBottom: '40px', border: '1px solid #e2e8f0', borderRadius: '15px', overflow: 'hidden' }}>
                <thead>
                   <tr style={{ background: '#1d4ed8', color: 'white' }}>
                      <th style={{ padding: '15px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 900 }}>ROOM CATEGORY & PLAN</th>
                      <th style={{ padding: '15px', textAlign: 'center', fontSize: '12px', fontWeight: 900 }}>QTY</th>
                      <th style={{ padding: '15px', textAlign: 'center', fontSize: '12px', fontWeight: 900 }}>RATE</th>
                      <th style={{ padding: '15px 20px', textAlign: 'right', fontSize: '12px', fontWeight: 900 }}>TOTAL</th>
                   </tr>
                </thead>
                <tbody>
                   {rooms.map((r, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                         <td style={{ padding: '20px', borderBottom: '1px solid #e2e8f0' }}>
                            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '15px' }}>{r.category}</div>
                            <div style={{ fontSize: '12px', color: '#1d4ed8', marginTop: '6px', fontWeight: 700, textTransform: 'uppercase' }}>
                               {getMealPlanCode(r.meals)}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                               Occupancy: {r.adults} Adults, {r.children} Children
                            </div>
                         </td>
                         <td style={{ padding: '20px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontSize: '15px', fontWeight: 600 }}>{r.count}</td>
                         <td style={{ padding: '20px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontSize: '15px' }}>{formatCurrency(Number(r.tariff))}</td>
                         <td style={{ padding: '20px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontSize: '15px', fontWeight: 800, color: '#1d4ed8' }}>{formatCurrency(Number(r.tariff) * r.count * effectiveNights)}</td>
                      </tr>
                   ))}
                </tbody>
             </table>

             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: '400px' }}>
                   <div style={{ background: '#f0f9ff', padding: '25px', borderRadius: '20px', border: '1px solid #bae6fd' }}>
                      <h3 style={{ margin: '0 0 15px', fontSize: '11px', color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 900 }}>PAYMENT INFORMATION</h3>
                      <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>Beneficiary:</strong> {BANK_DETAILS[selectedHotel].beneficiary}</p>
                      <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>Bank:</strong> {BANK_DETAILS[selectedHotel].bank}</p>
                      <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>Account No:</strong> {BANK_DETAILS[selectedHotel].accountNo}</p>
                      <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>IFSC Code:</strong> {BANK_DETAILS[selectedHotel].ifsc}</p>
                      <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>GSTIN:</strong> {BANK_DETAILS[selectedHotel].gstin}</p>
                      <div style={{ marginTop: '15px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                         <img src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(BANK_DETAILS[selectedHotel].payLink)}`} style={{ width: '80px', height: '80px', borderRadius: '8px', border: '4px solid white' }} alt="Payment QR" />
                         <p style={{ fontSize: '11px', color: '#0369a1', fontWeight: 600, lineHeight: '1.4' }}>Scan to pay securely via<br/>Official Payment Gateway</p>
                      </div>
                   </div>
                </div>

                <div style={{ width: '350px', background: '#1e293b', padding: '30px', borderRadius: '25px', color: 'white', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '14px', opacity: 0.8 }}>
                      <span>Room Revenue</span>
                      <span>{formatCurrency(roomRentTotal)}</span>
                   </div>
                   {(extraBedTotal > 0 || extraChildTotal > 0) && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '14px', opacity: 0.8 }}>
                         <span>Extra Charges</span>
                         <span>{formatCurrency(extraBedTotal + extraChildTotal)}</span>
                      </div>
                   )}
                   {servicesTotal > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '14px', opacity: 0.8 }}>
                         <span>Add-on Services</span>
                         <span>{formatCurrency(servicesTotal)}</span>
                      </div>
                   )}
                   {discountPercent > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '14px', color: '#fb7185', fontWeight: 700 }}>
                         <span>Discount ({discountPercent}%)</span>
                         <span>-{formatCurrency(discountAmount)}</span>
                      </div>
                   )}
                   <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '20px', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '22px', color: '#3b82f6' }}>
                      <span>Grand Total</span>
                      <span>{formatCurrency(grandTotal)}</span>
                   </div>
                   <p style={{ fontSize: '11px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', marginTop: '10px' }}>Inclusive of all taxes & 5% GST</p>
                </div>
             </div>

             <div style={{ marginTop: '60px', textAlign: 'center' }}>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Thank you for your business. We look forward to seeing you!</p>
                <p style={{ fontSize: '10px', color: '#cbd5e1', marginTop: '10px' }}>Generated via Godwin ERP Logistics System • {new Date().toLocaleString()}</p>
             </div>
          </div>
        </div>

        {/* --- SETTINGS MODAL --- */}
        {isSettingsOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }}>
            <div style={{ background: colors.card, width: '100%', maxWidth: '500px', borderRadius: '30px', padding: '2.5rem', border: `1px solid ${colors.border}`, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                  <h2 style={{ margin: 0, color: colors.text, fontSize: '1.5rem', fontWeight: 900 }}>📧 Email & SMTP Settings</h2>
                  <button onClick={() => setIsSettingsOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: colors.textMuted }}>✕</button>
               </div>
               
               <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: colors.textMuted, marginBottom: '0.5rem' }}>SMTP HOST</label>
                    <input value={smtpSettings.host} onChange={e => setSmtpSettings({...smtpSettings, host: e.target.value})} style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: `1.5px solid ${colors.border}`, background: colors.inputBg, color: colors.text }} placeholder="e.g. smtp.gmail.com" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: colors.textMuted, marginBottom: '0.5rem' }}>PORT</label>
                      <input value={smtpSettings.port} onChange={e => setSmtpSettings({...smtpSettings, port: e.target.value})} style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: `1.5px solid ${colors.border}`, background: colors.inputBg, color: colors.text }} placeholder="465 or 587" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: colors.textMuted, marginBottom: '0.5rem' }}>SENDER NAME</label>
                      <input value={smtpSettings.fromName} onChange={e => setSmtpSettings({...smtpSettings, fromName: e.target.value})} style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: `1.5px solid ${colors.border}`, background: colors.inputBg, color: colors.text }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: colors.textMuted, marginBottom: '0.5rem' }}>SMTP USER (EMAIL)</label>
                    <input value={smtpSettings.user} onChange={e => setSmtpSettings({...smtpSettings, user: e.target.value})} style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: `1.5px solid ${colors.border}`, background: colors.inputBg, color: colors.text }} placeholder="your-email@example.com" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: colors.textMuted, marginBottom: '0.5rem' }}>SMTP PASSWORD / APP PASSWORD</label>
                    <input type="password" value={smtpSettings.pass} onChange={e => setSmtpSettings({...smtpSettings, pass: e.target.value})} style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: `1.5px solid ${colors.border}`, background: colors.inputBg, color: colors.text }} />
                  </div>
                  
                  <button 
                    onClick={() => {
                      localStorage.setItem('GODWIN_SMTP', JSON.stringify(smtpSettings));
                      setIsSettingsOpen(false);
                      alert('✅ SMTP Settings Saved!');
                    }}
                    style={{ marginTop: '1rem', width: '100%', padding: '1.2rem', borderRadius: '15px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 900, cursor: 'pointer' }}
                  >
                    💾 SAVE CONFIGURATION
                  </button>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: colors.textMuted, textAlign: 'center' }}>Note: Settings are stored locally in this browser.</p>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
