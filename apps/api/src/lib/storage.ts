import {
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  NotFound,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';

import type { Storage } from '../deps.js';

interface S3Options {
  endpoint: string;
  publicEndpoint: string;
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
}

/**
 * Two clients: `internal` talks to MinIO inside the network,
 * `publicSigner` signs browser URLs for the public host (a signed URL is bound to one host).
 */
export function createS3Storage(opts: S3Options): Storage {
  const base = {
    region: opts.region,
    forcePathStyle: true,
    credentials: { accessKeyId: opts.accessKey, secretAccessKey: opts.secretKey },
  };
  const internal = new S3Client({ ...base, endpoint: opts.endpoint });
  const publicSigner = new S3Client({ ...base, endpoint: opts.publicEndpoint });

  return {
    async presignPost(key, contentType, maxBytes) {
      const { url, fields } = await createPresignedPost(publicSigner, {
        Bucket: opts.bucket,
        Key: key,
        Conditions: [
          ['content-length-range', 1, maxBytes],
          ['starts-with', '$Content-Type', 'image/'],
          ['eq', '$key', key],
        ],
        Fields: { 'Content-Type': contentType },
        Expires: 300,
      });
      return { url, fields };
    },
    async exists(key) {
      try {
        await internal.send(new HeadObjectCommand({ Bucket: opts.bucket, Key: key }));
        return true;
      } catch (error) {
        if (error instanceof NotFound) return false;
        if (
          (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
        )
          return false;
        throw error;
      }
    },
    async remove(key) {
      await internal.send(new DeleteObjectCommand({ Bucket: opts.bucket, Key: key }));
    },
    async ping() {
      await internal.send(new HeadBucketCommand({ Bucket: opts.bucket }));
    },
  };
}
