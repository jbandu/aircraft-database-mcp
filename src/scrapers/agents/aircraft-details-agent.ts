/**
 * Aircraft Details Agent
 *
 * Extracts comprehensive aircraft specifications from various sources.
 * Uses LLM to parse unstructured data and merge information from multiple sources.
 *
 * Strategy:
 * 1. Load page with Playwright
 * 2. Extract relevant content
 * 3. Use LLM to parse unstructured data
 * 4. Merge data from multiple sources
 * 5. Return structured details with confidence scores
 */

import { chromium, Browser } from 'playwright';
import { createLogger } from '../../lib/logger.js';
import { getLLMClient } from '../../lib/llm-client.js';
import { queryPostgres } from '../../lib/db-clients.js';

const logger = createLogger('aircraft-details-agent');

export interface AircraftDetails {
  registration: string;
  aircraft_type: string;
  manufacturer: string;
  model: string;
  msn: string | null; // Manufacturer Serial Number
  seat_configuration: {
    first?: number;
    business?: number;
    premium_economy?: number;
    economy?: number;
    total?: number;
  };
  delivery_date: string | null;
  age_years: number | null;
  status: string;
  current_location: string | null;
  last_flight_date: string | null;
  engines: string | null;
  confidence_score: number;
  data_sources: string[];
  extracted_at: Date;
}

export interface DetailSource {
  url: string;
  type: 'official' | 'database' | 'tracker';
  priority: number;
}

export class AircraftDetailsAgent {
  private llm = getLLMClient();
  private browser: Browser | null = null;
  private userAgent: string;

  constructor() {
    this.userAgent =
      process.env['SCRAPER_USER_AGENT'] ||
      'Mozilla/5.0 (compatible; NumberLabs-AircraftBot/1.0; +https://numberlabs.ai)';
  }

  /**
   * Extract comprehensive details for an aircraft
   */
  async extractDetails(
    registration: string,
    options?: {
      sources?: DetailSource[];
      airlineCode?: string;
    }
  ): Promise<AircraftDetails> {
    logger.info(`Extracting details for aircraft ${registration}`);

    try {
      // Check if we already have this aircraft in the database
      const existingData = await this.getExistingAircraft(registration);

      // Determine sources to scrape
      const sources =
        options?.sources ||
        (await this.findDetailSources(registration, options?.airlineCode));

      logger.info(`Found ${sources.length} detail sources for ${registration}`);

      // Scrape each source and collect partial data
      const partialResults: Partial<AircraftDetails>[] = [];

      for (const source of sources) {
        try {
          logger.info(`Scraping source: ${source.url}`);
          const partial = await this.scrapeDetailSource(registration, source);
          if (partial) {
            partialResults.push(partial);
          }
        } catch (error) {
          logger.error(`Failed to scrape ${source.url}:`, error);
          continue;
        }
      }

      // Merge all partial results
      const merged = await this.mergePartialData(
        registration,
        partialResults,
        existingData
      );

      return merged;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Get existing aircraft data from database
   */
  private async getExistingAircraft(
    registration: string
  ): Promise<AircraftDetails | null> {
    const query = `
      SELECT
        a.registration,
        at.iata_code as aircraft_type,
        at.manufacturer,
        at.model,
        a.msn,
        a.seat_configuration,
        a.delivery_date,
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, a.delivery_date))::INTEGER as age_years,
        a.status,
        a.current_location,
        a.last_flight_date,
        at.engine_type as engines
      FROM aircraft a
      JOIN aircraft_types at ON a.aircraft_type_id = at.id
      WHERE UPPER(a.registration) = UPPER($1)
      LIMIT 1
    `;

    const result = await queryPostgres(query, [registration]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      registration: row.registration,
      aircraft_type: row.aircraft_type,
      manufacturer: row.manufacturer,
      model: row.model,
      msn: row.msn,
      seat_configuration: row.seat_configuration || {},
      delivery_date: row.delivery_date,
      age_years: row.age_years,
      status: row.status,
      current_location: row.current_location,
      last_flight_date: row.last_flight_date,
      engines: row.engines,
      confidence_score: 0.9, // Existing DB data is high confidence
      data_sources: ['database'],
      extracted_at: new Date(),
    };
  }

  /**
   * Find potential sources for aircraft details
   */
  private async findDetailSources(
    registration: string,
    _airlineCode?: string
  ): Promise<DetailSource[]> {
    const sources: DetailSource[] = [];

    // 1. Planespotters.net - most comprehensive
    sources.push({
      url: `https://www.planespotters.net/airframe/${registration}`,
      type: 'database',
      priority: 1,
    });

    // 2. FlightRadar24
    sources.push({
      url: `https://www.flightradar24.com/data/aircraft/${registration.toLowerCase()}`,
      type: 'tracker',
      priority: 2,
    });

    // 3. Airfleets.net
    sources.push({
      url: `https://www.airfleets.net/recherche/${registration}.htm`,
      type: 'database',
      priority: 2,
    });

    // 4. JetPhotos (for visual verification)
    sources.push({
      url: `https://www.jetphotos.com/registration/${registration}`,
      type: 'database',
      priority: 3,
    });

    return sources.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Scrape a specific source for aircraft details
   */
  private async scrapeDetailSource(
    registration: string,
    source: DetailSource
  ): Promise<Partial<AircraftDetails> | null> {
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

      // Check if page exists (not 404)
      const title = await page.title();
      if (
        title.toLowerCase().includes('not found') ||
        title.toLowerCase().includes('404')
      ) {
        logger.warn(`Page not found for ${registration} at ${source.url}`);
        return null;
      }

      // Get page content
      const html = await page.content();
      const url = page.url();

      // Use LLM to extract structured data
      const extracted = await this.extractStructuredData(html, url, registration);

      if (extracted) {
        extracted.data_sources = [url];
      }

      return extracted;
    } catch (error) {
      logger.error(`Failed to scrape ${source.url}:`, error);
      return null;
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
        headless: process.env['PLAYWRIGHT_HEADLESS'] !== 'false',
      });
      logger.info('Browser initialized');
    }
  }

  /**
   * Extract structured data from HTML using LLM
   */
  private async extractStructuredData(
    html: string,
    url: string,
    registration: string
  ): Promise<Partial<AircraftDetails> | null> {
    logger.info('Extracting structured data with LLM');

    // Truncate HTML if too long
    const truncatedHtml = this.truncateHTML(html);

    const prompt = `You are analyzing a webpage to extract detailed aircraft specifications.

Registration: ${registration}
URL: ${url}

HTML Content (truncated):
${truncatedHtml}

Extract the following information if available:
- aircraft_type: IATA type code (e.g., "77W", "32A", "738")
- manufacturer: Aircraft manufacturer (e.g., "Boeing", "Airbus")
- model: Full model name (e.g., "777-300ER", "A320-200")
- msn: Manufacturer Serial Number
- seat_configuration: Breakdown by class (first, business, premium_economy, economy, total)
- delivery_date: Date aircraft was delivered (YYYY-MM-DD format)
- status: Current status (e.g., "Active", "Stored", "Scrapped")
- current_location: Current airport or location
- last_flight_date: Date of last flight (YYYY-MM-DD format)
- engines: Engine type/model

Return a JSON object with the extracted fields. Use null for fields not found.

Example response:
{
  "aircraft_type": "77W",
  "manufacturer": "Boeing",
  "model": "777-300ER",
  "msn": "12345",
  "seat_configuration": {
    "first": 8,
    "business": 42,
    "premium_economy": 24,
    "economy": 256,
    "total": 330
  },
  "delivery_date": "2015-03-15",
  "status": "Active",
  "current_location": "KSFO",
  "last_flight_date": "2025-11-20",
  "engines": "GE90-115B"
}

If no relevant data is found, return:
{
  "aircraft_type": null,
  "manufacturer": null,
  "model": null,
  "msn": null,
  "seat_configuration": {},
  "delivery_date": null,
  "status": null,
  "current_location": null,
  "last_flight_date": null,
  "engines": null
}`;

    try {
      const response = await this.llm.generateJSON<Partial<AircraftDetails>>(
        prompt,
        {
          temperature: 0.1,
          system:
            'You are an expert at extracting structured aircraft data from HTML. Always respond with valid JSON.',
        }
      );

      logger.info('Successfully extracted structured data');
      return response;
    } catch (error) {
      logger.error('LLM extraction failed:', error);
      return null;
    }
  }

  /**
   * Merge partial data from multiple sources
   */
  private async mergePartialData(
    registration: string,
    partialResults: Partial<AircraftDetails>[],
    existingData: AircraftDetails | null
  ): Promise<AircraftDetails> {
    logger.info(
      `Merging ${partialResults.length} partial results for ${registration}`
    );

    // Start with existing data or empty template
    const merged: AircraftDetails = existingData || {
      registration,
      aircraft_type: '',
      manufacturer: '',
      model: '',
      msn: null,
      seat_configuration: {},
      delivery_date: null,
      age_years: null,
      status: 'Unknown',
      current_location: null,
      last_flight_date: null,
      engines: null,
      confidence_score: 0,
      data_sources: [],
      extracted_at: new Date(),
    };

    // Merge each field using priority and frequency
    const allSources: string[] = existingData
      ? [...existingData.data_sources]
      : [];

    for (const partial of partialResults) {
      if (partial.data_sources) {
        allSources.push(...partial.data_sources);
      }

      // Merge basic fields (prefer non-null values)
      if (partial.aircraft_type && !merged.aircraft_type) {
        merged.aircraft_type = partial.aircraft_type;
      }
      if (partial.manufacturer && !merged.manufacturer) {
        merged.manufacturer = partial.manufacturer;
      }
      if (partial.model && !merged.model) {
        merged.model = partial.model;
      }
      if (partial.msn && !merged.msn) {
        merged.msn = partial.msn;
      }
      if (partial.delivery_date && !merged.delivery_date) {
        merged.delivery_date = partial.delivery_date;
      }
      if (partial.status && partial.status !== 'Unknown') {
        merged.status = partial.status;
      }
      if (partial.current_location && !merged.current_location) {
        merged.current_location = partial.current_location;
      }
      if (partial.engines && !merged.engines) {
        merged.engines = partial.engines;
      }

      // Merge seat configuration (prefer most complete)
      if (
        partial.seat_configuration &&
        Object.keys(partial.seat_configuration).length >
          Object.keys(merged.seat_configuration).length
      ) {
        merged.seat_configuration = partial.seat_configuration;
      }

      // Update last flight date (prefer most recent)
      if (
        partial.last_flight_date &&
        (!merged.last_flight_date ||
          partial.last_flight_date > merged.last_flight_date)
      ) {
        merged.last_flight_date = partial.last_flight_date;
      }
    }

    // Calculate age if we have delivery date
    if (merged.delivery_date && !merged.age_years) {
      const deliveryYear = new Date(merged.delivery_date).getFullYear();
      const currentYear = new Date().getFullYear();
      merged.age_years = currentYear - deliveryYear;
    }

    // Calculate confidence score
    merged.confidence_score = this.calculateConfidence(merged, partialResults);
    merged.data_sources = [...new Set(allSources)];
    merged.extracted_at = new Date();

    return merged;
  }

  /**
   * Calculate confidence score for merged data
   */
  private calculateConfidence(
    merged: AircraftDetails,
    partialResults: Partial<AircraftDetails>[]
  ): number {
    let confidence = 0;

    // Base confidence from number of sources
    const sourceCount = partialResults.length;
    confidence += Math.min(sourceCount * 0.15, 0.3);

    // Increase confidence for critical fields
    if (merged.aircraft_type) confidence += 0.15;
    if (merged.manufacturer) confidence += 0.1;
    if (merged.model) confidence += 0.1;
    if (merged.msn) confidence += 0.15;
    if (merged.delivery_date) confidence += 0.1;
    if (Object.keys(merged.seat_configuration).length > 0) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * Truncate HTML to manageable size
   */
  private truncateHTML(html: string, maxLength: number = 15000): string {
    if (html.length <= maxLength) {
      return html;
    }

    // Try to keep main content areas
    const mainContent =
      html.match(/<main[\s\S]*?<\/main>/gi)?.[0] ||
      html.match(/<article[\s\S]*?<\/article>/gi)?.[0] ||
      html.match(/<div[^>]*class="[^"]*content[^"]*"[\s\S]*?<\/div>/gi)?.[0];

    if (mainContent && mainContent.length <= maxLength) {
      return mainContent;
    }

    // Otherwise, truncate from the beginning
    return html.substring(0, maxLength) + '\n... (truncated)';
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
