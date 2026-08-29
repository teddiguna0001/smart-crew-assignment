
export interface RouteStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  zone: string;
}

export interface DTCRoute {
  id: string;
  routeNumber: string;
  name: string;
  origin: string;
  destination: string;
  color: string;
  coordinates: [number, number][];
  distanceKm: number;
  avgDurationMins: number;
  activeBuses: number;
  frequencyMins: number;
  stopsCount: number;
  corridorType: 'Radial' | 'Circular' | 'Trunk' | 'Feeder';
}

export interface Depot {
  id: string;
  name: string;
  code: string;
  lat: number;
  lng: number;
  totalFleet: number;
  activeFleet: number;
  standbyFleet: number;
  maintenanceFleet: number;
  manager: string;
  phone: string;
}

export interface ActiveBusPosition {
  busId: string;
  regNumber: string;
  routeNumber: string;
  driverName: string;
  speedKmph: number;
  lat: number;
  lng: number;
  heading: number;
  status: 'on-time' | 'delayed' | 'critical-delay' | 'standby' | 'disrupted';
  delayMins: number;
  batteryOrFuelPct: number;
  fuelType: 'EV' | 'CNG';
  passengers: number;
  nextStop: string;
  depot: string;
}

export interface TripSchedule {
  id: string;
  tripCode: string;
  routeNumber: string;
  origin: string;
  destination: string;
  startTime: string;
  endTime: string;
  assignedBus: string;
  assignedDriver: string;
  assignedConductor: string;
  depot: string;
  dutyType: 'Linked Shift' | 'Unlinked Relay' | 'Split Shift' | 'Night Special';
  status: 'Scheduled' | 'In-Transit' | 'Completed' | 'Delayed' | 'Conflict' | 'Cancelled';
  conflictReason?: string;
  deadheadKm: number;
}

export interface CrewMember {
  id: string;
  badgeNumber: string;
  name: string;
  role: 'Driver' | 'Conductor' | 'Shift In-Charge';
  depot: string;
  phone: string;
  status: 'On-Duty' | 'Available' | 'Rest Period' | 'Off-Duty' | 'Sick/Leave';
  currentDuty?: string;
  weeklyHours: number;
  dailySpreadoverHours: number;
  consecutiveDays: number;
  licenseValidTill: string;
  punctualityScore: number;
}

export interface FleetVehicle {
  id: string;
  regNumber: string;
  model: string;
  type: 'Low Floor Electric' | 'Standard CNG AC' | 'Standard CNG Non-AC' | 'Electric Midi';
  depot: string;
  status: 'Active Route' | 'Standby' | 'Scheduled Maintenance' | 'Breakdown' | 'Depot Reserve';
  socOrFuelPct: number;
  odometerKm: number;
  currentAssignment?: string;
  efficiencyScore: number;
  lastMaintenance: string;
  nextInspectionDue: string;
}

export interface DisruptionEvent {
  id: string;
  type: 'Bus Breakdown' | 'Crew Absenteeism' | 'Traffic Congestion' | 'Demand Surge' | 'Accident';
  severity: 'Critical' | 'High' | 'Moderate' | 'Low';
  location: string;
  busId?: string;
  routeNumber: string;
  timestamp: string;
  status: 'Active' | 'Analyzing' | 'Re-Optimized' | 'Resolved';
  impactSummary: string;
  affectedTripsCount: number;
  affectedPassengersEst: number;
  recoveryPlan?: {
    replacementBusId: string;
    replacementDriverId: string;
    depotSourced: string;
    etaMinutes: number;
    delayMitigationMins: number;
    actions: string[];
  };
}

export interface OptimizationMetrics {
  fleetUtilization: number;
  totalBusesRequired: number;
  deadheadKm: number;
  idleCrewHours: number;
  unassignedTrips: number;
  scheduleConflicts: number;
  operatingCostPerDay: number;
  punctualityIndex: number;
  solverRuntimeSecs: number;
  iterationsCount: number;
  optimalityGapPct: number;
}
