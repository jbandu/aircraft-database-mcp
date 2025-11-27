'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Database, Clock, CheckCircle, XCircle, Play, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber, formatDateTime, getStatusColor } from '@/lib/utils';

export default function ScrapingStatusPage() {
  const [newJobAirline, setNewJobAirline] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');

  // Poll job stats every 5 seconds for real-time updates
  const { data: jobsData, isLoading, refetch } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => apiClient.getJobs(),
    refetchInterval: 5000, // Real-time updates every 5 seconds
  });

  const handleCreateJob = async () => {
    if (!newJobAirline.trim()) return;

    try {
      await apiClient.createJob({
        airline_code: newJobAirline.trim().toUpperCase(),
        priority,
      });
      setNewJobAirline('');
      refetch();
    } catch (error) {
      console.error('Failed to create job:', error);
      alert('Failed to create job: ' + (error as Error).message);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!jobsData) {
    return null;
  }

  const stats = jobsData.stats;
  const successRate =
    stats.total > 0
      ? ((stats.completed / stats.total) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-6">
      {/* Job Queue Statistics */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.total)}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatNumber(stats.pending)}</div>
            <p className="text-xs text-muted-foreground">Waiting to run</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <Play className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatNumber(stats.running)}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatNumber(stats.completed)}</div>
            <p className="text-xs text-muted-foreground">{successRate}% success rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatNumber(stats.failed)}</div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Create New Job */}
      <Card>
        <CardHeader>
          <CardTitle>Create Scraping Job</CardTitle>
          <CardDescription>
            Trigger a new fleet update for an airline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <Input
              placeholder="Airline code (e.g., AA, DL)"
              value={newJobAirline}
              onChange={(e) => setNewJobAirline(e.target.value)}
              className="max-w-xs"
            />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'low' | 'normal' | 'high')}
              className="border border-input bg-background px-3 py-2 text-sm rounded-md"
            >
              <option value="low">Low Priority</option>
              <option value="normal">Normal Priority</option>
              <option value="high">High Priority</option>
            </select>
            <Button onClick={handleCreateJob} disabled={!newJobAirline.trim()}>
              <Play className="h-4 w-4 mr-2" />
              Create Job
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Status Indicator */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium text-gray-700">
            Live Updates Active
          </span>
          <span className="text-sm text-gray-500">
            Refreshing every 5 seconds
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Now
        </Button>
      </div>

      {/* Job Queue Visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Job Queue Status</CardTitle>
          <CardDescription>Visual representation of job states</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Pending Jobs Bar */}
            {stats.pending > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">Pending</span>
                  <span className="text-sm text-gray-500">{formatNumber(stats.pending)} jobs</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${(stats.pending / stats.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Running Jobs Bar */}
            {stats.running > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">Running</span>
                  <span className="text-sm text-gray-500">{formatNumber(stats.running)} jobs</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all animate-pulse"
                    style={{
                      width: `${(stats.running / stats.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Completed Jobs Bar */}
            {stats.completed > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">Completed</span>
                  <span className="text-sm text-gray-500">{formatNumber(stats.completed)} jobs</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${(stats.completed / stats.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Failed Jobs Bar */}
            {stats.failed > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">Failed</span>
                  <span className="text-sm text-gray-500">{formatNumber(stats.failed)} jobs</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${(stats.failed / stats.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Success Rate</CardTitle>
            <CardDescription>Completed vs total jobs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600">{successRate}%</div>
            <p className="text-sm text-gray-500 mt-2">
              {formatNumber(stats.completed)} of {formatNumber(stats.total)} jobs succeeded
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Failure Rate</CardTitle>
            <CardDescription>Failed jobs percentage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-red-600">
              {stats.total > 0 ? ((stats.failed / stats.total) * 100).toFixed(1) : '0.0'}%
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {formatNumber(stats.failed)} jobs require attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Queue Utilization</CardTitle>
            <CardDescription>Active vs capacity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-600">
              {formatNumber(stats.pending + stats.running)}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Jobs in queue or processing
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle>Scraping System Information</CardTitle>
          <CardDescription>Current system configuration and status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Concurrent Job Limit:</span>
              <span className="ml-2 font-medium">5 jobs</span>
            </div>
            <div>
              <span className="text-gray-500">Retry Attempts:</span>
              <span className="ml-2 font-medium">3 retries</span>
            </div>
            <div>
              <span className="text-gray-500">Retry Delay:</span>
              <span className="ml-2 font-medium">30 minutes</span>
            </div>
            <div>
              <span className="text-gray-500">Job Timeout:</span>
              <span className="ml-2 font-medium">1 hour</span>
            </div>
            <div>
              <span className="text-gray-500">Rate Limit:</span>
              <span className="ml-2 font-medium">2000ms between requests</span>
            </div>
            <div>
              <span className="text-gray-500">LLM Provider:</span>
              <span className="ml-2 font-medium">Ollama / Claude API</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Helpful Information */}
      <Card>
        <CardHeader>
          <CardTitle>About Scraping Jobs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <p>
            <strong>Job Types:</strong> Full fleet updates scrape all aircraft for an airline,
            while incremental updates only fetch recent changes.
          </p>
          <p>
            <strong>Priority Levels:</strong> High priority jobs run first, followed by normal
            and then low priority. Use high priority sparingly for urgent updates.
          </p>
          <p>
            <strong>Automatic Retries:</strong> Failed jobs automatically retry up to 3 times
            with a 30-minute delay between attempts.
          </p>
          <p>
            <strong>Scheduling:</strong> Airlines are automatically scheduled for updates based
            on their priority level (daily for high priority, weekly for normal).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
