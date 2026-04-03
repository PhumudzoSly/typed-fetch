/**
 * Example: Express route handlers using typedFetch to call downstream APIs.
 *
 * During development, run `typed-fetch watch` in a separate terminal so types
 * are regenerated automatically each time you hit these endpoints:
 *
 *   npx typed-fetch watch
 */

import { Router, Request, Response } from "express";
import { typedFetch } from "@phumudzo/typed-fetch";

const router = Router();

// GET /users/:id — fetch a user from a downstream service
router.get("/users/:id", async (req: Request, res: Response) => {
  const result = await typedFetch(
    `https://api.example.com/users/${req.params.id}`,
    { method: "GET" },
    { endpointKey: "GET /users/:id" },
  );

  if (result.error) {
    // Network-level failure — downstream service unreachable
    res.status(502).json({ error: "Upstream service unavailable", detail: result.error.message });
    return;
  }

  if (!result.ok) {
    // HTTP error from the downstream service — forward the status
    res.status(result.status).json({ error: "Upstream error", status: result.status });
    return;
  }

  res.json(result.data);
});

// POST /orders — create an order via a downstream service
router.post("/orders", async (req: Request, res: Response) => {
  const result = await typedFetch(
    "https://api.example.com/orders",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    },
    { endpointKey: "POST /orders" },
  );

  if (result.error) {
    res.status(502).json({ error: "Upstream service unavailable", detail: result.error.message });
    return;
  }

  if (result.status === 422) {
    // Validation error from the downstream service
    res.status(422).json(result.data);
    return;
  }

  if (result.status === 201) {
    res.status(201).json(result.data);
    return;
  }

  res.status(result.status).json({ error: "Unexpected upstream status" });
});

// GET /products — list products with query params forwarded
router.get("/products", async (req: Request, res: Response) => {
  const query = new URLSearchParams(req.query as Record<string, string>).toString();
  const url = query
    ? `https://api.example.com/products?${query}`
    : "https://api.example.com/products";

  const result = await typedFetch(url, { method: "GET" }, { endpointKey: "GET /products" });

  if (result.error) {
    res.status(502).json({ error: "Upstream service unavailable", detail: result.error.message });
    return;
  }

  res.status(result.status).json(result.data);
});

export default router;
