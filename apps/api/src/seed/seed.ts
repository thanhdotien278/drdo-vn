import path from 'node:path';
import { connectDatabase, disconnectDatabase } from '../db/connect.js';
import { BrandModel } from '../models/Brand.js';
import { CategoryModel } from '../models/Category.js';
import { ProductModel } from '../models/Product.js';
import { seedBrands, seedCategories, seedProducts } from './catalog.data.js';
import { writePlaceholderImage } from './productImage.js';

const UPLOADS_PRODUCTS_DIR = path.resolve(process.cwd(), 'uploads', 'products');

async function seed(): Promise<void> {
  await connectDatabase();

  await Promise.all([
    ProductModel.deleteMany({}).exec(),
    CategoryModel.deleteMany({}).exec(),
    BrandModel.deleteMany({}).exec(),
  ]);

  const categories = await CategoryModel.insertMany(seedCategories);
  const brands = await BrandModel.insertMany(seedBrands);

  const categoryIdBySlug = new Map(categories.map((category) => [category.slug, category._id]));
  const brandIdBySlug = new Map(brands.map((brand) => [brand.slug, brand._id]));

  for (const item of seedProducts) {
    const categoryId = categoryIdBySlug.get(item.categorySlug);
    const brandId = brandIdBySlug.get(item.brandSlug);
    if (!categoryId || !brandId) {
      throw new Error(`Seed product ${item.slug} references an unknown category or brand`);
    }

    const brandName = seedBrands.find((brand) => brand.slug === item.brandSlug)?.name ?? '';
    const images = await Promise.all(
      [0, 1].map(async (variant) => {
        const fileName = `${item.slug}-${variant + 1}.svg`;
        await writePlaceholderImage(UPLOADS_PRODUCTS_DIR, {
          fileName,
          title: item.name,
          subtitle: `${brandName} • ${item.volume}`,
          colors: item.colors,
          variant,
        });
        return {
          url: `/uploads/products/${fileName}`,
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

  console.log(
    `[seed] ${categories.length} categories, ${brands.length} brands, ${seedProducts.length} products`,
  );
  await disconnectDatabase();
}

seed().catch((error: unknown) => {
  console.error('[seed] failed', error);
  process.exit(1);
});
