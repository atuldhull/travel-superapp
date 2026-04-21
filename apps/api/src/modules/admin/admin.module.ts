/**
 * Admin feature module. Clean-hex DI:
 *
 *   controller (interface)
 *     → use-cases (application)
 *       → PLACE_REPOSITORY port (imported from PlacesModule)
 *
 * Admin owns no domain of its own — it's a thin authz shell around
 * Place curation. Future admin-for-other-modules surfaces (moderation
 * queue, feature flags) live here too; new use-cases drop in without
 * touching the controller wiring except for a new @Inject.
 *
 * Installed by prompt [IV.18.3.1].
 */
import { Module } from '@nestjs/common';
import { PlacesModule } from '../places/places.module';
import { AdminCreatePlaceUseCase } from './application/admin-create-place.use-case';
import { AdminDeletePlaceUseCase } from './application/admin-delete-place.use-case';
import { AdminController } from './interface/admin.controller';

@Module({
  // Import PlacesModule so the use-cases can inject PLACE_REPOSITORY.
  // PlacesModule already exports that token; Admin has no repositories
  // of its own to provide.
  imports: [PlacesModule],
  controllers: [AdminController],
  providers: [AdminCreatePlaceUseCase, AdminDeletePlaceUseCase],
})
export class AdminModule {}
