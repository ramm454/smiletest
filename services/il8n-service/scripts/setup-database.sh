# Generate initial migration
# npx prisma migrate dev --name init

# Create a migration script
# scripts/setup-database.sh
#!/bin/bash

echo "Setting up i18n service database..."

# Apply migrations
echo "Applying migrations..."
npx prisma migrate deploy

# Seed initial data
echo "Seeding initial data..."
npx prisma db seed

# Seed script (prisma/seed.ts)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  
  // Create default languages
  const languages = [
    { code: 'en', name: 'English', nativeName: 'English', isDefault: true, isActive: true },
    { code: 'de', name: 'German', nativeName: 'Deutsch', isDefault: false, isActive: true },
    { code: 'fr', name: 'French', nativeName: 'Français', isDefault: false, isActive: true },
    { code: 'es', name: 'Spanish', nativeName: 'Español', isDefault: false, isActive: true },
    { code: 'it', name: 'Italian', nativeName: 'Italiano', isDefault: false, isActive: true },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português', isDefault: false, isActive: true },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', isDefault: false, isActive: true },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', isDefault: false, isActive: true },
    { code: 'ko', name: 'Korean', nativeName: '한국어', isDefault: false, isActive: true },
    { code: 'zh', name: 'Chinese', nativeName: '中文', isDefault: false, isActive: true },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', isDefault: false, isActive: true, direction: 'rtl' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', isDefault: false, isActive: true },
  ];

  for (const lang of languages) {
    await prisma.language.upsert({
      where: { code: lang.code },
      update: lang,
      create: lang,
    });
  }

  // Create geo language mappings
  const geoMappings = [
    { countryCode: 'US', countryName: 'United States', languages: ['en'], defaultLang: 'en' },
    { countryCode: 'DE', countryName: 'Germany', languages: ['de'], defaultLang: 'de' },
    { countryCode: 'FR', countryName: 'France', languages: ['fr'], defaultLang: 'fr' },
    { countryCode: 'ES', countryName: 'Spain', languages: ['es'], defaultLang: 'es' },
    { countryCode: 'IT', countryName: 'Italy', languages: ['it'], defaultLang: 'it' },
    { countryCode: 'JP', countryName: 'Japan', languages: ['ja'], defaultLang: 'ja' },
    { countryCode: 'KR', countryName: 'South Korea', languages: ['ko'], defaultLang: 'ko' },
    { countryCode: 'CN', countryName: 'China', languages: ['zh'], defaultLang: 'zh' },
    { countryCode: 'IN', countryName: 'India', languages: ['hi', 'en'], defaultLang: 'hi' },
    { countryCode: 'SA', countryName: 'Saudi Arabia', languages: ['ar'], defaultLang: 'ar' },
  ];

  for (const mapping of geoMappings) {
    await prisma.geoLanguageMapping.upsert({
      where: { countryCode: mapping.countryCode },
      update: mapping,
      create: mapping,
    });
  }

  // Create initial service registry
  const services = [
    {
      serviceName: 'user-service',
      baseUrl: 'http://user-service:3001',
      healthUrl: 'http://user-service:3001/health',
      supportedNamespaces: ['auth', 'profile', 'preferences'],
    },
    {
      serviceName: 'booking-service',
      baseUrl: 'http://booking-service:3002',
      healthUrl: 'http://booking-service:3002/health',
      supportedNamespaces: ['booking', 'calendar', 'availability'],
    },
    {
      serviceName: 'yoga-service',
      baseUrl: 'http://yoga-service:3003',
      healthUrl: 'http://yoga-service:3003/health',
      supportedNamespaces: ['classes', 'instructors', 'schedule'],
    },
    {
      serviceName: 'payment-service',
      baseUrl: 'http://payment-service:3004',
      healthUrl: 'http://payment-service:3004/health',
      supportedNamespaces: ['payment', 'invoice', 'subscription'],
    },
  ];

  for (const service of services) {
    await prisma.serviceRegistry.upsert({
      where: { serviceName: service.serviceName },
      update: service,
      create: service,
    });
  }

  console.log('Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });