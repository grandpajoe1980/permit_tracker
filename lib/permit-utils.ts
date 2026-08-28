import {
  DEMO_PASSWORD,
  demoAccounts,
  permits,
  type Agency,
  type DemoAccount,
  type PermitRecord,
} from "./demo-data";

export function authenticateDemoAccount(
  username: string,
  password: string,
  agencyId: Agency["id"] | null,
): DemoAccount | null {
  if (!agencyId || password !== DEMO_PASSWORD) return null;

  const normalizedUsername = username.trim().toLowerCase();
  return (
    demoAccounts.find(
      (account) =>
        account.username === normalizedUsername && account.agencyId === agencyId,
    ) ?? null
  );
}

export function permitProgress(permit: Pick<PermitRecord, "currentDay" | "totalDays">) {
  if (permit.totalDays <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round((permit.currentDay / permit.totalDays) * 100)),
  );
}

export function getPermitsForAccount(account: DemoAccount | null): PermitRecord[] {
  if (!account) return [];
  return account.applicationIds
    .map((applicationId) => permits[applicationId])
    .filter((permit): permit is PermitRecord => Boolean(permit));
}

export function getPermitForAccount(
  account: DemoAccount | null,
  permitId: string,
): PermitRecord | null {
  if (!account?.applicationIds.includes(permitId)) return null;
  return permits[permitId] ?? null;
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}
