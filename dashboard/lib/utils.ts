import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${seconds % 60}s`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'active':
    case 'completed':
    case 'healthy':
      return 'text-green-600 bg-green-50';
    case 'pending':
    case 'running':
      return 'text-blue-600 bg-blue-50';
    case 'stored':
    case 'maintenance':
      return 'text-yellow-600 bg-yellow-50';
    case 'failed':
    case 'unhealthy':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

export function getConfidenceColor(confidence: string): string {
  switch (confidence.toLowerCase()) {
    case 'high':
      return 'text-green-600 bg-green-50';
    case 'medium':
      return 'text-yellow-600 bg-yellow-50';
    case 'low':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}
