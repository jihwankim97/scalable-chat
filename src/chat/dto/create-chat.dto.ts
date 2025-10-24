import { IsNumber, IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateChatDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsNumber()
  @IsOptional()
  room?: number;

  @IsNumber()
  @IsOptional()
  peerUserId?: number;
}
