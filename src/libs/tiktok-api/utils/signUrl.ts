import signBogus from "./xbogus.ts";
import signGnarly from "./xgnarly.ts";

type SignUrlParams = {
  url: string;
  params: Record<string, any>;
  body?: Record<string, any> | string;
  userAgent: string;
};

export function signUrl(data: SignUrlParams): string {
  const queryString = new URLSearchParams(data.params).toString();

  const body = data.body
    ? typeof data.body === "string"
      ? data.body
      : JSON.stringify(data.body)
    : "";

  const timestamp = Math.floor(Date.now() / 1000);

  const xBogus = signBogus(queryString, body, data.userAgent, timestamp);

  const xGnarly = signGnarly(queryString, body, data.userAgent, 0, "5.1.1");

  return `${data.url}?${queryString}&X-Bogus=${xBogus}&X-Gnarly=${xGnarly}`;
}
