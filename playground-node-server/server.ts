import express from "express";
import { typedFetch } from "@phumudzo/typed-fetch";

const app = express();
const port = Number(process.env.PORT ?? 4010);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const getData = async () => {
  try {
    const result = await typedFetch(
      `https://jsonplaceholder.typicode.com/posts`,
      { method: "GET" },
      {
        endpointKey: "getPosts",
      },
    );

    if (result.status === 200) {
      const firstTodoId = result.data[0]?.id;
      const firstTodoTitle = result.data[0]?.title;
      console.log("First todo:", firstTodoId, firstTodoTitle);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching data:", message);
  }
};

app.listen(port, async () => {
  await getData();
  console.log(`playground server listening on http://localhost:${port}`);
});
