/**
 * Media feature module. v1 = presigned S3 uploads for images +
 * videos:
 *
 *   controller (interface)
 *     → CreateUploadUrl / ConfirmUpload / GetMediaDownloadUrl
 *       → MEDIA_ASSET_REPOSITORY + STORAGE_PROVIDER (ports)
 *         ← PrismaMediaAssetRepository (infrastructure)
 *         ← S3StorageProvider (infrastructure; MinIO-compatible)
 *
 * Transcoding + EXIF stripping + thumbnails land in `media-service`
 * (the extracted worker from the Playbook §3.2). This module
 * only brokers the presigned-URL dance.
 *
 * Installed by prompt [IV.18.12.1].
 */
import { Module } from '@nestjs/common';
import { TripModule } from '../trip/trip.module';
import { AttachMediaToBookUseCase } from './application/attach-media-to-book.use-case';
import { AttachMediaToTripUseCase } from './application/attach-media-to-trip.use-case';
import { ConfirmUploadUseCase } from './application/confirm-upload.use-case';
import { CreateMemoryBookUseCase } from './application/create-memory-book.use-case';
import { CreateUploadUrlUseCase } from './application/create-upload-url.use-case';
import { DeleteMemoryBookUseCase } from './application/delete-memory-book.use-case';
import { GetMediaDownloadUrlUseCase } from './application/get-media-download-url.use-case';
import { GetMemoryBookUseCase } from './application/get-memory-book.use-case';
import { ListMemoryBooksUseCase } from './application/list-memory-books.use-case';
import { ListTripMediaUseCase } from './application/list-trip-media.use-case';
import { MEDIA_ASSET_REPOSITORY } from './application/ports/media-asset.repository';
import { MEMORY_BOOK_REPOSITORY } from './application/ports/memory-book.repository';
import { STORAGE_PROVIDER } from './application/ports/storage-provider';
import { UpdateMemoryBookUseCase } from './application/update-memory-book.use-case';
import { PrismaMediaAssetRepository } from './infrastructure/prisma-media-asset.repository';
import { PrismaMemoryBookRepository } from './infrastructure/prisma-memory-book.repository';
import { S3StorageProvider } from './infrastructure/s3-storage-provider';
import { MediaController } from './interface/media.controller';
import { MemoryBookController } from './interface/memory-book.controller';

@Module({
  // Import TripModule so the trip-attachment + list-by-trip
  // use-cases can inject TRIP_REPOSITORY for the trip-owner gate.
  imports: [TripModule],
  controllers: [MediaController, MemoryBookController],
  providers: [
    { provide: MEDIA_ASSET_REPOSITORY, useClass: PrismaMediaAssetRepository },
    { provide: MEMORY_BOOK_REPOSITORY, useClass: PrismaMemoryBookRepository },
    { provide: STORAGE_PROVIDER, useClass: S3StorageProvider },
    CreateUploadUrlUseCase,
    ConfirmUploadUseCase,
    GetMediaDownloadUrlUseCase,
    AttachMediaToTripUseCase,
    ListTripMediaUseCase,
    CreateMemoryBookUseCase,
    GetMemoryBookUseCase,
    ListMemoryBooksUseCase,
    UpdateMemoryBookUseCase,
    DeleteMemoryBookUseCase,
    AttachMediaToBookUseCase,
  ],
  exports: [MEDIA_ASSET_REPOSITORY, MEMORY_BOOK_REPOSITORY, STORAGE_PROVIDER],
})
export class MediaModule {}
