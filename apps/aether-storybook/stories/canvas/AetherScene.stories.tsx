/**
 * Canvas stories — the Drift-side composition rendered in isolation.
 *
 * Chromatic captures frame 0 (deterministic — particle field is closed-form).
 * Run with motion in normal Storybook for hands-on inspection.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { AetherScene, AmbientField, SunDisk } from '@app/aether-canvas';

function FullScene(): React.ReactElement {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <AetherScene ariaLabel="Aether scene — sun + dust">
        <SunDisk />
        <AmbientField count={600} />
      </AetherScene>
    </div>
  );
}

function SunOnly(): React.ReactElement {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <AetherScene ariaLabel="SunDisk in isolation">
        <SunDisk />
      </AetherScene>
    </div>
  );
}

function DustOnly(): React.ReactElement {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <AetherScene ariaLabel="AmbientField in isolation">
        <AmbientField count={600} />
      </AetherScene>
    </div>
  );
}

const meta: Meta = {
  title: 'Canvas / AetherScene',
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj;

export const Drift: Story = { render: () => <FullScene /> };
export const SunDiskOnly: Story = { render: () => <SunOnly /> };
export const AmbientFieldOnly: Story = { render: () => <DustOnly /> };
