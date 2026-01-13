import { Injectable, BadRequestException } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import * as sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FileUploadService {
  private s3Client: S3Client;
  private readonly bucketName = process.env.AWS_S3_BUCKET || 'yoga-spa-products';
  private readonly uploadDir = './uploads';

  constructor() {
    // For production: Use AWS S3
    if (process.env.AWS_ACCESS_KEY_ID) {
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
    }
    
    // Create upload directory if it doesn't exist
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadProductImage(file: Express.Multer.File, productId: string, isFeatured: boolean = false) {
    try {
      // Validate file
      this.validateImageFile(file);

      // Generate unique filename
      const fileExt = path.extname(file.originalname).toLowerCase();
      const fileName = `${productId}/${uuidv4()}${fileExt}`;
      
      // Process image (resize, optimize)
      const processedImage = await this.processImage(file.buffer, {
        width: isFeatured ? 1200 : 800,
        height: isFeatured ? 800 : 600,
        quality: 85,
      });

      // Upload to S3 or local storage
      const imageUrl = await this.uploadToStorage(fileName, processedImage, file.mimetype);

      // Generate thumbnail
      const thumbnail = await this.processImage(file.buffer, {
        width: 300,
        height: 300,
        quality: 75,
      });
      
      const thumbFileName = `${productId}/thumbnails/${uuidv4()}${fileExt}`;
      const thumbnailUrl = await this.uploadToStorage(thumbFileName, thumbnail, file.mimetype);

      return {
        original: imageUrl,
        thumbnail: thumbnailUrl,
        medium: imageUrl, // In production, create medium size too
        alt: file.originalname,
        isFeatured,
        uploadedAt: new Date(),
        size: file.size,
        dimensions: await this.getImageDimensions(file.buffer),
      };
    } catch (error) {
      throw new BadRequestException(`Image upload failed: ${error.message}`);
    }
  }

  async uploadMultipleImages(files: Express.Multer.File[], productId: string) {
    const uploadPromises = files.map((file, index) => 
      this.uploadProductImage(file, productId, index === 0) // First image as featured
    );
    
    return Promise.all(uploadPromises);
  }

  async deleteImage(imageUrl: string) {
    try {
      // Extract key from URL
      const key = this.extractKeyFromUrl(imageUrl);
      
      if (process.env.AWS_ACCESS_KEY_ID) {
        // Delete from S3
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: key,
          })
        );
      } else {
        // Delete from local storage
        const filePath = path.join(this.uploadDir, key);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      
      return { success: true, message: 'Image deleted successfully' };
    } catch (error) {
      throw new BadRequestException(`Image deletion failed: ${error.message}`);
    }
  }

  private async uploadToStorage(fileName: string, buffer: Buffer, contentType: string): Promise<string> {
    if (process.env.AWS_ACCESS_KEY_ID) {
      // Upload to S3
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: fileName,
          Body: buffer,
          ContentType: contentType,
          ACL: 'public-read',
        })
      );
      
      return `https://${this.bucketName}.s3.amazonaws.com/${fileName}`;
    } else {
      // Save to local storage (for development)
      const filePath = path.join(this.uploadDir, fileName);
      const dirPath = path.dirname(filePath);
      
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      fs.writeFileSync(filePath, buffer);
      return `/uploads/${fileName}`;
    }
  }

  private async processImage(buffer: Buffer, options: { width: number; height: number; quality: number }) {
    return await sharp(buffer)
      .resize(options.width, options.height, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: options.quality })
      .toBuffer();
  }

  private validateImageFile(file: Express.Multer.File) {
    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 5MB limit');
    }

    // Check file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed');
    }

    // Check file extension
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(fileExt)) {
      throw new BadRequestException('Invalid file extension');
    }
  }

  private async getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  }

  private extractKeyFromUrl(url: string): string {
    if (url.includes('amazonaws.com')) {
      // S3 URL
      return url.split('.com/')[1];
    } else if (url.startsWith('/uploads/')) {
      // Local URL
      return url.replace('/uploads/', '');
    }
    return url;
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (process.env.AWS_ACCESS_KEY_ID) {
      // Generate S3 pre-signed URL
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      
      return await getSignedUrl(this.s3Client, command, { expiresIn });
    }
    return ''; // No signed URL needed for local storage
  }
}