import {
  spawn
} from '@nebulario/core-process';
import {
  IO
} from '@nebulario/core-plugin-request';

export const start = (params, cxt) => {

  const {
    performer: {
      instanced
    }
  } = params;

  if (instanced) {
    const {
      code: {
        paths: {
          absolute: {
            folder
          }
        }
      },
      iteration: {
        mode
      }
    } = instanced;


    return spawn('yarn', ['start:' + mode], {
      cwd: folder
    }, {
      onOutput: async function({
        data
      }) {

        if (data.includes("Running server at")) {
          IO.sendEvent("done", {}, cxt);
        }

        if (data.includes("Error:")) {
          IO.sendEvent("warning", {
            data
          }, cxt);
        } else {
          IO.sendEvent("out", {
            data
          }, cxt);
        }

      },
      onError: async ({
        data
      }) => {
        IO.sendEvent("error", {
          data
        }, cxt);
      }
    });
  }
}
