# Presigned POST uploads to MinIO

Status: accepted (2026-10-10)

## Context

Admins upload product images. Streaming files through the API wastes memory and needs extra limits.

## Decision

The API returns a presigned POST with conditions (content type `image/*`, size <= 5 MB, exact key under `products/`). The browser uploads directly to MinIO through `/media` on the public domain. Before saving, the API HEADs the object. Two S3 endpoints are used: internal for server calls, public for signing browser URLs.

## Consequences

The API never handles file bytes. Old images are deleted best effort.
