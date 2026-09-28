import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const managerId = searchParams.get('managerId');

    const tours = await prisma.quotationTour.findMany({
      include: {
        quotation: true,
        tourPackage: true,
        expense: {
          include: {
            dailyExpenses: true,
          }
        },
      },
      where: managerId ? {
        expense: {
          managerId: managerId,
        }
      } : {},
      orderBy: {
        startDate: 'desc',
      },
    });

    return NextResponse.json(tours);
  } catch (error) {
    console.error('Error fetching operations:', error);
    return NextResponse.json({ error: 'Failed to fetch operations' }, { status: 500 });
  }
}
