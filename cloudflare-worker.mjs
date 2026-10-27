import worker from "./.open-next/worker.js";
import { databaseContext } from "./src/lib/db-context";

export default {
  ...worker,
  async fetch(request, env, ctx) {
    return databaseContext.run({}, async () => {
      const state = databaseContext.getStore();
      const close = () => state.client?.close();
      try {
        const response = await worker.fetch(request, env, ctx);
        if (!response.body) {
          ctx.waitUntil(Promise.resolve(close()));
          return response;
        }
        // Keep the connection alive until streamed rendering has finished.
        const { readable, writable } = new TransformStream();
        ctx.waitUntil(response.body.pipeTo(writable).finally(close));
        return new Response(readable, response);
      } catch (error) {
        ctx.waitUntil(Promise.resolve(close()));
        throw error;
      }
    });
  },
};
