import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class PrismaErrorHandlerService {
  handle(error: any, customMessage?: string): never {
    switch (error.code) {
      case 'P2025':
        throw new NotFoundException(
          customMessage || '레코드를 찾을 수 없습니다',
        );
      case 'P2002':
        throw new ConflictException('중복된 데이터입니다');
      default:
        throw new InternalServerErrorException(
          '데이터베이스 오류가 발생했습니다',
        );
    }
  }
}
