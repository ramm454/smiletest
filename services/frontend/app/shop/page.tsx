'use client';

import { useState, useEffect } from 'react';
import { 
  ShoppingBag, Filter, Search, Star, 
  ShoppingCart, Heart, TrendingUp, 
  Package, Truck, CreditCard, 
  RefreshCw, CheckCircle, AlertCircle,
  ChevronRight, Grid, List
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
  category: string;
  tags: string[];
  isFeatured: boolean;
  isBestSeller: boolean;
  isNew: boolean;
}

export default function ShopPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    category: 'all',
    priceRange: [0, 1000],
    inStock: false,
    sortBy: 'featured',
    view: 'grid',
  });
  const [cart, setCart] = useState({ itemCount: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchCart();
  }, [filters]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (filters.category !== 'all') query.append('category', filters.category);
      query.append('minPrice', filters.priceRange[0].toString());
      query.append('maxPrice', filters.priceRange[1].toString());
      if (filters.inStock) query.append('inStock', 'true');
      query.append('sortBy', filters.sortBy);

      const response = await fetch(`/api/shop/products?${query}`);
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/shop/categories');
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchCart = async () => {
    try {
      const response = await fetch('/api/shop/cart');
      const data = await response.json();
      setCart({
        itemCount: data.itemCount || 0,
        total: data.totalAmount || 0,
      });
    } catch (error) {
      console.error('Error fetching cart:', error);
    }
  };

  const addToCart = async (productId: string, quantity: number = 1) => {
    try {
      const response = await fetch('/api/shop/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity }),
      });
      
      if (response.ok) {
        fetchCart();
        alert('Added to cart!');
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  const addToWishlist = async (productId: string) => {
    try {
      const response = await fetch('/api/shop/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      
      if (response.ok) {
        alert('Added to wishlist!');
      }
    } catch (error) {
      console.error('Error adding to wishlist:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold mb-4">Yoga & Wellness Store</h1>
            <p className="text-xl text-purple-100 mb-8">
              Premium yoga mats, clothing, accessories, and wellness products
            </p>
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search products..."
                  className="w-full pl-12 pr-4 py-3 rounded-lg text-gray-800"
                />
              </div>
              <button 
                onClick={() => router.push('/shop/cart')}
                className="relative px-6 py-3 bg-white text-purple-600 rounded-lg font-semibold hover:bg-gray-100"
              >
                <ShoppingCart size={20} className="inline mr-2" />
                Cart ({cart.itemCount})
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <div className="lg:w-1/4">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-800">Filters</h2>
                <Filter size={20} className="text-gray-600" />
              </div>

              {/* Categories */}
              <div className="mb-8">
                <h3 className="font-semibold text-gray-700 mb-4">Categories</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setFilters({ ...filters, category: 'all' })}
                    className={`flex justify-between items-center w-full p-3 rounded-lg text-left ${
                      filters.category === 'all'
                        ? 'bg-purple-50 text-purple-600 border border-purple-200'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <span>All Products</span>
                    <span className="text-sm text-gray-500">48</span>
                  </button>
                  {categories.map((cat: any) => (
                    <button
                      key={cat.id}
                      onClick={() => setFilters({ ...filters, category: cat.id })}
                      className={`flex justify-between items-center w-full p-3 rounded-lg text-left ${
                        filters.category === cat.id
                          ? 'bg-purple-50 text-purple-600 border border-purple-200'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <span>{cat.name}</span>
                      <span className="text-sm text-gray-500">{cat.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Range */}
              <div className="mb-8">
                <h3 className="font-semibold text-gray-700 mb-4">Price Range</h3>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>${filters.priceRange[0]}</span>
                    <span>${filters.priceRange[1]}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    step="10"
                    value={filters.priceRange[1]}
                    onChange={(e) => setFilters({
                      ...filters,
                      priceRange: [filters.priceRange[0], parseInt(e.target.value)]
                    })}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Stock Filter */}
              <div className="mb-8">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="inStock"
                    checked={filters.inStock}
                    onChange={(e) => setFilters({ ...filters, inStock: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <label htmlFor="inStock" className="ml-2 text-gray-700">
                    In Stock Only
                  </label>
                </div>
              </div>

              <button
                onClick={() => setFilters({
                  category: 'all',
                  priceRange: [0, 1000],
                  inStock: false,
                  sortBy: 'featured',
                  view: 'grid',
                })}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                Clear All Filters
              </button>
            </div>

            {/* Quick Stats */}
            <div className="mt-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl shadow-lg p-6 text-white">
              <div className="text-center">
                <ShoppingBag size={32} className="mx-auto mb-4" />
                <h3 className="font-bold text-lg mb-2">Shop Stats</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Products</span>
                    <span className="font-bold">48</span>
                  </div>
                  <div className="flex justify-between">
                    <span>New Arrivals</span>
                    <span className="font-bold">12</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Best Sellers</span>
                    <span className="font-bold">8</span>
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
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setFilters({ ...filters, view: 'grid' })}
                      className={`p-2 rounded-lg ${
                        filters.view === 'grid'
                          ? 'bg-purple-100 text-purple-600'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Grid size={20} />
                    </button>
                    <button
                      onClick={() => setFilters({ ...filters, view: 'list' })}
                      className={`p-2 rounded-lg ${
                        filters.view === 'list'
                          ? 'bg-purple-100 text-purple-600'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <List size={20} />
                    </button>
                  </div>
                  <select
                    value={filters.sortBy}
                    onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                    className="px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="featured">Featured</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="newest">Newest</option>
                    <option value="rating">Best Rating</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Products Grid */}
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading products...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white rounded-xl shadow p-8 text-center">
                <Package size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-600 mb-4">Try adjusting your filters</p>
                <button
                  onClick={() => setFilters({
                    category: 'all',
                    priceRange: [0, 1000],
                    inStock: false,
                    sortBy: 'featured',
                    view: 'grid',
                  })}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className={`grid gap-6 ${
                filters.view === 'grid' 
                  ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
                  : 'grid-cols-1'
              }`}>
                {products.map((product) => (
                  <div
                    key={product.id}
                    className={`bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow ${
                      filters.view === 'list' ? 'flex' : ''
                    }`}
                  >
                    {/* Product Image */}
                    <div className={`${filters.view === 'list' ? 'w-1/3' : 'h-48'} relative overflow-hidden`}>
                      <img
                        src={product.images[0] || '/images/placeholder.jpg'}
                        alt={product.name}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-4 right-4 flex flex-col space-y-2">
                        <button
                          onClick={() => addToWishlist(product.id)}
                          className="p-2 bg-white rounded-full shadow hover:bg-gray-100"
                        >
                          <Heart size={16} className="text-gray-600" />
                        </button>
                        {product.isFeatured && (
                          <span className="px-2 py-1 bg-yellow-500 text-white text-xs font-semibold rounded">
                            Featured
                          </span>
                        )}
                      </div>
                      {product.stockQuantity <= 0 && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                          <span className="text-white font-semibold">Out of Stock</span>
                        </div>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className={`p-6 ${filters.view === 'list' ? 'w-2/3' : ''}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-sm text-gray-500">{product.category}</span>
                          <h3 className="text-lg font-semibold text-gray-800 mt-1">{product.name}</h3>
                        </div>
                        <div className="flex items-center">
                          <Star size={16} className="text-yellow-400 fill-current" />
                          <span className="ml-1 text-sm text-gray-600">
                            {product.rating} ({product.reviewCount})
                          </span>
                        </div>
                      </div>

                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{product.description}</p>

                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <span className="text-xl font-bold text-gray-800">${product.price.toFixed(2)}</span>
                          {product.compareAtPrice && (
                            <span className="ml-2 text-sm text-gray-500 line-through">
                              ${product.compareAtPrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                        {product.stockQuantity > 0 && (
                          <span className="text-sm text-green-600">
                            {product.stockQuantity} in stock
                          </span>
                        )}
                      </div>

                      <div className="flex space-x-2">
                        <button
                          onClick={() => addToCart(product.id)}
                          disabled={product.stockQuantity <= 0}
                          className={`flex-1 py-2 px-4 rounded-lg font-medium ${
                            product.stockQuantity <= 0
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-purple-600 text-white hover:bg-purple-700'
                          }`}
                        >
                          {product.stockQuantity <= 0 ? 'Out of Stock' : 'Add to Cart'}
                        </button>
                        <button
                          onClick={() => router.push(`/shop/products/${product.id}`)}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          View Details
                        </button>
                      </div>

                      {/* Tags */}
                      {product.tags && product.tags.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {product.tags.slice(0, 3).map((tag, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}