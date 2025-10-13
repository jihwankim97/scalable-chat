import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { ChatService } from './chat.service';
import { Socket } from 'socket.io';
import { SocketJsonPipe } from '../common/pipe/socket-json.pipe';

@WebSocketGateway()
export class ChatGateway {
  constructor(private readonly chatService: ChatService) {}

  @SubscribeMessage('sendMessage')
  async sendMessage(
    @MessageBody(SocketJsonPipe) data: { message: string },
    @ConnectedSocket() client: Socket,
  ) {
    console.log(data);
    client.emit('sendMessage', { ...data, from: 'server' });
  }
}
