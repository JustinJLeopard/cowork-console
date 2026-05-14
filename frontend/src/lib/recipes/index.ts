import { TeammateAvatar } from "./TeammateAvatar.recipe";
import { StatePulseRail } from "./StatePulseRail.recipe";
import { HeartbeatTile } from "./HeartbeatTile.recipe";

export * from "./tokens";
export { TeammateAvatar } from "./TeammateAvatar.recipe";
export { StatePulseRail } from "./StatePulseRail.recipe";
export { HeartbeatTile } from "./HeartbeatTile.recipe";

/**
 * Categorized Recipe Index
 */
export const recipes = {
  atoms: {
    TeammateAvatar,
  },
  molecules: {
    HeartbeatTile,
  },
  behaviors: {
    StatePulseRail,
  },
};
