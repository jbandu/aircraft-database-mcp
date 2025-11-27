/**
 * API Client for Aircraft Database REST API
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

class APIClient {
  private baseURL: string;
  private apiKey: string;

  constructor(baseURL: string, apiKey: string) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      ...options?.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: 'Unknown error',
          message: response.statusText,
        }));
        throw new Error(error.message || error.error || 'API request failed');
      }

      return response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Airlines
  async getAirlines(params?: {
    country?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    order?: string;
  }) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          query.append(key, value.toString());
        }
      });
    }
    const endpoint = `/api/v1/airlines${query.toString() ? `?${query}` : ''}`;
    return this.request<{
      airlines: Airline[];
      pagination: { total: number; limit: number; offset: number };
    }>(endpoint);
  }

  async getAirline(code: string) {
    return this.request<Airline>(`/api/v1/airlines/${code}`);
  }

  async getAirlineFleet(
    code: string,
    params?: { status?: string; includeDetails?: boolean }
  ) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          query.append(key, value.toString());
        }
      });
    }
    const endpoint = `/api/v1/airlines/${code}/fleet${query.toString() ? `?${query}` : ''}`;
    return this.request<{
      airline_code: string;
      airline_name: string;
      total_aircraft: number;
      aircraft: Aircraft[];
    }>(endpoint);
  }

  async triggerAirlineUpdate(code: string, force: boolean = false, priority: string = 'normal') {
    return this.request<{
      message: string;
      job_id: string;
      airline_code: string;
      status: string;
    }>(`/api/v1/airlines/${code}/trigger-update`, {
      method: 'POST',
      body: JSON.stringify({ force, priority }),
    });
  }

  // Aircraft
  async searchAircraft(params?: {
    airline_code?: string;
    aircraft_type?: string;
    status?: string;
    registration?: string;
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          query.append(key, value.toString());
        }
      });
    }
    const endpoint = `/api/v1/aircraft${query.toString() ? `?${query}` : ''}`;
    return this.request<{
      aircraft: Aircraft[];
      count: number;
    }>(endpoint);
  }

  async getAircraft(registration: string) {
    return this.request<AircraftDetails>(`/api/v1/aircraft/${registration}`);
  }

  async getAircraftHistory(registration: string) {
    return this.request<{
      registration: string;
      history: FleetChange[];
    }>(`/api/v1/aircraft/${registration}/history`);
  }

  // Statistics
  async getGlobalStats() {
    return this.request<GlobalStats>('/api/v1/stats/global');
  }

  async getAirlineStats(code: string) {
    return this.request<AirlineStats>(`/api/v1/stats/airline/${code}`);
  }

  // Scraping Jobs
  async getJobs(params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          query.append(key, value.toString());
        }
      });
    }
    const endpoint = `/api/v1/jobs${query.toString() ? `?${query}` : ''}`;
    return this.request<{
      stats: JobStats;
      message?: string;
    }>(endpoint);
  }

  async getJob(id: string) {
    return this.request<Job>(`/api/v1/jobs/${id}`);
  }

  async createJob(params: {
    airline_code: string;
    job_type?: string;
    priority?: string;
    scheduled_at?: string;
  }) {
    return this.request<{
      job_id: string;
      airline_code: string;
      status: string;
      message: string;
    }>('/api/v1/jobs', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Health Check
  async getHealth() {
    return this.request<HealthStatus>('/health');
  }
}

// Types
export interface Airline {
  id: string;
  iata_code: string;
  icao_code: string;
  name: string;
  country: string;
  hub_airport?: string;
  website?: string;
  data_confidence: 'High' | 'Medium' | 'Low';
  last_scraped_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Aircraft {
  id: string;
  registration: string;
  airline_code: string;
  airline_name: string;
  aircraft_type: string;
  manufacturer: string;
  model: string;
  status: 'Active' | 'Stored' | 'Maintenance';
  current_location?: string;
  delivery_date?: string;
  data_confidence: 'High' | 'Medium' | 'Low';
}

export interface AircraftDetails extends Aircraft {
  serial_number?: string;
  manufactured_year?: number;
  seat_configuration?: Record<string, number>;
  typical_seats?: number;
  max_seats?: number;
  range_km?: number;
  notes?: string;
  last_scraped_at?: string;
}

export interface FleetChange {
  id: string;
  aircraft_id: string;
  change_type: 'acquisition' | 'disposal' | 'transfer' | 'status_change';
  from_airline_code?: string;
  from_airline_name?: string;
  to_airline_code?: string;
  to_airline_name?: string;
  change_date: string;
  notes?: string;
  created_at: string;
}

export interface GlobalStats {
  total: {
    total_airlines: number;
    total_aircraft: number;
    total_aircraft_types: number;
    active_aircraft: number;
  };
  by_aircraft_type: Array<{
    iata_code: string;
    manufacturer: string;
    model: string;
    count: number;
  }>;
  by_country: Array<{
    country: string;
    airline_count: number;
    aircraft_count: number;
  }>;
}

export interface AirlineStats {
  airline: {
    code: string;
    name: string;
  };
  fleet: {
    total_aircraft: number;
    active: number;
    stored: number;
    maintenance: number;
    avg_age_years?: number;
    oldest_delivery?: string;
    newest_delivery?: string;
  };
  by_aircraft_type: Array<{
    iata_code: string;
    manufacturer: string;
    model: string;
    count: number;
    active_count: number;
  }>;
}

export interface JobStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
}

export interface Job {
  id: string;
  airline_code: string;
  job_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  priority: 'low' | 'normal' | 'high';
  scheduled_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  created_at: string;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  database: 'connected' | 'disconnected' | 'unknown';
}

// Export singleton instance
export const apiClient = new APIClient(API_BASE_URL, API_KEY);
