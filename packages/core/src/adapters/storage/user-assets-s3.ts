import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  AVATAR_CONTENT_TYPE,
  AVATAR_EXTS,
  type AvatarExt,
  type UserAssetStore,
  assertSafeUserId,
  avatarKey,
} from './user-assets';

interface StreamLike {
  transformToByteArray?: () => Promise<Uint8Array>;
}

// A genuine miss (NoSuchKey / 404) means "try the next ext / no avatar"; any other S3 error
// (throttling, 5xx, network, auth) must surface rather than silently read as a 404.
function isNotFound(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.name === 'NoSuchKey' || e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404;
}

async function collectBody(body: unknown): Promise<Buffer> {
  if (body == null) {
    throw new Error('user asset object has no body');
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

export function createS3UserAssetStore(opts: {
  bucket: string;
  client?: S3Client;
  endpoint?: string;
  region?: string;
  credentials?: { accessKeyId: string; secretAccessKey: string };
}): UserAssetStore {
  const client =
    opts.client ??
    new S3Client({
      region: opts.region ?? 'auto',
      endpoint: opts.endpoint,
      credentials: opts.credentials,
      forcePathStyle: true,
    });

  return {
    async putAvatar(userId: string, body: Buffer, ext: AvatarExt): Promise<void> {
      await client.send(
        new PutObjectCommand({
          Bucket: opts.bucket,
          Key: avatarKey(userId, ext),
          Body: body,
          ContentType: AVATAR_CONTENT_TYPE[ext],
        }),
      );
      // Overwrite semantics: one object per user. Drop any prior avatar in another format.
      for (const other of AVATAR_EXTS) {
        if (other === ext) continue;
        await client.send(
          new DeleteObjectCommand({ Bucket: opts.bucket, Key: avatarKey(userId, other) }),
        );
      }
    },

    async getAvatar(userId: string): Promise<{ body: Buffer; contentType: string } | null> {
      assertSafeUserId(userId);
      for (const ext of AVATAR_EXTS) {
        try {
          const res = await client.send(
            new GetObjectCommand({ Bucket: opts.bucket, Key: avatarKey(userId, ext) }),
          );
          return { body: await collectBody(res.Body), contentType: AVATAR_CONTENT_TYPE[ext] };
        } catch (err) {
          if (isNotFound(err)) continue;
          throw err;
        }
      }
      return null;
    },
  };
}
