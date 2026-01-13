import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LiveController } from './live_controller.ts';
import { LiveService } from './live.service.ts';
import { WebSocketModule } from './websocket/webrtc.module';
import { BreakoutRoomService } from './services/breakout-room.service';
import { RecordingManagementService } from './services/recording-management.service';
import { QualityMonitorService } from './services/quality-monitor.service';
import { TranscriptionService } from './services/transcription.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    WebSocketModule,
  ],
  controllers: [LiveController],
  providers: [
    LiveService,
    BreakoutRoomService,
    RecordingManagementService,
    QualityMonitorService,
    TranscriptionService,
  ],
})
export class AppModule {}