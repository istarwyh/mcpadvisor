# Optional local FlashRank reranking

Refs #9. The existing score/priority ranking remains the default. A separately
started CPU FlashRank service can rerank up to 50 deduplicated, filtered candidates
before the final output limit. Returned `score` then means the model's relevance
score; `similarity` retains the original retrieval value. Model scores do not
establish a universal probability of relevance.

From a repository checkout (or the installed package directory):

```sh
python3 -m venv .venv-flashrank
.venv-flashrank/bin/python -m pip install -r services/flashrank/requirements.txt
FLASHRANK_CACHE_DIR=.flashrank-cache .venv-flashrank/bin/python -m uvicorn \
  services.flashrank.app:app --host 127.0.0.1 --port 8001
```

Start the MCP Advisor separately:

```sh
RERANK_PROVIDER=flashrank RERANK_URL=http://127.0.0.1:8001/rerank node build/index.js
```

The service uses the official FlashRank `Ranker` and `RerankRequest` APIs and the
default `ms-marco-TinyBERT-L-2-v2` model, downloading it once when explicitly
starting the Python service. No model download or service startup occurs in the
MCP process. FlashRank 0.2.10 code is Apache-2.0; its published Hugging Face model
distribution identifies CC-BY-SA licensing. No model weights are committed or
redistributed here. See the upstream [SDK](https://github.com/PrithivirajDamodaran/FlashRank)
and [model distribution](https://huggingface.co/prithivida/flashrank).

Requests include task/keyword/capability text and candidate titles/descriptions.
Local loopback keeps inference on the same machine. An explicitly configured
HTTPS endpoint will receive that text. This adapter implements the included
FlashRank response schema, not a Qwen/Cohere API contract. No API key is needed.

`RERANK_TIMEOUT_MS` defaults to 5000 and covers both headers and response body.
Malformed/partial/duplicate model indices, invalid scores, HTTP failures and
timeouts preserve the exact prior ranking and emit a generic warning. Blank
queries, explicit custom sort fields, unlimited or more-than-50 output requests
retain legacy ranking. Retrieval thresholds still apply before model reranking;
the model cannot recover a candidate omitted by retrieval. Default configuration
never contacts the service. Use `RERANK_PROVIDER=none` to explicitly disable it.

TinyBERT is an English retrieval model: multilingual effectiveness, latency under
load and quality on real user queries require evaluation before production use.
Synthetic fixtures only verify plumbing, not business relevance gains.
