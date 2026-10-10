# Chainguard MinIO images

Status: accepted (2026-10-10)

## Context

MinIO removed its official images from Docker Hub in 2026; quay.io no longer allows anonymous pulls.

## Decision

Use `cgr.dev/chainguard/minio` and `cgr.dev/chainguard/minio-client`, pinned by digest. They have no shell, so bucket setup is two one-shot `mc` jobs with `MC_HOST_local`.

## Consequences

Same S3 API and data format. If Chainguard images become unavailable, build MinIO from source or migrate to Garage / SeaweedFS (S3-compatible).
