import { typedFetch } from "@phumudzo/typed-fetch";

const endpointKey = "GET /posts/:id";
const url = "https://jsonplaceholder.typicode.com/posts/1";

async function main() {
  const result = await typedFetch(url, { method: "GET" }, { endpointKey });

  if (result.error) {
    console.error(`[typed-fetch-test] Network error: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 200) {
    console.error(`[typed-fetch-test] Expected status 200, received ${result.status}`);
    process.exit(1);
  }

  if (!result.data || typeof result.data !== "object") {
    console.error("[typed-fetch-test] Expected JSON object response data");
    process.exit(1);
  }

  const data = result.data;

  if (!("id" in data) || !("title" in data)) {
    console.error("[typed-fetch-test] Response is missing expected fields: id/title");
    process.exit(1);
  }

  console.log("[typed-fetch-test] OK: package works and returned expected shape");
}

main().catch((error) => {
  console.error("[typed-fetch-test] Unexpected failure", error);
  process.exit(1);
});
