import { NextResponse } from 'next/server';
import { generateAirpayChecksum, AirpayPaymentData } from '@/lib/airpay';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, orderId, guestInfo } = body;

    const config = {
      merchantId: process.env.AIRPAY_MERCHANT_ID || 'sandbox_mid',
      username: process.env.AIRPAY_USERNAME || 'sandbox_user',
      password: process.env.AIRPAY_PASSWORD || 'sandbox_pass',
      secretKey: process.env.AIRPAY_SECRET_KEY || 'sandbox_secret',
    };

    const paymentData: AirpayPaymentData = {
      buyerEmail: guestInfo.email,
      buyerPhone: guestInfo.phone,
      buyerFirstName: guestInfo.firstName,
      buyerLastName: guestInfo.lastName,
      buyerAddress: guestInfo.address || 'India',
      buyerCity: guestInfo.city || 'Delhi',
      buyerState: guestInfo.state || 'Delhi',
      buyerPinCode: guestInfo.pinCode || '110001',
      orderId: orderId,
      amount: amount.toString(),
      currency: 'INR',
      isTest: true,
    };

    const checksum = generateAirpayChecksum(paymentData, config);

    // Return the data needed for the Airpay hidden form
    return NextResponse.json({
      success: true,
      paymentData: {
        ...paymentData,
        merchantId: config.merchantId,
        checksum,
        airpayUrl: 'https://payments.airpay.co.in/pay/index.php' // Sandbox or Production URL
      }
    });
  } catch (error) {
    console.error('Payment Error:', error);
    return NextResponse.json({ success: false, error: 'Payment initialization failed' }, { status: 500 });
  }
}
