// One running preview and one replaceable request. Pixel buffers are only
// allocated when a request starts, never for the discarded intermediate edits.
export function createPreviewQueue() {
  let running = false, pending = null;
  async function drain() {
    if (running) return;
    running = true;
    try {
      while (pending) {
        const job = pending;
        pending = null;
        try { job.resolve(await job.run()); }
        catch (error) { job.reject(error); }
      }
    } finally { running = false; }
  }
  return {
    request(run) {
      return new Promise((resolve, reject) => {
        if (pending) pending.resolve(null);
        pending = {run, resolve, reject};
        void drain();
      });
    },
    clear() {
      if (pending) pending.resolve(null);
      pending = null;
    }
  };
}
