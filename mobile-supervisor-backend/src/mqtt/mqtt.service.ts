import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataService } from '../data/data.service';
import * as mqtt from 'mqtt';

interface CellInfoPayload {
  deviceId: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  cellTowers?: any[];
  [key: string]: any;
}

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private client: mqtt.MqttClient;

  // =========================
  // QUEUE & WORKER
  // =========================
  private queue: CellInfoPayload[] = [];
  private processing = false;

  // =========================
  // CONFIG CONTROL
  // =========================
  private currentInterval = 15; // seconds

  constructor(
    private readonly configService: ConfigService,
    private readonly dataService: DataService,
  ) {}

  // =========================
  // INIT MQTT
  // =========================
  onModuleInit() {
    const host = this.configService.get<string>('MQTT_HOST');
    const port = this.configService.get<number>('MQTT_PORT') ?? 8883;
    const username = this.configService.get<string>('MQTT_USER');
    const password = this.configService.get<string>('MQTT_PASS');

    if (!host || !username || !password) {
      console.error('Missing MQTT config');
      return;
    }

    const url = `mqtts://${host}:${port}`;

    this.client = mqtt.connect(url, {
      username,
      password,
      clientId: `nestjs_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      clean: true,
      reconnectPeriod: 1000,
      rejectUnauthorized: false,
    });

    // =========================
    // CONNECT
    // =========================
    this.client.on('connect', () => {
      console.log('Connected to HiveMQ Cloud');

      this.client.subscribe('cell_info', { qos: 0 }, (err) => {
        if (err) {
          console.error('Subscribe error:', err.message);
        } else {
          console.log('Subscribed: cell_info');
        }
      });
    });

    // =========================
    // MESSAGE HANDLER (FAST)
    // =========================
    this.client.on('message', (topic, message) => {
      if (topic !== 'cell_info') return;

      try {
        const payload: CellInfoPayload = JSON.parse(message.toString());

        if (!payload.deviceId) {
          console.warn('Missing deviceId');
          return;
        }

        // PUSH QUEUE (O(1))
        this.queue.push(payload);

        // ADJUST MOBILE SPEED
        this.adjustMobileInterval(payload.deviceId);

        // START WORKER IF IDLE
        if (!this.processing) {
          this.processQueue();
        }
      } catch (err) {
        console.error('Invalid payload:', err.message);
      }
    });

    this.client.on('reconnect', () => console.log('🔄 MQTT reconnecting...'));

    this.client.on('error', (err) => console.error('MQTT error:', err.message));

    this.client.on('close', () => console.warn('⚠️ MQTT connection closed'));
  }

  // =========================
  // QUEUE WORKER
  // =========================
  private async processQueue() {
    this.processing = true;

    while (this.queue.length > 0) {
      const payload = this.queue.shift();
      if (!payload) continue;
      console.log('Processing data from device:', payload.deviceId);
      const deviceId = payload.deviceId;

      try {
        await this.dataService.saveData(deviceId, payload);
      } catch (err) {
        console.error('Save failed:', err.message);
      }
    }

    this.processing = false;
  }

  // =========================
  // ADAPTIVE CONFIG CONTROL
  // =========================
  private adjustMobileInterval(deviceId: string) {
    let newInterval = this.currentInterval;

    if (this.queue.length > 500) {
      newInterval = 120;
    } else if (this.queue.length > 200) {
      newInterval = 60;
    }

    if (newInterval !== this.currentInterval) {
      this.currentInterval = newInterval;

      this.publish(`device/${deviceId}/config`, {
        type: 'config',
        sendIntervalSec: newInterval,
        reason: 'server_load',
        queueLength: this.queue.length,
        timestamp: Date.now(),
      });

      console.log(`Config sent to ${deviceId}: interval=${newInterval}s`);
    }
  }

  // =========================
  // PUBLISH
  // =========================
  publish(topic: string, message: string | object) {
    if (!this.client?.connected) return;

    const payload =
      typeof message === 'string' ? message : JSON.stringify(message);

    this.client.publish(topic, payload, {
      qos: 1,
      retain: true,
    });
  }

  // =========================
  // SHUTDOWN
  // =========================
  onModuleDestroy() {
    if (this.client) {
      this.client.end(true, () => console.log('🔌 MQTT disconnected'));
    }
  }
}
