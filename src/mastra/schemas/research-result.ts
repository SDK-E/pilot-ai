import { z } from 'zod';

export const researchConfidenceSchema = z.enum([
  'HIGH',
  'MEDIUM',
  'LOW',
]);

export const verificationStatusSchema = z.enum([
  'verified',
  'partially-verified',
  'unverified',
  'contradicted',
]);

export const researchResultSchema = z.object({
  id: z.string().min(1),

  type: z.string().optional(),

  name: z.string().optional(),
  title: z.string().optional(),

  url: z.string().url().optional(),

  summary: z.string().optional(),

  sourceUrl: z.string().url().optional(),
  sourceType: z.string().optional(),

  observedAt: z.string().optional(),
  publishedAt: z.string().optional(),

  confidence: researchConfidenceSchema.optional(),

  verificationStatus:
    verificationStatusSchema.optional(),

  score: z.number().optional(),

  contradictions: z
    .array(z.string())
    .default([]),

  metadata: z
    .record(z.string(), z.unknown())
    .default({}),
});

export type ResearchResult = z.infer<
  typeof researchResultSchema
>;