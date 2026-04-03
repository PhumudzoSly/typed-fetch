import {
  flushObservations,
  generateTypes,
  typedFetch,
  type EndpointKey,
} from '@phumudzo/typed-fetch';

const configPath = 'typed-fetch.config.json';

const seeds: Array<{
  key: EndpointKey;
  url: string;
}> = [
  { key: 'GET /posts/:id', url: 'https://jsonplaceholder.typicode.com/posts/1' },
  { key: 'GET /users/:id', url: 'https://jsonplaceholder.typicode.com/users/1' },
  { key: 'GET /todos/:id', url: 'https://jsonplaceholder.typicode.com/todos/1' },
];

async function run() {
  for (const seed of seeds) {
    await typedFetch(seed.url, { method: 'GET' }, { endpointKey: seed.key, configPath });
  }

  flushObservations();
  const result = generateTypes({}, { configPath });
  console.log(`[typed-fetch] generated ${result.outputPath}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
