// Runs game analysis off the main thread: a search is synchronous and can take
// seconds, which would stall every live game's clocks if it ran in the server.
import { parentPort } from 'node:worker_threads';
import { analyseGame, type AnalysedMove, type AnalysisOptions } from './fairPlay';

interface Job { id: number; moves: AnalysedMove[]; options?: AnalysisOptions }

parentPort!.on('message', async (job: Job) => {
  try {
    const { yieldBetweenPlies: _ignored, ...options } = job.options ?? {};
    const result = await analyseGame(job.moves, options);
    parentPort!.postMessage({ id: job.id, ok: true, result });
  } catch (error) {
    parentPort!.postMessage({ id: job.id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});
