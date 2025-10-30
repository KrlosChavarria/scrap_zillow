#!/usr/bin/env node
const http = require('http');
const https = require('https');
const { URL } = require('url');

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
};

async function fetchHtml(targetUrl, { headers = {}, maxRedirects = 5 } = {}) {
  const url = new URL(targetUrl);
  const requestHeaders = { ...DEFAULT_HEADERS, ...headers };

  const transport = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers: requestHeaders,
      },
      (res) => {
        const { statusCode, headers: resHeaders } = res;

        if (statusCode >= 300 && statusCode < 400 && resHeaders.location) {
          if (maxRedirects <= 0) {
            reject(new Error('Too many redirects while fetching URL.'));
            return;
          }

          const redirectUrl = new URL(resHeaders.location, url);
          resolve(
            fetchHtml(redirectUrl.toString(), {
              headers: requestHeaders,
              maxRedirects: maxRedirects - 1,
            })
          );
          return;
        }

        if (statusCode !== 200) {
          reject(new Error(`Request failed with status code ${statusCode}`));
          return;
        }

        const chunks = [];
        res.setEncoding('utf8');
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(chunks.join('')));
      }
    );

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

function sanitizeJsonPayload(rawPayload) {
  if (!rawPayload) {
    throw new Error('No JSON payload found in Zillow response.');
  }

  let cleaned = rawPayload.trim();
  if (cleaned.startsWith('<!--')) {
    cleaned = cleaned.slice(4);
  }
  if (cleaned.endsWith('-->')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

function extractPropertiesFromHtml(html) {
  const scriptPattern = /<script[^>]*data-zrr-shared-data-key="searchPageStore"[^>]*>([\s\S]*?)<\/script>/i;
  const match = html.match(scriptPattern);

  if (!match) {
    throw new Error('Unable to locate Zillow search data payload in the HTML.');
  }

  const jsonPayload = sanitizeJsonPayload(match[1]);
  let parsed;
  try {
    parsed = JSON.parse(jsonPayload);
  } catch (error) {
    throw new Error('Failed to parse Zillow JSON payload.');
  }

  const list =
    parsed?.cat1?.searchResults?.listResults ||
    parsed?.cat1?.searchList?.results ||
    [];

  if (!Array.isArray(list) || list.length === 0) {
    return [];
  }

  return list.map((item) => {
    const address = item.address || item.addressStreet || item.hdpData?.homeInfo?.streetAddress || 'Dirección no disponible';
    const price = item.price || item.hdpData?.homeInfo?.price || 'Precio no disponible';
    const propertyType = item.hdpData?.homeInfo?.homeType || item.statusType || 'Tipo desconocido';

    const nameParts = [address, item.area ? `${item.area} sqft` : null].filter(Boolean);
    const name = nameParts.join(' - ');

    return {
      name: name || address,
      price,
      propertyType,
      detailUrl: item.detailUrl ? new URL(item.detailUrl, 'https://www.zillow.com').toString() : null,
    };
  });
}

async function main() {
  const [url] = process.argv.slice(2);
  if (!url) {
    console.error('Uso: node src/scrape.js <url_zillow>');
    process.exit(1);
  }

  try {
    const html = await fetchHtml(url);
    const properties = extractPropertiesFromHtml(html);

    if (properties.length === 0) {
      console.warn('No se encontraron propiedades en la respuesta. Verifica los filtros de la URL.');
      return;
    }

    for (const property of properties) {
      console.log('------------------------------');
      console.log(`Nombre: ${property.name}`);
      console.log(`Precio: ${property.price}`);
      if (property.propertyType) {
        console.log(`Tipo: ${property.propertyType}`);
      }
      if (property.detailUrl) {
        console.log(`URL: ${property.detailUrl}`);
      }
    }
  } catch (error) {
    console.error('Error al obtener la información:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  fetchHtml,
  extractPropertiesFromHtml,
};
