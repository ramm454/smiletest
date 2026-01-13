'use client';

import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Check } from 'lucide-react';

interface ImageUploadProps {
  productId: string;
  onUploadComplete: (images: any[]) => void;
  existingImages?: any[];
  maxImages?: number;
}

export default function ImageUpload({ 
  productId, 
  onUploadComplete, 
  existingImages = [], 
  maxImages = 10 
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Check total images
    const totalImages = existingImages.length + selectedImages.length + files.length;
    if (totalImages > maxImages) {
      setError(`Maximum ${maxImages} images allowed. You have ${existingImages.length} existing images.`);
      return;
    }

    // Validate files
    const validFiles = files.filter(file => {
      const isValidType = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type);
      const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB
      
      if (!isValidType) {
        setError('Only JPEG, PNG, WebP, and GIF files are allowed');
        return false;
      }
      if (!isValidSize) {
        setError('File size must be less than 5MB');
        return false;
      }
      
      return true;
    });

    // Create previews
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviews(prev => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });

    setSelectedImages(prev => [...prev, ...validFiles]);
    setError(null);
  };

  const removeSelectedImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async () => {
    if (selectedImages.length === 0) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    selectedImages.forEach((file, index) => {
      formData.append('images', file);
    });
    formData.append('setFeatured', 'true');

    try {
      const response = await fetch(`/api/shop/products/${productId}/images/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      
      // Clear selected images
      setSelectedImages([]);
      setPreviews([]);
      
      // Notify parent
      onUploadComplete(data.images);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError('Failed to upload images. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const remainingSlots = maxImages - (existingImages.length + selectedImages.length);

  return (
    <div className="space-y-4">
      {/* File input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
      />

      {/* Upload area */}
      <div
        onClick={triggerFileInput}
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-purple-500 transition-colors"
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-lg font-medium text-gray-700 mb-2">
          Drag & drop images or click to browse
        </p>
        <p className="text-sm text-gray-500">
          Upload up to {remainingSlots} more images (JPEG, PNG, WebP, GIF)
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Maximum file size: 5MB per image
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Selected images preview */}
      {selectedImages.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-700 mb-2">
            Selected Images ({selectedImages.length})
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {previews.map((preview, index) => (
              <div key={index} className="relative group">
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-32 object-cover rounded-lg"
                />
                <button
                  onClick={() => removeSelectedImage(index)}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1">
                  {selectedImages[index].name}
                </div>
              </div>
            ))}
          </div>

          {/* Upload button */}
          <div className="mt-4 flex justify-between items-center">
            <span className="text-sm text-gray-600">
              {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''} ready to upload
            </span>
            <button
              onClick={uploadImages}
              disabled={uploading}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {uploading ? `Uploading... ${progress}%` : 'Upload Images'}
            </button>
          </div>
        </div>
      )}

      {/* Existing images */}
      {existingImages.length > 0 && (
        <div className="mt-6">
          <h4 className="font-medium text-gray-700 mb-2">
            Existing Images ({existingImages.length}/{maxImages})
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {existingImages.map((image, index) => (
              <div key={image.id} className="relative group">
                <img
                  src={image.thumbnailUrl || image.url}
                  alt={image.altText || `Product image ${index + 1}`}
                  className="w-full h-32 object-cover rounded-lg"
                />
                {image.isFeatured && (
                  <div className="absolute top-2 left-2 px-2 py-1 bg-green-500 text-white text-xs rounded-full">
                    Featured
                  </div>
                )}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {/* Set as featured */}}
                      className="p-2 bg-white rounded-full hover:bg-gray-100"
                      title="Set as featured"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => {/* Delete image */}}
                      className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                      title="Delete image"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}