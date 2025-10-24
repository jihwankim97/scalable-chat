import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { CommonModule } from 'src/common/common.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [CommonModule, AuthModule],
  providers: [ChatGateway, ChatService],
})
export class ChatModule {}
