'use client';

import { useState, useEffect } from 'react';
import { CreditCard, Receipt, RefreshCw, Shield, Wallet, IndianRupee, Globe } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import RazorPayCheckout component to avoid SSR issues
const RazorPayCheckout = dynamic(() => import('./RazorPayCheckout'), { 
  ssr: false,
  loading: () => <div className="p-4 text-center">Loading payment...</div>
});

interface PaymentFormProps {
    bookingId: string;
    amount: number;
    currency?: string;
    sessionId?: string;
    onPaymentSuccess: (payment: any) => void;
}

interface Gateway {
    id: string;
    name: string;
    icon: any;
}

interface RazorPayOrderData {
    id: string;
    amount: number;
    currency: string;
    key: string;
    name: string;
    description: string;
    order_id: string;
    prefill?: {
        name?: string;
        email?: string;
        contact?: string;
    };
    theme?: {
        color: string;
    };
}

export default function PaymentForm({ 
    bookingId, 
    amount, 
    currency = 'USD', 
    sessionId,
    onPaymentSuccess 
}: PaymentFormProps) {
    const [paymentMethod, setPaymentMethod] = useState('card');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [availableGateways, setAvailableGateways] = useState<Gateway[]>([]);
    const [selectedGateway, setSelectedGateway] = useState('stripe');
    const [showRazorPayCheckout, setShowRazorPayCheckout] = useState(false);
    const [razorPayOrderData, setRazorPayOrderData] = useState<RazorPayOrderData | null>(null);
    
    // Initialize available gateways based on environment
    useEffect(() => {
        const baseGateways: Gateway[] = [
            { id: 'stripe', name: 'Credit/Debit Card', icon: CreditCard },
            { id: 'paypal', name: 'PayPal', icon: Wallet },
        ];
        
        // Check if RazorPay is available in environment
        const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
        if (razorpayKeyId && razorpayKeyId !== 'undefined') {
            baseGateways.push({ 
                id: 'razorpay', 
                name: 'RazorPay', 
                icon: IndianRupee 
            });
        }
        
        setAvailableGateways(baseGateways);
        
        // Set initial gateway - if RazorPay is available and currency is INR, default to RazorPay
        if (razorpayKeyId && currency === 'INR') {
            setSelectedGateway('razorpay');
            setPaymentMethod('razorpay');
        }
    }, [currency]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Handle RazorPay separately
            if (selectedGateway === 'razorpay') {
                await handleRazorPayPayment();
                return;
            }

            // Handle Stripe/PayPal
            const response = await fetch('/api/payment/create-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookingId,
                    gateway: selectedGateway,
                    amount,
                    currency,
                    paymentMethod,
                    sessionId,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Payment failed');
            }

            const data = await response.json();
            
            // If gateway returns a redirect URL (like PayPal)
            if (data.redirectUrl) {
                window.location.href = data.redirectUrl;
                return;
            }
            
            onPaymentSuccess(data);
        } catch (err: any) {
            setError(err.message || 'Payment failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleRazorPayPayment = async () => {
        setLoading(true);
        
        try {
            // First create order on backend
            const orderResponse = await fetch('/api/payment/create-razorpay-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: amount,
                    currency: currency,
                    bookingId: bookingId,
                    sessionId: sessionId,
                }),
            });
            
            if (!orderResponse.ok) {
                const errorData = await orderResponse.json();
                throw new Error(errorData.message || 'Failed to create order');
            }
            
            const orderData = await orderResponse.json();
            
            // Store order data and show RazorPay checkout
            setRazorPayOrderData(orderData);
            setShowRazorPayCheckout(true);
            
        } catch (err: any) {
            setError(err.message || 'Failed to initialize RazorPay payment');
        } finally {
            setLoading(false);
        }
    };

    const handleRazorPaySuccess = async (response: any) => {
        try {
            // Verify payment on backend
            const verifyResponse = await fetch('/api/payment/verify-razorpay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature,
                    bookingId: bookingId,
                    sessionId: sessionId,
                }),
            });
            
            if (!verifyResponse.ok) {
                const errorData = await verifyResponse.json();
                throw new Error(errorData.message || 'Payment verification failed');
            }
            
            const verification = await verifyResponse.json();
            
            if (verification.success) {
                onPaymentSuccess({
                    id: verification.payment_id,
                    status: 'succeeded',
                    gateway: 'razorpay',
                    amount: amount,
                    currency: currency,
                    metadata: response,
                });
                setShowRazorPayCheckout(false);
            } else {
                setError('Payment verification failed');
                setShowRazorPayCheckout(false);
            }
            
        } catch (err: any) {
            setError(err.message || 'Payment verification error');
            setShowRazorPayCheckout(false);
        }
    };

    const handleGatewayChange = (gatewayId: string) => {
        setSelectedGateway(gatewayId);
        
        // Automatically set payment method based on gateway
        switch (gatewayId) {
            case 'stripe':
                setPaymentMethod('card');
                break;
            case 'paypal':
                setPaymentMethod('paypal');
                break;
            case 'razorpay':
                setPaymentMethod('razorpay');
                break;
            default:
                setPaymentMethod('card');
        }
        
        // Clear any previous errors
        setError('');
    };

    const formatAmount = () => {
        // RazorPay expects amount in paise for INR
        if (selectedGateway === 'razorpay' && currency === 'INR') {
            return amount; // amount should already be in paise
        }
        // Stripe expects amount in cents
        return (amount / 100).toFixed(2);
    };

    return (
        <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Complete Payment</h3>
            
            {/* Amount Display */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Amount</span>
                    <span className="text-2xl font-bold text-gray-800">
                        {currency} {formatAmount()}
                    </span>
                </div>
                {selectedGateway === 'razorpay' && currency === 'INR' && (
                    <p className="text-sm text-gray-500 mt-1">
                        Amount includes all applicable taxes
                    </p>
                )}
            </div>

            <form onSubmit={handleSubmit}>
                {/* Gateway Selection */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                        Select Payment Gateway
                    </label>
                    <div className={`grid gap-3 ${availableGateways.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                        {availableGateways.map((gateway) => {
                            const Icon = gateway.icon;
                            return (
                                <button
                                    type="button"
                                    key={gateway.id}
                                    onClick={() => handleGatewayChange(gateway.id)}
                                    className={`p-4 rounded-lg border flex flex-col items-center justify-center transition-colors ${
                                        selectedGateway === gateway.id
                                            ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20'
                                            : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'
                                    }`}
                                >
                                    <Icon size={24} className="mb-2" />
                                    <span className="text-sm font-medium">{gateway.name}</span>
                                    {gateway.id === 'razorpay' && (
                                        <span className="text-xs text-green-600 mt-1">₹ INR</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Payment Method Selection (only for stripe gateway) */}
                {selectedGateway === 'stripe' && (
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Payment Method
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setPaymentMethod('card')}
                                className={`p-4 rounded-lg border flex flex-col items-center justify-center ${
                                    paymentMethod === 'card'
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-gray-300 hover:border-gray-400'
                                }`}
                            >
                                <CreditCard size={24} className="mb-2" />
                                <span className="text-sm">Credit Card</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentMethod('paypal')}
                                className={`p-4 rounded-lg border flex flex-col items-center justify-center ${
                                    paymentMethod === 'paypal'
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-gray-300 hover:border-gray-400'
                                }`}
                            >
                                <Receipt size={24} className="mb-2" />
                                <span className="text-sm">PayPal</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Card Details (shown only for stripe gateway with card payment) */}
                {selectedGateway === 'stripe' && paymentMethod === 'card' && (
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Card Number
                            </label>
                            <input
                                type="text"
                                placeholder="1234 5678 9012 3456"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                maxLength={19}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Expiry Date
                                </label>
                                <input
                                    type="text"
                                    placeholder="MM/YY"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    CVC
                                </label>
                                <input
                                    type="text"
                                    placeholder="123"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    maxLength={4}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* PayPal Gateway Info */}
                {selectedGateway === 'paypal' && (
                    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center">
                            <Wallet size={20} className="text-yellow-600 mr-3" />
                            <div>
                                <p className="font-medium text-yellow-800">PayPal Payment</p>
                                <p className="text-sm text-yellow-600">
                                    You will be redirected to PayPal to complete your payment securely
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* RazorPay Gateway Info */}
                {selectedGateway === 'razorpay' && (
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center mb-2">
                            <Shield className="h-5 w-5 text-blue-600 mr-2" />
                            <span className="font-medium text-blue-800">RazorPay Secure</span>
                        </div>
                        <p className="text-sm text-blue-600 mb-3">
                            You&apos;ll be redirected to RazorPay&apos;s secure payment page. We support:
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-1 bg-white text-xs rounded border">Credit Cards</span>
                            <span className="px-2 py-1 bg-white text-xs rounded border">Debit Cards</span>
                            <span className="px-2 py-1 bg-white text-xs rounded border">Net Banking</span>
                            <span className="px-2 py-1 bg-white text-xs rounded border">UPI</span>
                            <span className="px-2 py-1 bg-white text-xs rounded border">Wallets</span>
                        </div>
                    </div>
                )}

                {/* Security Note */}
                <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center">
                        <Shield size={20} className="text-green-600 mr-3" />
                        <div>
                            <p className="font-medium text-green-800">Secure Payment</p>
                            <p className="text-sm text-green-600">
                                Your payment is secured with 256-bit SSL encryption
                            </p>
                        </div>
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
                        <p className="font-medium">Payment Error</p>
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center shadow-md hover:shadow-lg"
                >
                    {loading ? (
                        <>
                            <RefreshCw size={20} className="animate-spin mr-2" />
                            Processing...
                        </>
                    ) : (
                        `Pay ${currency} ${formatAmount()} with ${availableGateways.find(g => g.id === selectedGateway)?.name}`
                    )}
                </button>
            </form>

            {/* RazorPay Checkout Modal */}
            {showRazorPayCheckout && razorPayOrderData && (
                <RazorPayCheckout
                    orderData={razorPayOrderData}
                    onSuccess={handleRazorPaySuccess}
                    onError={(err) => {
                        setError(`RazorPay payment failed: ${err.message || 'Unknown error'}`);
                        setShowRazorPayCheckout(false);
                    }}
                    onClose={() => {
                        setShowRazorPayCheckout(false);
                        setError('Payment was cancelled');
                    }}
                />
            )}
        </div>
    );
}