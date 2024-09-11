import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor(config: ConfigService) {
    super({
      datasources: {
        db: {
          url: config.get('POSTGRESQL_URL'),
        },
      },
    });
  }

  cleanAll() {
    return this.$transaction([
      this.users.deleteMany(),
    ]);
  }
}
