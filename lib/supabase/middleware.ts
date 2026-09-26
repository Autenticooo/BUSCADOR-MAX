import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { supabaseEnv } from './env';

// Rotas de PÁGINA acessíveis sem sessão. Rotas de API não ficam aqui: elas
// saem mais cedo pelo short-circuit abaixo e nunca recebem redirect.
const PUBLIC_PREFIXES = ['/login', '/cadastro', '/auth'];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Renova o token da sessão nos cookies e aplica o controle de rotas:
 *  - /api/*      -> sempre liberado (sem redirect em nenhuma hipótese)
 *  - sem sessão  -> /login?next=...
 *  - com sessão  -> nunca fica em /login
 *  - /           -> /dashboard
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const { url, anonKey, configured } = supabaseEnv();

  if (!configured) {
    // projeto ainda não conectado: deixa as páginas renderizarem a tela de setup
    if (request.nextUrl.pathname === '/') {
      const target = request.nextUrl.clone();
      target.pathname = '/login';
      return NextResponse.redirect(target);
    }
    return supabaseResponse;
  }

  // APIs (webhook da Kiwify, health…) NUNCA recebem redirect de página:
  // quem chama é um servidor externo, não um navegador com sessão. Um 302
  // para /login (sem sessão) ou para /dashboard (com sessão) quebraria a
  // integração. A autenticação dessas rotas é própria (ex.: KIWIFY_WEBHOOK_TOKEN
  // validado dentro do route handler).
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  // IMPORTANTE: nada entre createServerClient() e getUser(),
  // senão a sessão pode ser derrubada de forma intermitente.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && !isPublic(pathname) && pathname !== '/') {
    const target = request.nextUrl.clone();
    target.pathname = '/login';
    target.search = '';
    if (pathname !== '/dashboard') {
      target.searchParams.set('next', `${pathname}${search}`);
    }
    return NextResponse.redirect(target);
  }

  if (user && (isPublic(pathname) || pathname === '/')) {
    const target = request.nextUrl.clone();
    target.pathname = '/dashboard';
    target.search = '';
    return NextResponse.redirect(target);
  }

  if (!user && pathname === '/') {
    const target = request.nextUrl.clone();
    target.pathname = '/login';
    target.search = '';
    return NextResponse.redirect(target);
  }

  return supabaseResponse;
}
