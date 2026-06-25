import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const quotationTourId = searchParams.get('quotationTourId');

  if (!quotationTourId) {
    return NextResponse.json({ error: 'QuotationTourId is required' }, { status: 400 });
  }

  const expense = await prisma.tourExpense.findUnique({
    where: { quotationTourId },
    include: { dailyExpenses: { orderBy: { dayNumber: 'asc' } } },
  });

  return NextResponse.json(expense);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { quotationTourId, managerId, dailyExpenses } = body;

    const tourExpense = await prisma.tourExpense.upsert({
      where: { quotationTourId },
      update: {
        status: 'SUBMITTED',
        dailyExpenses: {
          deleteMany: {},
          create: dailyExpenses.map((day: any) => ({
            dayNumber: day.dayNumber,
            hotelExpense: parseFloat(day.hotelExpense) || 0,
            fleetExpense: parseFloat(day.fleetExpense) || 0,
            monumentExpense: parseFloat(day.monumentExpense) || 0,
            otherExpense: parseFloat(day.otherExpense) || 0,
            description: day.description,
          })),
        },
      },
      create: {
        quotationTourId,
        managerId,
        status: 'SUBMITTED',
        dailyExpenses: {
          create: dailyExpenses.map((day: any) => ({
            dayNumber: day.dayNumber,
            hotelExpense: parseFloat(day.hotelExpense) || 0,
            fleetExpense: parseFloat(day.fleetExpense) || 0,
            monumentExpense: parseFloat(day.monumentExpense) || 0,
            otherExpense: parseFloat(day.otherExpense) || 0,
            description: day.description,
          })),
        },
      },
    });

    return NextResponse.json(tourExpense);
  } catch (error) {
    console.error('Error saving expenses:', error);
    return NextResponse.json({ error: 'Failed to save expenses' }, { status: 500 });
  }
}
