export function parseUrl(rawUrl) {
  const empty = {
    fullUrl: rawUrl || '',
    domain: '',
    directory: '',
    file: '',
    params: '',
    valid: false
  };

  if (!rawUrl || typeof rawUrl !== 'string') {
    return empty;
  }

  let urlStr = rawUrl.trim();

  if (!/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(urlStr)) {
    urlStr = 'http://' + urlStr;
  }

  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    return empty;
  }

  const domain = parsed.hostname || '';
  const pathname = parsed.pathname || '/';
  const params = parsed.search ? parsed.search.slice(1) : '';

  const { directory, file } = splitPathname(pathname);

  return {
    fullUrl: rawUrl.trim(),
    domain,
    directory,
    file,
    params,
    valid: true
  };
}

function splitPathname(pathname) {
  if (!pathname || pathname === '/') {
    return { directory: '', file: '' };
  }

  if (pathname.endsWith('/')) {
    return {
      directory: pathname.slice(0, -1),
      file: ''
    };
  }

  const lastSlash = pathname.lastIndexOf('/');
  if (lastSlash <= 0) {
    return {
      directory: '',
      file: pathname.slice(1)
    };
  }

  return {
    directory: pathname.slice(0, lastSlash),
    file: pathname.slice(lastSlash + 1)
  };
}
