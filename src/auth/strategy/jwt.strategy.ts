import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../types/jwt.types';
import { Injectable, InternalServerErrorException } from '@nestjs/common';

export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    const accessTokenSecret = configService.get<string>('ACCESS_TOKEN_SECRET');

    if (!accessTokenSecret) {
      throw new InternalServerErrorException(
        'ACCESS_TOKEN_SECRET 값이 존재하지 않습니다.',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: accessTokenSecret,
    });
  }

  validate(payload: JwtPayload): unknown {
    return payload;
  }
}
