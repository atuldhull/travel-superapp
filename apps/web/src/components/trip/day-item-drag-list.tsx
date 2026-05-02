/**
 * V.UX.6 power-planner drag-and-drop. Renders a single day's items
 * as a sortable list using @dnd-kit. Supports:
 *
 *   - Reorder within the day (sortable strategy).
 *   - Cross-day moves (DndContext at the parent level handles
 *     drop-into-another-day; this component declares its own droppable
 *     wrapper around the list).
 *   - Per-item notes inline with save-on-blur — wired through the
 *     `onItemNotesBlur` callback so the parent owns the mutation.
 *
 * V.UX.28 added a keyboard fallback for the drag handle:
 *   - Tab onto the ⋮⋮ grip button.
 *   - Arrow Up / Arrow Down moves the item one slot within the day.
 *   - Home / End jumps to the start / end of the day.
 *   - The grip button announces its target each time via the live
 *     region in `lib/announce.ts`. The parent reuses the same persist
 *     path the drag-end uses, so server state + screen-reader feedback
 *     stay aligned.
 *
 * Designed to be rendered N times (once per day) inside a single
 * `DndContext` — keeps the cross-day logic simple.
 *
 * Installed by prompt [V.UX.6]; keyboard fallback added by [V.UX.28].
 */
'use client';

import { useState, type KeyboardEvent } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { announce } from '../../lib/announce';

export interface DragItem {
  readonly id: string;
  readonly placeId: string | null;
  readonly notes: string | null;
}

export type ReorderDirection = 'up' | 'down' | 'top' | 'bottom';

export interface DayItemDragListProps {
  readonly dayId: string;
  readonly items: readonly DragItem[];
  readonly onItemNotesBlur: (params: {
    readonly dayId: string;
    readonly itemId: string;
    readonly notes: string;
  }) => void;
  /** V.UX.28 — keyboard reorder hook. When omitted (legacy callers)
   *  the grip button silently ignores arrow keys. */
  readonly onItemReorder?: (params: {
    readonly dayId: string;
    readonly itemId: string;
    readonly direction: ReorderDirection;
  }) => void;
}

export function DayItemDragList({
  dayId,
  items,
  onItemNotesBlur,
  onItemReorder,
}: DayItemDragListProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayId}`, data: { dayId, kind: 'day' } });
  const itemIds = items.map((it) => it.id);

  return (
    <div
      ref={setNodeRef}
      className={`rounded-md border-2 border-dashed p-2 transition ${
        isOver ? 'border-brand bg-brand/5' : 'border-muted/15 bg-transparent'
      }`}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        {items.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted/70">(empty — drag an item here)</p>
        ) : (
          <ul className="space-y-1">
            {items.map((item, idx) => (
              <SortableItem
                key={item.id}
                item={item}
                dayId={dayId}
                position={idx + 1}
                total={items.length}
                onNotesBlur={onItemNotesBlur}
                onReorder={onItemReorder}
              />
            ))}
          </ul>
        )}
      </SortableContext>
    </div>
  );
}

interface SortableItemProps {
  readonly item: DragItem;
  readonly dayId: string;
  readonly position: number;
  readonly total: number;
  readonly onNotesBlur: DayItemDragListProps['onItemNotesBlur'];
  readonly onReorder: DayItemDragListProps['onItemReorder'];
}

function SortableItem({ item, dayId, position, total, onNotesBlur, onReorder }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { dayId, itemId: item.id, kind: 'item' },
  });

  const [notes, setNotes] = useState((item.notes ?? '').trim());

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  function onGripKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (!onReorder) return;
    let direction: ReorderDirection | null = null;
    if (e.key === 'ArrowUp') direction = 'up';
    else if (e.key === 'ArrowDown') direction = 'down';
    else if (e.key === 'Home') direction = 'top';
    else if (e.key === 'End') direction = 'bottom';
    if (direction === null) return;
    e.preventDefault();
    e.stopPropagation();
    onReorder({ dayId, itemId: item.id, direction });
    const label = item.placeId ? item.placeId.slice(0, 8) : 'Note';
    if (direction === 'up') {
      announce(`${label} moved up to position ${Math.max(1, position - 1)} of ${total}`);
    } else if (direction === 'down') {
      announce(`${label} moved down to position ${Math.min(total, position + 1)} of ${total}`);
    } else if (direction === 'top') {
      announce(`${label} moved to position 1 of ${total}`);
    } else {
      announce(`${label} moved to position ${total} of ${total}`);
    }
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 rounded border border-muted/20 bg-surface p-2 text-xs"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onKeyDown={onGripKeyDown}
        aria-label={`Drag to reorder; item ${position} of ${total}. Arrow Up or Arrow Down to move; Home or End to jump.`}
        aria-roledescription="sortable"
        className="mt-1 cursor-grab rounded text-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-brand active:cursor-grabbing"
      >
        ⋮⋮
      </button>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted">
            {item.placeId ? `${item.placeId.slice(0, 8)}…` : '(note only)'}
          </span>
        </div>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            const trimmed = notes.trim();
            if (trimmed !== (item.notes ?? '').trim()) {
              onNotesBlur({ dayId, itemId: item.id, notes: trimmed });
              announce('Notes saved');
            }
          }}
          placeholder="hours, prices, tips…"
          aria-label="Item notes"
          className="w-full rounded border border-muted/20 bg-background px-2 py-1 text-xs"
        />
      </div>
    </li>
  );
}
