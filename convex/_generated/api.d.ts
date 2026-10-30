/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions from "../actions.js";
import type * as admin from "../admin.js";
import type * as adminNode from "../adminNode.js";
import type * as clock from "../clock.js";
import type * as crons from "../crons.js";
import type * as health from "../health.js";
import type * as ideas from "../ideas.js";
import type * as lib_adminAuth from "../lib/adminAuth.js";
import type * as lib_agenda from "../lib/agenda.js";
import type * as lib_columns from "../lib/columns.js";
import type * as lib_phases from "../lib/phases.js";
import type * as lib_pulse from "../lib/pulse.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as lib_retroAccess from "../lib/retroAccess.js";
import type * as lib_validation from "../lib/validation.js";
import type * as phase from "../phase.js";
import type * as presence from "../presence.js";
import type * as pulse from "../pulse.js";
import type * as retros from "../retros.js";
import type * as retrosNode from "../retrosNode.js";
import type * as votes from "../votes.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  actions: typeof actions;
  admin: typeof admin;
  adminNode: typeof adminNode;
  clock: typeof clock;
  crons: typeof crons;
  health: typeof health;
  ideas: typeof ideas;
  "lib/adminAuth": typeof lib_adminAuth;
  "lib/agenda": typeof lib_agenda;
  "lib/columns": typeof lib_columns;
  "lib/phases": typeof lib_phases;
  "lib/pulse": typeof lib_pulse;
  "lib/rateLimits": typeof lib_rateLimits;
  "lib/retroAccess": typeof lib_retroAccess;
  "lib/validation": typeof lib_validation;
  phase: typeof phase;
  presence: typeof presence;
  pulse: typeof pulse;
  retros: typeof retros;
  retrosNode: typeof retrosNode;
  votes: typeof votes;
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

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  presence: import("@convex-dev/presence/_generated/component.js").ComponentApi<"presence">;
};
