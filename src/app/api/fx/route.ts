import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from') || 'USD';
  const to = searchParams.get('to') || 'INR';

  try {
    // Attempt 1: Frankfurter
    const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`, {
      next: { revalidate: 60 } // Cache for 1 minute
    });
    const data = await res.json();
    
    if (data && data.rates && data.rates[to]) {
      return NextResponse.json({ rate: data.rates[to], source: 'Frankfurter' });
    }

    // Attempt 2: Open ER API (Fallback)
    const altRes = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    const altData = await altRes.json();
    if (altData && altData.rates && altData.rates[to]) {
      return NextResponse.json({ rate: altData.rates[to], source: 'OpenER' });
    }

    return NextResponse.json({ error: 'Rate not found' }, { status: 404 });
  } catch (error) {
    console.error('FX Fetch Error:', error);
    return NextResponse.json({ error: 'Service Unavailable' }, { status: 500 });
  }
}
