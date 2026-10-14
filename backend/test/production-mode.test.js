// Run with: npm test   (Node's built-in test runner, no extra dependencies, no network, no database)
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  isProduction, parseOrigins, validateFrontendOrigins, isOriginAllowed, corsOrigin, exposeDevOtp,
} from "../config/env.js";

const FRONT = "https://physiocare-web.vercel.app";

describe("isProduction", () => {
  test("NODE_ENV=production", () => assert.equal(isProduction({ NODE_ENV: "production" }), true));
  test("tolerates case and whitespace", () => {
    assert.equal(isProduction({ NODE_ENV: " Production " }), true);
    assert.equal(isProduction({ NODE_ENV: "PRODUCTION" }), true);
  });
  test("RENDER=true alone is production (NODE_ENV missing or wrong)", () => {
    assert.equal(isProduction({ RENDER: "true" }), true);
    assert.equal(isProduction({ RENDER: "true", NODE_ENV: "development" }), true);
    assert.equal(isProduction({ RENDER: "TRUE" }), true);
  });
  test("local development is not production", () => {
    assert.equal(isProduction({}), false);
    assert.equal(isProduction({ NODE_ENV: "development" }), false);
    assert.equal(isProduction({ NODE_ENV: "test", RENDER: "false" }), false);
  });
});

describe("FRONTEND_URL parsing", () => {
  test("splits, trims and strips trailing slashes", () => {
    assert.deepEqual(parseOrigins(` ${FRONT}/ , https://b.example.com `), [FRONT, "https://b.example.com"]);
  });
  test("reports entries that can never match a browser Origin", () => {
    const { valid, invalid } = validateFrontendOrigins({
      FRONTEND_URL: `${FRONT},*,example.com,https://x.com/app`,
    });
    assert.deepEqual(valid, [FRONT]);
    assert.deepEqual(invalid, ["*", "example.com", "https://x.com/app"]);
  });
  test("empty FRONTEND_URL has no valid origins", () => {
    assert.deepEqual(validateFrontendOrigins({}).valid, []);
  });
});

describe("CORS in production", () => {
  const prod = { NODE_ENV: "production", FRONTEND_URL: FRONT };
  const onRender = { RENDER: "true", FRONTEND_URL: FRONT }; // NODE_ENV forgotten

  for (const [label, env] of [["NODE_ENV=production", prod], ["RENDER=true only", onRender]]) {
    test(`${label}: allows the configured frontend`, () => assert.equal(isOriginAllowed(FRONT, env), true));
    test(`${label}: allows requests without an Origin header`, () => assert.equal(isOriginAllowed(undefined, env), true));
    test(`${label}: rejects arbitrary localhost ports`, () => {
      for (const o of ["http://localhost:5199", "http://127.0.0.1:5199", "http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"]) {
        assert.equal(isOriginAllowed(o, env), false, o);
      }
    });
    test(`${label}: rejects untrusted origins`, () => {
      for (const o of ["https://evil.example.com", "http://physiocare-web.vercel.app", `${FRONT}.evil.com`, "https://sub.physiocare-web.vercel.app", "null"]) {
        assert.equal(isOriginAllowed(o, env), false, o);
      }
    });
  }

  test("several configured frontends are all allowed", () => {
    const env = { NODE_ENV: "production", FRONTEND_URL: `${FRONT}, https://admin.example.com/` };
    assert.equal(isOriginAllowed("https://admin.example.com", env), true);
    assert.equal(isOriginAllowed(FRONT, env), true);
  });
  test("FRONTEND_URL missing in production: no browser origin is allowed (fail closed)", () => {
    const env = { NODE_ENV: "production" };
    assert.equal(isOriginAllowed(FRONT, env), false);
    assert.equal(isOriginAllowed("http://localhost:5173", env), false);
  });
  test("a wildcard FRONTEND_URL is ignored, not honoured", () => {
    assert.equal(isOriginAllowed("https://evil.example.com", { NODE_ENV: "production", FRONTEND_URL: "*" }), false);
  });
  test("corsOrigin() callback returns the decision", () => {
    const check = corsOrigin(prod);
    let result;
    check("https://evil.example.com", (err, ok) => { result = [err, ok]; });
    assert.deepEqual(result, [null, false]);
    check(FRONT, (err, ok) => { result = [err, ok]; });
    assert.deepEqual(result, [null, true]);
  });
});

describe("CORS in development", () => {
  const dev = { NODE_ENV: "development", FRONTEND_URL: FRONT };
  test("allows the Vite default and other localhost ports", () => {
    for (const o of ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://localhost:5199"]) {
      assert.equal(isOriginAllowed(o, dev), true, o);
    }
  });
  test("still allows the configured frontend and rejects untrusted origins", () => {
    assert.equal(isOriginAllowed(FRONT, dev), true);
    assert.equal(isOriginAllowed("https://evil.example.com", dev), false);
    assert.equal(isOriginAllowed("https://localhost:5173.evil.com", dev), false);
    assert.equal(isOriginAllowed("http://localhost.evil.com:5173", dev), false);
  });
});

describe("development-only OTP in API responses", () => {
  test("returned in development", () => assert.equal(exposeDevOtp("123456", { NODE_ENV: "development" }), "123456"));
  test("returned when nothing is set (local laptop)", () => assert.equal(exposeDevOtp("123456", {}), "123456"));
  test("never returned with NODE_ENV=production", () => assert.equal(exposeDevOtp("123456", { NODE_ENV: "production" }), undefined));
  test("never returned on Render even if NODE_ENV is wrong", () => {
    assert.equal(exposeDevOtp("123456", { RENDER: "true" }), undefined);
    assert.equal(exposeDevOtp("123456", { RENDER: "true", NODE_ENV: "development" }), undefined);
  });
});

describe("email service never leaks an OTP in production", () => {
  const SNAPSHOT = { ...process.env };
  let logged;
  let realLog;
  let realFetch;

  const setEnv = (patch) => {
    for (const k of ["NODE_ENV", "RENDER", "EMAILJS_SERVICE_ID", "EMAILJS_TEMPLATE_ID", "EMAILJS_PUBLIC_KEY", "EMAILJS_PRIVATE_KEY"]) delete process.env[k];
    Object.assign(process.env, patch);
  };
  const CONFIGURED = {
    EMAILJS_SERVICE_ID: "svc", EMAILJS_TEMPLATE_ID: "tpl", EMAILJS_PUBLIC_KEY: "pub", EMAILJS_PRIVATE_KEY: "priv",
  };

  beforeEach(() => {
    logged = [];
    realLog = console.log;
    realFetch = globalThis.fetch;
    console.log = (...a) => logged.push(a.join(" "));
    globalThis.fetch = async () => { throw new Error("network must not be used in tests"); };
  });
  afterEach(() => {
    console.log = realLog;
    globalThis.fetch = realFetch;
    for (const k of Object.keys(process.env)) if (!(k in SNAPSHOT)) delete process.env[k];
    Object.assign(process.env, SNAPSHOT);
  });

  const load = async () => (await import("../config/emailService.js"));

  test("production + EmailJS not configured: throws, prints nothing", async () => {
    setEnv({ NODE_ENV: "production" });
    const { sendOtpEmail } = await load();
    await assert.rejects(() => sendOtpEmail("a@example.com", "A", "424242"));
    assert.equal(logged.join("\n").includes("424242"), false);
  });

  test("Render without NODE_ENV + not configured: throws, prints nothing", async () => {
    setEnv({ RENDER: "true" });
    const { sendOtpEmail } = await load();
    await assert.rejects(() => sendOtpEmail("a@example.com", "A", "424242"));
    assert.equal(logged.join("\n").includes("424242"), false);
  });

  test("production + EmailJS call fails: throws, never prints the OTP", async () => {
    setEnv({ NODE_ENV: "production", ...CONFIGURED });
    globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => "boom" });
    const { sendOtpEmail } = await load();
    await assert.rejects(() => sendOtpEmail("a@example.com", "A", "424242"));
    assert.equal(logged.join("\n").includes("424242"), false);
  });

  test("production + EmailJS succeeds: resolves true, OTP not logged, mocked request used", async () => {
    setEnv({ NODE_ENV: "production", ...CONFIGURED });
    let body;
    globalThis.fetch = async (_url, init) => { body = JSON.parse(init.body); return { ok: true, status: 200 }; };
    const { sendOtpEmail } = await load();
    assert.equal(await sendOtpEmail("a@example.com", "A", "424242"), true);
    assert.equal(body.template_params.otp, "424242");
    assert.equal(body.template_params.to_email, "a@example.com");
    assert.equal(logged.join("\n").includes("424242"), false);
  });

  test("development + not configured: prints the OTP to the terminal (existing behaviour)", async () => {
    setEnv({ NODE_ENV: "development" });
    const { sendOtpEmail } = await load();
    assert.equal(await sendOtpEmail("a@example.com", "A", "424242"), true);
    assert.equal(logged.join("\n").includes("424242"), true);
  });

  test("development + EmailJS call fails: falls back to the terminal", async () => {
    setEnv({ NODE_ENV: "development", ...CONFIGURED });
    globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => "boom" });
    const { sendOtpEmail } = await load();
    assert.equal(await sendOtpEmail("a@example.com", "A", "424242"), true);
    assert.equal(logged.join("\n").includes("424242"), true);
  });
});
