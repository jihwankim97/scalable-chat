import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ChatService } from './chat.service';
import { Server, Socket } from 'socket.io';
import { SocketJsonPipe } from '../common/pipe/socket-json.pipe';
import { AuthService } from 'src/auth/auth.service';
import { RedisService } from 'src/redis/redis.service';
import { Logger } from '@nestjs/common';
import { CreateChatDto } from './dto/create-chat.dto';
import { createAdapter } from '@socket.io/redis-adapter';

@WebSocketGateway()
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly authService: AuthService,
    private readonly redisService: RedisService,
  ) {}

  afterInit(server: Server) {
    const pubClient = this.redisService.getPubClient();
    const subClient = this.redisService.getSubClient();

    server.adapter(createAdapter(pubClient, subClient));

    this.chatService.setServer(server);

    this.logger.log(' 서버 전역 설정 및 초기화 완료');
  }

  handleDisconnect(client: Socket) {
    const user = client.data.user;

    if (user) {
      this.chatService.removeClient(user.id);
    }

    this.logger.log(`Client 연결 해제: ${client.id}`);
    return;
  }

  async handleConnection(client: Socket) {
    try {
      this.logger.log(`Client 연결: ${client.id}`);
      const rawToken = client.handshake.headers.authorization;

      const payload = await this.authService.parseBearerToken(rawToken, false);

      if (payload) {
        client.data.user = payload;
        this.chatService.registerClient(payload.sub, client);
        await this.chatService.joinUserRooms(payload, client);
      } else {
        client.disconnect();
      }
    } catch (e) {
      this.logger.error(`Connection error: ${e.message}`, e.stack);
      client.disconnect();
    }
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody(SocketJsonPipe) body: CreateChatDto,
    @ConnectedSocket() client: Socket,
  ) {
    await this.chatService.createMessage(client.data.user, body);
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() data: { roomId: number },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`chat/${data.roomId}`);
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @MessageBody() data: { roomId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    await this.chatService.processLeaveRoom(user.sub, data.roomId, client);
  }
}
