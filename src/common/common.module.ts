import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { CommonController } from './common.controller';
import { PrismaService } from './prisma.service';
import { PrismaErrorHandlerService } from './prisma-error-handler.service';

@Module({
  imports: [],
  controllers: [CommonController],
  providers: [CommonService, PrismaService, PrismaErrorHandlerService],
  exports: [CommonService, PrismaService, PrismaErrorHandlerService],
})
export class CommonModule {}
