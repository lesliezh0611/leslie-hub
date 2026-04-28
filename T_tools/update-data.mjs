import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const DATA_PATH = new URL('../data.json', import.meta.url);
const USER_AGENT = 'LeslieHubUpdater/1.0 (+https://lesliezh0611.github.io/leslie-hub/)';

function envNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const DEFAULT_TARGET_ITEMS = envNumber('TARGET_ITEMS', 20);
const SECTION_RULES = {
  vibeCoding: {
    targetItems: envNumber('VIBE_TARGET_ITEMS', DEFAULT_TARGET_ITEMS),
    freshnessDays: envNumber('VIBE_MAX_AGE_DAYS', 30)
  },
  english: {
    targetItems: envNumber('ENGLISH_TARGET_ITEMS', DEFAULT_TARGET_ITEMS),
    freshnessDays: envNumber('ENGLISH_MAX_AGE_DAYS', 21)
  },
  overseaMarketing: {
    targetItems: envNumber('NEWS_TARGET_ITEMS', DEFAULT_TARGET_ITEMS),
    freshnessDays: envNumber('NEWS_MAX_AGE_DAYS', 14)
  }
};

const marketingFeeds = [
  { source: 'TechCrunch', lang: 'en', url: 'https://techcrunch.com/feed/' },
  { source: 'The Verge', lang: 'en', url: 'https://www.theverge.com/rss/index.xml' },
  { source: 'Wired', lang: 'en', url: 'https://www.wired.com/feed/rss' },
  { source: 'Adweek', lang: 'en', url: 'https://www.adweek.com/feed/' },
  { source: 'Marketing Dive', lang: 'en', url: 'https://www.marketingdive.com/feeds/news/' },
  { source: 'Marketing Brew', lang: 'en', url: 'https://www.marketingbrew.com/feed.xml' },
  { source: 'Social Media Today', lang: 'en', url: 'https://www.socialmediatoday.com/feeds/news/' },
  { source: 'Retail Dive', lang: 'en', url: 'https://www.retaildive.com/feeds/news/' },
  { source: 'Mobile Marketing Magazine', lang: 'en', url: 'https://mobilemarketingmagazine.com/feed/' }
];

const englishFeeds = [
  { source: "Lenny's Podcast", platform: 'newsletter', url: 'https://www.lennysnewsletter.com/feed' },
  { source: 'Lex Fridman Podcast', platform: 'podcast', url: 'https://lexfridman.com/feed/podcast/' },
  { source: 'The Knowledge Project', platform: 'podcast', url: 'https://fs.blog/knowledge-project-podcast/feed/' }
];

const redditTargets = [
  {
    kind: 'book',
    id: 'en_book_bell_jar',
    title: 'The Bell Jar',
    author: 'Sylvia Plath',
    subreddits: ['books', 'bookreviews'],
    query: 'The Bell Jar Sylvia Plath'
  },
  {
    kind: 'film',
    id: 'en_film_wedding_banquet',
    title: 'The Wedding Banquet (喜宴)',
    year: 1993,
    director: 'Ang Lee',
    subreddits: ['movies', 'TrueFilm', 'flicks'],
    query: 'The Wedding Banquet Ang Lee'
  }
];

const marketingKeywords = [
  'marketing',
  'brand',
  'advertising',
  'creator',
  'creator economy',
  'retail media',
  'growth',
  'campaign',
  'audience',
  'customer',
  'consumer',
  'retail',
  'first-party',
  'shopper',
  'partnership',
  'global expansion',
  'commerce',
  'tiktok',
  'shop',
  'marketplace',
  'social commerce',
  'influencer'
];

function nowISO() {
  return new Date().toISOString();
}

function hash(value) {
  return createHash('sha1').update(value).digest('hex').slice(0, 10);
}

function stripHTML(value = '') {
  return decodeEntities(String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function decodeEntities(value = '') {
  const named = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' '
  };
  return String(value).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return named[entity] ?? match;
  });
}

function getTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? stripHTML(match[1]) : '';
}

function getLink(block) {
  const atom = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  if (atom) return decodeEntities(atom[1].trim());
  return getTag(block, 'link');
}

function parseFeed(xml) {
  const blocks = [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].map(match => match[2]);
  return blocks.map(block => {
    const title = getTag(block, 'title');
    const url = getLink(block);
    const postedAt = getTag(block, 'pubDate') || getTag(block, 'updated') || getTag(block, 'published');
    const text = getTag(block, 'description') || getTag(block, 'summary') || getTag(block, 'content:encoded');
    return {
      title,
      url,
      text,
      postedAt: postedAt ? new Date(postedAt).toISOString() : nowISO()
    };
  }).filter(item => item.title && item.url);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/rss+xml, application/xml, application/json, text/xml, text/plain'
    }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

async function fetchFeed(url) {
  return parseFeed(await fetchText(url));
}

function byNewest(a, b) {
  return new Date(b.postedAt || 0) - new Date(a.postedAt || 0);
}

function ageMs(item) {
  const time = new Date(item.postedAt || 0).getTime();
  return Number.isFinite(time) ? Date.now() - time : Infinity;
}

function isRecent(item, maxDays) {
  return ageMs(item) <= maxDays * 24 * 60 * 60 * 1000;
}

function recentOnly(items, maxDays) {
  return items.filter(item => isRecent(item, maxDays));
}

function uniqueByUrl(items) {
  const seen = new Set();
  return items.filter(item => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function itemId(prefix, url) {
  return `${prefix}_${hash(url)}`;
}

function freshCountLabel(count, freshnessDays) {
  const noun = count === 1 ? 'update' : 'updates';
  return `${count} fresh ${noun} from the last ${freshnessDays} days`;
}

function withFreshnessMeta(module, key, freshCount) {
  const rule = SECTION_RULES[key];
  return {
    ...module,
    targetItems: rule.targetItems,
    freshnessDays: rule.freshnessDays,
    freshCountLabel: freshCountLabel(freshCount, rule.freshnessDays)
  };
}

function mergeSourcesByName(existing = [], additions = []) {
  const seen = new Set();
  return existing.concat(additions).filter(source => {
    const key = source.name || source.handle || source.url;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function withSyncedEnglishSources(module) {
  return {
    ...module,
    sources: mergeSourcesByName(module.sources || [], englishFeeds.map(feed => ({
      name: feed.source,
      platform: feed.platform,
      url: feed.url
    })))
  };
}

function withSyncedMarketingSources(module) {
  return {
    ...module,
    sources: {
      cn: module.sources?.cn || [],
      en: mergeSourcesByName(module.sources?.en || [], marketingFeeds.map(feed => ({
        name: feed.source,
        url: feed.url
      })))
    }
  };
}

async function updateVibeCoding(module) {
  const base = process.env.RSSHUB_BASE_URL?.replace(/\/$/, '');
  const rule = SECTION_RULES.vibeCoding;
  if (!base) {
    console.log(`vibeCoding: RSSHUB_BASE_URL not set; keeping only X articles from the last ${rule.freshnessDays} days.`);
    const articles = recentOnly(module.articles || [], rule.freshnessDays).sort(byNewest).slice(0, rule.targetItems);
    return withFreshnessMeta({
      ...module,
      articles,
      lastUpdated: nowISO()
    }, 'vibeCoding', articles.length);
  }

  const fetched = [];
  for (const source of module.sources || []) {
    const candidates = [
      `${base}/twitter/user/${source.handle}`,
      `${base}/x/user/${source.handle}`
    ];
    let items = [];
    for (const url of candidates) {
      try {
        items = await fetchFeed(url);
        if (items.length) break;
      } catch (error) {
        console.log(`vibeCoding: ${source.handle} feed failed at ${url}: ${error.message}`);
      }
    }
    fetched.push(...items.slice(0, 5).map(item => ({
      id: itemId(`vc_${source.handle}`, item.url),
      source: source.handle,
      sourceName: source.name || source.handle,
      platform: 'x',
      title: item.title,
      url: item.url,
      postedAt: item.postedAt
    })));
  }

  const recentFetched = recentOnly(fetched, rule.freshnessDays);
  if (!recentFetched.length) {
    const articles = recentOnly(module.articles || [], rule.freshnessDays).sort(byNewest).slice(0, rule.targetItems);
    return withFreshnessMeta({
      ...module,
      articles,
      lastUpdated: nowISO()
    }, 'vibeCoding', articles.length);
  }
  const existingByUrl = new Map((module.articles || []).map(item => [item.url, item]));
  const articles = uniqueByUrl(recentFetched)
    .map(item => existingByUrl.has(item.url) ? { ...item, id: existingByUrl.get(item.url).id } : item)
    .sort(byNewest)
    .slice(0, rule.targetItems);
  return withFreshnessMeta({ ...module, articles, lastUpdated: nowISO() }, 'vibeCoding', articles.length);
}

async function updateEnglish(module) {
  module = withSyncedEnglishSources(module);
  const rule = SECTION_RULES.english;
  const podcasts = [];
  for (const feed of englishFeeds) {
    try {
      const items = recentOnly(await fetchFeed(feed.url), rule.freshnessDays);
      podcasts.push(...items.slice(0, 10).map(item => ({
        id: itemId(`en_pod_${feed.source.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`, item.url),
        source: feed.source,
        platform: feed.platform,
        topic: item.title,
        url: item.url,
        postedAt: item.postedAt
      })));
    } catch (error) {
      console.log(`english: ${feed.source} feed failed: ${error.message}`);
    }
  }

  const books = [];
  const films = [];
  for (const target of redditTargets) {
    const reviews = await fetchRedditReviews(target);
    if (target.kind === 'book') {
      books.push({
        id: target.id,
        title: target.title,
        author: target.author,
        reviews: reviews.length ? reviews : module.books?.find(item => item.id === target.id)?.reviews || []
      });
    } else {
      films.push({
        id: target.id,
        title: target.title,
        year: target.year,
        director: target.director,
        reviews: reviews.length ? reviews : module.films?.find(item => item.id === target.id)?.reviews || []
      });
    }
  }

  const freshPodcasts = podcasts.length
    ? uniqueByUrl(podcasts).sort(byNewest).slice(0, rule.targetItems)
    : recentOnly(module.podcasts || [], rule.freshnessDays).sort(byNewest).slice(0, rule.targetItems);

  return withFreshnessMeta({
    ...module,
    podcasts: freshPodcasts,
    books: books.length ? books : module.books,
    films: films.length ? films : module.films,
    lastUpdated: nowISO()
  }, 'english', freshPodcasts.length);
}

async function fetchRedditReviews(target) {
  const reviews = [];
  for (const subreddit of target.subreddits) {
    const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(target.query)}&restrict_sr=1&sort=new&limit=5`;
    try {
      const data = JSON.parse(await fetchText(url));
      for (const child of data?.data?.children || []) {
        const post = child.data;
        if (!post?.permalink || !post?.title) continue;
        const text = stripHTML(post.selftext || post.title).slice(0, 220);
        reviews.push({
          id: itemId(`en_${target.kind}_${subreddit.toLowerCase()}`, `https://www.reddit.com${post.permalink}`),
          reviewer: `u/${post.author}`,
          text,
          url: `https://www.reddit.com${post.permalink}`,
          postedAt: new Date((post.created_utc || Date.now() / 1000) * 1000).toISOString()
        });
      }
    } catch (error) {
      console.log(`reddit: r/${subreddit} search failed: ${error.message}`);
    }
  }
  return uniqueByUrl(reviews).sort(byNewest).slice(0, 5);
}

async function updateOverseaMarketing(module) {
  module = withSyncedMarketingSources(module);
  const rule = SECTION_RULES.overseaMarketing;
  const fetched = [];
  for (const feed of marketingFeeds) {
    try {
      const items = recentOnly(await fetchFeed(feed.url), rule.freshnessDays);
      fetched.push(...items
        .filter(item => isMarketingRelevant(feed.source, item.title, item.text, item.url))
        .slice(0, 8)
        .map(item => ({
          id: itemId('om', item.url),
          source: feed.source,
          lang: feed.lang,
          title: item.title,
          url: item.url,
          postedAt: item.postedAt
        })));
    } catch (error) {
      console.log(`overseaMarketing: ${feed.source} feed failed: ${error.message}`);
    }
  }

  const existing = module.articles || [];
  const recentExisting = recentOnly(existing, rule.freshnessDays);
  const existingCn = recentExisting.filter(item => item.lang === 'cn').slice(0, 4);
  const existingByUrl = new Map(existing.map(item => [item.url, item]));
  const en = uniqueByUrl(fetched)
    .map(item => existingByUrl.has(item.url) ? { ...item, id: existingByUrl.get(item.url).id } : item)
    .sort(byNewest)
    .slice(0, rule.targetItems);

  if (!en.length) {
    const articles = recentExisting.sort(byNewest).slice(0, rule.targetItems);
    return withFreshnessMeta({
      ...module,
      articles,
      lastUpdated: nowISO()
    }, 'overseaMarketing', articles.length);
  }
  const articles = uniqueByUrl(en.concat(existingCn)).sort(byNewest).slice(0, rule.targetItems);
  return withFreshnessMeta({
    ...module,
    articles,
    lastUpdated: nowISO()
  }, 'overseaMarketing', articles.length);
}

function isMarketingRelevant(source, title, text, url = '') {
  if (['Marketing Dive', 'Marketing Brew', 'Mobile Marketing Magazine'].includes(source)) return true;
  if (source === 'Adweek') {
    const urlHaystack = String(url).toLowerCase();
    const titleHaystack = String(title).toLowerCase();
    return /\/brand-marketing\/|\/agencies\/|\/commerce\/|\/performance-marketing\//.test(urlHaystack)
      || marketingKeywords.some(keyword => titleHaystack.includes(keyword));
  }
  const titleHaystack = String(title).toLowerCase();
  if (['TechCrunch', 'The Verge', 'Wired', 'Social Media Today'].includes(source)) {
    return marketingKeywords.some(keyword => titleHaystack.includes(keyword));
  }
  const haystack = `${title} ${text}`.toLowerCase();
  return marketingKeywords.some(keyword => haystack.includes(keyword));
}

function validate(data) {
  const problems = [];
  const explore = data.explore || {};
  for (const [key, module] of Object.entries(explore)) {
    const rule = SECTION_RULES[key];
    if (!rule || !module) continue;
    if (module.targetItems !== rule.targetItems) {
      problems.push(`${key} targetItems should be ${rule.targetItems}`);
    }
    if (module.freshnessDays !== rule.freshnessDays) {
      problems.push(`${key} freshnessDays should be ${rule.freshnessDays}`);
    }
    if (!module.freshCountLabel) {
      problems.push(`${key} freshCountLabel is missing`);
    }
  }
  for (const article of explore.vibeCoding?.articles || []) {
    if (!/https:\/\/x\.com\/[^/]+\/status\/\d+/.test(article.url)) {
      problems.push(`vibeCoding article is not an X status URL: ${article.id}`);
    }
    if (!isRecent(article, SECTION_RULES.vibeCoding.freshnessDays)) {
      problems.push(`vibeCoding article is older than ${SECTION_RULES.vibeCoding.freshnessDays} days: ${article.id}`);
    }
  }
  for (const podcast of explore.english?.podcasts || []) {
    if (!isRecent(podcast, SECTION_RULES.english.freshnessDays)) {
      problems.push(`English podcast/news item is older than ${SECTION_RULES.english.freshnessDays} days: ${podcast.id}`);
    }
  }
  for (const article of explore.overseaMarketing?.articles || []) {
    if (!isRecent(article, SECTION_RULES.overseaMarketing.freshnessDays)) {
      problems.push(`Marketing news item is older than ${SECTION_RULES.overseaMarketing.freshnessDays} days: ${article.id}`);
    }
  }
  if ((explore.vibeCoding?.articles || []).length > SECTION_RULES.vibeCoding.targetItems) {
    problems.push('vibeCoding has more than targetItems articles');
  }
  if ((explore.english?.podcasts || []).length > SECTION_RULES.english.targetItems) {
    problems.push('english has more than targetItems podcast/news items');
  }
  if ((explore.overseaMarketing?.articles || []).length > SECTION_RULES.overseaMarketing.targetItems) {
    problems.push('overseaMarketing has more than targetItems articles');
  }
  const readUrls = [
    ...(explore.english?.podcasts || []),
    ...(explore.english?.books || []).flatMap(book => book.reviews || []),
    ...(explore.english?.films || []).flatMap(film => film.reviews || []),
    ...(explore.overseaMarketing?.articles || [])
  ].map(item => item.url);
  for (const url of readUrls) {
    const parsed = new URL(url);
    if (parsed.pathname === '/' || parsed.pathname === '' || parsed.pathname.endsWith('/chuhai') || parsed.pathname.includes('/search/')) {
      problems.push(`detail URL looks like a homepage/search page: ${url}`);
    }
  }
  if (problems.length) throw new Error(problems.join('\n'));
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const data = JSON.parse(await readFile(DATA_PATH, 'utf8'));
  data.explore.vibeCoding = await updateVibeCoding(data.explore.vibeCoding);
  data.explore.english = await updateEnglish(data.explore.english);
  data.explore.overseaMarketing = await updateOverseaMarketing(data.explore.overseaMarketing);
  validate(data);

  const output = `${JSON.stringify(data, null, 2)}\n`;
  if (dryRun) {
    console.log(output);
  } else {
    await writeFile(DATA_PATH, output);
    console.log(`Updated ${DATA_PATH.pathname}`);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
