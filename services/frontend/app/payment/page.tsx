'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Clock, CreditCard } from 'lucide-react';
import PaymentForm from '@/components/payment/PaymentForm';

export default function PaymentPage() {
    const searchParams = useSearchParams();
    const bookingId = searchParams.get('bookingId');
    const amount = parseInt(searchParams.get('amount') || '2500');
    const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed'>('pending');
    const [paymentDetails, setPaymentDetails] = useState<any>(null);

    const handlePaymentSuccess = (payment: any) => {
        setPaymentStatus('success');
        setPaymentDetails(payment);
        // Redirect to booking confirmation after 3 seconds
        setTimeout(() => {
            window.location.href = `/booking/confirmation?paymentId=${payment.payment_id}`;
        }, 3000);
    };

    if (!bookingId) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <XCircle size={64} className="mx-auto text-red-500 mb-4" />
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Invalid Booking</h1>
                    <p className="text-gray-600">Please start the booking process again.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12">
            <div className="container mx-auto px-4">
                <div className="max-w-2xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">Complete Your Payment</h1>
                        <p className="text-gray-600">Secure payment powered by Stripe</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Left Column - Payment Form */}
                        <div className="md:col-span-2">
                            <PaymentForm
                                bookingId={bookingId}
                                amount={amount}
                                onPaymentSuccess={handlePaymentSuccess}
                            />
                        </div>

                        {/* Right Column - Order Summary */}
                        <div className="space-y-6">
                            {/* Order Summary */}
                            <div className="bg-white rounded-xl shadow-lg p-6">
                                <h3 className="font-bold text-gray-800 mb-4">Order Summary</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Booking ID</span>
                                        <span className="font-medium">{bookingId}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Subtotal</span>
                                        <span className="font-medium">${(amount / 100).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Tax</span>
                                        <span className="font-medium">$0.00</span>
                                    </div>
                                    <div className="border-t pt-3">
                                        <div className="flex justify-between text-lg font-bold">
                                            <span>Total</span>
                                            <span>${(amount / 100).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Status */}
                            <div className="bg-white rounded-xl shadow-lg p-6">
                                <h3 className="font-bold text-gray-800 mb-4">Payment Status</h3>
                                <div className="space-y-4">
                                    <div className={`flex items-center p-3 rounded-lg ${
                                        paymentStatus === 'pending' ? 'bg-yellow-50' :
                                        paymentStatus === 'success' ? 'bg-green-50' :
                                        'bg-red-50'
                                    }`}>
                                        {paymentStatus === 'pending' && <Clock className="text-yellow-600 mr-3" />}
                                        {paymentStatus === 'success' && <CheckCircle className="text-green-600 mr-3" />}
                                        {paymentStatus === 'failed' && <XCircle className="text-red-600 mr-3" />}
                                        <div>
                                            <p className="font-medium capitalize">{paymentStatus}</p>
                                            <p className="text-sm text-gray-600">
                                                {paymentStatus === 'pending' && 'Awaiting payment...'}
                                                {paymentStatus === 'success' && 'Payment successful!'}
                                                {paymentStatus === 'failed' && 'Payment failed'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Security Badge */}
                            <div className="text-center">
                                <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
                                    <CreditCard size={16} />
                                    <span>PCI DSS Compliant</span>
                                    <span>•</span>
                                    <span>SSL Secured</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}