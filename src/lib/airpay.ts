import crypto from 'crypto';

export interface AirpayConfig {
  merchantId: string;
  username: string;
  password: string;
  secretKey: string;
}

export interface AirpayPaymentData {
  buyerEmail: string;
  buyerPhone: string;
  buyerFirstName: string;
  buyerLastName: string;
  buyerAddress: string;
  buyerCity: string;
  buyerState: string;
  buyerPinCode: string;
  orderId: string;
  amount: string;
  currency: string;
  isTest: boolean;
}

export function generateAirpayChecksum(data: AirpayPaymentData, config: AirpayConfig) {
  const date = new Date().toISOString().split('T')[0];
  
  // Airpay Checksum Logic: MD5(merchant_id + buyer_email + buyer_phone + order_id + date + secret_key)
  // Note: This order may vary by Airpay API version.
  const rawString = `${config.merchantId}${data.buyerEmail}${data.buyerPhone}${data.orderId}${date}${config.secretKey}`;
  
  return crypto.createHash('md5').update(rawString).digest('hex');
}

export function generateAirpayPrivateKey(config: AirpayConfig) {
  // Common Airpay Private Key formula: SHA256(secret + "@" + username + ":|:" + password)
  const raw = `${config.secretKey}@${config.username}:|:${config.password}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}
