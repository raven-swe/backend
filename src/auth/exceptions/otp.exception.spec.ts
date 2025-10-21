import { Test, TestingModule } from '@nestjs/testing';
import { OtpFailedException } from './otp.exception';

describe('Otp Exception', () => {
  let exception: OtpFailedException;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OtpFailedException],
    }).compile();

    exception = module.get<OtpFailedException>(OtpFailedException);
  });

  it('should be defined', () => {
    expect(exception).toBeDefined();
  });
});
