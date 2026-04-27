import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const DATA_PATH = new URL('../data.json', import.meta.url);
const MAX_ITEMS = 10;
const USER_AGENT = 'LeslieHubUpdater/1.0 (+https://lesliezh0611.github.io/leslie-hub/)';

const marketingFeeds = [
  { source: 'TechCrunch', lang: 'en', url: 'https://techcrunch.com/feed/' },
  { source: 'The Verge', lang: 'en', url: 'https://www.theverge.com/rss/index.xml' },
  { source: 'Wired', lang: 'en', url: 'https://www.wired.com/feed/rss' },
  { source: 'Adweek', lang: 'en', url: 'https://www.adweek.com/feed/' },
  { source: 'Marketing Dive', lang: 'en', url: 'https://www.marketingdive.com/feeds/news/' }
];

const englishFeeds = [
  { source: "Lenny's Podcast", platform: 'newsletter', url: 'https://www.lennysnewsletter.com/feed' },
  { source: 'Lex Fridman Podcast', platform: 'podcast', url: 'https://lexfridman.com/feed/podcast/' }
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

async function updateVibeCoding(module) {
  const base = process.env.RSSHUB_BASE_URL?.replace(/\/$/, '');
  if (!base) {
    console.log('vibeCoding: RSSHUB_BASE_URL not set; preserving existing X articles.');
    return module;
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

  if (!fetched.length) return module;
  const existingByUrl = new Map((module.articles || []).map(item => [item.url, item]));
  const articles = uniqueByUrl(fetched)
    .map(item => existingByUrl.has(item.url) ? { ...item, id: existingByUrl.get(item.url).id } : item)
    .sort(byNewest)
    .slice(0, MAX_ITEMS);
  return { ...module, articles, lastUpdated: nowISO() };
}

async function updateEnglish(module) {
  const podcasts = [];
  for (const feed of englishFeeds) {
    try {
      const items = await fetchFeed(feed.url);
      podcasts.push(...items.slice(0, 5).map(item => ({
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

  return {
    ...module,
    podcasts: podcasts.length ? uniqueByUrl(podcasts).sort(byNewest).slice(0, MAX_ITEMS) : module.podcasts,
    books: books.length ? books : module.books,
    films: films.length ? films : module.films,
    lastUpdated: nowISO()
  };
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
  const fetched = [];
  for (const feed of marketingFeeds) {
    try {
      const items = await fetchFeed(feed.url);
      fetched.push(...items
        .filter(item => isMarketingRelevant(feed.source, item.title, item.text))
        .slice(0, 5)
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
  const existingCn = existing.filter(item => item.lang === 'cn').slice(0, 4);
  const existingByUrl = new Map(existing.map(item => [item.url, item]));
  const en = uniqueByUrl(fetched)
    .map(item => existingByUrl.has(item.url) ? { ...item, id: existingByUrl.get(item.url).id } : item)
    .sort(byNewest)
    .slice(0, 8);

  if (!en.length) return module;
  return {
    ...module,
    articles: uniqueByUrl(en.concat(existingCn)).sort(byNewest).slice(0, MAX_ITEMS),
    lastUpdated: nowISO()
  };
}

function isMarketingRelevant(source, title, text) {
  if (['Marketing Dive', 'Adweek'].includes(source)) return true;
  const haystack = `${title} ${text}`.toLowerCase();
  return marketingKeywords.some(keyword => haystack.includes(keyword));
}

function validate(data) {
  const problems = [];
  const explore = data.explore || {};
  for (const article of explore.vibeCoding?.articles || []) {
    if (!/https:\/\/x\.com\/[^/]+\/status\/\d+/.test(article.url)) {
      problems.push(`vibeCoding article is not an X status URL: ${article.id}`);
    }
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
