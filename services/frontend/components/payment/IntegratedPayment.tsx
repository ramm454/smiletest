'use client';
import { useState } from 'react';
import { Calendar, ShoppingBag, CreditCard, Package, Users, Shield, Lock, FileText } from 'lucide-react';

interface IntegratedPaymentProps {
    paymentType: 'booking' | 'ecommerce' | 'subscription' | 'donation';
    itemId: string; // booking_id, order_id, subscription_id
    itemDetails: any;
    amount: number;
    currency?: string;
    onSuccess: (payment: any) => void;
    onError: (error: any) => void;
}

export default function IntegratedPayment({ 
    paymentType, 
    itemId, 
    itemDetails, 
    amount, 
    currency = 'USD',
    onSuccess,
    onError 
}: IntegratedPaymentProps) {
    const [loading, setLoading] = useState(false);
    const [selectedGateway, setSelectedGateway] = useState('stripe');
    
    const getPaymentTitle = () => {
        switch (paymentType) {
            case 'booking':
                return `Book ${itemDetails.className || 'Yoga Class'}`;
            case 'ecommerce':
                return `Checkout - ${itemDetails.items?.length || 0} items`;
            case 'subscription':
                return `Subscribe to ${itemDetails.planName || 'Plan'}`;
            case 'donation':
                return 'Make a Donation';
            default:
                return 'Complete Payment';
        }
    };
    
    const getPaymentDescription = () => {
        switch (paymentType) {
            case 'booking':
                return `Secure your spot for ${itemDetails.dateTime ? new Date(itemDetails.dateTime).toLocaleDateString() : 'the class'}`;
            case 'ecommerce':
                return 'Complete your purchase to receive your yoga products';
            case 'subscription':
                return 'Get unlimited access to all classes and features';
            default:
                return 'Complete your payment securely';
        }
    };
    
    const getPaymentIcon = () => {
        switch (paymentType) {
            case 'booking': return Calendar;
            case 'ecommerce': return ShoppingBag;
            case 'subscription': return CreditCard;
            default: return Package;
        }
    };
    
    const handlePayment = async () => {
        setLoading(true);
        
        try {
            const response = await fetch('/api/payment/create-integrated', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: paymentType,
                    itemId: itemId,
                    gateway: selectedGateway,
                    amount: amount,
                    currency: currency,
                    metadata: {
                        ...itemDetails,
                        payment_type: paymentType,
                    }
                }),
            });
            
            if (!response.ok) throw new Error('Payment failed');
            
            const paymentData = await response.json();
            
            // Handle different gateway responses
            if (selectedGateway === 'razorpay' && paymentData.order_id) {
                // Open RazorPay checkout
                // ... RazorPay integration code ...
            } else if (paymentData.client_secret) {
                // Stripe payment
                // ... Stripe integration code ...
            }
            
            onSuccess(paymentData);
            
        } catch (error) {
            onError(error);
        } finally {
            setLoading(false);
        }
    };
    
    const Icon = getPaymentIcon();
    
    return (
        <div className="bg-white rounded-xl shadow-lg p-6">
            {/* Payment Header */}
            <div className="flex items-center mb-6">
                <div className="p-3 bg-blue-100 rounded-lg mr-4">
                    <Icon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-gray-800">{getPaymentTitle()}</h3>
                    <p className="text-gray-600">{getPaymentDescription()}</p>
                </div>
            </div>
            
            {/* Payment Details */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-gray-500">Payment For</p>
                        <p className="font-medium capitalize">{paymentType}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Reference</p>
                        <p className="font-medium">{itemId.substring(0, 8)}...</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Amount</p>
                        <p className="text-2xl font-bold text-gray-800">
                            {currency} {(amount / 100).toFixed(2)}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Status</p>
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                            Pending Payment
                        </span>
                    </div>
                </div>
            </div>
            
            {/* Payment Method Selection */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                    Select Payment Method
                </label>
                <div className="grid grid-cols-3 gap-3">
                    {['stripe', 'paypal', 'razorpay']
                        .filter(gateway => {
                            // Show RazorPay primarily for INR payments
                            if (gateway === 'razorpay' && currency !== 'INR') {
                                return false;
                            }
                            return true;
                        })
                        .map(gateway => (
                        <button
                            key={gateway}
                            type="button"
                            onClick={() => setSelectedGateway(gateway)}
                            className={`p-4 rounded-lg border flex flex-col items-center justify-center ${
                                selectedGateway === gateway
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-gray-300 hover:border-gray-400'
                            }`}
                        >
                            {gateway === 'stripe' && <CreditCard className="h-6 w-6 mb-2" />}
                            {gateway === 'paypal' && <ShoppingBag className="h-6 w-6 mb-2" />}
                            {gateway === 'razorpay' && <div className="text-lg mb-2">₹</div>}
                            <span className="text-sm capitalize">{gateway}</span>
                        </button>
                    ))}
                </div>
            </div>
            
            {/* Payment Action */}
            <button
                onClick={handlePayment}
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-bold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all"
            >
                {loading ? 'Processing...' : `Pay ${currency} ${(amount / 100).toFixed(2)}`}
            </button>
            
            {/* Service-specific notes */}
            {paymentType === 'booking' && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-700">
                        ✅ Your spot will be reserved immediately after payment
                    </p>
                </div>
            )}
            
            {paymentType === 'ecommerce' && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-700">
                        📦 Digital products: Immediate access • Physical: 3-5 business days
                    </p>
                </div>
            )}
            
            {/* Secure Payment Disclaimer */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-start">
                    <Shield className="h-5 w-5 text-gray-500 mt-0.5 mr-3" />
                    <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">
                            Secure Payment Processing
                        </p>
                        <p className="text-xs text-gray-600">
                            Payments are processed securely by {selectedGateway.toUpperCase()}. 
                            We never store your card details. By proceeding, you agree to our 
                            <a href="/terms/payment" className="text-blue-600 hover:underline ml-1">
                                Payment Terms
                            </a>.
                        </p>
                        <div className="mt-2 text-xs text-gray-500">
                            <span className="inline-flex items-center mr-3">
                                <Lock className="h-3 w-3 mr-1" /> PCI-DSS Compliant
                            </span>
                            <span className="inline-flex items-center mr-3">
                                <Shield className="h-3 w-3 mr-1" /> SSL Encrypted
                            </span>
                            <span className="inline-flex items-center">
                                <FileText className="h-3 w-3 mr-1" /> Invoice Provided
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}