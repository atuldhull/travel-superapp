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
import { ConfirmUploadUseCase } from './application/confirm-upload.use-case';
import { CreateUploadUrlUseCase } from './application/create-upload-url.use-case';
import { GetMediaDownloadUrlUseCase } from './application/get-media-download-url.use-case';
import { MEDIA_ASSET_REPOSITORY } from './application/ports/media-asset.repository';
import { STORAGE_PROVIDER } from './application/ports/storage-provider';
import { PrismaMediaAssetRepository } from './infrastructure/prisma-media-asset.repository';
import { S3StorageProvider } from './infrastructure/s3-storage-provider';
import { MediaController } from './interface/media.controller';

@Module({
  controllers: [MediaController],
  providers: [
    { provide: MEDIA_ASSET_REPOSITORY, useClass: PrismaMediaAssetRepository },
    { provide: STORAGE_PROVIDER, useClass: S3StorageProvider },
    CreateUploadUrlUseCase,
    ConfirmUploadUseCase,
    GetMediaDownloadUrlUseCase,
  ],
  exports: [MEDIA_ASSET_REPOSITORY, STORAGE_PROVIDER],
})
export class MediaModule {}
