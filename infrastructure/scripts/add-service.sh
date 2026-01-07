#!/bin/bash

set -e

if [ -z "$1" ]; then
    echo "Usage: ./add-service.sh <service-name>"
    echo "Example: ./add-service.sh crm-service"
    exit 1
fi

SERVICE_NAME=$1
SERVICE_DIR="services/$SERVICE_NAME"

echo "🔧 Creating new service: $SERVICE_NAME"

# Create directory structure
mkdir -p $SERVICE_DIR/src/{controllers,services,middleware,entities}
mkdir -p $SERVICE_DIR/prisma

# Create package.json for Node.js service
cat > $SERVICE_DIR/package.json << EOF
{
  "name": "$SERVICE_NAME",
  "version": "1.0.0",
  "description": "$SERVICE_NAME microservice",
  "main": "dist/main.js",
  "scripts": {
    "start": "node dist/main.js",
    "start:dev": "nest start --watch",
    "build": "nest build",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@prisma/client": "^5.3.1",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/schematics": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/express": "^4.17.17",
    "@types/jest": "^29.5.5",
    "@types/node": "^20.5.0",
    "jest": "^29.6.4",
    "prisma": "^5.3.1",
    "ts-jest": "^29.1.1",
    "ts-loader": "^9.4.4",
    "ts-node": "^10.9.1",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.1.6"
  }
}
EOF

# Create Prisma schema
cat > $SERVICE_DIR/prisma/schema.prisma << EOF
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
EOF

# Create main.ts
cat > $SERVICE_DIR/src/main.ts << EOF
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(\`$SERVICE_NAME running on port \${port}\`);
}
bootstrap();
EOF

# Create app.module.ts
cat > $SERVICE_DIR/src/app.module.ts << EOF
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
EOF

# Create Dockerfile
cat > $SERVICE_DIR/Dockerfile << EOF
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["node", "dist/main.js"]
EOF

# Create Dockerfile.dev
cat > $SERVICE_DIR/Dockerfile.dev << EOF
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]
EOF

# Create tsconfig.json
cat > $SERVICE_DIR/tsconfig.json << EOF
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseDir": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false
  }
}
EOF

# Create .env.example
cat > $SERVICE_DIR/.env.example << EOF
# $SERVICE_NAME Environment Variables
DATABASE_URL=postgresql://admin:password@postgres:5432/${SERVICE_NAME}_db
PORT=3000
NODE_ENV=development
EOF

# Update root docker-compose.yml
echo "📦 Updating docker-compose.yml..."

# Add database for the new service
sed -i "/POSTGRES_MULTIPLE_DATABASES=/s/\"$/,\${${SERVICE_NAME^^}_DB_NAME}\"/" .env.example
sed -i "/^# Databases per service/a ${SERVICE_NAME^^}_DB_NAME=${SERVICE_NAME}_db" .env.example

# Add service to docker-compose.yml
cat >> docker-compose.yml << EOF

  $SERVICE_NAME:
    build:
      context: ./services/$SERVICE_NAME
      dockerfile: Dockerfile
    container_name: yoga_${SERVICE_NAME//-/_}
    ports:
      - "\${${SERVICE_NAME^^}_SERVICE_PORT}:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@postgres:5432/\${${SERVICE_NAME^^}_DB_NAME}
    networks:
      - yoga-network
    depends_on:
      postgres:
        condition: service_healthy
    logging: *default-logging
EOF

# Add service to docker-compose.override.yml
cat >> docker-compose.override.yml << EOF

  $SERVICE_NAME:
    build:
      dockerfile: Dockerfile.dev
    volumes:
      - ./services/$SERVICE_NAME:/app
      - /app/node_modules
    command: npm run start:dev
EOF

echo "✅ Service $SERVICE_NAME created successfully!"
echo ""
echo "Next steps:"
echo "1. Update .env file with ${SERVICE_NAME^^}_DB_NAME"
echo "2. Define your database schema in $SERVICE_DIR/prisma/schema.prisma"
echo "3. Create controllers and services in $SERVICE_DIR/src/"
echo "4. Run: make db-migrate  # to create database and run migrations"
echo "5. Run: make restart     # to start the new service"