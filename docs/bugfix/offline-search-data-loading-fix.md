# Offline catalog path-resolution fix

## Original problem

Offline search could fail to find the bundled server catalog when source and build
layouts differed. A missing-file test also failed because production fallback paths
were tried even when the test expected an isolated missing path.

## Resolution

`pathUtils` centralizes catalog path selection. `OfflineDataLoader` loads and
validates the selected catalog, handles missing files and reports useful errors.
Earlier code added test control over fallback path behavior so a deliberately
missing file could be tested without accidentally loading production data.

Use an explicit fixture path for isolated tests and the packaged data path for a
normal installation. Distinguish source, built-module and working-directory paths;
do not rely on one developer's absolute checkout path. Avoid silently substituting
unrelated production data in a failing test.

## Verification

Test valid and missing files, malformed data, explicit paths and packaged layout.
Exercise the public loader API and actual search results, not a removed private
method. A verification script can load the catalog, add it to an engine and run a
representative text query; random vectors demonstrate wiring only, not relevance.
The original note reported successful loader/search checks at that time. Those
historical results do not certify a later commit.

## Follow-up considerations

Resolved-path caching, configurable data locations, startup validation, data-load
metrics and search quality evaluation are possible improvements. Validate the
current source behavior and measure failures before claiming reliability or
recommendation gains.

The original Chinese source, including historical code examples and timelines, is
retained in [offline-search-data-loading-fix.zh-CN.md](./offline-search-data-loading-fix.zh-CN.md).
