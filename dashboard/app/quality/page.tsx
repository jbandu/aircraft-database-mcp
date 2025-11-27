'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Clock, Database } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber, formatDateTime, getConfidenceColor } from '@/lib/utils';

export default function DataQualityPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['global-stats'],
    queryFn: () => apiClient.getGlobalStats(),
  });

  const { data: airlinesData } = useQuery({
    queryKey: ['airlines'],
    queryFn: () => apiClient.getAirlines({ limit: 100 }),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats || !airlinesData) {
    return null;
  }

  // Calculate data quality metrics
  const airlines = airlinesData.airlines;
  const totalAirlines = airlines.length;

  const confidenceBreakdown = {
    high: airlines.filter((a) => a.data_confidence === 'High').length,
    medium: airlines.filter((a) => a.data_confidence === 'Medium').length,
    low: airlines.filter((a) => a.data_confidence === 'Low').length,
  };

  const airlinesWithRecentData = airlines.filter((a) => {
    if (!a.last_scraped_at) return false;
    const lastScraped = new Date(a.last_scraped_at);
    const daysSince = (Date.now() - lastScraped.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 7;
  }).length;

  const airlinesNeverScraped = airlines.filter((a) => !a.last_scraped_at).length;
  const airlinesStale = airlines.filter((a) => {
    if (!a.last_scraped_at) return false;
    const lastScraped = new Date(a.last_scraped_at);
    const daysSince = (Date.now() - lastScraped.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 30;
  }).length;

  const confidenceChartData = [
    { name: 'High', value: confidenceBreakdown.high, fill: '#10b981' },
    { name: 'Medium', value: confidenceBreakdown.medium, fill: '#f59e0b' },
    { name: 'Low', value: confidenceBreakdown.low, fill: '#ef4444' },
  ];

  const overallScore = Math.round(
    ((confidenceBreakdown.high * 100 +
      confidenceBreakdown.medium * 70 +
      confidenceBreakdown.low * 40) /
      totalAirlines)
  );

  // Airlines needing attention (low confidence or stale data)
  const airlinesNeedingAttention = airlines
    .filter(
      (a) =>
        a.data_confidence === 'Low' ||
        !a.last_scraped_at ||
        (a.last_scraped_at &&
          (Date.now() - new Date(a.last_scraped_at).getTime()) / (1000 * 60 * 60 * 24) > 30)
    )
    .slice(0, 20);

  return (
    <div className="space-y-6">
      {/* Overall Quality Score */}
      <Card className="bg-gradient-to-br from-blue-50 to-white">
        <CardHeader>
          <CardTitle>Overall Data Quality Score</CardTitle>
          <CardDescription>Composite score based on confidence and freshness</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="text-7xl font-bold text-blue-600">{overallScore}</div>
              <div className="absolute -right-8 top-0 text-3xl text-gray-400">/ 100</div>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              {overallScore >= 80 && 'Excellent data quality'}
              {overallScore >= 60 && overallScore < 80 && 'Good data quality'}
              {overallScore >= 40 && overallScore < 60 && 'Fair data quality, improvements needed'}
              {overallScore < 40 && 'Poor data quality, attention required'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Confidence</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatNumber(confidenceBreakdown.high)}
            </div>
            <p className="text-xs text-muted-foreground">
              {((confidenceBreakdown.high / totalAirlines) * 100).toFixed(1)}% of airlines
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Medium Confidence</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatNumber(confidenceBreakdown.medium)}
            </div>
            <p className="text-xs text-muted-foreground">
              {((confidenceBreakdown.medium / totalAirlines) * 100).toFixed(1)}% of airlines
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Confidence</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatNumber(confidenceBreakdown.low)}
            </div>
            <p className="text-xs text-muted-foreground">
              {((confidenceBreakdown.low / totalAirlines) * 100).toFixed(1)}% of airlines
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Data</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatNumber(airlinesWithRecentData)}
            </div>
            <p className="text-xs text-muted-foreground">
              Updated within 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Data Confidence Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Data Confidence Distribution</CardTitle>
          <CardDescription>Breakdown of data quality across airlines</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={confidenceChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" name="Airlines" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Data Freshness */}
      <Card>
        <CardHeader>
          <CardTitle>Data Freshness</CardTitle>
          <CardDescription>When airline data was last updated</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div>
                <div className="font-semibold text-green-900">Recent (Last 7 days)</div>
                <div className="text-sm text-green-700">
                  Fresh data, no action needed
                </div>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {formatNumber(airlinesWithRecentData)}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
              <div>
                <div className="font-semibold text-yellow-900">Stale (Over 30 days)</div>
                <div className="text-sm text-yellow-700">
                  Should be refreshed soon
                </div>
              </div>
              <div className="text-2xl font-bold text-yellow-600">
                {formatNumber(airlinesStale)}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
              <div>
                <div className="font-semibold text-red-900">Never Scraped</div>
                <div className="text-sm text-red-700">
                  Requires immediate attention
                </div>
              </div>
              <div className="text-2xl font-bold text-red-600">
                {formatNumber(airlinesNeverScraped)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Completeness Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Data Completeness</CardTitle>
          <CardDescription>Coverage of key data fields</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Hub Airport Coverage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Hub Airport Information</span>
                <span className="text-sm text-gray-500">
                  {airlines.filter((a) => a.hub_airport).length} / {totalAirlines}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{
                    width: `${(airlines.filter((a) => a.hub_airport).length / totalAirlines) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Website Coverage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Website URLs</span>
                <span className="text-sm text-gray-500">
                  {airlines.filter((a) => a.website).length} / {totalAirlines}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{
                    width: `${(airlines.filter((a) => a.website).length / totalAirlines) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Last Scraped Coverage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Scraping Data Available</span>
                <span className="text-sm text-gray-500">
                  {airlines.filter((a) => a.last_scraped_at).length} / {totalAirlines}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{
                    width: `${(airlines.filter((a) => a.last_scraped_at).length / totalAirlines) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Airlines Needing Attention */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Review Queue</CardTitle>
          <CardDescription>
            Airlines with low confidence or stale data (showing top 20)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Airline
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Country
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Confidence
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Last Scraped
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Issue
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {airlinesNeedingAttention.map((airline) => {
                  const daysSinceScraped = airline.last_scraped_at
                    ? Math.floor(
                        (Date.now() - new Date(airline.last_scraped_at).getTime()) /
                          (1000 * 60 * 60 * 24)
                      )
                    : null;

                  let issue = '';
                  if (!airline.last_scraped_at) {
                    issue = 'Never scraped';
                  } else if (daysSinceScraped && daysSinceScraped > 30) {
                    issue = `Stale (${daysSinceScraped}d old)`;
                  } else if (airline.data_confidence === 'Low') {
                    issue = 'Low confidence';
                  }

                  return (
                    <tr key={airline.id}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {airline.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {airline.iata_code}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {airline.country}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Badge className={getConfidenceColor(airline.data_confidence)}>
                          {airline.data_confidence}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {airline.last_scraped_at
                          ? formatDateTime(airline.last_scraped_at)
                          : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Badge variant="outline" className="text-red-600 border-red-600">
                          {issue}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Data Quality Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle>Data Quality Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <div>
            <strong className="text-gray-900">High Confidence:</strong> Data from official airline
            sources, verified by multiple sources, or recently updated (within 7 days).
          </div>
          <div>
            <strong className="text-gray-900">Medium Confidence:</strong> Data from secondary
            sources or slightly outdated (7-30 days old) but still reliable.
          </div>
          <div>
            <strong className="text-gray-900">Low Confidence:</strong> Data from unverified
            sources, very outdated (over 30 days), or missing critical information.
          </div>
          <div className="pt-2 border-t">
            <strong className="text-gray-900">Recommended Actions:</strong>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>Review airlines with Low confidence manually</li>
              <li>Trigger updates for airlines with stale data (over 30 days)</li>
              <li>Investigate airlines that have never been scraped</li>
              <li>Maintain at least 80% of airlines with High confidence</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
