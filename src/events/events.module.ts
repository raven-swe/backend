import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DomainEventsService } from './domain-events.service';

@Global()
@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [DomainEventsService],
  exports: [DomainEventsService],
})
export class EventsModule {}
