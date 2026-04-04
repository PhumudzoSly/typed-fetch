/**
 * Manual endpoint type declarations.
 * These take priority over auto-generated types from TypedFetchGeneratedResponses.
 *
 * Run `pnpm typegen` to seed from live traffic, then delete entries here
 * once they appear in src/generated/typed-fetch.d.ts.
 */
declare module "@phumudzo/typed-fetch" {
  interface TypedFetchUserEndpoints {
    "GET /posts": {
      200: Array<{ userId: number; id: number; title: string; body: string }>;
    };
    "GET /posts/:id": {
      200: { userId: number; id: number; title: string; body: string };
      404: null;
    };
    "GET /users/:id": {
      200: {
        id: number;
        name: string;
        username: string;
        email: string;
        address: {
          street: string;
          city: string;
          zipcode: string;
        };
        phone: string;
        website: string;
        company: {
          name: string;
          catchPhrase: string;
        };
      };
      404: null;
    };
    "POST /posts": {
      201: { id: number; title: string; body: string; userId: number };
    };
  }
}

export {};
