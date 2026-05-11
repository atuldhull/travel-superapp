/**
 * POST.1 — 5 SOS events (2 active for /admin/sos triage demo) + 10
 * scam reports (4 verified, 6 pending for /admin/scam-reports demo).
 *
 * Coordinates inserted via raw SQL (PostGIS geography(Point, 4326)).
 */

import type { ScamSeverity } from '@prisma/client';

export interface DemoSos {
  /** Reporter email (must match a DEMO_USERS entry). */
  readonly reporterEmail: string;
  /** Latitude / longitude of the SOS event. */
  readonly lat: number;
  readonly lng: number;
  readonly trigger: 'panic' | 'medical' | 'theft' | 'lost' | 'other';
  /** Stamp resolvedAt non-null to put it in /admin/sos resolved bucket. */
  readonly resolvedDaysAgo: number | null;
  /** Optional resolution note (rendered in /admin/sos). */
  readonly resolutionNote?: string;
  /** Days ago the SOS was triggered. */
  readonly triggeredDaysAgo: number;
}

export const DEMO_SOS: readonly DemoSos[] = [
  {
    reporterEmail: 'alice@travel.local',
    lat: 35.6595, // Shibuya
    lng: 139.7005,
    trigger: 'lost',
    triggeredDaysAgo: 30,
    resolvedDaysAgo: 30,
    resolutionNote: 'User confirmed safe via SMS — got lost on metro.',
  },
  {
    reporterEmail: 'bob@travel.local',
    lat: 38.7167, // Lisbon
    lng: -9.1396,
    trigger: 'theft',
    triggeredDaysAgo: 14,
    resolvedDaysAgo: 13,
    resolutionNote: 'Wallet pickpocketed — police report filed; user OK.',
  },
  {
    reporterEmail: 'dave@travel.local',
    lat: 13.7563, // Bangkok Silom
    lng: 100.5018,
    trigger: 'medical',
    triggeredDaysAgo: 7,
    resolvedDaysAgo: 7,
    resolutionNote: 'Mild food poisoning — clinic visited; user back to itinerary next morning.',
  },
  // 2 active (unresolved) for /admin/sos triage demo
  {
    reporterEmail: 'eve@travel.local',
    lat: 19.4135, // CDMX Roma
    lng: -99.1606,
    trigger: 'panic',
    triggeredDaysAgo: 0,
    resolvedDaysAgo: null,
  },
  {
    reporterEmail: 'frank@travel.local',
    lat: 41.7151, // Tbilisi
    lng: 44.8271,
    trigger: 'other',
    triggeredDaysAgo: 0,
    resolvedDaysAgo: null,
  },
];

export interface DemoScam {
  readonly reporterEmail: string;
  readonly category: string;
  readonly severity: ScamSeverity;
  readonly description: string;
  readonly lat: number;
  readonly lng: number;
  readonly verified: boolean;
  readonly daysAgo: number;
}

export const DEMO_SCAMS: readonly DemoScam[] = [
  // Verified (4)
  {
    reporterEmail: 'demo@travel.local',
    category: 'taxi-overcharge',
    severity: 'medium',
    description: 'Driver outside Shibuya station refused meter; quoted ¥6000 for a ¥1500 ride.',
    lat: 35.6595,
    lng: 139.7005,
    verified: true,
    daysAgo: 12,
  },
  {
    reporterEmail: 'alice@travel.local',
    category: 'pickpocket',
    severity: 'high',
    description: 'Group of 3 distract-and-grab at Tram 28 boarding point. Reported to PSP.',
    lat: 38.711,
    lng: -9.1325,
    verified: true,
    daysAgo: 8,
  },
  {
    reporterEmail: 'bob@travel.local',
    category: 'fake-police',
    severity: 'high',
    description:
      'Fake plainclothes officer near Centro Histórico asking for passport + cash to "verify".',
    lat: 19.4326,
    lng: -99.1332,
    verified: true,
    daysAgo: 5,
  },
  {
    reporterEmail: 'carol@travel.local',
    category: 'tuk-tuk-overcharge',
    severity: 'low',
    description: 'Tuk-tuk driver near Wat Pho quoted 4× the fair rate.',
    lat: 13.7466,
    lng: 100.4933,
    verified: true,
    daysAgo: 20,
  },

  // Pending (6) — these show up in /admin/scam-reports default queue
  {
    reporterEmail: 'dave@travel.local',
    category: 'restaurant-bill',
    severity: 'medium',
    description: 'Khao San Road bar added "service" + "music" charges totalling 60% of meal cost.',
    lat: 13.7591,
    lng: 100.4966,
    verified: false,
    daysAgo: 3,
  },
  {
    reporterEmail: 'eve@travel.local',
    category: 'tour-scam',
    severity: 'medium',
    description:
      'Tour aggregator near Zócalo overcharged by ~3× standard for a Teotihuacán day trip.',
    lat: 19.4326,
    lng: -99.1332,
    verified: false,
    daysAgo: 4,
  },
  {
    reporterEmail: 'frank@travel.local',
    category: 'taxi-overcharge',
    severity: 'low',
    description: 'Tbilisi taxi from airport refused fare meter; 3× normal rate.',
    lat: 41.6685,
    lng: 44.9519,
    verified: false,
    daysAgo: 1,
  },
  {
    reporterEmail: 'grace@travel.local',
    category: 'wifi-honeypot',
    severity: 'high',
    description:
      'Open SSID "Free_Reykjavik_Wifi" near Hallgrímskirkja prompted for credit-card details.',
    lat: 64.1416,
    lng: -21.9266,
    verified: false,
    daysAgo: 6,
  },
  {
    reporterEmail: 'henry@travel.local',
    category: 'pickpocket',
    severity: 'medium',
    description: 'Two attempts on the metro between Roma and Hidalgo — bag-cut method.',
    lat: 19.4326,
    lng: -99.1332,
    verified: false,
    daysAgo: 2,
  },
  {
    reporterEmail: 'demo@travel.local',
    category: 'currency-exchange',
    severity: 'low',
    description: 'Marrakesh souk exchange booth quoted 30% under bank rate; no posted rate.',
    lat: 31.6295,
    lng: -7.9811,
    verified: false,
    daysAgo: 18,
  },
];
