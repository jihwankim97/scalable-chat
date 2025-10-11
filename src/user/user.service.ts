import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/common/prisma.service';
import { PrismaErrorHandlerService } from 'src/common/prisma-error-handler.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaErrorHandler: PrismaErrorHandlerService,
    private readonly prisma: PrismaService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const { email, password } = createUserDto;
    const hashRounds = this.configService.get<number>('HASH_ROUNDS')!;

    const hashedPassword = await bcrypt.hash(password, hashRounds);

    try {
      const newUser = await this.prisma.user.create({
        data: { email, password: hashedPassword },
      });
      return newUser;
    } catch (error) {
      this.prismaErrorHandler.handle(error);
    }
  }

  async findAll() {
    return await this.prisma.user.findMany();
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException(`아이디가 ${id}인 유저가 없습니다.`);
    }
    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    try {
      const { password } = updateUserDto;
      let input: Prisma.UserUpdateInput = {
        ...updateUserDto,
      };
      if (password) {
        const hash = await bcrypt.hash(
          password,
          this.configService.get<number>('HASH_ROUNDS')!,
        );

        input = {
          ...input,
          password: hash,
        };
      }
      const newUser = await this.prisma.user.update({
        where: { id },
        data: input,
      });
      return `This action updates a #${newUser.id} user`;
    } catch (error) {
      this.prismaErrorHandler.handle(error);
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.user.delete({ where: { id } });
      return id;
    } catch (error) {
      this.prismaErrorHandler.handle(error);
    }
  }
}
