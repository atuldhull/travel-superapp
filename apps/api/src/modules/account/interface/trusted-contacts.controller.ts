/**
 * V.UX.13 — trusted-contacts CRUD HTTP surface.
 *
 *   GET    /api/v1/account/trusted-contacts        — list mine
 *   POST   /api/v1/account/trusted-contacts        — add (cap 3)
 *   DELETE /api/v1/account/trusted-contacts/:id    — owner-scoped delete
 *
 * Lives in the Account module — same posture as the rest of the
 * caller-self surface (export / delete-account). No admin variant
 * yet; trusted contacts are a pure self-service primitive.
 *
 * Installed by prompt [V.UX.13].
 */
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedUser, CurrentUser } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { AddTrustedContactUseCase } from '../application/add-trusted-contact.use-case';
import { DeleteTrustedContactUseCase } from '../application/delete-trusted-contact.use-case';
import { ListTrustedContactsUseCase } from '../application/list-trusted-contacts.use-case';
import type { TrustedContact } from '../domain/trusted-contact.entity';
import {
  AddTrustedContactBodySchema,
  AddTrustedContactRequestDto,
  ListTrustedContactsResponseDto,
  TrustedContactDto as TrustedContactResponseDto,
  type AddTrustedContactBody,
} from './dto/trusted-contact.dto';

interface TrustedContactDto {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function toDto(c: TrustedContact): TrustedContactDto {
  return {
    id: c.id,
    userId: c.userId,
    name: c.name,
    phone: c.phone,
    email: c.email,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

@ApiTags('account')
@ApiBearerAuth()
@Controller('account/trusted-contacts')
export class TrustedContactsController {
  constructor(
    private readonly listUc: ListTrustedContactsUseCase,
    private readonly addUc: AddTrustedContactUseCase,
    private readonly deleteUc: DeleteTrustedContactUseCase,
  ) {}

  @ApiOperation({ summary: "List the caller's pre-set safety contacts. Cap 3 per account." })
  @ApiResponse({
    status: 200,
    description: "Caller's contacts, oldest-first.",
    type: ListTrustedContactsResponseDto,
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  async list(@CurrentUser() user: AuthenticatedUser): Promise<{ contacts: TrustedContactDto[] }> {
    const rows = await this.listUc.execute(user.sub);
    return { contacts: rows.map(toDto) };
  }

  @ApiOperation({
    summary:
      'Add a trusted contact. Requires at least one of phone or email. 422 CONTACT_LIMIT_REACHED past 3.',
  })
  @ApiBody({ type: AddTrustedContactRequestDto })
  @ApiResponse({ status: 201, description: 'Newly-created row.', type: TrustedContactResponseDto })
  @ApiResponse({
    status: 422,
    description: 'CONTACT_CHANNEL_REQUIRED or CONTACT_LIMIT_REACHED.',
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async add(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(AddTrustedContactBodySchema)) body: AddTrustedContactBody,
  ): Promise<TrustedContactDto> {
    const created = await this.addUc.execute({
      userId: user.sub,
      name: body.name,
      phone: body.phone ?? null,
      email: body.email ?? null,
    });
    return toDto(created);
  }

  @ApiOperation({ summary: 'Delete one of the caller-owned trusted contacts.' })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({ status: 404, description: 'CONTACT_NOT_FOUND.' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.deleteUc.execute({ userId: user.sub, id });
  }
}
