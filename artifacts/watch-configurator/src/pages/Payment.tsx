import React from 'react';
import { useParams } from 'wouter';
import { QRCodeSVG } from 'qrcode.react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { useGetOrder } from '@workspace/api-client-react';

export default function Payment() {
  const params = useParams();
  const orderId = params.orderId;
  const { data: order, isLoading } = useGetOrder(Number(orderId), { query: { enabled: !!orderId } });

  if (isLoading) {
    return <div className="min-h-screen bg-background text-white flex items-center justify-center">Loading...</div>;
  }

  if (!order) {
    return <div className="min-h-screen bg-background text-white flex items-center justify-center">Order not found</div>;
  }

  const paymentLink = `tg://resolve?domain=na_utrah_4_bot&start=pay_${orderId}`;

  return (
    <div className="min-h-[100dvh] bg-background text-white flex items-center justify-center p-4">
      <GlassPanel className="p-8 max-w-md w-full flex flex-col items-center text-center">
        <h1 className="text-3xl font-bold tracking-widest mb-2">ОПЛАТА</h1>
        <p className="text-muted-foreground mb-8">Scan to pay with Telegram Stars</p>

        <div className="bg-white p-4 rounded-xl mb-8">
          <QRCodeSVG value={paymentLink} size={200} />
        </div>

        <div className="text-2xl font-bold text-primary mb-8">
          {order.totalStars} ⭐
        </div>

        <a href={paymentLink} className="w-full">
          <button className="w-full liquid-button inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium h-12 bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30">
            ОПЛАТИТЬ В TELEGRAM
          </button>
        </a>
      </GlassPanel>
    </div>
  );
}