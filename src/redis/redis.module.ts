import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { CommonModule } from 'src/common/common.module';

@Global()
@Module({
  imports: [CommonModule],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
