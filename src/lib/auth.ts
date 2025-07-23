import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware to verify API authentication token
 * @param request The incoming request
 * @returns NextResponse or null if authentication passes
 */
export function verifyApiAuth(request: NextRequest): NextResponse | null {
  // Get the API token from environment variable
  const apiToken = process.env.AUTH_TOKEN;
  // console.log("apiToken", apiToken);
  
  if (!apiToken) {
    console.error('AUTH_TOKEN environment variable not configured');
    
    return NextResponse.json(
      { error: 'API authentication not configured' },
      { status: 500 }
    );
    
  }
  
  // Check Authorization header
  const authHeader = request.headers.get('Authorization');
  
  // Check for Authorization header in format "Bearer TOKEN"
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }
  
  // Extract the token
  const token = authHeader.substring(7);
  // console.log("token", token );
  
  // Verify the token
  if (token !== apiToken) {
    console.log("Token mismatch");
    return NextResponse.json(
      { error: 'Invalid authentication token' },
      { status: 403 }
    );
  }
  
  console.log("Authentication successful");
  // Authentication successful
  return null;
} 