import { env } from "./env.js";

let phoneMap: Map<string, string>;

export function getPhoneMap(): Map<string, string> {
  if (!phoneMap) {
    try {
      const parsed = JSON.parse(env.phoneMap) as Record<string, string>;
      phoneMap = new Map(Object.entries(parsed));
    } catch (error) {
      console.error("Failed to parse PHONE_MAP env var:", error);
      phoneMap = new Map();
    }
  }
  return phoneMap;
}

export function getUserName(phoneNumber: string): string {
  const map = getPhoneMap();
  return map.get(phoneNumber) || phoneNumber;
}
