import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch('https://api.jdoodle.com/v1/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: process.env.JDOODLE_CLIENT_ID, // Server-side env var - no NEXT_PUBLIC_ needed!
        clientSecret: process.env.JDOODLE_CLIENT_SECRET,
        script: body.script,
        language: body.language,
        versionIndex: body.versionIndex,
        stdin: body.stdin || ''
      }),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to execute code' },
      { status: 500 }
    );
  }
}