#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: ./create-node-service.sh <service-name>"
  echo "Example: ./create-node-service.sh yoga-service"
  exit 1
fi

SERVICE_NAME=$1
SERVICE_DIR="services/$SERVICE_NAME"

echo "Creating Node.js service: $SERVICE_NAME"

# Create directories
mkdir -p $SERVICE_DIR/src/{dto,entities,interceptors,filters}
mkdir -p $SERVICE_DIR/prisma
mkdir -p $SERVICE_DIR/tests

# Copy from booking service template
cp services/booking-service/package.json $SERVICE_DIR/
cp services/booking-service/tsconfig.json $SERVICE_DIR/
cp services/booking-service/Dockerfile $SERVICE_DIR/ 2>/dev/null || true
cp services/booking-service/Dockerfile.dev $SERVICE_DIR/

# Create basic source files
cat > $SERVICE_DIR/src/main.ts << 'MAIN_EOF'
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(\`$SERVICE_NAME running on port \${port}\`);
}
bootstrap();
MAIN_EOF

cat > $SERVICE_DIR/src/app.module.ts << 'MODULE_EOF'
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
MODULE_EOF

# Create prisma schema
cat > $SERVICE_DIR/prisma/schema.prisma << 'PRISMA_EOF'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Add your models here
model Example {
  id        String   @id @default(uuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
PRISMA_EOF

# Create .env.example
cat > $SERVICE_DIR/.env.example << 'ENV_EOF'
DATABASE_URL=postgresql://admin:password@postgres:5432/${SERVICE_NAME}_db
PORT=3000
NODE_ENV=development
JWT_SECRET=your-jwt-secret
ENV_EOF

echo "✅ Service $SERVICE_NAME created!"
echo "Next steps:"
echo "1. Update $SERVICE_DIR/prisma/schema.prisma with your models"
echo "2. Create controller and service files"
echo "3. Update docker-compose.yml with new service"
echo "4. Run: docker-compose up -d $SERVICE_NAME"
echo "5. Run: docker-compose exec $SERVICE_NAME npx prisma migrate dev"
