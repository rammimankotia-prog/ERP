import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status, adminRemark, managerReply } = body;

    const tourExpense = await prisma.tourExpense.update({
      where: { id },
      data: {
        status,
        adminRemark,
        managerReply,
      },
    });

    return NextResponse.json(tourExpense);
  } catch (error) {
    console.error('Error updating review:', error);
    return NextResponse.json({ error: 'Failed to update review' }, { status: 500 });
  }
}
