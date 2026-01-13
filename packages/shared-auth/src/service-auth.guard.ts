import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ServiceAuthGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const serviceToken = request.headers['x-service-token'];
    
    const validToken = this.configService.get<string>('SERVICE_TOKEN');
    
    if (!serviceToken || serviceToken !== validToken) {
      throw new UnauthorizedException('Invalid service token');
    }
    
    return true;
  }
}