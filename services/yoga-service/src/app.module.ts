import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthModule } from './modules/jwt.module';
import { YogaService } from './yoga.service';
import { PoseLibraryService } from './services/pose-library.service';
import { SequenceBuilderService } from './services/sequence-builder.service';
import { CertificationService } from './services/certification.service';
import { ProgressTrackingService } from './services/progress-tracking.service';
import { YogaController } from './controllers/yoga.controller';
import { PoseLibraryController } from './controllers/pose-library.controller';
import { SequenceBuilderController } from './controllers/sequence-builder.controller';
import { CertificationController } from './controllers/certification.controller';
import { ProgressTrackingController } from './controllers/progress-tracking.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    JwtAuthModule,
  ],
  controllers: [
    YogaController,
    PoseLibraryController,
    SequenceBuilderController,
    CertificationController,
    ProgressTrackingController,
  ],
  providers: [
    YogaService,
    PoseLibraryService,
    SequenceBuilderService,
    CertificationService,
    ProgressTrackingService,
  ],
})
export class AppModule {}