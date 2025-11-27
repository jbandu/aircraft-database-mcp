/**
 * Schedule Top 100 Airlines Script
 *
 * Initializes scraping jobs for the top 100 airlines by passenger traffic.
 * Sets up priorities and schedules based on airline size and importance.
 *
 * Usage:
 *   npm run scraper:setup
 *   npm run scraper:setup -- --dry-run
 *   npm run scraper:setup -- --force
 */
export declare class AirlineSchedulerSetup {
    private jobQueue;
    /**
     * Set up scraping jobs for top 100 airlines
     */
    setup(options?: {
        dryRun?: boolean;
        force?: boolean;
    }): Promise<void>;
    /**
     * Get airline information from database
     */
    private getAirlineInfo;
    /**
     * Check if airline has a recent job
     */
    private hasRecentJob;
    /**
     * Calculate scheduled delay for job
     * Spreads jobs over time to avoid overload
     */
    private calculateScheduledDelay;
    /**
     * Create a scraping job
     */
    private createJob;
    /**
     * Sleep helper
     */
    private sleep;
    /**
     * Update airline scrape settings
     */
    updateAirlineSettings(airlineCode: string, settings: {
        scrapeEnabled?: boolean;
        scrapeScheduleCron?: string;
    }): Promise<void>;
}
//# sourceMappingURL=schedule-top-100-airlines.d.ts.map