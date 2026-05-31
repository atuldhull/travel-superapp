/**
 * Vitest specs for AE345 pulseMessageBubbleStyle.
 */
import { describe, expect, it } from 'vitest';
import {
  USER_BUBBLE_SHADOW,
  pulseMessageBubbleStyle,
} from '../../src/components/aether/pulse/pulse-bubble-style';

const theme = {
  color: {
    surface: { base: '#F2E8D5' },
    ink: { base: '#180F0B', whisper: '#CFC4B3' },
  },
  palette: {
    terracotta: { base: '#C2614A' },
  },
  font: {
    ui: 'Inter, sans-serif',
    display: 'Playfair, serif',
  },
  text: {
    small: { size: 13 },
  },
};

describe('pulseMessageBubbleStyle', () => {
  it('user bubble aligns flex-end, no border, terracotta background', () => {
    const s = pulseMessageBubbleStyle('user', theme);
    expect(s.alignSelf).toBe('flex-end');
    expect(s.background).toBe('#C2614A');
    expect(s.color).toBe('#F2E8D5');
    expect(s.border).toBe('none');
    expect(s.boxShadow).toBe(USER_BUBBLE_SHADOW);
  });

  it('assistant bubble aligns flex-start, has border, surface background', () => {
    const s = pulseMessageBubbleStyle('assistant', theme);
    expect(s.alignSelf).toBe('flex-start');
    expect(s.background).toBe('#F2E8D5');
    expect(s.color).toBe('#180F0B');
    expect(s.border).toBe('1px solid #CFC4B3');
    expect(s.boxShadow).toBe('none');
  });

  it('user uses UI font; assistant uses display font', () => {
    expect(pulseMessageBubbleStyle('user', theme).fontFamily).toBe('Inter, sans-serif');
    expect(pulseMessageBubbleStyle('assistant', theme).fontFamily).toBe('Playfair, serif');
  });

  it('user fontSize = theme.text.small.size; assistant = 14', () => {
    expect(pulseMessageBubbleStyle('user', theme).fontSize).toBe(13);
    expect(pulseMessageBubbleStyle('assistant', theme).fontSize).toBe(14);
  });

  it('user lineHeight 1.5; assistant 1.6', () => {
    expect(pulseMessageBubbleStyle('user', theme).lineHeight).toBe(1.5);
    expect(pulseMessageBubbleStyle('assistant', theme).lineHeight).toBe(1.6);
  });

  it('shadow constant locked to terracotta-alpha-25 (palette-stable)', () => {
    expect(USER_BUBBLE_SHADOW).toContain('194, 97, 74'); // terracotta RGB
    expect(USER_BUBBLE_SHADOW).toContain('0.25'); // alpha
  });

  it('returns a fresh object (consumers may mutate / spread)', () => {
    const a = pulseMessageBubbleStyle('user', theme);
    const b = pulseMessageBubbleStyle('user', theme);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('user vs assistant produce different objects on every axis except the static ones', () => {
    const u = pulseMessageBubbleStyle('user', theme);
    const a = pulseMessageBubbleStyle('assistant', theme);
    for (const axis of [
      'alignSelf',
      'background',
      'color',
      'fontFamily',
      'fontSize',
      'lineHeight',
      'border',
      'boxShadow',
    ] as const) {
      expect(u[axis]).not.toBe(a[axis]);
    }
  });
});
