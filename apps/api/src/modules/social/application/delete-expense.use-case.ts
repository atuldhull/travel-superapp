/**
 * Delete a trip expense — only the user who paid for it can
 * delete it. Returns 404 on unknown id OR when the caller isn't
 * the payer (IDOR defence — both collapse to the same signal).
 *
 * No group-level "dispute → delete" flow in v1. Trip owners who
 * want to reverse someone else's expense need to ask the payer
 * (or re-record an offsetting expense). That's the conservative
 * default; a future "owner-overrides-payer" admin verb is
 * possible if product asks for it.
 *
 * Installed by prompt [IV.18.12.4].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { EXPENSE_REPOSITORY, type ExpenseRepository } from './ports/expense.repository';

export interface DeleteExpenseCommand {
  readonly id: string;
  readonly payerId: string;
}

@Injectable()
export class DeleteExpenseUseCase {
  constructor(@Inject(EXPENSE_REPOSITORY) private readonly expenses: ExpenseRepository) {}

  async execute(cmd: DeleteExpenseCommand): Promise<void> {
    const removed = await this.expenses.deleteForPayer(cmd.id, cmd.payerId);
    if (!removed) {
      throw new NotFoundError(
        `Expense not found: ${cmd.id}`,
        { expenseId: cmd.id },
        'EXPENSE_NOT_FOUND',
      );
    }
  }
}
