import { z } from 'zod';

export const taskDependencySchema =
  z.object({
    id: z.string(),

    title: z.string(),

    status: z.enum([
      'pending',
      'in-progress',
      'completed',
      'blocked',
    ]),

    dependsOn: z
      .array(z.string())
      .default([]),

    blockedBy: z
      .array(z.string())
      .default([]),

    priority: z.enum([
      'high',
      'normal',
      'low',
    ]),

    reason:
      z.string().optional(),
  });

export type TaskDependency =
  z.infer<
    typeof taskDependencySchema
  >;