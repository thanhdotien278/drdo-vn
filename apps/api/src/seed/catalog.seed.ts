import { access } from 'node:fs/promises';
import path from 'node:path';
import { BrandModel } from '../models/Brand.js';
import { CategoryModel } from '../models/Category.js';
import { ProductModel } from '../models/Product.js';
import { publicUploadUrl, uploadsDir } from '../utils/uploads.js';
import { seedBrands, seedCategories, seedProducts } from './catalog.data.js';
import { writePlaceholderImage } from './productImage.js';

export async function seedCatalog(): Promise<string> {
  await Promise.all([
    ProductModel.deleteMany({}).exec(),
    CategoryModel.deleteMany({}).exec(),
    BrandModel.deleteMany({}).exec(),
  ]);

  const categories = await CategoryModel.insertMany(seedCategories);
  const brands = await BrandModel.insertMany(seedBrands);

  const categoryIdBySlug = new Map(categories.map((category) => [category.slug, category._id]));
  const brandIdBySlug = new Map(brands.map((brand) => [brand.slug, brand._id]));

  const uploadsProductsDir = uploadsDir('products');

  for (const item of seedProducts) {
    const categoryId = categoryIdBySlug.get(item.categorySlug);
    const brandId = brandIdBySlug.get(item.brandSlug);
    if (!categoryId || !brandId) {
      throw new Error(`Seed product ${item.slug} references an unknown category or brand`);
    }

    const brandName = seedBrands.find((brand) => brand.slug === item.brandSlug)?.name ?? '';
    const images = await Promise.all(
      [0, 1].map(async (variant) => {
        // Prefer real product photos when they exist on disk; fall back to a
        // generated SVG placeholder so the catalog still renders.
        let fileName = `${item.slug}-${variant + 1}.png`;
        try {
          await access(path.join(uploadsProductsDir, fileName));
        } catch {
          fileName = `${item.slug}-${variant + 1}.svg`;
          try {
            await access(path.join(uploadsProductsDir, fileName));
          } catch {
            await writePlaceholderImage(uploadsProductsDir, {
              fileName,
              title: item.name,
              subtitle: `${brandName} • ${item.volume}`,
              colors: item.colors,
              variant,
            });
          }
        }
        return {
          url: publicUploadUrl('products', fileName),
          alt: item.name,
          isPrimary: variant === 0,
        };
      }),
    );

    await ProductModel.create({
      name: item.name,
      slug: item.slug,
      sku: item.sku,
      shortDescription: item.shortDescription,
      description: item.description,
      ingredients: item.ingredients,
      benefits: item.benefits,
      usageInstructions: item.usageInstructions,
      volume: item.volume,
      skinTypes: item.skinTypes,
      price: item.price,
      salePrice: item.salePrice,
      images,
      category: categoryId,
      brand: brandId,
      stockOnHand: item.stockOnHand,
      stockReserved: item.stockReserved,
      soldCount: item.soldCount,
      ratingAverage: item.ratingAverage,
      ratingCount: item.ratingCount,
      isActive: item.isActive,
    });
  }

  return `${categories.length} categories, ${brands.length} brands, ${seedProducts.length} products`;
}
