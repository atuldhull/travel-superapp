/**
 * GenieRecorderStatusRow story (AE439) — Chromatic baseline for the
 * AE411 MediaRecorder status row inside the Genie modal. Six variants
 * pin each lifecycle state (idle / requesting / recording / stopping
 * / stopped / error) so the icon + label + sr-friendly announcer copy
 * are reviewable end-to-end.
 */
import type { Meta, StoryObj } from '@storybook/react';

type Status = 'idle' | 'requesting' | 'recording' | 'stopping' | 'stopped' | 'error';

function recorderStatusLabel(status: Status, durationMs: number): string {
  function fmt(ms: number): string {
    if (!Number.isFinite(ms) || ms < 0) return '0:00';
    const s = Math.floor(ms / 1000);
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${mm}:${ss < 10 ? `0${ss}` : ss}`;
  }
  switch (status) {
    case 'idle':
      return 'Microphone ready';
    case 'requesting':
      return 'Requesting microphone permission';
    case 'recording':
      return `Recording, ${fmt(durationMs)}`;
    case 'stopping':
      return 'Finalising recording';
    case 'stopped':
      return `Recorded ${fmt(durationMs)}`;
    case 'error':
      return 'Microphone error';
  }
}

function dotColor(status: Status): string {
  if (status === 'recording') return '#E04A4A';
  if (status === 'requesting' || status === 'stopping') return '#E8B777';
  if (status === 'stopped') return '#6E7B5C';
  if (status === 'error') return '#C2614A';
  return '#A8B596';
}

interface RowProps {
  readonly status: Status;
  readonly durationMs: number;
}

function GenieRecorderStatusRow({ status, durationMs }: RowProps): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        borderRadius: 999,
        background: 'rgba(20, 12, 8, 0.85)',
        border: '1px solid rgba(232, 183, 119, 0.35)',
        color: '#F2E8D5',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 13,
        letterSpacing: '0.04em',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: dotColor(status),
          boxShadow: status === 'recording' ? `0 0 8px ${dotColor(status)}` : 'none',
        }}
      />
      <span>{recorderStatusLabel(status, durationMs)}</span>
    </div>
  );
}

const meta: Meta<typeof GenieRecorderStatusRow> = {
  title: 'Aether / GenieRecorderStatusRow',
  component: GenieRecorderStatusRow,
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof GenieRecorderStatusRow>;

export const Idle: Story = { args: { status: 'idle', durationMs: 0 } };
export const Requesting: Story = { args: { status: 'requesting', durationMs: 0 } };
export const Recording: Story = { args: { status: 'recording', durationMs: 12_400 } };
export const Stopping: Story = { args: { status: 'stopping', durationMs: 27_900 } };
export const Stopped: Story = { args: { status: 'stopped', durationMs: 42_200 } };
export const ErrorState: Story = { args: { status: 'error', durationMs: 0 } };
