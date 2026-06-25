'use client';

import { useEffect, useRef } from 'react';

export default function AirpayRedirect({ data }: { data: any }) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (formRef.current) {
      formRef.current.submit();
    }
  }, [data]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem' }}>
      <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      <h2>Redirecting to Secure Payment Gateway...</h2>
      <p>Please do not refresh the page or click back.</p>

      <form ref={formRef} action={data.airpayUrl} method="POST" style={{ display: 'none' }}>
        <input type="hidden" name="mercid" value={data.merchantId} />
        <input type="hidden" name="orderid" value={data.orderId} />
        <input type="hidden" name="amount" value={data.amount} />
        <input type="hidden" name="currency" value={data.currency} />
        <input type="hidden" name="is_test" value={data.isTest ? '1' : '0'} />
        <input type="hidden" name="checksum" value={data.checksum} />
        <input type="hidden" name="buyerEmail" value={data.buyerEmail} />
        <input type="hidden" name="buyerPhone" value={data.buyerPhone} />
        <input type="hidden" name="buyerFirstName" value={data.buyerFirstName} />
        <input type="hidden" name="buyerLastName" value={data.buyerLastName} />
        <input type="hidden" name="buyerAddress" value={data.buyerAddress} />
        <input type="hidden" name="buyerCity" value={data.buyerCity} />
        <input type="hidden" name="buyerState" value={data.buyerState} />
        <input type="hidden" name="buyerPinCode" value={data.buyerPinCode} />
        {/* Additional hidden fields as required by Airpay */}
      </form>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
