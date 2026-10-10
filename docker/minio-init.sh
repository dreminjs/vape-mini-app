#!/bin/sh
# Creates the bucket and allows anonymous read only for products/*.
set -eu
mc alias set local "$MINIO_URL" "$S3_ACCESS_KEY" "$S3_SECRET_KEY"
mc mb --ignore-existing "local/$S3_BUCKET"
cat > /tmp/policy.json <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"AWS": ["*"]},
    "Action": ["s3:GetObject"],
    "Resource": ["arn:aws:s3:::$S3_BUCKET/products/*"]
  }]
}
POLICY
mc anonymous set-json /tmp/policy.json "local/$S3_BUCKET"
echo "MinIO bucket $S3_BUCKET ready"
