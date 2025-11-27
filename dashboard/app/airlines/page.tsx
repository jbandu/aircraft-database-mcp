'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Plane, Calendar, MapPin, ExternalLink } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { apiClient, type Airline } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatNumber, formatDate, getConfidenceColor } from '@/lib/utils';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AirlinesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAirline, setSelectedAirline] = useState<Airline | null>(null);

  const { data: airlinesData, isLoading } = useQuery({
    queryKey: ['airlines', searchTerm],
    queryFn: () => apiClient.getAirlines({ limit: 100 }),
  });

  const { data: fleetData, isLoading: isLoadingFleet } = useQuery({
    queryKey: ['airline-fleet', selectedAirline?.iata_code],
    queryFn: () =>
      selectedAirline
        ? apiClient.getAirlineFleet(selectedAirline.iata_code, {
            status: 'all',
            includeDetails: true,
          })
        : Promise.resolve(null),
    enabled: !!selectedAirline,
  });

  const { data: statsData, isLoading: isLoadingStats } = useQuery({
    queryKey: ['airline-stats', selectedAirline?.iata_code],
    queryFn: () =>
      selectedAirline
        ? apiClient.getAirlineStats(selectedAirline.iata_code)
        : Promise.resolve(null),
    enabled: !!selectedAirline,
  });

  const filteredAirlines = airlinesData?.airlines.filter((airline) => {
    const search = searchTerm.toLowerCase();
    return (
      airline.name.toLowerCase().includes(search) ||
      airline.iata_code.toLowerCase().includes(search) ||
      airline.icao_code.toLowerCase().includes(search) ||
      airline.country.toLowerCase().includes(search)
    );
  });

  const fleetByType = statsData?.by_aircraft_type.map((type) => ({
    name: type.iata_code,
    value: type.count,
    manufacturer: type.manufacturer,
    model: type.model,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Airlines List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Airlines</CardTitle>
            <CardDescription>Search and select an airline</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search airlines..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Airlines List */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {isLoading && (
                  <>
                    {[...Array(10)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </>
                )}

                {filteredAirlines?.map((airline) => (
                  <button
                    key={airline.id}
                    onClick={() => setSelectedAirline(airline)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedAirline?.id === airline.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-sm">{airline.iata_code}</span>
                          <span className="text-xs text-gray-500">{airline.icao_code}</span>
                        </div>
                        <p className="text-sm text-gray-900 truncate">{airline.name}</p>
                        <p className="text-xs text-gray-500">{airline.country}</p>
                      </div>
                      <Badge
                        className={getConfidenceColor(airline.data_confidence)}
                      >
                        {airline.data_confidence}
                      </Badge>
                    </div>
                  </button>
                ))}

                {filteredAirlines?.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p>No airlines found</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Airline Details */}
        <div className="lg:col-span-2">
          {!selectedAirline && (
            <Card>
              <CardContent className="flex items-center justify-center h-96">
                <div className="text-center">
                  <Plane className="h-12 w-12 mx-auto text-gray-400" />
                  <h3 className="mt-4 text-lg font-medium text-gray-900">No airline selected</h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Select an airline from the list to view details
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedAirline && (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="fleet">Fleet</TabsTrigger>
                <TabsTrigger value="stats">Statistics</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{selectedAirline.name}</CardTitle>
                        <CardDescription>
                          {selectedAirline.iata_code} / {selectedAirline.icao_code}
                        </CardDescription>
                      </div>
                      <Badge className={getConfidenceColor(selectedAirline.data_confidence)}>
                        {selectedAirline.data_confidence} Confidence
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <MapPin className="h-4 w-4" />
                          <span>Country</span>
                        </div>
                        <p className="mt-1 text-sm font-medium">{selectedAirline.country}</p>
                      </div>

                      {selectedAirline.hub_airport && (
                        <div>
                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <Plane className="h-4 w-4" />
                            <span>Hub Airport</span>
                          </div>
                          <p className="mt-1 text-sm font-medium">{selectedAirline.hub_airport}</p>
                        </div>
                      )}

                      {selectedAirline.last_scraped_at && (
                        <div>
                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <Calendar className="h-4 w-4" />
                            <span>Last Updated</span>
                          </div>
                          <p className="mt-1 text-sm font-medium">
                            {formatDate(selectedAirline.last_scraped_at)}
                          </p>
                        </div>
                      )}

                      {selectedAirline.website && (
                        <div>
                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <ExternalLink className="h-4 w-4" />
                            <span>Website</span>
                          </div>
                          <a
                            href={selectedAirline.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 text-sm font-medium text-blue-600 hover:underline flex items-center space-x-1"
                          >
                            <span>Visit Website</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {statsData && (
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Fleet Size</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {formatNumber(statsData.fleet.total_aircraft)}
                        </div>
                        <p className="text-sm text-gray-500">Total aircraft</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Average Age</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {statsData.fleet.avg_age_years || 'N/A'}{' '}
                          {statsData.fleet.avg_age_years && 'years'}
                        </div>
                        <p className="text-sm text-gray-500">Fleet average</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Active Aircraft</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {formatNumber(statsData.fleet.active)}
                        </div>
                        <p className="text-sm text-gray-500">
                          {((statsData.fleet.active / statsData.fleet.total_aircraft) * 100).toFixed(1)}% of fleet
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Aircraft Types</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {formatNumber(statsData.by_aircraft_type.length)}
                        </div>
                        <p className="text-sm text-gray-500">Different models</p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="fleet" className="space-y-4">
                {isLoadingFleet && (
                  <Card>
                    <CardContent className="py-8">
                      <div className="space-y-2">
                        {[...Array(5)].map((_, i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {fleetData && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Fleet Aircraft</CardTitle>
                      <CardDescription>
                        {formatNumber(fleetData.total_aircraft)} aircraft total
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Registration
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Type
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Model
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Status
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Location
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {fleetData.aircraft.slice(0, 50).map((aircraft) => (
                              <tr key={aircraft.id}>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                  {aircraft.registration}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">
                                  {aircraft.aircraft_type}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">
                                  {aircraft.manufacturer} {aircraft.model}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <Badge variant="outline">{aircraft.status}</Badge>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">
                                  {aircraft.current_location || 'Unknown'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {fleetData.aircraft.length > 50 && (
                        <p className="mt-4 text-sm text-gray-500 text-center">
                          Showing first 50 of {formatNumber(fleetData.total_aircraft)} aircraft
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="stats" className="space-y-4">
                {isLoadingStats && (
                  <Skeleton className="h-96 w-full" />
                )}

                {statsData && (
                  <>
                    {/* Fleet Composition Chart */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Fleet Composition</CardTitle>
                        <CardDescription>Aircraft by type</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={400}>
                          <PieChart>
                            <Pie
                              data={fleetByType}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={(entry) =>
                                `${entry.name}: ${formatNumber(entry.value)}`
                              }
                              outerRadius={140}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {fleetByType?.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Fleet Status Breakdown */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Fleet Status</CardTitle>
                        <CardDescription>Aircraft operational status</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-green-50 rounded-lg p-4">
                            <div className="text-2xl font-bold text-green-600">
                              {formatNumber(statsData.fleet.active)}
                            </div>
                            <p className="text-sm text-green-700">Active</p>
                          </div>
                          <div className="bg-yellow-50 rounded-lg p-4">
                            <div className="text-2xl font-bold text-yellow-600">
                              {formatNumber(statsData.fleet.stored)}
                            </div>
                            <p className="text-sm text-yellow-700">Stored</p>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-4">
                            <div className="text-2xl font-bold text-blue-600">
                              {formatNumber(statsData.fleet.maintenance)}
                            </div>
                            <p className="text-sm text-blue-700">Maintenance</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Aircraft Types Table */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Aircraft Types Breakdown</CardTitle>
                        <CardDescription>Detailed fleet composition</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Type
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Manufacturer
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Model
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                  Total
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                  Active
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                  % of Fleet
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {statsData.by_aircraft_type.map((type) => (
                                <tr key={type.iata_code}>
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                    {type.iata_code}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-500">
                                    {type.manufacturer}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-500">
                                    {type.model}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                    {formatNumber(type.count)}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                    {formatNumber(type.active_count)}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-500 text-right">
                                    {((type.count / statsData.fleet.total_aircraft) * 100).toFixed(1)}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
