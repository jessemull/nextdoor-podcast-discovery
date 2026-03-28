/**
 * Seed published demo podcast episodes with multiple images and OpenAI embeddings
 * (required for Related Episodes / get_similar_episodes).
 *
 * Prerequisites (place under web/public/examples/):
 *   - example-image-1.jpg
 *   - example-image-2.jpg
 *   - example-image-3.jpg
 *   - example-audio.mp3
 *
 * Env (e.g. web/.env.local):
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_KEY
 *   - OPENAI_API_KEY (required; script exits if missing)
 *
 * Usage (from web/):  node scripts/seed-podcast-demo.mjs
 * Reset demo slugs:    node scripts/seed-podcast-demo.mjs --reset-demo
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import OpenAI from "openai";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, "..");
const EXAMPLES_DIR = join(WEB_ROOT, "public", "examples");

const BUCKET_AUDIO_PRIVATE = "episode-audio-private";
const BUCKET_AUDIO_PUBLIC = "episode-audio";
const BUCKET_IMAGES_PRIVATE = "episode-images-private";
const BUCKET_IMAGES_PUBLIC = "episode-images";

const DEMO_SLUG_PREFIX = "demo-";
const EMBEDDING_MODEL = "text-embedding-3-small";

const STORAGE = {
  audio: "demo/seed/audio.mp3",
  image1: "demo/seed/image-1.jpg",
  image2: "demo/seed/image-2.jpg",
  image3: "demo/seed/image-3.jpg",
};

const REQUIRED_FILES = [
  "example-audio.mp3",
  "example-image-1.jpg",
  "example-image-2.jpg",
  "example-image-3.jpg",
];

const CATEGORIES = [
  {
    description: "Odd neighbor stories and HOA energy.",
    name: "Neighborhood Drama",
    slug: "demo-neighborhood-drama",
  },
  {
    description: "Lost pets, found pets, and drama at the dog park.",
    name: "Pets and Wildlife",
    slug: "demo-pets-wildlife",
  },
  {
    description: "Suspicious vans, porch pirates, and ring cam lore.",
    name: "Safety and Suspicion",
    slug: "demo-safety-suspicion",
  },
  {
    description: "Who has a ladder, who needs sugar at 9pm.",
    name: "Recommendations and Favors",
    slug: "demo-recommendations",
  },
  {
    description: "Garage sales, free curbs, and marketplace chaos.",
    name: "Classifieds Vibes",
    slug: "demo-classifieds",
  },
  {
    description: "Leaf blowers, fence lines, and passive-aggressive notes.",
    name: "Noise and Nuisance",
    slug: "demo-noise-nuisance",
  },
  {
    description: "Speeders, parking spots, and street justice.",
    name: "Cars and Streets",
    slug: "demo-cars-streets",
  },
  {
    description: "Events, block parties, and who brought what.",
    name: "Community Events",
    slug: "demo-community-events",
  },
  {
    description: "Contractors, roof leaks, and permit gossip.",
    name: "Home and Repairs",
    slug: "demo-home-repairs",
  },
  {
    description: "The posts that make you screenshot for the group chat.",
    name: "Greatest Hits",
    slug: "demo-greatest-hits",
  },
];

const EPISODE_SEEDS = [
  {
    description:
      "We unpack a thread about a mystery package that was definitely not ordered by anyone on the block.",
    show_notes:
      "Demo seed. Tags: package, porch, neighbor dispute. Good embedding overlap with delivery topics.",
    title: "The Case of the Accidental Pallet Delivery",
  },
  {
    description:
      "Someone’s Ring camera caught a raccoon hosting a solo rave in a recycling bin. The comments spiral.",
    show_notes: "Demo seed. Animal content + security cam + humor.",
    title: "Trash Panda After Dark",
  },
  {
    description:
      "A polite request for quiet hours turns into a twelve-reply saga about leaf blower constitutional rights.",
    show_notes: "Demo seed. Noise + HOA-adjacent tension.",
    title: "Leaf Blower Diplomacy",
  },
  {
    description:
      "Is that van selling ice cream or collecting data? The neighborhood splits into teams.",
    show_notes: "Demo seed. Suspicion + kids + summer.",
    title: "The Ice Cream Van Conspiracy",
  },
  {
    description:
      "A free couch on the curb develops a personality and its own fan club within six hours.",
    show_notes: "Demo seed. Classifieds + absurdity.",
    title: "The Legend of Sectional Steve",
  },
  {
    description:
      "Two neighbors both claim they invented the block party potluck spreadsheet. Spreadsheet screenshots follow.",
    show_notes: "Demo seed. Community + petty + tech.",
    title: "Potluck Attribution War",
  },
  {
    description:
      "Someone posts a photo of a snake ‘the size of a hose.’ Herpetologists arrive in the comments.",
    show_notes: "Demo seed. Wildlife + fear + experts.",
    title: "Definitely Not a Garden Hose",
  },
  {
    description:
      "A missing cat poster sparks a debate about font choices, reward ethics, and printer ink prices.",
    show_notes: "Demo seed. Pets + design + economics somehow.",
    title: "Comic Sans and the Missing Tabby",
  },
  {
    description:
      "A teenager learning to drive meets a mailbox with opinions. Insurance agents weigh in politely.",
    show_notes: "Demo seed. Cars + learning + property.",
    title: "Parallel Parking vs. One Mailbox",
  },
  {
    description:
      "A garage sale becomes a live auction when two people want the same lava lamp.",
    show_notes: "Demo seed. Sales + competition.",
    title: "Lava Lamp Showdown",
  },
  {
    description:
      "Someone asks for a ‘reasonable’ roofer. Forty-seven replies, zero consensus, three feuds.",
    show_notes: "Demo seed. Home repair + recommendations.",
    title: "The Roofer Hunger Games",
  },
  {
    description:
      "A block captain posts rules for trick-or-treat traffic. Chaos ensues about one-way streets.",
    show_notes: "Demo seed. Events + traffic + holidays.",
    title: "Halloween Traffic Control",
  },
  {
    description:
      "A thread about fireworks becomes a referendum on dogs, babies, and freedom itself.",
    show_notes: "Demo seed. Noise + holidays + polarization.",
    title: "July 4th and the Sensitive Ears Lobby",
  },
  {
    description:
      "A ‘suspicious person walking a dog’ post ages poorly when the dog walker replies with receipts.",
    show_notes: "Demo seed. Safety + misunderstanding.",
    title: "Suspiciously Good Dog Walking",
  },
  {
    description:
      "Someone’s sprinklers are allegedly watering the sidewalk on purpose. Hydrology meets drama.",
    show_notes: "Demo seed. Water + petty conflict.",
    title: "The Great Sprinkler Offense",
  },
  {
    description:
      "A post asks who left brownies on porches. No one admits it. Everyone wants more brownies.",
    show_notes: "Demo seed. Mystery + food + community.",
    title: "Anonymous Brownie Benefactor",
  },
  {
    description:
      "Two HOA threads merge into one mega-thread about paint swatches and human dignity.",
    show_notes: "Demo seed. HOA + aesthetics.",
    title: "Eggshell vs. Swiss Coffee: A Tragedy",
  },
  {
    description:
      "A ‘watch out for coyotes’ warning spawns coyote fan accounts and coyote poetry.",
    show_notes: "Demo seed. Wildlife + internet culture.",
    title: "Coyote Content Season",
  },
  {
    description:
      "Someone borrows a ladder and returns it… creatively. The ladder now has lore.",
    show_notes: "Demo seed. Tools + favors + comedy.",
    title: "The Ladder Came Back Different",
  },
  {
    description:
      "A debate about whether fireworks are ‘over’ at 10pm or 10:01pm consumes the weekend.",
    show_notes: "Demo seed. Time + noise + precision.",
    title: "Ten PM Sharp",
  },
  {
    description:
      "A free pile includes a VCR, a prophecy, and three people who swear it still works.",
    show_notes: "Demo seed. Classifieds + nostalgia.",
    title: "The VCR Prophecy",
  },
  {
    description:
      "A neighbor’s security light is accused of auditioning for a lighthouse.",
    show_notes: "Demo seed. Light pollution + sleep.",
    title: "Beacon on Birch Street",
  },
  {
    description:
      "A kid’s lemonade stand triggers a surprisingly detailed conversation about permits.",
    show_notes: "Demo seed. Kids + bureaucracy.",
    title: "Lemonade Stand Jurisprudence",
  },
  {
    description:
      "Someone posts a blurry photo of a ‘bigfoot.’ It is absolutely a coat on a chair.",
    show_notes: "Demo seed. Cryptid + photography.",
    title: "Coat on a Chair: Special Edition",
  },
  {
    description:
      "We recap the greatest hits of the month: possums, potholes, and passive voice.",
    show_notes: "Demo seed. Recap + variety for embedding diversity.",
    title: "Monthly Chaos Roundup",
  },
];

function loadEnvLocal() {
  const envPath = join(WEB_ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = val;
  }
}

async function copyPrivateToPublic(supabase, type, storagePath) {
  const privateBucket =
    type === "audio" ? BUCKET_AUDIO_PRIVATE : BUCKET_IMAGES_PRIVATE;
  const publicBucket =
    type === "audio" ? BUCKET_AUDIO_PUBLIC : BUCKET_IMAGES_PUBLIC;

  const { data: blob, error: downloadError } = await supabase.storage
    .from(privateBucket)
    .download(storagePath);

  if (downloadError || !blob) {
    throw new Error(
      `Download failed (${privateBucket}/${storagePath}): ${downloadError?.message ?? "unknown"}`
    );
  }

  const buf = Buffer.from(await blob.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(publicBucket)
    .upload(storagePath, buf, {
      contentType: blob.type || undefined,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(
      `Public upload failed (${publicBucket}): ${uploadError.message}`
    );
  }

  const { data: urlData } = supabase.storage
    .from(publicBucket)
    .getPublicUrl(storagePath);
  return urlData.publicUrl;
}

async function uploadFileToPrivate(supabase, bucket, storagePath, diskPath, contentType) {
  const body = readFileSync(diskPath);
  const { error } = await supabase.storage.from(bucket).upload(storagePath, body, {
    contentType,
    upsert: true,
  });
  if (error) {
    throw new Error(`Upload failed (${bucket}/${storagePath}): ${error.message}`);
  }
}

function imagePathsByIndex(idx) {
  const map = {
    0: STORAGE.image1,
    1: STORAGE.image2,
    2: STORAGE.image3,
  };
  return map[idx];
}

function diskImageByIndex(idx) {
  return join(EXAMPLES_DIR, `example-image-${idx + 1}.jpg`);
}

function gallerySpecForEpisode(index) {
  const useThree = index < Math.ceil(EPISODE_SEEDS.length / 2);
  const base = [index % 3, (index + 1) % 3];
  const indices = useThree ? [...base, (index + 2) % 3] : base;
  const captions = [
    "Episode still — wide shot.",
    "Episode still — reaction cam.",
    "Episode still — evidence board energy.",
  ];
  return indices.map((imgIdx, sortOrder) => ({
    description: captions[imgIdx] ?? `Still ${sortOrder + 1}.`,
    imageIndex: imgIdx,
    sort_order: sortOrder,
  }));
}

async function upsertEpisodeEmbedding(openai, supabase, episodeId, episodeRow) {
  const parts = [
    episodeRow.title ?? "",
    episodeRow.description ?? "",
    episodeRow.show_notes ?? "",
  ];
  const text = parts
    .filter(Boolean)
    .join("\n\n")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    throw new Error(
      `Episode ${episodeId} has empty title/description/show_notes; cannot embed (required).`
    );
  }

  const embeddingResponse = await openai.embeddings.create({
    input: text.slice(0, 8000),
    model: EMBEDDING_MODEL,
  });
  const embedding = embeddingResponse.data[0]?.embedding;
  if (!embedding || embedding.length !== 1536) {
    throw new Error("OpenAI returned invalid embedding dimension");
  }

  const { error } = await supabase.from("episode_embeddings").upsert(
    {
      embedding,
      episode_id: episodeId,
      model: EMBEDDING_MODEL,
    },
    { onConflict: "episode_id" }
  );

  if (error) {
    throw new Error(error.message ?? "episode_embeddings upsert failed");
  }
}

async function resetDemoEpisodes(supabase) {
  const { error } = await supabase
    .from("podcast_episodes")
    .delete()
    .like("slug", `${DEMO_SLUG_PREFIX}%`);

  if (error) {
    throw new Error(`reset-demo delete failed: ${error.message}`);
  }
}

async function main() {
  loadEnvLocal();

  const resetDemo = process.argv.includes("--reset-demo");

  for (const name of REQUIRED_FILES) {
    const p = join(EXAMPLES_DIR, name);
    if (!existsSync(p)) {
      console.error(
        `Missing required file: ${p}\n` +
          "Add example-image-1.jpg, example-image-2.jpg, example-image-3.jpg, and example-audio.mp3 under web/public/examples/"
      );
      process.exit(1);
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_KEY (e.g. in web/.env.local).");
    process.exit(1);
  }
  if (!openaiKey) {
    console.error(
      "OPENAI_API_KEY is required to seed episode_embeddings (Related Episodes). Set it in web/.env.local."
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const openai = new OpenAI({ apiKey: openaiKey });

  if (resetDemo) {
    console.log("Removing existing demo-* episodes (cascades images, embeddings, links)…");
    await resetDemoEpisodes(supabase);
  }

  console.log("Uploading demo media to private buckets…");
  await uploadFileToPrivate(
    supabase,
    BUCKET_AUDIO_PRIVATE,
    STORAGE.audio,
    join(EXAMPLES_DIR, "example-audio.mp3"),
    "audio/mpeg"
  );
  for (let i = 0; i < 3; i += 1) {
    await uploadFileToPrivate(
      supabase,
      BUCKET_IMAGES_PRIVATE,
      imagePathsByIndex(i),
      diskImageByIndex(i),
      "image/jpeg"
    );
  }

  console.log("Copying to public buckets…");
  const audioPublicUrl = await copyPrivateToPublic(supabase, "audio", STORAGE.audio);
  const imagePublicUrls = [];
  for (let i = 0; i < 3; i += 1) {
    imagePublicUrls.push(
      await copyPrivateToPublic(supabase, "image", imagePathsByIndex(i))
    );
  }

  console.log("Upserting categories…");
  for (const cat of CATEGORIES) {
    const { error } = await supabase.from("podcast_categories").upsert(
      {
        description: cat.description,
        name: cat.name,
        slug: cat.slug,
      },
      { onConflict: "slug" }
    );
    if (error) throw new Error(`category upsert ${cat.slug}: ${error.message}`);
  }

  const { data: categoryRows, error: catFetchErr } = await supabase
    .from("podcast_categories")
    .select("id, slug")
    .in(
      "slug",
      CATEGORIES.map((c) => c.slug)
    );

  if (catFetchErr || !categoryRows?.length) {
    throw new Error(catFetchErr?.message ?? "Failed to load category ids");
  }

  const categoryIdBySlug = Object.fromEntries(
    categoryRows.map((r) => [r.slug, r.id])
  );

  const now = new Date().toISOString();

  for (let i = 0; i < EPISODE_SEEDS.length; i += 1) {
    const seed = EPISODE_SEEDS[i];
    const slug = `${DEMO_SLUG_PREFIX}${String(i + 1).padStart(2, "0")}`;
    const gallery = gallerySpecForEpisode(i);

    const firstSpec = gallery[0];
    const firstPath = imagePathsByIndex(firstSpec.imageIndex);
    const firstPublic = imagePublicUrls[firstSpec.imageIndex];

    const episodePayload = {
      audio_storage_path: STORAGE.audio,
      audio_url: audioPublicUrl,
      description: seed.description,
      duration_seconds: 120 + (i % 240),
      image_description: firstSpec.description,
      image_storage_path: firstPath,
      image_url: firstPublic,
      order_index: i,
      published_at: now,
      show_notes: seed.show_notes,
      slug,
      status: "published",
      title: seed.title,
      transcript: null,
    };

    const { data: epRow, error: epErr } = await supabase
      .from("podcast_episodes")
      .upsert(episodePayload, { onConflict: "slug" })
      .select("id")
      .single();

    if (epErr || !epRow) {
      throw new Error(`episode upsert ${slug}: ${epErr?.message ?? "no row"}`);
    }

    const episodeId = epRow.id;

    await supabase.from("podcast_episode_images").delete().eq("episode_id", episodeId);

    const imageRows = gallery.map((g) => ({
      description: g.description,
      episode_id: episodeId,
      image_storage_path: imagePathsByIndex(g.imageIndex),
      image_url: imagePublicUrls[g.imageIndex],
      sort_order: g.sort_order,
    }));

    const { error: imgErr } = await supabase
      .from("podcast_episode_images")
      .insert(imageRows);

    if (imgErr) {
      throw new Error(`podcast_episode_images ${slug}: ${imgErr.message}`);
    }

    const catSlug = CATEGORIES[i % CATEGORIES.length].slug;
    const categoryId = categoryIdBySlug[catSlug];
    await supabase.from("episode_categories").delete().eq("episode_id", episodeId);
    const { error: linkErr } = await supabase.from("episode_categories").insert({
      category_id: categoryId,
      episode_id: episodeId,
    });
    if (linkErr) {
      throw new Error(`episode_categories ${slug}: ${linkErr.message}`);
    }

    await upsertEpisodeEmbedding(openai, supabase, episodeId, {
      description: seed.description,
      show_notes: seed.show_notes,
      title: seed.title,
    });

    console.log(`Seeded ${slug} (${i + 1}/${EPISODE_SEEDS.length})`);
  }

  console.log("Done. Demo episodes are published with images and embeddings.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
