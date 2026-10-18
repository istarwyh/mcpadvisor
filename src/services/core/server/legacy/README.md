# Deprecated v1 transport source

This directory preserves the previous SSE (`/sse`, `/messages`) and custom REST implementation for reference and rollback review. It is excluded from the build, lint and active test compilation, and no active module imports it. The old SDK dependencies are not installed by the modern application.

Do not add features or route traffic here. New MCP protocol code belongs in `../stateless/`; shared business handlers remain in `../tools/` and `../resources/`. Releasing a compatibility mode requires a separate reviewed decision. For operational rollback, redeploy the previous version instead of wiring this archive into the new startup chain.
