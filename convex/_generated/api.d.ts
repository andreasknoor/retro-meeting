/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as clock from "../clock.js";
import type * as health from "../health.js";
import type * as lib_agenda from "../lib/agenda.js";
import type * as lib_phases from "../lib/phases.js";
import type * as lib_retroAccess from "../lib/retroAccess.js";
import type * as lib_validation from "../lib/validation.js";
import type * as phase from "../phase.js";
import type * as retros from "../retros.js";
import type * as retrosNode from "../retrosNode.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  clock: typeof clock;
  health: typeof health;
  "lib/agenda": typeof lib_agenda;
  "lib/phases": typeof lib_phases;
  "lib/retroAccess": typeof lib_retroAccess;
  "lib/validation": typeof lib_validation;
  phase: typeof phase;
  retros: typeof retros;
  retrosNode: typeof retrosNode;
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
