/**
 * Public entry for `@app/sdk`. Re-exports the runtime fetcher +
 * the generated typed clients.
 *
 *   import { configureSdk, apiFetch } from '@app/sdk';
 *   import { useMemoryBookControllerFeatured } from '@app/sdk';
 *
 * Generated React Query hooks live under `src/generated/react-query/`
 * (one barrel per OpenAPI tag). Plain fetchers live under
 * `src/generated/plain/` for non-React consumers (RN, third-party).
 *
 * Re-run after any controller / DTO change:
 *   pnpm --filter=api api:openapi
 *   pnpm --filter=@app/sdk sdk:gen
 *
 * Installed by prompt [IV.18.19.16]; first wire-through [IV.18.19.17].
 */
export { apiFetch, configureSdk, type ApiError } from './runtime/fetcher';

// React Query hooks per OpenAPI tag. Add tags here as the web/mobile
// surface starts consuming them — this keeps the public API explicit
// rather than star-exporting every generated symbol at once.
export * from './generated/react-query/media/media';
export * from './generated/react-query/identity/identity';
export * from './generated/react-query/trip/trip';

// Schema types from openapi.yaml's components/schemas. Re-exported so
// consumers don't have to reach into deep generated paths. Add the
// schemas as the surface starts using them.
export type { AuthSuccessResponseDto } from './generated/schemas/authSuccessResponseDto';
export type { RefreshSuccessResponseDto } from './generated/schemas/refreshSuccessResponseDto';
export type { LoginRequestDto } from './generated/schemas/loginRequestDto';
export type { RegisterRequestDto } from './generated/schemas/registerRequestDto';
export type { OAuthSignInRequestDto } from './generated/schemas/oAuthSignInRequestDto';
export type { FeaturedMemoryBooksResponseDto } from './generated/schemas/featuredMemoryBooksResponseDto';
export type { PublicMemoryBookDto } from './generated/schemas/publicMemoryBookDto';
export type { PublicMemoryBookWithAssetsResponseDto } from './generated/schemas/publicMemoryBookWithAssetsResponseDto';
export type { TripDto } from './generated/schemas/tripDto';
export type { ListTripsResponseDto } from './generated/schemas/listTripsResponseDto';
export type { CreateTripRequestDto } from './generated/schemas/createTripRequestDto';
export type { UpdateTripRequestDto } from './generated/schemas/updateTripRequestDto';
export type { WhoAmIResponseDto } from './generated/schemas/whoAmIResponseDto';
export type { TripOverviewResponseDto } from './generated/schemas/tripOverviewResponseDto';
export type { OverviewSectionFailureDto } from './generated/schemas/overviewSectionFailureDto';
export type { OverviewItinerarySuccessDto } from './generated/schemas/overviewItinerarySuccessDto';
export type { OverviewWeatherSuccessDto } from './generated/schemas/overviewWeatherSuccessDto';
export type { OverviewListSuccessDto } from './generated/schemas/overviewListSuccessDto';
export type { OverviewLegsSuccessDto } from './generated/schemas/overviewLegsSuccessDto';
export type { OverviewMediaSuccessDto } from './generated/schemas/overviewMediaSuccessDto';
export type { ItineraryListResponseDto } from './generated/schemas/itineraryListResponseDto';
export type { ItineraryDayDto } from './generated/schemas/itineraryDayDto';
export type { ItineraryItemDto } from './generated/schemas/itineraryItemDto';
export type { UpdateDayItemDto } from './generated/schemas/updateDayItemDto';
export type { UpdateDayItemsRequestDto } from './generated/schemas/updateDayItemsRequestDto';
export type { UpdateDayItemsResponseDto } from './generated/schemas/updateDayItemsResponseDto';
export type { MediaAssetDto } from './generated/schemas/mediaAssetDto';
export type { ListTripMediaResponseDto } from './generated/schemas/listTripMediaResponseDto';
export type { CreateTripShareRequestDto } from './generated/schemas/createTripShareRequestDto';
export type { TripShareResponseDto } from './generated/schemas/tripShareResponseDto';
export type { CreateUploadUrlRequestDto } from './generated/schemas/createUploadUrlRequestDto';
export type { CreateUploadUrlResponseDto } from './generated/schemas/createUploadUrlResponseDto';
export type { AttachMediaToTripRequestDto } from './generated/schemas/attachMediaToTripRequestDto';
export type { GeneratePlanWithAiResponseDto } from './generated/schemas/generatePlanWithAiResponseDto';
