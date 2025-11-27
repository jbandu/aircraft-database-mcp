/**
 * Fleet Discovery Agent
 *
 * Uses LLM to intelligently navigate airline websites and discover fleet information.
 * Handles dynamic pages, JavaScript-rendered content, and various formats.
 *
 * Strategy:
 * 1. Load airline website
 * 2. Use LLM to identify where fleet info lives
 * 3. Navigate to fleet pages
 * 4. Extract all aircraft registrations/identifiers
 * 5. Return list of aircraft to process
 */

import { chromium, Browser, Page } from 'playwright';
import { createLogger } from '../../lib/logger.js';
import { getLLMClient } from '../../lib/llm-client.js';
import { queryPostgres } from '../../lib/db-clients.js';

const logger = createLogger('fleet-discovery-agent');

export interface DiscoveryResult {
  airline_code: string;
  aircraft_found: string[]; // Registration numbers
  source_urls: string[];
  confidence: number;
  discovered_at: Date;
  method: string;
}

export interface DiscoverySource {
  url: string;
  type: 'official' | 'database' | 'tracker';
  priority: number;
}

export class FleetDiscoveryAgent {
  private llm = getLLMClient();
  private browser: Browser | null = null;
  private userAgent: string;

  constructor() {
    this.userAgent =
      process.env.SCRAPER_USER_AGENT ||
      'Mozilla/5.0 (compatible; NumberLabs-AircraftBot/1.0; +https://numberlabs.ai)';
  }

  /**
   * Discover fleet for an airline
   */
  async discoverFleet(
    airlineCode: string,
    options?: {
      forceFullScrape?: boolean;
      sources?: DiscoverySource[];
    }
  ): Promise<DiscoveryResult> {
    logger.info(`Starting fleet discovery for ${airlineCode}`);

    try {
      // Get airline info from database
      const airline = await this.getAirlineInfo(airlineCode);

      if (!airline) {
        throw new Error(`Airline not found: ${airlineCode}`);
      }

      // Determine discovery sources
      const sources =
        options?.sources || (await this.findDiscoverySources(airline));

      logger.info(`Found ${sources.length} discovery sources for ${airlineCode}`);

      // Try each source until we get results
      let result: DiscoveryResult | null = null;

      for (const source of sources) {
        try {
          logger.info(`Trying source: ${source.url}`);
          result = await this.scrapeSource(airline, source);

          if (result && result.aircraft_found.length > 0) {
            logger.info(
              `Successfully discovered ${result.aircraft_found.length} aircraft from ${source.url}`
            );
            break;
          }
        } catch (error) {
          logger.error(`Failed to scrape ${source.url}:`, error);
          continue;
        }
      }

      if (!result || result.aircraft_found.length === 0) {
        logger.warn(`No aircraft discovered for ${airlineCode}`);
        return {
          airline_code: airlineCode,
          aircraft_found: [],
          source_urls: sources.map((s) => s.url),
          confidence: 0,
          discovered_at: new Date(),
          method: 'none',
        };
      }

      return result;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Get airline information from database
   */
  private async getAirlineInfo(airlineCode: string) {
    const query = `
      SELECT id, iata_code, icao_code, name, website_url, scrape_source_urls
      FROM airlines
      WHERE UPPER(iata_code) = UPPER($1) OR UPPER(icao_code) = UPPER($1)
      LIMIT 1
    `;

    const result = await queryPostgres(query, [airlineCode]);
    return result.rows[0] || null;
  }

  /**
   * Find potential sources for fleet data
   */
  private async findDiscoverySources(airline: any): Promise<DiscoverySource[]> {
    const sources: DiscoverySource[] = [];

    // 1. Stored scrape sources from database
    if (airline.scrape_source_urls) {
      const urls = Array.isArray(airline.scrape_source_urls)
        ? airline.scrape_source_urls
        : airline.scrape_source_urls.urls || [];

      for (const url of urls) {
        sources.push({
          url,
          type: 'official',
          priority: 1,
        });
      }
    }

    // 2. Official website
    if (airline.website_url) {
      sources.push({
        url: airline.website_url,
        type: 'official',
        priority: 2,
      });
    }

    // 3. Common fleet database URLs
    sources.push(
      {
        url: `https://www.planespotters.net/airline/${airline.name.replace(/ /g, '-')}`,
        type: 'database',
        priority: 3,
      },
      {
        url: `https://www.airfleets.net/flottecie/${airline.name.replace(/ /g, '%20')}.htm`,
        type: 'database',
        priority: 3,
      }
    );

    return sources.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Scrape a specific source
   */
  private async scrapeSource(
    airline: any,
    source: DiscoverySource
  ): Promise<DiscoveryResult> {
    await this.initBrowser();

    const page = await this.browser!.newPage({
      userAgent: this.userAgent,
    });

    try {
      // Navigate to page
      logger.info(`Loading ${source.url}`);
      await page.goto(source.url, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // Wait for content to load
      await page.waitForTimeout(2000);

      // Get page content
      const html = await page.content();
      const url = page.url();

      // Use LLM to analyze and extract registrations
      const registrations = await this.extractRegistrations(html, url, airline);

      return {
        airline_code: airline.iata_code || airline.icao_code,
        aircraft_found: registrations,
        source_urls: [url],
        confidence: this.calculateConfidence(registrations, source),
        discovered_at: new Date(),
        method: source.type,
      };
    } finally {
      await page.close();
    }
  }

  /**
   * Initialize browser
   */
  private async initBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
      });
      logger.info('Browser initialized');
    }
  }

  /**
   * Extract aircraft registrations from HTML using LLM
   */
  private async extractRegistrations(
    html: string,
    url: string,
    airline: any
  ): Promise<string[]> {
    logger.info('Extracting registrations with LLM');

    // Truncate HTML if too long (keep relevant parts)
    const truncatedHtml = this.truncateHTML(html);

    const prompt = `You are analyzing a webpage to extract aircraft registration numbers (tail numbers) for ${airline.name} (${airline.iata_code}/${airline.icao_code}).

URL: ${url}

HTML Content (truncated):
${truncatedHtml}

Extract ALL aircraft registration numbers found on this page. Aircraft registrations typically:
- Start with a country code (e.g., N for USA, G for UK, D for Germany)
- Follow formats like: N12345, G-ABCD, D-ABCD, VH-ABC, etc.
- Are usually displayed in tables, lists, or structured data
- May be in columns labeled "Registration", "Tail Number", "Reg", "MSN"

Return a JSON array of registration numbers found. Only include valid registrations.

Example response:
{
  "registrations": ["N12345", "N12346", "N12347"]
}

If no registrations are found, return:
{
  "registrations": []
}`;

    try {
      const response = await this.llm.generateJSON<{ registrations: string[] }>(
        prompt,
        {
          temperature: 0.1,
          system:
            'You are an expert at extracting structured data from HTML. Always respond with valid JSON.',
        }
      );

      const registrations = response.registrations || [];
      logger.info(`Extracted ${registrations.length} registrations`);

      return registrations;
    } catch (error) {
      logger.error('LLM extraction failed:', error);
      return [];
    }
  }

  /**
   * Truncate HTML to manageable size
   */
  private truncateHTML(html: string, maxLength: number = 15000): string {
    if (html.length <= maxLength) {
      return html;
    }

    // Try to keep tables and structured content
    const tableMatches = html.match(/<table[\s\S]*?<\/table>/gi);
    if (tableMatches) {
      const tablesHTML = tableMatches.join('\n');
      if (tablesHTML.length <= maxLength) {
        return tablesHTML;
      }
    }

    // Otherwise, truncate from the beginning
    return html.substring(0, maxLength) + '\n... (truncated)';
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    registrations: string[],
    source: DiscoverySource
  ): number {
    if (registrations.length === 0) {
      return 0;
    }

    let confidence = 0.5;

    // Increase confidence based on source type
    if (source.type === 'official') {
      confidence += 0.3;
    } else if (source.type === 'database') {
      confidence += 0.2;
    }

    // Increase confidence if we found many registrations
    if (registrations.length > 10) {
      confidence += 0.1;
    }
    if (registrations.length > 50) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Cleanup resources
   */
  private async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('Browser closed');
    }
  }
}
