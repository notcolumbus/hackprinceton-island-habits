/**
 * test-convex-access.ts
 *
 * Smoke test: confirms the Photon agent env can talk to Convex and
 * read the tables the completion-aware listener will rely on.
 *
 * Usage:
 *   npx tsx scripts/test-convex-access.ts                 # env + connectivity only
 *   npx tsx scripts/test-convex-access.ts --code ABC123   # inspect one island by code
 *   npx tsx scripts/test-convex-access.ts --phone +15551234567
 *       # list islands for a phone / iCloud email, plus their goals
 *
 * Required env (apps/agent/.env):
 *   CONVEX_URL=https://<your-deployment>.convex.cloud
 */

import { ConvexHttpClient } from "convex/browser";
import "dotenv/config";

// Strip trailing slash — ConvexHttpClient builds "${address}/api/query", so
// a trailing slash produces a double-slash URL that returns an empty body
// and surfaces as an undecipherable `new Error("")`.
const CONVEX_URL = (process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL ?? "").replace(/\/+$/, "");

function banner(title: string): void {
  console.log("\n" + "─".repeat(60));
  console.log(title);
  console.log("─".repeat(60));
}

async function inspectByCode(convex: ConvexHttpClient, code: string): Promise<void> {
  banner(`Island by code: ${code}`);
  const island: any = await convex.query("islands:getIslandByCode" as any, { code });
  if (!island) {
    console.log("  (no island found with that code)");
    return;
  }
  console.log(`  _id=${island._id}  name=${island.name}  status=${island.status}`);
  console.log(`  level=${island.islandLevel}  xp=${island.xp}  currency=${island.currency}`);
  console.log(`  members (from phoneNumbers field): ${island.phoneNumbers.join(", ")}`);

  banner(`Details for island ${island._id}`);
  const details: any = await convex.query("islands:getIslandDetails" as any, {
    islandId: island._id,
  });
  console.log(`  members: ${details.members.length}`);
  for (const m of details.members) {
    console.log(`    • ${m.phoneNumber}  role=${m.role}`);
  }
  console.log(`  agents:  ${details.agents.length}`);
  for (const a of details.agents) {
    console.log(
      `    • phone=${a.phoneNumber}  motivation=${a.motivation}  profile="${a.personalityProfile.slice(0, 60)}..."`,
    );
  }

  banner(`Goals on island ${island._id}`);
  const goals: any[] = await convex.query("goals:getIslandGoals" as any, {
    islandId: island._id,
  });
  if (!goals.length) {
    console.log("  (no active goals)");
    return;
  }
  for (const g of goals) {
    console.log(`  • [${g.phoneNumber}] "${g.text}"  (id=${g._id})`);
  }

  // For the first member with goals, show today's check-ins too.
  const firstPhone = goals[0].phoneNumber;
  const today = new Date().toISOString().slice(0, 10);
  banner(`Today's check-ins for ${firstPhone} (${today})`);
  const checkIns: any[] = await convex.query("goals:getTodayCheckIns" as any, {
    islandId: island._id,
    phoneNumber: firstPhone,
    date: today,
  });
  console.log(`  ${checkIns.length} check-in(s)`);
  for (const c of checkIns) {
    console.log(`    • goalId=${c.goalId}  completed=${c.completed}`);
  }
}

async function inspectByPhone(convex: ConvexHttpClient, phone: string): Promise<void> {
  banner(`Islands for ${phone}`);
  const islands: any[] = await convex.query("islands:getIslandsByPhone" as any, {
    phoneNumber: phone,
  });
  if (!islands.length) {
    console.log("  (no islands found — is this the exact phone/email stored in islandMembers?)");
    return;
  }
  for (const i of islands) {
    console.log(`  • ${i.code}  ${i.name}  status=${i.status}  xp=${i.xp}`);
  }

  const first = islands[0];
  banner(`Active goals for ${phone} on ${first.code}`);
  const goals: any[] = await convex.query("goals:getGoals" as any, {
    islandId: first._id,
    phoneNumber: phone,
  });
  if (!goals.length) {
    console.log("  (no active goals)");
    return;
  }
  for (const g of goals) {
    console.log(`  • "${g.text}"  id=${g._id}`);
  }
}

async function main(): Promise<void> {
  banner("Convex access smoke test");
  console.log(`  CONVEX_URL = ${CONVEX_URL ?? "(missing!)"}`);
  if (!CONVEX_URL) {
    console.error(
      "\n❌ CONVEX_URL not set. Add it to apps/agent/.env, e.g.:\n" +
        "   CONVEX_URL=https://tidy-vole-519.convex.cloud",
    );
    process.exit(1);
  }

  const convex = new ConvexHttpClient(CONVEX_URL);

  const argv = process.argv.slice(2);
  const codeIdx = argv.indexOf("--code");
  const phoneIdx = argv.indexOf("--phone");

  try {
    if (codeIdx !== -1 && argv[codeIdx + 1]) {
      await inspectByCode(convex, argv[codeIdx + 1].toUpperCase());
    } else if (phoneIdx !== -1 && argv[phoneIdx + 1]) {
      await inspectByPhone(convex, argv[phoneIdx + 1]);
    } else {
      // No target supplied — try a harmless query to prove the URL is reachable.
      banner("Connectivity probe (no args)");
      const probe: any = await convex.query("islands:getIslandByCode" as any, {
        code: "XXXXXX",
      });
      console.log(
        `  ✅ Convex responded. Probe returned: ${probe === null ? "null (expected)" : JSON.stringify(probe)}`,
      );
      console.log(
        "\n  Now try:  npx tsx scripts/test-convex-access.ts --code <room-code>\n" +
          "       or:  npx tsx scripts/test-convex-access.ts --phone +15551234567",
      );
    }
    console.log("\n✅ Done.\n");
  } catch (err: any) {
    console.error("\n❌ Convex call failed:");
    console.error(`   message:    ${err?.message || "(empty)"}`);
    console.error(`   name:       ${err?.name || "(empty)"}`);
    console.error(`   status:     ${err?.status ?? "(n/a)"}`);
    console.error(`   statusText: ${err?.statusText ?? "(n/a)"}`);
    if (err?.data) console.error(`   data:       ${JSON.stringify(err.data).slice(0, 300)}`);
    console.error(`   toString:   ${String(err).slice(0, 300)}`);
    if (err?.stack) console.error(`   stack:      ${err.stack.split("\n").slice(0, 3).join(" | ")}`);
    process.exit(1);
  }
}

main();
