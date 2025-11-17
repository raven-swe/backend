// write unit test for health.controller.ts
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from 'src/health/health.controller';

describe('HealthController', () => {
  let healthController: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    healthController = module.get<HealthController>(HealthController);
  });

  describe('check', () => {
    it('should return status OK', () => {
      const result = healthController.check();
      expect(result).toEqual({ status: 'OK' });
    });
  });
});
