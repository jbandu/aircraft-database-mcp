/**
 * Seed Copa Airlines Fleet Data
 *
 * Seeds Copa Airlines (CM/CMP) complete fleet data including:
 * - Boeing 737-700 (9 aircraft)
 * - Boeing 737-800 (58 aircraft)
 * - Boeing 737-800BCF (1 freighter + 1 on order)
 * - Boeing 737 MAX 8 (7 aircraft)
 * - Boeing 737 MAX 9 (32 aircraft)
 *
 * Source: Wikipedia, public aviation databases (June 2025)
 */

import { createLogger } from '../src/lib/logger.js';
import { queryPostgres } from '../src/lib/db-clients.js';

const logger = createLogger('seed-copa-fleet');

// Copa Airlines fleet data - June 2025
interface AircraftData {
  registration: string;
  aircraftType: string;
  manufacturer: string;
  model: string;
  series: string;
  msn?: string;
  deliveryDate?: string;
  status: 'active' | 'stored' | 'maintenance' | 'retired';
  seatConfig?: {
    business?: number;
    premiumEconomy?: number;
    economy?: number;
  };
  totalSeats?: number;
  notes?: string;
  livery?: string;
}

// Boeing 737-700 Fleet (9 aircraft)
const boeing737_700Fleet: AircraftData[] = [
  {
    registration: 'HP-1371CMP',
    aircraftType: 'Boeing 737-700',
    manufacturer: 'Boeing',
    model: '737',
    series: '-700',
    status: 'active',
    seatConfig: { business: 12, economy: 112 },
    totalSeats: 124,
    notes: 'Copa Colombia operations',
  },
  {
    registration: 'HP-1373CMP',
    aircraftType: 'Boeing 737-700',
    manufacturer: 'Boeing',
    model: '737',
    series: '-700',
    status: 'active',
    seatConfig: { business: 12, economy: 112 },
    totalSeats: 124,
  },
  {
    registration: 'HP-1520CMP',
    aircraftType: 'Boeing 737-700',
    manufacturer: 'Boeing',
    model: '737',
    series: '-700',
    status: 'active',
    seatConfig: { business: 12, economy: 112 },
    totalSeats: 124,
  },
  {
    registration: 'HP-1521CMP',
    aircraftType: 'Boeing 737-700',
    manufacturer: 'Boeing',
    model: '737',
    series: '-700',
    status: 'active',
    seatConfig: { business: 12, economy: 112 },
    totalSeats: 124,
  },
  {
    registration: 'HP-1522CMP',
    aircraftType: 'Boeing 737-700',
    manufacturer: 'Boeing',
    model: '737',
    series: '-700',
    status: 'active',
    seatConfig: { business: 12, economy: 112 },
    totalSeats: 124,
  },
  {
    registration: 'HP-1523CMP',
    aircraftType: 'Boeing 737-700',
    manufacturer: 'Boeing',
    model: '737',
    series: '-700',
    status: 'active',
    seatConfig: { business: 12, economy: 112 },
    totalSeats: 124,
  },
  {
    registration: 'HP-1524CMP',
    aircraftType: 'Boeing 737-700',
    manufacturer: 'Boeing',
    model: '737',
    series: '-700',
    status: 'active',
    seatConfig: { business: 12, economy: 112 },
    totalSeats: 124,
  },
  {
    registration: 'HP-1525CMP',
    aircraftType: 'Boeing 737-700',
    manufacturer: 'Boeing',
    model: '737',
    series: '-700',
    status: 'active',
    seatConfig: { business: 12, economy: 112 },
    totalSeats: 124,
  },
  {
    registration: 'HP-1526CMP',
    aircraftType: 'Boeing 737-700',
    manufacturer: 'Boeing',
    model: '737',
    series: '-700',
    status: 'active',
    seatConfig: { business: 12, economy: 112 },
    totalSeats: 124,
  },
];

// Boeing 737-800 Fleet (58 aircraft) - Known registrations
const boeing737_800Fleet: AircraftData[] = [
  {
    registration: 'HP-1534CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1536CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1539CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1711CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
    livery: '70 Anos (Anniversary)',
  },
  {
    registration: 'HP-1712CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1713CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1714CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1715CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
    notes: 'Leased to Wingo',
  },
  {
    registration: 'HP-1716CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1717CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1718CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1719CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1720CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1721CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1722CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1723CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1724CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1725CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1726CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1727CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1728CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    deliveryDate: '2012-03-01',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
    livery: 'Star Alliance',
  },
  {
    registration: 'HP-1729CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    msn: '41088',
    deliveryDate: '2012-03-01',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1821CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1822CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1823CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    deliveryDate: '2012-05-01',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
    livery: 'Star Alliance',
  },
  {
    registration: 'HP-1824CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1825CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    deliveryDate: '2012-10-01',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
    livery: 'Biomuseo',
  },
  {
    registration: 'HP-1826CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1827CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1828CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1829CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1830CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    deliveryDate: '2013-03-01',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
    livery: 'Star Alliance',
  },
  {
    registration: 'HP-1831CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1832CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1833CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1834CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1835CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1836CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1837CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1838CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1839CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1840CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1841CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1842CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1843CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1844CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1845CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1846CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1847CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1848CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1849CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1850CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1851CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1852CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1853CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1854CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
  {
    registration: 'HP-1855CMP',
    aircraftType: 'Boeing 737-800',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800',
    status: 'active',
    seatConfig: { business: 16, economy: 150 },
    totalSeats: 166,
  },
];

// Boeing 737-800BCF Freighter (1 active, 1 on order)
const boeing737_800BCFFleet: AircraftData[] = [
  {
    registration: 'HP-1537CMP',
    aircraftType: 'Boeing 737-800BCF',
    manufacturer: 'Boeing',
    model: '737',
    series: '-800BCF',
    status: 'active',
    totalSeats: 0,
    notes: 'Converted freighter for cargo operations',
  },
];

// Boeing 737 MAX 8 Fleet (7 aircraft)
const boeing737MAX8Fleet: AircraftData[] = [
  {
    registration: 'HP-9801CMP',
    aircraftType: 'Boeing 737 MAX 8',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 8',
    deliveryDate: '2024-07-01',
    status: 'active',
    seatConfig: { business: 16, premiumEconomy: 24, economy: 126 },
    totalSeats: 166,
    notes: 'First MAX 8, 100th aircraft milestone',
  },
  {
    registration: 'HP-9802CMP',
    aircraftType: 'Boeing 737 MAX 8',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 8',
    deliveryDate: '2024-08-01',
    status: 'active',
    seatConfig: { business: 16, premiumEconomy: 24, economy: 126 },
    totalSeats: 166,
  },
  {
    registration: 'HP-9803CMP',
    aircraftType: 'Boeing 737 MAX 8',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 8',
    deliveryDate: '2024-09-01',
    status: 'active',
    seatConfig: { business: 16, premiumEconomy: 24, economy: 126 },
    totalSeats: 166,
  },
  {
    registration: 'HP-9804CMP',
    aircraftType: 'Boeing 737 MAX 8',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 8',
    deliveryDate: '2024-10-01',
    status: 'active',
    seatConfig: { business: 16, premiumEconomy: 24, economy: 126 },
    totalSeats: 166,
  },
  {
    registration: 'HP-9805CMP',
    aircraftType: 'Boeing 737 MAX 8',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 8',
    deliveryDate: '2024-11-01',
    status: 'active',
    seatConfig: { business: 16, premiumEconomy: 24, economy: 126 },
    totalSeats: 166,
  },
  {
    registration: 'HP-9806CMP',
    aircraftType: 'Boeing 737 MAX 8',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 8',
    deliveryDate: '2024-12-01',
    status: 'active',
    seatConfig: { business: 16, premiumEconomy: 24, economy: 126 },
    totalSeats: 166,
  },
  {
    registration: 'HP-9807CMP',
    aircraftType: 'Boeing 737 MAX 8',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 8',
    deliveryDate: '2025-01-01',
    status: 'active',
    seatConfig: { business: 16, premiumEconomy: 24, economy: 126 },
    totalSeats: 166,
  },
];

// Boeing 737 MAX 9 Fleet (32 aircraft)
const boeing737MAX9Fleet: AircraftData[] = [
  {
    registration: 'HP-9901CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2018-10-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
    notes: 'First MAX delivery',
  },
  {
    registration: 'HP-9902CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2018-11-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9903CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2018-12-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9904CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2018-12-15',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9905CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2021-03-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9906CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2021-04-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9907CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2021-05-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9908CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2021-06-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9909CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2021-07-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9910CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2021-08-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9911CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2021-09-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9912CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2021-10-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9913CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2021-11-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9914CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2021-12-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9915CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2022-01-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
    notes: '15th MAX 9',
  },
  {
    registration: 'HP-9916CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2022-03-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9917CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2022-05-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9918CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2022-07-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9919CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2022-09-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9920CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2022-11-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9921CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2023-01-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9922CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2023-03-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9923CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2023-05-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9924CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2023-07-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9925CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2023-09-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9926CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2023-11-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9927CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2024-01-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9928CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2024-03-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9929CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2024-04-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9930CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2024-05-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9931CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2024-06-01',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
  {
    registration: 'HP-9932CMP',
    aircraftType: 'Boeing 737 MAX 9',
    manufacturer: 'Boeing',
    model: '737',
    series: 'MAX 9',
    deliveryDate: '2024-06-15',
    status: 'active',
    seatConfig: { business: 12, premiumEconomy: 24, economy: 138 },
    totalSeats: 174,
  },
];

// Combine all fleets
const allCopaAircraft: AircraftData[] = [
  ...boeing737_700Fleet,
  ...boeing737_800Fleet,
  ...boeing737_800BCFFleet,
  ...boeing737MAX8Fleet,
  ...boeing737MAX9Fleet,
];

interface SeedResult {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  byType: Record<string, number>;
}

class CopaFleetSeeder {
  private result: SeedResult = {
    total: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    byType: {},
  };

  private airlineId: number | null = null;

  async seed(options?: { clean?: boolean; dryRun?: boolean }): Promise<void> {
    console.log(
      '\n╔═══════════════════════════════════════════════════════════════════╗'
    );
    console.log(
      '║              Copa Airlines Fleet - Database Seeding               ║'
    );
    console.log(
      '╚═══════════════════════════════════════════════════════════════════╝\n'
    );

    if (options?.dryRun) {
      console.log('  DRY RUN MODE - No changes will be made\n');
    }

    // Get or create Copa Airlines
    await this.ensureCopaAirline(options?.dryRun);

    if (!this.airlineId && !options?.dryRun) {
      throw new Error('Failed to get/create Copa Airlines record');
    }

    if (options?.clean) {
      await this.cleanExistingFleet(options.dryRun);
    }

    // Seed aircraft
    console.log('Seeding Copa Airlines fleet...\n');
    for (const aircraft of allCopaAircraft) {
      await this.seedAircraft(aircraft, options?.dryRun);
    }

    // Update fleet size
    await this.updateFleetSize(options?.dryRun);

    // Print summary
    this.printSummary();
  }

  private async ensureCopaAirline(dryRun?: boolean): Promise<void> {
    console.log('Checking for Copa Airlines record...\n');

    if (dryRun) {
      console.log('  [DRY RUN] Would verify/create Copa Airlines (CM/CMP)\n');
      return;
    }

    // Check if Copa exists
    const existsQuery = `
      SELECT id FROM airlines WHERE iata_code = 'CM' OR icao_code = 'CMP' LIMIT 1
    `;
    const existsResult = await queryPostgres(existsQuery);

    if (existsResult.rows.length > 0) {
      this.airlineId = existsResult.rows[0].id;
      console.log(`  Found Copa Airlines (ID: ${this.airlineId})\n`);
    } else {
      // Create Copa Airlines
      const insertQuery = `
        INSERT INTO airlines (
          iata_code, icao_code, name, country, alliance,
          business_model, website_url, fleet_size
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;
      const insertResult = await queryPostgres(insertQuery, [
        'CM',
        'CMP',
        'Copa Airlines',
        'Panama',
        'Star Alliance',
        'full-service',
        'https://www.copaair.com',
        107,
      ]);
      this.airlineId = insertResult.rows[0].id;
      console.log(`  Created Copa Airlines (ID: ${this.airlineId})\n`);
    }
  }

  private async cleanExistingFleet(dryRun?: boolean): Promise<void> {
    console.log('Cleaning existing Copa fleet data...\n');

    if (dryRun) {
      console.log('  [DRY RUN] Would delete all Copa aircraft\n');
      return;
    }

    if (!this.airlineId) return;

    const deleteQuery = `DELETE FROM aircraft WHERE airline_id = $1`;
    const deleteResult = await queryPostgres(deleteQuery, [this.airlineId]);
    console.log(`  Deleted ${deleteResult.rowCount} existing aircraft\n`);
  }

  private async seedAircraft(
    aircraft: AircraftData,
    dryRun?: boolean
  ): Promise<void> {
    this.result.total++;

    // Track by type
    if (!this.result.byType[aircraft.aircraftType]) {
      this.result.byType[aircraft.aircraftType] = 0;
    }

    try {
      if (dryRun) {
        console.log(
          `  [DRY RUN] Would seed: ${aircraft.registration} (${aircraft.aircraftType})`
        );
        this.result.inserted++;
        this.result.byType[aircraft.aircraftType]++;
        return;
      }

      // Check if aircraft exists
      const existsQuery = `SELECT id FROM aircraft WHERE registration = $1 LIMIT 1`;
      const existsResult = await queryPostgres(existsQuery, [
        aircraft.registration,
      ]);

      const exists = existsResult.rows.length > 0;

      // Get aircraft_type_id
      const typeQuery = `
        SELECT id FROM aircraft_types
        WHERE manufacturer = $1 AND model = $2 AND series = $3
        LIMIT 1
      `;
      const typeResult = await queryPostgres(typeQuery, [
        aircraft.manufacturer,
        aircraft.model,
        aircraft.series,
      ]);
      const aircraftTypeId =
        typeResult.rows.length > 0 ? typeResult.rows[0].id : null;

      if (exists) {
        await this.updateAircraft(aircraft, aircraftTypeId);
        this.result.updated++;
        console.log(`  Updated: ${aircraft.registration}`);
      } else {
        await this.insertAircraft(aircraft, aircraftTypeId);
        this.result.inserted++;
        console.log(`  Inserted: ${aircraft.registration}`);
      }

      this.result.byType[aircraft.aircraftType]++;
    } catch (error) {
      logger.error(
        `Failed to seed ${aircraft.registration}:`,
        error instanceof Error ? error.message : error
      );
      this.result.errors++;
      console.log(`  Error: ${aircraft.registration}`);
    }
  }

  private async insertAircraft(
    aircraft: AircraftData,
    aircraftTypeId: number | null
  ): Promise<void> {
    const seatConfig = aircraft.seatConfig
      ? JSON.stringify(aircraft.seatConfig)
      : null;

    const query = `
      INSERT INTO aircraft (
        airline_id,
        aircraft_type_id,
        registration,
        aircraft_type,
        manufacturer,
        model,
        series,
        msn,
        status,
        delivery_date,
        seat_configuration,
        total_seats,
        livery_description,
        data_source,
        data_confidence
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `;

    await queryPostgres(query, [
      this.airlineId,
      aircraftTypeId,
      aircraft.registration,
      aircraft.aircraftType,
      aircraft.manufacturer,
      aircraft.model,
      aircraft.series,
      aircraft.msn || null,
      aircraft.status,
      aircraft.deliveryDate || null,
      seatConfig,
      aircraft.totalSeats || null,
      aircraft.livery || null,
      'Wikipedia/Public records - June 2025',
      0.85, // data confidence
    ]);
  }

  private async updateAircraft(
    aircraft: AircraftData,
    aircraftTypeId: number | null
  ): Promise<void> {
    const seatConfig = aircraft.seatConfig
      ? JSON.stringify(aircraft.seatConfig)
      : null;

    const query = `
      UPDATE aircraft
      SET
        airline_id = $1,
        aircraft_type_id = $2,
        aircraft_type = $3,
        manufacturer = $4,
        model = $5,
        series = $6,
        msn = COALESCE($7, msn),
        status = $8,
        delivery_date = COALESCE($9, delivery_date),
        seat_configuration = COALESCE($10, seat_configuration),
        total_seats = COALESCE($11, total_seats),
        livery_description = COALESCE($12, livery_description),
        data_source = $13,
        data_confidence = $14,
        updated_at = NOW()
      WHERE registration = $15
    `;

    await queryPostgres(query, [
      this.airlineId,
      aircraftTypeId,
      aircraft.aircraftType,
      aircraft.manufacturer,
      aircraft.model,
      aircraft.series,
      aircraft.msn || null,
      aircraft.status,
      aircraft.deliveryDate || null,
      seatConfig,
      aircraft.totalSeats || null,
      aircraft.livery || null,
      'Wikipedia/Public records - June 2025',
      0.85,
      aircraft.registration,
    ]);
  }

  private async updateFleetSize(dryRun?: boolean): Promise<void> {
    if (dryRun || !this.airlineId) return;

    const query = `
      UPDATE airlines
      SET
        fleet_size = (SELECT COUNT(*) FROM aircraft WHERE airline_id = $1 AND status = 'active'),
        updated_at = NOW()
      WHERE id = $1
    `;
    await queryPostgres(query, [this.airlineId]);
    console.log('\n  Updated Copa Airlines fleet size\n');
  }

  private printSummary(): void {
    console.log(
      '\n═══════════════════════════════════════════════════════════════════'
    );
    console.log('  COPA AIRLINES FLEET SEEDING SUMMARY');
    console.log(
      '═══════════════════════════════════════════════════════════════════\n'
    );

    console.log(`  Total Aircraft:     ${this.result.total}`);
    console.log(`  Inserted:           ${this.result.inserted}`);
    console.log(`  Updated:            ${this.result.updated}`);
    console.log(`  Errors:             ${this.result.errors}\n`);

    console.log('  By Aircraft Type:');
    const sortedTypes = Object.entries(this.result.byType).sort(
      (a, b) => b[1] - a[1]
    );

    for (const [type, count] of sortedTypes) {
      console.log(`    ${type.padEnd(25)} ${count}`);
    }

    console.log(
      '\n═══════════════════════════════════════════════════════════════════\n'
    );

    if (this.result.errors === 0) {
      console.log('  Copa Airlines fleet seeded successfully!\n');
    } else {
      console.log(
        `  Seeding completed with ${this.result.errors} error(s)\n`
      );
    }

    // Fleet summary
    console.log('  Fleet Summary:');
    console.log('  ─────────────────────────────────────────');
    console.log(`  Boeing 737-700:        ${boeing737_700Fleet.length} aircraft`);
    console.log(`  Boeing 737-800:        ${boeing737_800Fleet.length} aircraft`);
    console.log(`  Boeing 737-800BCF:     ${boeing737_800BCFFleet.length} freighter`);
    console.log(`  Boeing 737 MAX 8:      ${boeing737MAX8Fleet.length} aircraft`);
    console.log(`  Boeing 737 MAX 9:      ${boeing737MAX9Fleet.length} aircraft`);
    console.log('  ─────────────────────────────────────────');
    console.log(`  TOTAL:                 ${allCopaAircraft.length} aircraft\n`);

    // Pending orders note
    console.log('  Pending Orders (not seeded):');
    console.log('    Boeing 737 MAX 9:    23 aircraft');
    console.log('    Boeing 737 MAX 10:   15 aircraft');
    console.log('    Boeing 737-800BCF:   1 freighter\n');
  }
}

// CLI support
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const clean = args.includes('--clean');
  const dryRun = args.includes('--dry-run');

  const seeder = new CopaFleetSeeder();

  seeder
    .seed({ clean, dryRun })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

export { CopaFleetSeeder, allCopaAircraft };
