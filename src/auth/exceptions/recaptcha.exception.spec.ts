import { Test, TestingModule } from '@nestjs/testing';
import { RecaptchaFailedException } from './recaptcha.exception';

describe('Otp Exception', () => {
  let exception: RecaptchaFailedException;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RecaptchaFailedException],
    }).compile();

    exception = module.get<RecaptchaFailedException>(RecaptchaFailedException);
  });

  it('should be defined', () => {
    expect(exception).toBeDefined();
  });
});
