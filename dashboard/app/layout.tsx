import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import { Plane, BarChart3, Database, AlertCircle } from 'lucide-react';
import './globals.css';
import { Providers } from './providers';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Aircraft Database Dashboard',
  description: 'Operations dashboard for the Aircraft Database MCP Server',
};

const navigation = [
  { name: 'Fleet Overview', href: '/', icon: BarChart3 },
  { name: 'Airlines', href: '/airlines', icon: Plane },
  { name: 'Scraping Status', href: '/scraping', icon: Database },
  { name: 'Data Quality', href: '/quality', icon: AlertCircle },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-gray-200">
              <div className="flex flex-col h-full">
                {/* Logo */}
                <div className="flex items-center h-16 px-6 border-b border-gray-200">
                  <Plane className="h-8 w-8 text-blue-600" />
                  <span className="ml-2 text-xl font-bold text-gray-900">
                    Aircraft DB
                  </span>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 py-6 space-y-1">
                  {navigation.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          'flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors',
                          'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        )}
                      >
                        <Icon className="h-5 w-5 mr-3" />
                        {item.name}
                      </Link>
                    );
                  })}
                </nav>

                {/* Footer */}
                <div className="px-4 py-4 border-t border-gray-200">
                  <div className="text-xs text-gray-500">
                    <div className="font-semibold">Version 1.0.0</div>
                    <div>Number Labs</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header */}
              <header className="bg-white border-b border-gray-200 px-8 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      Operations Dashboard
                    </h1>
                    <p className="text-sm text-gray-500">
                      Monitor and manage your fleet database
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-sm text-gray-500">
                      <span className="font-medium">API:</span>{' '}
                      {process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'}
                    </div>
                  </div>
                </div>
              </header>

              {/* Page Content */}
              <main className="flex-1 overflow-y-auto p-8">
                {children}
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
