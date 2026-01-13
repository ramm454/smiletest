'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart, Trash2, Plus, Minus,
  Truck, CreditCard, Shield, ArrowRight,
  Package, RefreshCw, Tag, ChevronLeft
} from 'lucide-react';
import Link from 'next/link';

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  totalPrice: number;
  image: string;
  stockQuantity: number;
  variant?: {
    option1?: string;
    option2?: string;
    option3?: string;
  };
}

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [shippingMethods, setShippingMethods] = useState([]);
  const [selectedShipping, setSelectedShipping] = useState<any>(null);

  useEffect(() => {
    fetchCart();
    fetchShippingMethods();
  }, []);

  const fetchCart = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/shop/cart');
      const data = await response.json();
      setCart(data.items || []);
    } catch (error) {
      console.error('Error fetching cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchShippingMethods = async () => {
    try {
      // Mock shipping methods
      setShippingMethods([
        {
          id: 'standard',
          name: 'Standard Shipping',
          price: 9.99,
          deliveryDays: '5-7 business days',
        },
        {
          id: 'express',
          name: 'Express Shipping',
          price: 19.99,
          deliveryDays: '2-3 business days',
        },
        {
          id: 'overnight',
          name: 'Overnight Shipping',
          price: 29.99,
          deliveryDays: '1 business day',
        },
      ]);
      setSelectedShipping({
        id: 'standard',
        name: 'Standard Shipping',
        price: 9.99,
        deliveryDays: '5-7 business days',
      });
    } catch (error) {
      console.error('Error fetching shipping methods:', error);
    }
  };

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    try {
      const response = await fetch(`/api/shop/cart/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: newQuantity }),
      });
      
      if (response.ok) {
        fetchCart();
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      const response = await fetch(`/api/shop/cart/${itemId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        fetchCart();
      }
    } catch (error) {
      console.error('Error removing item:', error);
    }
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    
    try {
      const response = await fetch('/api/shop/cart/coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setAppliedCoupon(data.coupon);
        fetchCart();
        alert('Coupon applied successfully!');
      } else {
        alert('Invalid coupon code');
      }
    } catch (error) {
      console.error('Error applying coupon:', error);
      alert('Failed to apply coupon');
    }
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
    const shipping = selectedShipping?.price || 0;
    const tax = (subtotal + shipping) * 0.1; // 10% tax
    const discount = appliedCoupon?.discountValue || 0;
    const total = subtotal + shipping + tax - discount;
    
    return { subtotal, shipping, tax, discount, total };
  };

  const totals = calculateTotals();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href="/shop" className="flex items-center text-purple-600 hover:text-purple-800">
            <ChevronLeft size={20} className="mr-1" />
            Continue Shopping
          </Link>
          <h1 className="text-3xl font-bold text-gray-800 mt-4">Your Shopping Cart</h1>
          <p className="text-gray-600">Review your items and proceed to checkout</p>
        </div>

        {cart.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <ShoppingCart size={64} className="mx-auto text-gray-400 mb-4" />
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">Your cart is empty</h2>
            <p className="text-gray-600 mb-6">Add some products to get started</p>
            <Link
              href="/shop"
              className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
            >
              <ShoppingCart size={20} className="mr-2" />
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Cart Items ({cart.length})</h2>
                  <button
                    onClick={() => {
                      if (confirm('Clear all items from cart?')) {
                        cart.forEach(item => removeItem(item.id));
                      }
                    }}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    <Trash2 size={16} className="inline mr-1" />
                    Clear Cart
                  </button>
                </div>

                <div className="space-y-4">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center p-4 border border-gray-200 rounded-lg">
                      {/* Product Image */}
                      <div className="w-20 h-20 rounded-lg overflow-hidden mr-4">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Product Details */}
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-gray-800">{item.name}</h3>
                            {item.variant && (
                              <p className="text-sm text-gray-600 mt-1">
                                {Object.values(item.variant).filter(v => v).join(', ')}
                              </p>
                            )}
                          </div>
                          <span className="font-bold text-gray-800">${item.totalPrice.toFixed(2)}</span>
                        </div>

                        <div className="flex items-center justify-between mt-4">
                          {/* Quantity Controls */}
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                              className={`p-1 rounded ${
                                item.quantity <= 1
                                  ? 'text-gray-400 cursor-not-allowed'
                                  : 'text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              <Minus size={16} />
                            </button>
                            <span className="w-8 text-center font-medium">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              disabled={item.quantity >= item.stockQuantity}
                              className={`p-1 rounded ${
                                item.quantity >= item.stockQuantity
                                  ? 'text-gray-400 cursor-not-allowed'
                                  : 'text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              <Plus size={16} />
                            </button>
                          </div>

                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Coupon Section */}
                <div className="mt-8 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg">
                  <div className="flex items-center mb-2">
                    <Tag size={20} className="text-purple-600 mr-2" />
                    <h3 className="font-semibold text-gray-800">Have a coupon code?</h3>
                  </div>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      placeholder="Enter coupon code"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                    />
                    <button
                      onClick={applyCoupon}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      Apply
                    </button>
                  </div>
                  {appliedCoupon && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-700">
                        Coupon "{appliedCoupon.code}" applied! Saved ${appliedCoupon.discountValue}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Shipping Methods */}
              <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
                <div className="flex items-center mb-6">
                  <Truck size={24} className="text-gray-600 mr-3" />
                  <h2 className="text-xl font-bold text-gray-800">Shipping Method</h2>
                </div>

                <div className="space-y-3">
                  {shippingMethods.map((method: any) => (
                    <div
                      key={method.id}
                      onClick={() => setSelectedShipping(method)}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedShipping?.id === method.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-800">{method.name}</p>
                          <p className="text-sm text-gray-600">{method.deliveryDays}</p>
                        </div>
                        <div className="flex items-center">
                          <span className="font-bold text-gray-800">${method.price.toFixed(2)}</span>
                          {selectedShipping?.id === method.id && (
                            <div className="ml-3 w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-white"></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-lg p-6 sticky top-8">
                <h2 className="text-xl font-bold text-gray-800 mb-6">Order Summary</h2>

                <div className="space-y-4">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-medium">${totals.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Shipping</span>
                    <span className="font-medium">${totals.shipping.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Tax</span>
                    <span className="font-medium">${totals.tax.toFixed(2)}</span>
                  </div>
                  {appliedCoupon && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span className="font-medium">-${totals.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t pt-4">
                    <div className="flex justify-between text-lg font-bold text-gray-800">
                      <span>Total</span>
                      <span>${totals.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 space-y-4">
                  <button
                    onClick={() => router.push('/shop/checkout')}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 font-medium flex items-center justify-center"
                  >
                    Proceed to Checkout
                    <ArrowRight size={20} className="ml-2" />
                  </button>

                  <div className="flex items-center justify-center text-sm text-gray-600">
                    <Shield size={16} className="mr-2" />
                    <span>Secure checkout · SSL encrypted</span>
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  <div className="flex items-center text-sm text-gray-600">
                    <Package size={16} className="mr-2 text-gray-400" />
                    <span>Free shipping on orders over $50</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <RefreshCw size={16} className="mr-2 text-gray-400" />
                    <span>30-day return policy</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <CreditCard size={16} className="mr-2 text-gray-400" />
                    <span>Multiple payment options</span>
                  </div>
                </div>
              </div>

              {/* Payment Security */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                <div className="flex items-center mb-4">
                  <Shield size={24} className="text-green-600 mr-3" />
                  <h3 className="font-semibold text-gray-800">Payment Security</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Your payment information is encrypted and secure. We never store your full card details.
                </p>
                <div className="flex space-x-4">
                  <div className="w-12 h-8 bg-gray-200 rounded flex items-center justify-center">
                    <span className="text-xs font-bold">VISA</span>
                  </div>
                  <div className="w-12 h-8 bg-gray-200 rounded flex items-center justify-center">
                    <span className="text-xs font-bold">MC</span>
                  </div>
                  <div className="w-12 h-8 bg-gray-200 rounded flex items-center justify-center">
                    <span className="text-xs font-bold">AMEX</span>
                  </div>
                  <div className="w-12 h-8 bg-gray-200 rounded flex items-center justify-center">
                    <span className="text-xs font-bold">PP</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}