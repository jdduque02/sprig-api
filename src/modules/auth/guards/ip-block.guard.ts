import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { IpBlockService } from '@shared/services/ip-block.service';

export const IP_BLOCK_KEY = 'ip_block';
@Injectable()
export class IpBlockGuard implements CanActivate {
  private readonly logger = new Logger(IpBlockGuard.name);

  constructor(
    private readonly ipBlockService: IpBlockService,
    private readonly reflector: Reflector,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(IP_BLOCK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.extractIp(request);

    const blocked = await this.ipBlockService.isBlocked(ip);
    if (blocked) {
      this.logger.warn(`Request bloqueada desde IP: ${ip}`);
      const response = context.switchToHttp().getResponse<Response>();
      response.setHeader('Retry-After', '900');
      throw new BadRequestException(this.i18n.t('auth.IP_BLOCKED'));
    }

    return true;
  }

  private extractIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ip = Array.isArray(forwarded)
        ? forwarded[0]
        : forwarded.split(',')[0].trim();
      return ip;
    }
    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }
    return request.ip ?? request.socket.remoteAddress ?? 'unknown';
  }
}
