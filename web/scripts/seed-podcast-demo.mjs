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
    about_episode:
      "This week we follow a real neighborhood thread that started with a simple question: who ordered a full pallet of goods to a porch that swears it never clicked checkout? Within hours, half the block was offering theories about mistaken addresses, porch pirates staging a return, and one neighbor who insisted it was a dropshipping scam. The original poster stayed remarkably calm while everyone else treated the pallet like a murder mystery with worse lighting.\n\nWe read the highlights aloud, including the moment someone suggested calling the carrier and the replies that treated that idea like radical activism. By the end, you will understand why a cardboard box can feel like a referendum on trust, boundaries, and whether anyone on your street actually knows how logistics work.",
    description:
      "We unpack a thread about a mystery package that was definitely not ordered by anyone on the block.",
    show_notes:
      "Demo seed. Tags: package, porch, neighbor dispute. Good embedding overlap with delivery topics.",
    title: "The Case of the Accidental Pallet Delivery",
  },
  {
    about_episode:
      "Someone shared Ring footage of a raccoon treating a recycling bin like a VIP lounge, and the comments turned into wildlife documentary narration, mild rabies panic, and genuine admiration for the animal’s commitment to the bit. We slow the clip down in spirit, rank the funniest replies—including the person who blamed the HOA for insufficient bin latches and the neighbor who insisted the raccoon was a regular—and talk about why security-cam culture turns every trash panda into a celebrity with a storyline. If you have ever watched a twelve-second video for twenty minutes because the thread kept getting better, this one is for you.",
    description:
      "Someone’s Ring camera caught a raccoon hosting a solo rave in a recycling bin. The comments spiral.",
    show_notes: "Demo seed. Animal content + security cam + humor.",
    title: "Trash Panda After Dark",
  },
  {
    about_episode:
      "What began as a courteous note about early-morning leaf blowing became a twelve-reply saga that referenced property rights, parenting schedules, and at least one metaphor about freedom that did not quite land. We walk through the thread in order so you can feel the tension rise from “just asking” to “I will not be silenced by mulch.”\n\nWe also pause to ask why noise disputes online always attract someone who claims to work nights and someone else who claims to work from home, as if the block is running a small census. The episode closes with a few practical ideas for de-escalation that do not involve inventing new amendments.",
    description:
      "A polite request for quiet hours turns into a twelve-reply saga about leaf blower constitutional rights.",
    show_notes: "Demo seed. Noise + HOA-adjacent tension.",
    title: "Leaf Blower Diplomacy",
  },
  {
    about_episode:
      "Summer heat hit, an ice cream van rolled through, and one neighbor asked—innocently or not—whether anyone else thought the timing was a little too perfect. Within a day the thread had split into Team Innocent Treats and Team This Is How They Get You, complete with anecdotes about childhood summers and one person who linked to an article that did not support their point.\n\nWe unpack how quickly a harmless jingle can become a Rorschach test for how much you trust strangers in vehicles. Along the way we highlight the funniest attempts at detective work, including a debate about whether the van’s stickers looked “official enough.”\n\nBy the finale we are less interested in solving the mystery than in naming the real villain: group chat momentum and the human need to have a take before dessert melts.",
    description:
      "Is that van selling ice cream or collecting data? The neighborhood splits into teams.",
    show_notes: "Demo seed. Suspicion + kids + summer.",
    title: "The Ice Cream Van Conspiracy",
  },
  {
    about_episode:
      "A free sectional appeared on the curb one morning and by sunset it had a name, a fan account in the comments, and three competing origin stories involving divorce, renovation, and a questionable upholstery choice. We treat the couch like a character and trace how fast local humor can turn a piece of furniture into neighborhood lore.\n\nPeople posted photos from different angles, argued about bedbugs with the confidence of people who had never inspected the thing, and someone offered to “save it for art.” We read the thread with the respect it deserves, which is to say we laugh but also admit we would have walked over to look too.",
    description:
      "A free couch on the curb develops a personality and its own fan club within six hours.",
    show_notes: "Demo seed. Classifieds + absurdity.",
    title: "The Legend of Sectional Steve",
  },
  {
    about_episode:
      "Block parties depend on spreadsheets now, and this block discovered that two neighbors both believed they invented the Official Potluck Sign-Up. The receipts arrived as screenshots, color-coded tabs, and timestamps that half the thread could not parse. We narrate the escalation from polite confusion to full attribution war, complete with accusations about who changed column widths.\n\nMid-episode we talk about why shared documents make people braver than they would be at the mailbox. We also salute the hero who suggested merging sheets and was ignored because drama is more fun than Google Drive hygiene.\n\nThe ending is surprisingly wholesome if you squint, and still funny if you do not.",
    description:
      "Two neighbors both claim they invented the block party potluck spreadsheet. Spreadsheet screenshots follow.",
    show_notes: "Demo seed. Community + petty + tech.",
    title: "Potluck Attribution War",
  },
  {
    about_episode:
      "A blurry photo claimed to show a snake the size of a hose, and the neighborhood responded with genuine fear, instant skepticism, and one breathless comment that named seventeen species. We walk through the image like a cold case—shadows, perspective, and the eternal chance that a garden hose is simply having a moment—while actual herpetologists offer calm facts the thread argues with anyway. Along the way we collect the best “I am not a snake person but” replies and salute the neighbor who admitted they once watered the hose by mistake.",
    description:
      "Someone posts a photo of a snake ‘the size of a hose.’ Herpetologists arrive in the comments.",
    show_notes: "Demo seed. Wildlife + fear + experts.",
    title: "Definitely Not a Garden Hose",
  },
  {
    about_episode:
      "Someone posted a missing cat flyer and the neighborhood treated it like a design review at a brutal agency. Comic Sans was named, defended, and condemned. People debated reward amounts, whether to include a phone number, and whether color printing was worth the ink when the cat might already be home.\n\nWe read the thread with sympathy for the owner and awe at how fast aesthetics can hijack a plea for help. A subplot emerges about printer economics, Staples runs, and the neighbor who claimed they could redo the poster for free if everyone stopped yelling.\n\nWe close by separating useful advice from pure roast energy, and we root for the tabby either way.",
    description:
      "A missing cat poster sparks a debate about font choices, reward ethics, and printer ink prices.",
    show_notes: "Demo seed. Pets + design + economics somehow.",
    title: "Comic Sans and the Missing Tabby",
  },
  {
    about_episode:
      "Learning to drive is hard enough without your first parallel parking attempt becoming a neighborhood referendum. This thread started with a dented mailbox, a nervous teenager, and a parent trying to do the right thing by being transparent. Within hours the block offered insurance tips, driving lessons, and a few stories that were more about ego than engineering.\n\nWe track every scrape—literal and metaphorical—and note which replies were genuinely helpful versus performatively stern. Insurance language appears, politely, like a guest who does not want to stay for dinner.\n\nIf you remember white-knuckling a steering wheel while someone watched from a porch, this episode will feel familiar. We end with a little grace for new drivers and a lot of respect for mailboxes that never asked to be part of the curriculum.",
    description:
      "A teenager learning to drive meets a mailbox with opinions. Insurance agents weigh in politely.",
    show_notes: "Demo seed. Cars + learning + property.",
    title: "Parallel Parking vs. One Mailbox",
  },
  {
    about_episode:
      "Garage sales are supposed to be mellow, but two shoppers locked eyes over a lava lamp and the driveway turned into an auction block without a license. Neighbors leaned in, prices climbed in five-dollar increments, and someone started narrating the scene like sports commentary.\n\nWe break down the etiquette questions: who saw it first, whether holding an item counts as a spiritual claim, and when the host should intervene before friendships fracture over wax.\n\nThe thread afterward was half brag, half apology, and fully entertaining. We tell you who got the lamp, what they paid, and why everyone agreed to pretend it was not a big deal even though it clearly was.",
    description:
      "A garage sale becomes a live auction when two people want the same lava lamp.",
    show_notes: "Demo seed. Sales + competition.",
    title: "Lava Lamp Showdown",
  },
  {
    about_episode:
      "A neighbor asked for a reasonable roofer and received forty-seven replies, zero consensus, and three quiet feuds that will outlast anyone’s shingles. We sort the recommendations from the grudge posts, the “use my guy” energy from the “never use that guy” energy, and the one person who pivoted to gutters without warning.\n\nAlong the way we ask why local recommendation threads always include someone who has not had work done since 2009 but still has opinions. We also spotlight the rare helpful comments that actually named licenses, timelines, and realistic price ranges.\n\nBy the end you will know less about who to hire and more about human nature, which is honestly the authentic neighborhood-app experience.",
    description:
      "Someone asks for a ‘reasonable’ roofer. Forty-seven replies, zero consensus, three feuds.",
    show_notes: "Demo seed. Home repair + recommendations.",
    title: "The Roofer Hunger Games",
  },
  {
    about_episode:
      "The block captain posted sensible Halloween traffic rules—slow driving, headlights on, candy on the porch—and the neighborhood responded as if one-way streets were a new form of government overreach. We read the plan line by line and annotate where optimism died.\n\nParents worried about safety, drivers worried about convenience, and someone brought up liability in a tone usually reserved for Supreme Court dissents. We give credit to the volunteers trying to keep kids visible and cars calm.\n\nThe episode lands on a simple truth: holidays plus cars plus group chat equals strong feelings. We still hope everyone got candy and nobody got a ticket.",
    description:
      "A block captain posts rules for trick-or-treat traffic. Chaos ensues about one-way streets.",
    show_notes: "Demo seed. Events + traffic + holidays.",
    title: "Halloween Traffic Control",
  },
  {
    about_episode:
      "A single post about fireworks after dark turned into a referendum on dogs, babies, veterans, and whether freedom sounds like booms or like sleep. We map the teams without pretending there is a clean winner.\n\nDog owners described shaking pets, parents described toddlers who treat thunder like a personal attack, and a few people defended tradition with the intensity of a halftime speech. We try to keep the episode fair even when the thread did not.\n\nIf you have ever stared at your ceiling on July Fourth wondering when the show ends, you will recognize the emotional geometry here. We close with neighborly coexistence as an aspiration, not a guarantee.",
    description:
      "A thread about fireworks becomes a referendum on dogs, babies, and freedom itself.",
    show_notes: "Demo seed. Noise + holidays + polarization.",
    title: "July 4th and the Sensitive Ears Lobby",
  },
  {
    about_episode:
      "Someone posted about a suspicious person walking a dog, and the thread moved fast—too fast—for a story built on a glimpse from a window. Then the dog walker showed up with receipts: a familiar route, a recognizable pup, and a polite correction that still stung.\n\nWe talk about safety posts, implicit bias, and the difference between looking out for neighbors and turning a stranger into a character. The apology posts are awkward; the learning is uneven; the dog remains adorable.\n\nWe end with practical language for reporting real concerns without turning the block into a casting call for villains. Everyone deserves to walk without becoming a headline in someone else’s afternoon.",
    description:
      "A ‘suspicious person walking a dog’ post ages poorly when the dog walker replies with receipts.",
    show_notes: "Demo seed. Safety + misunderstanding.",
    title: "Suspiciously Good Dog Walking",
  },
  {
    about_episode:
      "The sidewalk stayed wet in the same strip every morning, and one neighbor decided it was not weather—it was intent. Accusations of deliberate sprinkler aiming followed, along with diagrams that looked like middle-school science fair projects.\n\nWe cover irrigation basics without pretending we are landscapers, and we highlight the moment someone suggested talking in person instead of posting and was treated like a radical. A subplot involves a measuring cup, a stopwatch, and far too much commitment to winning an argument about mist.\n\nHydration should not be this dramatic, and yet here we are. The episode finishes with a plea for calibration, communication, and dry shoes.",
    description:
      "Someone’s sprinklers are allegedly watering the sidewalk on purpose. Hydrology meets drama.",
    show_notes: "Demo seed. Water + petty conflict.",
    title: "The Great Sprinkler Offense",
  },
  {
    about_episode:
      "Brownies appeared on porches with no note, no signature, and no shortage of gratitude. Then curiosity took over: who baked them, were they safe to eat, and why does generosity make some people suspicious before they say thank you?\n\nWe follow the thread from wholesome appreciation to mild paranoia about allergens, secret ingredients, and whether this was marketing for a home bakery. Someone claimed they could identify the chocolate brand from one bite; someone else suggested calling the police, which felt like a lot for dessert.\n\nWe celebrate anonymous kindness while admitting the internet will always ask for receipts, even for brownies. If you are the mystery baker, you are a legend. If you are not, please still share the recipe off-thread.",
    description:
      "A post asks who left brownies on porches. No one admits it. Everyone wants more brownies.",
    show_notes: "Demo seed. Mystery + food + community.",
    title: "Anonymous Brownie Benefactor",
  },
  {
    about_episode:
      "Two HOA-adjacent threads collided into one mega-thread about exterior paint, and suddenly everyone was an expert on undertones, resale value, and whether Eggshell is a color or a mood. We document the merge like a weather system: warm fronts of personal taste meeting cold fronts of committee rules.\n\nSwatches were photographed in different lights. Neighbors argued about Swiss Coffee as if it were a moral stance. Someone posted a link to a blog that made everything worse.\n\nWe laugh, but we also note how much people care about homes looking intentional. The episode wraps with a sincere nod to compromise, and a joke about sample pots that will outlive us all.",
    description:
      "Two HOA threads merge into one mega-thread about paint swatches and human dignity.",
    show_notes: "Demo seed. HOA + aesthetics.",
    title: "Eggshell vs. Swiss Coffee: A Tragedy",
  },
  {
    about_episode:
      "A straightforward coyote sighting warning spawned fan accounts in the comments, coyote poetry, surprisingly earnest safety tips, and one person who wanted to start a newsletter. We treat the thread like a festival with multiple stages: education, entertainment, and unhinged creativity.\n\nWe separate myth from reality where we can, credit wildlife officers and calm neighbors, and still enjoy the jokes that kept the thread alive past midnight. Coyotes are wild animals; the group chat is another ecosystem entirely.\n\nIf you walk a dog at dusk, take the practical bits seriously. If you are here for the bit, we have haiku.",
    description:
      "A ‘watch out for coyotes’ warning spawns coyote fan accounts and coyote poetry.",
    show_notes: "Demo seed. Wildlife + internet culture.",
    title: "Coyote Content Season",
  },
  {
    about_episode:
      "Someone borrowed a ladder and returned it with modifications nobody asked for—new paint, new stickers, and a personality that did not exist before. The owner stared at the photos. The thread stared back.\n\nWe compare before-and-after shots like art critics and ask when a favor crosses into folk art. Subplots include liability, gratitude, and the phrase “I thought you would not mind” appearing like a haunting.\n\nThe ladder now has lore, nicknames, and a fan club. We close with a gentle reminder to return tools in the condition you received them, unless you are prepared to become a character in someone else’s podcast.",
    description:
      "Someone borrows a ladder and returns it… creatively. The ladder now has lore.",
    show_notes: "Demo seed. Tools + favors + comedy.",
    title: "The Ladder Came Back Different",
  },
  {
    about_episode:
      "The neighborhood agreed fireworks should end at ten—except nobody agreed what ten means. Ten on the dot? Ten-ish? The minute after ten if you already lit the fuse? The thread consumed a weekend and several marriages of convenience between courtesy and stubbornness.\n\nWe timestamp the debate, highlight the house that claims atomic-clock authority, and note the neighbor who measured booms like a scientist with a grudge. Precision becomes personality; sleep becomes politics.\n\nYou will leave this episode knowing that community rules are only as strong as the people enforcing them with flashlights and sighs. We still wish everyone sweet dreams, eventually.",
    description:
      "A debate about whether fireworks are ‘over’ at 10pm or 10:01pm consumes the weekend.",
    show_notes: "Demo seed. Time + noise + precision.",
    title: "Ten PM Sharp",
  },
  {
    about_episode:
      "A curb pile offered a VCR, a handwritten note that read like a prophecy, and three neighbors who swore the machine still rewound tapes with satisfying mechanical confidence. We sort nostalgia from nonsense and ask why free piles attract both treasure hunters and amateur mythmakers.\n\nThe thread debated whether old electronics belong in a museum, a landfill, or your basement next to cables you refuse to throw away. Someone claimed the VCR played a specific movie on repeat; someone else said that was impossible; everyone was entertained.\n\nWe close with a short meditation on curb ethics: take what you need, leave the street cleaner than you found it, and maybe do not start a cult around a Magnavox.",
    description:
      "A free pile includes a VCR, a prophecy, and three people who swear it still works.",
    show_notes: "Demo seed. Classifieds + nostalgia.",
    title: "The VCR Prophecy",
  },
  {
    about_episode:
      "Security lights make sense until one fixture decides the cul-de-sac should look like a harbor at midnight. Tired parents, stargazers, and the neighbor with blackout curtains all arrived in the comments with different definitions of reasonable brightness.\n\nWe walk through lumens like laypeople, acknowledge real safety concerns, and still laugh at the phrase “auditioning for a lighthouse.” Someone posted a photo that looked like daylight at eleven pm; someone else defended it like a sibling.\n\nThe episode argues for shields, timers, and neighborly angles—literally and figuratively. Sleep is a shared resource, even if your motion sensor disagrees.",
    description:
      "A neighbor’s security light is accused of auditioning for a lighthouse.",
    show_notes: "Demo seed. Light pollution + sleep.",
    title: "Beacon on Birch Street",
  },
  {
    about_episode:
      "A kid’s lemonade stand should be pure summer joy, but this neighborhood turned it into a surprisingly detailed seminar on permits, zoning, food handling, and whether ice counts as an ingredient you must disclose. We separate cheer from bureaucracy without picking on children, who did nothing wrong except sell a delicious beverage.\n\nThe thread featured a lawyer three doors down who tried to be helpful and still got argued with. Someone brought up HOA rules; someone else brought up childhood memories; everyone brought opinions.\n\nWe land on a hopeful note: support small entrepreneurs, tip in stickers or singles, and maybe let city hall stay out of a folding table unless someone is actually getting sick. The lemonade was reportedly excellent.",
    description:
      "A kid’s lemonade stand triggers a surprisingly detailed conversation about permits.",
    show_notes: "Demo seed. Kids + bureaucracy.",
    title: "Lemonade Stand Jurisprudence",
  },
  {
    about_episode:
      "Bigfoot rumors started with a blurry photo taken at the exact wrong moment and ended with a coat on a chair that had never asked to be famous. The thread split between instant debunkers, cautious believers, and people who just wanted better focus settings on phones.\n\nWe celebrate the commenter who circled the sleeve and the one who still believes, because neighborhood lore needs its poets too. We also talk about how fear spreads faster than pixels.\n\nThis episode is funny, but it is also a small reminder to verify before you amplify. Cryptids are rare; coats are everywhere.",
    description:
      "Someone posts a blurry photo of a ‘bigfoot.’ It is absolutely a coat on a chair.",
    show_notes: "Demo seed. Cryptid + photography.",
    title: "Coat on a Chair: Special Edition",
  },
  {
    about_episode:
      "This month had range: possums in places possums should not be, potholes that became personality traits, and passive voice in posts that refused to name names while naming everyone indirectly. We recap the greatest hits the way you would recap a season finale—fast, fond, and a little overwhelmed.\n\nEach story gets enough room to breathe so you remember why these threads matter beyond the joke. Neighbors argue, neighbors help, and sometimes they do both in the same afternoon.\n\nWe picked highlights for variety so embeddings stay spicy and the demo data feels lived-in. Thank you for scrolling responsibly; we will be back when someone’s trash can achieves sentience again.",
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
    episodeRow.about_episode ?? "",
    episodeRow.show_notes ?? "",
  ];
  const text = parts
    .filter(Boolean)
    .join("\n\n")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    throw new Error(
      `Episode ${episodeId} has empty title/description/about_episode/show_notes; cannot embed (required).`
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
      about_episode: seed.about_episode,
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
      about_episode: seed.about_episode,
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
