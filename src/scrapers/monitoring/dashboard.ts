/**
 * Scraper Monitoring Dashboard
 *
 * Provides comprehensive monitoring and reporting for the scraping system:
 * - Job queue statistics
 * - Recent job history
 * - Airline scraping status
 * - Data quality metrics
 * - Performance metrics
 */

import { createLogger } from '../../lib/logger.js';
import { queryPostgres } from '../../lib/db-clients.js';

const logger = createLogger('monitoring');

export interface DashboardReport {
  timestamp: Date;
  queue: QueueMetrics;
  jobs: JobMetrics;
  airlines: AirlineMetrics;
  dataQuality: DataQualityMetrics;
  performance: PerformanceMetrics;
}

export interface QueueMetrics {
  pending: number;
  running: number;
  completed_24h: number;
  failed_24h: number;
  total_7d: number;
}

export interface JobMetrics {
  recentJobs: Array<{
    id: string;
    airline_code: string;
    status: string;
    started_at: Date;
    completed_at: Date | null;
    duration_seconds: number | null;
    aircraft_found: number;
    aircraft_added: number;
    aircraft_updated: number;
    errors_count: number;
  }>;
  successRate24h: number;
  avgDuration: number;
}

export interface AirlineMetrics {
  totalAirlines: number;
  scrapedAirlines: number;
  neverScraped: number;
  staleData: number; // Not scraped in > 30 days
  topByFleetSize: Array<{
    code: string;
    name: string;
    aircraft_count: number;
    last_scraped: Date | null;
  }>;
}

export interface DataQualityMetrics {
  totalAircraft: number;
  highConfidence: number; // >= 0.8
  mediumConfidence: number; // 0.5 - 0.8
  lowConfidence: number; // < 0.5
  missingCriticalData: number;
  avgConfidence: number;
}

export interface PerformanceMetrics {
  avgJobDuration: number;
  avgAircraftPerJob: number;
  jobsPerDay: number;
  scraperUptime: number; // seconds since last successful job
}

export class MonitoringDashboard {
  // private _jobQueue = getJobQueue();

  /**
   * Generate comprehensive dashboard report
   */
  async generateReport(): Promise<DashboardReport> {
    logger.info('Generating monitoring dashboard report');

    const [queue, jobs, airlines, dataQuality, performance] = await Promise.all([
      this.getQueueMetrics(),
      this.getJobMetrics(),
      this.getAirlineMetrics(),
      this.getDataQualityMetrics(),
      this.getPerformanceMetrics(),
    ]);

    return {
      timestamp: new Date(),
      queue,
      jobs,
      airlines,
      dataQuality,
      performance,
    };
  }

  /**
   * Get queue statistics
   */
  private async getQueueMetrics(): Promise<QueueMetrics> {
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'running') as running,
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') as completed_24h,
        COUNT(*) FILTER (WHERE status = 'failed' AND completed_at > NOW() - INTERVAL '24 hours') as failed_24h,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as total_7d
      FROM scrape_jobs
    `;

    const result = await queryPostgres(query);
    const row = result.rows[0];

    return {
      pending: parseInt(row.pending) || 0,
      running: parseInt(row.running) || 0,
      completed_24h: parseInt(row.completed_24h) || 0,
      failed_24h: parseInt(row.failed_24h) || 0,
      total_7d: parseInt(row.total_7d) || 0,
    };
  }

  /**
   * Get job execution metrics
   */
  private async getJobMetrics(): Promise<JobMetrics> {
    // Get recent jobs
    const recentQuery = `
      SELECT
        sj.id,
        al.iata_code as airline_code,
        sj.status,
        sj.started_at,
        sj.completed_at,
        sj.duration_seconds,
        sj.aircraft_found,
        sj.aircraft_added,
        sj.aircraft_updated,
        sj.errors_count
      FROM scrape_jobs sj
      JOIN airlines al ON sj.airline_id = al.id
      ORDER BY sj.started_at DESC
      LIMIT 20
    `;

    const recentResult = await queryPostgres(recentQuery);

    const recentJobs = recentResult.rows.map((row) => ({
      id: row.id,
      airline_code: row.airline_code,
      status: row.status,
      started_at: new Date(row.started_at),
      completed_at: row.completed_at ? new Date(row.completed_at) : null,
      duration_seconds: row.duration_seconds,
      aircraft_found: row.aircraft_found || 0,
      aircraft_added: row.aircraft_added || 0,
      aircraft_updated: row.aircraft_updated || 0,
      errors_count: row.errors_count || 0,
    }));

    // Get success rate (last 24 hours)
    const statsQuery = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        AVG(duration_seconds) FILTER (WHERE status = 'completed') as avg_duration
      FROM scrape_jobs
      WHERE completed_at > NOW() - INTERVAL '24 hours'
    `;

    const statsResult = await queryPostgres(statsQuery);
    const stats = statsResult.rows[0];

    const completed = parseInt(stats.completed) || 0;
    const failed = parseInt(stats.failed) || 0;
    const total = completed + failed;

    return {
      recentJobs,
      successRate24h: total > 0 ? (completed / total) * 100 : 0,
      avgDuration: parseFloat(stats.avg_duration) || 0,
    };
  }

  /**
   * Get airline scraping status
   */
  private async getAirlineMetrics(): Promise<AirlineMetrics> {
    const query = `
      SELECT
        COUNT(*) as total_airlines,
        COUNT(*) FILTER (WHERE last_scraped_at IS NOT NULL) as scraped_airlines,
        COUNT(*) FILTER (WHERE last_scraped_at IS NULL) as never_scraped,
        COUNT(*) FILTER (WHERE last_scraped_at < NOW() - INTERVAL '30 days') as stale_data
      FROM airlines
      WHERE scrape_enabled = true
    `;

    const result = await queryPostgres(query);
    const row = result.rows[0];

    // Get top airlines by fleet size
    const topQuery = `
      SELECT
        al.iata_code as code,
        al.name,
        COUNT(a.id) as aircraft_count,
        al.last_scraped_at as last_scraped
      FROM airlines al
      LEFT JOIN aircraft a ON al.id = a.airline_id AND a.status = 'Active'
      WHERE al.scrape_enabled = true
      GROUP BY al.id, al.iata_code, al.name, al.last_scraped_at
      ORDER BY aircraft_count DESC
      LIMIT 10
    `;

    const topResult = await queryPostgres(topQuery);

    const topByFleetSize = topResult.rows.map((r) => ({
      code: r.code,
      name: r.name,
      aircraft_count: parseInt(r.aircraft_count) || 0,
      last_scraped: r.last_scraped ? new Date(r.last_scraped) : null,
    }));

    return {
      totalAirlines: parseInt(row.total_airlines) || 0,
      scrapedAirlines: parseInt(row.scraped_airlines) || 0,
      neverScraped: parseInt(row.never_scraped) || 0,
      staleData: parseInt(row.stale_data) || 0,
      topByFleetSize,
    };
  }

  /**
   * Get data quality metrics
   */
  private async getDataQualityMetrics(): Promise<DataQualityMetrics> {
    const query = `
      SELECT
        COUNT(*) as total_aircraft,
        COUNT(*) FILTER (WHERE data_confidence >= 0.8) as high_confidence,
        COUNT(*) FILTER (WHERE data_confidence >= 0.5 AND data_confidence < 0.8) as medium_confidence,
        COUNT(*) FILTER (WHERE data_confidence < 0.5) as low_confidence,
        COUNT(*) FILTER (WHERE msn IS NULL OR delivery_date IS NULL) as missing_critical,
        AVG(data_confidence) as avg_confidence
      FROM aircraft
      WHERE status = 'Active'
    `;

    const result = await queryPostgres(query);
    const row = result.rows[0];

    return {
      totalAircraft: parseInt(row.total_aircraft) || 0,
      highConfidence: parseInt(row.high_confidence) || 0,
      mediumConfidence: parseInt(row.medium_confidence) || 0,
      lowConfidence: parseInt(row.low_confidence) || 0,
      missingCriticalData: parseInt(row.missing_critical) || 0,
      avgConfidence: parseFloat(row.avg_confidence) || 0,
    };
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const query = `
      SELECT
        AVG(duration_seconds) as avg_job_duration,
        AVG(aircraft_found) as avg_aircraft_per_job,
        COUNT(*) FILTER (WHERE completed_at > NOW() - INTERVAL '24 hours') as jobs_per_day,
        EXTRACT(EPOCH FROM (NOW() - MAX(completed_at))) as scraper_uptime
      FROM scrape_jobs
      WHERE status IN ('completed', 'failed')
        AND completed_at > NOW() - INTERVAL '30 days'
    `;

    const result = await queryPostgres(query);
    const row = result.rows[0];

    return {
      avgJobDuration: parseFloat(row.avg_job_duration) || 0,
      avgAircraftPerJob: parseFloat(row.avg_aircraft_per_job) || 0,
      jobsPerDay: parseInt(row.jobs_per_day) || 0,
      scraperUptime: parseFloat(row.scraper_uptime) || 0,
    };
  }

  /**
   * Print formatted report to console
   */
  printReport(report: DashboardReport): void {
    console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║         Aircraft Database Scraper - Monitoring Dashboard          ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

    console.log(`📅 Report Time: ${report.timestamp.toISOString()}\n`);

    // Queue Status
    console.log('═══ Queue Status ═══');
    console.log(`  Pending Jobs:       ${report.queue.pending}`);
    console.log(`  Running Jobs:       ${report.queue.running}`);
    console.log(`  Completed (24h):    ${report.queue.completed_24h}`);
    console.log(`  Failed (24h):       ${report.queue.failed_24h}`);
    console.log(`  Total (7d):         ${report.queue.total_7d}\n`);

    // Job Metrics
    console.log('═══ Job Performance ═══');
    console.log(`  Success Rate (24h): ${report.jobs.successRate24h.toFixed(1)}%`);
    console.log(`  Avg Duration:       ${report.jobs.avgDuration.toFixed(0)}s`);
    console.log(`  Jobs/Day:           ${report.performance.jobsPerDay}\n`);

    // Recent Jobs
    console.log('═══ Recent Jobs (Last 20) ═══');
    console.log(
      '  Airline  Status      Aircraft  Added  Updated  Duration  Completed'
    );
    console.log('  ──────────────────────────────────────────────────────────────────');

    for (const job of report.jobs.recentJobs.slice(0, 10)) {
      const status = this.padRight(job.status, 10);
      const duration = job.duration_seconds
        ? `${job.duration_seconds}s`
        : '-';
      const completed = job.completed_at
        ? job.completed_at.toISOString().substring(11, 19)
        : '-';

      console.log(
        `  ${this.padRight(job.airline_code, 8)} ${status} ${this.padLeft(String(job.aircraft_found), 8)}  ${this.padLeft(String(job.aircraft_added), 5)}  ${this.padLeft(String(job.aircraft_updated), 7)}  ${this.padLeft(duration, 8)}  ${completed}`
      );
    }
    console.log();

    // Airline Status
    console.log('═══ Airline Coverage ═══');
    console.log(`  Total Airlines:     ${report.airlines.totalAirlines}`);
    console.log(`  Scraped:            ${report.airlines.scrapedAirlines}`);
    console.log(`  Never Scraped:      ${report.airlines.neverScraped}`);
    console.log(`  Stale (>30d):       ${report.airlines.staleData}\n`);

    // Top Airlines
    console.log('═══ Top 10 Airlines by Fleet Size ═══');
    console.log('  Code  Name                    Aircraft  Last Scraped');
    console.log('  ─────────────────────────────────────────────────────────');

    for (const airline of report.airlines.topByFleetSize) {
      const lastScraped = airline.last_scraped
        ? airline.last_scraped.toISOString().substring(0, 10)
        : 'Never';

      console.log(
        `  ${this.padRight(airline.code, 5)} ${this.padRight(airline.name.substring(0, 23), 23)} ${this.padLeft(String(airline.aircraft_count), 8)}  ${lastScraped}`
      );
    }
    console.log();

    // Data Quality
    console.log('═══ Data Quality ═══');
    console.log(`  Total Aircraft:     ${report.dataQuality.totalAircraft}`);
    console.log(
      `  High Confidence:    ${report.dataQuality.highConfidence} (${this.percentage(report.dataQuality.highConfidence, report.dataQuality.totalAircraft)}%)`
    );
    console.log(
      `  Medium Confidence:  ${report.dataQuality.mediumConfidence} (${this.percentage(report.dataQuality.mediumConfidence, report.dataQuality.totalAircraft)}%)`
    );
    console.log(
      `  Low Confidence:     ${report.dataQuality.lowConfidence} (${this.percentage(report.dataQuality.lowConfidence, report.dataQuality.totalAircraft)}%)`
    );
    console.log(
      `  Missing Critical:   ${report.dataQuality.missingCriticalData}`
    );
    console.log(
      `  Avg Confidence:     ${report.dataQuality.avgConfidence.toFixed(2)}\n`
    );

    console.log('═══════════════════════════════════════════════════════════════════\n');
  }

  /**
   * Export report as JSON
   */
  exportJSON(report: DashboardReport, filepath: string): void {
    const fs = require('fs');
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    logger.info(`Report exported to ${filepath}`);
  }

  // Helper methods for formatting
  private padRight(str: string, length: number): string {
    return str.padEnd(length, ' ');
  }

  private padLeft(str: string, length: number): string {
    return str.padStart(length, ' ');
  }

  private percentage(value: number, total: number): string {
    return total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
  }
}

// CLI support
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const watch = args.includes('--watch');
  const exportPath = args.find((arg) => arg.startsWith('--export='))?.split('=')[1];
  const interval = parseInt(
    args.find((arg) => arg.startsWith('--interval='))?.split('=')[1] || '30',
    10
  );

  const dashboard = new MonitoringDashboard();

  const displayReport = async () => {
    try {
      const report = await dashboard.generateReport();

      // Clear console in watch mode
      if (watch) {
        console.clear();
      }

      dashboard.printReport(report);

      if (exportPath) {
        dashboard.exportJSON(report, exportPath);
      }
    } catch (error) {
      logger.error('Failed to generate report:', error);
    }
  };

  if (watch) {
    console.log(`Monitoring dashboard - refreshing every ${interval}s (Ctrl+C to stop)\n`);
    displayReport();
    setInterval(displayReport, interval * 1000);
  } else {
    displayReport().then(() => process.exit(0));
  }
}
