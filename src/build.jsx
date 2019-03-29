import {spawn} from '@nebulario/core-process';
import {Operation, IO} from '@nebulario/core-plugin-request';

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
        }
      }
    },
    modules
  } = params;

  const state = {
    started: false,
    scripts: 0
  };

  return spawn('yarn', ['build:watch:' + mode], {
    cwd: folder
  }, {
    onOutput: async function({data}) {

      if (data.includes("Webpack is watching the files")) {
        state.scripts++;
        console.log("Detected script: " + state.scripts);
      }

      //const rebuildedRegEx = new RegExp("Hash: .{20}", "g");
      //const match = rebuildedRegEx.exec(data);

      if (data.includes("Hash: ")) {
        if (!data.includes("ERROR in")) {
          state.scripts--;
          console.log("Script to go: " + state.scripts);
          if (state.started === false && state.scripts === 0) {
            state.started = true;
          }

          if (state.started === true) {
            IO.sendEvent("build.out.done", {
              data
            }, cxt);
            return;
          }
        } else {
          IO.sendEvent("build.out.error", {
            data
          }, cxt);
          return;
        }
      }

      IO.sendEvent("build.out.building", {
        data
      }, cxt);

      if (data.includes("NO_BUILD")) {
        IO.sendEvent("build.out.done", {
          data
        }, cxt);
        return;
      }
    },
    onError: async ({data}) => {
      IO.sendEvent("build.err", {
        data
      }, cxt);
    }
  });

}
