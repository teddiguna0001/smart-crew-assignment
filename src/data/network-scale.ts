/* ------------------------------------------------------------------ *
 * Feature 16 — Data scale.
 *
 * Two clearly separated datasets:
 *
 *   1. OFFICIAL_NETWORK — published DTC/GTFS reference values describing
 *      the real Delhi network. These are NEVER used by the simulation or
 *      assignment engines; they exist only as network-scale context.
 *
 *   2. DEMO_FLEET — the controlled operational dataset the simulation and
 *      the assignment solver actually run on: 37 depots × 5 buses = 185.
 *
 * The two must always be labelled distinctly in the UI. Never present an
 * official baseline number as an operational figure, or vice-versa.
 * ------------------------------------------------------------------ */

export const OFFICIAL_NETWORK = {
  label: "Official network baseline (reference only)",
  source: "Published DTC / GTFS network reference",
  stops: 10_559,
  routes: 2_178,
  agencies: 2,
  fleetBaseline: 4_010,
  terminals: 18,
  depots: 37,
} as const;

export const DEMO_BUSES_PER_DEPOT = 5;

/** The 37 depots that make up the controlled operational demo dataset. */
export const DEMO_DEPOTS: { name: string; code: string }[] = [
  { name: "Rohini Depot-I", code: "ROH-1" },
  { name: "Anand Vihar ISBT Depot", code: "AVH-3" },
  { name: "Sarojini Nagar Depot", code: "SRJ-2" },
  { name: "Nehru Place Terminal Depot", code: "NHP-4" },
  { name: "Mayapuri Depot", code: "MYP-1" },
  { name: "Dwarka Sector-22 Depot", code: "DWK-22" },
  { name: "Wazirpur Depot", code: "WZR-1" },
  { name: "Sukhdev Vihar (EV Central)", code: "SKD-EV" },
  { name: "Rohini Depot-II", code: "ROH-2" },
  { name: "Rohini Depot-III", code: "ROH-3" },
  { name: "Nangloi Depot", code: "NGL-1" },
  { name: "Peeragarhi Depot", code: "PRG-1" },
  { name: "Kanjhawala Depot", code: "KNJ-1" },
  { name: "Narela Depot", code: "NRL-1" },
  { name: "Bawana Depot", code: "BWN-1" },
  { name: "Subhash Place Depot", code: "SBP-1" },
  { name: "Shadipur Depot", code: "SHD-1" },
  { name: "Hari Nagar Depot-I", code: "HRN-1" },
  { name: "Hari Nagar Depot-II", code: "HRN-2" },
  { name: "Dwarka Sector-8 Depot", code: "DWK-8" },
  { name: "Najafgarh Depot", code: "NJF-1" },
  { name: "Dichaon Kalan Depot", code: "DCK-1" },
  { name: "Kair Depot", code: "KAR-1" },
  { name: "Rajghat Depot-I", code: "RJG-1" },
  { name: "Rajghat Depot-II", code: "RJG-2" },
  { name: "Hasanpur Depot", code: "HSP-1" },
  { name: "East Vinod Nagar Depot", code: "EVN-1" },
  { name: "Yamuna Vihar Depot", code: "YMV-1" },
  { name: "Nand Nagri Depot", code: "NND-1" },
  { name: "Gazipur Depot", code: "GZP-1" },
  { name: "Noida Link Road Depot", code: "NLR-1" },
  { name: "Ambedkar Nagar Depot", code: "AMB-1" },
  { name: "Kalkaji Depot", code: "KLK-1" },
  { name: "Tehkhand Depot", code: "TKD-1" },
  { name: "Sriniwaspuri Depot", code: "SNP-1" },
  { name: "Vasant Vihar Depot", code: "VSV-1" },
  { name: "Mundela Kalan Depot", code: "MDK-1" },
];

/** 37 × 5 = 185. The simulation and solver never run the 4,010 baseline. */
export const DEMO_FLEET = {
  label: "Demo operational fleet (simulated)",
  depots: DEMO_DEPOTS.length,
  busesPerDepot: DEMO_BUSES_PER_DEPOT,
  totalBuses: DEMO_DEPOTS.length * DEMO_BUSES_PER_DEPOT,
} as const;

/** Share of the official baseline the demo fleet represents. */
export const DEMO_SHARE_PCT =
  Math.round((DEMO_FLEET.totalBuses / OFFICIAL_NETWORK.fleetBaseline) * 1000) / 10;
