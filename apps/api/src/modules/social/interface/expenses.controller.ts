/**
 * Expenses HTTP surface. Lives alongside `SocialController`
 * (votes) in the Social module; separate controller because the
 * route prefix `/trips/:tripId/expenses` is distinct from
 * `/trips/:tripId/votes` and because the DTOs don't overlap.
 *
 *   POST   /api/v1/trips/:tripId/expenses         record a shared expense
 *   GET    /api/v1/trips/:tripId/expenses         list expenses (default 50, cap 500)
 *   GET    /api/v1/trips/:tripId/expenses/balances per-user net ledger
 *   DELETE /api/v1/trips/:tripId/expenses/:id     payer-only delete
 *
 * Auth gate: same as votes — caller owns the trip OR trip has an
 * active share. Validated at the use-case boundary.
 *
 * Installed by prompt [IV.18.12.4].
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { type AuthenticatedUser, CurrentUser } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CreateExpenseUseCase } from '../application/create-expense.use-case';
import { DeleteExpenseUseCase } from '../application/delete-expense.use-case';
import { GetTripBalancesUseCase } from '../application/get-trip-balances.use-case';
import { ListTripExpensesUseCase } from '../application/list-trip-expenses.use-case';
import type { Expense, UserBalance } from '../domain/expense.entity';
import { CreateExpenseBodySchema, type CreateExpenseBody } from './dto/social.dto';

interface ExpenseDto {
  readonly id: string;
  readonly tripId: string;
  readonly paidById: string;
  readonly amountUsd: string;
  readonly currency: string;
  readonly note: string | null;
  readonly splitShare: Readonly<Record<string, number>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function toDto(e: Expense): ExpenseDto {
  return {
    id: e.id,
    tripId: e.tripId,
    paidById: e.paidById,
    amountUsd: e.amountUsd,
    currency: e.currency,
    note: e.note,
    splitShare: e.splitShare,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

@Controller('trips/:tripId/expenses')
export class ExpensesController {
  constructor(
    private readonly createUc: CreateExpenseUseCase,
    private readonly listUc: ListTripExpensesUseCase,
    private readonly balancesUc: GetTripBalancesUseCase,
    private readonly deleteUc: DeleteExpenseUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId') tripId: string,
    @Body(new ZodValidationPipe(CreateExpenseBodySchema)) body: CreateExpenseBody,
  ): Promise<ExpenseDto> {
    const expense = await this.createUc.execute({
      tripId,
      payerId: user.sub,
      amountUsd: body.amountUsd,
      currency: body.currency,
      note: body.note ?? null,
      splitShare: body.splitShare,
    });
    return toDto(expense);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId') tripId: string,
    @Query('limit') limit?: string,
  ): Promise<{ expenses: ExpenseDto[] }> {
    const parsed = limit ? Math.max(1, Math.min(500, Number(limit) || 50)) : 50;
    const expenses = await this.listUc.execute({
      tripId,
      userId: user.sub,
      limit: parsed,
    });
    return { expenses: expenses.map(toDto) };
  }

  /**
   * Aggregated "who owes whom" ledger. Sum of `netUsd` across the
   * array is zero (modulo 2-dp rounding). Positive net = user is
   * owed; negative = user owes.
   *
   * Sorted largest-creditor-first for UI rendering.
   */
  @Get('balances')
  @HttpCode(HttpStatus.OK)
  async balances(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tripId') tripId: string,
  ): Promise<{ balances: readonly UserBalance[] }> {
    const balances = await this.balancesUc.execute({ tripId, userId: user.sub });
    return { balances };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.deleteUc.execute({ id, payerId: user.sub });
  }
}
