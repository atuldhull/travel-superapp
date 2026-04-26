/**
 * Class-based DTOs for the trip overview composite. Documentation-only
 * — runtime returns plain object literals shaped to match. Each
 * section is a discriminated union (`{ok: true, data} | {ok: false, code}`)
 * surfaced via `@ApiProperty({oneOf: [...]})` so orval emits a real
 * union type instead of `data: void`.
 *
 * The success-data shapes are deliberately pragmatic — list lengths +
 * a small `recent` thumb strip — not the full inner provider DTOs.
 * The trip-home dashboard only needs counts + samples; full read of
 * stays / eateries / events lives on dedicated /trips/:id/<section>
 * routes.
 *
 * Installed by prompt [IV.18.19.33].
 */
import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';

/**
 * Failure variant for any section. Same shape across all 7 sections —
 * declared once so we don't duplicate the schema.
 */
export class OverviewSectionFailureDto {
  @ApiProperty({ enum: [false], description: 'Discriminator: this section failed.' })
  declare ok: false;

  @ApiProperty({
    description: 'Stable failure code (e.g. TRIP_DATES_REQUIRED, PROVIDER_UNREACHABLE).',
  })
  declare code: string;
}

// ─── Section data shapes ─────────────────────────────────────────

class OverviewItineraryDayDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ format: 'cuid' })
  declare tripId: string;

  @ApiProperty()
  declare dayIndex: number;

  @ApiProperty({ format: 'date-time' })
  declare date: string;

  @ApiProperty({ nullable: true })
  declare summary: string | null;

  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  declare items: readonly object[];
}

class OverviewItineraryDataDto {
  @ApiProperty({ type: [OverviewItineraryDayDto] })
  declare days: readonly OverviewItineraryDayDto[];
}

class OverviewWeatherDataDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'WeatherForecast — daily array + provider metadata. See /weather endpoints.',
  })
  declare forecast: object;
}

class OverviewListDataDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description:
      'Provider-shaped listings (StayListing / EateryListing / EventListing). Inner DTOs typed on dedicated routes.',
  })
  declare list: readonly object[];
}

class OverviewLegsDataDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description: 'TransportLeg[] — see /trips/:id/transport-legs for the typed shape.',
  })
  declare legs: readonly object[];
}

class OverviewMediaRecentDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ enum: ['image', 'video'] })
  declare kind: 'image' | 'video';

  @ApiProperty()
  declare s3KeyRaw: string;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;
}

class OverviewMediaDataDto {
  @ApiProperty({ description: 'Total media-asset count attached to this trip.' })
  declare count: number;

  @ApiProperty({ type: [OverviewMediaRecentDto] })
  declare recent: readonly OverviewMediaRecentDto[];
}

// ─── Success variants (one per section) ──────────────────────────

export class OverviewItinerarySuccessDto {
  @ApiProperty({ enum: [true] })
  declare ok: true;

  @ApiProperty({ type: OverviewItineraryDataDto })
  declare data: OverviewItineraryDataDto;
}

export class OverviewWeatherSuccessDto {
  @ApiProperty({ enum: [true] })
  declare ok: true;

  @ApiProperty({ type: OverviewWeatherDataDto })
  declare data: OverviewWeatherDataDto;
}

export class OverviewListSuccessDto {
  @ApiProperty({ enum: [true] })
  declare ok: true;

  @ApiProperty({ type: OverviewListDataDto })
  declare data: OverviewListDataDto;
}

export class OverviewLegsSuccessDto {
  @ApiProperty({ enum: [true] })
  declare ok: true;

  @ApiProperty({ type: OverviewLegsDataDto })
  declare data: OverviewLegsDataDto;
}

export class OverviewMediaSuccessDto {
  @ApiProperty({ enum: [true] })
  declare ok: true;

  @ApiProperty({ type: OverviewMediaDataDto })
  declare data: OverviewMediaDataDto;
}

// ─── Trip metadata (lifted to keep the composite self-contained) ─

class OverviewTripMetaDto {
  @ApiProperty({ format: 'cuid' })
  declare id: string;

  @ApiProperty({ format: 'cuid' })
  declare userId: string;

  @ApiProperty()
  declare title: string;

  @ApiProperty()
  declare status: string;

  @ApiProperty({ minimum: 1, maximum: 500 })
  declare radiusKm: number;

  @ApiProperty({ nullable: true, format: 'date-time' })
  declare startsOn: string | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  declare endsOn: string | null;

  @ApiProperty()
  declare version: number;

  @ApiProperty({ format: 'date-time' })
  declare createdAt: string;

  @ApiProperty({ format: 'date-time' })
  declare updatedAt: string;
}

// ─── Composite ───────────────────────────────────────────────────

@ApiExtraModels(
  OverviewSectionFailureDto,
  OverviewItinerarySuccessDto,
  OverviewWeatherSuccessDto,
  OverviewListSuccessDto,
  OverviewLegsSuccessDto,
  OverviewMediaSuccessDto,
)
export class TripOverviewResponseDto {
  @ApiProperty({ type: OverviewTripMetaDto })
  declare trip: OverviewTripMetaDto;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(OverviewItinerarySuccessDto) },
      { $ref: getSchemaPath(OverviewSectionFailureDto) },
    ],
  })
  declare itinerary: OverviewItinerarySuccessDto | OverviewSectionFailureDto;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(OverviewWeatherSuccessDto) },
      { $ref: getSchemaPath(OverviewSectionFailureDto) },
    ],
  })
  declare weather: OverviewWeatherSuccessDto | OverviewSectionFailureDto;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(OverviewListSuccessDto) },
      { $ref: getSchemaPath(OverviewSectionFailureDto) },
    ],
  })
  declare stays: OverviewListSuccessDto | OverviewSectionFailureDto;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(OverviewListSuccessDto) },
      { $ref: getSchemaPath(OverviewSectionFailureDto) },
    ],
  })
  declare eateries: OverviewListSuccessDto | OverviewSectionFailureDto;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(OverviewListSuccessDto) },
      { $ref: getSchemaPath(OverviewSectionFailureDto) },
    ],
  })
  declare events: OverviewListSuccessDto | OverviewSectionFailureDto;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(OverviewLegsSuccessDto) },
      { $ref: getSchemaPath(OverviewSectionFailureDto) },
    ],
  })
  declare transport: OverviewLegsSuccessDto | OverviewSectionFailureDto;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(OverviewMediaSuccessDto) },
      { $ref: getSchemaPath(OverviewSectionFailureDto) },
    ],
  })
  declare media: OverviewMediaSuccessDto | OverviewSectionFailureDto;
}
