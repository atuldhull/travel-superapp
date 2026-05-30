/**
 * Slash command definitions + matcher (AE85, extracted in AE91).
 *
 * Lives outside `pulse.tsx` so it can be unit-tested without spinning
 * up the whole Pulse drawer. The component imports SLASH_COMMANDS +
 * matchSlashCommands; the matcher is a pure function.
 */
export interface SlashCommand {
  readonly cmd: string;
  readonly hint: string;
  readonly expand: string;
}

export const SLASH_COMMANDS: ReadonlyArray<SlashCommand> = [
  {
    cmd: '/jaipur',
    hint: 'Three slow days in Rajasthan',
    expand: 'A trip to Jaipur, three days, slow pace, palaces and food',
  },
  {
    cmd: '/leh',
    hint: 'Trans-Himalayan high desert',
    expand: 'A trip to Leh, four days, monasteries and the high passes',
  },
  {
    cmd: '/alleppey',
    hint: 'Backwaters, slow time',
    expand: 'A trip to Alleppey, three days, houseboat and palm-fringed backwaters',
  },
  {
    cmd: '/varanasi',
    hint: 'The oldest living city',
    expand: 'A trip to Varanasi, two days, dawn boat ride and ghats',
  },
  {
    cmd: '/cheap',
    hint: 'Make it as cheap as possible',
    expand: 'Same plan, but the cheapest possible version',
  },
  {
    cmd: '/luxury',
    hint: 'Premium tier',
    expand: 'Same plan, but the most premium version',
  },
  {
    cmd: '/two-days',
    hint: 'Compress to two days',
    expand: 'Same plan, but two days',
  },
  {
    cmd: '/five-days',
    hint: 'Stretch to five days',
    expand: 'Same plan, but five days',
  },
  {
    cmd: '/quiet',
    hint: 'No crowds, more dawn',
    expand: 'Same plan, but quieter — no crowds, more dawn light',
  },
  {
    cmd: '/festival',
    hint: 'Around the active festival',
    expand: 'A trip timed around whichever festival is happening in India right now',
  },
];

/** Returns commands whose `cmd` (without the leading slash) starts
 *  with the suffix the user typed after `/`. An empty suffix lists
 *  everything. Caller decides how many to render (slice). Returns []
 *  if the input doesn't begin with `/`. */
export function matchSlashCommands(
  input: string,
  pool: ReadonlyArray<SlashCommand> = SLASH_COMMANDS,
): SlashCommand[] {
  if (!input.startsWith('/')) return [];
  const stem = input.slice(1).toLowerCase();
  return pool.filter((c) => stem === '' || c.cmd.slice(1).startsWith(stem));
}
