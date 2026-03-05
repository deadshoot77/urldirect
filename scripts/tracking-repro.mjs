#!/usr/bin/env node

const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const slug = (process.env.SLUG || "promo").replace(/^\/+/, "");
const targetUrl = `${baseUrl}/${slug}`;

const browserUa =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
const tiktokUa =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 TikTok 37.1.0";

function logHeader(title) {
  console.log(`\n=== ${title} ===`);
}

function toAbsolute(url) {
  try {
    return new URL(url).toString();
  } catch {
    return new URL(url, baseUrl).toString();
  }
}

async function runRequest(label, url, init = {}) {
  const response = await fetch(url, {
    redirect: "manual",
    ...init
  });
  const location = response.headers.get("location");
  console.log(`${label}: ${response.status}${location ? ` -> ${location}` : ""}`);
  return response;
}

async function main() {
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Slug URL: ${targetUrl}`);

  logHeader("HEAD (ne doit pas compter redirect)");
  await runRequest("HEAD", targetUrl, {
    method: "HEAD",
    headers: {
      "user-agent": browserUa
    }
  });

  logHeader("Prefetch (doit etre category=prefetch)");
  await runRequest("GET prefetch", targetUrl, {
    headers: {
      "user-agent": browserUa,
      purpose: "prefetch",
      "sec-purpose": "prefetch"
    }
  });

  logHeader("Bot UA (Discordbot)");
  await runRequest("GET bot", targetUrl, {
    headers: {
      "user-agent": "Discordbot/2.0"
    }
  });

  logHeader("TikTok in-app landing + continue");
  const landingResponse = await runRequest("GET tiktok landing", targetUrl, {
    headers: {
      "user-agent": tiktokUa,
      referer: "https://www.tiktok.com/"
    }
  });
  const landingHtml = await landingResponse.text();
  const continueMatch = landingHtml.match(/href="([^"]*rb_continue=1[^"]*)"/i);

  if (!continueMatch) {
    console.log("Continue URL non trouvee dans la landing. Verifier que landing_mode est ON.");
    return;
  }

  const continueUrl = toAbsolute(continueMatch[1]);
  console.log(`Continue URL: ${continueUrl}`);

  await runRequest("GET continue #1", continueUrl, {
    headers: {
      "user-agent": tiktokUa,
      referer: "https://www.tiktok.com/"
    }
  });

  await runRequest("GET continue #2 (doublon attendu dedup)", continueUrl, {
    headers: {
      "user-agent": tiktokUa,
      referer: "https://www.tiktok.com/"
    }
  });

  console.log("\nTermine. Verifier ensuite la DB avec les requetes SQL de diagnostic.");
}

main().catch((error) => {
  console.error("Erreur script repro:", error);
  process.exit(1);
});

