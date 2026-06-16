/**
 * Services barrel — the only import surface the UI and store need.
 */

export { placesProvider } from './places';
export { routingProvider, buildTravelFn } from './routing';
export { weatherProvider } from './weather';
export { tasteProvider } from './llm';
export { generateItinerary } from './planner';
export type { GenerateOptions } from './planner';
export { serviceConfig, features, describeProviders } from './config';
