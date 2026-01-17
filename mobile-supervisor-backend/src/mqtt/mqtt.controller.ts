import { Body, Controller, Post, BadRequestException } from '@nestjs/common';
import { MqttService } from './mqtt.service';

@Controller('mqtt')
export class MqttController {
  constructor(private readonly mqttService: MqttService) {}

  /**
   * FE gọi API này khi bấm nút "Làm mới / Cập nhật"
   * -> Publish interval xuống MQTT
   */
  @Post('publish-interval')
  publishInterval(@Body('interval') interval: number) {
    if (!interval || typeof interval !== 'number') {
      throw new BadRequestException(
        'Interval is required and must be a number',
      );
    }

    this.mqttService.publishIntervalFromFE(interval);

    return {
      success: true,
      interval,
      message: 'Interval published to MQTT',
    };
  }
}
