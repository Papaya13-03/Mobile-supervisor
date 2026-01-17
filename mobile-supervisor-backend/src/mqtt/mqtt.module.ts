import { Module, forwardRef } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { DataModule } from 'src/data/data.module';
import { MqttController } from './mqtt.controller';

@Module({
  imports: [
    forwardRef(() => DataModule), // 👈 QUAN TRỌNG
  ],
  providers: [MqttService],
  exports: [MqttService],
  controllers: [MqttController],
})
export class MqttModule {}
