import path from 'path'
import fs from 'fs'
import {
  spawn
} from '@nebulario/core-process';
import {
  IO
} from '@nebulario/core-plugin-request';

export const start = (params, cxt) => {

  const {
    performer: {
      payload,
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

    const envFile = path.join(folder, ".env");
    fs.writeFileSync(envFile, payload);


    return spawn('yarn', ['start:' + mode], {
      cwd: folder
    }, {
      onOutput: async function({
        data
      }) {

        if (data.includes("Running")) {
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
