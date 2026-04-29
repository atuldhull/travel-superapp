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
export * from './generated/react-query/social/social';
export * from './generated/react-query/near-me/near-me';
// V.UX.13 — safety + account surfaces (SOS trigger + trusted-contacts CRUD).
export * from './generated/react-query/safety/safety';
export * from './generated/react-query/account/account';
// V.UX.17 — premium concierge agent-match.
export * from './generated/react-query/agents/agents';
// V.UX.18 — translation widget. CountryPrimer hooks live under the
// already-star-exported safety barrel (controller uses @ApiTags('safety')).
export * from './generated/react-query/translation/translation';
// V.UX.19 — hyper-local hidden-gem discovery hook lives in the places barrel.
export * from './generated/react-query/places/places';
// V.UX.20 — foodie persona: dish-level surfaces + food crawl. Both
// the FoodController and the new FoodCrawlController use @ApiTags('food'),
// so orval emits both groups of hooks under the same food barrel.
export * from './generated/react-query/food/food';
// V.UX.21 — adventure persona: hourly forecast hook lives in the weather barrel.
export * from './generated/react-query/weather/weather';

// Schema types from openapi.yaml's components/schemas. Re-exported so
// consumers don't have to reach into deep generated paths. Add the
// schemas as the surface starts using them.
export type { AuthSuccessResponseDto } from './generated/schemas/authSuccessResponseDto';
export type { RefreshSuccessResponseDto } from './generated/schemas/refreshSuccessResponseDto';
export type { LoginRequestDto } from './generated/schemas/loginRequestDto';
export type { RegisterRequestDto } from './generated/schemas/registerRequestDto';
export type { OAuthSignInRequestDto } from './generated/schemas/oAuthSignInRequestDto';
export type { MagicLinkRequestRequestDto } from './generated/schemas/magicLinkRequestRequestDto';
export type { MagicLinkConsumeRequestDto } from './generated/schemas/magicLinkConsumeRequestDto';
export type { MagicLinkRequestResponseDto } from './generated/schemas/magicLinkRequestResponseDto';
export type { OnboardingCompleteRequestDto } from './generated/schemas/onboardingCompleteRequestDto';
export type { OnboardingCompleteResponseDto } from './generated/schemas/onboardingCompleteResponseDto';
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
// Per-module Swagger sweep-up [IV.18.19.67-70]
export type { ReviewDto } from './generated/schemas/reviewDto';
export type { ReviewSummaryDto } from './generated/schemas/reviewSummaryDto';
export type { CreateReviewRequestDto } from './generated/schemas/createReviewRequestDto';
export type { ListReviewsResponseDto } from './generated/schemas/listReviewsResponseDto';
export type { VoteDto } from './generated/schemas/voteDto';
export type { VoteTallyDto } from './generated/schemas/voteTallyDto';
export type { VoteSummaryDto } from './generated/schemas/voteSummaryDto';
export type { CastVoteRequestDto } from './generated/schemas/castVoteRequestDto';
export type { RevokeVoteRequestDto } from './generated/schemas/revokeVoteRequestDto';
export type { ListTripVotesResponseDto } from './generated/schemas/listTripVotesResponseDto';
export type { ExpenseDto } from './generated/schemas/expenseDto';
export type { CreateExpenseRequestDto } from './generated/schemas/createExpenseRequestDto';
export type { ListExpensesResponseDto } from './generated/schemas/listExpensesResponseDto';
export type { UserBalanceDto } from './generated/schemas/userBalanceDto';
export type { ListBalancesResponseDto } from './generated/schemas/listBalancesResponseDto';
export type { PlaceReviewSummaryResponseDto } from './generated/schemas/placeReviewSummaryResponseDto';
export type { StayReviewSummaryResponseDto } from './generated/schemas/stayReviewSummaryResponseDto';
export type { EateryReviewSummaryResponseDto } from './generated/schemas/eateryReviewSummaryResponseDto';
export type { AgentReviewSummaryResponseDto } from './generated/schemas/agentReviewSummaryResponseDto';
export type { AdminPlaceDto } from './generated/schemas/adminPlaceDto';
export type { AdminCreatePlaceRequestDto } from './generated/schemas/adminCreatePlaceRequestDto';
export type { AdminPurgeForceResponseDto } from './generated/schemas/adminPurgeForceResponseDto';
export type { AdminUserDto } from './generated/schemas/adminUserDto';
export type { AdminListUsersResponseDto } from './generated/schemas/adminListUsersResponseDto';
export type { AdminMediaDto } from './generated/schemas/adminMediaDto';
export type { AdminListMediaResponseDto } from './generated/schemas/adminListMediaResponseDto';
export type { SosEventDto } from './generated/schemas/sosEventDto';
export type { TriggerSosRequestDto } from './generated/schemas/triggerSosRequestDto';
export type { ResolveSosRequestDto } from './generated/schemas/resolveSosRequestDto';
export type { ListSosEventsResponseDto } from './generated/schemas/listSosEventsResponseDto';
export type { CrimeIncidentDto } from './generated/schemas/crimeIncidentDto';
export type { FindNearbyCrimesRequestDto } from './generated/schemas/findNearbyCrimesRequestDto';
export type { FindNearbyCrimesResponseDto } from './generated/schemas/findNearbyCrimesResponseDto';
export type { SafetyScoreRequestDto } from './generated/schemas/safetyScoreRequestDto';
export type { SafetyScoreResponseDto } from './generated/schemas/safetyScoreResponseDto';
export type { AdminListScamReportsResponseDto } from './generated/schemas/adminListScamReportsResponseDto';
export type { AdminListSosEventsResponseDto } from './generated/schemas/adminListSosEventsResponseDto';
export type { AdminResolveSosRequestDto } from './generated/schemas/adminResolveSosRequestDto';
export type { GeneratePlanWithAiResponseDto } from './generated/schemas/generatePlanWithAiResponseDto';
export type { GenerateSamplePlanRequestDto } from './generated/schemas/generateSamplePlanRequestDto';
export type { GenerateSamplePlanResponseDto } from './generated/schemas/generateSamplePlanResponseDto';
export type { SamplePlanCenterDto } from './generated/schemas/samplePlanCenterDto';
export type { SharedTripDto } from './generated/schemas/sharedTripDto';
// V.UX.4: weekend-traveler place suggestions
export type { SuggestedPlaceDto } from './generated/schemas/suggestedPlaceDto';
export type { SuggestPlacesForTripRequestDto } from './generated/schemas/suggestPlacesForTripRequestDto';
export type { SuggestPlacesForTripResponseDto } from './generated/schemas/suggestPlacesForTripResponseDto';
// V.UX.6: power-planner — optimize day route + per-day route coords
export type { OptimizeDayRouteResponseDto } from './generated/schemas/optimizeDayRouteResponseDto';
export type { DayRouteCoordDto } from './generated/schemas/dayRouteCoordDto';
export type { DayRouteCoordsResponseDto } from './generated/schemas/dayRouteCoordsResponseDto';
// V.UX.7: spontaneous-improviser — near-me composite
export type { NearMeNowRequestDto } from './generated/schemas/nearMeNowRequestDto';
export type { NearMeNowResponseDto } from './generated/schemas/nearMeNowResponseDto';
export type { NearMePlaceDto } from './generated/schemas/nearMePlaceDto';
export type { NearMeWeatherDto } from './generated/schemas/nearMeWeatherDto';
export type { NearMeWeatherDayDto } from './generated/schemas/nearMeWeatherDayDto';
export type { NearMeSafetyDto } from './generated/schemas/nearMeSafetyDto';
export type { NearMeRouteLegDto } from './generated/schemas/nearMeRouteLegDto';
// V.UX.8: group-organiser settle-up + vote-summary types
export type { SettleTransferDto } from './generated/schemas/settleTransferDto';
export type { SettleUpResponseDto } from './generated/schemas/settleUpResponseDto';
export type { TripShareOwnerDto } from './generated/schemas/tripShareOwnerDto';
export type { ListTripSharesResponseDto } from './generated/schemas/listTripSharesResponseDto';
// V.UX.9: collaborator role + lists
export type { TripWithRoleResponseDto } from './generated/schemas/tripWithRoleResponseDto';
// V.UX.10: anonymous react + clone shared trip
export type { HeartSharedTripResponseDto } from './generated/schemas/heartSharedTripResponseDto';
export type { SharedTripHeartCountResponseDto } from './generated/schemas/sharedTripHeartCountResponseDto';
// V.UX.11: memory-book asset captions + summaries
export type { MemoryBookAssetSummaryDto } from './generated/schemas/memoryBookAssetSummaryDto';
export type { UpdateAssetCaptionRequestDto } from './generated/schemas/updateAssetCaptionRequestDto';
// V.UX.12: memory-book drag-reorder
export type { ReorderBookAssetsRequestDto } from './generated/schemas/reorderBookAssetsRequestDto';
// V.UX.13: safety-first trusted contacts
export type { TrustedContactDto } from './generated/schemas/trustedContactDto';
export type { ListTrustedContactsResponseDto } from './generated/schemas/listTrustedContactsResponseDto';
export type { AddTrustedContactRequestDto } from './generated/schemas/addTrustedContactRequestDto';
// V.UX.14: family-mode preferences
export type { PreferencesDto } from './generated/schemas/preferencesDto';
export type { UpdatePreferencesRequestDto } from './generated/schemas/updatePreferencesRequestDto';
// V.UX.17: premium concierge agent-match
export type { AgentMatchDto } from './generated/schemas/agentMatchDto';
export type { MatchAgentForTripRequestDto } from './generated/schemas/matchAgentForTripRequestDto';
export type { MatchAgentForTripResponseDto } from './generated/schemas/matchAgentForTripResponseDto';
// V.UX.18: translation + country primer
export type { TranslationDto } from './generated/schemas/translationDto';
export type { TranslateTextRequestDto } from './generated/schemas/translateTextRequestDto';
export type { CountryPrimerDto } from './generated/schemas/countryPrimerDto';
export type { EmergencyNumberDto } from './generated/schemas/emergencyNumberDto';
export type { LanguagePhraseDto } from './generated/schemas/languagePhraseDto';
// V.UX.19: hyper-local hidden-gem discovery (under places barrel — already exported above)
export type { HiddenGemDto } from './generated/schemas/hiddenGemDto';
export type { DiscoverHiddenGemsRequestDto } from './generated/schemas/discoverHiddenGemsRequestDto';
export type { DiscoverHiddenGemsResponseDto } from './generated/schemas/discoverHiddenGemsResponseDto';
// V.UX.20: foodie persona — dish reports + food-crawl planner
export type { DishDto } from './generated/schemas/dishDto';
export type { ListDishesResponseDto } from './generated/schemas/listDishesResponseDto';
export type { AddDishReportRequestDto } from './generated/schemas/addDishReportRequestDto';
export type { BuildFoodCrawlRequestDto } from './generated/schemas/buildFoodCrawlRequestDto';
export type { BuildFoodCrawlResponseDto } from './generated/schemas/buildFoodCrawlResponseDto';
export type { FoodCrawlStopDto } from './generated/schemas/foodCrawlStopDto';
// V.UX.21: adventure persona — hourly forecast surfaces
export type { HourlyForecastDto } from './generated/schemas/hourlyForecastDto';
export type { HourlyWeatherForecastResponseDto } from './generated/schemas/hourlyWeatherForecastResponseDto';
// V.UX.5: business-traveler — Expense / Balance schemas already
// exported above (lines 121-126); social hooks barrel re-exported
// above to surface useExpensesController{Create,List,Balances,Remove}.
