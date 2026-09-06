import {
  browserbase,
  localBrowser,
  Stagehand,
} from '@browserbasehq/stagehand';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

let stagehandInstance: Stagehand | null = null;
let browserHandle: Awaited<
  ReturnType<typeof browserbase.launch>
> | Awaited<
  ReturnType<typeof localBrowser.launch>
> | null = null;

async function closeStagehand(): Promise<void> {
  if (stagehandInstance) {
    await stagehandInstance.close();
    stagehandInstance = null;
  }

  if (browserHandle) {
    await browserHandle.close();
    browserHandle = null;
  }
}

async function getStagehand(): Promise<Stagehand> {
  if (stagehandInstance) {
    return stagehandInstance;
  }

  const apiKey =
    process.env.BROWSERBASE_API_KEY;

  try {
    browserHandle = apiKey
      ? await browserbase.launch({
          apiKey,
          keepAlive: false,
        })
      : await localBrowser.launch({
          headless: true,
        });

    stagehandInstance =
      await Stagehand.create({
        browser:
          browserHandle,
      });

    return stagehandInstance;
  } catch (error) {
    await closeStagehand().catch(
      () => undefined,
    );

    throw error;
  }
}

async function getCurrentPage(
  stagehand: Stagehand,
) {
  const pages =
    stagehand.context.pages();

  if (!pages?.length) {
    return await stagehand.context.newPage();
  }

  return pages[0];
}

export const stagehandBrowser =
  createTool({
    id: 'stagehand-browser',

    description:
      'Read-only browser automation for JavaScript-heavy or interactive public websites. Use to navigate, observe, and extract information. Do not use it to submit forms, send messages, purchase, apply, or mutate external systems.',

    inputSchema: z.object({
      action: z.enum([
        'goto',
        'observe',
        'extract',
        'listWebMCPTools',
        'invokeWebMCPTool',
        'close',
      ]),

      url:
        z.string()
          .url()
          .optional(),

      instruction:
        z.string()
          .optional(),

      toolName:
        z.string()
          .optional(),

      toolInput:
        z.unknown()
          .optional(),

      frameId:
        z.string()
          .optional(),
    }),

    outputSchema: z.object({
      action: z.string(),
      success: z.boolean(),
      data:
        z.unknown()
          .optional(),
      error:
        z.string()
          .optional(),
    }),

    execute: async ({
      action,
      url,
      instruction,
      toolName,
      toolInput,
      frameId,
    }) => {
      try {
        if (action === 'close') {
          await closeStagehand();

          return {
            action,
            success: true,
          };
        }

        const stagehand =
          await getStagehand();

        switch (action) {
          case 'goto': {
            if (!url) {
              throw new Error(
                'url is required for goto',
              );
            }

            const page =
              await getCurrentPage(
                stagehand,
              );

            await page.goto(url);

            return {
              action,
              success: true,
              data: {
                url:
                  page.url(),
              },
            };
          }

          case 'observe': {
            if (!instruction) {
              throw new Error(
                'instruction is required for observe',
              );
            }

            const data =
              await stagehand.observe(
                instruction,
              );

            return {
              action,
              success: true,
              data,
            };
          }

          case 'extract': {
            if (!instruction) {
              throw new Error(
                'instruction is required for extract',
              );
            }

            const data =
              await stagehand.extract(
                instruction,
              );

            return {
              action,
              success: true,
              data,
            };
          }

          case 'listWebMCPTools': {
            const page =
              await getCurrentPage(
                stagehand,
              );

            const data =
              await page.listWebMCPTools();

            return {
              action,
              success: true,
              data,
            };
          }

          case 'invokeWebMCPTool': {
            if (!toolName) {
              throw new Error(
                'toolName is required for invokeWebMCPTool',
              );
            }

            const page =
              await getCurrentPage(
                stagehand,
              );

            const invocation =
              await page.invokeWebMCPTool(
                toolName,
                toolInput ?? {},
                frameId
                  ? { frameId }
                  : undefined,
              );

            const data =
              await invocation.result;

            return {
              action,
              success: true,
              data,
            };
          }
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        if (
          message.includes(
            'browser must be created by localBrowser or browserbase',
          )
        ) {
          await closeStagehand().catch(
            () => undefined,
          );
        }

        return {
          action,
          success: false,
          error: message,
        };
      }
    },
  });