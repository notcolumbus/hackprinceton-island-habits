/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agents from "../agents.js";
import type * as buildings from "../buildings.js";
import type * as dev from "../dev.js";
import type * as goals from "../goals.js";
import type * as gossip from "../gossip.js";
import type * as groupRooms from "../groupRooms.js";
import type * as islands from "../islands.js";
import type * as jobMutations from "../jobMutations.js";
import type * as jobQueries from "../jobQueries.js";
import type * as knot from "../knot.js";
import type * as lib_agentState from "../lib/agentState.js";
import type * as lib_identity from "../lib/identity.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agents: typeof agents;
  buildings: typeof buildings;
  dev: typeof dev;
  goals: typeof goals;
  gossip: typeof gossip;
  groupRooms: typeof groupRooms;
  islands: typeof islands;
  jobMutations: typeof jobMutations;
  jobQueries: typeof jobQueries;
  knot: typeof knot;
  "lib/agentState": typeof lib_agentState;
  "lib/identity": typeof lib_identity;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
