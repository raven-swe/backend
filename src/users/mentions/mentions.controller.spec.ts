import { Test, TestingModule } from '@nestjs/testing';
import { MentionsController } from './mentions.controller';

describe('MentionsController', () => {
  let controller: MentionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MentionsController],
    }).compile();

    controller = module.get<MentionsController>(MentionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
