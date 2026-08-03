// Stub per il test runner: il pacchetto reale `server-only` non è una
// dipendenza npm del progetto, è risolto da Next.js internamente (Turbopack/
// webpack) per impedire che un modulo marcato tale finisca nel bundle client.
// Vitest non ha quell'alias, quindi qui basta un modulo vuoto: a fallire la
// build in caso di import lato client resta comunque Next.js, non Vitest.
export {};
