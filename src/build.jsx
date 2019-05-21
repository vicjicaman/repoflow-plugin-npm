import _ from 'lodash'
import {
  exec,
  spawn
} from '@nebulario/core-process';
import {
  Operation,
  IO
} from '@nebulario/core-plugin-request';
import {
  sync
} from './dependencies'




export const clear = async (params, cxt) => {

  const {
    performer: {
      instanced
    }
  } = params;

  if (!instanced) {
    throw new Error("PERFORMER_NOT_INSTANCED");
  }

  const {
    code: {
      paths: {
        absolute: {
          folder
        }
      }
    }
  } = instanced;


  try {


  } catch (e) {
    IO.sendEvent("error", {
      data: e.toString()
    }, cxt);
    throw e;
  }

  return "NPM package cleared";
}



export const init = async (params, cxt) => {

  const {
    payload,
    module: mod,
    performer: {
      performerid,
      instanced
    },
    task: {
      performers
    }
  } = params;

  if (!instanced) {
    throw new Error("PERFORMER_NOT_INSTANCED");
  }

  const {
    code: {
      paths: {
        absolute: {
          folder
        }
      }
    },
    dependencies,
    dependents
  } = instanced;

  for (const dep of dependents) {
    const {
      checkout
    } = dep;

    const PerformerInfo = _.find(performers, {
      performerid: dep.moduleid
    });


    if (PerformerInfo && PerformerInfo.linked === true) {
      const dependentDependencies = _.filter(dependencies, dependency => dependency.moduleid === dep.moduleid)

      for (const depdep of dependentDependencies) {

        const {
          filename,
          path
        } = depdep;

        await sync({
          module: {
            moduleid: performerid,
            code: {
              paths: {
                absolute: {
                  folder
                }
              }
            }
          },
          dependency: {
            filename,
            path,
            version: "link:./../" + depdep.moduleid
          }
        }, cxt);
      }


      IO.sendEvent("out", {
        data: "Linked performer dependency: " + dep.moduleid
      }, cxt);
    }
  }


  try {

    const {
      stdout,
      stderr
    } = await exec([
      'yarn install --check-files'
    ], {
      cwd: folder
    }, {}, cxt);

    stdout && IO.sendEvent("out", {
      data: stdout
    }, cxt);

    stderr && IO.sendEvent("warning", {
      data: stderr
    }, cxt);

  } catch (e) {
    IO.sendEvent("error", {
      data: e.toString()
    }, cxt);
    throw e;
  }

  return "NPM package initialized";
}

export const start = (params, cxt) => {

  const {
    performer: {
      instanced
    }
  } = params;

  if (!instanced) {
    throw new Error("PERFORMER_NOT_INSTANCED");
  }

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


  const state = {
    started: false,
    scripts: 0
  };


  return spawn('yarn', ['build:watch:' + mode], {
    cwd: folder
  }, {
    onOutput: async function({
      data
    }) {

      if (data.includes("Webpack is watching the files")) {
        state.scripts++;
        console.log("Detected script: " + state.scripts);
      }


      if (data.includes("Hash: ")) {
        if (!data.includes("ERROR in")) {
          state.scripts--;
          console.log("Script to go: " + state.scripts);
          if (state.started === false && state.scripts === 0) {
            state.started = true;
          }

          if (state.started === true) {
            IO.sendEvent("done", {
              data
            }, cxt);
            return;
          }
        } else {
          IO.sendEvent("warning", {
            data
          }, cxt);
          return;
        }
      }


      if (data.includes("NO_BUILD")) {
        IO.sendEvent("done", {
          data
        }, cxt);
        return;
      }

      IO.sendEvent("out", {
        data
      }, cxt);

    },
    onError: async ({
      data
    }) => {

      IO.sendEvent("warning", {
        data
      }, cxt);
    }
  });

}
