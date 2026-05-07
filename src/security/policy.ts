export interface SessionPolicy {
  clientOrigin: string;
  allowedOrigins: string[];
  capabilities?: string[];
}

export function assertCapability(method: string, policy: SessionPolicy): void {
  if (!policy.capabilities?.length) return;
  if (!policy.capabilities.includes(method)) {
    throw new Error(`Capability is not allowed for this session: ${method}`);
  }
}

export function assertAllowedUrl(url: string, policy: SessionPolicy): void {
  const parsed = new URL(url);
  if (parsed.protocol === 'about:' || parsed.protocol === 'data:') return;
  if (!policy.allowedOrigins.length) return;
  if (!policy.allowedOrigins.includes(parsed.origin)) {
    throw new Error(`Origin is not allowed for this session: ${parsed.origin}`);
  }
}
