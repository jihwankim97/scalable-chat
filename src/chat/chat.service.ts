import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { PrismaErrorHandlerService } from 'src/common/prisma-error-handler.service';
import { PrismaService } from 'src/common/prisma.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { Prisma } from '@prisma/client';
import { WsException } from '@nestjs/websockets';
import { JwtPayload } from 'src/auth/types/jwt.types';

@Injectable()
export class ChatService {
  private server: Server;
  private readonly connectedClients = new Map<number, Socket>();
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaErrorHandler: PrismaErrorHandlerService,
  ) {}

  setServer(server: Server) {
    this.server = server;
  }

  registerClient(userId: number, client: Socket) {
    this.connectedClients.set(userId, client);
  }

  removeClient(userId: number) {
    this.connectedClients.delete(userId);
  }

  async joinUserRooms(user: { sub: number }, client) {
    client.join(`user/${user.sub}`);
    const chatRooms = await this.prisma.chatRoom.findMany({
      where: {
        users: {
          some: {
            id: user.sub,
          },
        },
      },
      include: {
        users: true,
        chats: true,
      },
    });

    chatRooms.forEach((room) => {
      client.join(`chat/${room.id}`);
    });
  }

  async createMessage(
    { sub: userId }: JwtPayload,
    { message, roomId, peerUserId }: CreateChatDto,
  ) {
    if (roomId && peerUserId) {
      throw new WsException('room과 peerUserId를 동시에 사용할 수 없습니다.');
    }
    if (!roomId && !peerUserId) {
      throw new WsException('room 또는 peerUserId 중 하나는 필수입니다.');
    }

    const result = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        let chatRoom;
        let isNewRoom = false;

        if (peerUserId) {
          const result = await this.getOrCreateDirectRoom(
            userId,
            peerUserId,
            tx,
          );
          chatRoom = result.room;
          isNewRoom = result.isNew;
        } else if (roomId) {
          chatRoom = await this.getOrCreateChatRoom(userId, roomId, tx);
          isNewRoom = false;
        }

        const msgModel = await tx.chat.create({
          data: {
            author: { connect: { id: userId } },
            message,
            chatRoom: { connect: { id: chatRoom.id } },
          },
        });

        return {
          msgModel,
          chatRoom,
          isNewRoom,
        };
      },
    );

    const { msgModel, chatRoom, isNewRoom } = result;

    if (isNewRoom) {
      chatRoom.users.forEach((user) => {
        this.server.to(`user/${user.id}`).emit('roomCreated', chatRoom.id);

        const socket = this.connectedClients.get(user.id);
        if (socket) {
          socket.join(`chat/${chatRoom.id}`);
        }
      });
    }

    this.server.to(`chat/${chatRoom.id}`).emit('newMessage', msgModel);

    return message;
  }

  async getOrCreateDirectRoom(
    userId1: number,
    userId2: number,
    tx: Prisma.TransactionClient,
  ): Promise<{ room: any; isNew: boolean }> {
    if (userId1 === userId2) {
      throw new WsException('자기 자신에게 메시지를 보낼 수 없습니다.');
    }

    const existingRoom = await tx.chatRoom.findFirst({
      where: {
        AND: [
          { users: { some: { id: userId1 } } },
          { users: { some: { id: userId2 } } },
        ],
      },
      include: { users: true },
    });

    if (existingRoom && existingRoom.users.length === 2) {
      return { room: existingRoom, isNew: false };
    }

    const newRoom = await tx.chatRoom.create({
      data: {
        users: {
          connect: [{ id: userId1 }, { id: userId2 }],
        },
      },
      include: { users: true },
    });

    return { room: newRoom, isNew: true };
  }

  async getOrCreateChatRoom(
    userId: number,
    room: number,
    tx: Prisma.TransactionClient,
  ) {
    const chatRoom = await tx.chatRoom.findUnique({
      where: { id: room },
      include: { users: true },
    });

    if (!chatRoom) {
      throw new WsException('존재하지 않는 채팅방입니다.');
    }

    const isMember = chatRoom.users.some((u) => u.id === userId);

    if (!isMember) {
      return await tx.chatRoom.update({
        where: { id: room },
        data: {
          users: { connect: { id: userId } },
        },
        include: { users: true },
      });
    }

    return chatRoom;
  }

  async checkRoomAccess(userId: number, roomId: number): Promise<boolean> {
    const room = await this.prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        users: {
          some: { id: userId },
        },
      },
    });

    return !!room;
  }

  async processJoinRoom(
    userId: number,
    roomId: number,
    client: Socket,
  ): Promise<void> {
    try {
      const chatRoom = await this.prisma.chatRoom.findUnique({
        where: { id: roomId },
        include: { users: true },
      });

      if (!chatRoom) {
        throw new WsException('존재하지 않는 채팅방입니다.');
      }

      const isMember = chatRoom.users.some((u) => u.id === userId);

      if (!isMember) {
        await this.prisma.chatRoom.update({
          where: { id: roomId },
          data: {
            users: { connect: { id: userId } },
          },
        });
      }

      client.join(`chat/${roomId}`);
      client.emit('roomJoined', { roomId, success: true });
      this.logger.log(`사용자 ${userId}가 방 ${roomId}에 가입했습니다.`);
    } catch (error) {
      this.logger.error(`방 가입 실패: ${error.message}`);
      client.emit('error', { message: error.message });
      throw error;
    }
  }

  async leaveRoom(userId: number, roomId: number) {
    return await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: {
        users: {
          disconnect: { id: userId },
        },
      },
    });
  }

  async processLeaveRoom(userId: number, roomId: number, client: any) {
    try {
      const hasAccess = await this.checkRoomAccess(userId, roomId);
      if (!hasAccess) {
        throw new WsException('방에 접근할 권한이 없습니다.');
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const updatedRoom = await tx.chatRoom.update({
          where: { id: roomId },
          data: {
            users: {
              disconnect: { id: userId },
            },
          },
          include: { users: true },
        });

        if (updatedRoom.users.length === 0) {
          await tx.chatRoom.delete({
            where: { id: roomId },
          });
          return { roomDeleted: true };
        }

        return { roomDeleted: false };
      });

      if (result.roomDeleted) {
        this.logger.log(`방 ${roomId}에 사용자가 없어 방이 삭제되었습니다.`);
      }

      client.leave(`chat/${roomId}`);
      client.emit('roomLeft', { roomId, success: true });

      this.logger.log(`사용자 ${userId}가 방 ${roomId}에서 나갔습니다.`);
      return { success: true };
    } catch (error) {
      this.logger.error(`방 나가기 실패: ${error.message}`);
      client.emit('error', { message: error.message });
      throw error;
    }
  }
}
