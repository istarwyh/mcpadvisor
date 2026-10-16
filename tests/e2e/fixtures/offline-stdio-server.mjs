// Exercise production offline fallback without downloading a model in CI.
// No search provider, catalog, ranking, logger, or protocol is replaced.
globalThis.fetch = async () => {
  throw new Error('Model network unavailable in offline protocol fixture');
};
const { ServerService } = await import(
  '../../../build/services/core/server/ServerService.js'
);
const { SearchService } = await import(
  '../../../build/services/searchService.js'
);
await new ServerService(new SearchService()).startWithStdio();
