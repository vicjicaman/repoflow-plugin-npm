import {spawn} from '@nebulario/core-process';
import {IO} from '@nebulario/core-plugin-request';

export const start = (params, cxt) => {

  const {
    module: {
      moduleid,
      mode,
      fullname,
      code: {
        paths: {
          absolute: {
            folder
          }
        },
        dependencies
      }
    },
    modules
  } = params;

  return spawn('yarn', ['start:' + mode], {
    cwd: folder
  }, {
    onOutput: async function({data}) {

      if (data.includes("Running server at") || data.startsWith("Hash: ")) {
        IO.sendEvent("run.started", {
          data
        }, cxt);
      }

      if (data.includes("Error:")) {
        IO.sendEvent("run.out.error", {
          data
        }, cxt);
      } else {
        IO.sendEvent("run.out", {
          data
        }, cxt);
      }

    },
    onError: async ({data}) => {
      IO.sendEvent("run.err", {
        data
      }, cxt);
    }
  });
}
