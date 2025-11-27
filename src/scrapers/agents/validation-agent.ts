/**
 * Validation Agent
 *
 * Validates scraped aircraft data for consistency and accuracy.
 * Uses LLM for semantic validation and cross-references multiple sources.
 *
 * Strategy:
 * 1. Format validation (registration, dates, etc.)
 * 2. Cross-reference with existing database
 * 3. Semantic validation with LLM (does the data make sense?)
 * 4. Confidence scoring
 * 5. Generate recommendations for corrections
 */

import { createLogger } from '../../lib/logger.js';
import { getLLMClient } from '../../lib/llm-client.js';
import { queryPostgres } from '../../lib/db-clients.js';
import type { AircraftDetails } from './aircraft-details-agent.js';

const logger = createLogger('validation-agent');

export interface ValidationResult {
  is_valid: boolean;
  confidence_score: number;
  issues: ValidationIssue[];
  recommended_values: Record<string, any>;
  validation_summary: string;
  validated_at: Date;
}

export interface ValidationIssue {
  field: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  current_value: any;
  suggested_value: any;
  rule: string;
}

export class ValidationAgent {
  private llm = getLLMClient();

  /**
   * Validate aircraft data
   */
  async validate(
    aircraft: AircraftDetails,
    existingData: AircraftDetails | null = null
  ): Promise<ValidationResult> {
    logger.info(`Validating aircraft ${aircraft.registration}`);

    const issues: ValidationIssue[] = [];
    const recommended: Record<string, any> = {};

    // 1. Format validation
    const formatIssues = await this.validateFormats(aircraft);
    issues.push(...formatIssues);

    // 2. Logical consistency
    const logicIssues = await this.validateLogic(aircraft);
    issues.push(...logicIssues);

    // 3. Cross-reference with existing data
    if (existingData) {
      const crossRefIssues = await this.crossReferenceData(aircraft, existingData);
      issues.push(...crossRefIssues);
    }

    // 4. Type-specific validation
    const typeIssues = await this.validateAircraftType(aircraft);
    issues.push(...typeIssues);

    // 5. Semantic validation with LLM
    const semanticIssues = await this.semanticValidation(aircraft);
    issues.push(...semanticIssues);

    // Generate recommendations from issues
    for (const issue of issues) {
      if (issue.suggested_value !== null && issue.severity !== 'info') {
        recommended[issue.field] = issue.suggested_value;
      }
    }

    // Calculate overall confidence
    const confidence = this.calculateValidationConfidence(aircraft, issues);

    // Determine if data is valid (no errors)
    const hasErrors = issues.some((i) => i.severity === 'error');

    const result: ValidationResult = {
      is_valid: !hasErrors,
      confidence_score: confidence,
      issues,
      recommended_values: recommended,
      validation_summary: this.generateSummary(issues),
      validated_at: new Date(),
    };

    logger.info(
      `Validation complete: ${result.is_valid ? 'VALID' : 'INVALID'} (confidence: ${confidence.toFixed(2)})`
    );

    return result;
  }

  /**
   * Validate data formats
   */
  private async validateFormats(
    aircraft: AircraftDetails
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Validate registration format
    if (!this.isValidRegistration(aircraft.registration)) {
      issues.push({
        field: 'registration',
        severity: 'error',
        message: 'Invalid registration format',
        current_value: aircraft.registration,
        suggested_value: null,
        rule: 'registration_format',
      });
    }

    // Validate delivery date
    if (aircraft.delivery_date) {
      const deliveryDate = new Date(aircraft.delivery_date);
      const now = new Date();

      if (isNaN(deliveryDate.getTime())) {
        issues.push({
          field: 'delivery_date',
          severity: 'error',
          message: 'Invalid date format',
          current_value: aircraft.delivery_date,
          suggested_value: null,
          rule: 'date_format',
        });
      } else if (deliveryDate > now) {
        issues.push({
          field: 'delivery_date',
          severity: 'warning',
          message: 'Delivery date is in the future',
          current_value: aircraft.delivery_date,
          suggested_value: null,
          rule: 'date_logic',
        });
      } else if (deliveryDate.getFullYear() < 1903) {
        // First powered flight
        issues.push({
          field: 'delivery_date',
          severity: 'error',
          message: 'Delivery date before first powered flight',
          current_value: aircraft.delivery_date,
          suggested_value: null,
          rule: 'date_range',
        });
      }
    }

    // Validate last flight date
    if (aircraft.last_flight_date) {
      const lastFlightDate = new Date(aircraft.last_flight_date);
      const now = new Date();

      if (isNaN(lastFlightDate.getTime())) {
        issues.push({
          field: 'last_flight_date',
          severity: 'error',
          message: 'Invalid date format',
          current_value: aircraft.last_flight_date,
          suggested_value: null,
          rule: 'date_format',
        });
      } else if (lastFlightDate > now) {
        issues.push({
          field: 'last_flight_date',
          severity: 'warning',
          message: 'Last flight date is in the future',
          current_value: aircraft.last_flight_date,
          suggested_value: null,
          rule: 'date_logic',
        });
      }
    }

    // Validate seat configuration
    if (aircraft.seat_configuration) {
      const seats = aircraft.seat_configuration;
      const total =
        (seats.first || 0) +
        (seats.business || 0) +
        (seats.premium_economy || 0) +
        (seats.economy || 0);

      if (seats.total && total !== seats.total) {
        issues.push({
          field: 'seat_configuration',
          severity: 'warning',
          message: 'Seat count mismatch',
          current_value: seats.total,
          suggested_value: total,
          rule: 'seat_total',
        });
      }

      if (total > 1000) {
        issues.push({
          field: 'seat_configuration',
          severity: 'warning',
          message: 'Unusually high seat count',
          current_value: total,
          suggested_value: null,
          rule: 'seat_range',
        });
      }
    }

    return issues;
  }

  /**
   * Validate logical consistency
   */
  private async validateLogic(
    aircraft: AircraftDetails
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check if delivery date and last flight date are consistent
    if (aircraft.delivery_date && aircraft.last_flight_date) {
      const delivery = new Date(aircraft.delivery_date);
      const lastFlight = new Date(aircraft.last_flight_date);

      if (lastFlight < delivery) {
        issues.push({
          field: 'last_flight_date',
          severity: 'error',
          message: 'Last flight date is before delivery date',
          current_value: aircraft.last_flight_date,
          suggested_value: null,
          rule: 'date_sequence',
        });
      }
    }

    // Check if age matches delivery date
    if (aircraft.delivery_date && aircraft.age_years !== null) {
      const deliveryYear = new Date(aircraft.delivery_date).getFullYear();
      const currentYear = new Date().getFullYear();
      const calculatedAge = currentYear - deliveryYear;

      if (Math.abs(calculatedAge - aircraft.age_years) > 1) {
        issues.push({
          field: 'age_years',
          severity: 'warning',
          message: 'Age does not match delivery date',
          current_value: aircraft.age_years,
          suggested_value: calculatedAge,
          rule: 'age_calculation',
        });
      }
    }

    // Check if status is valid
    const validStatuses = [
      'Active',
      'Stored',
      'Maintenance',
      'Retired',
      'Scrapped',
      'Unknown',
    ];
    if (aircraft.status && !validStatuses.includes(aircraft.status)) {
      issues.push({
        field: 'status',
        severity: 'warning',
        message: `Invalid status value: ${aircraft.status}`,
        current_value: aircraft.status,
        suggested_value: 'Unknown',
        rule: 'status_enum',
      });
    }

    return issues;
  }

  /**
   * Cross-reference with existing data
   */
  private async crossReferenceData(
    newData: AircraftDetails,
    existingData: AircraftDetails
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check for significant changes in immutable fields
    if (
      existingData.msn &&
      newData.msn &&
      existingData.msn !== newData.msn
    ) {
      issues.push({
        field: 'msn',
        severity: 'error',
        message: 'MSN changed (should be immutable)',
        current_value: newData.msn,
        suggested_value: existingData.msn,
        rule: 'immutable_field',
      });
    }

    if (
      existingData.delivery_date &&
      newData.delivery_date &&
      existingData.delivery_date !== newData.delivery_date
    ) {
      issues.push({
        field: 'delivery_date',
        severity: 'warning',
        message: 'Delivery date changed',
        current_value: newData.delivery_date,
        suggested_value: existingData.delivery_date,
        rule: 'immutable_field',
      });
    }

    // Check for confidence decrease
    if (
      existingData.confidence_score &&
      newData.confidence_score < existingData.confidence_score - 0.2
    ) {
      issues.push({
        field: 'confidence_score',
        severity: 'info',
        message: 'New data has lower confidence than existing',
        current_value: newData.confidence_score,
        suggested_value: existingData.confidence_score,
        rule: 'confidence_check',
      });
    }

    return issues;
  }

  /**
   * Validate against aircraft type specifications
   */
  private async validateAircraftType(
    aircraft: AircraftDetails
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Get aircraft type specs from database
    const typeSpec = await this.getAircraftTypeSpec(aircraft.aircraft_type);

    if (!typeSpec) {
      issues.push({
        field: 'aircraft_type',
        severity: 'warning',
        message: 'Aircraft type not found in database',
        current_value: aircraft.aircraft_type,
        suggested_value: null,
        rule: 'type_exists',
      });
      return issues;
    }

    // Validate manufacturer matches
    if (
      aircraft.manufacturer &&
      aircraft.manufacturer !== typeSpec.manufacturer
    ) {
      issues.push({
        field: 'manufacturer',
        severity: 'warning',
        message: `Manufacturer mismatch for type ${aircraft.aircraft_type}`,
        current_value: aircraft.manufacturer,
        suggested_value: typeSpec.manufacturer,
        rule: 'type_manufacturer',
      });
    }

    // Validate seat count is within reasonable range
    if (aircraft.seat_configuration?.total) {
      const seatCount = aircraft.seat_configuration.total;
      const typicalMin = typeSpec.typical_seats * 0.7; // 30% below typical
      const typicalMax = typeSpec.max_seats * 1.1; // 10% above max

      if (seatCount < typicalMin || seatCount > typicalMax) {
        issues.push({
          field: 'seat_configuration',
          severity: 'warning',
          message: `Seat count (${seatCount}) unusual for ${aircraft.aircraft_type} (typical: ${typeSpec.typical_seats})`,
          current_value: seatCount,
          suggested_value: null,
          rule: 'type_capacity',
        });
      }
    }

    return issues;
  }

  /**
   * Semantic validation using LLM
   */
  private async semanticValidation(
    aircraft: AircraftDetails
  ): Promise<ValidationIssue[]> {
    logger.info('Performing semantic validation with LLM');

    const prompt = `You are validating aircraft data for logical consistency and reasonableness.

Aircraft Data:
- Registration: ${aircraft.registration}
- Type: ${aircraft.aircraft_type}
- Manufacturer: ${aircraft.manufacturer}
- Model: ${aircraft.model}
- MSN: ${aircraft.msn || 'N/A'}
- Seats: ${JSON.stringify(aircraft.seat_configuration)}
- Delivery Date: ${aircraft.delivery_date || 'N/A'}
- Age: ${aircraft.age_years || 'N/A'} years
- Status: ${aircraft.status}
- Engines: ${aircraft.engines || 'N/A'}

Check if this data makes sense from an aviation perspective:
1. Does the seat configuration match the aircraft type?
2. Is the delivery date reasonable for this aircraft type?
3. Does the engine type match this aircraft model?
4. Are there any obvious inconsistencies?

Return a JSON array of issues found. Each issue should have:
- field: Field name with the issue
- severity: "info", "warning", or "error"
- message: Description of the issue

Example response:
{
  "issues": [
    {
      "field": "seat_configuration",
      "severity": "warning",
      "message": "737-800 typically has 150-189 seats, but 500 is unusually high"
    }
  ]
}

If no issues found, return:
{
  "issues": []
}`;

    try {
      const response = await this.llm.generateJSON<{
        issues: Array<{
          field: string;
          severity: 'info' | 'warning' | 'error';
          message: string;
        }>;
      }>(prompt, {
        temperature: 0.1,
        system:
          'You are an aviation expert validating aircraft data. Be conservative in flagging issues.',
      });

      const issues: ValidationIssue[] = response.issues.map((issue) => ({
        field: issue.field,
        severity: issue.severity,
        message: issue.message,
        current_value: (aircraft as any)[issue.field],
        suggested_value: null,
        rule: 'semantic_check',
      }));

      logger.info(`LLM found ${issues.length} semantic issues`);
      return issues;
    } catch (error) {
      logger.error('Semantic validation failed:', error);
      return [];
    }
  }

  /**
   * Get aircraft type specifications from database
   */
  private async getAircraftTypeSpec(aircraftType: string): Promise<{
    manufacturer: string;
    typical_seats: number;
    max_seats: number;
  } | null> {
    if (!aircraftType) return null;

    const query = `
      SELECT manufacturer, typical_seats, max_seats
      FROM aircraft_types
      WHERE iata_code = $1 OR icao_code = $1
      LIMIT 1
    `;

    const result = await queryPostgres(query, [aircraftType]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Validate registration format
   */
  private isValidRegistration(registration: string): boolean {
    if (!registration || registration.length < 3) {
      return false;
    }

    // Common registration patterns
    const patterns = [
      /^N[0-9]{1,5}[A-Z]{0,2}$/, // USA: N12345 or N123AB
      /^[A-Z]{1,2}-[A-Z]{3,4}$/, // Europe: G-ABCD, D-ABCD
      /^[A-Z]{2}-[A-Z]{3}$/, // VH-ABC (Australia)
      /^[A-Z]{2}[0-9]{3,4}$/, // Asia: 9M1234
      /^[A-Z][0-9]-[A-Z]{3}$/, // China: B-1234
    ];

    return patterns.some((pattern) => pattern.test(registration.toUpperCase()));
  }

  /**
   * Calculate overall confidence score
   */
  private calculateValidationConfidence(
    aircraft: AircraftDetails,
    issues: ValidationIssue[]
  ): number {
    let confidence = aircraft.confidence_score || 0.5;

    // Reduce confidence for each issue
    for (const issue of issues) {
      switch (issue.severity) {
        case 'error':
          confidence -= 0.2;
          break;
        case 'warning':
          confidence -= 0.1;
          break;
        case 'info':
          confidence -= 0.05;
          break;
      }
    }

    // Increase confidence for complete data
    const completenessBonus = this.calculateCompleteness(aircraft) * 0.2;
    confidence += completenessBonus;

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Calculate data completeness (0-1)
   */
  private calculateCompleteness(aircraft: AircraftDetails): number {
    const fields = [
      aircraft.aircraft_type,
      aircraft.manufacturer,
      aircraft.model,
      aircraft.msn,
      aircraft.delivery_date,
      aircraft.status,
      Object.keys(aircraft.seat_configuration).length > 0,
    ];

    const filledFields = fields.filter(Boolean).length;
    return filledFields / fields.length;
  }

  /**
   * Generate validation summary
   */
  private generateSummary(issues: ValidationIssue[]): string {
    if (issues.length === 0) {
      return 'All validations passed successfully';
    }

    const errors = issues.filter((i) => i.severity === 'error').length;
    const warnings = issues.filter((i) => i.severity === 'warning').length;
    const infos = issues.filter((i) => i.severity === 'info').length;

    const parts: string[] = [];
    if (errors > 0) parts.push(`${errors} error(s)`);
    if (warnings > 0) parts.push(`${warnings} warning(s)`);
    if (infos > 0) parts.push(`${infos} info(s)`);

    return `Found ${parts.join(', ')}`;
  }
}
