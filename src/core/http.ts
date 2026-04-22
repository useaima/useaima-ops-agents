export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseText: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new HttpError(`Request failed for ${url}`, response.status, await response.text());
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function fetchText(url: string, init: RequestInit = {}): Promise<string> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new HttpError(`Request failed for ${url}`, response.status, await response.text());
  }
  return response.text();
}
