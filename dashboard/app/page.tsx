'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Plane, TrendingUp, Globe, Cog } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/lib/utils';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function FleetOverviewPage() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['global-stats'],
    queryFn: () => apiClient.getGlobalStats(),
  });

  const { data: healthData } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.getHealth(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

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

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Error loading data</h3>
          <p className="mt-2 text-sm text-gray-500">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const statusBreakdown = [
    {
      name: 'Active',
      value: stats.total.active_aircraft,
      color: COLORS[1],
    },
    {
      name: 'Inactive',
      value: stats.total.total_aircraft - stats.total.active_aircraft,
      color: COLORS[2],
    },
  ];

  return (
    <div className="space-y-6">
      {/* System Health */}
      {healthData && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  healthData.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="text-sm font-medium text-gray-700">
                System Status: {healthData.status}
              </span>
              <span className="text-sm text-gray-500">
                Database: {healthData.database}
              </span>
            </div>
            <span className="text-sm text-gray-500">
              Uptime: {Math.floor(healthData.uptime / 3600)}h {Math.floor((healthData.uptime % 3600) / 60)}m
            </span>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Airlines</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.total.total_airlines)}</div>
            <p className="text-xs text-muted-foreground">Active carriers worldwide</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Aircraft</CardTitle>
            <Plane className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.total.total_aircraft)}</div>
            <p className="text-xs text-muted-foreground">In global fleet</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Aircraft</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.total.active_aircraft)}</div>
            <p className="text-xs text-muted-foreground">
              {((stats.total.active_aircraft / stats.total.total_aircraft) * 100).toFixed(1)}% of fleet
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aircraft Types</CardTitle>
            <Cog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.total.total_aircraft_types)}</div>
            <p className="text-xs text-muted-foreground">Different models tracked</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Aircraft Types */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Aircraft Types</CardTitle>
            <CardDescription>Most common aircraft in global fleet</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={stats.by_aircraft_type}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="iata_code" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#3b82f6" name="Aircraft Count" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Active vs Inactive Status */}
        <Card>
          <CardHeader>
            <CardTitle>Fleet Status Distribution</CardTitle>
            <CardDescription>Active vs inactive aircraft</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={statusBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${formatNumber(entry.value)}`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Countries */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Countries by Fleet Size</CardTitle>
          <CardDescription>Countries with largest combined airline fleets</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={stats.by_country} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="country" type="category" width={120} />
              <Tooltip />
              <Legend />
              <Bar dataKey="aircraft_count" fill="#10b981" name="Aircraft" />
              <Bar dataKey="airline_count" fill="#3b82f6" name="Airlines" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Aircraft Type Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Aircraft Type Details</CardTitle>
          <CardDescription>Complete breakdown of aircraft types</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IATA Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Manufacturer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Model
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Count
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    % of Fleet
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.by_aircraft_type.map((type) => (
                  <tr key={type.iata_code}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {type.iata_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {type.manufacturer}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {type.model}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatNumber(type.count)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                      {((type.count / stats.total.total_aircraft) * 100).toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
