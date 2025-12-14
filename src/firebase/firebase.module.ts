import { Module, Global } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import { PushSenderService } from './push-sender.service';

@Global()
@Module({
  providers: [
    PushSenderService,
    {
      provide: 'FIREBASE_ADMIN',
      useFactory: (config: ConfigService): admin.app.App => {
        const firebaseConfig: ServiceAccount = {
          clientEmail: config.get<string>('FIREBASE_CLIENT_EMAIL'),
          privateKey: config.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
          projectId: config.get<string>('FIREBASE_PROJECT_ID'),
        };

        return admin.initializeApp({
          credential: admin.credential.cert(firebaseConfig),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: ['FIREBASE_ADMIN'],
})
export class FirebaseModule {}
