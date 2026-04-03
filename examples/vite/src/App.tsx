import { useMemo, useState } from 'react';
import { typedFetch, type EndpointKey } from '@phumudzo/typed-fetch';
import './App.css';

type Scenario = {
  label: string;
  endpointKey: EndpointKey;
  url: string;
};

const scenarios: Scenario[] = [
  {
    label: 'Post 1',
    endpointKey: 'GET /posts/:id',
    url: 'https://jsonplaceholder.typicode.com/posts/1',
  },
  {
    label: 'User 1',
    endpointKey: 'GET /users/:id',
    url: 'https://jsonplaceholder.typicode.com/users/1',
  },
  {
    label: 'Todo 1',
    endpointKey: 'GET /todos/:id',
    url: 'https://jsonplaceholder.typicode.com/todos/1',
  },
];

type RequestState =
  | { kind: 'idle' }
  | { kind: 'loading'; scenario: Scenario }
  | {
      kind: 'done';
      scenario: Scenario;
      status: number;
      ok: boolean;
      summary: string;
      payload: unknown;
    }
  | { kind: 'error'; scenario: Scenario; message: string };

function pickRandomScenario() {
  return scenarios[Math.floor(Math.random() * scenarios.length)];
}

function App() {
  const [state, setState] = useState<RequestState>({ kind: 'idle' });

  const hint = useMemo(() => {
    return [
      'Run `pnpm typegen` once to seed generated declarations.',
      'Then hover result.data inside status-specific branches in this file.',
      'Try changing endpoint keys to see type behavior update after regeneration.',
    ];
  }, []);

  async function runRandomRequest() {
    const scenario = pickRandomScenario();
    setState({ kind: 'loading', scenario });

    try {
      if (scenario.endpointKey === 'GET /posts/:id') {
        const result = await typedFetch(scenario.url, { method: 'GET' }, { endpointKey: 'GET /posts/:id' });

        if (result.status === 200) {
          void result.data.title;
        }

        setState({
          kind: 'done',
          scenario,
          status: result.status,
          ok: result.ok,
          summary: `${scenario.endpointKey} -> ${result.status}`,
          payload: result.data,
        });
        return;
      }

      if (scenario.endpointKey === 'GET /users/:id') {
        const result = await typedFetch(scenario.url, { method: 'GET' }, { endpointKey: 'GET /users/:id' });

        if (result.status === 200) {
          void result.data.email;
        }

        setState({
          kind: 'done',
          scenario,
          status: result.status,
          ok: result.ok,
          summary: `${scenario.endpointKey} -> ${result.status}`,
          payload: result.data,
        });
        return;
      }

      const result = await typedFetch(scenario.url, { method: 'GET' }, { endpointKey: 'GET /todos/:id' });

      if (result.status === 200) {
        void result.data.completed;
      }

      setState({
        kind: 'done',
        scenario,
        status: result.status,
        ok: result.ok,
        summary: `${scenario.endpointKey} -> ${result.status}`,
        payload: result.data,
      });
    } catch (error) {
      setState({
        kind: 'error',
        scenario,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return (
    <main className="app">
      <section className="panel">
        <p className="eyebrow">typed-fetch vite testbed</p>
        <h1>Strict React + TypeScript validation</h1>
        <p className="lead">
          Click the button to call a random public endpoint with a matching endpoint key.
          Use this app to verify generated type narrowing in a plain Vite setup.
        </p>

        <button type="button" className="runButton" onClick={runRandomRequest}>
          Run random request
        </button>

        <ul className="hints">
          {hint.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="panel resultPanel">
        <h2>Result</h2>
        {state.kind === 'idle' && <p>No request yet.</p>}
        {state.kind === 'loading' && <p>Calling {state.scenario.endpointKey}...</p>}
        {state.kind === 'error' && (
          <p>
            {state.scenario.endpointKey}: {state.message}
          </p>
        )}
        {state.kind === 'done' && (
          <>
            <p>
              <strong>{state.summary}</strong> ({state.ok ? 'ok' : 'not ok'})
            </p>
            <pre>{JSON.stringify(state.payload, null, 2)}</pre>
          </>
        )}
      </section>
    </main>
  );
}

export default App;
