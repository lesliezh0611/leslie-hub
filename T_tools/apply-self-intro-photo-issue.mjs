import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';

const DATA_PATH = new URL('../data.json', import.meta.url);
const UPLOAD_DIR = new URL('../assets/self-intro/uploads/', import.meta.url);
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

const imageTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp']
]);

const targets = new Map([
  ['Life - 2024', { sectionId: 'life', itemKey: 'year', itemValue: '2024', slug: 'life-2024', maxSlot: 2 }],
  ['Life - 2025', { sectionId: 'life', itemKey: 'year', itemValue: '2025', slug: 'life-2025', maxSlot: 2 }],
  ['Life - TBD', { sectionId: 'life', itemKey: 'year', itemValue: 'TBD', slug: 'life-tbd', maxSlot: 2 }],
  ['Hobbies - English input', { sectionId: 'hobbies', itemKey: 'title', itemValue: 'English input', slug: 'hobbies-english-input', maxSlot: 5 }],
  ['Hobbies - Creative tooling', { sectionId: 'hobbies', itemKey: 'title', itemValue: 'Creative tooling', slug: 'hobbies-creative-tooling', maxSlot: 5 }],
  ['Casual - Walking around', { sectionId: 'casual', itemKey: 'title', itemValue: 'Walking around', slug: 'casual-walking-around', maxSlot: 5 }],
  ['Casual - Good breaks', { sectionId: 'casual', itemKey: 'title', itemValue: 'Good breaks', slug: 'casual-good-breaks', maxSlot: 5 }]
]);

function getArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return '';
  return process.argv[index + 1] || '';
}

function hasArg(name) {
  return process.argv.includes(name);
}

function normalizeFieldName(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function parseIssueForm(body) {
  const fields = {};
  let active = '';
  for (const line of String(body || '').split(/\r?\n/)) {
    const heading = line.match(/^###\s+(.+?)\s*$/);
    if (heading) {
      active = normalizeFieldName(heading[1]);
      fields[active] = [];
      continue;
    }
    if (active) fields[active].push(line);
  }

  return Object.fromEntries(Object.entries(fields).map(([key, lines]) => {
    const value = lines.join('\n').replace(/^\s*_No response_\s*$/im, '').trim();
    return [key, value];
  }));
}

function requiredField(fields, key, label) {
  const value = fields[key]?.trim();
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function parseSlot(value) {
  const match = String(value || '').match(/\bslot\s*(\d+)\b/i);
  if (!match) throw new Error('Photo slot must look like "Slot 1".');
  return Number(match[1]);
}

function extractImageUrl(value) {
  const text = String(value || '');
  const htmlSrc = text.match(/\bsrc=["'](https?:\/\/[^"']+)["']/i);
  if (htmlSrc) return htmlSrc[1].trim();
  const markdownImage = text.match(/!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/i);
  if (markdownImage) return markdownImage[1];
  const markdownLink = text.match(/\[[^\]]+]\((https?:\/\/[^)\s]+)\)/i);
  if (markdownLink) return markdownLink[1];
  const rawUrl = text.match(/https?:\/\/\S+/i);
  return rawUrl ? rawUrl[0].replace(/[)"'>,./]+$/g, match => match.includes('/') ? '/' : '') : '';
}

function extensionFromUrl(url) {
  const pathname = new URL(url).pathname;
  const ext = extname(pathname).replace('.', '').toLowerCase();
  if (ext === 'jpeg') return 'jpg';
  return ['jpg', 'png', 'webp'].includes(ext) ? ext : '';
}

function dryRunExtensionFromUrl(url) {
  const pathname = new URL(url).pathname;
  const ext = extname(pathname).replace('.', '').toLowerCase();
  if (ext && !['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    throw new Error('Photo must be a JPG, PNG, or WEBP image.');
  }
  return extensionFromUrl(url) || 'jpg';
}

async function downloadImage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const headers = {
    Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5',
    'User-Agent': 'LeslieHubSelfIntroPhotoUpdater/1.0'
  };
  if (process.env.GITHUB_TOKEN && new URL(url).hostname.endsWith('github.com')) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(url, {
    headers,
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) throw new Error(`Photo download failed: ${response.status} ${response.statusText}.`);

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_IMAGE_BYTES) throw new Error('Photo is too large. Please upload an image under 12 MB.');

  const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const fallbackExt = extensionFromUrl(url);
  const ext = imageTypes.get(mime) || fallbackExt;
  if (!['jpg', 'png', 'webp'].includes(ext)) {
    throw new Error('Photo must be a JPG, PNG, or WEBP image.');
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('Photo is too large. Please upload an image under 12 MB.');
  if (!bytes.byteLength) throw new Error('Downloaded photo is empty.');
  return { bytes, ext };
}

function findPhotoTarget(data, targetLabel, slot) {
  const target = targets.get(targetLabel);
  if (!target) throw new Error(`Unknown target item: ${targetLabel}.`);
  if (!Number.isInteger(slot) || slot < 1) throw new Error('Photo slot must be a positive number.');
  if (slot > target.maxSlot) throw new Error(`${targetLabel} only supports Slots 1-${target.maxSlot}.`);

  const section = data.selfIntro?.sections?.find(item => item.id === target.sectionId);
  if (!section) throw new Error(`Could not find Self Intro section: ${target.sectionId}.`);
  const item = section.items?.find(candidate => candidate[target.itemKey] === target.itemValue);
  if (!item) throw new Error(`Could not find Self Intro item: ${targetLabel}.`);
  if (!Array.isArray(item.photos)) throw new Error(`${targetLabel} does not have a photos array.`);
  if (!item.photos[slot - 1]) throw new Error(`${targetLabel} does not currently have Slot ${slot}.`);

  return { target, item, photoIndex: slot - 1 };
}

async function removeOldUpload(fileBase) {
  for (const ext of ['jpg', 'png', 'webp']) {
    await rm(new URL(`${fileBase}.${ext}`, UPLOAD_DIR), { force: true });
  }
}

function commentSuccess({ targetLabel, slot, src, altText, description, dryRun }) {
  return [
    dryRun ? 'Self Intro photo update dry run passed.' : 'Self Intro photo update applied.',
    '',
    `- Target: ${targetLabel}`,
    `- Slot: ${slot}`,
    `- Image: \`${src}\``,
    `- Alt text: ${altText}`,
    `- Hover description: ${description ? 'updated' : 'removed/blank'}`,
    '',
    dryRun ? 'No files were changed because this was a dry run.' : 'GitHub Pages will publish this after the commit is pushed.'
  ].join('\n');
}

function commentFailure(error) {
  return [
    'Self Intro photo update failed.',
    '',
    `Reason: ${error.message}`,
    '',
    'Please edit this issue and try again.'
  ].join('\n');
}

async function writeComment(path, body) {
  if (!path) return;
  await writeFile(path, `${body}\n`);
}

async function main() {
  const dryRun = hasArg('--dry-run');
  const eventPath = getArg('--event-path') || process.env.GITHUB_EVENT_PATH;
  const commentPath = getArg('--comment-path') || process.env.COMMENT_PATH;
  if (!eventPath) throw new Error('Missing GitHub event path.');

  const event = JSON.parse(await readFile(eventPath, 'utf8'));
  const issue = event.issue;
  if (!issue?.body) throw new Error('This workflow must run from a GitHub issue with a completed form body.');

  const fields = parseIssueForm(issue.body);
  const targetLabel = requiredField(fields, 'target_item', 'Target item');
  const slot = parseSlot(requiredField(fields, 'photo_slot', 'Photo slot'));
  const altText = requiredField(fields, 'alt_text', 'Alt text').replace(/\s+/g, ' ').trim();
  const description = (fields.hover_description || '').trim();
  const photoUrl = extractImageUrl(requiredField(fields, 'photo_attachment_or_url', 'Photo attachment or URL'));
  if (!photoUrl) throw new Error('Photo attachment or URL must contain one image URL.');

  const data = JSON.parse(await readFile(DATA_PATH, 'utf8'));
  const { target, item, photoIndex } = findPhotoTarget(data, targetLabel, slot);
  const fileBase = `${target.slug}-slot-${slot}`;
  const dryRunExt = dryRunExtensionFromUrl(photoUrl);
  const image = dryRun ? { bytes: Buffer.from('dry-run'), ext: dryRunExt } : await downloadImage(photoUrl);
  const fileName = `${fileBase}.${image.ext}`;
  const src = `assets/self-intro/uploads/${fileName}`;

  item.photos[photoIndex] = {
    src,
    alt: altText,
    ...(description ? { description } : {})
  };

  if (!dryRun) {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await removeOldUpload(fileBase);
    await writeFile(new URL(fileName, UPLOAD_DIR), image.bytes);
    await writeFile(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`);
  }

  const body = commentSuccess({ targetLabel, slot, src, altText, description, dryRun });
  await writeComment(commentPath, body);
  console.log(body);
}

main().catch(async error => {
  const commentPath = getArg('--comment-path') || process.env.COMMENT_PATH;
  const body = commentFailure(error);
  await writeComment(commentPath, body).catch(() => {});
  console.error(body);
  process.exitCode = 1;
});
