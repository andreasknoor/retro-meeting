import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.cron("purge expired admin sessions and old login attempts", "17 3 * * *", internal.admin.purgeExpired, {});

crons.interval("pause or finish forgotten retros", { minutes: 15 }, internal.autoStop.run, {});

export default crons;
