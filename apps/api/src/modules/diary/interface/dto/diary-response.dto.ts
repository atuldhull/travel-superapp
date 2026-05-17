/**
 * Class-based response DTOs for the diary surface. Documentation-only
 * (Swagger / generated SDK shape).
 *
 * Installed for the adventure-diary feature.
 */
import { ApiProperty } from '@nestjs/swagger';

export class DiaryEntryDto {
  @ApiProperty() declare id: string;
  @ApiProperty() declare userId: string;
  @ApiProperty({ nullable: true }) declare tripId: string | null;
  @ApiProperty() declare title: string;
  @ApiProperty() declare body: string;
  @ApiProperty({ nullable: true }) declare mood: string | null;
  @ApiProperty() declare aiAssisted: boolean;
  @ApiProperty() declare entryDate: string;
  @ApiProperty() declare createdAt: string;
  @ApiProperty() declare updatedAt: string;
}

export class GamificationDeltaDto {
  @ApiProperty() declare totalPoints: number;
  @ApiProperty() declare currentStreak: number;
  @ApiProperty() declare longestStreak: number;
  @ApiProperty() declare entryCount: number;
  @ApiProperty() declare aiAssistCount: number;
  @ApiProperty({ nullable: true }) declare lastEntryOn: string | null;
  @ApiProperty() declare pointsAwarded: number;
  @ApiProperty({ type: [String] }) declare newlyEarnedBadges: string[];
}

export class CreateDiaryEntryResponseDto {
  @ApiProperty({ type: DiaryEntryDto }) declare entry: DiaryEntryDto;
  @ApiProperty({ type: GamificationDeltaDto }) declare gamification: GamificationDeltaDto;
}

export class ListDiaryEntriesResponseDto {
  @ApiProperty({ type: [DiaryEntryDto] }) declare entries: DiaryEntryDto[];
}

export class BadgeViewDto {
  @ApiProperty() declare key: string;
  @ApiProperty() declare name: string;
  @ApiProperty() declare description: string;
  @ApiProperty() declare icon: string;
  @ApiProperty() declare earned: boolean;
}

export class GamificationViewDto {
  @ApiProperty() declare totalPoints: number;
  @ApiProperty() declare currentStreak: number;
  @ApiProperty() declare longestStreak: number;
  @ApiProperty() declare entryCount: number;
  @ApiProperty() declare aiAssistCount: number;
  @ApiProperty({ nullable: true }) declare lastEntryOn: string | null;
  @ApiProperty({ type: [BadgeViewDto] }) declare badges: BadgeViewDto[];
}

export class AssistDiaryResponseDto {
  @ApiProperty({ enum: ['prompt', 'polish', 'title'] }) declare mode: string;
  @ApiProperty({ required: false }) declare text?: string;
  @ApiProperty({ required: false, type: [String] }) declare suggestions?: string[];
  @ApiProperty() declare aiBacked: boolean;
}
