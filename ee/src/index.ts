// ee/: commercial layer, hosted-only, ABSENT in the OSS build [arch §2, tech-arch §1.4].
// Wired into apps only behind interface seams; no app imports ee/ directly [tech-arch §1.2 rule 5].
export * from './billing/index.js';
export * from './metering/index.js';
export * from './sso/index.js';
export * from './org-management/index.js';
export * from './autoscaling/index.js';
