/** Vehicle running cost the pricing engine assumes, per km (fuel + wear), in RWF. */
export const RUNNING_COST_PER_KM = 300;
/** Flat platform booking fee per seat, in RWF. Separate from the driver's cost share. */
export const BOOKING_FEE = 150;
/** Reduced booking fee for EV / hybrid trips, in RWF. */
export const BOOKING_FEE_EV = 100;
/** Max trips a driver may publish per calendar day (one out, one back). */
export const MAX_TRIPS_PER_DAY = 2;
/** Seats a driver may offer on one trip. */
export const MIN_SEATS = 1;
export const MAX_SEATS = 4;
/** Estimated CO2 saved per passenger-km shared instead of driven alone, in kg. */
export const CO2_KG_PER_PASSENGER_KM = 0.12;
/** Rwanda is UTC+2 all year (no DST). */
export const KIGALI_UTC_OFFSET_MINUTES = 120;
/** How many days ahead a recurring trip materialises dated occurrences. */
export const RECURRING_HORIZON_DAYS = 7;
