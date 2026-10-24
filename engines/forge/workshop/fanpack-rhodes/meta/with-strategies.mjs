import { registerMeta as garrisons } from './garrisons.mjs';
import { registerMeta as strategies } from './strategies.mjs';
export function registerMeta(registry) {
  garrisons(registry);
  strategies(registry);
}
