import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { CommonService } from 'src/common/common.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private pubClient: Redis;
  private subClient: Redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly commonService: CommonService,
  ) {}

  async onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST');
    const port = Number(this.configService.get('REDIS_PORT'));
    const attempts =
      Number(this.configService.get('REDIS_INIT_MAX_RETRIES')) || 5;
    const baseDelayMs =
      Number(this.configService.get('REDIS_INIT_BASE_DELAY_MS')) || 300;

    await this.commonService.retry(
      async () => {
        const pub = new Redis({
          host,
          port,
          connectTimeout: 10000,
          commandTimeout: 5000,
          lazyConnect: true,
          retryStrategy: (times) => Math.min(times * 200, 2000),
        });
        const sub = pub.duplicate();

        pub.on('error', (e) =>
          this.logger.error(`Redis PUB 오류: ${e.message}`),
        );
        sub.on('error', (e) =>
          this.logger.error(`Redis SUB 오류: ${e.message}`),
        );

        await pub.connect();
        await sub.connect();

        this.pubClient = pub;
        this.subClient = sub;

        this.logger.log(`Redis 연결 성공: ${host}:${port}`);
      },
      { attempts, baseDelayMs },
    );
  }

  onModuleDestroy() {
    this.pubClient?.disconnect();
    this.subClient?.disconnect();
  }

  getPubClient() {
    return this.pubClient;
  }
  getSubClient() {
    return this.subClient;
  }
}
