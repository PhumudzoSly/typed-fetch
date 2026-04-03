/**
 * Example: Next.js 14+ App Router server component using typedFetch.
 *
 * After running this page for the first time, run:
 *   npx typed-fetch generate
 *
 * Once generated, `result.data` will be fully typed based on the real
 * API response shape.
 */

import { typedFetch } from "@phumudzo/typed-fetch";

type UserPageProps = {
  params: { id: string };
};

export default async function UserPage({ params }: UserPageProps) {
  const result = await typedFetch(
    `https://api.example.com/users/${params.id}`,
    { method: "GET" },
    { endpointKey: "GET /users/:id" },
  );

  // Network failure: DNS error, timeout, connection refused, etc.
  // result.error is an Error instance; result.status === 0.
  if (result.error) {
    return (
      <div>
        <h1>Network Error</h1>
        <p>{result.error.message}</p>
      </div>
    );
  }

  // After `typed-fetch generate`, TypeScript narrows result.data here
  // to the exact shape observed from the 200 response.
  if (result.status === 200) {
    const user = result.data;
    return (
      <div>
        <h1>User Profile</h1>
        <pre>{JSON.stringify(user, null, 2)}</pre>
      </div>
    );
  }

  if (result.status === 404) {
    return <div>User not found.</div>;
  }

  return <div>Unexpected status: {result.status}</div>;
}
