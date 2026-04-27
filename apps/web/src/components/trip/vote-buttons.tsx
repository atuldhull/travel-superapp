/**
 * V.UX.8 vote buttons. Up / meh / down trio for any votable target
 * (`itinerary_item` for now). Tally renders inline; clicking refires
 * `useSocialControllerCast` which is idempotent server-side
 * (one-vote-per-user).
 *
 * Designed to live under each itinerary item card in the power
 * planner / itinerary section.
 *
 * Installed by prompt [V.UX.8].
 */
'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getVotesControllerSummaryQueryKey,
  useSocialControllerCast,
  useVotesControllerSummary,
  type CastVoteRequestDto,
  type VoteSummaryDto,
} from '@app/sdk';

interface VoteButtonsProps {
  readonly tripId: string;
  readonly targetId: string;
  readonly targetType?: 'itinerary_item' | 'place' | 'eatery' | 'stay';
  readonly disabled?: boolean;
}

export function VoteButtons({
  tripId,
  targetId,
  targetType = 'itinerary_item',
  disabled,
}: VoteButtonsProps) {
  const queryClient = useQueryClient();
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const { data } = useVotesControllerSummary(
    { targetType, targetId },
    { query: { enabled: !disabled && targetId !== '' } },
  );
  const summary = data?.data as unknown as VoteSummaryDto | undefined;

  const castMutation = useSocialControllerCast({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getVotesControllerSummaryQueryKey({ targetType, targetId }),
        });
        setErrMsg(null);
      },
      onError: (err: unknown) => {
        const e = err as { code?: string; message?: string; status?: number };
        setErrMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Vote failed.'}`);
      },
    },
  });

  function vote(value: -1 | 0 | 1) {
    if (disabled) return;
    const data: CastVoteRequestDto = {
      targetType: targetType as unknown as CastVoteRequestDto['targetType'],
      targetId,
      value,
    };
    castMutation.mutate({ tripId, data });
  }

  const counts = {
    up: summary?.up ?? 0,
    meh: summary?.meh ?? 0,
    down: summary?.down ?? 0,
  };

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <VoteButton
        label="👍"
        count={counts.up}
        onClick={() => vote(1)}
        disabled={disabled || castMutation.isPending}
      />
      <VoteButton
        label="🤷"
        count={counts.meh}
        onClick={() => vote(0)}
        disabled={disabled || castMutation.isPending}
      />
      <VoteButton
        label="👎"
        count={counts.down}
        onClick={() => vote(-1)}
        disabled={disabled || castMutation.isPending}
      />
      {errMsg ? <span className="text-[10px] text-danger">{errMsg}</span> : null}
    </div>
  );
}

interface VoteButtonProps {
  readonly label: string;
  readonly count: number;
  readonly onClick: () => void;
  readonly disabled: boolean;
}

function VoteButton({ label, count, onClick, disabled }: VoteButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-full border border-muted/20 bg-surface px-2 py-1 text-xs transition hover:border-brand/40 hover:bg-brand/5 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span>{label}</span>
      <span className="font-mono text-[11px] text-muted">{count}</span>
    </button>
  );
}
