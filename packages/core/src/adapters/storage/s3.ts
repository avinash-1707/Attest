import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { nanoid } from 'nanoid';
import type { EvidenceKind, EvidenceRef } from '@attest/contracts';
import type { TenantNamespace } from '../types';
import type { EvidenceStore } from './index';
import { CONTENT_TYPE, assertOwnedRef, evidenceKey } from './keys';

interface StreamLike {
  transformToByteArray?: () => Promise<Uint8Array>;
}

async function collectBody(body: unknown): Promise<Buffer> {
  if (body == null) {
    throw new Error('evidence object has no body');
  }
  const stream = body as StreamLike;
  if (typeof stream.transformToByteArray === 'function') {
    return Buffer.from(await stream.transformToByteArray());
  }
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export function createS3EvidenceStore(opts: {
  bucket: string;
  client?: S3Client;
  endpoint?: string;
  region?: string;
  credentials?: { accessKeyId: string; secretAccessKey: string };
}): EvidenceStore {
  const client =
    opts.client ??
    new S3Client({
      region: opts.region ?? 'auto',
      endpoint: opts.endpoint,
      credentials: opts.credentials,
      forcePathStyle: true,
    });

  return {
    async put(ns: TenantNamespace, blob: Buffer, kind: EvidenceKind, id?: string): Promise<EvidenceRef> {
      const ref = evidenceKey(ns, kind, id ?? nanoid());
      await client.send(
        new PutObjectCommand({
          Bucket: opts.bucket,
          Key: ref,
          Body: blob,
          ContentType: CONTENT_TYPE[kind],
        }),
      );
      return ref;
    },

    async get(ns: TenantNamespace, ref: EvidenceRef): Promise<Buffer> {
      assertOwnedRef(ns, ref);
      const res = await client.send(
        new GetObjectCommand({ Bucket: opts.bucket, Key: ref }),
      );
      return collectBody(res.Body);
    },
  };
}
