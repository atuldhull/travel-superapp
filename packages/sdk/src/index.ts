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
export type { PublicDownloadUrlResponseDto } from './generated/schemas/publicDownloadUrlResponseDto';
export type { MemoryBookDto } from './generated/schemas/memoryBookDto';
export type { ListMemoryBooksResponseDto } from './generated/schemas/listMemoryBooksResponseDto';
export type { MemoryBookWithAssetsResponseDto } from './generated/schemas/memoryBookWithAssetsResponseDto';
export type { CreateMemoryBookRequestDto } from './generated/schemas/createMemoryBookRequestDto';
export type { UpdateMemoryBookRequestDto } from './generated/schemas/updateMemoryBookRequestDto';
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
export type { AttachMediaToBookRequestDto } from './generated/schemas/attachMediaToBookRequestDto';
export type { MediaDownloadUrlResponseDto } from './generated/schemas/mediaDownloadUrlResponseDto';
export type { UserDataExportResponseDto } from './generated/schemas/userDataExportResponseDto';
export type { UserDataExportMetadataDto } from './generated/schemas/userDataExportMetadataDto';
export type { NotificationLogDto } from './generated/schemas/notificationLogDto';
export type { ListMyNotificationsResponseDto } from './generated/schemas/listMyNotificationsResponseDto';
export type { UnreadCountResponseDto } from './generated/schemas/unreadCountResponseDto';
export type { MarkAllReadResponseDto } from './generated/schemas/markAllReadResponseDto';
// Per-module Swagger rollouts [IV.18.19.59-66]
export type { ScamReportDto } from './generated/schemas/scamReportDto';
export type { ScamReportWithDistanceDto } from './generated/schemas/scamReportWithDistanceDto';
export type { ReportScamRequestDto } from './generated/schemas/reportScamRequestDto';
export type { FindNearbyScamsRequestDto } from './generated/schemas/findNearbyScamsRequestDto';
export type { FindNearbyScamsResponseDto } from './generated/schemas/findNearbyScamsResponseDto';
export type { EateryListingDto } from './generated/schemas/eateryListingDto';
export type { SearchEateriesRequestDto } from './generated/schemas/searchEateriesRequestDto';
export type { SearchEateriesResponseDto } from './generated/schemas/searchEateriesResponseDto';
export type { DailyForecastDto } from './generated/schemas/dailyForecastDto';
export type { WeatherForecastResponseDto } from './generated/schemas/weatherForecastResponseDto';
export type { StayListingDto } from './generated/schemas/stayListingDto';
export type { SearchStaysRequestDto } from './generated/schemas/searchStaysRequestDto';
export type { SearchStaysResponseDto } from './generated/schemas/searchStaysResponseDto';
export type { PlaceDto } from './generated/schemas/placeDto';
export type { SearchPlacesRequestDto } from './generated/schemas/searchPlacesRequestDto';
export type { SearchPlacesResponseDto } from './generated/schemas/searchPlacesResponseDto';
export type { FederatedPlaceResultDto } from './generated/schemas/federatedPlaceResultDto';
export type { FederatedSearchPlacesRequestDto } from './generated/schemas/federatedSearchPlacesRequestDto';
export type { FederatedSearchPlacesResponseDto } from './generated/schemas/federatedSearchPlacesResponseDto';
export type { EventListingDto } from './generated/schemas/eventListingDto';
export type { SearchEventsRequestDto } from './generated/schemas/searchEventsRequestDto';
export type { SearchEventsResponseDto } from './generated/schemas/searchEventsResponseDto';
export type { RouteLegDto } from './generated/schemas/routeLegDto';
export type { GetRoutesRequestDto } from './generated/schemas/getRoutesRequestDto';
export type { GetRoutesResponseDto } from './generated/schemas/getRoutesResponseDto';
export type { FeedItemDto } from './generated/schemas/feedItemDto';
export type { FeedResponseDto } from './generated/schemas/feedResponseDto';
export type { GeneratePlanWithAiResponseDto } from './generated/schemas/generatePlanWithAiResponseDto';
export type { SharedTripDto } from './generated/schemas/sharedTripDto';
