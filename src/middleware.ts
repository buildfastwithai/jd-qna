import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyApiAuth } from '@/lib/auth';

// List of paths that don't require authentication
const publicPaths = [
  '/api/public', // Add any public API paths here
];

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  // Only check API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip authentication for public paths
  if (publicPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check authorization header directly here for debugging
  // const authHeader = request.headers.get('Authorization');
  // console.log("Auth Header:", authHeader);

  // Verify authentication
  const authResponse = verifyApiAuth(request);
  if (authResponse) {
    return authResponse; // Return error response
  }

  // Authentication passed, continue to the API route
  return NextResponse.next();
}

// Configure which paths this middleware applies to
export const config = {
  matcher: '/api/:path*',
}; 