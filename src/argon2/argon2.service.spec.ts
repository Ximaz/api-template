import { Test, TestingModule } from '@nestjs/testing';
import { Argon2Service as Argon2Service } from './argon2.service';

describe('Argon2idService', () => {
  let service: Argon2Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Argon2Service],
    }).compile();

    service = module.get<Argon2Service>(Argon2Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
