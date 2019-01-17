import {spawn} from '@nebulario/core-process';
import {IO} from '@nebulario/core-plugin-request';

export const start = async ({
  folder,
  mode
}, cxt) => {
  return spawn('yarn', ['start:' + mode], {
    cwd: folder
  }, {
    onOutput: async function({data}) {

      if (data.includes("Running server at") || data.startsWith("Hash: ")) {
        IO.sendEvent("run.started", {
          data
        }, cxt);
      }

      IO.sendEvent("run.out", {
        data
      }, cxt);
    },
    onError: async ({data}) => {
      IO.sendEvent("run.err", {
        data
      }, cxt);
    }
  });
}
