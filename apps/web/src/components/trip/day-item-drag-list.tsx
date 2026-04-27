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
 * Designed to be rendered N times (once per day) inside a single
 * `DndContext` — keeps the cross-day logic simple.
 *
 * Installed by prompt [V.UX.6].
 */
'use client';

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface DragItem {
  readonly id: string;
  readonly placeId: string | null;
  readonly notes: string | null;
}

export interface DayItemDragListProps {
  readonly dayId: string;
  readonly items: readonly DragItem[];
  readonly onItemNotesBlur: (params: {
    readonly dayId: string;
    readonly itemId: string;
    readonly notes: string;
  }) => void;
}

export function DayItemDragList({ dayId, items, onItemNotesBlur }: DayItemDragListProps) {
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
            {items.map((item) => (
              <SortableItem key={item.id} item={item} dayId={dayId} onNotesBlur={onItemNotesBlur} />
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
  readonly onNotesBlur: DayItemDragListProps['onItemNotesBlur'];
}

function SortableItem({ item, dayId, onNotesBlur }: SortableItemProps) {
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
        aria-label="Drag to reorder"
        className="mt-1 cursor-grab text-muted hover:text-foreground active:cursor-grabbing"
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
            }
          }}
          placeholder="hours, prices, tips…"
          className="w-full rounded border border-muted/20 bg-background px-2 py-1 text-xs"
        />
      </div>
    </li>
  );
}
