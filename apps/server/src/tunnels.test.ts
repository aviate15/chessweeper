import { describe, expect, it } from "vitest";
import { TUNNELS, pickTunnels, tunnelChoice, type TunnelContext } from "./tunnels";

const ctx: TunnelContext = { port: 8080, sshDir: "/tmp/cw-ssh", ngrokDomain: null };
const byId = (id: string) => {
  const t = TUNNELS.find((x) => x.id === id);
  if (t === undefined) throw new Error(id);
  return t;
};

describe("tunnel output parsing", () => {
  it("finds the cloudflared URL in its banner", () => {
    const text = "|  https://metropolitan-alone-acm-dance.trycloudflare.com  |";
    expect(byId("cloudflared").findUrl(text)).toBe(
      "https://metropolitan-alone-acm-dance.trycloudflare.com",
    );
    expect(byId("cloudflared").findUrl("https://example.com")).toBeNull();
  });

  it("finds the pinggy tunnel URL, not the dashboard or docs links printed before it", () => {
    const text = [
      "Warning: Permanently added '[free.pinggy.io]:443' (RSA) to the list of known hosts.",
      "See https://openssh.com/pq.html",
      "Your tunnel will expire in 60 minutes. https://dashboard.pinggy.io",
      "https://kvgzp-103-210-49-131.free.pinggy.net",
      "https://rlwko-103-210-49-131.run.pinggy-free.link",
    ].join("\n");
    expect(byId("pinggy").findUrl(text)).toBe("https://kvgzp-103-210-49-131.free.pinggy.net");
    expect(
      byId("pinggy").findUrl("https://dashboard.pinggy.io\nhttps://pinggy.io/docs"),
    ).toBeNull();
    expect(byId("pinggy").findUrl("https://abc-1-2.run.pinggy-free.link/")).toBe(
      "https://abc-1-2.run.pinggy-free.link",
    );
  });

  it("finds the localhost.run tunnel URL, not its welcome-text links", () => {
    const text = [
      "To set up and manage custom domains go to https://admin.localhost.run/",
      "More details at https://localhost.run/docs/custom-domains",
      "https://f97b892d60e743.lhr.life",
      "https://localhost.run/docs/forever-free/",
    ].join("\n");
    expect(byId("localhost.run").findUrl(text)).toBe("https://f97b892d60e743.lhr.life");
    expect(byId("localhost.run").findUrl("https://admin.localhost.run/")).toBeNull();
  });

  it("finds the ngrok URL in logfmt output and ignores the local API address", () => {
    const text =
      'msg="started tunnel" obj=tunnels name=command_line addr=http://127.0.0.1:8080 url=https://my-name.ngrok-free.dev';
    expect(byId("ngrok").findUrl(text)).toBe("https://my-name.ngrok-free.dev");
    expect(byId("ngrok").findUrl("web interface on http://127.0.0.1:4040")).toBeNull();
  });
});

describe("tunnel commands", () => {
  it("forwards only to 127.0.0.1 on the chosen port", () => {
    for (const t of TUNNELS) {
      const joined = t.args(ctx).join(" ");
      expect(joined).toContain("127.0.0.1:8080");
      expect(joined).not.toMatch(/0\.0\.0\.0|localhost:/);
    }
  });

  it("SSH tunnels never prompt and use a private known_hosts", () => {
    for (const id of ["pinggy", "localhost.run"]) {
      const joined = byId(id).args(ctx).join(" ");
      expect(joined).toContain("BatchMode=yes");
      expect(joined).toContain("UserKnownHostsFile=/tmp/cw-ssh/known_hosts");
    }
  });

  it("uses a reserved ngrok domain when given", () => {
    expect(byId("ngrok").args({ ...ctx, ngrokDomain: "me.ngrok-free.dev" })).toContain(
      "--url=https://me.ngrok-free.dev",
    );
  });

  it("only cloudflared supplies CF-Connecting-IP", () => {
    expect(TUNNELS.filter((t) => t.cloudflareHeaders).map((t) => t.id)).toEqual(["cloudflared"]);
  });
});

describe("tunnel choice", () => {
  it("defaults to auto and accepts one provider", () => {
    expect(tunnelChoice([])).toBe("auto");
    expect(tunnelChoice(["--tunnel", "pinggy"])).toBe("pinggy");
    expect(tunnelChoice(["--tunnel=ngrok", "--verbose"])).toBe("ngrok");
    expect(pickTunnels("auto")).toHaveLength(4);
    expect(pickTunnels("pinggy")?.map((t) => t.id)).toEqual(["pinggy"]);
    expect(pickTunnels("nope")).toBeNull();
  });
});
