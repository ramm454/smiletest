'use client';
import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader } from 'lucide-react';

interface RazorPayCheckoutProps {
    orderData: any;
    onSuccess: (response: any) => void;
    onError: (error: any) => void;
    onClose: () => void;
}

declare global {
    interface Window {
        Razorpay: any;
    }
}

export default function RazorPayCheckout({ orderData, onSuccess, onError, onClose }: RazorPayCheckoutProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadRazorPayScript();
    }, []);

    const loadRazorPayScript = () => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = initializeRazorPay;
        script.onerror = () => {
            setError('Failed to load RazorPay script');
            setLoading(false);
        };
        document.body.appendChild(script);
    };

    const initializeRazorPay = () => {
        if (!window.Razorpay) {
            setError('RazorPay not available');
            setLoading(false);
            return;
        }

        setLoading(false);
        openRazorPayCheckout();
    };

    const openRazorPayCheckout = () => {
        const options = {
            key: orderData.key || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
            amount: orderData.amount,
            currency: orderData.currency,
            name: orderData.name || 'Yoga Spa Platform',
            description: orderData.description || 'Booking Payment',
            order_id: orderData.order_id,
            handler: function (response: any) {
                onSuccess(response);
            },
            prefill: {
                name: orderData.prefill?.name || '',
                email: orderData.prefill?.email || '',
                contact: orderData.prefill?.contact || '',
            },
            notes: orderData.notes || {},
            theme: {
                color: orderData.theme?.color || '#3B82F6',
            },
            modal: {
                ondismiss: function () {
                    onClose();
                },
                escape: true,
                handleback: true,
            },
            config: {
                display: {
                    blocks: {
                        banks: {
                            name: 'Pay using Net Banking',
                            instruments: [
                                {
                                    method: 'netbanking',
                                    banks: [
                                        'HDFC',
                                        'ICICI',
                                        'AXIS',
                                        'SBI',
                                        'KOTAK',
                                        'YESBANK',
                                    ],
                                },
                            ],
                        },
                        upi: {
                            name: 'Pay using UPI',
                            instruments: [
                                {
                                    method: 'upi',
                                    flows: ['collect', 'intent', 'qr'],
                                },
                            ],
                        },
                        card: {
                            name: 'Pay using Debit/Credit Cards',
                            instruments: [
                                {
                                    method: 'card',
                                    networks: ['visa', 'mastercard', 'rupay'],
                                },
                            ],
                        },
                        wallet: {
                            name: 'Pay using Wallets',
                            instruments: [
                                {
                                    method: 'wallet',
                                    wallets: ['payzapp', 'phonepe', 'freecharge', 'olamoney'],
                                },
                            ],
                        },
                    },
                    sequence: ['block.banks', 'block.upi', 'block.card', 'block.wallet'],
                    preferences: {
                        show_default_blocks: true,
                    },
                },
            },
            method: {
                netbanking: true,
                card: true,
                upi: true,
                wallet: true,
            },
        };

        try {
            const razorpay = new window.Razorpay(options);
            razorpay.open();
        } catch (err) {
            setError('Failed to initialize RazorPay');
            onError(err);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-8">
                <Loader className="h-8 w-8 animate-spin text-blue-600 mb-4" />
                <p className="text-gray-600">Loading RazorPay...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-8">
                <XCircle className="h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Error</h3>
                <p className="text-gray-600 text-center mb-4">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center p-8">
            <div className="animate-pulse mb-4">
                <div className="h-3 w-32 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 w-24 bg-gray-200 rounded"></div>
            </div>
            <p className="text-gray-600 text-sm">Opening RazorPay checkout...</p>
            <p className="text-gray-500 text-xs mt-2">
                If it doesn't open automatically, check your popup blocker
            </p>
        </div>
    );
}