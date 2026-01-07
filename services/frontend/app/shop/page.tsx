'use client';

import { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Filter, 
  Star, 
  Heart, 
  ShoppingCart,
  ChevronRight,
  Tag,
  Package,
  Truck,
  Shield,
  ArrowRight
} from 'lucide-react';
import ProductCard from '@/components/shop/ProductCard';
import CategoryFilter from '@/components/shop/CategoryFilter';
import PriceFilter from '@/components/shop/PriceFilter';
import { toast } from 'react-hot-toast';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  images: string[];
  rating: number;
  reviewCount: number;
  stockQuantity: number;
  isFeatured: boolean;
  isBestSeller: boolean;
  isNew: boolean;
  category?: {
    id: string;
    name: string;
  };
}

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: 'all',
    minPrice: 0,
    maxPrice: 1000,
    sortBy: 'featured',
    search: '',
    inStock: false,
    onSale: false,
  });
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [filters]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        ...filters,
        categoryId: filters.category !== 'all' ? filters.category : '',
      });
      
      const response = await fetch(`/api/shop?endpoint=products&${params}`);
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/shop?endpoint=categories');
      const data = await response.json();
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleAddToCart = async (productId: string) => {
    try {
      const response = await fetch('/api/shop?action=add-to-cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      
      if (response.ok) {
        toast.success('Added to cart!');
      } else {
        throw new Error('Failed to add to cart');
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error('Failed to add to cart');
    }
  };

  const handleAddToWishlist = async (productId: string) => {
    try {
      const response = await fetch('/api/shop?action=add-to-wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      
      if (response.ok) {
        toast.success('Added to wishlist!');
      } else {
        throw new Error('Failed to add to wishlist');
      }
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      toast.error('Please login to add to wishlist');
    }
  };

  const sortOptions = [
    { value: 'featured', label: 'Featured' },
    { value: 'newest', label: 'Newest' },
    { value: 'price-low', label: 'Price: Low to High' },
    { value: 'price-high', label: 'Price: High to Low' },
    { value: 'rating', label: 'Highest Rated' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold mb-4">Yoga & Wellness Shop</h1>
            <p className="text-xl text-purple-100 mb-8">
              Discover premium yoga equipment, apparel, and wellness products
            </p>
            
            {/* Search Bar */}
            <div className="relative max-w-2xl">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search products..."
                className="w-full pl-12 pr-4 py-4 rounded-lg text-gray-800"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <div className="lg:w-1/4">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-800">Filters</h2>
                <Filter size={20} className="text-gray-600" />
              </div>

              {/* Categories */}
              <div className="mb-8">
                <h3 className="font-semibold text-gray-700 mb-4">Categories</h3>
                <CategoryFilter
                  categories={categories}
                  selectedCategory={filters.category}
                  onChange={(category) => setFilters({ ...filters, category })}
                />
              </div>

              {/* Price Range */}
              <div className="mb-8">
                <h3 className="font-semibold text-gray-700 mb-4">Price Range</h3>
                <PriceFilter
                  minPrice={filters.minPrice}
                  maxPrice={filters.maxPrice}
                  onChange={(min, max) => setFilters({ ...filters, minPrice: min, maxPrice: max })}
                />
              </div>

              {/* Other Filters */}
              <div className="space-y-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.inStock}
                    onChange={(e) => setFilters({ ...filters, inStock: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span className="ml-2 text-gray-700">In Stock Only</span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.onSale}
                    onChange={(e) => setFilters({ ...filters, onSale: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span className="ml-2 text-gray-700">On Sale</span>
                </label>
              </div>

              <button
                onClick={() => setFilters({
                  category: 'all',
                  minPrice: 0,
                  maxPrice: 1000,
                  sortBy: 'featured',
                  search: '',
                  inStock: false,
                  onSale: false,
                })}
                className="w-full mt-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                Clear All Filters
              </button>
            </div>

            {/* Benefits */}
            <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Why Shop With Us</h3>
              <div className="space-y-4">
                <div className="flex items-center">
                  <Truck size={20} className="text-green-600 mr-3" />
                  <div>
                    <p className="font-medium text-gray-800">Free Shipping</p>
                    <p className="text-sm text-gray-600">On orders over $50</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Package size={20} className="text-blue-600 mr-3" />
                  <div>
                    <p className="font-medium text-gray-800">Easy Returns</p>
                    <p className="text-sm text-gray-600">30-day return policy</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Shield size={20} className="text-purple-600 mr-3" />
                  <div>
                    <p className="font-medium text-gray-800">Secure Payment</p>
                    <p className="text-sm text-gray-600">100% secure & encrypted</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:w-3/4">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">All Products</h2>
                  <p className="text-gray-600">{products.length} products found</p>
                </div>
                
                <div className="flex items-center space-x-4">
                  <select
                    value={filters.sortBy}
                    onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                    className="px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    {sortOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        Sort by: {option.label}
                      </option>
                    ))}
                  </select>
                  
                  <button
                    onClick={() => window.location.href = '/shop/cart'}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <ShoppingCart size={20} />
                    View Cart
                  </button>
                </div>
              </div>
            </div>

            {/* Featured Categories */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[
                { name: 'Yoga Mats', color: 'bg-green-100', count: 24 },
                { name: 'Apparel', color: 'bg-blue-100', count: 36 },
                { name: 'Accessories', color: 'bg-purple-100', count: 18 },
              ].map((category, index) => (
                <div
                  key={index}
                  className={`${category.color} rounded-xl p-6 hover:shadow-lg transition-shadow cursor-pointer`}
                  onClick={() => setFilters({ ...filters, category: category.name.toLowerCase() })}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{category.name}</h3>
                      <p className="text-gray-600">{category.count} products</p>
                    </div>
                    <ArrowRight size={24} className="text-gray-600" />
                  </div>
                </div>
              ))}
            </div>

            {/* Products Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="bg-white rounded-xl shadow p-6 animate-pulse">
                    <div className="h-48 bg-gray-200 rounded-lg mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                <Package size={64} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-2xl font-bold text-gray-800 mb-2">No products found</h3>
                <p className="text-gray-600 mb-6">Try adjusting your filters or search terms</p>
                <button
                  onClick={() => setFilters({
                    ...filters,
                    category: 'all',
                    search: '',
                    inStock: false,
                    onSale: false,
                  })}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={() => handleAddToCart(product.id)}
                    onAddToWishlist={() => handleAddToWishlist(product.id)}
                  />
                ))}
              </div>
            )}

            {/* Newsletter */}
            <div className="mt-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg p-8 text-white">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="text-2xl font-bold mb-2">Stay Updated</h3>
                  <p className="text-blue-100">Get the latest deals and wellness tips</p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Your email address"
                    className="px-4 py-3 rounded-lg text-gray-800 flex-1 min-w-0"
                  />
                  <button className="px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100">
                    Subscribe
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
