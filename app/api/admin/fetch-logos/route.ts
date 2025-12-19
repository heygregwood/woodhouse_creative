// GET /api/admin/fetch-logos - Fetch logo options from Brandfetch + website scraping
import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import * as cheerio from 'cheerio';

const DB_PATH = path.join(process.cwd(), 'data', 'sqlite', 'creative.db');
const BRANDFETCH_CLIENT_ID = process.env.BRANDFETCH_CLIENT_ID;

// Fallback dimensions to filter out
const BRANDFETCH_FALLBACKS = [[820, 877], [820, 220]];
const MIN_DIMENSION = 80;
const MIN_AREA = 15000;

interface LogoOption {
  url: string;
  width: number;
  height: number;
  format: string;
  source: string;
}

function cleanDomain(url: string): string | null {
  if (!url || url.includes('@')) return null;
  let domain = url.toLowerCase();
  domain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '');
  domain = domain.split('/')[0];
  return domain || null;
}

async function fetchImageInfo(url: string, source: string): Promise<LogoOption | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Parse image dimensions from headers
    let width = 0, height = 0, format = 'unknown';

    // PNG
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      format = 'PNG';
      width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
      height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    }
    // JPEG
    else if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
      format = 'JPEG';
      let i = 2;
      while (i < bytes.length - 9) {
        if (bytes[i] === 0xFF) {
          const marker = bytes[i + 1];
          if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
            height = (bytes[i + 5] << 8) | bytes[i + 6];
            width = (bytes[i + 7] << 8) | bytes[i + 8];
            break;
          }
          const length = (bytes[i + 2] << 8) | bytes[i + 3];
          i += 2 + length;
        } else {
          i++;
        }
      }
    }
    // WEBP
    else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
             bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      format = 'WEBP';
      // VP8 lossy
      if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x20) {
        width = ((bytes[26] | (bytes[27] << 8)) & 0x3FFF);
        height = ((bytes[28] | (bytes[29] << 8)) & 0x3FFF);
      }
      // VP8L lossless
      else if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x4C) {
        const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
        width = (bits & 0x3FFF) + 1;
        height = ((bits >> 14) & 0x3FFF) + 1;
      }
      // VP8X extended
      else if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x58) {
        width = ((bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)) & 0xFFFFFF) + 1;
        height = ((bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) & 0xFFFFFF) + 1;
      }
    }
    // GIF
    else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
      format = 'GIF';
      width = bytes[6] | (bytes[7] << 8);
      height = bytes[8] | (bytes[9] << 8);
    }

    // Filter
    if (width < MIN_DIMENSION || height < MIN_DIMENSION) return null;
    if (width * height < MIN_AREA) return null;
    for (const [fw, fh] of BRANDFETCH_FALLBACKS) {
      if (width === fw && height === fh) return null;
    }

    return { url, width, height, format, source };
  } catch {
    return null;
  }
}

async function scrapeWebsiteLogos(domain: string): Promise<string[]> {
  const logos: string[] = [];
  const baseUrl = `https://${domain}`;

  try {
    const response = await fetch(baseUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return logos;

    const html = await response.text();
    const $ = cheerio.load(html);

    const logoPatterns = ['logo', 'brand', 'header-img', 'site-logo'];

    $('img').each((_, el) => {
      const src = $(el).attr('src') || '';
      const alt = ($(el).attr('alt') || '').toLowerCase();
      const classes = ($(el).attr('class') || '').toLowerCase();
      const id = ($(el).attr('id') || '').toLowerCase();

      const isLogo = logoPatterns.some(p => 
        src.toLowerCase().includes(p) || alt.includes(p) || classes.includes(p) || id.includes(p)
      );

      if (isLogo && src && !src.startsWith('data:')) {
        const fullUrl = src.startsWith('http') ? src : new URL(src, baseUrl).href;
        logos.push(fullUrl);
      }
    });

    // og:image
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      const fullUrl = ogImage.startsWith('http') ? ogImage : new URL(ogImage, baseUrl).href;
      logos.push(fullUrl);
    }

    // apple-touch-icon
    $('link[rel*="icon"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
        logos.push(fullUrl);
      }
    });
  } catch {
    // Ignore errors
  }

  return [...new Set(logos)];
}

export async function GET(request: NextRequest) {
  const dealerNo = request.nextUrl.searchParams.get('dealerNo');

  if (!dealerNo) {
    return NextResponse.json({ error: 'Missing dealerNo' }, { status: 400 });
  }

  try {
    // Get dealer website
    const db = new Database(DB_PATH, { readonly: true });
    const dealer = db.prepare('SELECT creatomate_website FROM dealers WHERE dealer_no = ?').get(dealerNo) as { creatomate_website: string } | undefined;
    db.close();

    if (!dealer?.creatomate_website) {
      return NextResponse.json({ error: 'No website found', logos: [] });
    }

    const domain = cleanDomain(dealer.creatomate_website);
    if (!domain) {
      return NextResponse.json({ error: 'Invalid website', logos: [] });
    }

    const results: LogoOption[] = [];
    const seen = new Set<string>();

    // 1. Brandfetch
    if (BRANDFETCH_CLIENT_ID) {
      const bfUrls = [
        `https://cdn.brandfetch.io/${domain}?c=${BRANDFETCH_CLIENT_ID}`,
        `https://cdn.brandfetch.io/${domain}/icon?c=${BRANDFETCH_CLIENT_ID}`,
        `https://cdn.brandfetch.io/${domain}/logo?c=${BRANDFETCH_CLIENT_ID}`,
      ];

      for (const url of bfUrls) {
        const info = await fetchImageInfo(url, 'brandfetch');
        if (info) {
          const key = `${info.width}x${info.height}`;
          if (!seen.has(key)) {
            seen.add(key);
            results.push(info);
          }
        }
      }
    }

    // 2. Website scraping
    const scraped = await scrapeWebsiteLogos(domain);
    for (const url of scraped.slice(0, 10)) {
      const info = await fetchImageInfo(url, 'website');
      if (info) {
        const key = `${info.width}x${info.height}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(info);
        }
      }
    }

    // 3. Google favicon
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;
    const favicon = await fetchImageInfo(faviconUrl, 'favicon');
    if (favicon && favicon.width >= 128) {
      const key = `${favicon.width}x${favicon.height}`;
      if (!seen.has(key)) {
        results.push(favicon);
      }
    }

    // Sort by size
    results.sort((a, b) => (b.width * b.height) - (a.width * a.height));

    return NextResponse.json({ logos: results });
  } catch (error) {
    console.error('Error fetching logos:', error);
    return NextResponse.json({ error: 'Failed to fetch logos', logos: [] }, { status: 500 });
  }
}
