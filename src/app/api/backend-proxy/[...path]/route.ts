const BACKEND_API_URL =
  process.env.BACKEND_API_URL?.trim() ||
  process.env.NEXT_PUBLIC_BACKEND_API_URL?.trim() ||
  'https://fluxion-logistic-backend.onrender.com';

function buildTargetUrl(requestUrl: string, pathSegments: string[]) {
  const incomingUrl = new URL(requestUrl);
  const cleanBase = BACKEND_API_URL.replace(/\/$/, '');
  const joinedPath = pathSegments.join('/');
  return `${cleanBase}/${joinedPath}${incomingUrl.search}`;
}

async function proxy(request: Request, pathSegments: string[]) {
  const targetUrl = buildTargetUrl(request.url, pathSegments);
  const method = request.method.toUpperCase();

  const headers = new Headers();
  const passthroughHeaders = ['authorization', 'content-type', 'accept', 'x-tenant-admin-key'];

  for (const headerName of passthroughHeaders) {
    const value = request.headers.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }

  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.text();

  const upstream = await fetch(targetUrl, {
    method,
    headers,
    body,
    cache: 'no-store',
  });

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) {
    responseHeaders.set('content-type', contentType);
  }

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: Context) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(request: Request, context: Context) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PUT(request: Request, context: Context) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PATCH(request: Request, context: Context) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function DELETE(request: Request, context: Context) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
