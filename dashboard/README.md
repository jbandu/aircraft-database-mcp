# Aircraft Database Operations Dashboard

A modern, real-time operations dashboard built with Next.js 14, TypeScript, and Shadcn/ui for monitoring and managing the Aircraft Database MCP Server.

## Features

### 1. Fleet Overview
- **Global Statistics**: Total airlines, aircraft, types, and active aircraft counts
- **Interactive Charts**:
  - Top 10 aircraft types (bar chart)
  - Fleet status distribution (pie chart)
  - Top 10 countries by fleet size (horizontal bar chart)
- **Detailed Tables**: Complete aircraft type breakdown with percentages
- **System Health**: Real-time system status and database connectivity

### 2. Airlines Management
- **Search & Filter**: Quick search across airline names, codes, and countries
- **Airline Selection**: Interactive list with confidence badges
- **Detailed Views**:
  - Overview tab: Key airline information and statistics
  - Fleet tab: Complete aircraft list with registration details
  - Stats tab: Fleet composition charts and type breakdown
- **Fleet Metrics**: Total aircraft, average age, active count, aircraft types
- **Fleet Composition**: Visual pie chart of aircraft by type

### 3. Scraping Status (Real-time)
- **Live Updates**: Auto-refresh every 5 seconds
- **Job Queue Statistics**: Total, pending, running, completed, and failed jobs
- **Create Jobs**: Trigger new scraping jobs with priority levels
- **Queue Visualization**: Progress bars showing job state distribution
- **Performance Metrics**: Success rate, failure rate, queue utilization
- **System Information**: Current scraping configuration and limits

### 4. Data Quality
- **Overall Quality Score**: Composite score (0-100) based on confidence and freshness
- **Confidence Distribution**: High/Medium/Low confidence breakdown
- **Data Freshness**: Recent (7 days), stale (30+ days), never scraped
- **Completeness Metrics**: Coverage of hub airports, websites, scraping data
- **Manual Review Queue**: Airlines needing attention with issue identification
- **Quality Guidelines**: Standards for data confidence levels

## Tech Stack

- **Frontend**: Next.js 14 with App Router
- **Language**: TypeScript 5.3
- **UI Components**: Shadcn/ui (Radix UI + Tailwind CSS)
- **Data Fetching**: TanStack Query (React Query)
- **Charts**: Recharts
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

## Prerequisites

- Node.js 20.0.0 or higher
- npm 10.0.0 or higher
- Running Aircraft Database REST API (see main project)

## Installation

### 1. Install Dependencies

```bash
cd dashboard
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
NEXT_PUBLIC_API_KEY=your-api-key-here
```

**Important**: Replace `your-api-key-here` with a valid API key from your REST API configuration.

### 3. Run Development Server

```bash
npm run dev
```

The dashboard will be available at `http://localhost:3001` (or next available port).

### 4. Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
dashboard/
├── app/                        # Next.js App Router pages
│   ├── layout.tsx             # Root layout with navigation
│   ├── page.tsx               # Fleet Overview page
│   ├── airlines/
│   │   └── page.tsx           # Airlines page
│   ├── scraping/
│   │   └── page.tsx           # Scraping Status page
│   ├── quality/
│   │   └── page.tsx           # Data Quality page
│   ├── globals.css            # Global styles
│   └── providers.tsx          # React Query provider
├── components/
│   └── ui/                    # Shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── badge.tsx
│       ├── tabs.tsx
│       ├── input.tsx
│       └── skeleton.tsx
├── lib/
│   ├── api-client.ts          # REST API client
│   └── utils.ts               # Utility functions
├── public/                    # Static assets
├── next.config.js             # Next.js configuration
├── tailwind.config.ts         # Tailwind configuration
├── tsconfig.json              # TypeScript configuration
└── package.json
```

## API Integration

The dashboard connects to the Aircraft Database REST API. Ensure the API server is running:

```bash
# In the main project directory
npm run dev:api
```

The API client is configured in `lib/api-client.ts` and includes:
- Automatic authentication with API key
- TypeScript types for all endpoints
- Error handling and retry logic
- Query caching via TanStack Query

## Features in Detail

### Real-time Updates

The dashboard implements real-time updates using **polling**:
- Scraping Status page auto-refreshes every 5 seconds
- System health checks run every 30 seconds
- Manual refresh buttons available on all pages

### Responsive Design

The dashboard is fully responsive:
- **Desktop**: Multi-column layouts with detailed charts
- **Tablet**: Adjusted grid layouts
- **Mobile**: Single-column, scrollable views

### Performance Optimizations

- **React Query Caching**: 1-minute stale time for most queries
- **Lazy Loading**: Code splitting for each page
- **Skeleton Loaders**: Immediate feedback during data loading
- **Optimized Charts**: Recharts with responsive containers

## Customization

### Changing Colors

Edit `app/globals.css` to customize the color scheme:

```css
:root {
  --primary: 221.2 83.2% 53.3%;
  --secondary: 210 40% 96.1%;
  /* ... more colors */
}
```

### Adding New Pages

1. Create a new directory in `app/`
2. Add a `page.tsx` file
3. Update navigation in `app/layout.tsx`

Example:

```typescript
// app/reports/page.tsx
export default function ReportsPage() {
  return <div>Reports Page</div>;
}
```

### Custom API Endpoints

Add new endpoints to `lib/api-client.ts`:

```typescript
async getCustomData() {
  return this.request<CustomType>('/api/v1/custom');
}
```

## Troubleshooting

### API Connection Issues

**Problem**: Dashboard shows "Error loading data"

**Solution**:
1. Verify REST API is running: `curl http://localhost:3000/health`
2. Check API key in `.env.local`
3. Verify `NEXT_PUBLIC_API_BASE_URL` matches your API server

### Port Already in Use

**Problem**: Port 3000 is already in use

**Solution**:
```bash
# Change the default port
PORT=3001 npm run dev
```

### CORS Errors

**Problem**: Browser console shows CORS errors

**Solution**: Add dashboard URL to API's `CORS_ORIGINS` environment variable:
```bash
# In main project .env
CORS_ORIGINS=http://localhost:3001
```

### Build Errors

**Problem**: TypeScript errors during build

**Solution**:
```bash
# Check types without building
npm run type-check

# Clean and reinstall
rm -rf .next node_modules
npm install
npm run build
```

## Development

### Code Formatting

```bash
npm run lint
```

### Type Checking

```bash
npm run type-check
```

### Hot Reload

The development server supports hot reload. Changes to files will automatically refresh the browser.

## Deployment

### Vercel (Recommended)

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
vercel --prod
```

3. Set environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_API_BASE_URL`
   - `NEXT_PUBLIC_API_KEY`

### Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

### Environment Variables for Production

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
NEXT_PUBLIC_API_KEY=prod-api-key-here
NODE_ENV=production
```

## Security Considerations

### API Key Protection

- API keys are included in client-side JavaScript (use `NEXT_PUBLIC_` prefix)
- For production, implement server-side API proxy to hide keys
- Rotate API keys regularly
- Use different keys for development and production

### CORS Configuration

- Whitelist specific domains in production
- Never use `*` (allow all origins) in production
- Configure in the REST API's `CORS_ORIGINS` environment variable

### Rate Limiting

- The REST API implements rate limiting
- Dashboard respects rate limits with appropriate retry logic
- Consider implementing client-side rate limiting for heavy operations

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile browsers: iOS Safari 14+, Chrome Android latest

## Performance

- **Initial Load**: < 2 seconds (with warm cache)
- **Page Transitions**: < 100ms
- **Chart Rendering**: < 500ms
- **API Response Time**: < 200ms (depends on REST API)

## Contributing

When adding new features:

1. Follow existing code structure
2. Use TypeScript for type safety
3. Add proper error handling
4. Include loading states with skeletons
5. Maintain responsive design
6. Update this README

## License

MIT License - see main project LICENSE file

## Support

- **Issues**: Report bugs in the main project repository
- **Documentation**: See main project README and docs/
- **API Documentation**: Available at REST API `/api-docs` endpoint

---

Built with ❤️ by Number Labs
