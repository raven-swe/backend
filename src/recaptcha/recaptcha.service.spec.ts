import { Test, TestingModule } from '@nestjs/testing';
import { RecaptchaService } from './recaptcha.service';

describe('RecaptchaService', () => {
  let service: RecaptchaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RecaptchaService],
    }).compile();

    service = module.get<RecaptchaService>(RecaptchaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
