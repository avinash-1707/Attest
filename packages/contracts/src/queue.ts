// The run queue contract shared by the enqueuing backend and the consuming worker [tech-arch §4, §7.5].
// Both sides must agree on the queue/job name and the retry budget, so they live here, not in either app.

export const RUN_QUEUE = 'attest:runs';
export const RUN_JOB = 'run';

// Total attempts per run = initial + up to 2 environment-failure retries [tech-arch §7.5]. The producer
// sets this on the job; the worker reads its own attempt count against it to decide retry vs surface.
export const MAX_RUN_ATTEMPTS = 3;

// Exponential backoff base delay (ms) between environment-failure retries [tech-arch §7.5].
export const RUN_BACKOFF_MS = 5000;
