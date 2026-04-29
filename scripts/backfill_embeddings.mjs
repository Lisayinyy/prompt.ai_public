#!/usr/bin/env node
/**
 * v9.3: 历史 prompts embedding backfill (Cloudflare bge-m3 版)
 *
 * 用法：
 *   1. 设置环境变量：
 *      export SUPABASE_URL="https://vyuzkbdxsweaqftyqifh.supabase.co"
 *      export SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"
 *      export WORKER_URL="https://prompt-optimizer-api.prompt-optimizer.workers.dev"
 *
 *   2. 跑：
 *      node scripts/backfill_embeddings.mjs
 *
 * 行为：
 *   - 分批读 prompts WHERE embedding IS NULL
 *   - 调你 worker 的 /embed endpoint 拿 1024 维 bge-m3 向量（Cloudflare AI）
 *   - 逐条 UPDATE 写回
 *   - 进度日志、失败重试、可中断续跑
 *
 * 为什么走 worker /embed 而不是直连 Cloudflare AI:
 *   - worker 已经有 AI binding 配好，不需要再为 backfill 单独搞 CF API token
 *   - 限速天然由 Cloudflare 免费额度 (10k neurons/day) 控制
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WORKER_URL = process.env.WORKER_URL || "https://prompt-optimizer-api.prompt-optimizer.workers.dev";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing env vars. Need: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  console.error("   Optional: WORKER_URL (defaults to prod)");
  process.exit(1);
}

const BATCH_SIZE = 20;             // smaller batch since serial /embed calls
const SLEEP_BETWEEN_CALLS_MS = 100; // gentle rate-limit
const MAX_INPUT_CHARS = 4000;       // matches worker /embed cap
const MAX_RETRIES = 2;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Call worker /embed endpoint for a single text.
 * Returns the 1024-dim embedding array (or null on failure).
 */
async function fetchEmbedding(text, attempt = 0) {
  try {
    const res = await fetch(`${WORKER_URL}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: String(text || "").slice(0, MAX_INPUT_CHARS) }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`worker /embed ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    if (!Array.isArray(data?.embedding) || data.embedding.length !== 1024) {
      throw new Error(`bad embedding shape: len=${data?.embedding?.length}`);
    }
    return data.embedding;
  } catch (e) {
    if (attempt < MAX_RETRIES) {
      console.warn(`  ↻ retry ${attempt + 1}/${MAX_RETRIES}: ${e.message}`);
      await sleep(1000 * (attempt + 1));
      return fetchEmbedding(text, attempt + 1);
    }
    throw e;
  }
}

async function main() {
  console.log("🔍 Counting rows that need embeddings...");
  const { count: total, error: countErr } = await supabase
    .from("prompts")
    .select("id", { count: "exact", head: true })
    .is("embedding", null)
    .not("optimized_text", "is", null);

  if (countErr) {
    console.error("Count error:", countErr);
    process.exit(1);
  }

  if (!total || total === 0) {
    console.log("✅ All prompts already have embeddings. Nothing to do.");
    return;
  }

  console.log(`📊 ${total} rows pending. Calling ${WORKER_URL}/embed (Cloudflare bge-m3)...\n`);

  let processed = 0;
  let failed = 0;

  while (true) {
    const { data: batch, error: fetchErr } = await supabase
      .from("prompts")
      .select("id, original_text, optimized_text")
      .is("embedding", null)
      .not("optimized_text", "is", null)
      .limit(BATCH_SIZE);

    if (fetchErr) {
      console.error("Fetch error:", fetchErr);
      break;
    }
    if (!batch || batch.length === 0) {
      break;
    }

    // Process serially: each prompt → /embed → write back
    // (Cloudflare worker handles concurrency at the AI level naturally)
    for (const row of batch) {
      const orig = String(row.original_text || "").slice(0, 1000);
      const opt = String(row.optimized_text || "").slice(0, 3000);
      const input = `${orig}\n---\n${opt}`;

      let embedding;
      try {
        embedding = await fetchEmbedding(input);
      } catch (e) {
        console.error(`  ✗ ${row.id}: ${e.message}`);
        failed++;
        await sleep(500);
        continue;
      }

      const { error: updErr } = await supabase
        .from("prompts")
        .update({ embedding })
        .eq("id", row.id);

      if (updErr) {
        console.warn(`  ! UPDATE failed for ${row.id}: ${updErr.message}`);
        failed++;
      } else {
        processed++;
      }

      await sleep(SLEEP_BETWEEN_CALLS_MS);
    }

    console.log(`  ✓ ${processed}/${total} processed (${failed} failed)`);
  }

  console.log(`\n🎉 Done. Processed ${processed}, Failed ${failed}.`);
  if (failed > 0) {
    console.log("   Re-run to retry failed rows (already-embedded rows will be skipped).");
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
