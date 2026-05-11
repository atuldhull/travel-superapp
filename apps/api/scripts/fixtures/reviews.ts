/**
 * POST.1 — 30 reviews across 4 target types (place / stay / eatery
 * / agent). Target ids are stable opaque demo strings so the
 * cross-target review summaries (V.UX.24-ish) accumulate signal
 * across re-runs.
 */

export interface DemoReview {
  /** Author email (must match a DEMO_USERS entry). */
  readonly authorEmail: string;
  readonly targetType: 'place' | 'stay' | 'eatery' | 'agent';
  /** Stable opaque target id — not a real Place row id, just a key
   *  the review summary endpoints will aggregate against. */
  readonly targetId: string;
  /** 1..5 inclusive. */
  readonly rating: number;
  readonly body: string;
  readonly language?: string;
}

export const DEMO_REVIEWS: readonly DemoReview[] = [
  // demo agent — Kenji (links to agent.kenji@travel.local seeded in admin.ts)
  {
    authorEmail: 'demo@travel.local',
    targetType: 'agent',
    targetId: 'demo-agent-kenji',
    rating: 5,
    body: 'Kenji organised an unforgettable two-day Tokyo route — restaurants, temples, walking pace just right.',
  },
  {
    authorEmail: 'alice@travel.local',
    targetType: 'agent',
    targetId: 'demo-agent-kenji',
    rating: 5,
    body: 'Speaks excellent English. Saved us from queuing at Senso-ji.',
  },
  {
    authorEmail: 'bob@travel.local',
    targetType: 'agent',
    targetId: 'demo-agent-kenji',
    rating: 4,
    body: 'Solid guide. The izakaya recommendation alone was worth the booking.',
  },

  // demo agent — Luísa
  {
    authorEmail: 'demo@travel.local',
    targetType: 'agent',
    targetId: 'demo-agent-luisa',
    rating: 5,
    body: 'Luísa knows every miradouro in Lisbon by heart. Sunset itinerary was perfect.',
  },
  {
    authorEmail: 'carol@travel.local',
    targetType: 'agent',
    targetId: 'demo-agent-luisa',
    rating: 5,
    body: 'Family-friendly, relaxed pace. Kids loved her.',
  },

  // demo agent — Sofía
  {
    authorEmail: 'premium@travel.local',
    targetType: 'agent',
    targetId: 'demo-agent-sofia',
    rating: 5,
    body: 'Sofía built a mezcal-and-art trail through Roma & Condesa I would never have found alone.',
  },
  {
    authorEmail: 'eve@travel.local',
    targetType: 'agent',
    targetId: 'demo-agent-sofia',
    rating: 4,
    body: 'Great communication. One restaurant was closed; she pivoted instantly.',
  },

  // demo agent — Pim
  {
    authorEmail: 'dave@travel.local',
    targetType: 'agent',
    targetId: 'demo-agent-pim',
    rating: 5,
    body: 'Pim is a walking encyclopedia of Bangkok street food. Five days, never the same dish twice.',
  },
  {
    authorEmail: 'frank@travel.local',
    targetType: 'agent',
    targetId: 'demo-agent-pim',
    rating: 4,
    body: 'Solid guide. Brought a notebook of recommendations we still use.',
  },

  // Eateries
  {
    authorEmail: 'demo@travel.local',
    targetType: 'eatery',
    targetId: 'demo-eatery-konjiki-hototogisu',
    rating: 5,
    body: 'Best truffle ramen of my life.',
  },
  {
    authorEmail: 'bob@travel.local',
    targetType: 'eatery',
    targetId: 'demo-eatery-konjiki-hototogisu',
    rating: 5,
    body: 'Worth the queue.',
  },
  {
    authorEmail: 'grace@travel.local',
    targetType: 'eatery',
    targetId: 'demo-eatery-konjiki-hototogisu',
    rating: 4,
    body: 'Crowded but the broth lives up to the hype.',
  },
  {
    authorEmail: 'demo@travel.local',
    targetType: 'eatery',
    targetId: 'demo-eatery-pasteis-belem',
    rating: 5,
    body: 'They are warm. Just go.',
  },
  {
    authorEmail: 'carol@travel.local',
    targetType: 'eatery',
    targetId: 'demo-eatery-pasteis-belem',
    rating: 5,
    body: 'Iconic. Even with the queue, on the must-do list.',
  },
  {
    authorEmail: 'demo@travel.local',
    targetType: 'eatery',
    targetId: 'demo-eatery-buna-42',
    rating: 4,
    body: 'Best espresso in Roma Norte.',
  },
  {
    authorEmail: 'premium@travel.local',
    targetType: 'eatery',
    targetId: 'demo-eatery-buna-42',
    rating: 5,
    body: 'The barista was a pleasure. Single-origin highlight.',
  },
  {
    authorEmail: 'dave@travel.local',
    targetType: 'eatery',
    targetId: 'demo-eatery-yaowarat-street',
    rating: 5,
    body: 'Three stalls in 90 minutes. All five-star.',
  },

  // Places
  {
    authorEmail: 'demo@travel.local',
    targetType: 'place',
    targetId: 'demo-place-shibuya-xing',
    rating: 4,
    body: 'Iconic but loud. Best at 6am.',
  },
  {
    authorEmail: 'alice@travel.local',
    targetType: 'place',
    targetId: 'demo-place-shibuya-xing',
    rating: 5,
    body: 'Climb the Magnet 109 platform for the photo.',
  },
  {
    authorEmail: 'demo@travel.local',
    targetType: 'place',
    targetId: 'demo-place-jardim-da-estrela',
    rating: 5,
    body: 'Quiet morning escape from central Lisbon.',
  },
  {
    authorEmail: 'carol@travel.local',
    targetType: 'place',
    targetId: 'demo-place-jardim-da-estrela',
    rating: 5,
    body: 'Took the kids twice. Playground is excellent.',
  },
  {
    authorEmail: 'eve@travel.local',
    targetType: 'place',
    targetId: 'demo-place-frida-museum',
    rating: 5,
    body: 'Book ahead. The blue house is small but every room hits.',
  },
  {
    authorEmail: 'premium@travel.local',
    targetType: 'place',
    targetId: 'demo-place-frida-museum',
    rating: 4,
    body: 'Crowded, but the audio guide is good.',
  },
  {
    authorEmail: 'bob@travel.local',
    targetType: 'place',
    targetId: 'demo-place-aurora-trail',
    rating: 5,
    body: 'Saw the lights on night two. Unreal.',
  },

  // Stays
  {
    authorEmail: 'demo@travel.local',
    targetType: 'stay',
    targetId: 'demo-stay-shibuya-tokyu',
    rating: 4,
    body: 'Walking distance to everything. Rooms are tiny — Tokyo standard.',
  },
  {
    authorEmail: 'bob@travel.local',
    targetType: 'stay',
    targetId: 'demo-stay-reykjavik-loft',
    rating: 5,
    body: 'Clean, central, sunset view from the rooftop.',
  },
  {
    authorEmail: 'alice@travel.local',
    targetType: 'stay',
    targetId: 'demo-stay-tbilisi-loft',
    rating: 5,
    body: 'Best 30-day rate I found. Reliable wifi for work.',
  },
  {
    authorEmail: 'dave@travel.local',
    targetType: 'stay',
    targetId: 'demo-stay-bangkok-hive',
    rating: 4,
    body: 'Coworking space inside the building. Game changer.',
  },
  {
    authorEmail: 'carol@travel.local',
    targetType: 'stay',
    targetId: 'demo-stay-lisbon-family',
    rating: 5,
    body: 'Two-bedroom apartment, very kid friendly.',
  },
  {
    authorEmail: 'eve@travel.local',
    targetType: 'stay',
    targetId: 'demo-stay-cdmx-roma',
    rating: 4,
    body: 'Quiet block, walkable to all the cafés.',
  },
];
