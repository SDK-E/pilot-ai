/**
 * Reads a JSON body. An empty or malformed body becomes `undefined` so the
 * caller's schema rejects it with its own message.
 */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
