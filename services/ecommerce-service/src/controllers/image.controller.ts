import {
  Controller,
  Post,
  Put,
  Delete,
  Get,
  Param,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  Body,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../guards/auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { FileUploadService } from '../services/file-upload.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Controller('products/:productId/images')
export class ImageController {
  constructor(private readonly fileUploadService: FileUploadService) {}

  @Post('upload')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FilesInterceptor('images', 10)) // Max 10 images
  async uploadImages(
    @Param('productId') productId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: { setFeatured?: string }
  ) {
    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new BadRequestException('Product not found');
    }

    // Upload images
    const uploadedImages = await this.fileUploadService.uploadMultipleImages(files, productId);

    // Save to database
    const savedImages = await Promise.all(
      uploadedImages.map(async (img, index) => {
        const imageData = {
          productId,
          url: img.original,
          thumbnailUrl: img.thumbnail,
          mediumUrl: img.medium,
          altText: img.alt,
          isFeatured: body.setFeatured === 'true' && index === 0,
          displayOrder: index,
          width: img.dimensions.width,
          height: img.dimensions.height,
          size: img.size,
          format: img.original.split('.').pop(),
        };

        return prisma.productImage.create({
          data: imageData,
        });
      })
    );

    // Update product's featured image if needed
    if (body.setFeatured === 'true' && savedImages.length > 0) {
      await prisma.product.update({
        where: { id: productId },
        data: {
          featuredImage: savedImages[0].url,
          images: savedImages.map(img => img.url),
        },
      });
    }

    return {
      message: 'Images uploaded successfully',
      images: savedImages,
      count: savedImages.length,
    };
  }

  @Post('upload-single')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('image'))
  async uploadSingleImage(
    @Param('productId') productId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { isFeatured?: boolean }
  ) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new BadRequestException('Product not found');
    }

    // Upload image
    const uploadedImage = await this.fileUploadService.uploadProductImage(
      file,
      productId,
      body.isFeatured || false
    );

    // Save to database
    const savedImage = await prisma.productImage.create({
      data: {
        productId,
        url: uploadedImage.original,
        thumbnailUrl: uploadedImage.thumbnail,
        mediumUrl: uploadedImage.medium,
        altText: uploadedImage.alt,
        isFeatured: body.isFeatured || false,
        displayOrder: 0,
        width: uploadedImage.dimensions.width,
        height: uploadedImage.dimensions.height,
        size: uploadedImage.size,
        format: uploadedImage.original.split('.').pop(),
      },
    });

    // Update product if featured
    if (body.isFeatured) {
      await prisma.product.update({
        where: { id: productId },
        data: {
          featuredImage: savedImage.url,
          images: {
            push: savedImage.url,
          },
        },
      });
    }

    return {
      message: 'Image uploaded successfully',
      image: savedImage,
    };
  }

  @Put(':imageId/set-featured')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async setFeaturedImage(
    @Param('productId') productId: string,
    @Param('imageId') imageId: string
  ) {
    // Reset all images to not featured
    await prisma.productImage.updateMany({
      where: { productId },
      data: { isFeatured: false },
    });

    // Set new featured image
    const featuredImage = await prisma.productImage.update({
      where: { id: imageId },
      data: { isFeatured: true },
    });

    // Update product's featured image
    await prisma.product.update({
      where: { id: productId },
      data: {
        featuredImage: featuredImage.url,
      },
    });

    return {
      message: 'Featured image updated',
      image: featuredImage,
    };
  }

  @Put(':imageId/reorder')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async reorderImage(
    @Param('imageId') imageId: string,
    @Body() body: { displayOrder: number }
  ) {
    const updatedImage = await prisma.productImage.update({
      where: { id: imageId },
      data: { displayOrder: body.displayOrder },
    });

    return {
      message: 'Image order updated',
      image: updatedImage,
    };
  }

  @Delete(':imageId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async deleteImage(
    @Param('productId') productId: string,
    @Param('imageId') imageId: string
  ) {
    const image = await prisma.productImage.findUnique({
      where: { id: imageId },
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    // Delete from storage
    await this.fileUploadService.deleteImage(image.url);
    if (image.thumbnailUrl) {
      await this.fileUploadService.deleteImage(image.thumbnailUrl);
    }

    // Delete from database
    await prisma.productImage.delete({
      where: { id: imageId },
    });

    // Update product if this was the featured image
    if (image.isFeatured) {
      const nextImage = await prisma.productImage.findFirst({
        where: { productId },
        orderBy: { displayOrder: 'asc' },
      });

      await prisma.product.update({
        where: { id: productId },
        data: {
          featuredImage: nextImage?.url || null,
          images: {
            set: (await prisma.productImage.findMany({
              where: { productId },
              select: { url: true },
              orderBy: { displayOrder: 'asc' },
            })).map(img => img.url),
          },
        },
      });
    }

    return {
      message: 'Image deleted successfully',
    };
  }

  @Get()
  async getProductImages(@Param('productId') productId: string) {
    const images = await prisma.productImage.findMany({
      where: { productId },
      orderBy: { displayOrder: 'asc' },
    });

    return {
      productId,
      images,
      count: images.length,
    };
  }
}